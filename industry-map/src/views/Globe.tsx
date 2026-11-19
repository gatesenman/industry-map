import { useEffect, useRef, useState } from 'react'
import { echarts, ensureWorld } from './EChart'
import 'echarts-gl'
import { loadGeo, type Geo } from './geo'
import { useSt, useSlice, exporters } from '../store'
import { HS_OF, ISO2to3, cn3, fmtUSD } from '../data'
export default function Globe({ind,pane}:{ind:string;pane:string}){
  const s=useSt(); const sl=useSlice(ind); const el=useRef<HTMLDivElement>(null); const [geo,setGeo]=useState<Geo|null>(null); const [hs,setHs]=useState(HS_OF[ind]); const [rot,setRot]=useState(true)
  useEffect(()=>{ loadGeo().then(setGeo) },[])
  useEffect(()=>{ if(!geo||!el.current) return
    const dark=s.theme==='dark'
    const cnt:Record<string,number>={}; sl.comps.forEach(c=>{ const k=ISO2to3[c.country]; cnt[k]=(cnt[k]??0)+1 })
    const tc=document.createElement('canvas'); tc.width=4096; tc.height=2048
    const tex=echarts.init(tc as unknown as HTMLDivElement,undefined,{width:4096,height:2048})
    tex.setOption({backgroundColor:dark?'#071226':'#cfe3f7',animation:false,
      visualMap:{show:false,min:0,max:Math.max(1,...Object.values(cnt)),inRange:{color:dark?['#1e3a5f','#3b82f6']:['#93c5fd','#1d4ed8']}},
      series:[{type:'map',map:'world',left:0,top:0,right:0,bottom:0,boundingCoords:[[-180,90],[180,-90]],itemStyle:{areaColor:dark?'#172338':'#f1f5f9',borderColor:dark?'#3b4b66':'#94a3b8',borderWidth:1},
        label:{show:false},data:Object.entries(cnt).filter(([k])=>geo.name[k]).map(([k,v])=>({name:geo.name[k],value:v}))}]})
    ensureWorld()
    const c=echarts.init(el.current, dark?'dark':undefined)
    const flows=(s.db.macro.trade?.flows??[]).filter(f=>f.hs===hs&&geo.center[f.from]&&geo.center[f.to]).sort((a,b)=>b.value-a.value).slice(0,80); const mx=flows[0]?.value??1
    const pts=Object.entries(cnt).filter(([k])=>geo.center[k]).map(([k,v])=>({name:cn3(k),value:[...geo.center[k],0],n:v}))
    c.setOption({backgroundColor:'transparent',tooltip:{formatter:(p:any)=>p.seriesType==='lines3D'?`${cn3(p.data.f.from)} → ${cn3(p.data.f.to)}<br/>HS ${hs} ${fmtUSD(p.data.f.value)}（${p.data.f.year}，UN Comtrade）`:`${p.name}：${p.data.n} 家样本公司`},
      globe:{baseTexture:tex,shading:'lambert',environment:dark?'#020617':'#e2e8f0',light:{ambient:{intensity:.7},main:{intensity:.9}},
        viewControl:{autoRotate:rot,autoRotateSpeed:6,distance:190,alpha:25,beta:-140},atmosphere:{show:true,color:'#60a5fa',glowPower:4}},
      series:[{type:'lines3D',coordinateSystem:'globe',blendMode:'lighter',effect:{show:true,trailWidth:2,trailLength:.25,trailOpacity:1,constantSpeed:40},
          lineStyle:{width:1.2,color:'#f59e0b',opacity:.35},data:flows.map(f=>({coords:[geo.center[f.from],geo.center[f.to]],f,lineStyle:{width:.5+3*f.value/mx}}))},
        {type:'scatter3D',coordinateSystem:'globe',symbolSize:(v:any,p:any)=>6+Math.sqrt(p.data.n)*4,itemStyle:{color:'#22d3ee',opacity:.9},label:{show:true,formatter:'{b}',textStyle:{fontSize:11,color:dark?'#e2e8f0':'#0f172a',backgroundColor:'transparent'}},data:pts}]})
    const ro=new ResizeObserver(()=>c.resize()); ro.observe(el.current)
    exporters[`globe:${pane}`]={png:()=>c.getDataURL({pixelRatio:2})}
    return ()=>{ ro.disconnect(); c.dispose(); tex.dispose(); delete exporters[`globe:${pane}`] }
  },[geo,hs,s.theme,sl.comps.length,rot])
  return <div className="vwrap"><div className="overlay">3D 地球 · 贸易弧线 <select value={hs} onChange={e=>setHs(e.target.value)}>{Object.entries(s.db.macro.trade?.hs??{}).map(([k,v])=><option key={k} value={k}>HS {k} {v}</option>)}</select>
    <label><input type="checkbox" checked={rot} onChange={e=>setRot(e.target.checked)}/> 自动旋转</label>
    <span className="muted">弧线 = UN Comtrade 出口流向（前 80 条）· 点 = 样本公司所在国家 · 拖拽旋转 / 滚轮缩放</span></div>
    <div ref={el} style={{width:'100%',height:'100%'}}/></div>
}
