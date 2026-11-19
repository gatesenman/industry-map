import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import { useSt, exporters } from '../store'
let worldP: Promise<unknown> | null = null
export function ensureWorld(){ if(!worldP) worldP=fetch('./world.json').then(r=>r.json()).then(g=>{ echarts.registerMap('world',g); return g }); return worldP }
export { echarts }
export default function EChart({option,onClick,id,onReady,style}:{option:any;onClick?:(p:any)=>void;id?:string;onReady?:(c:echarts.ECharts)=>void;style?:React.CSSProperties}){
  const el=useRef<HTMLDivElement>(null), ch=useRef<echarts.ECharts|null>(null), {theme}=useSt()
  const cb=useRef(onClick); cb.current=onClick
  useEffect(()=>{ const c=echarts.init(el.current!, theme==='dark'?'dark':undefined); ch.current=c
    c.on('click',(p)=>cb.current?.(p)); const ro=new ResizeObserver(()=>c.resize()); ro.observe(el.current!); onReady?.(c)
    if(id) exporters[id]={ png:()=>c.getDataURL({pixelRatio:2,backgroundColor:theme==='dark'?'#0b1220':'#fff'}),
      svg:()=>{ const d=document.createElement('div'); d.style.cssText='width:1400px;height:900px;position:absolute;left:-9999px'; document.body.appendChild(d)
        const s=echarts.init(d,theme==='dark'?'dark':undefined,{renderer:'svg'}); s.setOption({...c.getOption(),animation:false}); const out=s.renderToSVGString(); s.dispose(); d.remove(); return out } }
    return ()=>{ ro.disconnect(); c.dispose(); if(id) delete exporters[id] } },[theme])
  useEffect(()=>{ ch.current?.setOption({backgroundColor:'transparent',animationDurationUpdate:600,...option},{notMerge:true}) },[option,theme])
  return <div ref={el} style={{width:'100%',height:'100%',...style}}/>
}
