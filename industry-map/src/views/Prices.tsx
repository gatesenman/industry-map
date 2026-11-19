import { useSt } from '../store'
type Row={item:string;high:number;low:number;avg:number;unit:string;per:string;industry:string}
export default function Prices({ind}:{ind:string;pane:string}){
  const s=useSt(); const cm:any=(s.db as any).commodities||{}; const series:any[]=cm.series||[]
  const mp=s.db.micro.prices
  return <div className="scroll" style={{padding:14}}>
    <h3>大宗/现货价格面板 <span className="muted small">（每个数值附来源、取数日与等级；未能合法获取的来源列于数据源页）</span></h3>
    {series.map((se,i)=>{ const rows:Row[]=(se.rows||[]).filter((r:Row)=>ind==='pv'||ind==='ess'||true)
      return <div key={i} className="card" style={{marginBottom:12}}>
        <div><b>{se.source}</b> <span className="badge">等级 {se.grade}</span> <a href={se.url} target="_blank" rel="noreferrer">来源 ↗</a> <span className="muted small">取数 {se.retrieved} · {se.dateNote}</span></div>
        <table className="grid"><thead><tr><th>品目</th><th>低</th><th>高</th><th>均价</th><th>单位</th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.item}><td>{r.item}</td><td>{r.low}</td><td>{r.high}</td><td><b>{r.avg}</b></td><td>{r.unit}/{r.per}</td></tr>)}</tbody></table></div> })}
    {mp&&<div className="card"><div><b>已有商品价格序列</b> <a href={mp.source?.url} target="_blank" rel="noreferrer">{mp.source?.source} ↗</a></div>
      <table className="grid"><thead><tr><th>品种</th><th>最新日期</th><th>最新值</th><th>单位</th></tr></thead><tbody>
      {Object.entries(mp.commodities||{}).map(([k,v])=>{ const last=v.data[v.data.length-1]; return <tr key={k}><td>{v.zh}</td><td>{last?.[0]}</td><td>{last?.[1]}</td><td>{v.unit}</td></tr>})}</tbody></table></div>}
    {!series.length&&!mp&&<div className="muted">暂无价格数据</div>}
  </div>
}
