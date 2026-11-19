'use strict'
// 合并规则（merge-safe）：
//  · 只用「有来源的新值」补齐/更新；新值缺失 → 保留旧值；绝不置空
//  · 既有关系（含人工/助手核实的 A/B/C/待核实）一律不改、不删、不降级；只追加自动发现（grade=C，auto=true）
//  · 某数据源成功率过低（网络被封/接口异常）→ 该源本轮结果整体不采用
//  · 字段级异常闸：市值/营收/股价变化幅度超限 → 保留旧值并记入警告
const { cite, clone, toUSD, today } = require('./util')
const wikidata = require('./wikidata')

const MIN_OK = 0.5
function gate(name, got, attempted, status, warnings) {
  if (!attempted) return false
  if (got / attempted < MIN_OK) { warnings.push(`${name}：成功率 ${got}/${attempted} 低于 ${MIN_OK * 100}%，本轮不采用该源数据（保留旧数据）`); return false }
  return true
}
const dnum = x => (typeof x === 'number' && isFinite(x))

function qualityOf(c, micro) {
  const score = [!!c.qid, !!c.lei, !!c.gleif, !!micro.sec?.[c.id], !!micro.quotes?.[c.id], !!c.marketCap, !!c.revenue].filter(Boolean).length
  return { score, max: 7, grade: score >= 5 ? 'A' : score >= 3 ? 'B' : 'C' }
}

function applyAll({ base, out, status, seed }) {
  const warnings = [], changes = { quotes: 0, fx: 0, sec: 0, gleif: 0, marketCap: 0, revenue: 0, wikidataFields: 0, macroSeries: 0, commodities: 0, newRelations: 0, tradeFlows: 0 }
  const core = clone(base.core), micro = clone(base.micro), macro = clone(base.macro)
  micro.sec = micro.sec || {}; micro.quotes = micro.quotes || {}; micro.fx = micro.fx || {}; micro.gleif = micro.gleif || {}
  const oldQuotes = base.micro.quotes || {}, oldFx = base.micro.fx || {}
  const applied = {}

  // ---- 行情 / 汇率 ----
  if (out.quotes) {
    const n = Object.keys(out.quotes.data).length
    if (gate('股价', n, out.quotes.attempted, status, warnings)) {
      for (const [id, q] of Object.entries(out.quotes.data)) {
        const o = micro.quotes[id]
        if (o && String(o.time).slice(0, 10) > String(q.time).slice(0, 10)) continue   // 新值反而更旧 → 不覆盖
        if (o && dnum(o.price) && o.currency === q.currency && (q.price / o.price > 2 || q.price / o.price < 0.5)) warnings.push(`股价 ${id} 变动 ${(o.price)}→${q.price} 超过 ±50%/×2，已采用但请留意（可能拆股/退市）`)
        micro.quotes[id] = q; changes.quotes++
      }
      applied.quotes = true
    }
  }
  if (out.fx && Object.keys(out.fx.data).length >= 7) { for (const [k, v] of Object.entries(out.fx.data)) { micro.fx[k] = v; changes.fx++ } applied.fx = true }
  else if (out.fx) warnings.push(`汇率：仅取到 ${Object.keys(out.fx.data).length}/13，本轮不采用`)

  // ---- SEC / GLEIF ----
  if (out.sec && out.sec.attempted) {
    const okc = (out.sec.fetched || 0) + (out.sec.unchanged || 0)
    if (gate('SEC', okc, out.sec.attempted, status, warnings)) { for (const [id, r] of Object.entries(out.sec.data)) { micro.sec[id] = r; changes.sec++ } applied.sec = true }
  }
  if (out.gleif && gate('GLEIF', Object.keys(out.gleif.data).length, out.gleif.attempted, status, warnings)) {
    for (const [id, g] of Object.entries(out.gleif.data)) { micro.gleif[id] = g; changes.gleif++ } applied.gleif = true
  }

  // ---- Wikidata（公司字段）----
  if (out.wikidata && out.wikidata.attempted && (out.wikidata.attempted - out.wikidata.failed) / out.wikidata.attempted >= 0.75) { changes.wikidataFields = wikidata.apply(core, out.wikidata.data); applied.wikidata = true }
  else if (out.wikidata) warnings.push(`Wikidata：${out.wikidata.attempted - out.wikidata.failed}/${out.wikidata.attempted} 个查询成功，未达 75%，本轮不采用`)

  // ---- 宏观 / 贸易 / 大宗 ----
  if (out.macro) {
    const m = out.macro
    for (const k of ['worldbank', 'imf', 'fred']) { macro[k] = macro[k] || {}; for (const [ind, v] of Object.entries(m[k])) { macro[k][ind] = v; changes.macroSeries++ } }
    if (m.countries?.length) macro.countries = m.countries
  }
  if (out.trade) {
    const t = out.trade, old = macro.trade
    if (t.__attempted && t.__ok / t.__attempted < MIN_OK) warnings.push(`UN Comtrade：成功 ${t.__ok}/${t.__attempted} 组，低于 50%，本轮不采用（保留旧贸易数据）`)
    else if (t.flows.length >= (old?.flows?.length || 0) * 0.7 && t.flows.length > 0) { const { __ok, __attempted, ...rest } = t; macro.trade = rest; changes.tradeFlows = t.flows.length; applied.trade = true; if (t.kept) warnings.push(`UN Comtrade：有 ${t.kept} 组「商品×出口国」本轮取数失败（多为限流），沿用了旧数据`) }
    else warnings.push(`UN Comtrade：流向 ${t.flows.length} 条，少于旧数据 ${old?.flows?.length || 0} 条的 70%，本轮不采用（保留旧贸易数据）`)
  }
  if (out.prices) {
    const old = base.micro.prices?.commodities || {}; const n = Object.keys(out.prices.commodities).length
    if (n >= Object.keys(old).length * 0.8) { micro.prices = out.prices; changes.commodities = n; applied.prices = true } else warnings.push(`大宗商品：品种 ${n} 少于旧数据 80%，不采用`)
  }

  // ---- 公司级字段：gleif / 市值 / 营收 / 质量 ----
  const fx = micro.fx; const rvOvIds = new Set(Object.keys(seed.revenueOverrides || {}))
  const mcPrev = {}, rvPrev = {}
  for (const c of core.companies) {
    mcPrev[c.id] = c.marketCap?.valueUSD ?? null; rvPrev[c.id] = c.revenue?.valueUSD ?? null
    if (micro.gleif[c.id]) c.gleif = micro.gleif[c.id]
    const s = micro.sec[c.id], q = micro.quotes[c.id]; const mc = c.marketCap, m0 = mc?.method || ''
    // 市值
    if (c.delisted) { /* 已摘牌：不动 */ }
    else if (s?.shares && q && q.currency === 'USD' && ['10-K', '10-Q'].includes(s.shares.form) && /^[A-Za-z]+$/.test(q.symbol) && (!mc || m0.startsWith('SEC 10-K/10-Q'))) {
      const v = s.shares.value * q.price
      if (mc && (v / mc.valueUSD > 2.5 || v / mc.valueUSD < 0.4)) warnings.push(`市值 ${c.id}：新值 ${(v / 1e9).toFixed(1)}B 与旧值 ${(mc.valueUSD / 1e9).toFixed(1)}B 相差过大，保留旧值`)
      else if (!mc || Math.abs(v - mc.valueUSD) > 1) { c.marketCap = { valueUSD: v, method: 'SEC 10-K/10-Q 普通股数 × 最新收盘价（计算值）', date: q.time.slice(0, 10), sources: [cite('SEC EDGAR', s.url), cite('Yahoo Finance', q.url)] }; changes.marketCap++ }
    } else if (mc && q && (m0.startsWith('v1.4') || m0.startsWith('Yahoo Finance marketCap') || mc.local) && dnum(q.price)) {
      // 按「上次核验市值 × 股价涨跌 ÷ 汇率变动」推算（以首次推算时的价格/汇率为固定基准，不累积误差）
      let L = mc.local
      if (!L) {
        const oq = oldQuotes[c.id]; const cur = q.currency
        if (oq && oq.currency === cur && dnum(oq.price) && (cur === 'USD' || oldFx[cur]?.perUSD)) L = { basePrice: oq.price, baseFx: cur === 'USD' ? 1 : oldFx[cur].perUSD, baseUSD: mc.valueUSD, baseDate: mc.date || null, cur, origMethod: mc.method, origSources: mc.sources }
      }
      const fxNow = L && (L.cur === 'USD' ? 1 : fx[L.cur]?.perUSD)
      if (L && fxNow && q.currency === L.cur) {
        const pr = q.price / L.basePrice
        if (pr > 2 || pr < 0.5) warnings.push(`市值 ${c.id}：股价相对基准变动 ×${pr.toFixed(2)}，疑似拆股/事件，保留旧值`)
        else {
          const v = L.baseUSD * pr * (L.baseFx / fxNow)
          if (Math.abs(v - mc.valueUSD) > 1) {
            c.marketCap = { valueUSD: v, method: `${L.origMethod}；本地更新器按股价（${L.basePrice}→${q.price} ${L.cur}）${L.cur === 'USD' ? '' : `与汇率（${L.baseFx}→${fxNow}）`}变动推算`, date: q.time.slice(0, 10), sources: [...(L.origSources || []), cite(q.source || 'Yahoo Finance', q.url)], local: L }
            changes.marketCap++
          }
        }
      }
    } else if (mc && m0.startsWith('Wikidata P2226') && c.wd_marketCap && (c.wd_marketCap.date || '') > (mc.date || '')) {
      const w = c.wd_marketCap, v = toUSD(w.value, w.unit, fx)
      if (v) { c.marketCap = { valueUSD: v, method: `Wikidata P2226（${w.unit}，${w.date || '无日期'}）` + (w.unit === 'United States dollar' ? '' : '，按最新汇率折美元'), date: w.date, sources: [cite('Wikidata', c.wikidata)] }; changes.marketCap++ }
    }
    // 营收
    const rv = c.revenue
    if (!c.delisted && s?.revenue?.annual?.length && (!rv || rv.method.startsWith('SEC'))) {
      const a = s.revenue.annual[s.revenue.annual.length - 1]; const v = toUSD(a.value, s.revenue.unit, fx)
      if (v && (!rv || a.end >= (rv.fy_end || ''))) {
        if (rv && (v / rv.valueUSD > 3 || v / rv.valueUSD < 0.33)) warnings.push(`营收 ${c.id}：新值 ${(v / 1e9).toFixed(1)}B 与旧值 ${(rv.valueUSD / 1e9).toFixed(1)}B 相差 3 倍以上，保留旧值`)
        else if (!rv || Math.abs(v - rv.valueUSD) / rv.valueUSD > 1e-6) { c.revenue = { valueUSD: v, fy_end: a.end, raw: a.value, unit: s.revenue.unit, method: `SEC ${a.form}（${s.revenue.concept}）`, sources: [cite('SEC EDGAR', s.url)] }; changes.revenue++ }
      }
    } else if (rv && rv.method.startsWith('Wikidata P2139') && c.wd_revenue && (c.wd_revenue.date || '') > (rv.fy_end || '') && !rvOvIds.has(c.id)) {
      const w = c.wd_revenue, v = toUSD(w.value, w.unit, fx)
      if (v && v / rv.valueUSD < 3 && v / rv.valueUSD > 0.33) { c.revenue = { valueUSD: v, fy_end: w.date, raw: w.value, unit: w.unit, method: 'Wikidata P2139', sources: [cite('Wikidata', c.wikidata)] }; changes.revenue++ }
    }
    // 验证记录：数值被本地刷新后加注（不重新评级，也不改等级）
    for (const [f, prev, now] of [['marketCap', mcPrev[c.id], c.marketCap?.valueUSD ?? null], ['revenue', rvPrev[c.id], c.revenue?.valueUSD ?? null]]) {
      const vr = c.verify?.[f]; if (vr && prev !== now) { vr.notes = (vr.notes || []).filter(n => !n.startsWith('本地更新器')); vr.notes.push(`本地更新器 ${today()} 刷新了该数值（单源重算），未重新做多源交叉验证，等级沿用上次助手核验`) }
    }
  }

  // ---- 关系：只追加 ----
  const nr = out.newRelations
  if (nr?.list?.length) {
    const ids = new Set(core.companies.map(c => c.id)); const have = new Set(core.relations.map(r => `${r.from}>${r.to}>${r.type}`))
    for (const r of nr.list) { if (!ids.has(r.from) || !ids.has(r.to) || have.has(`${r.from}>${r.to}>${r.type}`)) continue; core.relations.push(r); have.add(`${r.from}>${r.to}>${r.type}`); changes.newRelations++ }
  }
  core.meta = { ...(core.meta || {}) }
  return { core, micro, macro, changes, warnings, applied }
}

// ---- 全局闸（写盘前）----
function guard(base, cand) {
  const reasons = []
  const n = (o, k) => (o?.[k] || []).length
  for (const k of ['companies', 'relations', 'segments', 'segmentLinks', 'industries']) if (n(cand.core, k) < n(base.core, k)) reasons.push(`core.${k} ${n(base.core, k)}→${n(cand.core, k)}（减少）`)
  const ab = c => (c.relations || []).filter(r => r.grade === 'A' || r.grade === 'B').length
  if (ab(cand.core) < ab(base.core)) reasons.push(`A/B 级关系 ${ab(base.core)}→${ab(cand.core)}（减少）`)
  const kc = o => Object.keys(o || {}).length
  if (kc(cand.micro.quotes) < kc(base.micro.quotes) * 0.9) reasons.push(`行情条数 ${kc(base.micro.quotes)}→${kc(cand.micro.quotes)}（减少超过 10%）`)
  if (kc(cand.micro.sec) < kc(base.micro.sec) * 0.9) reasons.push(`SEC 记录 ${kc(base.micro.sec)}→${kc(cand.micro.sec)}`)
  if (kc(cand.micro.gleif) < kc(base.micro.gleif) * 0.9) reasons.push(`GLEIF 记录 ${kc(base.micro.gleif)}→${kc(cand.micro.gleif)}`)
  for (const k of ['worldbank', 'imf', 'fred']) if (kc(cand.macro[k]) < kc(base.macro[k])) reasons.push(`macro.${k} ${kc(base.macro[k])}→${kc(cand.macro[k])}`)
  if ((cand.macro.trade?.flows?.length || 0) < (base.macro.trade?.flows?.length || 0) * 0.7) reasons.push('贸易流向减少超过 30%')
  const sz = o => JSON.stringify(o).length
  for (const k of ['core', 'micro', 'macro']) if (sz(cand[k]) < sz(base[k]) * 0.85) reasons.push(`${k}.json 体积 ${sz(base[k])}→${sz(cand[k])}（缩小超过 15%）`)
  // 既有关系逐条不变性（证据/等级/类型）
  const bm = new Map(base.core.relations.map(r => [`${r.from}>${r.to}>${r.type}`, r])); let altered = 0
  for (const r of cand.core.relations) { const o = bm.get(`${r.from}>${r.to}>${r.type}`); if (o && (o.grade !== r.grade || (o.evidence || []).length !== (r.evidence || []).length || o.status !== r.status)) altered++ }
  if (altered) reasons.push(`${altered} 条既有关系被改动（不允许）`)
  return reasons
}
module.exports = { applyAll, guard, qualityOf }
