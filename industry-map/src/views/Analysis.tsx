import { useMemo, useState } from 'react'
import EChart from './EChart'
import { useSt, useSlice } from '../store'
import { cn2, cn3, fmtUSD, fmtNum, concentration, HS_OF, type SecRec } from '../data'
import { Cite, Missing } from '../ui'
const YEAR=new Date().getFullYear()
const lastFY=(s:SecRec|undefined,k:keyof SecRec)=>(s?.[k] as any)?.annual as {end:string;value:number;form:string}[]|undefined
export default function Analysis({ind,pane}:{ind:string;pane:string}){
  const [tab,setTab]=useState('dash')
  return <div className="vwrap" style={{overflow:'auto'}}><div className="overlay static">{[['dash','产业景气仪表盘'],['conc','集中度与国家依赖'],['trade','贸易结构'],['cmp','公司对比'],['ts','时间序列']].map(([k,n])=><button key={k} className={'tb'+(tab===k?' on':'')} onClick={()=>setTab(k)}>{n}</button>)}</div>
    {tab==='dash'&&<Dash ind={ind} pane={pane}/>}{tab==='conc'&&<Conc ind={ind} pane={pane}/>}{tab==='trade'&&<Trade ind={ind} pane={pane}/>}{tab==='cmp'&&<Cmp pane={pane}/>}{tab==='ts'&&<TS pane={pane}/>}</div>
}
function Dash({ind,pane}:{ind:string;pane:string}){
  const s=useSt(); const sl=useSlice(ind); const {macro}=s.db
  const imf=macro.imf['NGDP_RPCH'], inf=macro.imf['PCPIPCH']
  const ctry=['CHN','USA','TWN','KOR','JPN','DEU','NLD']
  const val=(d:[string,number][]|undefined,y:number)=>d?.find(x=>+x[0]===y)?.[1]
  const fred=(id:string)=>{ const f=macro.fred[id]; if(!f) return null; const d=f.data; const l=d[d.length-1]; const y=d.find(x=>x[0].slice(0,7)===`${+l[0].slice(0,4)-1}${l[0].slice(4,7)}`); return {f,l,yoy:y?(l[1]/y[1]-1)*100:null} }
  // 环节营收增速、毛利率（SEC 样本，同口径公司）
  const segStats=sl.segs.map(g=>{ const cs=sl.compsOf(g.id).filter(c=>s.db.micro.sec[c.id]?.revenue?.annual?.length)
    let cur=0,prev=0,gp=0,rvg=0,n=0; const used:string[]=[]
    cs.forEach(c=>{ const sec=s.db.micro.sec[c.id]; const a=lastFY(sec,'revenue')!; if(a.length<2) return; const fx=sec.revenue!.unit==='USD'?1:(1/(s.db.micro.fx[sec.revenue!.unit]?.perUSD??NaN)); if(!isFinite(fx)) return
      cur+=a[a.length-1].value*fx; prev+=a[a.length-2].value*fx; n++; used.push(c.zh)
      const g2=lastFY(sec,'grossProfit'); const gl=g2?.find(x=>x.end===a[a.length-1].end); if(gl){ gp+=gl.value*fx; rvg+=a[a.length-1].value*fx } })
    return {g,n,used,growth:n&&prev?(cur/prev-1)*100:null,margin:rvg?gp/rvg*100:null,cur} }).filter(x=>x.n>0)
  const opt={tooltip:{trigger:'axis',formatter:(ps:any[])=>{ const x=segStats[ps[0].dataIndex]; return `<b>${x.g.name}</b><br/>样本 ${x.n} 家（SEC EDGAR 年报）：${x.used.join('、')}<br/>${ps.map(p=>`${p.seriesName}：${p.value==null?'缺失':p.value.toFixed(1)+'%'}`).join('<br/>')}` }},
    legend:{top:0},grid:{left:50,right:20,top:30,bottom:70},xAxis:{type:'category',data:segStats.map(x=>x.g.name),axisLabel:{rotate:30,fontSize:10}},yAxis:{type:'value',axisLabel:{formatter:'{value}%'}},
    series:[{name:'营收同比增速（最新 FY）',type:'bar',data:segStats.map(x=>x.growth==null?null:+x.growth.toFixed(1)),itemStyle:{color:'#60a5fa'}},{name:'毛利率',type:'bar',data:segStats.map(x=>x.margin==null?null:+x.margin.toFixed(1)),itemStyle:{color:'#34d399'}}]}
  return <div className="dash">
    <h3>宏观（IMF《世界经济展望》，{YEAR} 年及以后为预测）<Cite c={imf?{source:'IMF DataMapper',url:imf.url,retrieved:s.db.sources.generated.slice(0,10)}:null}/></h3>
    {imf?<table className="grid sm"><thead><tr><th>国家/地区</th><th>{YEAR-1} GDP 增速</th><th>{YEAR} 预测</th><th>{YEAR+1} 预测</th><th>{YEAR} 通胀预测</th><th>制造业增加值（WB 最新）</th></tr></thead><tbody>
      {ctry.map(k=>{ const m=s.db.macro.worldbank['NV.IND.MANF.CD']?.data[k]; const ml=m?.[m.length-1]; const v=(x?:number)=>x==null?<Missing/>:x.toFixed(1)+'%'
        return <tr key={k}><td>{cn3(k)}</td><td>{v(val(imf.data[k],YEAR-1))}</td><td>{v(val(imf.data[k],YEAR))}</td><td>{v(val(imf.data[k],YEAR+1))}</td><td>{v(val(inf?.data[k],YEAR))}</td>
        <td>{ml?<>{fmtUSD(ml[1])} <Cite c={{source:'World Bank',url:s.db.macro.worldbank['NV.IND.MANF.CD'].url,retrieved:''}} label={ml[0]}/></>:<Missing why={k==='TWN'?'World Bank 不发布台湾数据':undefined}/>}</td></tr> })}</tbody></table>:<Missing/>}
    <h3>美国行业与金融指标（FRED，最新值）</h3><div className="cards">{['IPG3344S','PCU33443344','IPG3361T3S','DFF','DGS10','DEXCHUS'].map(id=>{ const x=fred(id); return <div key={id} className="kpi">{x?<><div className="kn">{x.f.name}</div><div className="kv2">{x.l[1].toFixed(2)}</div>
      <div className="small">{x.l[0]}{x.yoy!=null&&<span className={x.yoy>=0?'ok':'warn'}> 同比 {x.yoy>=0?'+':''}{x.yoy.toFixed(1)}%</span>} <Cite c={{source:'FRED',url:x.f.url,retrieved:''}} label={id}/></div></>:<><div className="kn">{id}</div><Missing/></>}</div> })}</div>
    <h3>环节营收增速与毛利率（SEC EDGAR 申报样本，非全行业）</h3>
    {segStats.length?<div style={{height:340}}><EChart id={`analysis:${pane}`} option={opt}/></div>:<div className="muted">本产业暂无足够 SEC 申报公司（多为非美上市公司；A 股/港股财报源待接入）</div>}
    <div className="small muted">口径：同一公司最新两个财年 10-K/20-F 营收（XBRL）；非美元申报按最新汇率折算（Yahoo Finance FX）；毛利率 = 毛利/营收（仅含申报毛利的公司）。</div>
  </div>
}
function Conc({ind,pane}:{ind:string;pane:string}){
  const s=useSt(); const sl=useSlice(ind); const t=s.db.macro.trade; const [hs,setHs]=useState(HS_OF[ind])
  const rows=sl.segs.map(g=>({g,...concentration(s.db,g.id)})).sort((a,b)=>b.hhi-a.hhi)
  const tot=Object.entries(t?.totals?.[hs]??{}).sort((a,b)=>b[1].value-a[1].value); const sum=tot.reduce((a,[,v])=>a+v.value,0)
  const opt={tooltip:{formatter:(p:any)=>`${p.name}：${fmtUSD(p.value)}（${p.percent}%）<br/>UN Comtrade ${p.data.year}`},series:[{type:'pie',radius:['35%','70%'],data:tot.map(([k,v])=>({name:cn3(k),value:v.value,year:v.year})),label:{formatter:'{b}\n{d}%'}}]}
  return <div className="dash two"><div><h3>环节国家集中度（HHI）</h3><table className="grid sm"><thead><tr><th>环节</th><th>HHI</th><th>口径</th><th>第一大国</th><th>年报前五大客户中位</th><th>样本</th><th></th></tr></thead><tbody>
    {rows.map(r=><tr key={r.g.id} onClick={()=>s.setSel({kind:'segment',id:r.g.id})}><td className="link">{r.g.name}</td><td>{r.hhi}</td><td>{r.basis}</td><td>{r.top?`${cn2(r.top[0])} ${(r.top[1]*100).toFixed(0)}%`:'—'}</td><td>{(r as any).top5Cust!=null?((r as any).top5Cust*100).toFixed(1)+'%':'—'}</td><td>{r.n}</td><td>{r.choke&&<span className="choke">卡脖子</span>}</td></tr>)}</tbody></table>
    <div className="small muted">卡脖子：HHI≥3500、第一大国≥60%、样本≥4。前五大客户中位数来自 A 股年报披露（有则显示），衡量客户集中而非国家集中。</div></div>
    <div><h3>出口国集中度 HS <select value={hs} onChange={e=>setHs(e.target.value)}>{Object.entries(t?.hs??{}).map(([k,v])=><option key={k} value={k}>{k} {v}</option>)}</select> {t&&<Cite c={t.source}/>}</h3>
    {tot.length?<><div style={{height:300}}><EChart id={`analysis2:${pane}`} option={opt}/></div><div className="small muted">已拉取 10 个主要出口经济体的申报，合计 {fmtUSD(sum)}；出口方 HHI ≈ {Math.round(tot.reduce((a,[,v])=>a+(v.value/sum*100)**2,0))}（仅在这 10 个经济体之间计算）。</div></>:<Missing/>}</div></div>
}
function Cmp({pane}:{pane:string}){
  const s=useSt(); const ids=s.compare.filter(id=>s.db.COMP[id])
  const m=(id:string)=>{ const sec=s.db.micro.sec[id]; const r=lastFY(sec,'revenue')?.slice(-1)[0]; const f=(k:keyof SecRec)=>lastFY(sec,k)?.find(x=>x.end===r?.end)?.value
    return {sec,r,gp:f('grossProfit'),ni:f('netIncome'),rd:f('rd'),cx:f('capex')} }
  const pct=(a?:number,b?:number)=>a!=null&&b?(a/b*100).toFixed(1)+'%':<Missing/>
  const series=ids.map(id=>{ const q=s.db.micro.quotes[id]; if(!q?.series.length) return null; const b=q.series[0][1]; return {name:s.db.COMP[id].zh,type:'line',showSymbol:false,data:q.series.map(([d,v])=>[d,+(v/b*100).toFixed(2)])} }).filter(Boolean)
  return <div className="dash"><h3>公司对比（最多 6 家；从检查器「+ 对比」或网络图右键加入）</h3>
    <div className="chips">{ids.map(id=><span key={id}>{s.db.COMP[id].zh} <b className="link" onClick={()=>s.setCompare(ids.filter(x=>x!==id))}>×</b></span>)}
      <select value="" onChange={e=>e.target.value&&s.setCompare([...ids,e.target.value].slice(-6))}><option value="">+ 添加公司</option>{s.db.core.companies.map(c=><option key={c.id} value={c.id}>{c.zh}</option>)}</select></div>
    <table className="grid sm"><thead><tr><th>指标</th>{ids.map(id=><th key={id}>{s.db.COMP[id].zh}</th>)}</tr></thead><tbody>
      <tr><td>市值（USD）</td>{ids.map(id=>{ const c=s.db.COMP[id]; return <td key={id}>{c.marketCap?<>{fmtUSD(c.marketCap.valueUSD)} <Cite c={c.marketCap.sources[0]} label={c.marketCap.date?.slice(0,10)}/></>:<Missing/>}</td> })}</tr>
      <tr><td>营收（USD）</td>{ids.map(id=>{ const c=s.db.COMP[id]; return <td key={id}>{c.revenue?<>{fmtUSD(c.revenue.valueUSD)} <Cite c={c.revenue.sources[0]} label={'FY'+c.revenue.fy_end?.slice(0,4)}/></>:<Missing/>}</td> })}</tr>
      {([['毛利率','gp'],['净利率','ni'],['研发强度','rd'],['资本开支/营收','cx']] as const).map(([n,k])=><tr key={k}><td>{n}（SEC）</td>{ids.map(id=>{ const x=m(id); return <td key={id}>{pct(x[k] as number|undefined,x.r?.value)}</td> })}</tr>)}
      <tr><td>财报期 / 来源</td>{ids.map(id=>{ const x=m(id); return <td key={id}>{x.r?<>{x.r.end} {x.r.form} <Cite c={{source:'SEC',url:x.sec!.filingsUrl,retrieved:''}}/></>:<Missing why="非 SEC 申报公司，A股/港股/日韩财报源待接入"/>}</td> })}</tr></tbody></table>
    <h3>近一年股价走势（期初 = 100，Yahoo Finance 周线）</h3>
    {series.length?<div style={{height:320}}><EChart id={`analysis:${pane}`} option={{tooltip:{trigger:'axis'},legend:{top:0},grid:{left:40,right:20,top:30,bottom:30},xAxis:{type:'time'},yAxis:{type:'value',scale:true},series}}/></div>:<Missing/>}
    <h3>季度营收（SEC）</h3>{(()=>{ const ss=ids.map(id=>{ const q=s.db.micro.sec[id]?.revenue?.quarterly; return q?.length?{name:s.db.COMP[id].zh+` (${s.db.micro.sec[id].revenue!.unit})`,type:'bar',data:q.map(x=>[x.end,x.value])}:null }).filter(Boolean)
      return ss.length?<div style={{height:300}}><EChart option={{tooltip:{trigger:'axis',valueFormatter:(v:number)=>fmtNum(v)},legend:{top:0},grid:{left:70,right:20,top:30,bottom:30},xAxis:{type:'time'},yAxis:{type:'value',axisLabel:{formatter:(v:number)=>fmtNum(v)}},series:ss}}/></div>:<Missing/> })()}
  </div>
}
function TS({pane}:{pane:string}){
  const s=useSt(); const {macro,micro}=s.db
  const opts=useMemo(()=>[...Object.entries(macro.fred).map(([k,v])=>({k:'fred:'+k,n:`FRED · ${v.name}`,url:v.url})),
    ...Object.entries(micro.prices?.commodities??{}).map(([k,v])=>({k:'cmd:'+k,n:`商品价格 · ${v.zh}（${v.unit}）`,url:micro.prices!.source.url})),
    ...Object.entries(macro.worldbank).map(([k,v])=>({k:'wb:'+k,n:`World Bank · ${v.name}`,url:v.url})),
    ...Object.entries(macro.imf).map(([k,v])=>({k:'imf:'+k,n:`IMF · ${v.name}`,url:v.url}))],[macro,micro])
  const [k,setK]=useState(opts[0]?.k??''); const [cs,setCs]=useState(['CHN','USA','JPN','KOR','DEU'])
  const [src,id]=k.split(':')
  let series:any[]=[]
  if(src==='fred') series=[{name:macro.fred[id].name,type:'line',showSymbol:false,data:macro.fred[id].data}]
  if(src==='cmd'){ const c=micro.prices!.commodities[id]; series=[{name:c.zh,type:'line',showSymbol:false,data:c.data.map(([d,v])=>[d.replace('M','-')+'-01',v])}] }
  if(src==='wb'||src==='imf'){ const d=(src==='wb'?macro.worldbank:macro.imf)[id].data; series=cs.filter(c=>d[c]).map(c=>({name:cn3(c),type:'line',data:d[c].map(([y,v])=>[y+'-01-01',v]),markArea:src==='imf'?{itemStyle:{color:'rgba(148,163,184,.12)'},data:[[{xAxis:`${YEAR}-01-01`,name:'预测'},{xAxis:`${YEAR+6}-01-01`}]]}:undefined})) }
  const o=opts.find(x=>x.k===k)
  return <div className="dash"><h3>时间序列 <select value={k} onChange={e=>setK(e.target.value)}>{opts.map(x=><option key={x.k} value={x.k}>{x.n}</option>)}</select> {o&&<Cite c={{source:'来源',url:o.url,retrieved:s.db.sources.generated.slice(0,10)}}/>}</h3>
    {(src==='wb'||src==='imf')&&<div className="chips">{macro.countries.map(c=><label key={c}><input type="checkbox" checked={cs.includes(c)} onChange={e=>setCs(e.target.checked?[...cs,c]:cs.filter(x=>x!==c))}/>{cn3(c)}</label>)}</div>}
    {series.length?<div style={{height:420}}><EChart id={`analysis:${pane}`} option={{tooltip:{trigger:'axis'},legend:{top:0},dataZoom:[{type:'inside'},{type:'slider',height:18,bottom:4}],grid:{left:60,right:20,top:30,bottom:50},xAxis:{type:'time'},yAxis:{type:'value',scale:true,axisLabel:{formatter:(v:number)=>Math.abs(v)>=1e6?fmtNum(v):v}},series}}/></div>:<Missing/>}
    {micro.prices?.missing&&<div className="small muted">暂缺价格：{Object.entries(micro.prices.missing).map(([k,v])=>`${k}（${v}）`).join('；')}</div>}
  </div>
}

function Trade({ind,pane}:{ind:string;pane:string}){
  const s=useSt(); const t=s.db.macro.trade; const [hs,setHs]=useState(HS_OF[ind]||'8542')
  const flows=(t?.flows||[]).filter(f=>f.hs===hs)
  const byExp:Record<string,number>={}
  const byPair:Record<string,{from:string;to:string;value:number;year:number}>={}
  flows.forEach(f=>{ byExp[f.from]=(byExp[f.from]||0)+f.value; const k=f.from+'>'+f.to; if(!byPair[k]||f.value>byPair[k].value) byPair[k]={from:f.from,to:f.to,value:f.value,year:f.year} })
  const exp=Object.entries(byExp).sort((a,b)=>b[1]-a[1]); const sum=exp.reduce((a,[,v])=>a+v,0)||1
  const hhi=Math.round(exp.reduce((a,[,v])=>a+(v/sum*100)**2,0))
  const topPairs=Object.values(byPair).sort((a,b)=>b.value-a.value).slice(0,15)
  const tree={name:'出口',children:exp.map(([k,v])=>({name:cn3(k),value:v}))}
  const opt={tooltip:{formatter:(p:any)=>`${p.name}<br/>${fmtUSD(p.value)}（${(p.value/sum*100).toFixed(1)}%）`},series:[{type:'treemap',roam:false,nodeClick:false,breadcrumb:{show:false},label:{formatter:'{b}\n{c}'},data:tree.children,levels:[{itemStyle:{borderColor:'#0f172a',borderWidth:2,gapWidth:2}}]}]}
  return <div className="dash"><h3>贸易结构（OEC 风格 · UN Comtrade） HS <select value={hs} onChange={e=>setHs(e.target.value)}>{Object.entries(t?.hs??{}).map(([k,v])=><option key={k} value={k}>{k} {v}</option>)}</select> {t&&<Cite c={t.source}/>}</h3>
    <div className="cards"><div className="kpi"><div className="kn">样本出口合计</div><div className="kv2">{fmtUSD(sum)}</div></div>
      <div className="kpi"><div className="kn">出口方 HHI（样本内）</div><div className="kv2">{hhi}</div><div className="small">{hhi>=2500?'高度集中':hhi>=1500?'中度':'分散'}</div></div>
      <div className="kpi"><div className="kn">流向条数</div><div className="kv2">{flows.length}</div></div></div>
    <div className="two"><div><h4>出口国份额（treemap）</h4>{exp.length?<div style={{height:360}}><EChart id={`trade:${pane}`} option={opt}/></div>:<Missing/>}</div>
      <div><h4>最大双边流向 Top 15</h4><table className="grid sm"><thead><tr><th>出口</th><th>进口</th><th>金额</th><th>年</th></tr></thead><tbody>
        {topPairs.map(p=><tr key={p.from+p.to}><td>{cn3(p.from)}</td><td>{cn3(p.to)}</td><td>{fmtUSD(p.value)}</td><td>{p.year}</td></tr>)}</tbody></table>
        <div className="small muted">仅覆盖已拉取的申报经济体（见数据源页），非全球全量；对标 OEC 的出口国 treemap + 流向表范式。</div></div></div></div>
}
