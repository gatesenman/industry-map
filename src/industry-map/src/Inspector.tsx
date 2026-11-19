import { Star, Route, Share2 } from 'lucide-react'
import { useSt, useSlice } from './store'
import { Cite, Missing, Grade, VBadge, RGrade } from './ui'
import { SplcPanel, relMeta, AgeBadge, TierPanel, exportEvidence, EndBadge, QuantBadge } from './RelPanel'
import { cn2, fmtUSD, fmtNum, REL_COLOR, concentration } from './data'
export default function Inspector(){
  const s=useSt(); const {db,sel}=s; const sl=useSlice(s.ind)
  if(!sel) return <div className="insp"><h3 className="ih">检查器</h3><p className="muted">在任一视图、导航树或命令面板中选择环节/公司以查看属性、来源与关系。</p>
    {s.multi.length>0&&<><h4>框选集合（{s.multi.length}）</h4>{s.multi.map(id=>db.COMP[id]&&<div key={id} className="link" onClick={()=>s.setSel({kind:'company',id})}>{db.COMP[id].zh}</div>)}
      <button className="tb" onClick={()=>{s.setCompare(s.multi.slice(0,6));s.setView('analysis')}}>加入公司对比</button></>}
    <h4>当前产业概况</h4><div className="kv"><span>公司</span><span>{sl.comps.length}</span><span>环节</span><span>{sl.segs.length}</span><span>关系</span><span>{sl.rels.length}</span>
      <span>卡脖子环节</span><span>{sl.segs.filter(x=>concentration(db,x.id).choke).map(x=>x.name).join('、')||'—'}</span></div></div>
  if(sel.kind==='segment'){ const g=db.SEG[sel.id]; if(!g) return null; const cc=concentration(db,g.id); const cs=db.core.companies.filter(c=>c.segments.includes(g.id))
    const rev=cs.reduce((a,c)=>a+(c.revenue?.valueUSD??0),0)
    return <div className="insp"><div className="muted">环节 · {db.core.industries.find(i=>i.id===g.industry)?.zh} › {g.sub} · {g.tier}</div><h3 className="ih">{g.name}</h3>
      <h4>国家集中度（HHI，{cc.basis}）{cc.choke&&<span className="choke">卡脖子</span>}</h4>
      <div className="kv"><span>HHI</span><span>{cc.hhi}{cc.hhi>=2500?'（高度集中）':cc.hhi>=1500?'（中度集中）':'（分散）'}</span><span>第一</span><span>{cc.top?`${cn2(cc.top[0])} ${(cc.top[1]*100).toFixed(0)}%`:'—'}</span></div>
      {cc.shares.map(([k,v])=><div key={k} className="bar"><span>{cn2(k)}</span><i style={{width:`${v*100}%`}}/><em>{(v*100).toFixed(0)}%</em></div>)}
      <div className="muted small">HHI 基于本库样本公司{cc.basis==='营收加权'?'的最新年报营收（SEC/Wikidata，含来源）':'数量'}，非全行业份额。{(cc as any).top5n>0&&<> · 样本内 { (cc as any).top5n } 家公司年报前五大客户占比中位数 {((cc as any).top5Cust*100).toFixed(1)}%</>}</div>
      <h4>上游</h4>{db.core.segmentLinks.filter(l=>l.to===g.id).map(l=><div key={l.from} className="link" onClick={()=>s.setSel({kind:'segment',id:l.from})}>← {db.SEG[l.from].name}</div>)}
      <h4>下游</h4>{db.core.segmentLinks.filter(l=>l.from===g.id).map(l=><div key={l.to} className="link" onClick={()=>s.setSel({kind:'segment',id:l.to})}>→ {db.SEG[l.to].name}</div>)}
      <h4>公司（{cs.length}）· 样本营收合计 {rev?fmtUSD(rev):'缺失'}</h4>
      {cs.sort((a,b)=>(b.revenue?.valueUSD??0)-(a.revenue?.valueUSD??0)).map(c=><div key={c.id} className="row"><span className="link" onClick={()=>s.setSel({kind:'company',id:c.id})}>{c.zh}</span><Grade g={c.quality}/><span className="muted">{cn2(c.country)}</span><span className="r">{c.revenue?fmtUSD(c.revenue.valueUSD):<Missing/>}</span></div>)}
    </div> }
  const c=db.COMP[sel.id]; if(!c) return null
  const sec=db.micro.sec[c.id], q=db.micro.quotes[c.id]
  const rels=db.core.relations.filter(r=>r.from===c.id||r.to===c.id)
  const last=(k:'revenue'|'netIncome'|'grossProfit'|'rd'|'capex')=>sec?.[k]?.annual?.slice(-1)[0]
  return <div className="insp">
    <div className="muted">公司 · {cn2(c.country)}</div>
    <h3 className="ih">{c.zh} <Grade g={c.quality}/> <button className="icon" title="收藏" onClick={()=>s.toggleFav(c.id)}><Star size={15} fill={s.favs.includes(c.id)?'#fbbf24':'none'} color="#fbbf24"/></button></h3>
    <div className="muted">{c.en}</div>
    {(c as any).delisted&&<div className="warn small">已摘牌/终止注册：<a href={(c as any).delisted.url} target="_blank" rel="noreferrer">{(c as any).delisted.source} {(c as any).delisted.date}</a>（行情与代码字段已降为 X）</div>}
    <div className="btnrow"><button className="tb" onClick={()=>s.setView('network')}><Share2 size={13}/> 网络</button>
      <button className="tb" onClick={()=>{ s.setPathPair([c.id, s.pathPair?.[0]&&s.pathPair[0]!==c.id?s.pathPair[0]:'']); s.toast('已设为路径起点；在网络图右键另一公司「查找路径」') }}><Route size={13}/> 路径起点</button>
      <button className="tb" onClick={()=>{ if(!s.compare.includes(c.id)) s.setCompare([...s.compare,c.id].slice(-6)); s.toast('已加入公司对比') }}>+ 对比</button></div>
    <h4>身份</h4><div className="kv">
      <span>上市</span><span>{c.listings.map(l=><span key={l.yahoo}>{l.exchange}:{l.ticker} </span>)||c.exchange}<Cite c={c.identity} label="名录"/> <VBadge v={c.verify?.ticker}/></span>
      <span>ISIN</span><span>{c.isin?<>{c.isin.value.join(', ')} <Cite c={c.isin}/> <VBadge v={c.verify?.isin}/></>:<Missing/>}</span>
      <span>LEI</span><span>{c.lei?<>{c.lei.value} <Cite c={c.lei}/> <VBadge v={c.verify?.lei}/></>:<Missing/>}</span>
      <span>法定名称</span><span>{c.gleif?<>{c.gleif.legalName} <Cite c={{source:'GLEIF',url:c.gleif.url,retrieved:''}}/></>:<Missing/>}</span>
      <span>注册地</span><span>{c.gleif?`${c.gleif.jurisdiction} · ${c.gleif.hqCity??''}`:<Missing/>}</span><span>运营地</span><span>{cn2(c.country)} <VBadge v={c.verify?.country}/></span>
      <span>总部</span><span>{c.countrySplit?.headquarters?cn2(c.countrySplit.headquarters):<Missing/>}</span>
      <span>注册地(LEI)</span><span>{c.countrySplit?.registered?<>{c.countrySplit.registered}{c.gleif?` · ${c.gleif.jurisdiction}`:''}</>:<Missing/>}</span>
      <span>官网</span><span>{c.website?<a href={c.website.value} target="_blank" rel="noreferrer">{c.website.value.replace(/^https?:\/\//,'').slice(0,32)}</a>:<Missing/>}</span>
      <span>成立</span><span>{c.inception?c.inception.value.slice(0,4):<Missing/>}</span>
      <span>Wikidata</span><span>{c.wikidata?<a href={c.wikidata} target="_blank" rel="noreferrer">{c.qid}</a>:<Missing why="未匹配到 Wikidata 实体"/>}</span>
      <span>百科</span><span>{c.enwiki?<a href={c.enwiki} target="_blank" rel="noreferrer">EN</a>:'—'} {c.zhwiki&&<a href={c.zhwiki} target="_blank" rel="noreferrer">中文</a>}</span></div>
    <h4>行情与规模</h4><div className="kv">
      <span>股价</span><span>{q?<>{q.price} {q.currency} <span className="muted">{q.time}</span> <Cite c={{source:'Yahoo Finance',url:q.url,retrieved:q.time}}/></>:<Missing/>}</span>
      <span>市值</span><span>{c.marketCap?<>{fmtUSD(c.marketCap.valueUSD)} <span className="muted" title={c.marketCap.method}>{c.marketCap.date}</span> {c.marketCap.sources.map((x,i)=><Cite key={i} c={x}/>)} <VBadge v={c.verify?.marketCap}/></>:<Missing why={s.f.verified?'未通过验证（仅已验证视图）':undefined}/>}</span>
      <span>营收</span><span>{c.revenue?<>{fmtUSD(c.revenue.valueUSD)} <span className="muted" title={c.revenue.method}>FY {c.revenue.fy_end}</span> {c.revenue.sources.map((x,i)=><Cite key={i} c={x}/>)} <VBadge v={c.verify?.revenue}/></>:<Missing why={s.f.verified?'未通过验证（仅已验证视图）':undefined}/>}</span></div>
    {sec&&<><h4>SEC 财报（最新年度，{sec.revenue?.unit??''}）<Cite c={{source:'EDGAR',url:sec.filingsUrl,retrieved:''}}/></h4><div className="kv">
      {([['revenue','营收'],['grossProfit','毛利'],['netIncome','净利润'],['rd','研发'],['capex','资本开支']] as const).map(([k,n])=>{ const a=last(k); return [<span key={k}>{n}</span>,<span key={k+'v'}>{a?<>{fmtNum(a.value)} <span className="muted">{a.end} {a.form}</span></>:<Missing/>}</span>] })}
      <span>毛利率</span><span>{last('revenue')&&last('grossProfit')&&last('revenue')!.end===last('grossProfit')!.end?((last('grossProfit')!.value/last('revenue')!.value)*100).toFixed(1)+'%':<Missing/>}</span></div></>}
    <h4>主要产品</h4><div className="chips">{c.products.map(p=><span key={p.name} title="种子名录">{p.name}</span>)}{c.wd_products?.value.map(p=><span key={p} className="wd" title="来自 Wikidata P1056">{p}</span>)}</div>
    {c.wd_products&&<div className="small muted">蓝色标签来自 <Cite c={c.wd_products}/></div>}
    {c.wd_parent&&<><h4>母公司</h4><div>{c.wd_parent.value.join('、')} <Cite c={c.wd_parent}/></div></>}
    {c.wd_subsidiaries&&<><h4>子公司（{c.wd_subsidiaries.value.length}）</h4><div className="small">{c.wd_subsidiaries.value.join('、')} <Cite c={c.wd_subsidiaries}/></div></>}
    <h4>所在环节</h4>{c.segments.map(x=><div key={x} className="link" onClick={()=>{s.setInd(db.SEG[x].industry);s.setSel({kind:'segment',id:x})}}>{db.core.industries.find(i=>i.id===db.SEG[x].industry)?.zh} › {db.SEG[x].sub} › {db.SEG[x].name}</div>)}
    {c.filingTop5&&<><h4>年报前五大集中度 <Cite c={c.filingTop5.source} label={c.filingTop5.date}/></h4>
      <div className="kv"><span>前五大客户占比</span><span>{c.filingTop5.customerShare!=null?(c.filingTop5.customerShare*100).toFixed(1)+'%':<Missing/>}</span>
        <span>前五大供应商占比</span><span>{c.filingTop5.supplierShare!=null?(c.filingTop5.supplierShare*100).toFixed(1)+'%':<Missing/>}</span></div>
      <div className="small muted">名称常被年报匿名为「第一名」；占比来自交易所定期报告 PDF 原文。{c.filingTop5.title&&<>来源：{c.filingTop5.title}</>}</div></>}
    <h4>供应链（SPLC 式双栏）<button className="tb" style={{marginLeft:8}} title="导出该公司全部关系与一手原句（Markdown）" onClick={()=>exportEvidence(c.id,db,db.audit)}>导出证据包</button></h4><SplcPanel cid={c.id}/>
    <h4>N 层上游追溯</h4><TierPanel cid={c.id}/>
    <h4>关系明细（{rels.length}）</h4>
    {rels.map((r,i)=>{ const o=r.from===c.id?r.to:r.from; return <div key={i} className="rel"><b style={{color:REL_COLOR[r.type]}}>{r.type}</b> {r.from===c.id?'→':'←'} <span className="link" onClick={()=>s.setSel({kind:'company',id:o})}>{db.COMP[o].zh}</span>
      <RGrade g={r.grade} conf={r.conf}/>{r.auto&&<span className="ab abD" title="本机更新器从 SEC 年报原文自动抽取，尚未人工复核">自动·待复核</span>} <AgeBadge m={relMeta(r,db)}/><EndBadge r={r}/><QuantBadge r={r}/> <span className={r.status==='已引用'?'ok':'warn'}>{r.status}</span>{r.audit&&<span className={r.audit.verdict==='correct'?'ok small':'warn small'} title={r.audit.comment}> 抽检{r.audit.verdict==='correct'?'✓':'✗'}</span>}
      {r.evidence.map((e,j)=><div key={j} className={'small'+(e.rejected?' rej':'')}><Cite c={e} label={e.form?`${e.source} ${e.form} ${e.date}`:undefined}/>{e.rejected&&<span className="warn"> 已否决</span>}{(e as any).listedAs&&<span className="small"> 名单原文：{(e as any).listedAs}</span>}{e.quote&&<q>{e.quote.slice(0,260)}</q>}</div>)}
      {!r.evidence.length&&<div className="small muted">{(r as any).review?'人工复核：'+(r as any).review:r.note+'（未找到可引用公开来源，待核实）'}</div>}</div> })}
    {!rels.length&&<div className="muted">暂无收录关系</div>}
  </div>
}
