import { chromium } from 'playwright'
const V='v06'
const b=await chromium.launch({args:['--use-gl=swiftshader']}); let p
const errs=[]; const U='http://localhost:4173/'
const go=async(h,f,w=3500)=>{ try{await p?.close()}catch{}; p=await b.newPage({viewport:{width:1680,height:980}}); p.setDefaultTimeout(120000)
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))}); p.on('pageerror',e=>errs.push(String(e).slice(0,200)))
  await p.goto(U+'#'+h,{timeout:120000}); await p.waitForTimeout(w); if(f) await p.screenshot({path:`screenshots/${V}-${f}.png`,timeout:120000}) }
await go('ind=semi&view=sources',null,4500)
await p.evaluate(()=>[...document.querySelectorAll('.dash h3')].find(h=>h.textContent.includes('数据验证'))?.scrollIntoView())
await p.waitForTimeout(400); await p.screenshot({path:`screenshots/${V}-01-verification.png`,timeout:120000})
await go('ind=semi&view=network&v=1&sel=c:nvidia','02-network',4000)
await go('ind=semi&view=table',null,2500); await p.click('text=/^关系（/'); await p.waitForTimeout(800)
await p.screenshot({path:`screenshots/${V}-03-relations.png`,timeout:120000})
await go('ind=nev&view=overview','04-overview',3000)
console.log('ERRORS',JSON.stringify(errs)); await b.close()
