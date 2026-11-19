import { useEffect, useRef, useState } from 'react'
import { Graph, regExport, bfs } from './g6util'
import { useSt, useSlice } from '../store'
import { TIER_COLOR, concentration, cn2 } from '../data'
import { exporters } from '../store'
export default function FlowG6({ind,pane}:{ind:string;pane:string}){
  const s=useSt(); const sl=useSlice(ind); const el=useRef<HTMLDivElement>(null); const g=useRef<Graph|null>(null)
  const [exp,setExp]=useState<Set<string>>(new Set()); const ready=useRef<Promise<void>>(Promise.resolve()); const first=useRef(true); const sref=useRef(s); sref.current=s
  const build=()=>{
    const nodes:any[]=[], edges:any[]=[]
    sl.segs.forEach(x=>{ const cc=concentration(s.db,x.id); const n=sl.compsOf(x.id).length
      nodes.push({id:x.id,data:{kind:'seg',tier:x.tier,choke:cc.choke,hhi:cc.hhi,top:cc.top,n,sub:x.sub,name:x.name},style:{labelText:`${cc.choke?'⚠ ':''}${x.name}\n${n} 家 · HHI ${cc.hhi}${exp.has(x.id)?'  ▾':'  ▸'}`}}) })
    sl.links.forEach(l=>edges.push({id:`${l.from}>${l.to}`,source:l.from,target:l.to,data:{kind:'chain'}}))
    exp.forEach(sid=>{ if(!sl.segIds.has(sid)) return; sl.compsOf(sid).forEach(c=>{ const id=`c:${c.id}@${sid}`; nodes.push({id,data:{kind:'comp',cid:c.id,name:c.zh,country:c.country},style:{labelText:c.zh}}); edges.push({id:`${sid}-${id}`,source:sid,target:id,data:{kind:'member'}}) }) })
    return {nodes,edges}
  }
  useEffect(()=>{
    const dark=s.theme==='dark'; const fg=dark?'#e2e8f0':'#0f172a'
    const graph=new Graph({container:el.current!,autoFit:'view',theme:dark?'dark':'light',animation:true,padding:30,
      data:build(),
      node:{type:(d:any)=>d.data.kind==='seg'?'rect':'circle',style:{
        size:(d:any)=>d.data.kind==='seg'?[190,54]:16, radius:8,
        fill:(d:any)=>d.data.kind==='seg'?TIER_COLOR[d.data.tier]+'33':'#64748b', stroke:(d:any)=>d.data.kind==='seg'?(d.data.choke?'#ef4444':TIER_COLOR[d.data.tier]):'#94a3b8',
        lineWidth:(d:any)=>d.data.choke?2.5:1.2, labelPlacement:(d:any)=>d.data.kind==='seg'?'center':'right', labelFill:fg, labelFontSize:(d:any)=>d.data.kind==='seg'?14:12, cursor:'pointer'},
        state:{active:{lineWidth:3,halo:true},inactive:{opacity:.18},selected:{stroke:'#f59e0b',lineWidth:3}}},
      edge:{type:'cubic-horizontal',style:{endArrow:(d:any)=>d.data.kind==='chain',stroke:(d:any)=>d.data.kind==='chain'?'#94a3b8':'#64748b',lineDash:(d:any)=>d.data.kind==='member'?[3,3]:0,lineWidth:1.3},
        state:{active:{stroke:'#f59e0b',lineWidth:2.5},inactive:{opacity:.12}}},
      layout:{type:'antv-dagre',rankdir:'LR',nodesep:12,ranksep:70},
      behaviors:['drag-canvas','zoom-canvas','drag-element',{type:'brush-select',key:'brush',trigger:['shift'],enableElements:['node']},{type:'lasso-select',key:'lasso',trigger:['alt'],enableElements:['node']}],
      plugins:[{type:'minimap',key:'minimap',size:[180,110]},
        {type:'tooltip',key:'tip',enable:(e:any)=>e.targetType==='node',getContent:(_e:any,items:any[])=>{ const d=items[0]?.data; if(!d) return ''
          return d.kind==='seg'?`<b>${d.name}</b><br/>${d.sub} · ${d.tier}<br/>样本公司 ${d.n} 家<br/>国家 HHI ${d.hhi}${d.top?`（${cn2(d.top[0])} ${(d.top[1]*100).toFixed(0)}%）`:''}${d.choke?'<br/><b style="color:#ef4444">⚠ 高度集中/卡脖子</b>':''}<br/><i>悬停高亮全链 · 双击展开公司 · 右键菜单</i>`:`<b>${d.name}</b><br/>${cn2(d.country)}` }},
        {type:'contextmenu',key:'cm',trigger:'contextmenu',getItems:(e:any)=>{ const id=e.target?.id; if(!id) return [{name:'适配视图',value:'fit'}]
          return id.startsWith('c:')?[{name:'查看公司详情',value:'insp'},{name:'在关系网络中查看',value:'net'},{name:'收藏',value:'fav'}]:[{name:'展开/收起公司',value:'toggle'},{name:'查看环节详情',value:'insp'},{name:'在桑基图中查看',value:'sankey'},{name:'在地图中查看分布',value:'map'},{name:'适配视图',value:'fit'}] },
          onClick:(v:string,_t:any,cur:any)=>{ const id=cur?.id as string; const st=sref.current
            if(v==='fit') graph.fitView(); else if(v==='toggle') toggle(id); else if(id?.startsWith('c:')){ const cid=id.slice(2).split('@')[0]; if(v==='insp') st.setSel({kind:'company',id:cid}); if(v==='net'){st.setSel({kind:'company',id:cid});st.setView('network')} if(v==='fav') st.toggleFav(cid) }
            else { st.setSel({kind:'segment',id}); if(v==='sankey') st.setView('sankey'); if(v==='map') st.setView('map') } }},
        {type:'toolbar',key:'tb',position:'top-right',getItems:()=>[{id:'zoom-in',value:'in'},{id:'zoom-out',value:'out'},{id:'auto-fit',value:'fit'},{id:'reset',value:'expand'}],
          onClick:(v:string)=>{ if(v==='in') graph.zoomBy(1.2); else if(v==='out') graph.zoomBy(.8); else if(v==='fit') graph.fitView(); else setExp(e=>e.size?new Set():new Set(sl.segs.map(x=>x.id))) }}]})
    const adjF=new Map<string,string[]>(), adjB=new Map<string,string[]>()
    sl.links.forEach(l=>{ adjF.set(l.from,[...(adjF.get(l.from)??[]),l.to]); adjB.set(l.to,[...(adjB.get(l.to)??[]),l.from]) })
    graph.on('node:pointerenter',(e:any)=>{ const id=e.target.id; if(id.startsWith('c:')) return
      const keep=new Set([...bfs(adjF,id),...bfs(adjB,id)]); const st:Record<string,string[]>={}
      graph.getNodeData().forEach((n:any)=>st[n.id]=keep.has(n.id)||(n.id.includes('@')&&keep.has(n.id.split('@')[1]))?['active']:['inactive'])
      graph.getEdgeData().forEach((d:any)=>st[d.id]=keep.has(d.source)&&keep.has(d.target)?['active']:['inactive'])
      graph.setElementState(st,true) })
    graph.on('node:pointerleave',()=>{ const st:Record<string,string[]>={}; graph.getNodeData().forEach((n:any)=>st[n.id]=[]); graph.getEdgeData().forEach((d:any)=>st[d.id]=[]); graph.setElementState(st,true) })
    graph.on('node:click',(e:any)=>{ const id=e.target.id as string; sref.current.setSel(id.startsWith('c:')?{kind:'company',id:id.slice(2).split('@')[0]}:{kind:'segment',id}) })
    graph.on('node:dblclick',(e:any)=>{ const id=e.target.id as string; if(!id.startsWith('c:')) toggle(id) })
    graph.on('canvas:pointerup',()=>{ setTimeout(()=>{ const ids=graph.getElementDataByState('node','selected').map((n:any)=>n.id as string); const cs=new Set<string>()
      ids.forEach(id=>{ if(id.startsWith('c:')) cs.add(id.slice(2).split('@')[0]); else sl.compsOf(id).forEach(c=>cs.add(c.id)) }); if(ids.length>1) { sref.current.setMulti([...cs]); sref.current.toast(`框选 ${ids.length} 个节点 → ${cs.size} 家公司（见检查器）`) } },50) })
    ready.current=graph.render(); g.current=graph; regExport(`flow:${pane}`,graph)
    return ()=>{ delete exporters[`flow:${pane}`]; g.current=null; ready.current.finally(()=>graph.destroy()) }
  },[s.theme,ind,s.f])
  const toggle=(id:string)=>setExp(e=>{ const n=new Set(e); n.has(id)?n.delete(id):n.add(id); return n })
  useEffect(()=>{ if(first.current){ first.current=false; return } const gr=g.current; if(!gr) return; ready.current=ready.current.then(()=>{ if(g.current!==gr) return; gr.setData(build()); return gr.render().then(()=>gr.fitView()) }) },[exp])
  useEffect(()=>{ const gr=g.current; const id=s.sel?.kind==='segment'?s.sel.id:''; if(!gr||!id) return; ready.current.then(()=>{ if(g.current===gr&&gr.getNodeData().some((n:any)=>n.id===id)) gr.setElementState(id,'selected') }) },[s.sel])
  return <div style={{position:'relative',height:'100%'}}><div ref={el} style={{height:'100%'}}/>
    <div className="legend">上游 → 中游 → 下游（dagre 分层）· 悬停高亮上下游全链 · 双击/右键展开公司 · Shift 框选 / Alt 套索 · <span style={{color:'#ef4444'}}>红框 = 国家集中度 HHI≥3500 且第一大国≥60%（样本≥4）</span></div></div>
}
