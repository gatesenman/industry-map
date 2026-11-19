'use strict'
const fs = require('fs'), path = require('path')
const { createClient } = require('./net')
const { Status, nowIso, clone } = require('./util')
const { applyAll, guard } = require('./enrich')
const quotes = require('./quotes'), sec = require('./sec'), gleif = require('./gleif'), wikidata = require('./wikidata'), macro = require('./macro'), relations = require('./relations')

const DATA_FILES = ['core', 'micro', 'macro', 'sources', 'audit', 'changelog', 'commodities', 'filings', 'verification', 'versions']
const REQUIRED = ['core', 'micro', 'macro', 'sources']
const MAX_BACKUPS = 6
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return d } }
const writeJson = (p, o) => { fs.mkdirSync(path.dirname(p), { recursive: true }); const t = p + '.tmp'; fs.writeFileSync(t, JSON.stringify(o), 'utf8'); fs.renameSync(t, p) }
const rmrf = p => fs.rmSync(p, { recursive: true, force: true })

class Updater {
  constructor({ bundledDir, seedDir, userRoot, fetchImpl, appVersion = '0', log = () => {} }) {
    this.bundledDir = bundledDir; this.seedDir = seedDir; this.root = userRoot; this.fetchImpl = fetchImpl; this.appVersion = appVersion; this.log = log
    this.cur = path.join(userRoot, 'current'); this.bak = path.join(userRoot, 'backups'); this.running = false; this.ac = null
    fs.mkdirSync(userRoot, { recursive: true })
  }
  // ---------- 目录与状态 ----------
  bundledMeta() { return readJson(path.join(this.bundledDir, 'core.json'), {}).meta || {} }
  activeDir() {
    const mf = readJson(path.join(this.cur, 'manifest.json'), null)
    if (mf && REQUIRED.every(n => fs.existsSync(path.join(this.cur, n + '.json')))) {
      const b = this.bundledMeta()
      if (!b.generated || !mf.baseGenerated || b.generated <= mf.baseGenerated) return { dir: this.cur, kind: 'local', manifest: mf }
      return { dir: this.bundledDir, kind: 'bundled', stale: { local: mf, bundled: b.generated } }   // 程序升级后内置数据更新：忽略旧的本地数据
    }
    return { dir: this.bundledDir, kind: 'bundled' }
  }
  state() { return readJson(path.join(this.root, 'state.json'), null) || readJson(path.join(this.seedDir, 'state-seed.json'), {}) }
  settings() { return { autoCheck: 'daily', deepEveryDays: 7, rescanDays: 45, ...readJson(path.join(this.root, 'settings.json'), {}) } }
  setSettings(p) { const s = { ...this.settings(), ...p }; writeJson(path.join(this.root, 'settings.json'), s); return s }
  history() { return readJson(path.join(this.root, 'update-log.json'), []) }
  backups() {
    if (!fs.existsSync(this.bak)) return []
    return fs.readdirSync(this.bak).filter(d => fs.existsSync(path.join(this.bak, d, 'manifest.json'))).sort().reverse().map(d => { const m = readJson(path.join(this.bak, d, 'manifest.json'), {}); return { id: d, kind: m.kind, version: m.dataVersion, at: m.createdAt, note: m.note } })
  }
  status() {
    const a = this.activeDir(); const core = readJson(path.join(a.dir, 'core.json'), {}); const meta = core.meta || {}
    const sources = readJson(path.join(a.dir, 'sources.json'), {}); const hist = this.history()
    const b = this.bundledMeta()
    return { appVersion: this.appVersion, dataKind: a.kind, staleLocalIgnored: !!a.stale, dataVersion: meta.version, dataGenerated: meta.generated, bundledVersion: b.version, bundledGenerated: b.generated,
      lastLocalUpdate: meta.localUpdate || null, counts: { companies: (core.companies || []).length, relations: (core.relations || []).length, autoRelations: (core.relations || []).filter(r => r.auto).length },
      sources: sources.status || {}, sourcesGenerated: sources.generated, lastRun: hist[0] || null, history: hist.slice(0, 8).map(h => ({ id: h.id, ok: h.ok, finished: h.finished, summary: h.summary, aborted: h.aborted })),
      backups: this.backups(), settings: this.settings(), running: this.running, dataDir: this.root }
  }
  cancel() { if (this.ac) this.ac.abort() }

  // ---------- 更新 ----------
  async run({ only, deep = false, onProgress = () => {}, maxNewRelations, maxFilers } = {}) {
    if (this.running) throw new Error('已有更新在运行')
    this.running = true; this.ac = new AbortController()
    const t0 = Date.now(), started = nowIso(), id = started.replace(/[-:TZ]/g, '').slice(0, 14)
    const logs = []; const log = m => { logs.push(`${new Date().toISOString().slice(11, 19)} ${m}`); this.log(m) }
    const report = { id, started, appVersion: this.appVersion, deep: !!deep, ok: false, aborted: false, guard: [], warnings: [], logs, perSource: {}, changes: {} }
    try {
      const active = this.activeDir()
      const base = { core: readJson(path.join(active.dir, 'core.json'), null), micro: readJson(path.join(active.dir, 'micro.json'), {}), macro: readJson(path.join(active.dir, 'macro.json'), {}), sources: readJson(path.join(active.dir, 'sources.json'), {}) }
      if (!base.core?.companies?.length) throw new Error('基础数据损坏或缺失（core.json），已中止')
      report.baseVersion = base.core.meta?.version; report.baseKind = active.kind
      const seed = { aliases: readJson(path.join(this.seedDir, 'aliases.json'), {}), tombstones: readJson(path.join(this.seedDir, 'tombstones.json'), []), revenueOverrides: readJson(path.join(this.seedDir, 'revenue_overrides.json'), {}) }
      const state = clone(this.state()); const status = new Status(); const http = createClient({ fetchImpl: this.fetchImpl, signal: this.ac.signal })
      const want = n => !only || only.includes(n)
      const sett = this.settings(); const ctx = { http, status, core: base.core, micro: base.micro, macro: base.macro, out: {}, state, seed, deep, signal: this.ac.signal, maxNewRelations, maxFilers, rescanDays: sett.rescanDays || 45, rotateBudget: deep ? 200 : 25,
        progress: (phase, pct, msg) => { onProgress({ phase, pct, message: msg }); if (msg && !/^\d+\/\d+/.test(msg)) log(`[${phase}] ${msg}`) } }
      const phases = [['quotes', () => quotes.run(ctx)], ['sec', () => sec.run(ctx)], ['gleif', () => gleif.run(ctx)], ['wikidata', () => wikidata.run(ctx)], ['macro', () => macro.run(ctx)], ['relations', () => relations.run(ctx)]]
      for (const [name, fn] of phases) {
        if (!want(name) && !(name === 'sec' && want('relations'))) continue
        if (this.ac.signal.aborted) break
        try { await fn() } catch (e) { if (e.aborted) { report.aborted = true; break } status.mark(name, false, e.message); log(`[${name}] 失败：${e.message}`) }
      }
      if (report.aborted) throw Object.assign(new Error('已取消'), { aborted: true })
      onProgress({ phase: '合并', pct: 0.95, message: '合并并校验' })
      const cand = applyAll({ base, out: ctx.out, status, seed })
      report.warnings = cand.warnings; report.changes = cand.changes
      if (!Object.keys(cand.applied).length && !cand.changes.newRelations) { report.summary = '未写入：本轮所有数据源均未取得可用数据（可能离线或被网络拦截），现有数据保持不变'; log(report.summary); throw Object.assign(new Error('noop'), { noop: true }) }
      const at = nowIso()
      cand.core.meta = { ...cand.core.meta, lastRefresh: at, localUpdate: { at, id, appVersion: this.appVersion, baseVersion: base.core.meta?.version, baseKind: active.kind, changes: cand.changes } }
      const prevSources = base.sources?.status || {}; const st = { ...prevSources }
      for (const [k, v] of Object.entries(status.s)) { if (v.skipped) { st[k] = { ok: 0, fail: 0, detail: v.detail, checked: at, local: true, skipped: true }; continue } st[k] = { ok: v.ok, fail: v.fail, detail: v.detail, checked: at, local: true } }
      cand.sources = { generated: at, status: st, elapsed_s: Math.round((Date.now() - t0) / 100) / 10, local: true }
      report.perSource = Object.fromEntries(Object.entries(status.s).map(([k, v]) => [k, { ...v }]))
      report.guard = guard(base, cand)
      if (report.guard.length) { report.summary = '已中止：保护闸触发，未写入任何数据'; log('GUARD ABORT: ' + report.guard.join('；')); throw Object.assign(new Error('guard'), { guard: true }) }
      // ---- 提交：备份 → 暂存 → 原子替换 ----
      const stage = path.join(this.root, 'staging'); rmrf(stage); fs.mkdirSync(stage, { recursive: true })
      for (const n of DATA_FILES) { const src = path.join(active.dir, n + '.json'); if (fs.existsSync(src)) fs.copyFileSync(src, path.join(stage, n + '.json')) }
      writeJson(path.join(stage, 'core.json'), cand.core); writeJson(path.join(stage, 'micro.json'), cand.micro); writeJson(path.join(stage, 'macro.json'), cand.macro); writeJson(path.join(stage, 'sources.json'), cand.sources)
      const bm = this.bundledMeta()
      writeJson(path.join(stage, 'manifest.json'), { kind: 'local', createdAt: at, runId: id, appVersion: this.appVersion, baseVersion: bm.version, baseGenerated: bm.generated, dataVersion: cand.core.meta.version })
      for (const n of REQUIRED) JSON.parse(fs.readFileSync(path.join(stage, n + '.json'), 'utf8'))   // 回读校验
      const bid = id
      if (active.kind === 'local') { fs.mkdirSync(this.bak, { recursive: true }); fs.cpSync(this.cur, path.join(this.bak, bid), { recursive: true }); const m = readJson(path.join(this.bak, bid, 'manifest.json'), {}); writeJson(path.join(this.bak, bid, 'manifest.json'), { ...m, note: '更新前的本地数据' }) }
      else { fs.mkdirSync(path.join(this.bak, bid), { recursive: true }); writeJson(path.join(this.bak, bid, 'manifest.json'), { kind: 'bundled', createdAt: at, dataVersion: base.core.meta?.version, note: '内置数据（回滚到此 = 删除本地更新）' }) }
      const old = this.cur + '.old'; rmrf(old); if (fs.existsSync(this.cur)) fs.renameSync(this.cur, old); fs.renameSync(stage, this.cur); rmrf(old)
      writeJson(path.join(this.root, 'state.json'), ctx.state)
      const bks = this.backups(); for (const b of bks.slice(MAX_BACKUPS)) rmrf(path.join(this.bak, b.id))
      report.ok = true
      const c = cand.changes
      report.summary = `股价 ${c.quotes}｜汇率 ${c.fx}｜SEC ${c.sec}｜GLEIF ${c.gleif}｜市值变动 ${c.marketCap}｜营收变动 ${c.revenue}｜宏观序列 ${c.macroSeries}｜贸易流向 ${c.tradeFlows}｜大宗品种 ${c.commodities}｜Wikidata 字段 ${c.wikidataFields}｜新增自动关系 ${c.newRelations}`
    } catch (e) {
      if (e.aborted) { report.aborted = true; report.summary = '已取消，未写入任何数据' }
      else if (!e.guard && !e.noop) { report.error = e.message; report.summary = '失败：' + e.message; log('ERROR ' + (e.stack || e.message)) }
    } finally {
      report.finished = nowIso(); report.durationSec = Math.round((Date.now() - t0) / 1000); report.requests = undefined
      this.running = false; this.ac = null
      const h = this.history(); h.unshift({ ...report, logs: logs.slice(-300) }); writeJson(path.join(this.root, 'update-log.json'), h.slice(0, 20))
    }
    return report
  }

  // ---------- 回滚 ----------
  rollback(backupId) {
    if (this.running) throw new Error('更新运行中，无法回滚')
    const list = this.backups(); const b = backupId ? list.find(x => x.id === backupId) : list[0]
    if (!b) throw new Error('没有可回滚的备份')
    const dir = path.join(this.bak, b.id); const m = readJson(path.join(dir, 'manifest.json'), {})
    const old = this.cur + '.old'; rmrf(old)
    if (fs.existsSync(this.cur)) fs.renameSync(this.cur, old)
    if (m.kind === 'bundled') { /* 删除本地数据 → 回到内置 */ } else { fs.cpSync(dir, this.cur, { recursive: true }) }
    rmrf(old)
    rmrf(dir)   // 被还原的备份即消耗
    const h = this.history(); h.unshift({ id: nowIso().replace(/[-:TZ]/g, '').slice(0, 14), ok: true, rollback: b.id, finished: nowIso(), summary: `已回滚到备份 ${b.id}（${m.kind === 'bundled' ? '内置数据' : '本地数据 ' + (m.dataVersion || '')}）` }); writeJson(path.join(this.root, 'update-log.json'), h.slice(0, 20))
    return { restored: b }
  }
  reset() {
    if (this.running) throw new Error('更新运行中')
    rmrf(this.cur); rmrf(path.join(this.root, 'state.json'))
    const h = this.history(); h.unshift({ id: nowIso().replace(/[-:TZ]/g, '').slice(0, 14), ok: true, finished: nowIso(), summary: '已恢复为内置数据（本地更新已清除，备份保留）' }); writeJson(path.join(this.root, 'update-log.json'), h.slice(0, 20))
    return { ok: true }
  }
  // 是否到了自动更新时间
  dueForAuto() {
    const s = this.settings(); if (s.autoCheck === 'off') return false
    const last = this.history().find(h => h.ok && h.summary && !h.rollback && !h.deep); const lastAt = last?.finished ? Date.parse(last.finished) : 0
    const gap = s.autoCheck === 'startup' ? 6 * 3600e3 : 24 * 3600e3
    return Date.now() - lastAt > gap
  }
  dueForDeep() {
    const s = this.settings(); if (s.autoCheck === 'off') return false
    const days = Number(s.deepEveryDays); if (!days || days <= 0) return false
    const last = this.history().find(h => h.ok && h.deep); const lastAt = last?.finished ? Date.parse(last.finished) : 0
    return Date.now() - lastAt > days * 86400e3
  }
  // 供 main 进程静态服务：某数据文件应读取的路径
  resolveFile(name) { const a = this.activeDir(); const p = path.join(a.dir, name + '.json'); return fs.existsSync(p) ? p : path.join(this.bundledDir, name + '.json') }
}
module.exports = { Updater, DATA_FILES }
