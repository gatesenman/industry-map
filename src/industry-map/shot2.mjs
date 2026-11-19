import { chromium } from 'playwright'
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}); const p = await b.newPage({viewport:{width:1680,height:980}})
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,300))}); p.on('pageerror',e=>errs.push('PAGEERR '+String(e).slice(0,300)))
const U='http://localhost:4173/'
const views=(process.argv[2]??'overview,flow,network,map,globe,treemap,sankey,table,analysis,sources,tree').split(',')
for (const v of views){ const [view,extra]=v.split('|'); await p.goto(U+'#ind=semi&view='+view+(extra?'&'+extra:'')); await p.reload(); await p.waitForTimeout(view==='globe'?6000:3500); await p.screenshot({path:`screenshots/v02-${view}${extra?'-'+extra.replace(/[^a-z0-9]/gi,''):''}.png`}) }
console.log('ERRORS:',JSON.stringify(errs,null,1)); await b.close()
