import { chromium } from 'playwright'
const V=process.argv[2]||'v14pre'
const b=await chromium.launch({args:['--use-gl=swiftshader']}); let p
const errs=[]; const U='http://localhost:4173/'
const go=async(h,f,w=3500)=>{ try{await p?.close()}catch{}; p=await b.newPage({viewport:{width:1680,height:980}}); p.setDefaultTimeout(120000)
  await p.addInitScript(()=>{ if(!sessionStorage.getItem('keepTour')) localStorage.setItem('tourDone','1') })
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))}); p.on('pageerror',e=>errs.push(String(e).slice(0,200)))
  await p.goto(U+'#'+h,{timeout:120000}); await p.waitForTimeout(w); if(f) await p.screenshot({path:`screenshots/${V}-${f}.png`,timeout:120000}) }
const views=(process.argv[3]||'overview,flow,network,analysis').split(',')
for(const v of views) await go(`ind=pv&view=${v}&sel=c:longi`,v,3500)
if(process.argv[4]==='tour'){ try{await p?.close()}catch{}; p=await b.newPage({viewport:{width:1680,height:980}}); p.on('pageerror',e=>errs.push(String(e).slice(0,200))); await p.goto(U+'#ind=semi&view=overview'); await p.waitForTimeout(3000); await p.screenshot({path:`screenshots/${V}-tour.png`}) 
  await go('ind=semi&view=overview',null,2500); await p.keyboard.press('Control+k'); await p.keyboard.type('TSLA'); await p.waitForTimeout(600); await p.screenshot({path:`screenshots/${V}-search.png`}) }
console.log('ERRORS',JSON.stringify(errs)); await b.close()
