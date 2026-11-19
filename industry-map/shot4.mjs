import { chromium } from 'playwright'
const V=process.argv[2]||'v04'
const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}); let p
const errs=[]; const U='http://localhost:4173/'
const go=async(h,f,w=4000)=>{ try{await p?.close()}catch{}; p=await b.newPage({viewport:{width:1680,height:980}}); p.setDefaultTimeout(120000); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,300))}); p.on('pageerror',e=>errs.push('PAGEERR '+String(e).slice(0,300))); await p.goto(U+'#'+h,{timeout:120000}); await p.waitForTimeout(w); if(f) await p.screenshot({path:`screenshots/${V}-${f}.png`,timeout:120000}) }
await go('ind=semi&view=sources',null,5000)
await p.evaluate(()=>[...document.querySelectorAll('.dash h3')].find(h=>h.textContent.includes('数据验证'))?.scrollIntoView())
await p.waitForTimeout(500); await p.screenshot({path:`screenshots/${V}-01-verification.png`,timeout:120000})
await go('ind=nev&view=flow&sel=c:catl','02-catl-filing-top5',4500)
await p.evaluate(()=>{const e=document.querySelector('.insp'); if(e) e.scrollTop=400}); await p.waitForTimeout(400)
await p.screenshot({path:`screenshots/${V}-03-catl-inspector-split-country.png`,timeout:120000})
await go('ind=nev&view=table','04-table'); await p.click('text=/^关系（/'); await p.waitForTimeout(800); await p.screenshot({path:`screenshots/${V}-05-relations.png`,timeout:120000})
await go('ind=semi&view=network&v=1&sel=c:nvidia','06-verified-network',4500)
await go('ind=pv&view=analysis','07-analysis',3500)
for (const v of ['overview','flow','sources']) await go(`ind=semi&view=${v}`,null,2000)
console.log('ERRORS:',JSON.stringify(errs,null,1)); await b.close()
