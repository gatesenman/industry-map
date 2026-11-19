#!/usr/bin/env python3
"""全球产业链地图 数据管线（可增量刷新）
用法: python3 data/refresh.py [--force] [--only wikidata,sec,gleif,quotes,macro,trade,fred,prices,relations]
所有字段附 {source,url,retrieved}；拉不到的字段保持缺失，绝不编造。
缓存: data/cache/（默认 TTL 20 小时，--force 忽略缓存）。输出: public/data/*.json（以及 dist/data/ 若存在）
"""
import json, os, re, sys, time, hashlib, datetime, shutil, io, traceback
from concurrent.futures import ThreadPoolExecutor
import requests
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
CACHE=os.path.join(HERE,'cache'); OUT=os.path.join(ROOT,'public','data'); os.makedirs(CACHE,exist_ok=True); os.makedirs(OUT,exist_ok=True)
sys.path.insert(0,HERE); import seed
UA={'User-Agent':'GlobalIndustryMap research@gaosichun.dev','Accept-Encoding':'gzip'}
FORCE='--force' in sys.argv; TTL=20*3600
ONLY=None
if '--only' in sys.argv: ONLY=set(sys.argv[sys.argv.index('--only')+1].split(','))
NOW=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'); TODAY=NOW[:10]
STATUS={}  # 源可用性
def retry_call(fn, tries=3, delay=1.5, label=''):
    """有限重试：仅用于瞬时网络失败，不吞掉逻辑错误。"""
    last=None
    for i in range(tries):
        try: return fn()
        except Exception as e:
            last=e; time.sleep(delay*(i+1))
    raise last
def log(*a): print(*a, flush=True)
def get(url, params=None, kind='json', ttl=TTL, headers=None, timeout=40, retries=2):
    key=hashlib.md5((url+json.dumps(params,sort_keys=True)).encode()).hexdigest()
    p=os.path.join(CACHE,key+'.'+('json' if kind=='json' else 'bin'))
    if not FORCE and os.path.exists(p) and time.time()-os.path.getmtime(p)<ttl:
        with open(p,'rb') as f: b=f.read()
        return json.loads(b) if kind=='json' else b
    for i in range(retries+1):
        try:
            r=requests.get(url,params=params,headers={**UA,**(headers or {})},timeout=timeout)
            if r.status_code==429: time.sleep(3*(i+1)); continue
            r.raise_for_status(); b=r.content
            with open(p,'wb') as f: f.write(b)
            return r.json() if kind=='json' else b
        except Exception as e:
            err=e; time.sleep(1.5*(i+1))
    if os.path.exists(p):  # 回退到旧缓存
        with open(p,'rb') as f: b=f.read()
        return json.loads(b) if kind=='json' else b
    raise err
def cite(source,url,retrieved=TODAY,**kw): return {'source':source,'url':url,'retrieved':retrieved,**kw}
def mark(name,ok,detail=''):
    s=STATUS.setdefault(name,{'ok':0,'fail':0,'detail':''}); s['ok' if ok else 'fail']+=1
    if detail: s['detail']=detail
def load(name,default):
    p=os.path.join(OUT,name)
    return json.load(open(p,encoding='utf-8')) if os.path.exists(p) else default
def save(name,obj):
    p=os.path.join(OUT,name); json.dump(obj,open(p,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
    d=os.path.join(ROOT,'dist','data')
    if os.path.isdir(os.path.join(ROOT,'dist')): os.makedirs(d,exist_ok=True); shutil.copy(p,d)
def want(x): return ONLY is None or x in ONLY

IND_OF={s[3]:s[0] for s in seed.SEG}
_rp=os.path.join(HERE,'revenue_overrides.json')
REV_OV={k:v for k,v in (json.load(open(_rp,encoding='utf-8')) if os.path.exists(_rp) else {}).items() if not k.startswith('_')}
COMPANIES=[dict(id=c[0],zh=c[1],en=c[2],country=c[3],exchange=c[4],ticker=c[5],segments=c[6],
   industries=sorted({IND_OF[s] for s in c[6]}),products_seed=[p.strip() for p in c[7].split('、')]) for c in seed.C]
CID={c['id']:c for c in COMPANIES}
ISO3={'US':'USA','CN':'CHN','TW':'TWN','JP':'JPN','KR':'KOR','NL':'NLD','DE':'DEU','FR':'FRA','GB':'GBR','CH':'CHE','CL':'CHL','AU':'AUS','BE':'BEL','IL':'ISR','CA':'CAN','ES':'ESP','IT':'ITA','SE':'SWE','SG':'SGP'}

# ---------- 证券代码 → Yahoo 代码 ----------
SUF={'TSE':'.T','TWSE':'.TW','TPEx':'.TWO','KRX':'.KS','SZSE':'.SZ','SSE':'.SS','SSE STAR':'.SS','HKEX':'.HK','BSE':'.BJ','XETRA':'.DE',
 'Euronext Paris':'.PA','Euronext Amsterdam':'.AS','Euronext Brussels':'.BR','Euronext Milan':'.MI','BME':'.MC','ASX':'.AX','Nasdaq':'','NYSE':'','Santiago':'.SN','TSX':'.TO'}
def listings(c):
    exs=[e.strip() for e in c['exchange'].split('/')]; tks=[t.strip() for t in c['ticker'].split('/')]
    out=[]
    for i,e in enumerate(exs):
        if e not in SUF: continue
        t=tks[i] if i<len(tks) else tks[0]
        if e=='HKEX': t=t.zfill(4)
        out.append({'exchange':e,'ticker':t,'yahoo':t+SUF[e]})
    return out
for c in COMPANIES: c['listings']=listings(c)
_lp=os.path.join(HERE,'listing_status.json')
LISTING_ST={k:v for k,v in (json.load(open(_lp,encoding='utf-8')) if os.path.exists(_lp) else {}).items() if not k.startswith('_')}

# ---------- 1. Wikidata ----------
SPARQL='https://query.wikidata.org/sparql'
def sparql(q):
    return get(SPARQL,{'query':q,'format':'json'},headers={'Accept':'application/sparql-results+json'},timeout=90)['results']['bindings']
EXKW={'Nasdaq':['nasdaq'],'NYSE':['new york stock exchange','nyse'],'TSE':['tokyo stock exchange'],'TWSE':['taiwan stock exchange'],'TPEx':['taipei exchange','gretai'],
 'KRX':['korea exchange'],'SZSE':['shenzhen'],'SSE':['shanghai'],'SSE STAR':['shanghai'],'HKEX':['hong kong'],'XETRA':['frankfurt','xetra','deutsche'],
 'Euronext Paris':['euronext'],'Euronext Amsterdam':['euronext'],'Euronext Brussels':['euronext'],'Euronext Milan':['euronext','borsa italiana','milan'],'BME':['madrid','bolsa','bme'],'ASX':['australian'],'BSE':['beijing'],'Santiago':['santiago'],'TSX':['toronto']}
def _tok(x): return set(re.findall(r'[a-z0-9]+',x.lower()))-{'inc','co','ltd','group','holdings','holding','the','corporation','corp','company','technology','technologies','limited','plc','sa','se','ag','nv'}
def resolve_qids():
    """QID 解析：①按交易所代码（Wikidata P414 + 限定符 P249）精确匹配 ②中文/英文名搜索 + 企业属性 + 名称词元校验。人工覆盖见 qid_overrides.json"""
    p=os.path.join(HERE,'qids.json'); q=json.load(open(p)) if os.path.exists(p) else {}
    ov=os.path.join(HERE,'qid_overrides.json'); OV=json.load(open(ov)) if os.path.exists(ov) else {}
    todo=[c for c in COMPANIES if c['id'] not in q and c['id'] not in OV]
    if todo:
        tks=set()
        for c in todo:
            for l in c['listings']:
                t=l['ticker']; tks|={t,t.lstrip('0')}
        vals=' '.join(json.dumps(t) for t in tks if t)
        try:
            rows=sparql(f'''SELECT ?i ?t ?exLabel ?dis WHERE {{ VALUES ?t {{{vals}}} ?i p:P414 ?st. ?st pq:P249 ?t; ps:P414 ?ex. OPTIONAL{{?i wdt:P576 ?dis}} SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }} }}''')
            mark('Wikidata SPARQL',True)
        except Exception as e: rows=[]; mark('Wikidata SPARQL',False,str(e)[:100])
        for c in todo:
            for l in c['listings']:
                hit=[r for r in rows if r['t']['value'] in (l['ticker'],l['ticker'].lstrip('0')) and any(k in r['exLabel']['value'].lower() for k in EXKW.get(l['exchange'],['~']))and 'dis' not in r]
                ids=list(dict.fromkeys(r['i']['value'].split('/')[-1] for r in hit))
                if len(ids)==1: q[c['id']]=ids[0]; c['_qidm']='ticker'; break
    def one(c):
        try:
            cands=[]
            for lang,n in ([('zh',c['zh'])] if c['country'] in ('CN','TW') else [])+[('en',c['en']),('en',re.sub(r'\s*\(.*\)','',c['en']))]:
                r=get('https://www.wikidata.org/w/api.php',{'action':'wbsearchentities','search':n,'language':lang,'uselang':'en','format':'json','limit':7,'type':'item'})
                for x in r.get('search',[]):
                    lab=x.get('label','')+' '+' '.join(x.get('aliases',[]) if isinstance(x.get('aliases'),list) else [])
                    ok = lang=='zh' or bool(_tok(lab)&_tok(c['en']))
                    if ok: cands.append(x['id'])
            cands=list(dict.fromkeys(cands))
            if not cands: return c['id'],None
            vals=' '.join('wd:'+x for x in cands)
            rows=sparql(f'''SELECT ?i (COUNT(?x) AS ?n) WHERE {{ VALUES ?i {{{vals}}} {{?i wdt:P414 ?x}} UNION {{?i wdt:P946 ?x}} UNION {{?i wdt:P1278 ?x}} UNION {{?i wdt:P452 ?x}} UNION {{?i wdt:P2139 ?x}} FILTER NOT EXISTS {{?i wdt:P576 ?d}} }} GROUP BY ?i''')
            score={r['i']['value'].split('/')[-1]:int(r['n']['value']) for r in rows}
            for x in cands:
                if score.get(x,0)>0: return c['id'],x
            return c['id'],None
        except Exception as e: return c['id'],None
    rest=[c for c in todo if c['id'] not in q]
    with ThreadPoolExecutor(4) as ex:
        for cid,qid in ex.map(one,rest):
            if qid: q[cid]=qid
    json.dump(q,open(p,'w'),indent=0)
    q={**q,**{k:v for k,v in OV.items() if v}}
    for k,v in OV.items():
        if not v: q.pop(k,None)
    return q
def wikidata(qids):
    vals=' '.join('wd:'+v for v in set(qids.values()))
    def multi(prop, label=True, extra=''):
        rows=sparql(f'''SELECT ?i ?v ?vLabel {extra} WHERE {{ VALUES ?i {{{vals}}} ?i wdt:{prop} ?v. SERVICE wikibase:label {{ bd:serviceParam wikibase:language "zh-hans,zh,en". }} }}''')
        d={}
        for r in rows: d.setdefault(r['i']['value'].split('/')[-1],[]).append({'id':r['v']['value'].split('/')[-1],'label':r.get('vLabel',{}).get('value',r['v']['value'])})
        return d
    data={}
    for prop,name in [('P946','isin'),('P1278','lei'),('P856','website'),('P1056','products'),('P749','parent'),('P355','subsidiaries'),('P127','ownedBy'),('P452','industry'),('P17','country'),('P159','hq'),('P571','inception'),('P1128','employees'),('P5531','cik')]:
        try: data[name]=multi(prop); mark('Wikidata SPARQL',True)
        except Exception as e: mark('Wikidata SPARQL',False,str(e)[:120]); data[name]={}
    # 带时间点的数值：市值 P2226、营收 P2139、净利 P2295
    for prop,name in [('P2226','marketCap'),('P2139','revenue'),('P2295','netIncome')]:
        try:
            rows=sparql(f'''SELECT ?i ?amt ?unitLabel ?t WHERE {{ VALUES ?i {{{vals}}} ?i p:{prop} ?st. ?st psv:{prop} ?vn. ?vn wikibase:quantityAmount ?amt; wikibase:quantityUnit ?unit. OPTIONAL{{?st pq:P585 ?t}} SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }} }}''')
            d={}
            for r in rows:
                i=r['i']['value'].split('/')[-1]; t=r.get('t',{}).get('value','')[:10]
                v={'value':float(r['amt']['value']),'unit':r.get('unitLabel',{}).get('value',''),'date':t}
                if i not in d or (t and t>d[i]['date']): d[i]=v
            data[name]=d; mark('Wikidata SPARQL',True)
        except Exception as e: mark('Wikidata SPARQL',False,str(e)[:120]); data[name]={}
    try:
        rows=sparql(f'''SELECT ?i ?a WHERE {{ VALUES ?i {{{vals}}} ?a schema:about ?i; schema:isPartOf <https://en.wikipedia.org/>. }}''')
        data['enwiki']={r['i']['value'].split('/')[-1]:r['a']['value'] for r in rows}
        rows=sparql(f'''SELECT ?i ?a WHERE {{ VALUES ?i {{{vals}}} ?a schema:about ?i; schema:isPartOf <https://zh.wikipedia.org/>. }}''')
        data['zhwiki']={r['i']['value'].split('/')[-1]:r['a']['value'] for r in rows}
    except Exception as e: data['enwiki']={}; data['zhwiki']={}
    return data

# ---------- 2. SEC EDGAR ----------
CONCEPTS={'revenue':[('us-gaap','Revenues'),('us-gaap','RevenueFromContractWithCustomerExcludingAssessedTax'),('us-gaap','SalesRevenueNet'),('ifrs-full','Revenue'),('ifrs-full','RevenueFromContractsWithCustomers')],
 'netIncome':[('us-gaap','NetIncomeLoss'),('ifrs-full','ProfitLossAttributableToOwnersOfParent'),('ifrs-full','ProfitLoss')],
 'grossProfit':[('us-gaap','GrossProfit'),('ifrs-full','GrossProfit')],
 'rd':[('us-gaap','ResearchAndDevelopmentExpense'),('us-gaap','ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'),('ifrs-full','ResearchAndDevelopmentExpense')],
 'capex':[('us-gaap','PaymentsToAcquirePropertyPlantAndEquipment'),('ifrs-full','PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'),('ifrs-full','PurchaseOfPropertyPlantAndEquipment')]}
def days(a,b): return (datetime.date.fromisoformat(b)-datetime.date.fromisoformat(a)).days
def sec_series(facts, ns, name):
    f=facts.get('facts',{}).get(ns,{}).get(name)
    if not f: return None
    unit=next(iter(f['units'])); rows=f['units'][unit]
    A={};Q={}
    for r in rows:
        if 'start' not in r or r.get('form') not in ('10-K','10-Q','20-F','40-F','10-K/A','20-F/A','6-K'): continue
        d=days(r['start'],r['end'])
        tgt=A if 340<=d<=380 else Q if 80<=d<=100 else None
        if tgt is None: continue
        if r['end'] not in tgt or r['filed']>tgt[r['end']]['filed']: tgt[r['end']]={'end':r['end'],'value':r['val'],'form':r['form'],'filed':r['filed'],'accn':r.get('accn')}
    a=sorted(A.values(),key=lambda x:x['end'])[-6:]; q=sorted(Q.values(),key=lambda x:x['end'])[-8:]
    return {'unit':unit,'annual':a,'quarterly':q,'concept':f'{ns}:{name}'} if a or q else None
def sec(wd):
    try: tick=get('https://www.sec.gov/files/company_tickers.json'); mark('SEC EDGAR',True)
    except Exception as e: mark('SEC EDGAR',False,str(e)[:100]); return {}
    t2c={v['ticker'].upper():v['cik_str'] for v in tick.values()}
    out={}
    def one(c):
        cik=None
        for l in c['listings']:
            if l['exchange'] in ('Nasdaq','NYSE') and l['ticker'].upper() in t2c: cik=t2c[l['ticker'].upper()]; break
        if not cik: return c['id'],None
        url=f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json'
        try: facts=get(url,timeout=60); mark('SEC EDGAR',True)
        except Exception as e: mark('SEC EDGAR',False,str(e)[:100]); return c['id'],{'cik':cik}
        res={'cik':cik,'entity':facts.get('entityName'),'url':url,'filingsUrl':f'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}'}
        for k,lst in CONCEPTS.items():
            best=None
            for ns,n in lst:
                s=sec_series(facts,ns,n)
                if s and (best is None or (s['annual'] or s['quarterly'])[-1]['end']>(best['annual'] or best['quarterly'])[-1]['end']): best=s
            if best: res[k]=best
        sh=facts.get('facts',{}).get('dei',{}).get('EntityCommonStockSharesOutstanding')
        if sh:
            rows=sorted(sh['units'].get('shares',[]),key=lambda r:r['end'])
            if rows:
                le=rows[-1]['end']; same={(r.get('frame'),r['val']) for r in rows if r['end']==le}  # 多类别股份同日合计
                res['shares']={'value':sum(v for _,v in same),'end':le,'form':rows[-1].get('form'),'classes':len(same)}
        return c['id'],res
    with ThreadPoolExecutor(4) as ex:
        for cid,r in ex.map(one,COMPANIES):
            if r: out[cid]=r
    return out

# ---------- 3. GLEIF ----------
def gleif(leis):
    out={}
    def one(item):
        cid,lei=item
        try:
            r=get(f'https://api.gleif.org/api/v1/lei-records/{lei}'); a=r['data']['attributes']; mark('GLEIF',True)
            e=a['entity']; return cid,{'lei':lei,'legalName':e['legalName']['name'],'jurisdiction':e.get('jurisdiction'),'status':e.get('status'),
                'hqCity':e.get('headquartersAddress',{}).get('city'),'hqCountry':e.get('headquartersAddress',{}).get('country'),
                'registration':a.get('registration',{}).get('status'),'url':f'https://search.gleif.org/#/record/{lei}'}
        except Exception as ex_: mark('GLEIF',False,str(ex_)[:100]); return cid,None
    with ThreadPoolExecutor(6) as ex:
        for cid,r in ex.map(one,leis.items()):
            if r: out[cid]=r
    return out

# ---------- 4. 行情（Yahoo Finance 公共图表接口） ----------
def yahoo(sym, rng='1y', itv='1wk'):
    url=f'https://query1.finance.yahoo.com/v8/finance/chart/{sym}'
    r=get(url,{'range':rng,'interval':itv},ttl=6*3600)['chart']['result'][0]; m=r['meta']
    ts=r.get('timestamp') or []; cl=(r.get('indicators',{}).get('quote') or [{}])[0].get('close') or []
    ser=[[datetime.datetime.fromtimestamp(t,datetime.timezone.utc).strftime('%Y-%m-%d'),round(v,4)] for t,v in zip(ts,cl) if v is not None]
    return {'symbol':sym,'price':m.get('regularMarketPrice'),'currency':m.get('currency'),'time':datetime.datetime.fromtimestamp(m.get('regularMarketTime',0),datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
            'exchange':m.get('fullExchangeName'),'series':ser,'url':f'https://finance.yahoo.com/quote/{sym}'}
def quotes():
    out={}
    def one(c):
        if c['id'] in LISTING_ST: return c['id'],None  # v2.6 已摘牌：不抓行情
        for l in c['listings']:
            try: q=yahoo(l['yahoo']); mark('Yahoo Finance',True); return c['id'],q
            except Exception as e: mark('Yahoo Finance',False,f"{l['yahoo']}: {str(e)[:60]}")
        return c['id'],None
    with ThreadPoolExecutor(6) as ex:
        for cid,q in ex.map(one,COMPANIES):
            if q: out[cid]=q
    fx={}
    for cur in ['CNY','TWD','JPY','KRW','EUR','HKD','GBP','CHF','AUD','CLP','CAD','SEK','SGD']:
        try: q=yahoo(f'USD{cur}=X','5d','1d'); fx[cur]={'perUSD':q['price'],'time':q['time'],'url':q['url']}; mark('Yahoo Finance',True)
        except Exception as e: mark('Yahoo Finance',False,'FX '+cur)
    return out,fx

# ---------- 5. 宏观：World Bank / IMF / FRED ----------
WB_IND={'NY.GDP.MKTP.CD':'GDP（现价美元）','NY.GDP.MKTP.KD.ZG':'GDP 实际增速 %','NV.IND.MANF.CD':'制造业增加值（现价美元）','NV.IND.MANF.ZS':'制造业增加值占 GDP %','TX.VAL.TECH.CD':'高科技产品出口（现价美元）','FP.CPI.TOTL.ZG':'CPI 通胀 %','GB.XPD.RSDV.GD.ZS':'研发支出占 GDP %'}
IMF_IND={'NGDP_RPCH':'实际 GDP 增速 %（含预测）','PCPIPCH':'通胀率 %（含预测）','NGDPD':'GDP 十亿美元（含预测）'}
FRED={'DFF':'美国联邦基金有效利率 %','DGS10':'美国 10 年期国债收益率 %','IPG3344S':'美国工业生产指数：半导体及电子元件','PCU33443344':'美国 PPI：半导体及电子元件制造','CPIAUCSL':'美国 CPI（城市消费者）','DEXCHUS':'人民币兑美元汇率','IPG3361T3S':'美国工业生产指数：汽车及零部件'}

def nbs_releases():
    """国家统计局回退：data.stats.gov.cn 对境外 IP 返回 403 (UrlACL)，改为解析 www.stats.gov.cn「数据发布」列表页标题中的官方数字。"""
    url='https://www.stats.gov.cn/sj/zxfb/'
    try:
        r=requests.get(url,headers={'User-Agent':'Mozilla/5.0'},timeout=20); r.encoding='utf-8'
        items={}
        for href,title in re.findall(r'href="\./(\d{6}/t\d{8}_\d+\.html)"[^>]*>\s*([^<]{8,80}?)\s*<',r.text):
            if title.endswith('...'): continue
            items.setdefault(href,title.strip())
        rel=[]
        for href,title in items.items():
            m=re.search(r'([+-]?\d+(?:\.\d+)?)%',title)
            rel.append({'title':title,'date':re.search(r't(\d{8})_',href).group(1),'value':float(m.group(1)) if m else None,'url':url+href})
        ok=any('规模以上工业增加值' in x['title'] for x in rel)
        mark('国家统计局 stats.gov.cn 数据发布',ok,'' if ok else 'no 工业增加值 release found')
        return {'name':'国家统计局最新数据发布（标题口径）','releases':rel,'url':url} if rel else None
    except Exception as e:
        mark('国家统计局 stats.gov.cn 数据发布',False,str(e)[:100]); return None


def macro():
    countries=sorted({ISO3[c['country']] for c in COMPANIES if c['country'] in ISO3})
    wb={}
    for ind,nm in WB_IND.items():
        try:
            r=get(f"https://api.worldbank.org/v2/country/{';'.join(x for x in countries if x!='TWN')}/indicator/{ind}",{'format':'json','mrv':12,'per_page':1000})
            rows=r[1] or []; mark('World Bank API',True)
            d={}
            for x in rows:
                if x['value'] is not None: d.setdefault(x['countryiso3code'],[]).append([x['date'],x['value']])
            wb[ind]={'name':nm,'lastUpdated':r[0].get('lastupdated'),'data':{k:sorted(v) for k,v in d.items()},'url':f'https://data.worldbank.org/indicator/{ind}','api':f'https://api.worldbank.org/v2/country/all/indicator/{ind}?format=json'}
        except Exception as e: mark('World Bank API',False,str(e)[:100])
    imf={}
    for ind,nm in IMF_IND.items():
        try:
            r=get(f'https://www.imf.org/external/datamapper/api/v1/{ind}'); vals=r['values'][ind]; mark('IMF DataMapper',True)
            imf[ind]={'name':nm,'data':{k:sorted([[y,v] for y,v in vals[k].items() if int(y)>=2015]) for k in countries if k in vals},'url':f'https://www.imf.org/external/datamapper/{ind}','api':f'https://www.imf.org/external/datamapper/api/v1/{ind}','note':'IMF《世界经济展望》，当年及以后为预测值'}
        except Exception as e: mark('IMF DataMapper',False,str(e)[:100])
    fred={}
    for s,nm in FRED.items():
        try:
            b=get('https://fred.stlouisfed.org/graph/fredgraph.csv',{'id':s},kind='bin').decode(); mark('FRED',True)
            rows=[l.split(',') for l in b.strip().splitlines()[1:]]
            rows=[[d,float(v)] for d,v in rows if v not in ('.','') and d>='2016-01-01']
            # 日频降采样为月末
            m={}
            for d,v in rows: m[d[:7]]=[d,v]
            fred[s]={'name':nm,'data':list(m.values()),'url':f'https://fred.stlouisfed.org/series/{s}'}
        except Exception as e: mark('FRED',False,f'{s}: {str(e)[:60]}')
    # 国家统计局（尝试，通常需会话/反爬）
    try:
        r=requests.get('https://data.stats.gov.cn/easyquery.htm',params={'m':'QueryData','dbcode':'hgyd','rowcode':'zb','colcode':'sj','wds':'[]','dfwds':'[{"wdcode":"zb","valuecode":"A0201"}]'},headers=UA,timeout=15,verify=False)
        j=r.json(); ok=bool(j.get('returndata',{}).get('datanodes')); mark('国家统计局 data.stats.gov.cn',ok,'' if ok else 'no data')
        nbs={'name':'规模以上工业增加值增速（月度）','raw':[{'code':n['code'],'value':n['data'].get('data') if n['data'].get('hasdata') else None} for n in j['returndata']['datanodes'][:60]],'url':'https://data.stats.gov.cn/easyquery.htm?cn=A01'} if ok else None
    except Exception as e: mark('国家统计局 data.stats.gov.cn',False,str(e)[:100]); nbs=None
    if nbs is None: nbs=nbs_releases()
    return {'worldbank':wb,'imf':imf,'fred':fred,'nbs':nbs,'countries':countries}

# ---------- 6. 贸易：UN Comtrade ----------
HS={'8542':'集成电路','8541':'半导体器件（含光伏电池，HS2017）','854142':'光伏电池（未组装，HS2022）','854143':'光伏组件（HS2022）','850760':'锂离子蓄电池','870380':'纯电动乘用车','8486':'半导体制造设备'}
REPORTERS={156:'CHN',490:'TWN',410:'KOR',392:'JPN',842:'USA',276:'DEU',528:'NLD',458:'MYS',702:'SGP',704:'VNM'}
def trade():
    try:
        ref=get('https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json',ttl=30*86400)['results']
        p2={r['PartnerCode']:(r.get('PartnerCodeIsoAlpha3'),r['PartnerDesc'],r.get('isGroup')) for r in ref}; p2[490]=('TWN','Taiwan (Other Asia, nes)',False)
    except Exception as e: mark('UN Comtrade',False,'reference '+str(e)[:80]); return {}
    out={'hs':HS,'flows':[],'totals':{}}
    for hs in HS:
        for rc,iso in REPORTERS.items():
            got=None
            for yr in (datetime.date.today().year-1, datetime.date.today().year-2):
                try:
                    r=get('https://comtradeapi.un.org/public/v1/preview/C/A/HS',{'reporterCode':rc,'period':yr,'cmdCode':hs,'flowCode':'X'},ttl=7*86400)
                    time.sleep(0.6)
                    if r.get('data'): got=(yr,r['data']); break
                except Exception as e: mark('UN Comtrade',False,str(e)[:80])
            if not got: continue
            mark('UN Comtrade',True); yr,rows=got
            rows=[x for x in rows if x.get('motCode') in (0,None) and x.get('customsCode') in ('C00',None) and x.get('partner2Code') in (0,None)]
            world=[x for x in rows if x['partnerCode']==0]
            if world: out['totals'].setdefault(hs,{})[iso]={'year':yr,'value':world[0]['primaryValue']}
            ps=[x for x in rows if x['partnerCode']!=0 and not (p2.get(x['partnerCode'],(0,0,True))[2])]
            ps.sort(key=lambda x:-x['primaryValue'])
            for x in ps[:12]:
                pi=p2.get(x['partnerCode'],(None,str(x['partnerCode']),False))
                if not pi[0]: continue
                out['flows'].append({'hs':hs,'year':yr,'from':iso,'to':pi[0],'toName':pi[1],'value':x['primaryValue']})
    out['source']=cite('UN Comtrade（公开预览 API）','https://comtradeplus.un.org/TradeFlow',note='出口方申报口径 FOB 美元；台湾以 490 "Other Asia, nes" 申报')
    return out

# ---------- 7. 大宗商品价格：World Bank Pink Sheet ----------
def prices():
    try:
        html=get('https://www.worldbank.org/en/research/commodity-markets',kind='bin',ttl=86400).decode('utf-8','ignore')
        url=re.search(r'https://thedocs\.worldbank\.org/[^"]*CMO-Historical-Data-Monthly\.xlsx',html).group(0)
        b=get(url,kind='bin',ttl=86400); mark('World Bank Pink Sheet',True)
        import openpyxl
        wb=openpyxl.load_workbook(io.BytesIO(b),read_only=True,data_only=True); ws=wb['Monthly Prices']
        rows=list(ws.iter_rows(values_only=True))
        hi=next(i for i,r in enumerate(rows) if r and r[0] is None and r[1] and 'Crude' in str(r[1]))
        names=rows[hi]; units=rows[hi+1]
        want={'Copper':'铜','Aluminum':'铝','Nickel':'镍','Silver':'白银','Tin':'锡','Zinc':'锌','Lead':'铅','Natural gas, Europe':'欧洲天然气','Crude oil, Brent':'布伦特原油','Iron ore, cfr spot':'铁矿石','Coal, Australian':'澳洲动力煤'}
        out={}
        for j,n in enumerate(names):
            if not n: continue
            n=str(n).strip()
            if n in want:
                ser=[[str(r[0]),r[j]] for r in rows[hi+2:] if r and r[0] and isinstance(r[j],(int,float)) and str(r[0])>='2018']
                out[n]={'zh':want[n],'unit':str(units[j]).strip(),'data':ser}
        missing={'碳酸锂':'无可直接引用的免费公开 API（SMM/上海有色、广期所需授权）','多晶硅':'无可直接引用的免费公开 API（PVInsights/InfoLink 需订阅）','钴':'World Bank Pink Sheet 未收录'}
        return {'commodities':out,'source':cite('World Bank Commodity Price Data (Pink Sheet)',url),'missing':missing}
    except Exception as e: mark('World Bank Pink Sheet',False,str(e)[:100]); return {}

# ---------- 8. 关系核验（Wikipedia 文本证据 + Wikidata 股权） ----------
TYPE_KW={'供货':r'suppl|customer|client|order|purchas|foundry|manufactur|provid|deliver|sourc|contract|agreement|partner|use[sd]? .*(chip|batter|lidar|sensor|panel|display)','授权':r'licens','竞争':r'compet|rival','投资':r'stake|invest|acqui','合资':r'joint venture|joint-venture|JV\b','控股':r'subsidiar|acqui|stake'}
def short(n): return re.sub(r'\b(Inc\.?|Corporation|Corp\.?|Group|Holdings?|Co\.?,?|Ltd\.?|Limited|Technology|Technologies|Motor|Automotive|Energy|Solution|Semiconductor(s)?|Electronics?|plc|SE|AG|N\.V\.|S\.A\.)\b','',n).replace('(','').replace(')','').strip(' ,.')
def wiki_text(url):
    t=url.rsplit('/',1)[-1]
    r=get('https://en.wikipedia.org/w/api.php',{'action':'query','prop':'extracts','explaintext':1,'titles':requests.utils.unquote(t),'format':'json','redirects':1},ttl=7*86400)
    return next(iter(r['query']['pages'].values())).get('extract','')
REVIEW=json.load(open(os.path.join(HERE,'relation_review.json'),encoding='utf-8')) if os.path.exists(os.path.join(HERE,'relation_review.json')) else {}
def relations(wd,qids):
    out=[]
    def ev(a,b,typ,note,conf):
        A,B=CID[a],CID[b]; found=None
        for x,y in ((A,B),(B,A)):
            u=wd.get('enwiki',{}).get(qids.get(x['id']))
            if not u: continue
            try: txt=wiki_text(u); mark('Wikipedia API',True)
            except Exception as e: mark('Wikipedia API',False,str(e)[:60]); continue
            names={short(y['en']),y['en']}|{l['ticker'] for l in y['listings'] if l['ticker'].isalpha() and len(l['ticker'])>2}
            names={n for n in names if len(n)>=3}
            for sent in re.split(r'(?<=[.!?])\s+',txt):
                if any(re.search(r'\b'+re.escape(n)+r'\b',sent) for n in names) and re.search(TYPE_KW.get(typ,'.'),sent,re.I) and 20<len(sent)<450 and '==' not in sent:
                    found=cite('Wikipedia',u,quote=sent.strip()); break
            if found: break
        r={'from':a,'to':b,'type':typ,'note':note}
        rv=REVIEW.get(f'{a}>{b}>{typ}')
        if found and rv: r.update(status='待核实',confidence='低',evidence=[],review=rv,rejected=found); return r
        if found: r.update(status='已引用',confidence='中',evidence=[found])
        else: r.update(status='待核实',confidence='低',evidence=[])
        return r
    with ThreadPoolExecutor(6) as ex:
        RR=[x for x in seed.R if x[0] in CID and x[1] in CID]
        skipped=[f'{x[0]}>{x[1]}' for x in seed.R if not (x[0] in CID and x[1] in CID)]
        if skipped: log('relations skipped (endpoint not in company list):',len(skipped),skipped[:10])
        out=list(ex.map(lambda x:ev(*x),RR))
    # Wikidata 股权关系（两端都在名录中）
    q2c={v:k for k,v in qids.items()}
    for prop,typ in (('parent','控股'),('ownedBy','持股'),('subsidiaries','控股')):
        for q,lst in wd.get(prop,{}).items():
            for v in lst:
                if v['id'] in q2c and q in q2c and v['id']!=q:
                    a,b=(q2c[v['id']],q2c[q]) if prop!='subsidiaries' else (q2c[q],q2c[v['id']])
                    if not any(o['from']==a and o['to']==b and o['type'] in ('控股','持股') for o in out):
                        out.append({'from':a,'to':b,'type':typ,'note':'Wikidata 股权关系','status':'已引用','confidence':'高','evidence':[cite('Wikidata',f'https://www.wikidata.org/wiki/{q}')]})
    return out


# ---------- v1.3 合并（不覆盖既有数据） ----------
GRANK={'A':4,'B':3,'C':2,'X':1,'待核实':0,'缺失':0,None:0}
MERGE_LOG=[]
def merge_core(prev,fresh):
    """以 prev（当前 v1.x 数据）为底：保留全部公司/关系及其 grade/evidence/conf；
    只新增记录、或用有来源的新值补齐/更新字段；绝不因刷新降级。"""
    if not prev or not prev.get('companies'): return {**fresh,'meta':{'version':'v1.3','generated':NOW}}
    out=dict(prev)
    def by(lst,k): return {k(x):x for x in lst or []}
    for key,kf in (('industries',lambda x:x['id']),('segments',lambda x:x['id']),('segmentLinks',lambda x:(x['industry'],x['from'],x['to']))):
        m=by(prev.get(key),kf)
        for x in fresh.get(key) or []:
            if kf(x) not in m: m[kf(x)]=x; MERGE_LOG.append(f'add {key} {kf(x)}')
        out[key]=list(m.values())
    PROTECT={'verify','countrySplit','filingTop5','filingIntl','segments','industries','products','quality'}
    cm=by(prev['companies'],lambda x:x['id'])
    for c in fresh.get('companies') or []:
        o=cm.get(c['id'])
        if not o: cm[c['id']]=c; MERGE_LOG.append('add company '+c['id']); continue
        for k,v in c.items():
            if k in PROTECT or v in (None,[],{}): continue  # 新值缺失 → 保留旧值
            o[k]=v  # 新值带来源（cite/sources）→ 更新
        o['segments']=list(dict.fromkeys((o.get('segments') or [])+(c.get('segments') or [])))
        o['industries']=sorted(set(o.get('industries') or [])|set(c.get('industries') or []))
    out['companies']=list(cm.values())
    ids=set(cm)
    rk=lambda r:(r['from'],r['to'],r['type'])
    rm={}
    for r in prev.get('relations') or []:
        if r.get('from') not in ids or r.get('to') not in ids: MERGE_LOG.append(f'bad endpoint kept-out {rk(r)}'); log('skip bad relation endpoint',rk(r)); continue
        rm[rk(r)]=r
    for r in fresh.get('relations') or []:
        if r.get('from') not in ids or r.get('to') not in ids: log('skip bad relation endpoint',rk(r)); continue
        o=rm.get(rk(r))
        if not o: rm[rk(r)]=r; MERGE_LOG.append(f'add relation {rk(r)}'); continue
        seen={(e.get('url'),e.get('quote')) for e in o.get('evidence') or []}
        for e in r.get('evidence') or []:
            if (e.get('url'),e.get('quote')) not in seen: o.setdefault('evidence',[]).append(e)
    out['relations']=list(rm.values())
    out['meta']={**(prev.get('meta') or {}),'generated':NOW,'lastRefresh':NOW,'mergeLog':MERGE_LOG[-200:]}
    return out

# ---------- 主流程 ----------
def main():
    t0=time.time(); core_prev=load('core.json',{}); micro=load('micro.json',{}); macro_prev=load('macro.json',{})
    qids=resolve_qids()
    log('QIDs:',len(qids))
    wd=wikidata(qids)
    def pick(name,q): return wd.get(name,{}).get(q)
    comps=[]
    for c in COMPANIES:
        q=qids.get(c['id']); x={k:c[k] for k in ('id','zh','en','country','exchange','ticker','segments','industries','listings')}
        if c['id'] in LISTING_ST: x['delisted']={k:v for k,v in LISTING_ST[c['id']].items()}
        x['identity']=cite('项目种子名录（交易所公开上市信息，人工整理）','',note='名称/国家/交易所/代码')
        x['products']=[{'name':p,'src':'seed'} for p in c['products_seed']]
        if q:
            x['qid']=q; wurl=f'https://www.wikidata.org/wiki/{q}'; x['wikidata']=wurl
            for k in ('isin','lei','website','inception','employees','cik'):
                v=pick(k,q)
                if v: x[k]={'value':[i['label'] for i in v][:3] if k=='isin' else v[0]['label'],**cite('Wikidata',wurl)}
            for k in ('products','industry','parent','subsidiaries','hq'):
                v=pick(k,q)
                if v: x['wd_'+k]={'value':[i['label'] for i in v][:15],**cite('Wikidata',wurl)}
            for k in ('marketCap','revenue','netIncome'):
                v=pick(k,q)
                if v: x['wd_'+k]={**v,**cite('Wikidata',wurl)}
            if pick('enwiki',q): x['enwiki']=pick('enwiki',q)
            if pick('zhwiki',q): x['zhwiki']=pick('zhwiki',q)
        comps.append(x)
    # 微观
    if want('sec'): micro['sec']=sec(wd); log('SEC:',len(micro['sec']))
    if want('gleif'):
        leis={c['id']:c['lei']['value'] for c in comps if c.get('lei')}; micro['gleif']=gleif(leis); log('GLEIF:',len(micro['gleif']))
    if want('quotes'): micro['quotes'],micro['fx']=quotes(); log('Quotes:',len(micro['quotes']))
    if want('prices'): micro['prices']=prices()
    # 市值：①SEC 10-K 普通股数 × 最新股价（计算值）②Wikidata P2226
    fx=micro.get('fx',{})
    def to_usd(v,cur):
        if v is None: return None
        if cur in ('USD','United States dollar','US dollar'): return v
        m={'renminbi':'CNY','New Taiwan dollar':'TWD','Japanese yen':'JPY','South Korean won':'KRW','euro':'EUR','Hong Kong dollar':'HKD','pound sterling':'GBP','Swiss franc':'CHF','Australian dollar':'AUD','Canadian dollar':'CAD','Swedish krona':'SEK','Chilean peso':'CLP'}
        cur=m.get(cur,cur); r=fx.get(cur,{}).get('perUSD')
        return v/r if r else None
    for x in comps:
        s=micro.get('sec',{}).get(x['id']); q=micro.get('quotes',{}).get(x['id'])
        mc=None
        if s and s.get('shares') and q and q.get('currency')=='USD' and s['shares'].get('form') in ('10-K','10-Q') and q['symbol'].isalpha():
            v=s['shares']['value']*q['price']
            mc={'valueUSD':v,'method':'SEC 10-K/10-Q 普通股数 × 最新收盘价（计算值）','date':q['time'][:10],'sources':[cite('SEC EDGAR',s['url']),cite('Yahoo Finance',q['url'])]}
        elif x.get('wd_marketCap'):
            w=x['wd_marketCap']; v=to_usd(w['value'],w['unit'])
            if v: mc={'valueUSD':v,'method':f"Wikidata P2226（{w['unit']}，{w['date'] or '无日期'}）"+('' if w['unit'] in ('United States dollar',) else '，按最新汇率折美元'),'date':w['date'],'sources':[cite('Wikidata',x['wikidata'])]}
        x['marketCap']=mc
        rv=None
        if s and s.get('revenue') and s['revenue']['annual']:
            a=s['revenue']['annual'][-1]; v=to_usd(a['value'],s['revenue']['unit'])
            if v: rv={'valueUSD':v,'fy_end':a['end'],'raw':a['value'],'unit':s['revenue']['unit'],'method':f"SEC {a['form']}（{s['revenue']['concept']}）",'sources':[cite('SEC EDGAR',s['url'])]}
        if not rv and REV_OV.get(x['id']):  # 一手披露覆盖（Wikidata 单位异常时）
            o=REV_OV[x['id']]; v=to_usd(o['value'],o['cur'])
            if v: rv={'valueUSD':v,'fy_end':o['end'],'raw':o['value'],'unit':o['cur'],'method':f"{o['form']}（一手披露，覆盖 Wikidata 单位异常）",'sources':[cite(o['source'],o['url'],retrieved=o.get('retrieved',TODAY),quote=o.get('quote',''),date=o.get('date'))]}
        if not rv and x.get('wd_revenue'):
            w=x['wd_revenue']; v=to_usd(w['value'],w['unit'])
            if v: rv={'valueUSD':v,'fy_end':w['date'],'raw':w['value'],'unit':w['unit'],'method':'Wikidata P2139','sources':[cite('Wikidata',x['wikidata'])]}
        x['revenue']=rv
        g=micro.get('gleif',{}).get(x['id'])
        if g: x['gleif']=g
        # 数据质量评级
        score=sum([bool(x.get('qid')),bool(x.get('lei')),bool(g),bool(s),bool(q),bool(mc),bool(rv)])
        x['quality']={'score':score,'max':7,'grade':'A' if score>=5 else 'B' if score>=3 else 'C'}
    rels=relations(wd,qids) if want('relations') else core_prev.get('relations',[])
    log('Relations:',len(rels),'cited',sum(r['status']=='已引用' for r in rels))
    if want('macro'):
        m=macro(); macro_prev.update(m)
    if want('trade'):
        t=trade()
        if t: macro_prev['trade']=t
        log('Trade flows:',len(macro_prev.get('trade',{}).get('flows',[])))
    if want('fred') and not want('macro'): pass
    fresh={'industries':[{'id':k,'zh':v[0],'en':v[1]} for k,v in seed.IND.items()],
      'segments':[{'id':s[3],'industry':s[0],'sub':s[1],'tier':s[2],'name':s[4]} for s in seed.SEG],
      'segmentLinks':[{'industry':k,'from':a,'to':b} for k,v in seed.LINKS.items() for a,b in v],
      'companies':comps,'relations':rels}
    core=merge_core(core_prev,fresh)
    n0,n1=len(core_prev.get('relations') or []),len(core['relations'])
    ab=lambda c:sum(1 for r in c.get('relations') or [] if r.get('grade') in ('A','B'))
    if n1<n0 or len(core['companies'])<len(core_prev.get('companies') or []) or ab(core)<ab(core_prev):
        log(f'GUARD ABORT: relations {n0}->{n1}, AB {ab(core_prev)}->{ab(core)}; core.json untouched'); sys.exit(2)
    save('core.json',core); save('micro.json',micro); save('macro.json',macro_prev)
    prev=load('sources.json',{}).get('status',{})
    for k,v in STATUS.items(): v['checked']=NOW
    st={**prev,**STATUS}
    save('sources.json',{'generated':NOW,'status':st,'elapsed_s':round(time.time()-t0,1)})
    if '--no-verify' not in sys.argv:
        import verify; verify.main()  # 交叉验证 + 置信度 + SEC 一手原句
    log('DONE',round(time.time()-t0,1),'s'); log(json.dumps(STATUS,ensure_ascii=False,indent=1))
if __name__=='__main__': main()
