#!/usr/bin/env python3
"""每日演化管线：refresh → verify → filings → audit → 版本快照 + changelog。
用法:
  python3 data/evolve.py                 # 全量（耗时）
  python3 data/evolve.py --snapshot-only # 仅根据当前数据写 changelog/版本历史
  python3 data/evolve.py --steps refresh,verify,audit
"""
import json, os, sys, time, datetime, subprocess, shutil, traceback
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PUB = os.path.join(ROOT, 'public', 'data')
HIST = os.path.join(HERE, 'history')
os.makedirs(HIST, exist_ok=True)

def load(name, default=None):
  p = os.path.join(PUB, name)
  if not os.path.exists(p): return default
  return json.load(open(p, encoding='utf-8'))

def save(name, obj):
  json.dump(obj, open(os.path.join(PUB, name), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

def run_step(name, argv, retries=2):
  last = None
  for i in range(retries + 1):
    t0 = time.time()
    try:
      print(f'[evolve] {name} try {i+1}/{retries+1}', flush=True)
      r = subprocess.run([sys.executable, *argv], cwd=ROOT, capture_output=True, text=True, timeout=3600)
      ok = r.returncode == 0
      print(r.stdout[-2000:] if r.stdout else '', flush=True)
      if r.stderr:
        print(r.stderr[-1000:], flush=True)
      if ok:
        return {'ok': True, 'seconds': round(time.time()-t0, 1), 'tries': i+1}
      last = r.stderr[-500:] or f'exit {r.returncode}'
    except Exception as e:
      last = traceback.format_exc()[-500:]
    time.sleep(2 * (i + 1))
  return {'ok': False, 'error': last, 'tries': retries+1}

def snapshot(version):
  core = load('core.json', {})
  audit = load('audit.json', {})
  ver = {
    'version': version,
    'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    'companies': len(core.get('companies') or []),
    'relations': len(core.get('relations') or []),
    'relationsAB': sum(1 for r in core.get('relations') or [] if r.get('grade') in ('A', 'B')),
    'industries': [i.get('id') for i in core.get('industries') or []],
    'overallVerified': (audit or {}).get('overallVerified'),
    'relationsVerified': (audit or {}).get('relationsVerified'),
  }
  # append versions history
  hist = load('versions.json', {'versions': []}) or {'versions': []}
  hist['versions'] = [v for v in hist['versions'] if v.get('version') != version]
  hist['versions'].insert(0, ver)
  hist['versions'] = hist['versions'][:30]
  hist['current'] = version
  save('versions.json', hist)
  # keep a slim core meta snapshot on disk
  slim = {'meta': core.get('meta'), 'counts': {k: ver[k] for k in ('companies', 'relations', 'relationsAB', 'industries')}, 'audit': {k: ver.get(k) for k in ('overallVerified', 'relationsVerified')}}
  json.dump(slim, open(os.path.join(HIST, f'{version}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
  return ver

def build_changelog(version, notes):
  """Merge curated notes + auto diff vs previous snapshot."""
  cl = load('changelog.json', {'entries': []}) or {'entries': []}
  prev = None
  hist = load('versions.json', {'versions': []})
  for v in hist.get('versions') or []:
    if v.get('version') != version:
      prev = v; break
  auto = []
  cur = snapshot(version)  # ensures versions.json updated
  if prev:
    for k, label in [('companies', '公司'), ('relations', '关系'), ('relationsAB', 'A/B 关系')]:
      a, b = prev.get(k), cur.get(k)
      if isinstance(a, int) and isinstance(b, int) and a != b:
        auto.append(f'{label} {a} → {b}')
    pi, ci = set(prev.get('industries') or []), set(cur.get('industries') or [])
    if ci - pi:
      auto.append('新增产业：' + ', '.join(sorted(ci - pi)))
  entry = {
    'version': version,
    'date': datetime.date.today().isoformat(),
    'notes': notes,
    'auto': auto,
    'accuracy': {
      'overallVerified': cur.get('overallVerified'),
      'relationsVerified': cur.get('relationsVerified'),
    },
  }
  cl['entries'] = [e for e in cl['entries'] if e.get('version') != version]
  cl['entries'].insert(0, entry)
  cl['entries'] = cl['entries'][:40]
  save('changelog.json', cl)
  return entry

def main():
  args = sys.argv[1:]
  version = 'v1.0'
  for i, a in enumerate(args):
    if a == '--version' and i + 1 < len(args):
      version = args[i + 1]
  if '--snapshot-only' in args:
    notes = [
      '管线硬化：data/evolve.py（步骤重试、版本快照、changelog）',
      '应用内 Changelog / 数据版本历史（Sources 页）',
      'refresh 关键路径增加有限重试',
    ]
    if '--notes-file' in args:
      notes = [l.strip() for l in open(args[args.index('--notes-file') + 1], encoding='utf-8') if l.strip()]
    print(json.dumps(build_changelog(version, notes), ensure_ascii=False, indent=2))
    return
  steps = 'refresh,verify,filings_intl,aliases,delist,audit'
  if '--steps' in args:
    steps = args[args.index('--steps') + 1]
  report = {}
  mapping = {
    'refresh': ['data/refresh.py'],
    'verify': ['data/verify.py'],
    'filings_intl': ['data/filings_intl.py'],
    'filings_cn': ['data/filings_cn.py'],
    'delist': ['data/delist.py'],
    'aliases': ['data/aliases.py'],
    'audit': ['data/audit.py', '--round', version, '--n', '200'],
  }
  for s in steps.split(','):
    s = s.strip()
    if not s or s not in mapping: continue
    report[s] = run_step(s, mapping[s], retries=1 if s == 'audit' else 2)
    if not report[s]['ok'] and s in ('refresh', 'verify'):
      print('[evolve] abort after', s); break
  notes = [f'evolve steps: {json.dumps(report, ensure_ascii=False)}']
  build_changelog(version, notes)
  print('[evolve] done', report)

if __name__ == '__main__':
  main()
