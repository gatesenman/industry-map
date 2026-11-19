import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1500,height:900}})
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push(String(e)))
const U='http://localhost:4173/'
const go=async(h,f)=>{ await p.goto(U+'#'+h); await p.reload(); await p.waitForTimeout(2500); await p.screenshot({path:'screenshots/'+f}) }
await go('page=overview','01-overview.png')
await go('page=work&ind=semi&view=流程&sel=s:foundry','02-flow-semi.png')
await go('page=work&ind=nev&view=网络&sel=c:catl','03-network-catl.png')
await go('page=work&ind=pv&view=地图','04-worldmap-pv.png')
for (const v of ['层级','规模','流向','表格']) await go(`page=work&ind=semi&view=${v}`, `x-${v}.png`)
await p.goto(U+'#page=overview'); await p.fill('input','HBM'); await p.waitForTimeout(500); await p.screenshot({path:'screenshots/05-search.png'})
console.log('ERRORS:',JSON.stringify(errs)); await b.close()
