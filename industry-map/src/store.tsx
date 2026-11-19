import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { verifiedDB, type DB } from './data'
import { useMemo } from 'react'
export const VIEWS = [
  ['overview','产业总览'],['flow','分层流程图'],['tree','旭日层级图'],['network','关系网络图'],['map','世界地图'],['globe','3D 地球'],
  ['treemap','矩形树图'],['sankey','桑基图'],['table','表格视图'],['analysis','分析'],['canvas','自由画布'],['risk','链条风险'],['prices','价格'],['sources','数据源'] ] as const
export type ViewId = typeof VIEWS[number][0]
export type Sel = { kind:'company'|'segment'; id:string } | null
export type Filters = { country:string; tier:string; minQuality:string; citedOnly:boolean; verified?:boolean }
type St = { db:DB; ind:string; setInd:(s:string)=>void; view:ViewId; setView:(v:ViewId)=>void; ind2:string; setInd2:(s:string)=>void; view2:ViewId; setView2:(v:ViewId)=>void
  split:boolean; setSplit:(b:boolean)=>void; sel:Sel; setSel:(s:Sel)=>void; multi:string[]; setMulti:(s:string[])=>void; f:Filters; setF:(f:Filters)=>void
  theme:'dark'|'light'; setTheme:(t:'dark'|'light')=>void; favs:string[]; toggleFav:(id:string)=>void; compare:string[]; setCompare:(s:string[])=>void
  palette:boolean; setPalette:(b:boolean)=>void; toast:(m:string)=>void; msg:string; pathPair:[string,string]|null; setPathPair:(p:[string,string]|null)=>void
  savedViews:{id:string;name:string;ind:string;view:ViewId;f:Filters;sel:Sel}[]; saveView:(name:string)=>void; loadView:(id:string)=>void; deleteView:(id:string)=>void
  helpOpen:boolean; setHelpOpen:(b:boolean)=>void }
const C = createContext<St>(null as unknown as St)
export const useSt = () => useContext(C)
const ls = <T,>(k:string,d:T):T => { try { return JSON.parse(localStorage.getItem(k) ?? '') as T } catch { return d } }
export function Provider({db:raw,children}:{db:DB;children:ReactNode}){
  const p = new URLSearchParams(location.hash.slice(1))
  const [ind,setInd]=useState(p.get('ind')??'semi'), [view,setView]=useState<ViewId>((p.get('view')??'overview') as ViewId)
  const [ind2,setInd2]=useState(p.get('ind2')??'nev'), [view2,setView2]=useState<ViewId>((p.get('view2')??'flow') as ViewId)
  const [split,setSplit]=useState(p.get('split')==='1')
  const s0=p.get('sel'); const [sel,setSel]=useState<Sel>(s0?{kind:s0[0]==='c'?'company':'segment',id:s0.slice(2)}:null)
  const [multi,setMulti]=useState<string[]>([])
  const [f,setF]=useState<Filters>({country:p.get('country')??'',tier:p.get('tier')??'',minQuality:'',citedOnly:false,verified:p.get('v')==='1'})
  const db=useMemo(()=>f.verified?verifiedDB(raw):raw,[raw,f.verified])
  const [theme,setTheme]=useState<'dark'|'light'>(ls('theme','dark'))
  const [favs,setFavs]=useState<string[]>(ls('favs',[]))
  const [compare,setCompare]=useState<string[]>(ls('compare',['tsmc','samsung','intel']))
  const [palette,setPalette]=useState(false), [msg,setMsg]=useState(''), [pathPair,setPathPair]=useState<[string,string]|null>(null)
  const [savedViews,setSavedViews]=useState<{id:string;name:string;ind:string;view:ViewId;f:Filters;sel:Sel}[]>(ls('savedViews',[]))
  const [helpOpen,setHelpOpen]=useState(false)
  useEffect(()=>{ document.documentElement.dataset.theme=theme; localStorage.setItem('theme',JSON.stringify(theme)) },[theme])
  useEffect(()=>{ localStorage.setItem('favs',JSON.stringify(favs)) },[favs])
  useEffect(()=>{ localStorage.setItem('compare',JSON.stringify(compare)) },[compare])
  useEffect(()=>{ localStorage.setItem('savedViews',JSON.stringify(savedViews)) },[savedViews])
  const saveView=(name:string)=>{ const id='v'+Date.now(); setSavedViews(v=>[{id,name:name||`${ind}/${view}`,ind,view,f:{...f},sel},...v].slice(0,20)); toast('已保存视图：'+(name||`${ind}/${view}`)) }
  const loadView=(id:string)=>{ const v=savedViews.find(x=>x.id===id); if(!v) return; setInd(v.ind); setView(v.view); setF(v.f); setSel(v.sel); toast('已加载视图：'+v.name) }
  const deleteView=(id:string)=>setSavedViews(v=>v.filter(x=>x.id!==id))
  useEffect(()=>{ const q=new URLSearchParams({ind,view,...(split?{split:'1',ind2,view2}:{}),...(sel?{sel:(sel.kind==='company'?'c:':'s:')+sel.id}:{}),...(f.country?{country:f.country}:{}),...(f.tier?{tier:f.tier}:{}),...(f.verified?{v:'1'}:{})}); history.replaceState(null,'','#'+q) },[ind,view,ind2,view2,split,sel,f])
  const toggleFav=(id:string)=>setFavs(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])
  const toast=(m:string)=>{ setMsg(m); setTimeout(()=>setMsg(''),2500) }
  return <C.Provider value={{db,ind,setInd,view,setView,ind2,setInd2,view2,setView2,split,setSplit,sel,setSel,multi,setMulti,f,setF,theme,setTheme,favs,toggleFav,compare,setCompare,palette,setPalette,toast,msg,pathPair,setPathPair,savedViews,saveView,loadView,deleteView,helpOpen,setHelpOpen}}>{children}</C.Provider>
}
// 当前产业 + 筛选后的数据切片
export function useSlice(ind:string){
  const {db,f}=useSt()
  const segs=db.core.segments.filter(s=>s.industry===ind&&(!f.tier||s.tier===f.tier))
  const segIds=new Set(segs.map(s=>s.id))
  const comps=db.core.companies.filter(c=>c.segments.some(s=>segIds.has(s))&&(!f.country||c.country===f.country)&&(!f.minQuality||c.quality.grade<=f.minQuality))
  const compIds=new Set(comps.map(c=>c.id))
  const links=db.core.segmentLinks.filter(l=>l.industry===ind&&segIds.has(l.from)&&segIds.has(l.to))
  const rels=db.core.relations.filter(r=>(compIds.has(r.from)||compIds.has(r.to))&&(!f.citedOnly||r.status==='已引用'))
  const compsOf=(sid:string)=>comps.filter(c=>c.segments.includes(sid))
  return {segs,segIds,comps,compIds,links,rels,compsOf}
}
// 导出注册：当前活动视图登记 png/svg 导出方法
export const exporters: Record<string,{png?:()=>Promise<string>|string; svg?:()=>string}> = {}
export function download(name:string, url:string){ const a=document.createElement('a'); a.href=url; a.download=name; a.click() }
export function downloadText(name:string, text:string, type='text/csv'){ download(name, URL.createObjectURL(new Blob(['\ufeff'+text],{type}))) }
