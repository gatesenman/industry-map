const { app, BrowserWindow, protocol, net, Menu, shell, ipcMain } = require('electron')
const path = require('path'); const fs = require('fs'); const { pathToFileURL } = require('url')
const { Updater, DATA_FILES } = require('./updater')
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])
if (!app.requestSingleInstanceLock()) { app.quit() } else {
  let win, updater
  const send = (ev, p) => { try { if (win && !win.isDestroyed()) win.webContents.send('upd:' + ev, p) } catch {} }
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus() } })
  const trusted = e => { try { return (e.senderFrame?.url || e.sender.getURL()).startsWith('app://local/') } catch { return false } }
  async function runUpdate(opts = {}, auto = false) {
    if (updater.running) return { started: false, reason: '已有更新在运行' }
    send('started', { auto, deep: !!opts.deep })
    updater.run({ ...opts, onProgress: p => send('progress', p) }).then(r => send('done', { auto, id: r.id, ok: r.ok, aborted: r.aborted, summary: r.summary, guard: r.guard, warnings: r.warnings, changes: r.changes, durationSec: r.durationSec }), e => send('done', { auto, ok: false, summary: String(e.message || e) }))
    return { started: true }
  }
  app.whenReady().then(() => {
    const root = path.join(__dirname, 'web')
    const userRoot = path.join(app.getPath('userData'), 'industry-data')
    updater = new Updater({ bundledDir: path.join(root, 'data'), seedDir: path.join(__dirname, 'seed'), userRoot, fetchImpl: (u, o) => net.fetch(u, o), appVersion: app.getVersion(), log: m => { if (process.env.IM_DIAG) console.log('UPD', m) } })
    protocol.handle('app', async req => {
      let p = decodeURIComponent(new URL(req.url).pathname); if (p === '/' || !p) p = '/index.html'
      const m = p.match(/^\/data\/([a-z0-9_]+)\.json$/i)
      if (m && DATA_FILES.includes(m[1])) {
        const r = await net.fetch(pathToFileURL(updater.resolveFile(m[1])).toString()); const h = new Headers(r.headers); h.set('Cache-Control', 'no-store'); return new Response(r.body, { status: r.status, headers: h })
      }
      const f = path.normalize(path.join(root, p)); if (!f.startsWith(root)) return new Response('forbidden', { status: 403 })
      return net.fetch(pathToFileURL(f).toString())
    })
    const h = (ch, fn) => ipcMain.handle(ch, async (e, ...a) => { if (!trusted(e)) throw new Error('forbidden'); return fn(...a) })
    h('upd:status', () => updater.status())
    h('upd:lastReport', () => updater.history()[0] || null)
    h('upd:run', o => runUpdate({ deep: !!o?.deep, only: Array.isArray(o?.only) ? o.only.filter(x => typeof x === 'string') : undefined }))
    h('upd:cancel', () => { updater.cancel(); return true })
    h('upd:rollback', id => { const r = updater.rollback(typeof id === 'string' ? id : undefined); return { ...r, status: updater.status() } })
    h('upd:reset', () => { updater.reset(); return updater.status() })
    h('upd:setSettings', s => { const p = {}; if (['off', 'startup', 'daily'].includes(s?.autoCheck)) p.autoCheck = s.autoCheck; if (typeof s?.deepEveryDays === 'number' && s.deepEveryDays >= 0) p.deepEveryDays = s.deepEveryDays; if (typeof s?.rescanDays === 'number' && s.rescanDays >= 7) p.rescanDays = s.rescanDays; return updater.setSettings(p) })
    h('upd:openDir', () => shell.openPath(userRoot))
    h('upd:reload', () => { win.webContents.reloadIgnoringCache() })

    Menu.setApplicationMenu(null)
    win = new BrowserWindow({ width: 1440, height: 900, title: '全球产业链地图', icon: path.join(__dirname, 'icon.png'), backgroundColor: '#0b1220',
      webPreferences: { devTools: process.argv.includes('--devtools'), contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'preload.js') } })
    win.on('page-title-updated', e => e.preventDefault())
    win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' } })
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url) } })
    if (process.env.IM_DIAG) { const js = c => win.webContents.executeJavaScript(c).catch(e => console.log('JSERR', e.message))
      win.webContents.once('did-finish-load', () => { setTimeout(() => js(`[...document.querySelectorAll('.tab')].find(b=>b.textContent.includes('数据源'))?.click()`), 3000)
        if (process.env.IM_CLICK_UPDATE) setTimeout(() => js(`[...document.querySelectorAll('button')].find(b=>b.textContent==='更新数据')?.click()`), 5000) })
      ipcMain.on('diag-log', (_e, m) => console.log('RENDERER', m))
      win.webContents.on('console-message', (_e, lvl, msg) => console.log('CONSOLE', lvl, msg)); win.webContents.on('did-finish-load', () => setTimeout(async () => { const img = await win.webContents.capturePage(); fs.writeFileSync(process.env.IM_DIAG, img.toPNG()); console.log('SHOT_DONE'); if (!process.env.IM_KEEP) app.quit() }, +(process.env.IM_SHOT_MS || 8000))) }
    win.loadURL('app://local/index.html')
    // 自动更新：启动 10 秒后检查是否到期（默认每日一次，可在「数据更新」面板关闭）。失败/离线不影响使用。
    win.webContents.once('did-finish-load', () => setTimeout(() => { try { if (process.env.IM_NOAUTO) return; if (updater.dueForDeep()) runUpdate({ deep: true }, true); else if (updater.dueForAuto()) runUpdate({}, true) } catch {} }, 10000))
  })
  app.on('window-all-closed', () => app.quit())
}
