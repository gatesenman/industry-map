const { contextBridge, ipcRenderer } = require('electron')
const inv = (ch, ...a) => ipcRenderer.invoke(ch, ...a)
contextBridge.exposeInMainWorld('industryDesktop', {
  isDesktop: true,
  status: () => inv('upd:status'),
  lastReport: () => inv('upd:lastReport'),
  run: opts => inv('upd:run', opts),
  cancel: () => inv('upd:cancel'),
  rollback: id => inv('upd:rollback', id),
  reset: () => inv('upd:reset'),
  setSettings: s => inv('upd:setSettings', s),
  openDataDir: () => inv('upd:openDir'),
  reload: () => inv('upd:reload'),
  on: (ev, cb) => { const h = (_e, p) => cb(p); ipcRenderer.on('upd:' + ev, h); return () => ipcRenderer.removeListener('upd:' + ev, h) },
})
