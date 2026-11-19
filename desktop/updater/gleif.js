'use strict'
const { pool } = require('./net')
async function run(ctx) {
  const { http, status, core, out } = ctx
  const items = core.companies.filter(c => c.lei?.value).map(c => [c.id, c.lei.value])
  ctx.progress('GLEIF', 0, `核对 ${items.length} 个 LEI`)
  const res = await pool(items, 6, async ([cid, lei]) => {
    try {
      const r = await http.json(`https://api.gleif.org/api/v1/lei-records/${lei}`, { breakerKey: 'gleif' }); const a = r.data.attributes; const e = a.entity; status.mark('GLEIF', true)
      return [cid, { lei, legalName: e.legalName.name, jurisdiction: e.jurisdiction, status: e.status, hqCity: e.headquartersAddress?.city, hqCountry: e.headquartersAddress?.country, registration: a.registration?.status, url: `https://search.gleif.org/#/record/${lei}` }]
    } catch (e) { if (e.aborted) throw e; status.mark('GLEIF', false, `${cid}: ${e.message}`); return [cid, null] }
  }, ctx.signal)
  const data = {}; for (const r of res) if (Array.isArray(r) && r[1]) data[r[0]] = r[1]
  out.gleif = { data, attempted: items.length }
}
module.exports = { run }
