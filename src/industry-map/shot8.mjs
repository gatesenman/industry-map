import { chromium } from 'playwright'
const V='v08'
const b=await chromium.launch({args:['--use-gl=swiftshader']}); let p
const errs=[]; const U='http://localhost:4173/'
const go=async(h,f,w=3500)=>{ try{await p?.close()}catch{}; p=await b.newPage({viewport:{width:1680,height:980}}); p.setDefaultTimeout(120000)
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))}); p.on('pageerror',e=>errs.push(String(e).slice(0,200)))
  await p.goto(U+'#'+h,{timeout:120000}); await p.waitForTimeout(w); if(f) await p.screenshot({path:`screenshots/${V}-${f}.png`,timeout:120000}) }
await go('ind=pharma&view=overview','01-pharma-overview',3500)
await go('ind=ess&view=overview','02-ess-overview',3500)
await go('ind=pharma&view=network','03-pharma-network',4000)
await go('ind=ess&view=table','04-ess-table',3000)
console.log('ERRORS',JSON.stringify(errs)); await b.close()
