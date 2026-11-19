import { useMemo, useState, useEffect, useRef } from 'react'
import { useSt, VIEWS, type ViewId } from './store'
import { cn2 } from './data'
export default function Palette(){
  const s=useSt(); const [q,setQ]=useState(''); const [i,setI]=useState(0); const inp=useRef<HTMLInputElement>(null)
  useEffect(()=>inp.current?.focus(),[])
  const items=useMemo(()=>{ const k=q.trim().toLowerCase(); const out:{tag:string;label:string;run:()=>void}[]=[]
    const cmds:[string,()=>void][]=[...VIEWS.map(([id,n])=>[`切换视图：${n}`,()=>s.setView(id as ViewId)] as [string,()=>void]),['切换深色/浅色主题',()=>s.setTheme(s.theme==='dark'?'light':'dark')],['分屏对比开/关',()=>s.setSplit(!s.split)],['清除选择',()=>s.setSel(null)],
      ...s.db.core.industries.map(x=>[`打开产业：${x.zh}`,()=>{s.setInd(x.id);s.setView('flow')}] as [string,()=>void])]
    cmds.forEach(([n,f])=>{ if(!k||n.toLowerCase().includes(k)) out.push({tag:'命令',label:n,run:f}) })
    if(k){ s.db.core.companies.forEach(c=>{ if((c.zh+c.en+c.ticker).toLowerCase().includes(k)) out.push({tag:'公司',label:`${c.zh} · ${c.en} · ${cn2(c.country)} ${c.ticker} · 质量 ${c.quality?.grade??'—'}`,run:()=>{ s.setInd(c.industries.includes(s.ind)?s.ind:c.industries[0]); s.setSel({kind:'company',id:c.id}); if(s.view==='overview') s.setView('network') }})
        ;[...c.products.map(p=>p.name),...(c.wd_products?.value??[])].forEach(p=>{ if(p.toLowerCase().includes(k)) out.push({tag:'产品',label:`${p} — ${c.zh}`,run:()=>s.setSel({kind:'company',id:c.id})}) }) })
      const nm=(id:string)=>s.db.COMP[id]; const parts=k.split(/\s*(?:->|→|>)\s*/)
      s.db.core.relations.forEach(r=>{ const a=nm(r.from),b=nm(r.to); if(!a||!b) return; const A=(a.zh+a.en+a.ticker).toLowerCase(),B=(b.zh+b.en+b.ticker).toLowerCase()
        const hit=parts.length>1&&parts[1]?A.includes(parts[0])&&B.includes(parts[1]):(A.includes(k)||B.includes(k))&&k.length>=2
        if(hit) out.push({tag:'关系',label:`${a.zh} → ${b.zh} · ${r.type} · ${r.grade??'—'}级`,run:()=>{ s.setInd(a.industries.includes(s.ind)?s.ind:a.industries[0]); s.setSel({kind:'company',id:a.id}); s.setView('network') }}) })
      s.db.core.segments.forEach(g=>{ if((g.name+g.sub).toLowerCase().includes(k)) out.push({tag:'环节',label:`${g.name}（${s.db.core.industries.find(x=>x.id===g.industry)?.zh} / ${g.sub}）`,run:()=>{s.setInd(g.industry);s.setSel({kind:'segment',id:g.id});if(s.view==='overview')s.setView('flow')}}) }) }
    const rank:Record<string,number>={公司:0,关系:1,环节:2,产品:3,命令:4}; if(k) out.sort((a,b)=>rank[a.tag]-rank[b.tag]); return out.slice(0,80) },[q])
  const go=(n:number)=>{ items[n]?.run(); s.setPalette(false) }
  return <div className="pal-bg" onClick={()=>s.setPalette(false)}><div className="pal" onClick={e=>e.stopPropagation()}>
    <input ref={inp} value={q} placeholder="输入公司、产品、环节或命令…（↑↓ 选择，Enter 执行，Esc 关闭）" onChange={e=>{setQ(e.target.value);setI(0)}}
      onKeyDown={e=>{ if(e.key==='ArrowDown'){e.preventDefault();setI(Math.min(i+1,items.length-1))} else if(e.key==='ArrowUp'){e.preventDefault();setI(Math.max(i-1,0))} else if(e.key==='Enter') go(i); else if(e.key==='Escape') s.setPalette(false) }}/>
    <div className="pal-list">{items.map((x,n)=><div key={n} className={n===i?'on':''} onMouseEnter={()=>setI(n)} onClick={()=>go(n)}><span className={'tag t-'+x.tag}>{x.tag}</span>{x.label}</div>)}
      {!items.length&&<div className="muted">无匹配</div>}</div></div></div>
}
