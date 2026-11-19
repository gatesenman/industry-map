// 离线单元/集成测试：合并规则、保护闸、离线、回滚、过期本地数据
const assert = require('assert'), fs = require('fs'), path = require('path'), os = require('os')
const A = '/workspace/desktop/app28/'
const { Updater } = require(A + 'updater'); const { applyAll, guard } = require(A + 'updater/enrich'); const { Status } = require(A + 'updater/util')
const BUNDLED = '/workspace/t/bundled', SEED = A + 'seed'
const rj = f => JSON.parse(fs.readFileSync(path.join(BUNDLED, f + '.json'), 'utf8'))
const load = () => ({ core: rj('core'), micro: rj('micro'), macro: rj('macro') })
let pass = 0; const T = async (n, f) => { try { await f(); pass++; console.log('PASS', n) } catch (e) { console.log('FAIL', n, e.message); process.exitCode = 1 } }
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'im-'))
const clone = o => JSON.parse(JSON.stringify(o))

;(async () => {
  await T('离线（fetch 全部失败）：不写入、数据不变、无 current 目录', async () => {
    const u = tmp(); const up = new Updater({ bundledDir: BUNDLED, seedDir: SEED, userRoot: u, fetchImpl: async () => { throw new Error('offline') }, appVersion: 't' })
    const r = await up.run({ only: ['quotes', 'gleif'] })
    assert.equal(r.ok, false); assert(/未写入/.test(r.summary), r.summary); assert(!fs.existsSync(path.join(u, 'current'))); assert.equal(up.status().dataKind, 'bundled')
  })
  await T('限流/HTTP 500：同样不写入', async () => {
    const u = tmp(); const up = new Updater({ bundledDir: BUNDLED, seedDir: SEED, userRoot: u, fetchImpl: async () => new Response('x', { status: 403 }), appVersion: 't' })
    const r = await up.run({ only: ['quotes', 'gleif'] }); assert.equal(r.ok, false); assert(!fs.existsSync(path.join(u, 'current')))
  })
  await T('保护闸：公司减少 / 关系减少 / A,B 关系减少 / 既有关系被改 / 行情锐减 均被拦截', async () => {
    const base = load()
    const c1 = clone(base); c1.core.companies.pop(); assert(guard(base, c1).some(x => /companies/.test(x)))
    const c2 = clone(base); c2.core.relations.pop(); assert(guard(base, c2).some(x => /relations/.test(x)))
    const c3 = clone(base); const i = c3.core.relations.findIndex(r => r.grade === 'A'); c3.core.relations[i].grade = 'C'; assert(guard(base, c3).some(x => /既有关系被改动/.test(x)))
    const c4 = clone(base); c4.core.relations[0].evidence = []; assert(guard(base, c4).some(x => /既有关系被改动/.test(x)))
    const c5 = clone(base); for (const k of Object.keys(c5.micro.quotes).slice(0, 60)) delete c5.micro.quotes[k]; assert(guard(base, c5).some(x => /行情/.test(x)))
    const c6 = clone(base); c6.macro.trade.flows = c6.macro.trade.flows.slice(0, 100); assert(guard(base, c6).some(x => /贸易/.test(x)))
    assert.deepEqual(guard(base, clone(base)), [])
  })
  await T('合并：新关系只追加，已存在的不重复；既有关系字节级不变', async () => {
    const base = load(); const ex = base.core.relations[0]; const ids = base.core.companies.map(c => c.id)
    const newRel = { from: ids[0], to: ids[1], type: '竞争', grade: 'C', auto: true, evidence: [{ quote: 'q', url: 'u' }] }
    const out = { newRelations: { list: [clone(newRel), clone(newRel), { ...clone(ex) }, { ...clone(newRel), from: 'nonexistent' }] } }
    const r = applyAll({ base, out, status: new Status(), seed: {} })
    const have = r.core.relations.filter(x => x.from === newRel.from && x.to === newRel.to && x.type === '竞争')
    assert(have.length >= 1); assert.equal(r.core.relations.length, base.core.relations.length + (base.core.relations.some(x => x.from === newRel.from && x.to === newRel.to && x.type === '竞争') ? 0 : 1))
    assert.equal(JSON.stringify(r.core.relations.slice(0, base.core.relations.length)), JSON.stringify(base.core.relations))
    assert.deepEqual(guard(base, r), [])
  })
  await T('合并：数据源成功率不足（<50%）整体不采用，保留旧值', async () => {
    const base = load(); const id = Object.keys(base.micro.quotes)[0]; const old = base.micro.quotes[id]
    const out = { quotes: { data: { [id]: { ...old, price: old.price * 1.01, time: '2099-01-01T00:00:00Z' } }, attempted: 200 } }
    const r = applyAll({ base, out, status: new Status(), seed: {} })
    assert.deepEqual(r.micro.quotes[id], old); assert(r.warnings.some(w => /股价/.test(w))); assert.equal(Object.keys(r.applied).length, 0)
  })
  await T('合并：市值新值相对旧值偏差过大 → 保留旧值并警告', async () => {
    const base = load(); const c = base.core.companies.find(c => c.marketCap?.method?.startsWith('SEC 10-K/10-Q') && base.micro.sec[c.id]?.shares)
    assert(c, 'need a SEC-based company'); const q = { ...base.micro.quotes[c.id], price: base.micro.quotes[c.id].price * 10, time: '2099-01-01T00:00:00Z' }
    const out = { quotes: { data: Object.fromEntries(Object.entries(base.micro.quotes).map(([k, v]) => [k, k === c.id ? q : v])), attempted: Object.keys(base.micro.quotes).length } }
    const r = applyAll({ base, out, status: new Status(), seed: {} }); const n = r.core.companies.find(x => x.id === c.id)
    assert.equal(n.marketCap.valueUSD, c.marketCap.valueUSD); assert(r.warnings.some(w => w.includes('市值 ' + c.id)))
  })
  await T('过期本地数据：程序内置数据比本地更新更新时，忽略本地数据', async () => {
    const u = tmp(); const cur = path.join(u, 'current'); fs.mkdirSync(cur)
    for (const f of ['core', 'micro', 'macro', 'sources']) fs.copyFileSync(path.join(BUNDLED, f + '.json'), path.join(cur, f + '.json'))
    fs.writeFileSync(path.join(cur, 'manifest.json'), JSON.stringify({ kind: 'local', baseGenerated: '2020-01-01T00:00:00Z' }))
    const up = new Updater({ bundledDir: BUNDLED, seedDir: SEED, userRoot: u, fetchImpl: fetch })
    assert.equal(up.activeDir().kind, 'bundled'); assert(up.status().staleLocalIgnored)
    fs.writeFileSync(path.join(cur, 'manifest.json'), JSON.stringify({ kind: 'local', baseGenerated: rj('core').meta.generated })); assert.equal(up.activeDir().kind, 'local')
  })
  await T('损坏的本地数据（缺文件）→ 回退内置', async () => {
    const u = tmp(); const cur = path.join(u, 'current'); fs.mkdirSync(cur); fs.writeFileSync(path.join(cur, 'manifest.json'), '{}'); fs.writeFileSync(path.join(cur, 'core.json'), '{')
    assert.equal(new Updater({ bundledDir: BUNDLED, seedDir: SEED, userRoot: u }).activeDir().kind, 'bundled')
  })
  await T('回滚/恢复内置/备份上限', async () => {
    const u = tmp(); const up = new Updater({ bundledDir: BUNDLED, seedDir: SEED, userRoot: u })
    const fake = (n) => { const cur = path.join(u, 'current'); fs.rmSync(cur, { recursive: true, force: true }); fs.mkdirSync(cur); for (const f of ['core', 'micro', 'macro', 'sources']) fs.copyFileSync(path.join(BUNDLED, f + '.json'), path.join(cur, f + '.json')); fs.writeFileSync(path.join(cur, 'manifest.json'), JSON.stringify({ kind: 'local', baseGenerated: rj('core').meta.generated, dataVersion: 'x' + n })) }
    fs.mkdirSync(path.join(u, 'backups/20260101000000'), { recursive: true }); fs.writeFileSync(path.join(u, 'backups/20260101000000/manifest.json'), JSON.stringify({ kind: 'bundled' }))
    fake(1); assert.equal(up.activeDir().kind, 'local'); up.rollback(); assert.equal(up.activeDir().kind, 'bundled'); assert.throws(() => up.rollback(), /没有可回滚/)
    fake(2); up.reset(); assert.equal(up.activeDir().kind, 'bundled')
  })
  console.log(pass + ' passed'); 
})()
