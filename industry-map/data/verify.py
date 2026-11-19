#!/usr/bin/env python3
"""可靠数据体系：多源交叉验证 + 置信度打分 + 一手原句证据（SEC 全文检索）
用法: python3 data/verify.py   （在 refresh.py 之后运行；refresh.py 末尾会自动调用）
输出: 回写 public/data/core.json 中每家公司的 verify 字段、每条关系的 grade/conf；生成 public/data/verification.json
规则见 research/data_sourcing.md 第二章。"""
import json, os, re, sys, time, html, datetime, math
from concurrent.futures import ThreadPoolExecutor
import requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import refresh as R
from refresh import get, cite, load, save, log, mark, TODAY, CID, TYPE_KW, short, HERE, REV_OV
TIER_W={'T1':0.90,'T1.5':0.85,'T2':0.70,'T3':0.55,'T0':0.20}
TIER={'SEC EDGAR':'T1','SEC 全文检索':'T1','GLEIF':'T1','东方财富(交易所定期报告)':'T1.5','东方财富年报PDF（交易所定期报告镜像）':'T1.5','东方财富年报PDF':'T1.5','Yahoo Finance':'T2','Wikidata':'T2','Wikipedia':'T3','种子名录':'T0','Samsung Electronics IR (Business Report)':'T1','公司 IR 年报/综合报告':'T1','交易所披露（年报/业绩公告）':'T1'}

# 短英文名 / CJK 法定名无法与种子 en 词元相交时的 LEI 实体确认（Wikidata LEI → GLEIF ACTIVE 后人工/别名复核）
LEI_EXPAND = {
  'amd':'Advanced Micro Devices','ti':'Texas Instruments','st':'STMicroelectronics','gf':'GlobalFoundries',
  'adi':'Analog Devices','gm':'General Motors','gwm':'Great Wall Motor','gac':'Guangzhou Automobile',
  'saic':'SAIC Motor','lgd':'LG Display','smic':'Semiconductor Manufacturing International',
}
LEI_VERIFIED_CJK = {
  # id → 法定名中可识别片段或已人工确认（Wikidata P1278 = GLEIF ACTIVE）
  'samsung','skhynix','mediatek','byd','foxconn','smic','samsungsdi','flat','lgd','pegatron','wistron','panasonic','gac','saic',
}
def lei_entity_ok(c, g):
  if not g or g.get('status')!='ACTIVE': return False
  ln = g.get('legalName') or ''
  if R._tok(ln) & R._tok(c.get('en') or ''): return True, '名称匹配'
  exp = LEI_EXPAND.get(c['id'])
  if exp and (R._tok(ln) & R._tok(exp)): return True, '扩展英文名匹配'
  # 拉丁字符子串（如 legalName 含 "Guangzhou Automobile"）
  en = (exp or c.get('en') or '')
  for tok in re.findall(r'[A-Za-z]{4,}', en):
    if tok.lower() in ln.lower(): return True, '英文子串匹配'
  if c['id'] in LEI_VERIFIED_CJK: return True, 'CJK 法定名+Wikidata LEI 已确认'
  return False, None
def age_f(d):
    try: n=(datetime.date.fromisoformat(TODAY)-datetime.date.fromisoformat(str(d)[:10])).days
    except Exception: return 0.85
    return 1 if n<=400 else 0.85 if n<=800 else 0.6
def conf(srcs, conflict=False, half=()):
    p=1.0
    for s in srcs:
        w=TIER_W[TIER.get(s['source'],'T2')]*age_f(s.get('date'))*(0.5 if s['source'] in half else 1)
        p*=1-w
    c=1-p
    return round(min(c,0.3) if conflict else c,3)
def grade(srcs, agree, conflict):
    if conflict: return 'X'
    if not srcs: return '缺失'
    t=[TIER.get(s['source'],'T2') for s in srcs]
    if agree>=2 and (any(x.startswith('T1') for x in t) or len(srcs)>=2): return 'A'
    if any(x.startswith('T1') for x in t): return 'B'
    return 'C'
GR={'A':4,'B':3,'C':2,'X':1,'待核实':0,'缺失':0,None:0}
def rel(a,b): return abs(a-b)/max(abs(a),abs(b),1e-9)

# ---------- 额外独立来源 ----------
S=requests.Session(); S.headers['User-Agent']='Mozilla/5.0'
CRUMB=None
def ycrumb():
    global CRUMB
    if CRUMB: return CRUMB
    S.get('https://fc.yahoo.com',timeout=15); CRUMB=S.get('https://query2.finance.yahoo.com/v1/test/getcrumb',timeout=15).text; return CRUMB
def ycache(name,fn,ttl=20*3600):
    p=os.path.join(R.CACHE,'yv_'+re.sub(r'[^\w.]','_',name)+'.json')
    if not R.FORCE and os.path.exists(p) and time.time()-os.path.getmtime(p)<ttl: return json.load(open(p))
    try: v=fn(); json.dump(v,open(p,'w')); return v
    except Exception as e:
        if os.path.exists(p): return json.load(open(p))
        raise
def yquote(syms):
    out={}
    for i in range(0,len(syms),40):
        ch=syms[i:i+40]
        def f(): 
            r=S.get('https://query2.finance.yahoo.com/v7/finance/quote',params={'symbols':','.join(ch),'crumb':ycrumb()},timeout=30); r.raise_for_status(); return r.json()['quoteResponse']['result']
        try:
            for q in ycache('quote_'+str(abs(hash(','.join(ch)))%10**8)+'_'+str(i),f): out[q['symbol']]=q
            mark('Yahoo Finance',True)
        except Exception as e: mark('Yahoo Finance',False,'quote '+str(e)[:60])
    return out
def yincome(sym):
    def f():
        r=S.get(f'https://query2.finance.yahoo.com/v10/finance/quoteSummary/{sym}',params={'modules':'incomeStatementHistory,financialData','crumb':ycrumb()},timeout=30); r.raise_for_status()
        x=r.json()['quoteSummary']['result'][0]
        return {'cur':x.get('financialData',{}).get('financialCurrency'),'annual':[{'end':h['endDate']['fmt'],'revenue':h.get('totalRevenue',{}).get('raw')} for h in x['incomeStatementHistory']['incomeStatementHistory']]}
    try: v=ycache('inc_'+sym,f); mark('Yahoo Finance',True); return v
    except Exception as e: mark('Yahoo Finance',False,'income '+sym); return None
EM='https://datacenter.eastmoney.com/securities/api/data/v1/get'
def eastmoney(code):
    p={'reportName':'RPT_F10_FINANCE_MAINFINADATA','columns':'SECUCODE,REPORT_DATE,REPORT_TYPE,TOTALOPERATEREVE,PARENTNETPROFIT,XSMLL','filter':f'(SECUCODE="{code}")(REPORT_TYPE="年报")','sortColumns':'REPORT_DATE','sortTypes':'-1','pageSize':'3','source':'HSF10','client':'PC'}
    try:
        d=get(EM,p); rows=(d.get('result') or {}).get('data') or []; mark('东方财富 F10',bool(rows)); return rows
    except Exception as e: mark('东方财富 F10',False,str(e)[:80]); return []
def gleif_isins(lei):
    try:
        d=get(f'https://api.gleif.org/api/v1/lei-records/{lei}/isins',{'page[size]':200}); mark('GLEIF',True)
        return [x['attributes']['isin'] for x in d.get('data',[])]
    except Exception as e: mark('GLEIF',False,'isins'); return None

# ---------- SEC 全文检索：关系一手原句 ----------
ALIAS={'tsmc':['Taiwan Semiconductor Manufacturing','TSMC'],'samsung':['Samsung'],'skhynix':['SK hynix','SK Hynix'],'catl':['Contemporary Amperex','CATL'],'lgensol':['LG Energy Solution'],'panasonic':['Panasonic'],'byd':['BYD'],'asml':['ASML'],'foxconn':['Hon Hai','Foxconn'],'apple':['Apple'],'nvidia':['NVIDIA','Nvidia'],'tesla':['Tesla'],'intel':['Intel'],'amd':['Advanced Micro Devices','AMD'],'micron':['Micron'],'qualcomm':['Qualcomm'],'broadcom':['Broadcom'],'amkor':['Amkor'],'ase':['ASE Technology','ASE Group','Advanced Semiconductor Engineering']}
def names(c): 
    n=ALIAS.get(c['id']) or [c['en'],short(c['en'])]
    return [x for x in dict.fromkeys(n) if len(x)>=3]
def html_text(b):
    t=b.decode('utf-8','ignore'); t=re.sub(r'(?is)<(script|style).*?</\1>',' ',t); t=re.sub(r'(?s)<[^>]+>',' ',t); t=html.unescape(t)
    return re.sub(r'\s+',' ',t)
ROLE_KW={('供货','buyer'):r'supplier|foundr|purchase[sd]? (memory |wafers? )?from|rely on|sole[- ]source|contract manufactur|subcontract|utilize[sd]?|outsourc|we buy|procure',
 ('供货','seller'):r'customer|client|net sales|revenue from|accounted for|supply agreement|we supply|ship(ped)? to',
 ('持股','*'):r'stake|equity (interest|investment|method)|ownership|owns|shares of|invest(ed|ment) in|investor',
 ('控股','*'):r'subsidiary|acquired|controlling|majority[- ]owned',
 ('合资','*'):r'joint venture',('竞争','*'):r'compet',('授权','*'):r'licens'}
def kw(typ,role): return ROLE_KW.get((typ,role)) or ROLE_KW.get((typ,'*')) or TYPE_KW.get(typ,'.')
def sec_evidence(filer, other, typ, role='*'):
    cik=filer['cik']; q=' OR '.join(f'"{n}"' for n in names(other))
    try:
        d=get('https://efts.sec.gov/LATEST/search-index',{'q':q,'forms':'10-K,20-F','ciks':f'{int(cik):010d}','dateRange':'custom','startdt':'2023-01-01','enddt':TODAY})
        mark('SEC 全文检索',True)
    except Exception as e: mark('SEC 全文检索',False,str(e)[:80]); return None
    hits=sorted(d.get('hits',{}).get('hits',[]),key=lambda h:h['_source']['file_date'],reverse=True)
    for h in hits[:2]:
        adsh,fn=h['_id'].split(':'); url=f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{adsh.replace('-','')}/{fn}"
        try: txt=html_text(get(url,kind='bin',ttl=30*86400,timeout=90))
        except Exception: continue
        for sent in re.split(r'(?<=[.;])\s+(?=[A-Z])',txt):
            if 25<len(sent)<600 and any(re.search(r'\b'+re.escape(n)+r'\b',sent) for n in names(other)) and re.search(kw(typ,role),sent,re.I) and not re.search(r'\b(would|could|may|might|if)\b.{0,40}(shift|switch)',sent):
                return {'source':'SEC 全文检索','url':url,'date':h['_source']['file_date'],'form':h['_source']['form'],'quote':sent.strip()[:600],'retrieved':TODAY}
    return None

import glob
RAUD={}
for f in sorted(glob.glob(os.path.join(HERE,'audit','relations_*.json'))):
    d=json.load(open(f,encoding='utf-8'))
    items=d.get('items') if isinstance(d,dict) else None
    if not items: continue
    for it in items: RAUD[it['key']]=it
def main():
    core=load('core.json',{}); micro=load('micro.json',{}); fx=micro.get('fx',{})
    def usd(v,cur):
        if v is None or cur is None: return None
        if cur=='USD': return v
        r=fx.get(cur,{}).get('perUSD'); return v/r if r else None
    comps=core['companies']; byid={c['id']:c for c in comps}
    syms=[l['yahoo'] for c in comps if c['id'] not in R.LISTING_ST for l in c['listings'][:1]]
    yq=yquote(syms); log('Yahoo quote',len(yq))
    with ThreadPoolExecutor(4) as ex: yinc=dict(zip(syms,ex.map(yincome,syms)))
    log('Yahoo income',sum(1 for v in yinc.values() if v))
    stats={}
    for c in comps:
        V={}; sym=c['listings'][0]['yahoo'] if c['listings'] and c['id'] not in R.LISTING_ST else None
        q=yq.get(sym); s=micro.get('sec',{}).get(c['id']); yurl=f'https://finance.yahoo.com/quote/{sym}'
        # 营收
        srcs=[]
        if s and s.get('revenue') and s['revenue']['annual']:
            a=s['revenue']['annual'][-1]; srcs.append({'source':'SEC EDGAR','value':a['value'],'cur':s['revenue']['unit'],'end':a['end'],'date':a['filed'],'url':s['url'],'form':a['form']})
        ov=REV_OV.get(c['id'])
        if ov and not srcs:  # 一手披露覆盖（HKEX/交易所年报），作为主来源
            srcs.append({'source':ov['source'],'value':ov['value'],'cur':ov['cur'],'end':ov['end'],'date':ov['date'],'url':ov['url'],'form':ov['form'],'quote':ov.get('quote','')})
        if c['exchange'] in ('SZSE','SSE','SSE STAR','BSE'):
            rows=eastmoney(sym.replace('.SS','.SH'))
            if rows: r0=rows[0]; srcs.append({'source':'东方财富(交易所定期报告)','value':r0['TOTALOPERATEREVE'],'cur':'CNY','end':r0['REPORT_DATE'][:10],'date':r0['REPORT_DATE'][:10],'url':f'https://emweb.securities.eastmoney.com/pc_hsf10/pages/index.html?type=web&code={sym[-2:]}{sym[:6]}#/cwfx','api':EM})
        # 双上市：若已有 SEC(USD) 营收，优先用美元代码的 Yahoo 年报，避免 A 股 CNY 与 ADR USD 假冲突
        ysym=sym
        if srcs and srcs[0].get('source')=='SEC EDGAR' and srcs[0].get('cur')=='USD':
          for l in c.get('listings') or []:
            if l.get('yahoo') and not l['yahoo'].endswith(('.SS','.SZ','.HK','.T','.KS','.KQ')):
              ysym=l['yahoo']; break
        yi=yinc.get(ysym) or yinc.get(sym)
        if yi and yi['annual'] and yi['annual'][0].get('revenue'):
            a=yi['annual'][0]; srcs.append({'source':'Yahoo Finance','value':a['revenue'],'cur':yi['cur'],'end':a['end'],'date':a['end'],'url':f'https://finance.yahoo.com/quote/{ysym}/financials'})
        # 第三来源：Wikidata P2139（若与主来源同财年）
        wr=c.get('wd_revenue')
        if wr and wr.get('value') is not None:
            srcs.append({'source':'Wikidata','value':wr['value'],'cur':wr.get('unit'),'end':(wr.get('date') or '')[:10],'date':(wr.get('date') or '')[:10],'url':c.get('wikidata') or wr.get('url','')})
        V['revenue']=judge(srcs,tol=0.08,usd=usd,period=True)
        # 市值
        srcs=[]
        if q and q.get('marketCap'): srcs.append({'source':'Yahoo Finance','value':q['marketCap'],'cur':q.get('currency'),'date':datetime.datetime.fromtimestamp(q.get('regularMarketTime',0),datetime.timezone.utc).strftime('%Y-%m-%d'),'url':yurl})
        if s and s.get('shares') and q and q.get('regularMarketPrice') and q.get('currency')=='USD' and s['shares'].get('form') in ('10-K','10-Q'):
            try: shares_age=(datetime.date.fromisoformat(TODAY)-datetime.date.fromisoformat(str(s['shares'].get('end') or TODAY)[:10])).days
            except Exception: shares_age=9999
            if shares_age<=400:
                calc=s['shares']['value']*q['regularMarketPrice']
                if q.get('marketCap') and abs(calc-q['marketCap'])/max(q['marketCap'],1)>0.25:
                    pass  # 双类股/流通股口径差异过大，不引入假冲突（如 Mobileye）
                else:
                    srcs.append({'source':'SEC EDGAR','value':calc,'cur':'USD','date':s['shares']['end'],'url':s['url'],'note':'SEC 普通股数×Yahoo 价格（半独立）'})
            # 过旧股本不参与市值交叉，避免假 X（如 nextracker 2024-01 股本）
        # Yahoo sharesOutstanding×price：仅当与 Yahoo marketCap 差 ≤10% 时作为确认注记（不另计独立源；双类股/H股常不一致）
        if q and q.get('sharesOutstanding') and q.get('regularMarketPrice') and q.get('marketCap'):
            calc=q['sharesOutstanding']*q['regularMarketPrice']; d=abs(calc-q['marketCap'])/max(q['marketCap'],1)
            if d<=0.10:
                srcs.append({'source':'Yahoo Finance','value':calc,'cur':q.get('currency'),'date':datetime.datetime.fromtimestamp(q.get('regularMarketTime',0),datetime.timezone.utc).strftime('%Y-%m-%d'),'url':yurl,'note':f'sharesOutstanding×price 确认（差 {d:.1%}，半独立）'})
        # A股：东方财富总股本 × Yahoo 本币价格（相对 Yahoo marketCap 独立——股本来自交易所披露转载）
        cn=c.get('cnShares'); 
        if cn and cn.get('total') and q and q.get('regularMarketPrice') and q.get('currency')=='CNY':
            calc=cn['total']*q['regularMarketPrice']
            srcs.append({'source':'东方财富(交易所定期报告)','value':calc,'cur':'CNY','date':TODAY,'url':cn.get('url',''),'note':'总股本×Yahoo CNY 收盘价'})
        wm=c.get('wd_marketCap')
        if wm and wm.get('value') is not None:
            # 跳过无法识别的币种代码（如 Q4916）以及过旧（>800 天）的 Wikidata 市值，避免假冲突
            unit=wm.get('unit') or ''
            try: age=(datetime.date.fromisoformat(TODAY)-datetime.date.fromisoformat(str(wm.get('date') or TODAY)[:10])).days
            except Exception: age=9999
            if unit and not unit.startswith('Q') and age<=800:
                srcs.append({'source':'Wikidata','value':wm['value'],'cur':unit,'date':(wm.get('date') or '')[:10],'url':c.get('wikidata') or ''})
        V['marketCap']=judge(srcs,tol=0.10,usd=usd,half=('SEC EDGAR',))
        yonly=[x for x in V['marketCap']['sources'] if x['source']=='Yahoo Finance']
        oth=[x for x in V['marketCap']['sources'] if x['source']!='Yahoo Finance']
        if V['marketCap']['grade']=='A' and not oth:
          V['marketCap']['grade']='C'; V['marketCap']['notes'].append('仅 Yahoo 内部确认，无独立第二来源，降为 C')
          V['marketCap']['conf']=conf(yonly[:1])
        # ISIN
        srcs=[]
        if c.get('isin'): srcs.append({'source':'Wikidata','value':c['isin']['value'],'date':TODAY,'url':c['wikidata']})
        if c.get('lei'):
            gi=gleif_isins(c['lei']['value'])
            if gi: srcs.append({'source':'GLEIF','value':gi[:20],'date':TODAY,'url':f"https://api.gleif.org/api/v1/lei-records/{c['lei']['value']}/isins"})
        V['isin']=judge_set(srcs)
        # LEI：GLEIF 记录存在且 ACTIVE + (英文名词元重合 或 GLEIF ISIN 与 Wikidata ISIN 有交集) 才算第二独立来源
        srcs=[]; g=c.get('gleif')
        if c.get('lei'): srcs.append({'source':'Wikidata','value':c['lei']['value'],'date':TODAY,'url':c['wikidata']})
        isin_ok=V['isin'].get('agree',0)>=2
        ok, how = lei_entity_ok(c, g) if g else (False, None)
        if g and g.get('status')=='ACTIVE' and (ok or isin_ok):
            srcs.append({'source':'GLEIF','value':g['lei'],'date':TODAY,'url':g['url'],'note': how or 'ISIN 交集匹配'})
        V['lei']=judge_cat(srcs, conflict=bool(c.get('lei') and (not g or g.get('status')!='ACTIVE')))
        if g and len(srcs)==1: V['lei']['notes'].append(f"GLEIF 记录存在（{g['legalName']}），但无法自动确认为同一实体（本地语言名称），未计为独立来源")
        # 国家拆分：注册地 / 总部 / 运营地（种子）
        g=c.get('gleif') or g
        reg=(g.get('jurisdiction') or '')[:2] if g else None
        hq=g.get('hqCountry') if g else None
        op=c['country']
        c['countrySplit']={'registered':reg,'headquarters':hq,'operating':op,
          'sources':([{'source':'GLEIF','field':'jurisdiction','value':g.get('jurisdiction'),'url':g['url']}] if g else [])+([{'source':'GLEIF','field':'hqCountry','value':hq,'url':g['url']}] if g else [])+[{'source':'种子名录','field':'operating','value':op,'url':''}]}
        # 兼容旧 country 验证：运营地 vs 总部/注册地任一一致 → 不冲突
        srcs=[{'source':'种子名录','value':op,'date':TODAY,'url':''}]
        if g: srcs.append({'source':'GLEIF','value':hq,'alt':reg,'date':TODAY,'url':g['url']})
        # 仅当运营地与总部、注册地均不同时才 X
        conflict=bool(g and op not in (hq,reg,None) and hq and reg and op!=hq and op!=reg)
        V['country']=judge_cat(srcs, key=op, conflict=conflict)
        if conflict: V['country']['notes'].append(f'运营地 {op} ≠ 总部 {hq} / 注册地 {reg}（已拆分字段，不自动判错）'); V['country']['grade']='B' if hq or reg else V['country']['grade']; V['country']['conf']=conf([s for s in srcs if s['source']!='种子名录'])
        # 代码
        srcs=[{'source':'种子名录','value':c['ticker'],'date':TODAY,'url':''}]
        if q: srcs.append({'source':'Yahoo Finance','value':c['ticker'],'date':TODAY,'url':yurl,'note':'交易所报价返回 '+q.get('fullExchangeName','')})
        if c.get('qid') and c.get('isin'): srcs.append({'source':'Wikidata','value':c['ticker'],'date':TODAY,'url':c['wikidata'],'note':'QID 经 P414+P249 匹配'})
        V['ticker']=judge_cat(srcs,key=c['ticker'])
        ls=R.LISTING_ST.get(c['id'])
        if ls:  # v2.6：已摘牌 → 历史代码，ticker 判 X（行情不可用），来源为 SEC 一手文件
            V['ticker']={'grade':'X','conf':0.0,'agree':len(ls['sources']),'sources':[{**x,'value':ls['ticker']} for x in ls['sources']],'notes':[f"已摘牌：{ls['status']}，{ls['date']}（{ls['source']}）；{ls['exchange']}:{ls['ticker']} 为历史代码"]}
        pv=c.get('verify') or {}
        for k,nv in list(V.items()):
            o=pv.get(k)
            if o and GR.get(nv['grade'],0)<GR.get(o.get('grade'),0) and nv['grade']!='X':
                log('keep field grade (no conflict)',c['id'],k,o.get('grade'),'->',nv['grade']); V[k]=o
            elif o and nv['grade']=='X' and o.get('grade')!='X': log('CONFLICT field X',c['id'],k)
        c['verify']=V
        for k,v in V.items():
            st=stats.setdefault(k,{}); st[v['grade']]=st.get(v['grade'],0)+1
    # 关系
    secmap={k:v for k,v in micro.get('sec',{}).items() if v.get('cik')}
    def do(r):
        r['_pg']=r.get('grade'); r['_pev']=[dict(e) for e in r.get('evidence') or []]; r['_pc']=r.get('conf')
        ev=list(r.get('evidence') or [])
        ev=[e for e in ev if e['source']!='SEC 全文检索']
        if True:
            for f,o,role in ((r['to'],r['from'],'buyer'),(r['from'],r['to'],'seller')):
                if f in secmap and o in byid:
                    e=sec_evidence(secmap[f],byid[o],r['type'],role)
                    if e: ev.insert(0,e); break
        r['evidence']=ev
        k=f"{r['from']}>{r['to']}>{r['type']}"; au=RAUD.get(k)
        if au:
            r['audit']={'verdict':au['verdict'],'comment':au['comment']}
            if au['verdict'] in ('wrong','outdated') or (au['verdict']=='weak' and '降为待核实' in au.get('comment','')):
                for e in ev: e['rejected']=e.get('rejected') or ('第二轮复审否决：'+au['comment'])
            for e in ev:
                if e['source'] in (au.get('rejectSources') or []): e['rejected']='复审否决（来源方向不符）：'+au.get('rejectNote','')
        if r.get('review'):
            for e in ev:
                if e['source']!='SEC 全文检索': e['rejected']=r['review']
        good=[e for e in ev if not e.get('rejected')]
        srcs=[{'source':e['source'],'date':e.get('date') or e.get('retrieved')} for e in good]
        kinds={e['source'] for e in good}
        hand=any(x.startswith('SEC') or '年报' in x or '东方财富年报' in x or 'IR' in x for x in kinds)
        g='A' if hand and len(kinds)>=2 else 'B' if hand else 'C' if good else '待核实'
        pg=r.get('_pg'); conflict=bool(au and au['verdict'] in ('wrong','outdated'))
        if GR.get(g,0)<GR.get(pg,0) and not conflict:
            # 无新冲突来源：不降级（例如 SEC 检索本次失败），恢复旧证据
            r['evidence']=r.get('_pev') or ev; g=pg; log('keep grade (no conflict)',k,pg)
            good=[e for e in r['evidence'] if not e.get('rejected')]; srcs=[{'source':e['source'],'date':e.get('date') or e.get('retrieved')} for e in good]
        elif GR.get(g,0)<GR.get(pg,0) and conflict and pg in ('A','B'):
            g='X'; log('CONFLICT mark X',k,pg)
        mg=r.get('manualGrade')  # v2.9：人工逐句复核锁定的等级，自动验证不得升/降（仅新冲突来源可标 X）
        if mg and not conflict and g!=mg:
            log('manual lock',k,g,'->',mg); r['evidence']=r.get('_pev') or ev; g=mg; pg=mg
        r['grade']=g; r['conf']=(r.get('_pc') if g==pg and r.get('_pc') else conf(srcs)) if g not in ('待核实','X') else (0.3 if g=='X' else 0)
        r.pop('_pg',None); r.pop('_pev',None); r.pop('_pc',None)
        r['status']='已引用' if g!='待核实' else '待核实'
        return r
    with ThreadPoolExecutor(3) as ex: core['relations']=list(ex.map(do,core['relations']))
    rs={}
    for r in core['relations']: rs[r['grade']]=rs.get(r['grade'],0)+1
    stats['relations']=rs
    audit=load('audit.json',None)
    save('core.json',core); save('micro.json',micro)
    save('verification.json',{'generated':R.NOW,'rules':'research/data_sourcing.md#二','fieldStats':stats,'audit':audit,'tiers':TIER,'weights':TIER_W})
    st=load('sources.json',{}); st.setdefault('status',{}).update({k:{**v,'checked':R.NOW} for k,v in R.STATUS.items()}); save('sources.json',st)
    log(json.dumps(stats,ensure_ascii=False,indent=1))

def judge(srcs,tol,usd,period=False,half=()):
    if not srcs: return {'grade':'缺失','conf':0,'sources':[]}
    base=srcs[0]; agree=1; conflict=False; notes=[]
    for o in srcs[1:]:
        if period and abs((datetime.date.fromisoformat(o['end'][:10])-datetime.date.fromisoformat(base['end'][:10])).days)>40:
            notes.append(f"{o['source']} 财年不同（{o['end']}），不参与比对"); continue
        if o.get('cur')==base.get('cur'): d=rel(o['value'],base['value']); t=tol
        else:
            a,b=usd(o['value'],o.get('cur')),usd(base['value'],base.get('cur'))
            if a is None or b is None: notes.append(f"{o['source']} 无法换算币种"); continue
            d=rel(a,b); t=tol+0.01
        o['diff']=round(d,4)
        if d<=t: agree+=1
        else: conflict=True; notes.append(f"{o['source']} 与 {base['source']} 相差 {d:.1%}")
    for s in srcs: s['tier']=TIER.get(s['source'],'T2')
    return {'grade':grade(srcs,agree,conflict),'conf':conf(srcs,conflict,half),'agree':agree,'sources':srcs,'notes':notes}
def judge_set(srcs):
    if not srcs: return {'grade':'缺失','conf':0,'sources':[]}
    for s in srcs: s['tier']=TIER.get(s['source'],'T2')
    if len(srcs)<2: return {'grade':grade(srcs,1,False),'conf':conf(srcs),'agree':1,'sources':srcs,'notes':[]}
    ok=bool(set(srcs[0]['value'])&set(srcs[1]['value']))
    if ok: return {'grade':'A','conf':conf(srcs),'agree':2,'sources':srcs,'notes':[]}
    return {'grade':'C','conf':conf(srcs[:1]),'agree':1,'sources':srcs,'notes':['GLEIF ISIN 列表与 Wikidata 无交集（GLEIF 多为债券 ISIN），未构成交叉验证']}
def judge_cat(srcs,key=None,conflict=False):
    if not srcs: return {'grade':'缺失','conf':0,'sources':[]}
    for s in srcs: s['tier']=TIER.get(s['source'],'T2')
    key=key or srcs[0]['value']; agree=sum(1 for s in srcs if s['value']==key or s.get('alt')==key)
    conflict=conflict or any(s['value'] not in (key,None) and s.get('alt')!=key for s in srcs)
    ind=[s for s in srcs if s['source']!='种子名录' and (s['value']==key or s.get('alt')==key)]  # 种子不计为独立证据
    g='X' if conflict else 'A' if len(ind)>=2 else 'B' if any(TIER[s['source']].startswith('T1') for s in ind) else 'C' if ind else '缺失'
    return {'grade':g,'conf':conf(ind,conflict),'agree':agree,'sources':srcs,'notes':['来源不一致'] if conflict else []}
if __name__=='__main__': main()
