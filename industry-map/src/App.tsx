import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Search, Sun, Moon, Columns2, Download, Star, Database, Command, ChevronRight, ChevronDown, Layers, GitBranch, Share2, Globe2, Map, LayoutGrid, Waves, Table2, BarChart3, Home, Network, AlertTriangle, Route, ShieldAlert, TrendingUp, Link2, HelpCircle } from 'lucide-react'
import { loadDB, type DB, TIERS, TIER_COLOR, cn2, concentration } from './data'
import { Provider, useSt, VIEWS, type ViewId, exporters, download, downloadText, useSlice } from './store'
import Inspector from './Inspector'
import Palette from './Palette'
import Tour from './Tour'
const V:Record<string,React.LazyExoticComponent<React.ComponentType<{ind:string;pane:string}>>>={
  overview:lazy(()=>import('./views/Overview')), flow:lazy(()=>import('./views/FlowG6')), network:lazy(()=>import('./views/NetworkG6')),
  tree:lazy(()=>import('./views/Charts').then(m=>({default:m.Sunburst}))), map:lazy(()=>import('./views/Charts').then(m=>({default:m.WorldMap}))),
  treemap:lazy(()=>import('./views/Charts').then(m=>({default:m.Treemap}))), sankey:lazy(()=>import('./views/Charts').then(m=>({default:m.Sankey}))),
  globe:lazy(()=>import('./views/Globe')), table:lazy(()=>import('./views/TableView')), analysis:lazy(()=>import('./views/Analysis')), risk:lazy(()=>import('./views/Risk')), prices:lazy(()=>import('./views/Prices')), sources:lazy(()=>import('./views/Sources')) }
const ICON:Record<string,React.ReactNode>={overview:<Home size={14}/>,flow:<GitBranch size={14}/>,tree:<Layers size={14}/>,network:<Share2 size={14}/>,map:<Map size={14}/>,globe:<Globe2 size={14}/>,treemap:<LayoutGrid size={14}/>,sankey:<Waves size={14}/>,table:<Table2 size={14}/>,analysis:<BarChart3 size={14}/>,sources:<Database size={14}/>,risk:<ShieldAlert size={14}/>,prices:<TrendingUp size={14}/>}

function PathBar(){
  const s = useSt()
  const [to, setTo] = useState('')
  const from = s.pathPair?.[0] || ''
  const opts = s.db.core.companies
  return (
    <span className="pathbar" title="P: set path ends">
      <Route size={13} /> 路径
      <select value={from} onChange={e => s.setPathPair([e.target.value, s.pathPair?.[1] || ''])} style={{ maxWidth: 110 }}>
        <option value="">起点</option>
        {opts.slice().sort((a, b) => a.zh.localeCompare(b.zh, 'zh')).map(c => <option key={c.id} value={c.id}>{c.zh}</option>)}
      </select>
      <span>→</span>
      <select value={s.pathPair?.[1] || to} onChange={e => { setTo(e.target.value); if (from) { s.setPathPair([from, e.target.value]); s.setView('network') } }} style={{ maxWidth: 110 }}>
        <option value="">终点</option>
        {opts.slice().sort((a, b) => a.zh.localeCompare(b.zh, 'zh')).map(c => <option key={c.id} value={c.id}>{c.zh}</option>)}
      </select>
      {from && s.pathPair?.[1] && <button className="tb" onClick={() => { s.setView('network'); s.toast('请在网络图查看高亮路径') }}>打开网络</button>}
    </span>
  )
}
function HelpModal(){
  const s = useSt()
  if (!s.helpOpen) return null
  const rows: [string, string][] = [
    ['1-0', '切换视图'], ['/ 或 Ctrl+K', '命令面板'], ['Ctrl+Backslash', '分屏'],
    ['Ctrl+S', '保存视图'], ['[ 或 ]', '切换产业'], ['T', '主题'],
    ['F', '收藏选中公司'], ['P', '路径起点/终点'], ['?', '本帮助'], ['Esc', '取消选择/关闭'],
  ]
  return (
    <div className="modal-back" onClick={() => s.setHelpOpen(false)}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>键盘快捷键</h3>
        <table className="grid"><tbody>{rows.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}</tbody></table>
        <button className="tb" onClick={() => s.setHelpOpen(false)}>关闭</button>
      </div>
    </div>
  )
}
export default function App(){
  const [db,setDb]=useState<DB|null>(null), [err,setErr]=useState('')
  useEffect(()=>{ loadDB().then(setDb).catch(e=>setErr(String(e))) },[])
  if(!db) return <div className="loading">{err||'正在加载全球产业链数据…'}</div>
  return <Provider db={db}><Shell/></Provider>
}
function Pane({pane}:{pane:'a'|'b'}){
  const s=useSt(); const ind=pane==='a'?s.ind:s.ind2, view=pane==='a'?s.view:s.view2, setView=pane==='a'?s.setView:s.setView2, setInd=pane==='a'?s.setInd:s.setInd2
  const Comp=V[view]
  return <div className="pane">
    <div className="tabs">{pane==='b'&&<select className="indsel" value={ind} onChange={e=>setInd(e.target.value)}>{s.db.core.industries.map(i=><option key={i.id} value={i.id}>{i.zh}</option>)}</select>}
      {VIEWS.map(([id,n],i)=><button key={id} className={id===view?'tab on':'tab'} onClick={()=>setView(id)} title={pane==='a'&&i<10?`快捷键 ${(i+1)%10}`:''}>{ICON[id]}{n}</button>)}</div>
    <div className="canvas"><Suspense fallback={<div className="loading">加载视图…</div>}><Comp key={view+ind} ind={ind} pane={pane}/></Suspense></div></div>
}
function Navigator(){
  const s=useSt(); const [open,setOpen]=useState<Record<string,boolean>>({[s.ind]:true})
  const segs=s.db.core.segments
  return <div className="nav">
    <div className="navh">导航 · 产业 → 二级分类 → 环节</div>
    {s.db.core.industries.map(i=>{ const subs=[...new Set(segs.filter(x=>x.industry===i.id).map(x=>x.sub))]
      return <div key={i.id}><div className={'node l0'+(s.ind===i.id?' cur':'')} onClick={()=>{setOpen({...open,[i.id]:!open[i.id]});s.setInd(i.id);if(s.view==='overview')s.setView('flow')}}>
        {open[i.id]?<ChevronDown size={13}/>:<ChevronRight size={13}/>}<b>{i.zh}</b><span className="cnt">{s.db.core.companies.filter(c=>c.industries.includes(i.id)).length}</span></div>
        {open[i.id]&&TIERS.map(t=><div key={t}>{subs.filter(sb=>segs.find(x=>x.sub===sb&&x.industry===i.id)!.tier===t).map(sb=><div key={sb}>
          <div className="node l1"><span className="dot" style={{background:TIER_COLOR[t]}}/>{sb}<span className="muted"> · {t}</span></div>
          {segs.filter(x=>x.industry===i.id&&x.sub===sb).map(x=>{ const cc=concentration(s.db,x.id)
            return <div key={x.id} className={'node l2'+(s.sel?.id===x.id?' sel':'')} onClick={()=>{s.setInd(i.id);s.setSel({kind:'segment',id:x.id})}}>{x.name}
            {cc.choke&&<AlertTriangle size={11} color="#f87171" style={{marginLeft:4}}/>}<span className="cnt">{cc.n}</span></div>})}</div>)}</div>)}</div> })}
    <div className="navh" style={{marginTop:10}}><Star size={12}/> 收藏（{s.favs.length}）</div>
    {s.favs.map(id=>{ const c=s.db.COMP[id]; return c&&<div key={id} className="node l1" onClick={()=>s.setSel({kind:'company',id})}>{c.zh}<span className="muted"> {cn2(c.country)}</span></div> })}
    {!s.favs.length&&<div className="muted" style={{padding:'2px 12px'}}>在检查器中点 ☆ 收藏公司</div>}
  </div>
}
function Shell(){
  const s=useSt(); const sl=useSlice(s.ind); const [menu,setMenu]=useState('')
  const exp=async(kind:'png'|'svg'|'csv'|'json')=>{
    const key=s.view
    if(kind==='csv'){ const rows=[['id','中文名','英文名','国家/地区','交易所','代码','环节','营收(USD)','营收来源','市值(USD)','市值日期','市值来源','数据质量'],
        ...sl.comps.map(c=>[c.id,c.zh,c.en,cn2(c.country),c.exchange,c.ticker,c.segments.map(x=>s.db.SEG[x].name).join('|'),c.revenue?.valueUSD??'',c.revenue?.sources.map(x=>x.url).join(' ')??'',c.marketCap?.valueUSD??'',c.marketCap?.date??'',c.marketCap?.sources.map(x=>x.url).join(' ')??'',c.quality.grade])]
      const r2=[['from','to','type','status','confidence','evidence_url','quote'],...sl.rels.map(r=>[s.db.COMP[r.from].zh,s.db.COMP[r.to].zh,r.type,r.status,r.confidence,r.evidence[0]?.url??'',r.evidence[0]?.quote??''])]
      const csv=(a:unknown[][])=>a.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n')
      downloadText(`${s.ind}-companies.csv`,csv(rows)); downloadText(`${s.ind}-relations.csv`,csv(r2)); s.toast('已导出 CSV（公司 + 关系）'); return }
    if(kind==='json'){ const payload={ind:s.ind,exported:new Date().toISOString(),filters:s.f,companies:sl.comps.map(c=>({id:c.id,zh:c.zh,en:c.en,country:c.country,ticker:c.ticker,segments:c.segments,marketCap:c.marketCap,revenue:c.revenue,verify:c.verify})),relations:sl.rels}; downloadText(`${s.ind}-slice.json`,JSON.stringify(payload,null,2),'application/json'); s.toast('已导出 JSON 切片'); return }
    const e=exporters[key+':a']; if(!e?.[kind]){ s.toast(`当前视图不支持导出 ${kind.toUpperCase()}`); return }
    const out=await e[kind]!(); if(kind==='svg') downloadText(`${s.ind}-${key}.svg`,out,'image/svg+xml'); else download(`${s.ind}-${key}.png`,out); s.toast('已导出 '+kind.toUpperCase())
  }
  const share=()=>{ const u=location.href; (navigator.clipboard?.writeText(u)??Promise.reject()).then(()=>s.toast('已复制分享链接（含产业/视图/选择/筛选）')).catch(()=>{ prompt('复制此链接',u) }) }
  useEffect(()=>{ const h=(e:KeyboardEvent)=>{ const tag=(e.target as HTMLElement).tagName
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); s.setPalette(!s.palette); return }
      if((e.ctrlKey||e.metaKey)&&e.key==='\\'){ e.preventDefault(); s.setSplit(!s.split); return }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); const n=prompt('保存当前视图名称'); if(n!=null) s.saveView(n); return }
      if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return
      if(e.key==='Escape'){ s.setSel(null); s.setPalette(false); s.setHelpOpen(false) }
      if(e.key==='?'||(e.shiftKey&&e.key==='/')){ e.preventDefault(); s.setHelpOpen(!s.helpOpen); return }
      if(e.key==='/'){ e.preventDefault(); s.setPalette(true); return }
      if(/^[0-9]$/.test(e.key)&&!e.ctrlKey){ const i=(+e.key+9)%10; if(VIEWS[i]) s.setView(VIEWS[i][0] as ViewId) }
      if(e.key==='t') s.setTheme(s.theme==='dark'?'light':'dark')
      if(e.key==='['||e.key===']'){ const ids=s.db.core.industries.map(i=>i.id); const ix=ids.indexOf(s.ind); const n=ids[(ix+(e.key===']'?1:-1)+ids.length)%ids.length]; s.setInd(n); s.setSel(null) }
      if(e.key==='f'&&s.sel?.kind==='company') s.toggleFav(s.sel.id)
      if(e.key==='p'&&s.sel?.kind==='company'){ const a=s.pathPair?.[0]; if(a&&a!==s.sel.id){ s.setPathPair([a,s.sel.id]); s.setView('network'); s.toast('路径终点已设，见网络图') } else { s.setPathPair([s.sel.id,'']); s.toast('已设路径起点，再选另一公司按 P') } }
    }
    addEventListener('keydown',h); return ()=>removeEventListener('keydown',h) },[s])
  const menus:Record<string,[string,()=>void,string?][]>={
    文件:[['导出 PNG',()=>exp('png')],['导出 SVG（ECharts 视图）',()=>exp('svg')],['导出 CSV（公司+关系）',()=>exp('csv')],['导出 JSON（当前切片）',()=>exp('json')],['导出收藏',()=>{ const ids=s.favs; const rows=ids.map(id=>{ const c=s.db.COMP[id]; return c?{id:c.id,zh:c.zh,en:c.en,ticker:c.ticker,country:c.country}: {id} }); downloadText('favourites.json', JSON.stringify({exported:new Date().toISOString(),favourites:rows},null,2),'application/json'); s.toast('已导出收藏 '+ids.length+' 家') }],['导入收藏',()=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json,.json'; inp.onchange=async()=>{ const f=inp.files?.[0]; if(!f) return; try{ const j=JSON.parse(await f.text()); const ids=(j.favourites||j||[]).map((x:any)=>typeof x==='string'?x:x.id).filter(Boolean); let n=0; ids.forEach((id:string)=>{ if(s.db.COMP[id]&&!s.favs.includes(id)){ s.toggleFav(id); n++ } }); s.toast('已导入收藏 +'+n) }catch(e){ s.toast('导入失败') } }; inp.click() }]],
    视图:[...VIEWS.map(([id,n],i)=>[n,()=>s.setView(id as ViewId),String((i+1)%10)] as [string,()=>void,string]),['分屏对比',()=>s.setSplit(!s.split),'Ctrl+\\'],['切换主题',()=>s.setTheme(s.theme==='dark'?'light':'dark'),'T']],
    数据:[['数据源与覆盖',()=>s.setView('sources')],['分析仪表盘',()=>s.setView('analysis')],['仅显示已引用关系',()=>s.setF({...s.f,citedOnly:!s.f.citedOnly})],['已验证视图开/关',()=>s.setF({...s.f,verified:!s.f.verified})]],
    帮助:[['命令面板',()=>s.setPalette(true),'Ctrl+K'],['快捷键一览',()=>s.setHelpOpen(true),'?'],['新手引导',()=>dispatchEvent(new Event('open-tour'))],['复制分享链接',()=>share()],['保存当前视图',()=>{const n=prompt('视图名称'); if(n!=null) s.saveView(n)},'Ctrl+S']] }
  const st=s.db.sources.status; const okSrc=Object.values(st).filter(v=>v.ok>0).length
  const nRel=s.db.core.relations.length, cited=s.db.core.relations.filter(r=>r.status==='已引用').length
  return <div className="app" onClick={()=>menu&&setMenu('')}>
    <div className="menubar"><span className="logo"><Network size={15}/> 全球产业链地图</span>
      {Object.keys(menus).map(m=><div key={m} className="menu" onClick={e=>{e.stopPropagation();setMenu(menu===m?'':m)}} onMouseEnter={()=>menu&&setMenu(m)}>{m}
        {menu===m&&<div className="mdd">{menus[m].map(([n,f,k])=><div key={n} onClick={()=>{f();setMenu('')}}><span>{n}</span>{k&&<kbd>{k}</kbd>}</div>)}</div>}</div>)}
      <div className="grow"/><button className="search-btn" onClick={()=>s.setPalette(true)}><Search size={13}/> 搜索公司 / 产品 / 环节 / 命令 <kbd>Ctrl K</kbd></button></div>
    <div className="toolbar">
      {s.db.core.industries.map(i=><button key={i.id} className={'tb'+(s.ind===i.id?' on':'')} onClick={()=>{s.setInd(i.id);s.setSel(null)}}>{i.zh}</button>)}
      <span className="sep"/>
      <label>层级 <select value={s.f.tier} onChange={e=>s.setF({...s.f,tier:e.target.value})}><option value="">全部</option>{TIERS.map(t=><option key={t}>{t}</option>)}</select></label>
      <label>国家/地区 <select value={s.f.country} onChange={e=>s.setF({...s.f,country:e.target.value})}><option value="">全部</option>{[...new Set(s.db.core.companies.map(c=>c.country))].sort().map(k=><option key={k} value={k}>{cn2(k)}</option>)}</select></label>
      <label>质量 <select value={s.f.minQuality} onChange={e=>s.setF({...s.f,minQuality:e.target.value})}><option value="">全部</option><option value="A">仅 A</option><option value="B">A–B</option></select></label>
      <label title="只显示 A/B 级（多源一致或一手来源）的数值与关系"><input type="checkbox" checked={!!s.f.verified} onChange={e=>s.setF({...s.f,verified:e.target.checked})}/> 仅已验证</label>
      <label><input type="checkbox" checked={s.f.citedOnly} onChange={e=>s.setF({...s.f,citedOnly:e.target.checked})}/> 仅已引用关系</label>
      {(s.f.country||s.f.tier||s.f.minQuality||s.f.citedOnly||s.sel)&&<button className="tb" onClick={()=>{s.setF({country:'',tier:'',minQuality:'',citedOnly:false,verified:false});s.setSel(null)}}>重置</button>}
      <label className="saved-views">已存视图 <select defaultValue="" onChange={e=>{ const v=e.target.value; if(!v) return; if(v.startsWith('del:')) s.deleteView(v.slice(4)); else s.loadView(v); e.target.value='' }}>
        <option value="">加载…</option>
        {s.savedViews.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        {s.savedViews.map(v=><option key={'d'+v.id} value={'del:'+v.id}>删除：{v.name}</option>)}
      </select></label>
      <button className="tb" title="Ctrl+S" onClick={()=>{ const n=prompt('保存当前视图名称'); if(n!=null) s.saveView(n) }}>保存视图</button>
      <PathBar/>
      <div className="grow"/>
      <button className={'tb'+(s.split?' on':'')} onClick={()=>s.setSplit(!s.split)} title="分屏 Ctrl+Backslash"><Columns2 size={14}/> 分屏</button>
      <button className="tb" onClick={()=>exp('png')} title="导出 PNG"><Download size={14}/> PNG</button>
      <button className="tb" onClick={()=>exp('svg')}>SVG</button><button className="tb" onClick={()=>exp('csv')}>CSV</button>
      <button className="tb" onClick={()=>s.setTheme(s.theme==='dark'?'light':'dark')} title="切换主题 T">{s.theme==='dark'?<Sun size={14}/>:<Moon size={14}/>}</button>
      <button className="tb" onClick={share} title="复制当前视图链接"><Link2 size={14}/> 分享</button>
      <button className="tb" onClick={()=>dispatchEvent(new Event('open-tour'))} title="新手引导"><HelpCircle size={14}/></button>
      <button className="tb" onClick={()=>s.setPalette(true)}><Command size={14}/></button></div>
    <Group orientation="horizontal" className="work">
      <Panel defaultSize="16" minSize={160} collapsible><Navigator/></Panel><Separator className="rz"/>
      <Panel defaultSize="60" minSize={300}>{s.split ? <Group orientation="horizontal"><Panel defaultSize="50" minSize={200}><Pane pane="a"/></Panel><Separator className="rz"/><Panel defaultSize="50" minSize={200}><Pane pane="b"/></Panel></Group> : <Pane pane="a"/>}</Panel>
      <Separator className="rz"/><Panel defaultSize="24" minSize={240} collapsible><Inspector/></Panel>
    </Group>
    <div className="statusbar"><span>● 数据 {s.db.core.meta.version} · 生成 {s.db.core.meta.generated?.replace('T',' ').slice(0,16)} UTC{(s.db.core.meta as any).localUpdate&&<span title="本机更新器最近一次成功更新"> · 本地更新 {String((s.db.core.meta as any).localUpdate.at).replace('T',' ').slice(0,16)} UTC</span>}</span>
      <span>{s.db.core.companies.length} 公司 · {s.db.core.segments.length} 环节 · {nRel} 关系（已引用 {cited}）</span>
      <span>当前：{sl.comps.length} 公司 / {sl.rels.length} 关系</span>{s.db.audit&&(()=>{ const a:any=s.db.audit; const o=a.overallVerified||a.overall; const r=a.relationsVerified||a.relations; return <span className={'link '+(o.meets98?'ok':'warn')} onClick={()=>s.setView('sources')} title={'口径：已验证子集（字段抽检 + A/B 级关系）；全量含 C 级见数据源页。轮次 '+a.round+'；字段 '+a.fields.correct+'/'+a.fields.n+'，A/B 关系 '+r.correct+'/'+r.n}>已验证准确率 {(o.acc*100).toFixed(1)}%（95%CI {(o.ci95[0]*100).toFixed(1)}–{(o.ci95[1]*100).toFixed(1)}%，n={o.n}）{o.meets98?' ≥98% 已证实':' · 98% 未获统计证实'}</span>})()}
      {s.f.verified&&<span className="ok">● 已验证视图</span>}<span className="link" onClick={()=>s.setView('sources')}>数据源 {okSrc}/{Object.keys(st).length} 可用</span>
      <div className="grow"/>{s.msg&&<span className="toastm">{s.msg}</span>}<span>{s.theme==='dark'?'深色':'浅色'} · Ctrl+K</span></div>
    <HelpModal/>
    <Tour/>
    {s.palette&&<Palette/>}
  </div>
}
