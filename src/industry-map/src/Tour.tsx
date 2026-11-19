import { useEffect, useState } from 'react'
import { useSt } from './store'
const STEPS:[string,string,string?][]=[
  ['欢迎使用全球产业链地图','6 大产业、228+ 家公司、250+ 条带出处的关系。每个数值都附来源与等级（A 多源一致 / B 一手单源 / C 二手单源 / X 冲突）。'],
  ['1 · 选择产业与视图','顶部工具栏切换产业；视图标签（快捷键 1–0）在流程图、网络图、地图、表格、风险、价格之间切换。','flow'],
  ['2 · 搜索一切','按 Ctrl+K 或 / 打开搜索：公司名、股票代码、产品、环节、关系（如“宁德 → 特斯拉”）。'],
  ['3 · 检查器与出处','点击任一公司/环节，右侧检查器显示字段、等级徽章和原文链接；“+ 对比”加入公司对比。','network'],
  ['4 · 风险与价格','“链条风险”按 HHI 标出集中环节；“价格”汇总可合法获取的现货价格，均附取数日。','risk'],
  ['5 · 只看已验证 & 分享','勾选“仅已验证”只保留 A/B 数据；“分享”复制当前视图链接，含产业/视图/选择/筛选。'],
]
export default function Tour(){
  const s=useSt(); const [i,setI]=useState<number>(()=>localStorage.getItem('tourDone')?-1:0)
  useEffect(()=>{ const h=()=>setI(0); addEventListener('open-tour',h); return ()=>removeEventListener('open-tour',h) },[])
  if(i<0) return null
  const [t,b,v]=STEPS[i]; const end=()=>{ localStorage.setItem('tourDone','1'); setI(-1) }
  return <div className="modal-back"><div className="modal tour">
    <div className="muted small">新手引导 {i+1}/{STEPS.length}</div><h3>{t}</h3><p>{b}</p>
    <div style={{display:'flex',gap:8}}>
      <button className="tb" onClick={end}>跳过</button><div className="grow"/>
      {i>0&&<button className="tb" onClick={()=>setI(i-1)}>上一步</button>}
      {i<STEPS.length-1?<button className="tb on" onClick={()=>{ const n=i+1; const nv=STEPS[n][2]; if(nv) s.setView(nv as any); setI(n) }}>下一步</button>:<button className="tb on" onClick={end}>开始使用</button>}
    </div></div></div>
}
