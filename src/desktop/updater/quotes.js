'use strict'
// 行情：Yahoo Finance 公共图表接口（主）→ 东方财富 K 线（A股/港股/美股备用）。汇率：Yahoo。
const { pool } = require('./net')
const { SUF } = require('./util')

const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, '')
async function yahoo(http, sym, rng = '1y', itv = '1wk') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}`
  const j = await http.json(url, { params: { range: rng, interval: itv }, breakerKey: 'yahoo', tries: 2 })
  const r = j?.chart?.result?.[0]; if (!r) throw new Error('无数据')
  const m = r.meta, ts = r.timestamp || [], cl = r.indicators?.quote?.[0]?.close || []
  if (m.regularMarketPrice == null) throw new Error('无价格')
  const series = []; ts.forEach((t, i) => { if (cl[i] != null) series.push([new Date(t * 1000).toISOString().slice(0, 10), Math.round(cl[i] * 1e4) / 1e4]) })
  return { symbol: sym, price: m.regularMarketPrice, currency: m.currency, time: new Date((m.regularMarketTime || 0) * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    exchange: m.fullExchangeName, series, url: `https://finance.yahoo.com/quote/${sym}` }
}
const EM = { SSE: ['1', 'CNY'], 'SSE STAR': ['1', 'CNY'], SZSE: ['0', 'CNY'], BSE: ['0', 'CNY'], HKEX: ['116', 'HKD'], Nasdaq: ['105', 'USD'], NYSE: ['106', 'USD'] }
async function eastmoney(http, l) {
  const e = EM[l.exchange]; if (!e) throw new Error('东方财富不覆盖 ' + l.exchange)
  const code = l.exchange === 'HKEX' ? l.ticker.padStart(5, '0') : l.ticker
  const beg = new Date(Date.now() - 372 * 86400000)
  const j = await http.json('https://push2his.eastmoney.com/api/qt/stock/kline/get', { breakerKey: 'eastmoney', tries: 2,
    headers: { Referer: 'https://quote.eastmoney.com/', 'User-Agent': 'Mozilla/5.0' },
    params: { secid: `${e[0]}.${code}`, ut: 'fa5fd1943c7b386f172d6893dbfba10b', fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58', klt: 102, fqt: 0, beg: ymd(beg), end: '20500101' } })
  const ks = j?.data?.klines; if (!ks?.length) throw new Error('东方财富无K线')
  const series = ks.map(s => s.split(',')).map(a => [a[0], +a[2]]); const last = series[series.length - 1]
  return { symbol: l.yahoo, price: last[1], currency: e[1], time: last[0] + ' 15:00 CST', exchange: l.exchange, series, source: '东方财富行情', url: `https://quote.eastmoney.com/` }
}

async function run(ctx) {
  const { http, status, core, out } = ctx
  const comps = core.companies.filter(c => !c.delisted && (c.listings || []).length)
  ctx.progress('行情', 0, `抓取 ${comps.length} 家公司股价`)
  let done = 0
  const res = await pool(comps, 6, async c => {
    let q = null, err = ''
    for (const l of c.listings) {
      try { q = await yahoo(http, l.yahoo); status.mark('Yahoo Finance', true); break } catch (e) { err = `${l.yahoo}: ${e.message}`; if (e.aborted) throw e; status.mark('Yahoo Finance', false, err) }
    }
    if (!q) for (const l of c.listings) {
      if (!EM[l.exchange]) continue
      try { q = await eastmoney(http, l); status.mark('东方财富行情', true); break } catch (e) { if (e.aborted) throw e; status.mark('东方财富行情', false, `${l.exchange}:${l.ticker} ${e.message}`) }
    }
    if (++done % 20 === 0) ctx.progress('行情', done / comps.length, `${done}/${comps.length}`)
    return [c.id, q]
  }, ctx.signal)
  const quotes = {}; for (const r of res) if (Array.isArray(r) && r[1]) quotes[r[0]] = r[1]
  out.quotes = { data: quotes, attempted: comps.length }
  // 汇率
  const fx = {}
  for (const cur of ['CNY', 'TWD', 'JPY', 'KRW', 'EUR', 'HKD', 'GBP', 'CHF', 'AUD', 'CLP', 'CAD', 'SEK', 'SGD']) {
    try { const q = await yahoo(http, `USD${cur}=X`, '5d', '1d'); fx[cur] = { perUSD: q.price, time: q.time, url: q.url }; status.mark('Yahoo Finance', true) }
    catch (e) { if (e.aborted) throw e; status.mark('Yahoo Finance', false, 'FX ' + cur) }
  }
  out.fx = { data: fx, attempted: 13 }
}
module.exports = { run, yahoo, eastmoney }
