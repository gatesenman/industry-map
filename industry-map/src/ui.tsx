import { VLABEL, type Cite as CiteT, type VRec } from './data'
import { ExternalLink } from 'lucide-react'
export function Cite({c,label}:{c?:CiteT|null;label?:string}){
  if(!c) return null
  const t=`${c.source}${c.retrieved?` · 获取于 ${c.retrieved}`:''}${c.note?` · ${c.note}`:''}${c.quote?`\n“${c.quote}”`:''}`
  return c.url ? <a className="cite" href={c.url} target="_blank" rel="noreferrer" title={t}>{label??c.source}<ExternalLink size={10}/></a> : <span className="cite nolink" title={t}>{label??c.source}</span>
}
export const Missing=({why}:{why?:string})=><span className="missing" title={why??'暂无可引用数据'}>缺失</span>
export const Grade=({g}:{g?:{grade:string;score:number;max:number}})=>g?<span className={'grade g'+g.grade} title={`数据质量 ${g.score}/${g.max}：Wikidata QID、LEI、GLEIF、SEC、行情、市值、营收 覆盖情况`}>{g.grade}</span>:null

export function VBadge({v,label}:{v?:VRec|null;label?:string}){
  if(!v) return null
  const t=[`验证状态：${VLABEL[v.grade]??v.grade}　置信度 ${(v.conf*100).toFixed(0)}%`,...v.sources.map(s=>`· [${s.tier}] ${s.source}：${Array.isArray(s.value)?s.value.slice(0,3).join(','):typeof s.value==='number'?s.value.toLocaleString()+' '+(s.cur??''):s.value}${s.end?' FY'+s.end:''}${s.diff!=null?` 差 ${(s.diff*100).toFixed(1)}%`:''}${s.note?' ('+s.note+')':''}`),...(v.notes??[]).map(n=>'! '+n)].join('\n')
  return <span className={'vb v'+(v.grade==='缺失'?'M':v.grade)} title={t}>{label??v.grade}{!label&&v.sources?.length?<sup className="srcn">{v.sources.length}</sup>:null}</span>
}
export const RGrade=({g,conf}:{g?:string;conf?:number})=>g?<span className={'vb v'+(g==='待核实'?'M':g)} title={`关系验证：${VLABEL[g]??g}${conf?` 置信度 ${(conf*100).toFixed(0)}%`:''}\nA=SEC 一手原句+独立第二来源；B=仅 SEC 一手原句；C=仅 Wikipedia 原句`}>{g==='待核实'?'?':g}</span>:null

/** v1.5 字段级来源徽章：一手(T1)=监管/登记机构，二手(T2)=Wikidata/Yahoo 等，种子=人工整理名录（无直接链接） */
const T1=/SEC|GLEIF|东方财富|交易所|EDGAR|HKEX|巨潮/
export function FieldSrc({src,url,note}:{src?:string;url?:string;note?:string}){
  if(!src) return <span className="fs fsM" title="无来源">∅</span>
  const seed=/种子|seed/i.test(src); const tier=seed?'种子':T1.test(src)?'一手':'二手'
  const cls='fs '+(seed?'fsS':T1.test(src)?'fs1':'fs2'); const t=`字段来源：${src}（${tier}）${note?'\n'+note:''}`
  return url?<a className={cls} href={url} target="_blank" rel="noreferrer" title={t} onClick={e=>e.stopPropagation()}>{tier}</a>:<span className={cls} title={t}>{tier}</span>
}
