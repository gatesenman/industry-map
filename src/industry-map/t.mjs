import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1680,height:980}})
p.on('pageerror',e=>console.log('ERR',String(e).slice(0,300))); p.on('console',m=>console.log(m.type(),m.text().slice(0,200)))
await p.goto('http://localhost:4173/#ind='+process.argv[2]+'&view='+process.argv[3]); await p.waitForTimeout(4000)
await p.screenshot({path:'/tmp/t.png',timeout:10000}); console.log('ok'); await b.close()
