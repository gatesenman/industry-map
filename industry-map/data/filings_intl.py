#!/usr/bin/env python3
"""日韩台等非美一手：公司 IR PDF / 监管源探测。
- 成功：Samsung Electronics 2025 4Q Interim/Business Report（官方 IR CDN）客户与供应商原句
- 探测失败如实记录：EDINET（需 API 订阅密钥）、DART（需 crtfc_key + TLS）、MOPS（目录 200，PDF 常 404）、Sony IR 403、TSMC/TEL IR 营销稿无稳定对手方名单
用法: python3 data/filings_intl.py
"""
import json, os, re, sys, datetime, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from refresh import load, save, log, mark, TODAY, HERE

CACHE = os.path.join(HERE, 'cache', 'intl_filings')
os.makedirs(CACHE, exist_ok=True)
UA = {'User-Agent': 'IndustryMapResearch/0.7 (academic; contact research@local)'}

# 图谱内 ID ↔ 报告用名
ALIAS_TO_ID = {
  'Alphabet': 'alphabet', 'Apple': 'apple', 'Qualcomm': 'qualcomm', 'MediaTek': 'mediatek',
  'Nvidia': 'nvidia', 'NVIDIA': 'nvidia', 'Intel': 'intel', 'Tesla': 'tesla', 'Tesla, Inc.': 'tesla',
  'TSMC': 'tsmc', 'Google': 'alphabet',
}

SAMSUNG_PDF = 'https://images.samsung.com/is/content/samsung/assets/global/ir/docs/2025_4Q_Interim_Report.pdf'

PROBE = {
  'EDINET API v2': {'url': 'https://disclosure.edinet-fsa.go.jp/api/v2/documents.json?date=2025-06-27&type=2',
    'note': '返回错误页 HTML；正式批量需订阅 API 密钥（日本金融厅）'},
  'DART OpenAPI': {'url': 'https://opendart.fss.or.kr.kr/api/list.json?crtfc_key=test&corp_code=00126380&bgn_de=20250101&end_de=20251231',
    'note': '需申请 crtfc_key；本环境 TLS 握手失败'},
  'TWSE MOPS 目录': {'url': 'https://doc.twse.com.tw/server-java/t57sb01?step=1&colorchg=1&co_id=2330&year=113&seamon=&mtype=F&',
    'note': '目录页 200（Big5），PDF 直链常 404，未做会话式下载'},
  'Sony IR AR': {'url': 'https://www.sony.com/en/SonyInfo/IR/library/ar/', 'note': '403 Forbidden'},
  'TSMC AR 2025': {'url': 'https://investor.tsmc.com/sites/ir/annual-report/2025/2025%20TSMC%20Annual%20Report.E.pdf',
    'note': 'PDF 可下（~7MB），主要为 ESG/产能叙述，无稳定前五大客户名单（客户集中度见 SEC 20-F）'},
  'Tokyo Electron IR 2026': {'url': 'https://www.tel.com/ir/library/ar/g4alje00000000pq-att/ir2026_all_en.pdf',
    'note': 'PDF 可下；供应商/客户专名句噪声高，未自动入库'},
}

def fetch(url, dest=None, timeout=90):
  req = urllib.request.Request(url, headers=UA)
  with urllib.request.urlopen(req, timeout=timeout) as r:
    data = r.read()
  if dest:
    open(dest, 'wb').write(data)
  return data

def probe_sources():
  status = {}
  for name, meta in PROBE.items():
    try:
      req = urllib.request.Request(meta['url'], headers=UA)
      with urllib.request.urlopen(req, timeout=25) as r:
        body = r.read(800)
        ok = r.status == 200 and not body.lstrip().startswith(b'<!DOCTYPE')
        # MOPS/EDINET may return 200 HTML error
        if b'error' in body.lower()[:200] or b'\xe3\x82\xa8\xe3\x83\xa9\xe3\x83\xbc' in body[:400]:
          ok = False
        status[name] = {'ok': ok, 'http': r.status, 'note': meta['note'], 'checked': TODAY}
        mark(name, ok, meta['note'][:60])
    except Exception as e:
      status[name] = {'ok': False, 'error': str(e)[:120], 'note': meta['note'], 'checked': TODAY}
      mark(name, False, str(e)[:60])
  return status

def extract_samsung(text):
  """Return list of {to,type,quote,role} from Samsung business report English text."""
  out = []
  # Major customers sentence
  m = re.search(r'Major customers \(listed (?:in )?alphabetical(?:ly)?(?: order)?\) included ([^.]{10,200})\.', text, re.I)
  if m:
    names = re.split(r',\s*|\s+and\s+', m.group(1))
    quote = m.group(0).strip()
    for n in names:
      n = n.strip().strip('.')
      oid = ALIAS_TO_ID.get(n) or ALIAS_TO_ID.get(n.split()[0] if n else '')
      if oid:
        out.append({'to': oid, 'type': '供货', 'role': 'customer', 'quote': quote, 'alias': n})
  # Foundry Tesla contract
  m2 = re.search(r'Tesla,\s*Inc\.[^\n]{0,40}(?:Semiconductor|contract|manufacturing)[^\n]{0,80}', text, re.I)
  if not m2:
    m2 = re.search(r'Foundry business[\s\S]{0,200}?Tesla,\s*Inc\.', text, re.I)
  if m2:
    # broader quote
    i = text.find('Tesla, Inc.')
    quote = re.sub(r'\s+', ' ', text[max(0, i-80):i+120]).strip()
    out.append({'to': 'tesla', 'type': '供货', 'role': 'customer', 'quote': quote[:400], 'alias': 'Tesla'})
  # Key materials suppliers paragraph
  m3 = re.search(r'For the DX Division, key materials[\s\S]{50,900}?WNC,?\s*etc\.', text, re.I)
  if m3:
    para = re.sub(r'\s+', ' ', m3.group(0))
    for alias, oid in [('Qualcomm', 'qualcomm'), ('MediaTek', 'mediatek'), ('Nvidia', 'nvidia'), ('Intel', 'intel'), ('Apple', 'apple')]:
      if alias in para or (alias == 'Nvidia' and 'Nvidia' in para):
        out.append({'to': oid, 'type': '供货', 'role': 'supplier', 'quote': para[:500], 'alias': alias})
  # Table line Mobile AP
  for alias, oid, pat in [
    ('qualcomm', 'qualcomm', r'Mobile AP solutions[^\n]{0,80}Qualcomm'),
    ('mediatek', 'mediatek', r'Mobile AP solutions[^\n]{0,80}MediaTek|Qualcomm,\s*MediaTek'),
    ('nvidia', 'nvidia', r'SOC\(System-On-Chip\)[^\n]{0,80}Nvidia'),
    ('intel', 'intel', r'SOC\(System-On-Chip\)[^\n]{0,80}Intel|Nvidia,\s*Intel'),
  ]:
    mm = re.search(pat, text, re.I)
    if mm:
      q = re.sub(r'\s+', ' ', mm.group(0))[:300]
      if not any(x['to'] == oid and x['role'] == 'supplier' for x in out):
        out.append({'to': oid, 'type': '供货', 'role': 'supplier', 'quote': q, 'alias': alias})
  # dedupe by (to, role)
  seen = set(); uniq = []
  for x in out:
    k = (x['to'], x['role'])
    if k in seen: continue
    seen.add(k); uniq.append(x)
  return uniq

def merge_samsung(core, mentions, url):
  byid = {c['id']: c for c in core['companies']}
  existing = {(r['from'], r['to'], r['type']): r for r in core['relations']}
  src = {'source': 'Samsung Electronics IR (Business Report)', 'url': url, 'retrieved': TODAY, 'form': 'IR PDF', 'date': '2025'}
  added = 0
  # filingTop5 style
  top = {'customers': [], 'suppliers': [], 'source': src}
  for m in mentions:
    oid = m['to']
    if oid not in byid: continue
    if m['role'] == 'customer':
      frm, to = 'samsung', oid
      top['customers'].append({'id': oid, 'name': m['alias']})
    else:
      frm, to = oid, 'samsung'  # supplier → samsung
      top['suppliers'].append({'id': oid, 'name': m['alias']})
    k = (frm, to, m['type'])
    ev = {**src, 'quote': m['quote'][:500]}
    if k in existing:
      r = existing[k]
      if not any(e.get('quote') == ev['quote'] for e in (r.get('evidence') or [])):
        r.setdefault('evidence', []).insert(0, ev)
      kinds = {e.get('source', '') for e in r.get('evidence') or [] if not e.get('rejected')}
      hand = any('SEC' in x or 'IR' in x or '年报' in x or '东方财富' in x for x in kinds)
      if hand and len(kinds) >= 2:
        r['grade'] = 'A'; r['conf'] = 0.95; r['status'] = '已引用'
      elif hand:
        r['grade'] = 'B'; r['conf'] = 0.85; r['status'] = '已引用'
    else:
      core['relations'].append({
        'from': frm, 'to': to, 'type': m['type'], 'note': 'Samsung IR 原句',
        'status': '已引用', 'confidence': '中', 'grade': 'B', 'conf': 0.85,
        'evidence': [ev], 'direction': 'direct',
      })
      existing[k] = core['relations'][-1]
      added += 1
  # attach filing intl block on samsung company
  for c in core['companies']:
    if c['id'] == 'samsung':
      c['filingIntl'] = top
      break
  return added

def main():
  core = load('core.json', {})
  status = probe_sources()
  # Samsung PDF
  pdf_path = os.path.join(CACHE, 'samsung_2025_4q.pdf')
  txt_path = os.path.join(CACHE, 'samsung_2025_4q.txt')
  try:
    if not os.path.exists(pdf_path) or os.path.getsize(pdf_path) < 1_000_000:
      log('download Samsung IR…')
      fetch(SAMSUNG_PDF, pdf_path)
    if not os.path.exists(txt_path) or os.path.getsize(txt_path) < 10_000:
      os.system(f'pdftotext -layout {pdf_path} {txt_path}')
    text = open(txt_path, encoding='utf-8', errors='ignore').read()
    mentions = extract_samsung(text)
    log(f'Samsung IR mentions: {len(mentions)}')
    for m in mentions:
      log(f"  {m['role']} {m['to']}: {m['quote'][:100]}")
    added = merge_samsung(core, mentions, SAMSUNG_PDF)
    mark('Samsung IR PDF', True, f'{len(mentions)} mentions, +{added} relations')
    status['Samsung IR 2025 4Q'] = {'ok': True, 'mentions': len(mentions), 'addedRelations': added, 'url': SAMSUNG_PDF, 'checked': TODAY}
  except Exception as e:
    mark('Samsung IR PDF', False, str(e)[:80])
    status['Samsung IR 2025 4Q'] = {'ok': False, 'error': str(e)[:120], 'checked': TODAY}

  core['meta']['version'] = 'v0.7'
  core['meta']['updated'] = TODAY
  save('core.json', core)
  st = load('sources.json', {})
  st.setdefault('intlFilings', {})['v0.7'] = status
  st.setdefault('status', {})
  for k, v in status.items():
    st['status'][k] = {'ok': v.get('ok'), 'note': v.get('note') or v.get('error'), 'checked': TODAY}
  save('sources.json', st)
  ab = sum(1 for r in core['relations'] if r.get('grade') in ('A', 'B'))
  log(f'done. A/B relations={ab} total={len(core["relations"])}')

if __name__ == '__main__':
  main()
