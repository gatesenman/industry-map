'use strict'
// 宏观：World Bank / IMF DataMapper / FRED；贸易：UN Comtrade 公开预览；大宗：World Bank Pink Sheet
const { ISO3, cite, today } = require('./util')
const WB_IND = { 'NY.GDP.MKTP.CD': 'GDP（现价美元）', 'NY.GDP.MKTP.KD.ZG': 'GDP 实际增速 %', 'NV.IND.MANF.CD': '制造业增加值（现价美元）', 'NV.IND.MANF.ZS': '制造业增加值占 GDP %', 'TX.VAL.TECH.CD': '高科技产品出口（现价美元）', 'FP.CPI.TOTL.ZG': 'CPI 通胀 %', 'GB.XPD.RSDV.GD.ZS': '研发支出占 GDP %' }
const IMF_IND = { NGDP_RPCH: '实际 GDP 增速 %（含预测）', PCPIPCH: '通胀率 %（含预测）', NGDPD: 'GDP 十亿美元（含预测）' }
const FRED = { DFF: '美国联邦基金有效利率 %', DGS10: '美国 10 年期国债收益率 %', IPG3344S: '美国工业生产指数：半导体及电子元件', PCU33443344: '美国 PPI：半导体及电子元件制造', CPIAUCSL: '美国 CPI（城市消费者）', DEXCHUS: '人民币兑美元汇率', IPG3361T3S: '美国工业生产指数：汽车及零部件' }
const HS = { 8542: '集成电路', 8541: '半导体器件（含光伏电池，HS2017）', 854142: '光伏电池（未组装，HS2022）', 854143: '光伏组件（HS2022）', 850760: '锂离子蓄电池', 870380: '纯电动乘用车', 8486: '半导体制造设备' }
const REPORTERS = { 156: 'CHN', 490: 'TWN', 410: 'KOR', 392: 'JPN', 842: 'USA', 276: 'DEU', 528: 'NLD', 458: 'MYS', 702: 'SGP', 704: 'VNM' }

async function macro(ctx) {
  const { http, status, core, out } = ctx
  const countries = [...new Set(core.companies.map(c => ISO3[c.country]).filter(Boolean))].sort()
  const m = { worldbank: {}, imf: {}, fred: {}, countries, attempted: Object.keys(WB_IND).length + Object.keys(IMF_IND).length + Object.keys(FRED).length }
  let i = 0
  for (const [ind, nm] of Object.entries(WB_IND)) {
    ctx.progress('宏观', i++ / m.attempted, 'World Bank ' + ind)
    try {
      const r = await http.json(`https://api.worldbank.org/v2/country/${countries.filter(x => x !== 'TWN').join(';')}/indicator/${ind}`, { params: { format: 'json', mrv: 12, per_page: 1000 }, breakerKey: 'wb' })
      const rows = r[1] || []; if (!rows.length) throw new Error('空结果'); status.mark('World Bank API', true)
      const d = {}; for (const x of rows) if (x.value != null) (d[x.countryiso3code] = d[x.countryiso3code] || []).push([x.date, x.value])
      for (const k of Object.keys(d)) d[k].sort((a, b) => a[0] < b[0] ? -1 : 1)
      m.worldbank[ind] = { name: nm, lastUpdated: r[0].lastupdated, data: d, url: `https://data.worldbank.org/indicator/${ind}`, api: `https://api.worldbank.org/v2/country/all/indicator/${ind}?format=json` }
    } catch (e) { if (e.aborted) throw e; status.mark('World Bank API', false, `${ind}: ${e.message}`) }
  }
  for (const [ind, nm] of Object.entries(IMF_IND)) {
    ctx.progress('宏观', i++ / m.attempted, 'IMF ' + ind)
    try {
      const r = await http.json(`https://www.imf.org/external/datamapper/api/v1/${ind}`, { breakerKey: 'imf' }); const vals = r.values[ind]; if (!vals) throw new Error('无 values'); status.mark('IMF DataMapper', true)
      const data = {}; for (const k of countries) if (vals[k]) data[k] = Object.entries(vals[k]).filter(([y]) => +y >= 2015).map(([y, v]) => [y, v]).sort((a, b) => a[0] < b[0] ? -1 : 1)
      m.imf[ind] = { name: nm, data, url: `https://www.imf.org/external/datamapper/${ind}`, api: `https://www.imf.org/external/datamapper/api/v1/${ind}`, note: 'IMF《世界经济展望》，当年及以后为预测值' }
    } catch (e) { if (e.aborted) throw e; status.mark('IMF DataMapper', false, `${ind}: ${e.message}`) }
  }
  for (const [s, nm] of Object.entries(FRED)) {
    ctx.progress('宏观', i++ / m.attempted, 'FRED ' + s)
    try {
      const b = await http.text('https://fred.stlouisfed.org/graph/fredgraph.csv', { params: { id: s }, breakerKey: 'fred', timeout: 60000 })
      const lines = b.trim().split(/\r?\n/).slice(1); if (lines.length < 12) throw new Error('数据过短'); status.mark('FRED', true)
      const mm = new Map()
      for (const l of lines) { const [d, v] = l.split(','); if (!v || v === '.' || d < '2016-01-01') continue; const x = parseFloat(v); if (!isFinite(x)) continue; mm.set(d.slice(0, 7), [d, x]) }
      m.fred[s] = { name: nm, data: [...mm.values()], url: `https://fred.stlouisfed.org/series/${s}` }
    } catch (e) { if (e.aborted) throw e; status.mark('FRED', false, `${s}: ${e.message}`) }
  }
  status.skip('国家统计局 data.stats.gov.cn', '本地更新器未接入（该站需会话/反爬，助手侧也已连续失败）')
  out.macro = m
}

async function trade(ctx) {
  const { http, status, out } = ctx
  let p2
  try {
    const ref = (await http.json('https://comtradeapi.un.org/files/v1/app/reference/partnerAreas.json', { breakerKey: 'comtrade' })).results
    p2 = {}; for (const r of ref) p2[r.PartnerCode] = [r.PartnerCodeIsoAlpha3, r.PartnerDesc, r.isGroup]; p2[490] = ['TWN', 'Taiwan (Other Asia, nes)', false]
  } catch (e) { if (e.aborted) throw e; status.mark('UN Comtrade', false, 'reference ' + e.message); out.trade = null; return }
  const res = { hs: HS, flows: [], totals: {} }; const y0 = new Date().getUTCFullYear(); let n = 0, tot = Object.keys(HS).length * Object.keys(REPORTERS).length, ok = 0
  for (const hs of Object.keys(HS)) for (const [rc, iso] of Object.entries(REPORTERS)) {
    ctx.progress('贸易', n++ / tot, `Comtrade HS ${hs} ${iso}`)
    let got = null
    for (const yr of [y0 - 1, y0 - 2]) {
      try {
        const r = await http.json('https://comtradeapi.un.org/public/v1/preview/C/A/HS', { params: { reporterCode: rc, period: yr, cmdCode: hs, flowCode: 'X' }, breakerKey: 'comtrade', tries: 2 })
        if (r.data && r.data.length) { got = [yr, r.data]; break }
      } catch (e) { if (e.aborted) throw e; status.mark('UN Comtrade', false, `${hs}/${iso}: ${e.message}`); if (e.circuit) break }
    }
    if (!got) {   // 本轮取不到（限流/无数据）：沿用旧数据中该「商品×出口国」的记录，不丢失
      const old = ctx.macro?.trade; if (old) { for (const f of old.flows || []) if (f.hs === hs && f.from === iso) res.flows.push(f); const t = old.totals?.[hs]?.[iso]; if (t) (res.totals[hs] = res.totals[hs] || {})[iso] = t; res.kept = (res.kept || 0) + 1 }
      continue
    }
    status.mark('UN Comtrade', true); ok++
    let [yr, rows] = got
    rows = rows.filter(x => [0, null, undefined].includes(x.motCode) && ['C00', null, undefined].includes(x.customsCode) && [0, null, undefined].includes(x.partner2Code))
    const world = rows.filter(x => x.partnerCode === 0)
    if (world.length) (res.totals[hs] = res.totals[hs] || {})[iso] = { year: yr, value: world[0].primaryValue }
    const ps = rows.filter(x => x.partnerCode !== 0 && !(p2[x.partnerCode] || [0, 0, true])[2]).sort((a, b) => b.primaryValue - a.primaryValue)
    for (const x of ps.slice(0, 12)) { const pi = p2[x.partnerCode] || [null, String(x.partnerCode), false]; if (!pi[0]) continue; res.flows.push({ hs, year: yr, from: iso, to: pi[0], toName: pi[1], value: x.primaryValue }) }
  }
  res.source = cite('UN Comtrade（公开预览 API）', 'https://comtradeplus.un.org/TradeFlow', { note: '出口方申报口径 FOB 美元；台湾以 490 "Other Asia, nes" 申报' })
  res.__ok = ok; res.__attempted = tot
  out.trade = res
}

async function prices(ctx) {
  const { http, status, out } = ctx
  try {
    const html = await http.text('https://www.worldbank.org/en/research/commodity-markets', { breakerKey: 'wbps' })
    const mm = html.match(/https:\/\/thedocs\.worldbank\.org\/[^"]*CMO-Historical-Data-Monthly\.xlsx/); if (!mm) throw new Error('页面中未找到 Pink Sheet 链接')
    const url = mm[0]; const buf = await http.bin(url, { breakerKey: 'wbps', timeout: 120000 }); status.mark('World Bank Pink Sheet', true)
    const XLSX = require('xlsx'); const wb = XLSX.read(buf, { type: 'buffer' }); const ws = wb.Sheets['Monthly Prices']; if (!ws) throw new Error('无 Monthly Prices 表')
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
    const hi = rows.findIndex(r => r && (r[0] == null || r[0] === '') && r[1] && String(r[1]).includes('Crude')); if (hi < 0) throw new Error('未找到表头行')
    const names = rows[hi], units = rows[hi + 1]
    const want = { Copper: '铜', Aluminum: '铝', Nickel: '镍', Silver: '白银', Tin: '锡', Zinc: '锌', Lead: '铅', 'Natural gas, Europe': '欧洲天然气', 'Crude oil, Brent': '布伦特原油', 'Iron ore, cfr spot': '铁矿石', 'Coal, Australian': '澳洲动力煤' }
    const comm = {}
    names.forEach((n, j) => {
      if (!n) return; n = String(n).trim(); if (!want[n]) return
      const ser = rows.slice(hi + 2).filter(r => r && r[0] && typeof r[j] === 'number' && String(r[0]) >= '2018').map(r => [String(r[0]), r[j]])
      comm[n] = { zh: want[n], unit: String(units[j]).trim(), data: ser }
    })
    if (Object.keys(comm).length < 6) throw new Error('解析到的品种过少')
    out.prices = { commodities: comm, source: cite('World Bank Commodity Price Data (Pink Sheet)', url), missing: { 碳酸锂: '无可直接引用的免费公开 API（SMM/上海有色、广期所需授权）', 多晶硅: '无可直接引用的免费公开 API（PVInsights/InfoLink 需订阅）', 钴: 'World Bank Pink Sheet 未收录' } }
  } catch (e) { if (e.aborted) throw e; status.mark('World Bank Pink Sheet', false, e.message); out.prices = null }
}
async function run(ctx) {
  await macro(ctx); await trade(ctx); await prices(ctx)
}
module.exports = { run, macro, trade, prices }
