'use strict'
// SEC EDGAR：company_tickers → submissions（只看最新定期报告日期，判断是否有新申报）→ companyfacts（仅在有新申报时下载）
const { pool } = require('./net')
const { days } = require('./util')

const CONCEPTS = {
  revenue: [['us-gaap', 'Revenues'], ['us-gaap', 'RevenueFromContractWithCustomerExcludingAssessedTax'], ['us-gaap', 'SalesRevenueNet'], ['ifrs-full', 'Revenue'], ['ifrs-full', 'RevenueFromContractsWithCustomers']],
  netIncome: [['us-gaap', 'NetIncomeLoss'], ['ifrs-full', 'ProfitLossAttributableToOwnersOfParent'], ['ifrs-full', 'ProfitLoss']],
  grossProfit: [['us-gaap', 'GrossProfit'], ['ifrs-full', 'GrossProfit']],
  rd: [['us-gaap', 'ResearchAndDevelopmentExpense'], ['us-gaap', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'], ['ifrs-full', 'ResearchAndDevelopmentExpense']],
  capex: [['us-gaap', 'PaymentsToAcquirePropertyPlantAndEquipment'], ['ifrs-full', 'PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'], ['ifrs-full', 'PurchaseOfPropertyPlantAndEquipment']],
}
const FORMS = new Set(['10-K', '10-Q', '20-F', '40-F', '10-K/A', '20-F/A', '6-K'])
const PERIODIC = new Set(['10-K', '10-Q', '20-F', '40-F', '10-K/A', '20-F/A'])
const DELIST = new Set(['25', '25-NSE', '15-12B', '15-12G', '15-15D'])

function secSeries(facts, ns, name) {
  const f = facts?.facts?.[ns]?.[name]; if (!f) return null
  const unit = Object.keys(f.units)[0]; const rows = f.units[unit]; const A = {}, Q = {}
  for (const r of rows) {
    if (!r.start || !FORMS.has(r.form)) continue
    const d = days(r.start, r.end); const t = d >= 340 && d <= 380 ? A : d >= 80 && d <= 100 ? Q : null; if (!t) continue
    if (!t[r.end] || r.filed > t[r.end].filed) t[r.end] = { end: r.end, value: r.val, form: r.form, filed: r.filed, accn: r.accn }
  }
  const a = Object.values(A).sort((x, y) => x.end < y.end ? -1 : 1).slice(-6), q = Object.values(Q).sort((x, y) => x.end < y.end ? -1 : 1).slice(-8)
  return a.length || q.length ? { unit, annual: a, quarterly: q, concept: `${ns}:${name}` } : null
}
const lastEnd = s => (s.annual.length ? s.annual : s.quarterly).slice(-1)[0].end
function buildRecord(cik, facts) {
  const res = { cik, entity: facts.entityName, url: `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`, filingsUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}` }
  for (const [k, lst] of Object.entries(CONCEPTS)) {
    let best = null
    for (const [ns, n] of lst) { const s = secSeries(facts, ns, n); if (s && (!best || lastEnd(s) > lastEnd(best))) best = s }
    if (best) res[k] = best
  }
  const sh = facts?.facts?.dei?.EntityCommonStockSharesOutstanding
  if (sh) {
    const rows = (sh.units.shares || []).slice().sort((a, b) => a.end < b.end ? -1 : 1)
    if (rows.length) {
      const le = rows[rows.length - 1].end; const same = new Map()
      for (const r of rows) if (r.end === le) same.set(`${r.frame}|${r.val}`, r.val)
      res.shares = { value: [...same.values()].reduce((a, b) => a + b, 0), end: le, form: rows[rows.length - 1].form, classes: same.size }
    }
  }
  return res
}
function maxFiled(rec) {
  let m = ''
  for (const k of Object.keys(CONCEPTS)) for (const g of ['annual', 'quarterly']) for (const r of rec?.[k]?.[g] || []) if (r.filed > m) m = r.filed
  return m
}

async function run(ctx) {
  const { http, status, core, micro, out, state } = ctx
  let tick
  try { tick = await http.json('https://www.sec.gov/files/company_tickers.json', { breakerKey: 'sec' }); status.mark('SEC EDGAR', true) }
  catch (e) { status.mark('SEC EDGAR', false, e.message); out.sec = { data: {}, attempted: 1, failed: 1 }; return }
  const t2c = {}; for (const v of Object.values(tick)) t2c[String(v.ticker).toUpperCase()] = v.cik_str
  const targets = []
  for (const c of core.companies) {
    let cik = null
    for (const l of c.listings || []) if (['Nasdaq', 'NYSE'].includes(l.exchange) && t2c[String(l.ticker).toUpperCase()]) { cik = t2c[String(l.ticker).toUpperCase()]; break }
    if (!cik && micro.sec?.[c.id]?.cik) cik = micro.sec[c.id].cik
    if (cik) targets.push({ c, cik })
  }
  ctx.progress('SEC', 0, `检查 ${targets.length} 家申报公司的最新申报`)
  state.secSeen = state.secSeen || {}
  const result = {}, filings = {}, delistWarn = []; let done = 0, fetched = 0, unchanged = 0, failed = 0
  await pool(targets, 4, async ({ c, cik }) => {
    const pad = String(cik).padStart(10, '0'); let latest = '', latestForm = '', latestAcc = '', primary = ''
    try {
      const sub = await http.json(`https://data.sec.gov/submissions/CIK${pad}.json`, { breakerKey: 'sec' }); status.mark('SEC EDGAR', true)
      const r = sub.filings?.recent || {}; const rows = (r.form || []).map((f, i) => ({ f, d: r.filingDate[i], a: r.accessionNumber[i], p: r.primaryDocument[i] }))
      for (const x of rows) if (PERIODIC.has(x.f) && x.d > latest) { latest = x.d; latestForm = x.f; latestAcc = x.a; primary = x.p }
      const dl = rows.filter(x => DELIST.has(x.f)).sort((a, b) => a.d < b.d ? 1 : -1)[0]
      if (dl && dl.d > latest && !c.delisted) delistWarn.push({ id: c.id, form: dl.f, date: dl.d })
      // 最近一份年报（10-K/20-F/40-F）供关系发现使用
      const ann = rows.filter(x => ['10-K', '20-F', '40-F'].includes(x.f)).sort((a, b) => a.d < b.d ? 1 : -1)[0]
      if (ann) filings[c.id] = { cik, form: ann.f, date: ann.d, accession: ann.a, doc: ann.p, url: `https://www.sec.gov/Archives/edgar/data/${cik}/${ann.a.replace(/-/g, '')}/${ann.p}` }
    } catch (e) { if (e.aborted) throw e; status.mark('SEC EDGAR', false, `${c.id} submissions: ${e.message}`); failed++; return }
    const stored = maxFiled(micro.sec?.[c.id]); const seen = state.secSeen[pad] || ''
    if (!ctx.deep && micro.sec?.[c.id]?.revenue && latest && latest <= stored) { unchanged++; return }
    if (!ctx.deep && latest && latest === seen && micro.sec?.[c.id]) { unchanged++; return }   // 已看过且无 XBRL 增量（如部分 20-F）
    try {
      const facts = await http.json(`https://data.sec.gov/api/xbrl/companyfacts/CIK${pad}.json`, { timeout: 90000, breakerKey: 'sec' }); status.mark('SEC EDGAR', true)
      result[c.id] = buildRecord(cik, facts); fetched++; state.secSeen[pad] = latest
    } catch (e) { if (e.aborted) throw e; status.mark('SEC EDGAR', false, `${c.id} facts: ${e.message}`); failed++ }
    if (++done % 10 === 0) ctx.progress('SEC', done / targets.length, `${done}/${targets.length}`)
  }, ctx.signal)
  out.sec = { data: result, attempted: targets.length, fetched, unchanged, failed }
  out.secFilings = filings; out.delistWarn = delistWarn
  status.note('SEC EDGAR', `${targets.length} 家：新申报下载 ${fetched}，无新申报 ${unchanged}，失败 ${failed}`)
}
module.exports = { run, buildRecord, secSeries, maxFiled }
