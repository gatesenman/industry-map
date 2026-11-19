'use strict'
// 无头测试入口（Linux/Windows 均可）：node updater/cli.js --bundled <dir> --seed <dir> --user <dir> [--only quotes,sec] [--deep]
const path = require('path'); const { Updater } = require('./index')
const a = process.argv.slice(2); const arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d }
const u = new Updater({ bundledDir: path.resolve(arg('bundled')), seedDir: path.resolve(arg('seed')), userRoot: path.resolve(arg('user')), appVersion: arg('app', 'cli'), log: m => process.stderr.write(m + '\n') })
if (a.includes('--rollback')) { console.log(JSON.stringify(u.rollback(), null, 1)); process.exit(0) }
if (a.includes('--status')) { console.log(JSON.stringify(u.status(), null, 1)); process.exit(0) }
u.run({ only: arg('only') ? arg('only').split(',') : undefined, deep: a.includes('--deep'), maxFilers: arg('max-filers') ? +arg('max-filers') : undefined, onProgress: () => {} }).then(r => {
  console.log('\n' + JSON.stringify({ ok: r.ok, summary: r.summary, guard: r.guard, warnings: r.warnings, perSource: r.perSource, changes: r.changes, durationSec: r.durationSec, error: r.error }, null, 1)); process.exit(r.ok ? 0 : 1)
})
