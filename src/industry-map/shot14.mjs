import { chromium } from 'playwright'
const V='v17'
const b=await chromium.launch({args:['--use-gl=swiftshader']}); const errs=[]
const p=await b.newPage({viewport:{width:1680,height:980}}); p.setDefaultTimeout(60000)
await p.addInitScript(()=>localStorage.setItem('tourDone','1'))
p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))}); p.on('pageerror',e=>errs.push(String(e).slice(0,200)))
await p.goto('http://localhost:4173/#ind=semi&view=table'); await p.waitForTimeout(3000)
await p.screenshot({path:`screenshots/${V}-table-fieldsrc.png`})
await p.getByText(/^关系（/).click(); await p.waitForTimeout(500); await p.locator('td.evh').nth(2).hover(); await p.waitForTimeout(400)
await p.screenshot({path:`screenshots/${V}-table-evidence.png`})
await p.getByText(/^公司（/).click(); await p.waitForTimeout(400); await p.locator('td span.link',{hasText:'英伟达'}).first().click(); await p.waitForTimeout(1500)
const ins=p.locator('.insp'); await ins.evaluate(e=>{const h=[...e.querySelectorAll('h4')].find(x=>x.textContent.includes('SPLC')); h&&h.scrollIntoView()}); await p.waitForTimeout(400)
await p.screenshot({path:`screenshots/${V}-inspector-splc.png`})
await ins.evaluate(e=>{const h=[...e.querySelectorAll('h4')].find(x=>x.textContent.includes('N 层')); h&&h.scrollIntoView()}); await p.waitForTimeout(400)
await p.screenshot({path:`screenshots/${V}-inspector-tier.png`})
await p.locator('.insp button',{hasText:'网络'}).first().click(); await p.waitForTimeout(6000)
await p.screenshot({path:`screenshots/${V}-network.png`})
console.log('ERRORS',JSON.stringify(errs)); await b.close()
