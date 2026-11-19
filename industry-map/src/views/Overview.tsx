import { useSt } from '../store'
import { TIERS, TIER_COLOR, concentration, fmtUSD } from '../data'
import { AlertTriangle } from 'lucide-react'
export default function Overview(){
  const s=useSt(); const {db}=s
  return <div className="overview">{db.core.industries.map(i=>{ const ss=db.core.segments.filter(x=>x.industry===i.id); const cs=db.core.companies.filter(c=>c.industries.includes(i.id))
    const choke=ss.filter(x=>concentration(db,x.id).choke); const mc=cs.reduce((a,c)=>a+(c.marketCap?.valueUSD??0),0), nmc=cs.filter(c=>c.marketCap).length
    const rels=db.core.relations.filter(r=>cs.some(c=>c.id===r.from||c.id===r.to))
    return <div className="card" key={i.id} onClick={()=>{s.setInd(i.id);s.setView('flow');s.setSel(null)}}>
      <h2>{i.zh} <small>{i.en}</small></h2>
      <div className="stats"><div><b>{[...new Set(ss.map(x=>x.sub))].length}</b>二级分类</div><div><b>{ss.length}</b>环节</div><div><b>{cs.length}</b>公司</div><div><b>{new Set(cs.map(c=>c.country)).size}</b>国家/地区</div><div><b>{rels.length}</b>关系</div></div>
      <div className="muted small">样本市值合计 {mc?fmtUSD(mc):'缺失'}（{nmc}/{cs.length} 家有可引用市值）</div>
      {TIERS.map(t=><div key={t} className="chips"><b style={{color:TIER_COLOR[t]}}>{t}</b>{[...new Set(ss.filter(x=>x.tier===t).map(x=>x.sub))].map(sb=><span key={sb}>{sb}</span>)}</div>)}
      {choke.length>0&&<div className="small" style={{marginTop:8,color:'#f87171'}}><AlertTriangle size={12}/> 高集中度环节：{choke.map(x=>x.name).join('、')}</div>}
      <div className="muted small" style={{marginTop:6}}>代表公司：{cs.filter(c=>c.marketCap).sort((a,b)=>b.marketCap!.valueUSD-a.marketCap!.valueUSD).slice(0,8).map(c=>c.zh).join('、')||cs.slice(0,8).map(c=>c.zh).join('、')}</div></div> })}
  </div>
}
