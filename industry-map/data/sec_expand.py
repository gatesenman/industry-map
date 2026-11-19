#!/usr/bin/env python3
"""Bulk SEC 全文检索：对每个 SEC 申报公司，搜索库内其他公司名称，抽取供货/客户/竞争/合资原句。
目标：扩大 A/B 级关系样本量。用法: python3 data/sec_expand.py [--limit-filers 40]
"""
import json, os, re, sys, time, html
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import refresh as R
from refresh import get, cite, load, save, log, mark, TODAY, TYPE_KW, short
from verify import ROLE_KW, kw, names as vnames, html_text, ALIAS

LIMIT = int(sys.argv[sys.argv.index('--limit-filers')+1]) if '--limit-filers' in sys.argv else 50

def main():
    core=load('core.json',{}); micro=load('micro.json',{})
    byid={c['id']:c for c in core['companies']}
    secmap={k:v for k,v in micro.get('sec',{}).items() if v.get('cik')}
    filers=[byid[k] for k in secmap if k in byid][:LIMIT]
    others=list(byid.values())
    existing={(r['from'],r['to'],r['type']) for r in core['relations']}
    # Priority targets: companies already related or high-profile
    hot=set()
    for r in core['relations']: hot.add(r['from']); hot.add(r['to'])
    targets=[c for c in others if c['id'] in hot or c['id'] in ('apple','tesla','nvidia','tsmc','samsung','catl','foxconn','qualcomm','amd','intel','broadcom','micron','skhynix','asml','bmw','gm','ford','stellantis','hyundai','toyota','byd','lgd','boe','amkor','ase','jabil','flex','panasonic','lges','samsungsdi')]
    log('filers',len(filers),'targets',len(targets))

    new=[]
    def search_one(filer, other):
        if filer['id']==other['id']: return None
        cik=secmap[filer['id']]['cik']
        qnames=vnames(other)
        if not qnames: return None
        q=' OR '.join(f'"{n}"' for n in qnames[:3])
        try:
            d=get('https://efts.sec.gov/LATEST/search-index',{'q':q,'forms':'10-K,20-F,10-Q','ciks':f'{int(cik):010d}','dateRange':'custom','startdt':'2023-01-01','enddt':TODAY},ttl=7*86400)
            mark('SEC 全文检索',True)
        except Exception as e:
            mark('SEC 全文检索',False,str(e)[:60]); return None
        hits=sorted(d.get('hits',{}).get('hits',[]),key=lambda h:h['_source']['file_date'],reverse=True)[:2]
        for h in hits:
            adsh,fn=h['_id'].split(':'); url=f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{fn}"
            try: txt=html_text(get(url,kind='bin',ttl=30*86400,timeout=90))
            except Exception: continue
            for sent in re.split(r'(?<=[.;])\s+(?=[A-Z])',txt):
                if not (30<len(sent)<550): continue
                if not any(re.search(r'\b'+re.escape(n)+r'\b',sent) for n in qnames): continue
                # classify
                typ=None; role=None
                if re.search(kw('供货','buyer'),sent,re.I): typ,role='供货','buyer'
                elif re.search(kw('供货','seller'),sent,re.I): typ,role='供货','seller'
                elif re.search(kw('竞争','*'),sent,re.I): typ,role='竞争','*'
                elif re.search(kw('合资','*'),sent,re.I): typ,role='合资','*'
                elif re.search(kw('持股','*'),sent,re.I): typ,role='持股','*'
                elif re.search(kw('控股','*'),sent,re.I): typ,role='控股','*'
                elif re.search(kw('授权','*'),sent,re.I): typ,role='授权','*'
                else: continue
                if re.search(r'\b(would|could|may|might|if)\b.{0,40}(shift|switch|consider)',sent,re.I): continue
                # direction
                if typ=='供货' and role=='buyer':
                    frm,to=other['id'],filer['id']  # other supplies to filer
                elif typ=='供货' and role=='seller':
                    frm,to=filer['id'],other['id']
                else:
                    # competition etc: order by id for stability unless clear
                    frm,to=(filer['id'],other['id']) if filer['id']<other['id'] else (other['id'],filer['id'])
                    if typ in ('持股','控股','授权'):
                        frm,to=filer['id'],other['id']  # filer mentions owning/licensing other
                return {'from':frm,'to':to,'type':typ,'note':'SEC 全文检索自动抽取','status':'已引用','confidence':'中',
                    'evidence':[{'source':'SEC 全文检索','url':url,'date':h['_source']['file_date'],'form':h['_source']['form'],
                                'quote':sent.strip()[:600],'retrieved':TODAY}],
                    'grade':'B','conf':0.9,'filer':filer['id'],'other':other['id']}
        return None

    # Cap pairs: each filer × up to 25 targets
    pairs=[]
    for f in filers:
        ts=[t for t in targets if t['id']!=f['id']][:25]
        for t in ts:
            if (f['id'],t['id'],'供货') in existing and (t['id'],f['id'],'供货') in existing: continue
            pairs.append((f,t))
    log('pairs to search',len(pairs))
    found=0
    with ThreadPoolExecutor(4) as ex:
        futs={ex.submit(search_one,f,t): (f['id'],t['id']) for f,t in pairs}
        for fut in as_completed(futs):
            try: r=fut.result()
            except Exception as e: continue
            if not r: continue
            k=(r['from'],r['to'],r['type'])
            if k in existing: 
                # upgrade evidence if no SEC yet
                for er in core['relations']:
                    if (er['from'],er['to'],er['type'])==k:
                        if not any(e.get('source')=='SEC 全文检索' for e in er.get('evidence') or []):
                            er.setdefault('evidence',[]).insert(0,r['evidence'][0])
                            if er.get('grade') in ('C','待核实',None): er['grade']='A' if any(e.get('source')!='SEC 全文检索' for e in er['evidence']) else 'B'; er['status']='已引用'; er['conf']=0.95
                            found+=1; log('upgrade',k)
                        break
                continue
            existing.add(k); core['relations'].append(r); found+=1; log('new',k,r['evidence'][0]['quote'][:100])
    core['meta']['version']='v0.6'
    save('core.json',core)
    st=load('sources.json',{}); st.setdefault('status',{}).update({k:{**v,'checked':R.NOW} for k,v in R.STATUS.items()}); save('sources.json',st)
    log('DONE new/upgraded',found,'total rels',len(core['relations']))

if __name__=='__main__': main()
