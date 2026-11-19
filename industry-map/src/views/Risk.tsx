import { useSt, useSlice } from '../store'
import { concentration, cn2, pct } from '../data'
export default function Risk({ind}:{ind:string;pane:string}){
  const s=useSt(); const sl=useSlice(ind)
  const rows=sl.segs.map(g=>{ const c=concentration(s.db,g.id)
    const ids=new Set(s.db.core.companies.filter(x=>x.segments.includes(g.id)).map(x=>x.id))
    const sup=s.db.core.relations.filter(r=>r.type==='供货'&&ids.has(r.from))
    const ab=sup.filter(r=>r.grade==='A'||r.grade==='B').length
    return {g,c,sup:sup.length,ab} }).sort((a,b)=>b.c.hhi-a.c.hhi)
  const lvl=(h:number)=>h>=5000?['极高','#ef4444']:h>=2500?['高','#f97316']:h>=1500?['中','#eab308']:['低','#22c55e']
  return <div className="scroll" style={{padding:14}}>
    <h3>链条风险 / 集中度视图</h3>
    <div className="muted small">HHI 按环节内公司所在国计算（营收加权优先，否则按公司数；样本为本库收录公司，非全行业）。≥2500 视为高度集中；卡脖子标记 = HHI≥3500 且首位国家份额≥60% 且样本≥4。</div>
    <table className="grid" style={{marginTop:8}}><thead><tr><th>环节</th><th>层级</th><th>样本</th><th>HHI</th><th>风险</th><th>首位国家/地区</th><th>口径</th><th>供货关系（A/B）</th><th>前五大客户占比中位</th></tr></thead>
    <tbody>{rows.map(({g,c,sup,ab})=>{ const [t,col]=lvl(c.hhi); return <tr key={g.id} className="link" onClick={()=>s.setSel({kind:'segment',id:g.id})}>
      <td>{c.choke&&'⚠ '}{g.name}</td><td>{g.tier}</td><td>{c.n}</td><td>{c.hhi}</td><td><span style={{color:col,fontWeight:600}}>{t}</span></td>
      <td>{c.top?`${cn2(c.top[0])} ${pct(c.top[1])}`:'—'}</td><td>{c.basis}</td><td>{sup}（{ab}）</td><td>{c.top5Cust!=null?pct(c.top5Cust)+` (n=${c.top5n})`:'—'}</td></tr>})}</tbody></table>
  </div>
}
