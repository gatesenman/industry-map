#!/usr/bin/env python3
"""A股年报（巨潮/东财 PDF）一手证据抽取：前五大客户/供应商集中度 + 对手方原句。
HKEX / MOPS：本轮探测可达性；不可达则如实记入 sources.json。
用法: python3 data/filings_cn.py
输出: public/data/filings.json；并把找到的原句证据写回 core.relations / 新关系候选。
"""
import json, os, re, sys, time, hashlib, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor
import requests
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.path.insert(0,HERE)
import refresh as R
from refresh import get, cite, load, save, log, mark, TODAY, CACHE, COMPANIES, CID
OUT=os.path.join(ROOT,'public','data')
UA={'User-Agent':'Mozilla/5.0 (compatible; GlobalIndustryMap/0.4; research@gaosichun.dev)'}
S=requests.Session(); S.headers.update(UA)

# 对手方别名：年报中文/英文常见写法 → company id
ALIASES={
 '特斯拉':'tesla','Tesla':'tesla','宝马':'bmw','BMW':'bmw','蔚来':'nio','NIO':'nio','理想':'liauto','Li Auto':'liauto',
 '小鹏':'xpeng','XPeng':'xpeng','奔驰':'mercedes','Mercedes':'mercedes','大众':'vw','Volkswagen':'vw','VW':'vw',
 'Stellantis':'stellantis','现代':'hyundai','Hyundai':'hyundai','福特':'ford','Ford':'ford','丰田':'toyota','Toyota':'toyota',
 '本田':'honda','Honda':'honda','吉利':'geely','Geely':'geely','上汽':'saic','SAIC':'saic','广汽':'gac','GAC':'gac',
 '比亚迪':'byd','BYD':'byd','宁德时代':'catl','CATL':'catl','松下':'panasonic','Panasonic':'panasonic',
 'LG Energy':'lges','LG新能源':'lges','三星':'samsung','Samsung':'samsung','苹果':'apple','Apple':'apple',
 '台积电':'tsmc','TSMC':'tsmc','华为':'huawei','小米':'xiaomi','Xiaomi':'xiaomi','OPPO':'oppo','vivo':'vivo',
 '一汽':'faw','长安':'changan','奇瑞':'chery','Volvo':'volvo','沃尔沃':'volvo',
 '英伟达':'nvidia','NVIDIA':'nvidia','高通':'qualcomm','Qualcomm':'qualcomm','联发科':'mediatek','MediaTek':'mediatek',
 '鸿海':'foxconn','富士康':'foxconn','Foxconn':'foxconn','立讯':'luxshare','京东方':'boe','BOE':'boe',
 '隆基':'longi','通威':'tongwei','晶科':'jinko','天合':'trina','阳光电源':'sungrow','固德威':'goodwe',
}
# v1.8：合并 data/aliases.py 生成的别名（全称/简称/英文/代码）
try:
  for _cid,_al in json.load(open(os.path.join(HERE,'aliases.json'),encoding='utf-8')).items():
    for _a in _al:
      if not re.fullmatch(r'\d{6}|\d{5}\.HK',_a): ALIASES.setdefault(_a,_cid)
except FileNotFoundError: pass
def alias_hit(alias,sent):
  # 拉丁字母别名必须整词匹配（避免 'NIO' 命中 'UNION'）
  if re.search(r'[A-Za-z]',alias): return re.search(r'(?<![A-Za-z])'+re.escape(alias)+r'(?![A-Za-z])',sent) is not None
  return alias in sent
# 关系关键词（中文年报）
KW_SUPPLY=r'供货|供应|客户|定点|采购|配套|合作伙伴|电池供应|成为.{0,6}客户|向.{0,10}供应'
KW_JV=r'合资|合营|联合成立|共同设立'
KW_COMP=r'竞争|对手'

def ashare_code(c):
  for l in c['listings']:
    if l['yahoo'].endswith(('.SZ','.SS','.BJ')):
      return l['yahoo'].split('.')[0], l['yahoo']
  return None,None

def find_annual(code6):
  """东财公告列表 → 最近一份年度报告全文 art_code"""
  url='https://np-anotice-stock.eastmoney.com/api/security/ann'
  try:
    d=S.get(url,params={'sr':-1,'page_size':40,'page_index':1,'ann_type':'A','stock_list':code6,'f_node':1,'s_node':0},timeout=30).json()
    mark('东方财富公告',True)
  except Exception as e:
    mark('东方财富公告',False,str(e)[:80]); return None
  for x in (d.get('data') or {}).get('list') or []:
    t=x.get('title') or ''
    if '年度报告' in t and '摘要' not in t and '半年度' not in t and '一季' not in t and '三季' not in t:
      return {'title':t,'art_code':x['art_code'],'date':(x.get('notice_date') or '')[:10],
              'pdf':f"https://pdf.dfcfw.com/pdf/H2_{x['art_code']}_1.pdf"}
  return None

def pdf_text(url, art):
  key=hashlib.md5(url.encode()).hexdigest()
  pdf=os.path.join(CACHE,'pdf_'+key+'.pdf'); txt=pdf+'.txt'
  if not os.path.exists(pdf) or os.path.getsize(pdf)<10000:
    try:
      r=S.get(url,timeout=120); r.raise_for_status()
      if len(r.content)<10000 or not r.content[:5]==b'%PDF-': raise RuntimeError('not pdf '+str(len(r.content)))
      open(pdf,'wb').write(r.content); mark('东方财富年报PDF',True)
    except Exception as e:
      mark('东方财富年报PDF',False,str(e)[:80]); return None
  if not os.path.exists(txt) or os.path.getmtime(txt)<os.path.getmtime(pdf):
    subprocess.run(['pdftotext','-layout',pdf,txt],check=False,timeout=120)
  if not os.path.exists(txt): return None
  return open(txt,encoding='utf-8',errors='ignore').read()

def extract_top5(text):
  """抽取前五大客户/供应商合计占比（名称常匿名）。"""
  out={}
  m=re.search(r'前五名客户合计销售金额占年度销售总额比例\s*([0-9.]+)\s*%',text)
  if m: out['top5_customer_share']=float(m.group(1))/100
  m=re.search(r'前五名供应商合计采购金额占年度采购总额比例\s*([0-9.]+)\s*%',text)
  if m: out['top5_supplier_share']=float(m.group(1))/100
  # 具名客户行（非“第N名/客户A”）
  named=[]
  for m in re.finditer(r'^\s*\d\s+([^\d\n]{2,40}?)\s+([\d,.]+)\s+([\d.]+)\s*%',text,re.M):
    name=m.group(1).strip()
    if re.match(r'^(第[一二三四五六七八九十\d]+名|客户[A-E]|供应商[A-E]|—|--|合计)',name): continue
    if len(name)>=2: named.append({'name':name,'amount':m.group(2),'share':float(m.group(3))/100})
  if named: out['named_parties']=named[:10]
  return out

def extract_mentions(text, self_id):
  """在年报正文中搜索已知对手方，抽取含关系关键词的句子。"""
  # 压缩空白便于分句
  flat=re.sub(r'[ \t]+',' ',text)
  sents=re.split(r'[。！？\n]',flat)
  found=[]
  for alias,oid in ALIASES.items():
    if oid==self_id or oid not in CID: continue
    for sent in sents:
      if alias_hit(alias,sent) and 20<len(sent)<500 and re.search(KW_SUPPLY+'|'+KW_JV+'|'+KW_COMP,sent):
        # 判定类型
        typ='供货'
        if re.search(KW_JV,sent): typ='合资'
        elif re.search(KW_COMP,sent) and not re.search(KW_SUPPLY,sent): typ='竞争'
        # 方向：默认 self → other 供货（self 是供应商）；若“向X采购/来自X”则 other→self
        frm,to=self_id,oid
        if re.search(r'向.{0,8}'+re.escape(alias)+r'.{0,6}(采购|购买)' ,sent) or re.search(r'(采购|购买).{0,8}'+re.escape(alias),sent):
          frm,to=oid,self_id
        found.append({'from':frm,'to':to,'type':typ,'alias':alias,'quote':sent.strip()[:500]})
        break
  # 去重
  seen=set(); uniq=[]
  for f in found:
    k=(f['from'],f['to'],f['type'])
    if k in seen: continue
    seen.add(k); uniq.append(f)
  return uniq

def probe_hkex():
  try:
    r=S.get('https://www1.hkexnews.hk/search/titlesearch.xhtml?lang=en',timeout=20)
    ok=r.status_code==200 and 'Title Search' in r.text
    mark('HKEX news',ok,'页面可达但无公开批量 API；本轮未解析 PDF' if ok else f'HTTP {r.status_code}')
    return ok
  except Exception as e:
    mark('HKEX news',False,str(e)[:80]); return False

def probe_mops():
  try:
    r=S.get('https://doc.twse.com.tw/server-java/t57sb01?step=1&colorchg=1&co_id=2330&year=113&seamon=&mtype=F&',timeout=25)
    ok=r.status_code==200 and (b'2330' in r.content or '2330' in r.content.decode('big5','ignore'))
    # try download
    if ok:
      d=S.post('https://doc.twse.com.tw/server-java/t57sb01',data={'step':'9','kind':'F','co_id':'2330','filename':'2024_2330_20240604F04.pdf'},timeout=30)
      if d.content[:4]==b'%PDF': mark('TWSE MOPS',True,'年报 PDF 可下载')
      else: mark('TWSE MOPS',False,'目录可达但 PDF 下载返回非 PDF（可能需会话/档案不存在）；本轮未抽取')
    else: mark('TWSE MOPS',False,'目录页不可达')
    return ok
  except Exception as e:
    mark('TWSE MOPS',False,str(e)[:80]); return False

def probe_cninfo():
  try:
    r=S.post('http://www.cninfo.com.cn/new/information/topSearch/query',data={'keyWord':'300750','maxNum':3},timeout=20)
    ok=r.status_code==200 and r.text.strip().startswith('[')
    mark('巨潮资讯 cninfo',ok,'topSearch 可用' if ok else f'本机网络不可达或空响应（len={len(r.text)}）；改用东财 PDF 镜像')
    return ok
  except Exception as e:
    mark('巨潮资讯 cninfo',False,str(e)[:80]+'；改用东财 PDF'); return False

def main():
  probe_cninfo(); probe_hkex(); probe_mops()
  core=load('core.json',{}); byid={c['id']:c for c in core['companies']}
  targets=[c for c in core['companies'] if ashare_code(c)[0]]
  log('A-share targets',len(targets))
  filings={}; new_ev=[]
  def one(c):
    code6,yahoo=ashare_code(c)
    meta=find_annual(code6)
    if not meta: return c['id'],None
    text=pdf_text(meta['pdf'],meta['art_code'])
    if not text: return c['id'],{**meta,'error':'pdf_text_failed'}
    top5=extract_top5(text)
    ments=extract_mentions(text,c['id'])
    return c['id'],{**meta,'chars':len(text),'top5':top5,'mentions':ments,
      'source':cite('东方财富年报PDF（交易所定期报告镜像）',meta['pdf'],retrieved=TODAY,note=f"原披露平台为巨潮/交易所；标题 {meta['title']}")}
  # Limit concurrency; PDFs are heavy — do up to 25 priority first (those in relations or large)
  rel_ids={r['from'] for r in core['relations']}|{r['to'] for r in core['relations']}
  pri=sorted(targets,key=lambda c:(0 if c['id'] in rel_ids else 1, c['id']))[:40]
  with ThreadPoolExecutor(3) as ex:
    for cid,rec in ex.map(one,pri):
      if rec: filings[cid]=rec; log(cid, rec.get('title','?'), 'mentions',len(rec.get('mentions') or []), 'top5',rec.get('top5'))
  # Merge evidence into relations
  rels=core['relations']; idx={(r['from'],r['to'],r['type']):i for i,r in enumerate(rels)}
  added=0
  for cid,rec in filings.items():
    src=rec.get('source') or cite('东方财富年报PDF',rec.get('pdf',''))
    for m in rec.get('mentions') or []:
      ev={**src,'quote':m['quote'],'form':'年报','date':rec.get('date')}
      k=(m['from'],m['to'],m['type'])
      if k in idx:
        r=rels[idx[k]]
        if not any(e.get('quote')==ev['quote'] for e in r.get('evidence') or []):
          r.setdefault('evidence',[]).insert(0,ev)
          new_ev.append(k)
      else:
        # only add if both ends in our universe
        if m['from'] in byid and m['to'] in byid:
          rels.append({'from':m['from'],'to':m['to'],'type':m['type'],'note':f"年报原文提及（{m['alias']}）",'status':'已引用','confidence':'中',
            'evidence':[ev],'grade':'B','conf':0.85})
          idx[k]=len(rels)-1; added+=1; new_ev.append(k)
  core['relations']=rels
  # Attach top5 concentration onto companies
  for c in core['companies']:
    f=filings.get(c['id'])
    if f and f.get('top5'):
      c['filingTop5']={'customerShare':f['top5'].get('top5_customer_share'),'supplierShare':f['top5'].get('top5_supplier_share'),
        'named':f['top5'].get('named_parties'),'source':f.get('source'),'title':f.get('title'),'date':f.get('date'),'url':f.get('pdf')}
  core['meta']['version']='v0.4'
  save('core.json',core)
  save('filings.json',{'generated':R.NOW,'count':len(filings),'added_relations':added,'updated_evidence':len(new_ev),'filings':{k:{kk:vv for kk,vv in v.items() if kk!='mentions' or True} for k,v in filings.items()}})
  st=load('sources.json',{}); st.setdefault('status',{}).update({k:{**v,'checked':R.NOW} for k,v in R.STATUS.items()}); save('sources.json',st)
  log('DONE filings',len(filings),'new rels',added,'evidence updates',len(new_ev))

if __name__=='__main__': main()
