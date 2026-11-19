import { useEffect, useMemo, useState } from 'react'
import EChart from './EChart'
import { loadGeo, type Geo } from './geo'
import { useSt, useSlice } from '../store'
import { TIER_COLOR, cn2, cn3, ISO2to3, fmtUSD, HS_OF, concentration } from '../data'
type P={ind:string;pane:string}
const metricOf=(c:any,m:string)=> m==='marketCap'?c.marketCap?.valueUSD:m==='revenue'?c.revenue?.valueUSD:1
export function Sunburst({ind,pane}:P){
  const s=useSt(); const sl=useSlice(ind); const [mode,setMode]=useState<'sunburst'|'tree'>('sunburst')
  const subs=[...new Set(sl.segs.map(x=>x.sub))]
  const data=subs.map(sb=>{ const ss=sl.segs.filter(x=>x.sub===sb); if(!ss.length) return null; return {name:sb,itemStyle:{color:TIER_COLOR[ss[0].tier]},
    children:ss.map(x=>({name:x.name,id:'s:'+x.id,children:sl.compsOf(x.id).map(c=>({name:c.zh,id:`c:${c.id}:${x.id}`,value:1}))}))} }).filter(Boolean)
  const ind0=s.db.core.industries.find(i=>i.id===ind)!
  const option=mode==='sunburst'?{tooltip:{},series:[{type:'sunburst',radius:['6%','92%'],data,sort:undefined,emphasis:{focus:'ancestor'},label:{rotate:'radial',fontSize:10,minAngle:4},
      levels:[{},{r0:'6%',r:'28%',label:{rotate:'tangential',fontSize:12}},{r0:'28%',r:'55%'},{r0:'55%',r:'92%',label:{position:'outside',fontSize:9}}]}]}
    :{tooltip:{},series:[{type:'tree',data:[{name:ind0.zh,children:data}],top:'2%',bottom:'2%',left:'8%',right:'14%',symbolSize:8,initialTreeDepth:2,expandAndCollapse:true,animationDurationUpdate:500,
      label:{position:'left',fontSize:11},leaves:{label:{position:'right'}}}]}
  const click=(p:any)=>{ const id:string=p.data?.id; if(!id) return; if(id.startsWith('s:')) s.setSel({kind:'segment',id:id.slice(2)}); else s.setSel({kind:'company',id:id.split(':')[1]}) }
  return <div className="vwrap"><div className="overlay"><button className={'tb'+(mode==='sunburst'?' on':'')} onClick={()=>setMode('sunburst')}>旭日图</button><button className={'tb'+(mode==='tree'?' on':'')} onClick={()=>setMode('tree')}>树图（可折叠）</button></div>
    <EChart id={`tree:${pane}`} option={option} onClick={click}/></div>
}
export function Treemap({ind,pane}:P){
  const s=useSt(); const sl=useSlice(ind)
  const nMc=sl.comps.filter(c=>c.marketCap).length, nRv=sl.comps.filter(c=>c.revenue).length
  const [m,setM]=useState(nMc>=nRv&&nMc>0?'marketCap':nRv>0?'revenue':'count'); const [color,setColor]=useState<'tier'|'country'>('tier')
  const pal=['#60a5fa','#f87171','#34d399','#fbbf24','#a78bfa','#f472b6','#22d3ee','#fb923c','#94a3b8','#4ade80']; const ctry=[...new Set(sl.comps.map(c=>c.country))]
  const subs=[...new Set(sl.segs.map(x=>x.sub))]; let missing=0
  const data=subs.map(sb=>{ const ss=sl.segs.filter(x=>x.sub===sb); if(!ss.length) return null; return {name:sb,itemStyle:{color:TIER_COLOR[ss[0].tier]},children:ss.map(x=>({name:x.name,id:'s:'+x.id,
    children:sl.compsOf(x.id).map(c=>{ const v=metricOf(c,m); if(v==null) missing++; return v==null?null:{name:c.zh,id:`c:${c.id}:${x.id}`,value:v/c.segments.filter(y=>sl.segIds.has(y)).length,country:c.country,itemStyle:color==='country'?{color:pal[ctry.indexOf(c.country)%pal.length]}:undefined} }).filter(Boolean)})) .filter((x:any)=>x&&x.children.length)} }).filter((x:any)=>x&&x.children.length)
  const option={tooltip:{formatter:(p:any)=>`${p.treePathInfo.map((t:any)=>t.name).filter(Boolean).join(' › ')}<br/>${m==='count'?p.value+' 家':fmtUSD(p.value)}${p.data.country?' · '+cn2(p.data.country):''}`},
    series:[{type:'treemap',data,roam:false,leafDepth:3,breadcrumb:{show:true},upperLabel:{show:true,height:20},label:{formatter:(p:any)=>m==='count'?p.name:`${p.name}\n${fmtUSD(p.value)}`},
      levels:[{itemStyle:{gapWidth:3,borderColor:'transparent'}},{itemStyle:{gapWidth:2},upperLabel:{show:true}},{itemStyle:{gapWidth:1}},{colorSaturation:[.35,.6]}]}]}
  const click=(p:any)=>{ const id:string=p.data?.id; if(!id) return; s.setSel(id.startsWith('s:')?{kind:'segment',id:id.slice(2)}:{kind:'company',id:id.split(':')[1]}) }
  return <div className="vwrap"><div className="overlay">指标 <select value={m} onChange={e=>setM(e.target.value)}><option value="marketCap">市值（{nMc} 家有数据）</option><option value="revenue">营收（{nRv} 家有数据）</option><option value="count">公司数</option></select>
    着色 <select value={color} onChange={e=>setColor(e.target.value as never)}><option value="tier">产业链层级</option><option value="country">国家/地区</option></select>
    {m!=='count'&&<span className="warn">缺失 {missing} 家未计入（不估算）</span>}<span className="muted">多环节公司按环节数均分</span></div>
    <EChart id={`treemap:${pane}`} option={option} onClick={click}/></div>
}
export function Sankey({ind,pane}:P){
  const s=useSt(); const sl=useSlice(ind); const [m,setM]=useState<'revenue'|'count'>('revenue')
  const used=new Set(sl.links.flatMap(l=>[l.from,l.to]))
  const w=(sid:string)=>{ const cs=sl.compsOf(sid); return m==='count'?cs.length:cs.reduce((a,c)=>a+(c.revenue?.valueUSD??0)/c.segments.length,0) }
  const out:Record<string,number>={}; sl.links.forEach(l=>out[l.from]=(out[l.from]??0)+1)
  const links=sl.links.map(l=>({source:l.from,target:l.to,value:Math.max(m==='count'?1:1e8, w(l.from)/(out[l.from]||1))}))
  const option={tooltip:{formatter:(p:any)=>p.dataType==='edge'?`${s.db.SEG[p.data.source].name} → ${s.db.SEG[p.data.target].name}<br/>${m==='count'?p.value.toFixed(1)+' 家（上游环节公司数均分）':fmtUSD(p.value)+'（上游环节样本营收按下游数均分，代理值）'}`:`${s.db.SEG[p.name]?.name}<br/>${m==='count'?w(p.name)+' 家':'样本营收 '+fmtUSD(w(p.name))}`},
    series:[{type:'sankey',left:20,right:140,nodeGap:12,emphasis:{focus:'adjacency'},draggable:true,lineStyle:{color:'gradient',curveness:.5,opacity:.4},
      data:sl.segs.filter(x=>used.has(x.id)).map(x=>({name:x.id,itemStyle:{color:TIER_COLOR[x.tier],borderColor:concentration(s.db,x.id).choke?'#ef4444':undefined,borderWidth:2},label:{formatter:x.name}})),links}]}
  return <div className="vwrap"><div className="overlay">流量 <select value={m} onChange={e=>setM(e.target.value as never)}><option value="revenue">样本营收（真实年报值，代理分配）</option><option value="count">公司数</option></select>
    <span className="muted">链路宽度为代理值：不代表实际环节间交易额（暂无可引用的环节间交易数据）</span></div>
    <EChart id={`sankey:${pane}`} option={option} onClick={(p:any)=>p.dataType==='node'&&s.setSel({kind:'segment',id:p.name})}/></div>
}
export function WorldMap({ind,pane}:P){
  const s=useSt(); const sl=useSlice(ind); const [geo,setGeo]=useState<Geo|null>(null); const [layer,setLayer]=useState<'count'|'revenue'|'gdp'|'manu'>('count'); const [hs,setHs]=useState(HS_OF[ind]??'85')
  useEffect(()=>{ loadGeo().then(setGeo) },[])
  const option=useMemo(()=>{ if(!geo) return null
    const by:Record<string,number>={}
    if(layer==='count'||layer==='revenue') sl.comps.forEach(c=>{ const k=ISO2to3[c.country]; by[k]=(by[k]??0)+(layer==='count'?1:(c.revenue?.valueUSD??0)) })
    else { const ind2=layer==='gdp'?'NY.GDP.MKTP.CD':'NV.IND.MANF.CD'; const d=s.db.macro.worldbank[ind2]?.data??{}; Object.entries(d).forEach(([k,v])=>by[k]=v[v.length-1][1]) }
    const data=Object.entries(by).filter(([k])=>geo.name[k]).map(([k,v])=>({name:geo.name[k],value:v,code:k}))
    const flows=(s.db.macro.trade?.flows??[]).filter(f=>f.hs===hs&&geo.center[f.from]&&geo.center[f.to]).sort((a,b)=>b.value-a.value).slice(0,60)
    const maxF=flows[0]?.value??1
    const fmtv=(v:number)=>layer==='count'?`${v} 家`:fmtUSD(v)
    return {tooltip:{trigger:'item',formatter:(p:any)=>p.seriesType==='lines'?`${cn3(p.data.f.from)} → ${cn3(p.data.f.to)}<br/>HS ${hs} 出口 ${fmtUSD(p.data.f.value)}（${p.data.f.year}）<br/>来源：UN Comtrade`:p.data?`${cn3(p.data.code)}：${fmtv(p.value)}${layer==='count'?'<br/>'+sl.comps.filter(c=>ISO2to3[c.country]===p.data.code).slice(0,10).map(c=>c.zh).join('、'):''}`:p.name},
      visualMap:{min:0,max:Math.max(1,...Object.values(by)),left:16,bottom:36,calculable:true,text:['高','低'],inRange:{color:['#1e3a5f','#2563eb','#93c5fd']},seriesIndex:0,formatter:(v:number)=>layer==='count'?String(Math.round(v)):fmtUSD(v)},
      geo:{map:'world',roam:true,itemStyle:{areaColor:s.theme==='dark'?'#1e293b':'#e2e8f0',borderColor:s.theme==='dark'?'#334155':'#94a3b8'},emphasis:{label:{show:false},itemStyle:{areaColor:'#f59e0b'}}},
      series:[{type:'map',geoIndex:0,data},
        {type:'lines',coordinateSystem:'geo',zlevel:2,effect:{show:true,period:5,trailLength:.4,symbolSize:4},lineStyle:{curveness:.3,opacity:.55,color:'#f59e0b'},
          data:flows.map(f=>({coords:[geo.center[f.from],geo.center[f.to]],f,lineStyle:{width:.6+5*f.value/maxF}}))}]} },[geo,sl.comps,layer,hs,s.theme])
  if(!option) return <div className="loading">加载地图…</div>
  return <div className="vwrap"><div className="overlay">图层 <select value={layer} onChange={e=>setLayer(e.target.value as never)}><option value="count">样本公司数</option><option value="revenue">样本营收合计</option><option value="gdp">GDP（World Bank 最新）</option><option value="manu">制造业增加值（World Bank）</option></select>
    贸易弧线 <select value={hs} onChange={e=>setHs(e.target.value)}>{Object.entries(s.db.macro.trade?.hs??{'85':'电气设备','30':'药品','8507':'蓄电池'}).map(([k,v])=><option key={k} value={k}>HS {k} {v}</option>)}</select>
    <span className="muted">弧线：UN Comtrade 出口方申报，前 60 条 · 点击国家加入筛选</span></div>
    <EChart id={`map:${pane}`} option={option} onClick={(p:any)=>{ if(p.seriesType==='map'&&p.data?.code){ const k=Object.entries(ISO2to3).find(([,v])=>v===p.data.code)?.[0]; if(k) s.setF({...s.f,country:s.f.country===k?'':k}) } }}/></div>
}
