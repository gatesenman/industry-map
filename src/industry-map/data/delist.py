#!/usr/bin/env python3
"""v1.8 摘牌/注销登记检测：SEC submissions 中 Form 25/25-NSE（摘牌）、15-12B/15-12G/15-15D（终止注册）。
只在该表单晚于最近一次 10-K/20-F/10-Q 时判定为已摘牌；结果写入 company.delisted（附 SEC 链接），并把 verify.ticker 降为 X。
用法: python3 data/delist.py [--dry]"""
import json,os,sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from refresh import get, load, save
DL={'25','25-NSE','15-12B','15-12G','15-15D'}; PER={'10-K','20-F','10-Q','40-F','6-K'}
core=load('core.json',{}); out=[]
for c in core['companies']:
  cik=(c.get('cik') or {}).get('value') if isinstance(c.get('cik'),dict) else c.get('cik')
  if not cik: continue
  try: d=get(f'https://data.sec.gov/submissions/CIK{int(cik):010d}.json',ttl=86400)
  except Exception as e: print('ERR',c['id'],e); continue
  r=d['filings']['recent']; rows=list(zip(r['form'],r['filingDate'],r['accessionNumber']))
  dl=[x for x in rows if x[0] in DL]; per=[x[1] for x in rows if x[0] in PER]
  if not dl: continue
  f,dt,acc=max(dl,key=lambda x:x[1]); lastper=max(per) if per else ''
  if dt<=lastper: continue
  US={'NYSE','Nasdaq','NASDAQ','NYSE American'}
  if not any(l['exchange'] in US for l in c.get('listings') or []): print('skip(无美国上市记录)',c['id'],f,dt); continue
  try: full=get(f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}.txt",kind='bin',ttl=86400,timeout=60)
  except Exception as e: print('ERR txt',c['id'],e); continue
  full=full.decode('latin-1') if isinstance(full,bytes) else str(full)
  import re as _re
  if not _re.search(r'Common Stock|Common Shares|Ordinary Shares|American Depositary',full,_re.I) or _re.search(r'matured, redeemed or retired',full,_re.I):
    print('skip(非普通股/为债券到期赎回)',c['id'],f,dt); continue
  url=f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc.replace('-','')}/{acc}-index.htm"
  rec={'source':f'SEC EDGAR {f}','url':url,'date':dt,'retrieved':'2026-10-22','note':f'最近一次定期报告 {lastper or "无"}；Form {f} 晚于定期报告，判定已摘牌/终止注册'}
  out.append((c['id'],rec))
  if '--dry' not in sys.argv:
    c['delisted']=rec; v=(c.get('verify') or {}).get('ticker')
    if v and v.get('grade')!='X': v['grade']='X'; v['conf']=0.0; v.setdefault('notes',[]).append(f"已摘牌：SEC Form {f} {dt}")
for i,r in out: print(i,r['source'],r['date'],r['url'])
if '--dry' not in sys.argv: save('core.json',core)
