import { useState } from 'react'
import { useSt } from './store'
import { RGrade } from './ui'
import { REL_COLOR, type Rel } from './data'
/** v1.6：借鉴 Bloomberg SPLC（供应商/客户双栏 + 证据透明度弹窗、关系 4 年时效）与 FactSet Revere（直接披露/反向披露、类型分类） */
export const GR:Record<string,number>={A:4,B:3,C:2,X:1,'待核实':0}
export function relMeta(r:Rel, db:any){
  const ev=r.evidence.filter(e=>!e.rejected)
  const dates=ev.map(e=>e.date).filter(Boolean).map(d=>String(d).length===7?d+'-01':String(d)) as string[]
  const latest=dates.sort().slice(-1)[0]
  const age=latest?(Date.parse('2026-10-22')-Date.parse(latest))/(365.25*864e5):null
  const cikOf=(id:string)=>{ const c=db.COMP[id]; const v=c?.cik?.value??c?.cik; return v?String(+v):'' }
  let by:''|'from'|'to'|'third'=''
  for(const e of ev){ const m=/edgar\/data\/(\d+)\//.exec(e.url||''); if(!m) continue
    by=m[1]===cikOf(r.from)?'from':m[1]===cikOf(r.to)?'to':'third'; break }
  return {latest,age,stale:age!=null&&age>4,by,nev:ev.length}
}
export function EndBadge({r}:{r:any}){ const e=r?.ended; if(!e) return null; return <a className={'ab '+(e.status==='部分终止'?'abS':'abE')} href={e.url} target="_blank" rel="noreferrer" title={`${e.status}（${e.date}）\n${e.basis}\n${e.source}：“${e.quote}”`}>{e.status} {e.date}</a> }
export function QuantBadge({r}:{r:any}){ const q=r?.quant; if(!q) return null; return <span className="ab abD" title={`${q.metric} ${(q.value*100).toFixed(1)}%（${q.amount}，${q.period}）`}>{q.metric} {(q.value*100).toFixed(1)}%</span> }
export function AgeBadge({m}:{m:ReturnType<typeof relMeta>}){
  if(!m.latest) return <span className="ab abN" title="证据无披露日期">日期未知</span>
  return <span className={'ab '+(m.stale?'abS':'abF')} title={`最新证据披露日 ${m.latest}${m.stale?'\n超过 4 年（参考 Bloomberg SPLC 关系保留期），关系可能已结束':''}`}>{m.latest.slice(0,7)}{m.stale?' · 可能过期':''}</span>
}
export function SplcPanel({cid}:{cid:string}){
  const s=useSt(); const db=s.db; const [types,setTypes]=useState<string[]>([])
  const rels=db.core.relations.filter((r:Rel)=>r.from===cid||r.to===cid)
  const allT=[...new Set(rels.map((r:Rel)=>r.type))] as string[]
  const vis=rels.filter((r:Rel)=>!types.length||types.includes(r.type))
  const sup=vis.filter((r:Rel)=>r.to===cid&&['供货','授权'].includes(r.type))
  const cus=vis.filter((r:Rel)=>r.from===cid&&['供货','授权'].includes(r.type))
  const oth=vis.filter((r:Rel)=>!['供货','授权'].includes(r.type))
  const sort=(a:Rel,b:Rel)=>(GR[b.grade??'待核实']??0)-(GR[a.grade??'待核实']??0)||String(relMeta(b,db).latest??'').localeCompare(String(relMeta(a,db).latest??''))
  const item=(r:Rel)=>{ const o=r.from===cid?r.to:r.from; const m=relMeta(r,db); const e=r.evidence.find(x=>!x.rejected)
    const byTxt=m.by==='from'?(r.from===cid?'本方披露':'对方披露'):m.by==='to'?(r.to===cid?'本方披露':'对方披露'):m.by==='third'?'第三方披露':''
    return <div key={r.from+r.to+r.type} className="splc-i evh">
      <span className="link" onClick={()=>s.setSel({kind:'company',id:o})}>{db.COMP[o]?.zh??o}</span> <b style={{color:REL_COLOR[r.type],fontWeight:500}} className="small">{r.type}</b> <RGrade g={r.grade} conf={r.conf}/>{r.auto&&<span className="ab abD" title="本机更新器从 SEC 年报原文自动抽取，尚未人工复核">自动·待复核</span>} <AgeBadge m={m}/><EndBadge r={r}/><QuantBadge r={r}/>{byTxt&&<span className="ab abD" title="参考 FactSet Revere：直接披露 / 反向披露">{byTxt}</span>}
      {e&&<div className="evpop"><b>{e.source}{e.form?' '+e.form:''}</b> {e.date||e.retrieved}{(e as any).listedAs&&<div>名单原文：{(e as any).listedAs}</div>}{(e as any).note&&<div className="muted">{(e as any).note}</div>}<q>{e.quote||'（无原句）'}</q><br/><a href={e.url} target="_blank" rel="noreferrer">{e.url.slice(0,80)}</a>{m.nev>1&&<div className="muted">另有 {m.nev-1} 条证据，见下方关系明细</div>}</div>}</div> }
  const col=(t:string,a:Rel[])=><div className="splc-c"><div className="splc-h">{t}（{a.length}）</div>{a.sort(sort).map(item)}{!a.length&&<div className="muted small">—</div>}</div>
  const stale=rels.filter((r:Rel)=>relMeta(r,db).stale).length
  return <div className="splc">
    <div className="chips">{allT.map(t=><span key={t} className={'chipbtn'+(types.includes(t)?' on':'')} style={{borderColor:REL_COLOR[t]}} onClick={()=>setTypes(x=>x.includes(t)?x.filter(y=>y!==t):[...x,t])}>{t}</span>)}{types.length>0&&<span className="chipbtn" onClick={()=>setTypes([])}>全部</span>}</div>
    <div className="splc-g">{col('供应商 / 授权方（上游）',sup)}{col('客户 / 被授权方（下游）',cus)}</div>{col('竞争 · 合资 · 股权',oth)}
    {stale>0&&<div className="small warn">{stale} 条关系的最新证据超过 4 年，可能已结束，建议复核。</div>}
  </div>
}

/** v1.7：借鉴 Altana / Sayari 的 N 层上游追溯与单一来源识别（仅基于本库收录关系） */
export function TierPanel({cid}:{cid:string}){
  const s=useSt(); const db=s.db; const [depth,setDepth]=useState(3); const [ab,setAb]=useState(true)
  const ok=(r:Rel)=>['供货','授权'].includes(r.type)&&(!ab||['A','B'].includes(r.grade??''))
  const seen=new Set([cid]); let frontier=[{id:cid,min:4}]; const tiers:{id:string;via:string;min:number;r:Rel}[][]=[]
  for(let d=0;d<depth&&frontier.length;d++){ const nxt:{id:string;via:string;min:number;r:Rel}[]=[]
    for(const f of frontier) for(const r of db.core.relations as Rel[]) if(r.to===f.id&&ok(r)&&!seen.has(r.from)){ seen.add(r.from); nxt.push({id:r.from,via:f.id,min:Math.min(f.min,GR[r.grade??'待核实']??0),r}) }
    if(!nxt.length) break; tiers.push(nxt); frontier=nxt }
  const segName=(id:string)=>{ const c=db.COMP[id]; const sg=c?.segments?.[0]; return sg?db.SEG[sg]?.name??sg:'—' }
  const t1=tiers[0]??[]; const bySeg:Record<string,string[]>={}; t1.forEach(x=>{ const k=segName(x.id); (bySeg[k]=bySeg[k]??[]).push(x.id) })
  const single=Object.entries(bySeg).filter(([,v])=>v.length===1)
  const gl=['待核实','X','C','B','A']
  return <div>
    <div className="small">层数 <select value={depth} onChange={e=>setDepth(+e.target.value)}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select> <label><input type="checkbox" checked={ab} onChange={e=>setAb(e.target.checked)}/> 只走 A/B 级关系</label></div>
    {tiers.map((t,i)=><div key={i} className="splc-c"><div className="splc-h">第 {i+1} 层供应商（{t.length}）</div>{t.map(x=><div key={x.id} className="splc-i"><span className="link" onClick={()=>s.setSel({kind:'company',id:x.id})}>{db.COMP[x.id]?.zh}</span> <span className="muted small">{segName(x.id)}{i>0?` → ${db.COMP[x.via]?.zh}`:''}</span> <span className="small" title="整条路径上最弱的一环">路径最弱 {gl[x.min]}</span></div>)}</div>)}
    {!tiers.length&&<div className="muted small">本库暂无{ab?' A/B 级':''}上游供货关系。</div>}
    {single.length>0&&<div className="small warn">单一来源（库内）：{single.map(([k,v])=>`${k}：${db.COMP[v[0]]?.zh}`).join('；')}。这只说明本库只收录到一家，不代表现实中只有一家供应商。</div>}
    <div className="muted small">只基于本库收录并带出处的关系，不是完整供应链。</div>
  </div>
}

/** v1.7：借鉴 Sayari「证据包」——导出该公司全部关系及一手原句（Markdown） */
export function exportEvidence(cid:string, db:any, audit:any){
  const c=db.COMP[cid]; const rels=(db.core.relations as Rel[]).filter(r=>r.from===cid||r.to===cid)
  const L=[`# 证据包：${c.zh}（${c.en}）`,`导出时间：${new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}（北京时间）· 数据版本 ${db.core.meta?.version??''}`,
    audit?.relationsVerified?`本版抽检：A/B 级关系 ${audit.relationsVerified.correct}/${audit.relationsVerified.n} 正确，95% 置信区间 ${(audit.relationsVerified.ci95[0]*100).toFixed(2)}%–${(audit.relationsVerified.ci95[1]*100).toFixed(2)}%`:'','',
    '| 方向 | 对方 | 类型 | 等级 | 最新披露 | 披露方 |','|---|---|---|---|---|---|']
  rels.forEach(r=>{ const o=r.from===cid?r.to:r.from; const m=relMeta(r,db); L.push(`| ${r.from===cid?'→':'←'} | ${db.COMP[o]?.zh} | ${r.type} | ${r.grade??'—'} | ${m.latest??'未知'}${m.stale?'（可能过期）':''} | ${m.by==='from'?db.COMP[r.from]?.zh:m.by==='to'?db.COMP[r.to]?.zh:m.by==='third'?'第三方':'—'} |`) })
  L.push('','## 原文证据')
  rels.forEach(r=>{ L.push('',`### ${db.COMP[r.from]?.zh} → ${db.COMP[r.to]?.zh}（${r.type}，${r.grade??'—'}）`,r.note||'')
    const ev=r.evidence.filter(e=>!e.rejected); if(!ev.length) L.push('- 暂无可引用来源（待核实）')
    ev.forEach(e=>L.push(`- **${e.source}${e.form?' '+e.form:''}**（${e.date??e.retrieved??''}）：“${e.quote??'（无原句，仅链接）'}”  `,`  ${e.url}`)) })
  const b=new Blob([L.join('\n')],{type:'text/markdown;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`证据包_${c.zh}_${(db.core.meta?.version??'')}.md`; a.click(); URL.revokeObjectURL(a.href)
}
