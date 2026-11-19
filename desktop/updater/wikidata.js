'use strict'
// Wikidata：对已有 QID 刷新标识符（ISIN/LEI/官网/员工数…）与带日期数值（P2226 市值 / P2139 营收 / P2295 净利）。QID 不重新解析（沿用已核对的映射）。
const { cite } = require('./util')
async function sparql(http, q) {
  const body = new URLSearchParams({ query: q, format: 'json' }).toString()
  const r = await http.json('https://query.wikidata.org/sparql', { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' }, timeout: 90000, breakerKey: 'wikidata', tries: 2 })
  return r.results.bindings
}
async function run(ctx) {
  const { http, status, core, out } = ctx
  const qids = core.companies.map(c => c.qid).filter(Boolean); const vals = [...new Set(qids)].map(q => 'wd:' + q).join(' ')
  const data = {}; let attempted = 0, failed = 0
  const props = [['P946', 'isin'], ['P1278', 'lei'], ['P856', 'website'], ['P1056', 'products'], ['P749', 'parent'], ['P355', 'subsidiaries'], ['P127', 'ownedBy'], ['P452', 'industry'], ['P159', 'hq'], ['P571', 'inception'], ['P1128', 'employees'], ['P5531', 'cik']]
  let i = 0
  for (const [prop, name] of props) {
    attempted++; ctx.progress('Wikidata', i++ / 16, name)
    try {
      const rows = await sparql(http, `SELECT ?i ?v ?vLabel WHERE { VALUES ?i { ${vals} } ?i wdt:${prop} ?v. SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh,en". } }`)
      const d = {}; for (const r of rows) (d[r.i.value.split('/').pop()] = d[r.i.value.split('/').pop()] || []).push({ id: r.v.value.split('/').pop(), label: r.vLabel?.value ?? r.v.value })
      data[name] = d; status.mark('Wikidata SPARQL', true)
    } catch (e) { if (e.aborted) throw e; failed++; status.mark('Wikidata SPARQL', false, `${name}: ${e.message}`); if (e.circuit) break }
  }
  for (const [prop, name] of [['P2226', 'marketCap'], ['P2139', 'revenue'], ['P2295', 'netIncome']]) {
    attempted++; ctx.progress('Wikidata', i++ / 16, name)
    try {
      const rows = await sparql(http, `SELECT ?i ?amt ?unitLabel ?t WHERE { VALUES ?i { ${vals} } ?i p:${prop} ?st. ?st psv:${prop} ?vn. ?vn wikibase:quantityAmount ?amt; wikibase:quantityUnit ?unit. OPTIONAL{?st pq:P585 ?t} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`)
      const d = {}
      for (const r of rows) { const q = r.i.value.split('/').pop(); const t = (r.t?.value || '').slice(0, 10); const v = { value: parseFloat(r.amt.value), unit: r.unitLabel?.value || '', date: t }; if (!d[q] || (t && t > d[q].date)) d[q] = v }
      data[name] = d; status.mark('Wikidata SPARQL', true)
    } catch (e) { if (e.aborted) throw e; failed++; status.mark('Wikidata SPARQL', false, `${name}: ${e.message}`); if (e.circuit) break }
  }
  for (const [lang, name] of [['https://en.wikipedia.org/', 'enwiki'], ['https://zh.wikipedia.org/', 'zhwiki']]) {
    attempted++
    try {
      const rows = await sparql(http, `SELECT ?i ?a WHERE { VALUES ?i { ${vals} } ?a schema:about ?i; schema:isPartOf <${lang}>. }`)
      const d = {}; for (const r of rows) d[r.i.value.split('/').pop()] = r.a.value; data[name] = d; status.mark('Wikidata SPARQL', true)
    } catch (e) { if (e.aborted) throw e; failed++; status.mark('Wikidata SPARQL', false, `${name}: ${e.message}`); if (e.circuit) break }
  }
  out.wikidata = { data, attempted, failed }
}
// 将 Wikidata 结果合并进公司记录：只用「有值」的新数据补齐/更新，绝不置空
function apply(core, wd) {
  let changed = 0
  for (const c of core.companies) {
    const q = c.qid; if (!q) continue; const url = `https://www.wikidata.org/wiki/${q}`; const pick = n => wd[n]?.[q]
    for (const k of ['isin', 'lei', 'website', 'inception', 'employees', 'cik']) {
      const v = pick(k); if (!v?.length) continue
      const nv = k === 'isin' ? v.map(i => i.label).slice(0, 3) : v[0].label
      if (JSON.stringify(c[k]?.value) !== JSON.stringify(nv)) { c[k] = { value: nv, ...cite('Wikidata', url) }; changed++ }
    }
    for (const k of ['products', 'industry', 'parent', 'subsidiaries', 'hq']) {
      const v = pick(k); if (!v?.length) continue; const nv = v.map(i => i.label).slice(0, 15)
      if (JSON.stringify(c['wd_' + k]?.value) !== JSON.stringify(nv)) { c['wd_' + k] = { value: nv, ...cite('Wikidata', url) }; changed++ }
    }
    for (const k of ['marketCap', 'revenue', 'netIncome']) {
      const v = pick(k); if (!v) continue; const o = c['wd_' + k]
      if (!o || (v.date || '') >= (o.date || '')) { if (!o || o.value !== v.value || o.date !== v.date) { c['wd_' + k] = { ...v, ...cite('Wikidata', url) }; changed++ } }
    }
    if (wd.enwiki?.[q]) c.enwiki = wd.enwiki[q]; if (wd.zhwiki?.[q]) c.zhwiki = wd.zhwiki[q]
  }
  return changed
}
module.exports = { run, apply }
