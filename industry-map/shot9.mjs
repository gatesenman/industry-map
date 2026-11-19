import { chromium } from 'playwright'
const V='v09'
const b=await chromium.launch({args:['--use-gl=swiftshader']}); let p
const errs=[]; const U='http://localhost:4173/'
const go=async(h,f,w=3000)=>{ try{await p?.close()}catch{}; p=await b.newPage({viewport:{width:1680,height:980}}); p.setDefaultTimeout(120000)
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))}); p.on('pageerror',e=>errs.push(String(e).slice(0,200)))
  await p.goto(U+'#'+h,{timeout:120000}); await p.waitForTimeout(w); if(f) await p.screenshot({path:`screenshots/${V}-${f}.png`,timeout:120000}) }
await go('ind=semi&view=network&sel=c:nvidia','01-network-pathbar',4000)
await p.keyboard.press('Shift+Slash'); await p.waitForTimeout(800)
await p.screenshot({path:`screenshots/${V}-02-help.png`,timeout:120000})
await p.keyboard.press('Escape'); await p.waitForTimeout(400)
await go('ind=pharma&view=overview','03-pharma',2500)
await go('ind=ess&view=table','04-ess-table',2500)
console.log('ERRORS',JSON.stringify(errs)); await b.close()
