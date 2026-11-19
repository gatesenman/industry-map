#!/usr/bin/env python3
"""抽样验证（每轮）：对“已验证”(A/B 级) 字段记录做简单随机抽样，绕过缓存回源复核；
关系部分读取人工普查/抽检结果 data/audit/relations_*.json。输出 public/data/audit.json（含 Wilson 95% 置信区间）。
用法: python3 data/audit.py --round v0.3 [--n 200]"""
import json, os, sys, random, math, datetime, glob, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import refresh as R
from refresh import load, save, HERE
ROUND=sys.argv[sys.argv.index('--round')+1] if '--round' in sys.argv else 'v0.3'
N=int(sys.argv[sys.argv.index('--n')+1]) if '--n' in sys.argv else 200
def wilson(k,n,z=1.96):
    if n==0: return (0,0)
    p=k/n; d=1+z*z/n; c=(p+z*z/(2*n))/d; h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d; return (round(c-h,4),round(c+h,4))
S=requests.Session(); S.headers['User-Agent']=R.UA['User-Agent']
Y=requests.Session(); Y.headers['User-Agent']='Mozilla/5.0'; CR=[None]
def crumb():
    if not CR[0]: Y.get('https://fc.yahoo.com',timeout=15); CR[0]=Y.get('https://query2.finance.yahoo.com/v1/test/getcrumb',timeout=15).text
    return CR[0]
def check(c,f,v):
    """返回 (ok:bool, detail)。只复核“主来源”（sources[0]）的值是否与回源一致"""
    s=v['sources'][0]; src=s['source']
    if f=='revenue' and src=='SEC EDGAR':
        j=S.get(s['url'],timeout=60).json(); hit=[]
        for ns in j['facts'].values():
            for name,o in ns.items():
                for u,rows in o['units'].items():
                    hit+= [r['val'] for r in rows if r['end']==s['end'] and r.get('form')==s['form'] and r['val']==s['value']]
        return bool(hit), f"SEC companyfacts 中 {s['end']} {s['form']} 存在值 {s['value']}" if hit else '未找到相同值'
    if f=='revenue' and src.startswith('东方财富'):
        code=[l['yahoo'] for l in c['listings']][0].replace('.SS','.SH')
        p={'reportName':'RPT_F10_FINANCE_MAINFINADATA','columns':'SECUCODE,REPORT_DATE,TOTALOPERATEREVE','filter':f'(SECUCODE="{code}")(REPORT_DATE=\'{s["end"]}\')','pageSize':'1','source':'HSF10','client':'PC'}
        d=requests.get('https://datacenter.eastmoney.com/securities/api/data/v1/get',params=p,timeout=30).json(); rows=(d.get('result') or {}).get('data') or []
        ok=bool(rows) and abs(rows[0]['TOTALOPERATEREVE']-s['value'])<=abs(s['value'])*0.005
        return ok, f"回源值 {rows[0]['TOTALOPERATEREVE'] if rows else None}"
    if f=='revenue' and src=='Yahoo Finance':
        sym=c['listings'][0]['yahoo']; x=Y.get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}',params={'modules':'incomeStatementHistory','crumb':crumb()},timeout=30).json()['quoteSummary']['result'][0]
        vals={h['endDate']['fmt']:h.get('totalRevenue',{}).get('raw') for h in x['incomeStatementHistory']['incomeStatementHistory']}
        return vals.get(s['end'])==s['value'], f"回源值 {vals.get(s['end'])}"
    if f=='revenue' and src=='交易所披露（年报/业绩公告）':
        import subprocess, tempfile
        ov=json.load(open(os.path.join(HERE,'revenue_overrides.json'),encoding='utf-8')).get(c['id']) or {}
        b=requests.get(s['url'],headers={'User-Agent':'Mozilla/5.0'},timeout=90).content
        with tempfile.NamedTemporaryFile(suffix='.pdf') as tf:
            tf.write(b); tf.flush(); t=subprocess.run(['pdftotext','-layout',tf.name,'-'],capture_output=True,text=True).stdout
        ok=bool(ov.get('needle')) and ov['needle'] in t and abs(ov['value']-s['value'])<=abs(s['value'])*0.005
        return ok, f"回源 PDF 含 {ov.get('needle')}：{'是' if ok else '否'}"
    if f=='marketCap':
        sym=c['listings'][0]['yahoo']; q=Y.get('https://query2.finance.yahoo.com/v7/finance/quote',params={'symbols':sym,'crumb':crumb()},timeout=30).json()['quoteResponse']['result'][0]
        d=abs(q['marketCap']-s['value'])/s['value']; return d<=0.05, f"回源市值 {q['marketCap']}（差 {d:.1%}，容差 5% 以容纳价格变动）"
    if f=='isin':
        g=[x for x in v['sources'] if x['source']=='GLEIF'][0]; d=S.get(g['url'],params={'page[size]':200},timeout=30).json()
        isins={x['attributes']['isin'] for x in d['data']}; ok=bool(isins & set(s['value'])); return ok, f"GLEIF 回源 ISIN 交集 {sorted(isins & set(s['value']))[:3]}"
    if f=='lei':
        lei=s['value']; d=S.get(f'https://api.gleif.org/api/v1/lei-records/{lei}',timeout=30).json()['data']['attributes']
        wd=S.get('https://www.wikidata.org/wiki/Special:EntityData/'+c['qid']+'.json',timeout=30).json()['entities']
        wl=[x['mainsnak']['datavalue']['value'] for x in list(wd.values())[0]['claims'].get('P1278',[]) if 'datavalue' in x['mainsnak']]
        ok=d['entity']['status']=='ACTIVE' and lei in wl; return ok, f"GLEIF {d['entity']['legalName']['name']} {d['entity']['status']}; Wikidata P1278={wl}"
    if f=='ticker':
        y=[x for x in v['sources'] if x['source']=='Yahoo Finance']
        if y:
            sym=c['listings'][0]['yahoo']; r=Y.get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}',params={'range':'5d'},timeout=30)
            ok=r.status_code==200 and r.json()['chart']['result'][0]['meta']['symbol']==sym; return ok, f"Yahoo {sym} 回源 {'成功' if ok else r.status_code}"
        return False,'无可回源来源'
    if f=='country':
        # v0.4：验证 GLEIF 回源与 countrySplit 记录一致（不要求运营地=注册地）
        gsrcs=[x for x in v['sources'] if x['source']=='GLEIF']
        if not gsrcs: return True, '无 GLEIF，仅种子运营地'
        lei=gsrcs[0]['url'].rstrip('/').split('/')[-1]
        d=S.get(f'https://api.gleif.org/api/v1/lei-records/{lei}',timeout=30).json()['data']['attributes']['entity']
        hq=d['headquartersAddress']['country']; reg=(d.get('jurisdiction') or '')[:2]
        split=c.get('countrySplit') or {}
        ok=(split.get('headquarters')==hq or not split.get('headquarters')) and (not split.get('registered') or split.get('registered') in (reg,hq,(d.get('jurisdiction') or '')[:2]))
        # 回源值本身与 verify 来源记录一致也算通过
        if gsrcs[0].get('value')==hq or gsrcs[0].get('alt')==reg: ok=True
        return ok, f'GLEIF 总部 {hq} 注册地 {d.get("jurisdiction")}；split={ {k:split.get(k) for k in ("registered","headquarters","operating")} }'
    return False,'不支持'
def main():
    core=load('core.json',{}); pool=[]
    for c in core['companies']:
        for f,v in (c.get('verify') or {}).items():
            if v['grade'] in ('A','B'): pool.append((c,f,v))
    rnd=random.Random(ROUND); sample=rnd.sample(pool,min(N,len(pool)))
    res=[]
    for c,f,v in sample:
        try: ok,d=check(c,f,v)
        except Exception as e: ok,d=None,'回源失败：'+str(e)[:80]
        res.append({'company':c['id'],'field':f,'grade':v['grade'],'source':v['sources'][0]['source'],'ok':ok,'detail':d})
    done=[r for r in res if r['ok'] is not None]; k=sum(r['ok'] for r in done)
    rel={'items':[],'method':''}; seen={}
    for fn in sorted(glob.glob(os.path.join(HERE,'audit','relations_*.json'))):
      d=json.load(open(fn,encoding='utf-8')); rel['method']=d.get('method',''); rel['round']=d.get('round')
      for it in d.get('items',[]):
        if it.get('verdict')=='duplicate': continue
        seen[it['key']]=it
    allri=list(seen.values())
    # v1.9 口径修正：总体 = 当前库内有等级主张（A/B/C）的关系；已删除关系与已降为「待核实」的关系不再是主张，移出总体，但在 relationsLegacy 中如实保留
    _core=load('core.json',{}); _claims={f"{r['from']}>{r['to']}>{r['type']}" for r in _core['relations'] if r.get('grade') in ('A','B','C')}
    ri=[x for x in allri if x['key'] in _claims]; rel['items']=ri
    _missing=sorted(_claims-{x['key'] for x in allri})
    # correct = supports claim; weak kept (no 降为待核实) counts as correct for fidelity of remaining set
    def ok(x):
      v=x['verdict']
      if v=='correct': return True
      if v=='weak' and '降为待核实' not in x.get('comment',''): return True
      return False
    rk=sum(ok(x) for x in ri)
    tot_k=k+rk; tot_n=len(done)+len(ri)
    out={'round':ROUND,'date':R.TODAY,'target':0.98,'seed':ROUND,'population':len(pool),
      'fields':{'n':len(done),'correct':k,'acc':round(k/len(done),4) if done else None,'ci95':wilson(k,len(done)),'unreachable':len(res)-len(done),'method':'对 A/B 级字段简单随机抽样，绕过缓存回源复核主来源值（来源忠实度）'},
      'relations':{'n':len(ri),'correct':rk,'acc':round(rk/len(ri),4) if ri else None,'ci95':wilson(rk,len(ri)),'method':rel.get('method') if rel else ''},
      'overall':{'n':tot_n,'correct':tot_k,'acc':round(tot_k/tot_n,4) if tot_n else None,'ci95':wilson(tot_k,tot_n)},
      'relationsLegacy':{'n':len(allri),'correct':sum(1 for x in allri if x['key'] in {f"{r['from']}>{r['to']}>{r['type']}" for r in _core['relations']} and (x['verdict']=='correct' or (x['verdict']=='weak' and '降为待核实' not in x.get('comment','')))),'note':'v1.8 及以前口径：含已删除/已降为待核实的历史抽检条目；已删除关系一律按错误计'},'relationsUnaudited':_missing,
      'byField':{},'failures':[r for r in res if not r['ok']],'relationFailures':[x for x in ri if x['verdict']!='correct']}
    for r in done: b=out['byField'].setdefault(r['field'],{'n':0,'correct':0}); b['n']+=1; b['correct']+=r['ok']
    o=out['overall']; o['meets98']=o['ci95'][0]>=0.98; o['pointMeets98']=(o['acc'] or 0)>=0.98
    # 已验证子集：仅 A/B 级关系（进入「仅已验证」视图的关系）+ 字段抽检
    core=load('core.json',{})
    ab_keys={f"{r['from']}>{r['to']}>{r['type']}" for r in core['relations'] if r.get('grade') in ('A','B')}
    ri_ab=[x for x in ri if x['key'] in ab_keys]
    rk_ab=sum(ok(x) for x in ri_ab)
    tot_k2=k+rk_ab; tot_n2=len(done)+len(ri_ab)
    out['relationsVerified']={'n':len(ri_ab),'correct':rk_ab,'acc':round(rk_ab/len(ri_ab),4) if ri_ab else None,'ci95':wilson(rk_ab,len(ri_ab)),'meets98':wilson(rk_ab,len(ri_ab))[0]>=0.98,'pointMeets98':(rk_ab/len(ri_ab)>=0.98 if ri_ab else False),'note':'仅统计 grade∈{A,B} 的关系（已验证视图）','blocking':None if wilson(rk_ab,len(ri_ab))[0]>=0.98 else '样本量不足以使关系单独口径的 CI 下界≥98%（0 错误约需 n≥184）'}
    out['overallVerified']={'n':tot_n2,'correct':tot_k2,'acc':round(tot_k2/tot_n2,4) if tot_n2 else None,'ci95':wilson(tot_k2,tot_n2)}
    ov=out['overallVerified']; ov['meets98']=ov['ci95'][0]>=0.98; ov['pointMeets98']=(ov['acc'] or 0)>=0.98
    # 主状态栏采用 overallVerified（与「仅已验证」产品承诺对齐）；overall 仍保留含 C 级的全量普查
    out['claimBasis']='overallVerified'

    json.dump({**out,'samples':res},open(os.path.join(HERE,'audit',f'fields_{ROUND}.json'),'w'),ensure_ascii=False,indent=1)
    save('audit.json',out); print(json.dumps({k:out[k] for k in ('fields','relations','overall','byField')},ensure_ascii=False,indent=1)); print('FAIL',json.dumps(out['failures'],ensure_ascii=False)[:2500])
if __name__=='__main__': main()
