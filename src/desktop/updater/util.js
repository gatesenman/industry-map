'use strict'
const ISO3 = { US: 'USA', CN: 'CHN', TW: 'TWN', JP: 'JPN', KR: 'KOR', NL: 'NLD', DE: 'DEU', FR: 'FRA', GB: 'GBR', CH: 'CHE', CL: 'CHL', AU: 'AUS', BE: 'BEL', IL: 'ISR', CA: 'CAN', ES: 'ESP', IT: 'ITA', SE: 'SWE', SG: 'SGP' }
const SUF = { TSE: '.T', TWSE: '.TW', TPEx: '.TWO', KRX: '.KS', SZSE: '.SZ', SSE: '.SS', 'SSE STAR': '.SS', HKEX: '.HK', BSE: '.BJ', XETRA: '.DE', 'Euronext Paris': '.PA', 'Euronext Amsterdam': '.AS', 'Euronext Brussels': '.BR', 'Euronext Milan': '.MI', BME: '.MC', ASX: '.AX', Nasdaq: '', NYSE: '', Santiago: '.SN', TSX: '.TO' }
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z')
const today = () => nowIso().slice(0, 10)
const cite = (source, url, extra = {}) => ({ source, url, retrieved: today(), ...extra })
const clone = o => JSON.parse(JSON.stringify(o))
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)

class Status {
  constructor() { this.s = {} }
  mark(name, ok, detail = '') {
    const x = this.s[name] || (this.s[name] = { ok: 0, fail: 0, detail: '' }); x[ok ? 'ok' : 'fail']++
    if (detail && !ok) x.detail = String(detail).slice(0, 160); else if (detail && ok && !x.detail) x.detail = ''
  }
  note(name, detail) { const x = this.s[name] || (this.s[name] = { ok: 0, fail: 0, detail: '' }); x.detail = detail }
  skip(name, detail) { this.s[name] = { ok: 0, fail: 0, detail, skipped: true } }
}

// 币种 → USD（与 refresh.py 同口径）
const CUR_MAP = { renminbi: 'CNY', 'New Taiwan dollar': 'TWD', 'Japanese yen': 'JPY', 'South Korean won': 'KRW', euro: 'EUR', 'Hong Kong dollar': 'HKD', 'pound sterling': 'GBP', 'Swiss franc': 'CHF', 'Australian dollar': 'AUD', 'Canadian dollar': 'CAD', 'Swedish krona': 'SEK', 'Chilean peso': 'CLP' }
function toUSD(v, cur, fx) {
  if (v == null) return null
  if (['USD', 'United States dollar', 'US dollar'].includes(cur)) return v
  const c = CUR_MAP[cur] || cur; const r = fx?.[c]?.perUSD
  return r ? v / r : null
}
module.exports = { ISO3, SUF, nowIso, today, cite, clone, days, Status, toUSD, CUR_MAP }
