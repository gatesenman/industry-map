'use strict'
// 网络层：fetch 由外部注入（Electron 用 net.fetch，走系统代理；测试用 Node 全局 fetch）
// 内置：超时、重试（429/5xx/网络错误）、按主机限速、熔断（同一数据源连续失败后停止，避免被封网时空等）
const UA = 'GlobalIndustryMap research@gaosichun.dev'

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function createClient({ fetchImpl, ua = UA, timeoutMs = 45000, signal } = {}) {
  const f = fetchImpl || globalThis.fetch
  const lastAt = {}            // host -> last request time
  const gap = { 'sec.gov': 130, 'comtradeapi.un.org': 1100, 'query.wikidata.org': 900, 'api.gleif.org': 60 }
  const breaker = {}           // name -> consecutive failures
  const BREAK_AT = 12
  const stats = { requests: 0, bytes: 0 }

  function hostGap(url) {
    const h = new URL(url).hostname
    for (const k of Object.keys(gap)) if (h === k || h.endsWith('.' + k)) return [k, gap[k]]
    return [h, 0]
  }
  async function throttle(url) {
    const [k, g] = hostGap(url); if (!g) return
    const now = Date.now(); const wait = Math.max(0, (lastAt[k] || 0) + g - now)
    lastAt[k] = now + wait; if (wait) await sleep(wait)
  }
  function withParams(url, params) {
    if (!params) return url
    const u = new URL(url); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v)); return u.toString()
  }
  async function request(url, { params, headers, as = 'json', tries = 3, timeout = timeoutMs, method = 'GET', body, breakerKey } = {}) {
    if (breakerKey && (breaker[breakerKey] || 0) >= BREAK_AT) { const e = new Error('熔断：该数据源连续失败，本轮已停止尝试'); e.circuit = true; throw e }
    const full = withParams(url, params); let last
    for (let i = 0; i < tries; i++) {
      if (signal?.aborted) { const e = new Error('已取消'); e.aborted = true; throw e }
      await throttle(full)
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeout)
      const onAbort = () => ac.abort(); signal?.addEventListener?.('abort', onAbort)
      try {
        stats.requests++
        const r = await f(full, { method, body, headers: { 'User-Agent': ua, ...(headers || {}) }, signal: ac.signal, redirect: 'follow' })
        if (r.status === 429 || r.status >= 500) { last = new Error('HTTP ' + r.status); await sleep(1500 * (i + 1)); continue }
        if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; if (r.status === 403 || r.status === 404 || r.status === 401) { if (breakerKey) breaker[breakerKey] = (breaker[breakerKey] || 0) + 1; throw e } last = e; await sleep(1000 * (i + 1)); continue }
        let out
        if (as === 'json') out = await r.json(); else if (as === 'text') out = await r.text(); else out = Buffer.from(await r.arrayBuffer())
        if (as === 'bin') stats.bytes += out.length
        if (breakerKey) breaker[breakerKey] = 0
        return out
      } catch (e) {
        if (signal?.aborted) { const x = new Error('已取消'); x.aborted = true; throw x }
        last = e.name === 'AbortError' ? new Error('超时 ' + Math.round(timeout / 1000) + 's') : e
        if (e.status === 403 || e.status === 404 || e.status === 401 || e.circuit) throw e
        await sleep(1200 * (i + 1))
      } finally { clearTimeout(t); signal?.removeEventListener?.('abort', onAbort) }
    }
    if (breakerKey) breaker[breakerKey] = (breaker[breakerKey] || 0) + 1
    throw last || new Error('请求失败')
  }
  return {
    json: (u, o) => request(u, { ...o, as: 'json' }), text: (u, o) => request(u, { ...o, as: 'text' }), bin: (u, o) => request(u, { ...o, as: 'bin' }),
    request, stats, breaker, sleep,
  }
}

// 简单并发池：保持输入顺序，单项失败不影响其它
async function pool(items, n, fn, signal) {
  const out = new Array(items.length); let i = 0
  async function worker() {
    while (i < items.length) {
      if (signal?.aborted) return
      const k = i++; try { out[k] = await fn(items[k], k) } catch (e) { out[k] = { __error: e } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker)); return out
}

module.exports = { createClient, pool, sleep, UA }
