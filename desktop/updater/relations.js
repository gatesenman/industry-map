'use strict'
// 关系发现（保守）：扫描 SEC 年报（10-K/20-F/40-F）正文，抽取点名目录内其他公司的
// 「竞争 / 供货 / 合资 / 授权」原句。只新增，不改动任何既有关系；新增项一律 grade=C、auto=true、待人工复核。
// 常态：优先扫描「有新 accession」的；同时按轮转把「超过 rescanDays 天未扫」或从未扫过的也纳入，
// 使图谱在无人值守时也能慢慢覆盖全部美股/ADR 申报公司，而不必依赖助手。
const { pool } = require('./net')
const { today } = require('./util')

const EXTRA = { tsmc: ['Taiwan Semiconductor Manufacturing', 'TSMC'], skhynix: ['SK hynix', 'SK Hynix'], catl: ['Contemporary Amperex', 'CATL'], lges: ['LG Energy Solution'], foxconn: ['Hon Hai', 'Foxconn'],
  nvidia: ['NVIDIA', 'Nvidia'], amd: ['Advanced Micro Devices', 'AMD'], ase: ['ASE Technology', 'ASE Group', 'Advanced Semiconductor Engineering'], samsung: ['Samsung Electronics'], ti: ['Texas Instruments'], st: ['STMicroelectronics'], gf: ['GlobalFoundries'] }
const STOP = new Set(['Flex', 'Stem', 'Arm', 'SCREEN', 'Screen', 'Lam', 'Senior', 'Lens', 'Fusion', 'Maxwell', 'Linde AG'])
const SAMSUNG_PLAIN = 'Samsung(?!\\s+(?:SDI|Display|Electro|Biologics|SDS|C&T|Heavy|Foundry|Bioepis))'
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function buildIndex(core, aliases) {
  const map = new Map()
  const add = (id, a) => { a = (a || '').trim(); if (!a || /[^\x20-\x7e]/.test(a) || STOP.has(a) || /^\d+$/.test(a)) return; if (!(a.length >= 4 || (a.length >= 3 && a === a.toUpperCase()))) return; if (!map.has(a)) map.set(a, id); else if (map.get(a) !== id) map.set(a, null) }
  for (const c of core.companies) {
    for (const a of aliases?.[c.id] || []) add(c.id, a); for (const a of EXTRA[c.id] || []) add(c.id, a)
    if (c.en) { add(c.id, c.en); add(c.id, c.en.replace(/\s*\(.*\)/, '').replace(/\s+(Inc\.?|Corp\.?|Corporation|Co\.?,? Ltd\.?|Ltd\.?|Group|Holdings?|Limited|plc|AG|SE|N\.V\.)$/i, '')) }
  }
  const pats = [...map.entries()].filter(([, id]) => id).sort((a, b) => b[0].length - a[0].length).map(([a, id]) => [esc(a), id])
  pats.push([SAMSUNG_PLAIN, 'samsung'])
  const re = new RegExp('\\b(' + pats.map(p => p[0]).join('|') + ')(?![\\w-])', 'g')
  const lookup = new Map([...map.entries()].filter(([, id]) => id)); lookup.set('Samsung', 'samsung')
  return { re, lookup }
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' }
function htmlText(s) {
  s = s.replace(/<ix:header>[\s\S]*?<\/ix:header>/gi, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
  return s.replace(/[\u00a0\s]+/g, ' ')
}
const COMP = /\bcompetitors?\b|\bcompet(?:e|es|ed|ing) (?:with|against|directly with)\b|\bcompetition (?:from|with)\b/i
const LEGAL = /antitrust|lawsuit|complaint|infring|litigation|alleg|court|regulat|monopol/i
const HYP = /\b(?:would|could|may|might|if)\b.{0,40}(?:shift|switch|consider)/i
const SUP = /\b(?:suppliers?|foundr(?:y|ies)|contract manufacturers?|sole[- ]source|procure[sd]?|purchase[sd]?\b[^.;]{0,80}\bfrom|rel(?:y|ies|iance) (?:on|upon)|manufactured by|fabricated by)\b/i
const CUSX = /\b(?:customers?|clients?)\b[^.;]{0,80}?\b(?:accounted for|represent(?:ed|s)?|includ(?:e|es|ed)|such as|were|comprised of)\b/i
const JV = /\b(?:joint ventures?|jointly (?:own|owned|formed)|equity (?:method )?investee|strategic (?:alliance|partnership))\b/i
const LIC = /\b(?:licen[cs]e[sd]?|licen[cs]ing|royalt(?:y|ies)|in[- ]licen[cs]ed|out[- ]licen[cs]ed)\b/i

function classify(sent, filerId, idx) {
  if (sent.length < 30 || sent.length > 600 || HYP.test(sent)) return []
  const comp = COMP.test(sent), sup = SUP.test(sent), cus = CUSX.test(sent), jv = JV.test(sent), lic = LIC.test(sent)
  if (!(comp || sup || cus || jv || lic)) return []
  const names = []; idx.re.lastIndex = 0; let m
  while ((m = idx.re.exec(sent))) { const id = idx.lookup.get(m[1]) || (/^Samsung/.test(m[1]) ? 'samsung' : null); if (id && id !== filerId) names.push({ id, pos: m.index }) }
  if (!names.length) return []
  const ids = [...new Map(names.map(n => [n.id, n])).values()]; if (ids.length > 12) return []
  const out = []
  if (comp && !sup && !LEGAL.test(sent) && !/\bnot (?:currently )?compet|no compet/i.test(sent)) { for (const n of ids) out.push({ type: '竞争', other: n.id, role: '*' }); return out }
  if (comp) return []
  if (sup) { const k = sent.search(SUP); for (const n of ids) if (n.pos >= k - 60 && n.pos <= k + 220) out.push({ type: '供货', other: n.id, role: 'buyer' }); if (out.length) return out }
  if (cus) { const mm = CUSX.exec(sent); const k = mm.index + mm[0].length; for (const n of ids) if (n.pos >= k - 12 && n.pos <= k + 240) out.push({ type: '供货', other: n.id, role: 'seller' }); if (out.length) return out }
  if (jv && !LEGAL.test(sent)) { for (const n of ids) out.push({ type: '合资', other: n.id, role: '*' }); return out }
  if (lic && !LEGAL.test(sent)) {
    // 粗分：filer 作为许可方还是被许可方难定，统一存 from=较小 id 的无向边，类型=授权
    for (const n of ids) out.push({ type: '授权', other: n.id, role: '*' }); return out
  }
  return out
}

function pickTodo(filings, state, { deep, rescanDays, maxFilers, rotateBudget }) {
  state.relScan = state.relScan || {}
  state.relScanAt = state.relScanAt || {}
  const now = Date.now()
  const ageMs = (rescanDays || 45) * 86400e3
  const entries = Object.entries(filings)
  const fresh = [], stale = [], seen = []
  for (const [id, f] of entries) {
    const acc = state.relScan[f.cik]
    const at = state.relScanAt[f.cik] ? Date.parse(state.relScanAt[f.cik]) : 0
    if (deep || acc !== f.accession) fresh.push([id, f, 0])
    else if (!at || now - at > ageMs) stale.push([id, f, at || 0])
    else seen.push([id, f, at])
  }
  // 优先：新申报 → 过期轮转（最久未扫优先）→ deep 时再扫其余
  stale.sort((a, b) => a[2] - b[2])
  let todo = [...fresh, ...stale]
  if (deep) todo = [...todo, ...seen.filter(x => !todo.includes(x))]
  // 去重保序
  const seenIds = new Set(); todo = todo.filter(([id]) => { if (seenIds.has(id)) return false; seenIds.add(id); return true })
  const budget = deep ? (maxFilers || 200) : Math.min(maxFilers || 80, (fresh.length) + (rotateBudget || 25))
  return { todo: todo.slice(0, budget), fresh: fresh.length, stale: stale.length, total: entries.length, pending: Math.max(0, todo.length - budget) }
}

async function run(ctx) {
  const { http, status, core, out, state, seed } = ctx
  const filings = out.secFilings || {}
  const idx = buildIndex(core, seed.aliases)
  const tomb = new Set([...(seed.tombstones || []), ...(state.rejectedRelations || [])])
  const exist = new Set(); for (const r of core.relations) { exist.add(`${r.from}>${r.to}>${r.type}`); if (r.type === '竞争' || r.type === '合资' || r.type === '授权') exist.add(`${r.to}>${r.from}>${r.type}`); if (r.type === '供货') exist.add(`${r.to}>${r.from}>${r.type}`) }
  const tombed = (a, b, t) => tomb.has(`${a}>${b}>${t}`) || tomb.has(`${b}>${a}>${t}`)
  const rescanDays = ctx.rescanDays || 45
  const { todo: scan, fresh, stale, total, pending } = pickTodo(filings, state, {
    deep: !!ctx.deep, rescanDays, maxFilers: ctx.maxFilers, rotateBudget: ctx.rotateBudget || 25
  })
  ctx.progress('关系发现', 0, `扫描 ${scan.length} 份年报（新申报 ${fresh}，轮转到期 ${stale}，目录共 ${total} 家有年报；本轮后仍待 ${pending}）`)
  const found = new Map(); let done = 0, failed = 0, bytes = 0, sentences = 0
  const scannedAt = new Date().toISOString()
  await pool(scan, 3, async ([id, f]) => {
    let html
    try { html = await http.text(f.url, { timeout: 150000, breakerKey: 'secdoc', tries: 2 }); status.mark('SEC 年报原文', true); bytes += html.length }
    catch (e) { if (e.aborted) throw e; failed++; status.mark('SEC 年报原文', false, `${id}: ${e.message}`); return }
    const text = htmlText(html); const sents = text.split(/(?<=[.;])\s+(?=[A-Z])/); sentences += sents.length
    for (const s of sents) for (const h of classify(s, id, idx)) {
      let from, to
      if (h.type === '供货') { [from, to] = h.role === 'buyer' ? [h.other, id] : [id, h.other] }
      else { [from, to] = id < h.other ? [id, h.other] : [h.other, id] }
      const key = `${from}>${to}>${h.type}`
      if (exist.has(key) || tombed(from, to, h.type) || found.has(key)) continue
      found.set(key, { _filer: f.cik, from, to, type: h.type, note: '本地更新器自动抽取（SEC 年报原文），待人工复核',
        status: '已引用', confidence: '低', grade: 'C', conf: 0.5, auto: true, review: '待人工复核', discovered: today(),
        evidence: [{ source: 'SEC EDGAR 年报原文（本地更新器自动抽取）', url: f.url, date: f.date, form: f.form, quote: s.trim().slice(0, 600), retrieved: today() }] })
    }
    state.relScan[f.cik] = f.accession
    state.relScanAt[f.cik] = scannedAt
    if (++done % 5 === 0) ctx.progress('关系发现', done / Math.max(scan.length, 1), `${done}/${scan.length}，候选 ${found.size}`)
  }, ctx.signal)
  const cap = ctx.maxNewRelations || 80
  const all = [...found.values()]
  const list = all.slice(0, cap)
  // 被上限挤掉的候选：撤回对应年报的「已扫描」标记，下次再扫
  const keptFilers = new Set(list.map(r => r._filer))
  for (const r of all.slice(cap)) {
    if (!keptFilers.has(r._filer) && !list.some(x => x._filer === r._filer)) {
      delete state.relScan[r._filer]; delete state.relScanAt[r._filer]
    }
  }
  for (const r of list) delete r._filer
  out.newRelations = { list, overflow: all.length - list.length, scanned: done, failed, pending, bytes, sentences, fresh, stale, total }
  status.note('SEC 年报原文', `扫描 ${done} 份（新 ${fresh}/轮转 ${stale}），候选 ${all.length}（采纳 ${list.length}）；仍待 ${pending}`)
}
module.exports = { run, classify, buildIndex, htmlText, pickTodo }
