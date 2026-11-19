import { useEffect, useMemo, useRef, useState } from 'react'
import { Graph, regExport } from './g6util'
import { useSt, useSlice, exporters } from '../store'
import { REL_COLOR, cn2, TIER_COLOR } from '../data'
// 图：公司-公司（关系） + 公司-环节（归属） + 环节-环节（上下游）
export default function NetworkG6({ind,pane}:{ind:string;pane:string}){
  const s=useSt(); const sl=useSlice(ind); const el=useRef<HTMLDivElement>(null); const g=useRef<Graph|null>(null); const sref=useRef(s); sref.current=s
  const center0 = s.sel?.kind==='company'?s.sel.id : s.sel?.kind==='segment'? (sl.compsOf(s.sel.id)[0]?.id ?? 'tsmc') : (sl.rels[0]?.from ?? sl.comps[0]?.id)
  const [center,setCenter]=useState(center0); const [hops,setHops]=useState(1); const [withSeg,setWithSeg]=useState(false)
  const [extra,setExtra]=useState<Set<string>>(new Set()); const [path,setPath]=useState<string[]|null>(null); const [pathMsg,setPathMsg]=useState('')
  useEffect(()=>{ if(s.sel?.kind==='company'&&s.sel.id!==center){ setCenter(s.sel.id); setExtra(new Set()); setPath(null) } },[s.sel])
  const rels=useMemo(()=>s.db.core.relations.filter(r=>!s.f.citedOnly||r.status==='已引用'),[s.db,s.f.citedOnly])
  const adj=useMemo(()=>{ const m=new Map<string,{to:string;edge:string}[]>(); const add=(a:string,b:string,e:string)=>{ m.set(a,[...(m.get(a)??[]),{to:b,edge:e}]) }
    rels.forEach((r,i)=>{ add(r.from,r.to,'r'+i); add(r.to,r.from,'r'+i) })
    if(withSeg){ s.db.core.companies.forEach(c=>c.segments.forEach(x=>{ add(c.id,'s:'+x,`m:${c.id}:${x}`); add('s:'+x,c.id,`m:${c.id}:${x}`) }))
      s.db.core.segmentLinks.forEach(l=>{ add('s:'+l.from,'s:'+l.to,`l:${l.from}:${l.to}`); add('s:'+l.to,'s:'+l.from,`l:${l.from}:${l.to}`) }) }
    return m },[rels,withSeg])
  const findPath=(a:string,b:string)=>{ const prev=new Map<string,string>([[a,'']]); const q=[a]
    while(q.length){ const x=q.shift()!; if(x===b) break; for(const {to} of adj.get(x)??[]) if(!prev.has(to)){ prev.set(to,x); q.push(to) } }
    if(!prev.has(b)) return null; const p=[b]; while(prev.get(p[0])) p.unshift(prev.get(p[0])!); return p }
  useEffect(()=>{ const a=s.pathPair?.[0], b=s.pathPair?.[1]; if(a&&b&&a!==b){ const p=findPath(a,b); setPath(p); setCenter(a); setPathMsg(p?`路径 ${p.length-1} 步：`+p.map(x=>x.startsWith('s:')?`[${s.db.SEG[x.slice(2)].name}]`:s.db.COMP[x].zh).join(' → '):`${s.db.COMP[a]?.zh} 与 ${s.db.COMP[b]?.zh} 之间无路径`) } },[s.pathPair, withSeg]) // eslint-deps: findPath uses adj/withSeg
  const data=useMemo(()=>{ const ns=new Set<string>([center]); let frontier=[center]
    for(let h=0;h<hops;h++){ const nx:string[]=[]; frontier.forEach(x=>(adj.get(x)??[]).forEach(({to})=>{ if(!ns.has(to)){ ns.add(to); nx.push(to) } })); frontier=nx }
    extra.forEach(x=>{ ns.add(x); (adj.get(x)??[]).forEach(({to})=>ns.add(to)) }); path?.forEach(x=>ns.add(x))
    const nodes=[...ns].filter(id=>id.startsWith('s:')?!!s.db.SEG[id.slice(2)]:!!s.db.COMP[id]).map(id=>{ if(id.startsWith('s:')){ const x=s.db.SEG[id.slice(2)]; return {id,data:{kind:'seg',name:x.name,tier:x.tier}} }
      const c=s.db.COMP[id]; return {id,data:{kind:'comp',name:c.zh,country:c.country,center:id===center,inInd:c.industries.includes(ind),grade:c.quality.grade}} })
    const ids=new Set(nodes.map(n=>n.id)); const edges:any[]=[]; const seen=new Set<string>()
    ids.forEach(a=>(adj.get(a)??[]).forEach(({to,edge})=>{ if(ids.has(to)&&!seen.has(edge)){ seen.add(edge)
      if(edge.startsWith('r')){ const r=rels[+edge.slice(1)]; edges.push({id:edge,source:r.from,target:r.to,data:{kind:'rel',type:r.type,status:r.status,conf:r.confidence,ev:r.evidence.find((e:any)=>!e.rejected)??r.evidence[0],nev:r.evidence.filter((e:any)=>!e.rejected).length,grade:r.grade,note:r.note}}) }
      else if(edge.startsWith('m')){ const [,c,x]=edge.split(':'); edges.push({id:edge,source:c,target:'s:'+x,data:{kind:'member'}}) }
      else { const [,f,t]=edge.split(':'); edges.push({id:edge,source:'s:'+f,target:'s:'+t,data:{kind:'chain'}}) } } }))
    return {nodes,edges} },[center,hops,extra,path,adj,ind])
  useEffect(()=>{
    const dark=s.theme==='dark'; const fg=dark?'#e2e8f0':'#0f172a'
    const graph=new Graph({container:el.current!,autoFit:'view',theme:dark?'dark':'light',animation:true,padding:40,data,
      node:{type:(d:any)=>d.data.kind==='seg'?'diamond':'circle',style:{size:(d:any)=>d.data.center?54:d.data.kind==='seg'?26:34,
        fill:(d:any)=>d.data.kind==='seg'?TIER_COLOR[d.data.tier]:d.data.center?'#2563eb':d.data.inInd?'#475569':'#334155',stroke:(d:any)=>d.data.center?'#93c5fd':'#94a3b8',
        labelText:(d:any)=>d.data.name,labelFill:fg,labelFontSize:11,labelPlacement:'bottom',cursor:'pointer'},
        state:{path:{stroke:'#f59e0b',lineWidth:4,halo:true},active:{halo:true},inactive:{opacity:.2},selected:{stroke:'#f59e0b',lineWidth:3}}},
      edge:{type:'line',style:{stroke:(d:any)=>d.data.kind==='rel'?REL_COLOR[d.data.type]??'#94a3b8':'#64748b',lineWidth:(d:any)=>d.data.kind==='rel'?({A:3.5,B:2.5,C:1.5} as any)[d.data.grade]??1:1,
        lineDash:(d:any)=>d.data.kind!=='rel'||!['A','B'].includes(d.data.grade)?[4,4]:0,endArrow:(d:any)=>d.data.kind==='rel'&&d.data.type!=='竞争',
        labelText:(d:any)=>d.data.kind==='rel'?`${d.data.type}${d.data.grade&&d.data.grade!=='待核实'?' '+d.data.grade:' ?'}`:'',labelFontSize:10,labelFill:fg,labelBackground:true,labelBackgroundFill:dark?'#0b1220':'#fff'},
        state:{path:{stroke:'#f59e0b',lineWidth:4},active:{lineWidth:3},inactive:{opacity:.12}}},
      layout:{type:'d3-force',link:{distance:150},manyBody:{strength:-500},collide:{radius:40}},
      behaviors:['drag-canvas','zoom-canvas','drag-element-force',{type:'hover-activate',degree:1,state:'active',inactiveState:'inactive'},{type:'brush-select',key:'brush',trigger:['shift'],enableElements:['node']},{type:'lasso-select',key:'lasso',trigger:['alt'],enableElements:['node']}],
      plugins:[{type:'minimap',size:[180,110]},
        {type:'tooltip',getContent:(_e:any,items:any[])=>{ const d=items[0]?.data; if(!d) return ''
          if(d.kind==='rel') return `<div style="max-width:420px;white-space:normal"><b>${d.type}</b> · 验证等级 <b>${d.grade??'—'}</b>（${d.nev} 条证据）<br/>${d.note}${d.ev?`<br/>来源：<a href="${d.ev.url}" target="_blank">${d.ev.source}${d.ev.form?' '+d.ev.form:''}</a>（${d.ev.date??d.ev.retrieved}）<br/><i>“${(d.ev.quote??'（无原句）').slice(0,320)}”</i>`:'<br/><i>暂无可引用来源（待核实）</i>'}</div>`
          if(d.kind==='comp') return `<b>${d.name}</b> · ${cn2(d.country)} · 质量 ${d.grade}<br/><i>双击展开邻居 · 右键更多</i>`; return d.name??'' }},
        {type:'contextmenu',trigger:'contextmenu',getItems:(e:any)=>{ const id=e.target?.id as string; if(!id||e.targetType!=='node') return [{name:'适配视图',value:'fit'}]
          if(id.startsWith('s:')) return [{name:'查看环节',value:'seg'}]
          return [{name:'以此为中心',value:'center'},{name:'展开邻居',value:'expand'},{name:'设为路径起点',value:'from'},{name:`查找路径（从 ${sref.current.pathPair?.[0]?s.db.COMP[sref.current.pathPair[0]]?.zh:'中心'}）`,value:'path'},{name:'收藏',value:'fav'},{name:'加入对比',value:'cmp'}] },
          onClick:(v:string,_t:any,cur:any)=>{ const id=cur?.id as string; const st=sref.current
            if(v==='fit') return graph.fitView(); if(v==='seg') return st.setSel({kind:'segment',id:id.slice(2)})
            if(v==='center'){ setCenter(id); setExtra(new Set()); setPath(null); st.setSel({kind:'company',id}) }
            if(v==='expand') setExtra(e=>new Set([...e,id])); if(v==='fav') st.toggleFav(id); if(v==='cmp'&&!st.compare.includes(id)) st.setCompare([...st.compare,id].slice(-6))
            if(v==='from'){ st.setPathPair([id,'']); st.toast('已设起点：'+s.db.COMP[id].zh) }
            if(v==='path'){ const a=st.pathPair?.[0]||center; const p=findPath(a,id); setPath(p); setPathMsg(p?`路径 ${p.length-1} 步：`+p.map(x=>x.startsWith('s:')?`[${s.db.SEG[x.slice(2)].name}]`:s.db.COMP[x].zh).join(' → '):`${s.db.COMP[a].zh} 与 ${s.db.COMP[id].zh} 之间无路径${withSeg?'':'（可勾选「经由产业链环节」）'}`) } }},
        {type:'toolbar',position:'top-right',getItems:()=>[{id:'zoom-in',value:'in'},{id:'zoom-out',value:'out'},{id:'auto-fit',value:'fit'}],onClick:(v:string)=>v==='in'?graph.zoomBy(1.2):v==='out'?graph.zoomBy(.8):graph.fitView()}]})
    graph.on('node:click',(e:any)=>{ const id=e.target.id as string; sref.current.setSel(id.startsWith('s:')?{kind:'segment',id:id.slice(2)}:{kind:'company',id}) })
    graph.on('node:dblclick',(e:any)=>{ const id=e.target.id as string; if(!id.startsWith('s:')) setExtra(x=>new Set([...x,id])) })
    graph.on('canvas:pointerup',()=>setTimeout(()=>{ const ids=graph.getElementDataByState('node','selected').map((n:any)=>n.id as string).filter(x=>!x.startsWith('s:')); if(ids.length>1){ sref.current.setMulti(ids); sref.current.toast(`已框选 ${ids.length} 家公司`) } },50))
    const rp=graph.render().then(()=>{ if(path){ const st:Record<string,string[]>={}; path.forEach(x=>st[x]=['path']); for(let i=0;i<path.length-1;i++){ const e=graph.getEdgeData().find((d:any)=>(d.source===path[i]&&d.target===path[i+1])||(d.source===path[i+1]&&d.target===path[i])); if(e) st[e.id as string]=['path'] } graph.setElementState(st) } })
    g.current=graph; regExport(`network:${pane}`,graph)
    return ()=>{ delete exporters[`network:${pane}`]; rp.finally(()=>graph.destroy()) }
  },[data,s.theme])
  const c=s.db.COMP[center]
  return <div style={{position:'relative',height:'100%'}}>
    <div className="overlay">中心：<b>{c?.zh}</b>
      <label>层数 <select value={hops} onChange={e=>setHops(+e.target.value)}>{[1,2,3,4].map(h=><option key={h} value={h}>{h} 度</option>)}</select></label>
      <label><input type="checkbox" checked={withSeg} onChange={e=>setWithSeg(e.target.checked)}/> 经由产业链环节</label>
      <select value="" onChange={e=>{ if(!e.target.value) return; const p=findPath(center,e.target.value); setPath(p); setPathMsg(p?`路径 ${p.length-1} 步：`+p.map(x=>x.startsWith('s:')?`[${s.db.SEG[x.slice(2)].name}]`:s.db.COMP[x].zh).join(' → '):'无路径（可勾选「经由产业链环节」）') }}>
        <option value="">查找路径到…</option>{s.db.core.companies.filter(x=>x.id!==center).map(x=><option key={x.id} value={x.id}>{x.zh}</option>)}</select>
      {(extra.size>0||path)&&<button className="tb" onClick={()=>{setExtra(new Set());setPath(null);setPathMsg('')}}>重置</button>}
      <span className="muted">{data.nodes.length} 节点 / {data.edges.length} 边</span></div>
    {pathMsg&&<div className="overlay2">{pathMsg}</div>}
    <div ref={el} style={{height:'100%'}}/>
    <div className="legend">{Object.entries(REL_COLOR).filter(([k])=>k!=='合资'&&k!=='持股').map(([k,v])=><span key={k}><i style={{background:v}}/>{k}</span>)} · 实线=已引用 虚线=待核实 · 双击展开 · 右键：中心/路径/收藏 · Shift 框选 · Alt 套索</div></div>
}
