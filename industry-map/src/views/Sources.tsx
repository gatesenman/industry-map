import { useSt } from '../store'
import { pct, VLABEL } from '../data'
import DataUpdate from './DataUpdate'
const REG=[
 ['Wikidata SPARQL','公司 QID、ISIN、LEI、官网、产品、母/子公司、行业、市值(P2226)/营收(P2139)','https://query.wikidata.org/','CC0'],
 ['Wikipedia API','供货/合作关系的文本证据（引用原句）','https://en.wikipedia.org/w/api.php','CC BY-SA'],
 ['SEC EDGAR','美国申报公司（含 20-F/ADR）XBRL：营收、毛利、净利、研发、资本开支、股数；CIK','https://www.sec.gov/edgar/sec-api-documentation','公有领域'],
 ['GLEIF','LEI 法定名称、注册地、总部、状态','https://api.gleif.org/','CC0'],
 ['Yahoo Finance','最新股价、一年周线、汇率（非官方公共图表接口）','https://finance.yahoo.com/','仅供研究'],
 ['World Bank API','GDP、增速、制造业增加值、高科技出口、CPI、研发支出','https://data.worldbank.org/','CC BY 4.0'],
 ['IMF DataMapper','WEO 实际 GDP 增速、通胀、GDP（含预测）','https://www.imf.org/external/datamapper/','IMF 条款'],
 ['UN Comtrade','HS 8542/8541/854142/854143/850760/870380/8486 出口流向（公开预览 API）','https://comtradeplus.un.org/','UN 条款'],
 ['FRED','美联储利率、10Y 国债、半导体/汽车工业生产、PPI、CPI、人民币汇率','https://fred.stlouisfed.org/','FRED 条款'],
 ['World Bank Pink Sheet','铜、铝、镍、白银、锡等大宗商品月度价格','https://www.worldbank.org/en/research/commodity-markets','CC BY 4.0'],
 ['巨潮资讯 cninfo','A股法定信息披露平台（本环境探测可能不可达，改用东财 PDF 镜像）','http://www.cninfo.com.cn/','监管披露'],
 ['东方财富年报PDF','A股年报全文：前五大客户/供应商占比 + 对手方原句证据','https://pdf.dfcfw.com/','交易所定期报告镜像'],
 ['TWSE MOPS','台湾年报电子书（本轮 PDF 下载受限）','https://mops.twse.com.tw/','监管披露'],
 ['HKEX news','港交所披露易（本轮无批量 API）','https://www1.hkexnews.hk/','监管披露'],
 ['SEC 全文检索','10-K/20-F 原文全文检索：抽取关系一手原句（含文件 URL、申报日）','https://efts.sec.gov/LATEST/search-index','公有领域'],
 ['东方财富 F10','A 股年报营业总收入（交易所定期报告数据转载），用于与 Yahoo 交叉验证','https://data.eastmoney.com/','仅供研究'],
 ['国家统计局 data.stats.gov.cn','规模以上工业增加值等（尝试接入）','https://data.stats.gov.cn/','—'],
]
export default function Sources(){
  const s=useSt(); const st=s.db.sources.status; const cs=s.db.core.companies; const n=(f:(c:any)=>unknown)=>cs.filter(f).length
  const cov=[['Wikidata QID',n(c=>c.qid)],['ISIN',n(c=>c.isin)],['LEI',n(c=>c.lei)],['GLEIF 记录',n(c=>c.gleif)],['SEC 财报',Object.keys(s.db.micro.sec).length],['股价',Object.keys(s.db.micro.quotes).length],['市值',n(c=>c.marketCap)],['营收',n(c=>c.revenue)],['Wikidata 产品',n(c=>c.wd_products)],['质量 A',n(c=>c.quality.grade==='A')],['质量 B',n(c=>c.quality.grade==='B')],['质量 C',n(c=>c.quality.grade==='C')]]
  const rel=s.db.core.relations
  return <div className="vwrap" style={{overflow:'auto'}}><div className="dash"><DataUpdate/><h3>数据源 · 最近刷新 {s.db.sources.generated.replace('T',' ').replace('Z',' UTC')}</h3>
    <table className="grid sm"><thead><tr><th>数据源</th><th>用途</th><th>状态</th><th>成功/失败请求</th><th>最近检查</th><th>备注</th><th>许可</th></tr></thead><tbody>
      {REG.map(([n,u,url,lic])=>{ const x=st[n]; return <tr key={n}><td><a href={url} target="_blank" rel="noreferrer">{n}</a></td><td className="small">{u}</td>
        <td>{!x?<span className="muted">未运行</span>:x.ok>0?<span className="ok">● 可用</span>:<span className="warn">● 不可用</span>}</td><td>{x?`${x.ok} / ${x.fail}`:'—'}</td><td className="small">{x?.checked?.replace('T',' ').slice(0,16)}</td><td className="small">{x?.detail}</td><td className="small">{lic}</td></tr> })}</tbody></table>
    <h3>覆盖率（共 {cs.length} 家公司）</h3><div className="cards">{cov.map(([k,v])=><div key={k as string} className="kpi"><div className="kn">{k}</div><div className="kv2">{v as number}</div><div className="small">{((v as number)/cs.length*100).toFixed(0)}%</div></div>)}</div>
    <h3>关系（{rel.length}）</h3><div className="cards">{['已引用','待核实'].map(k=><div key={k} className="kpi"><div className="kn">{k}</div><div className="kv2">{rel.filter(r=>r.status===k).length}</div></div>)}
      {['Wikipedia','Wikidata'].map(k=><div key={k} className="kpi"><div className="kn">证据来源：{k}</div><div className="kv2">{rel.filter(r=>r.evidence[0]?.source===k).length}</div></div>)}</div>
    <Verify/>
    <ChangelogPanel/>
    <h3>原则</h3><ul className="small"><li>名称/国家/交易所/代码来自人工整理的种子名录（交易所公开上市信息），其余属性均由 <code>python3 data/refresh.py</code> 从上述 API 拉取并记录来源 URL 与获取日期。</li>
      <li>拉不到的字段显示「缺失」，不估算、不插值；市值优先采用 SEC 普通股数 × 最新股价（计算值，标注方法），否则 Wikidata P2226（标注时点）。</li>
      <li>公司关系仅在 Wikipedia 原文/Wikidata 股权中找到证据时标为「已引用」，否则「待核实」；可在工具栏勾选「仅已引用关系」。</li>
      <li>增量刷新：缓存 20 小时（行情 6 小时、贸易 7 天）；<code>--force</code> 强制，<code>--only quotes,macro</code> 只刷新部分。</li></ul></div></div>
}

function Verify(){
  const s=useSt(); const a=s.db.audit; const fs=s.db.verification.fieldStats; const G=['A','B','C','X','缺失','待核实']
  const FN:Record<string,string>={revenue:'营收',marketCap:'市值',isin:'ISIN',lei:'LEI',country:'国家',ticker:'代码',relations:'关系'}
  return <><h3>数据验证体系（规则见 research/data_sourcing.md）</h3>
    {a?<div className="cards">
      {(()=>{ const o=(a as any).overallVerified||a.overall; return <div className={'kpi big '+(o.meets98?'okb':'warnb')}><div className="kn">已验证子集准确率（{a.round}）</div><div className="kv2">{pct(o.acc)}</div><div className="small">字段抽检 + A/B 级关系 · 95%CI {pct(o.ci95[0])}–{pct(o.ci95[1])} · n={o.n}<br/>目标 98%：{o.meets98?'已统计证实（置信下界≥98%）':o.pointMeets98?'点估计达标，但置信下界 < 98%，未获统计证实':'未达标'}</div></div>})()}
      <div className="kpi"><div className="kn">字段抽检</div><div className="kv2">{a.fields.correct}/{a.fields.n}</div><div className="small">{pct(a.fields.acc)}，CI {pct(a.fields.ci95[0])}–{pct(a.fields.ci95[1])}</div></div>
      <div className="kpi"><div className="kn">A/B 关系（已验证）</div><div className="kv2">{(a as any).relationsVerified?`${(a as any).relationsVerified.correct}/${(a as any).relationsVerified.n}`:`${a.relations.correct}/${a.relations.n}`}</div><div className="small">{(a as any).relationsVerified?pct((a as any).relationsVerified.acc)+`，CI ${pct((a as any).relationsVerified.ci95[0])}–${pct((a as any).relationsVerified.ci95[1])}`:pct(a.relations.acc)}</div></div>
      <div className="kpi"><div className="kn">全量关系（含 C 级二手）</div><div className="kv2">{a.relations.correct}/{a.relations.n}</div><div className="small">{pct(a.relations.acc)}，CI {pct(a.relations.ci95[0])}–{pct(a.relations.ci95[1])}<br/>C 级不进入已验证视图，故不计入 98% 宣称口径</div></div>
    </div>:<div className="muted">尚未运行抽检（python3 data/audit.py --round vX）</div>}
    <table className="grid sm"><thead><tr><th>字段</th>{G.map(g=><th key={g}>{VLABEL[g]}</th>)}<th>抽检</th></tr></thead><tbody>
      {Object.entries(fs).map(([k,v])=><tr key={k}><td>{FN[k]??k}</td>{G.map(g=><td key={g}>{v[g]??''}</td>)}<td>{a?.byField[k]?`${a.byField[k].correct}/${a.byField[k].n}`:k==='relations'&&a?`${a.relations.correct}/${a.relations.n}`:'—'}</td></tr>)}</tbody></table>
    {a&&(a.failures.length+a.relationFailures.length)>0&&<><h4>抽检不通过的记录（已降级，不进入已验证视图）</h4><ul className="small">
      {a.failures.map((f:any,i:number)=><li key={'f'+i}>{f.company} · {f.field}：{f.detail}</li>)}
      {a.relationFailures.map((f:any,i:number)=><li key={'r'+i}>{f.key}：{f.comment}</li>)}</ul></>}
    <ul className="small"><li>A = ≥2 个独立来源一致（含 1 个一手 T1，或两个结构化来源无冲突）；B = 单一一手来源（SEC/GLEIF/交易所）；C = 仅二手来源；X = 来源冲突（不进入已验证视图，待人工复核）。</li>
      <li>置信度 = 1 − Π(1 − 来源权重 × 时效系数)，权重 T1 0.90 / 交易所转载 0.85 / 结构化二手 0.70 / 百科 0.55；冲突时封顶 30%。</li>
       <li>已验证子集 = 字段 A/B 抽检 + 关系 grade 为 A 或 B。C 级（仅 Wikipedia 等二手）可浏览但不进入已验证视图，也不计入 98% 宣称。</li>
      <li>关系单独口径：即便 A/B 全对，样本量 &lt; ~184 时 Wilson 下界仍可能 &lt;98%；以状态栏「已验证准确率」的合并口径为准，并在本页展示关系单独 CI。</li>
      <li>字段抽检衡量“与所引来源一致”（来源忠实度），不等于对客观事实的独立审计；关系普查由 AI 审核员逐条阅读原句，存在审核者偏差，建议人工复核。</li></ul></>
}

function ChangelogPanel(){
  const s=useSt(); const cl=s.db.changelog?.entries||[]; const vs=s.db.versions?.versions||[]
  return <><h3>Changelog / 数据版本</h3>
    <div className="small muted">当前数据版本 <b>{s.db.versions?.current||s.db.core.meta.version}</b> · 由 <code>python3 data/evolve.py</code> 写入快照</div>
    <table className="grid sm"><thead><tr><th>版本</th><th>公司</th><th>关系</th><th>A/B 关系</th><th>已验证 CI 下界</th><th>生成时间</th></tr></thead>
      <tbody>{vs.map(v=><tr key={v.version}><td>{v.version}</td><td>{v.companies}</td><td>{v.relations}</td><td>{v.relationsAB}</td>
        <td>{v.overallVerified?.ci95? (v.overallVerified.ci95[0]*100).toFixed(1)+'%': '—'}</td>
        <td className="small">{v.generated?.replace('T',' ').slice(0,16)}</td></tr>)}</tbody></table>
    <h4>更新说明</h4>
    <ul className="small">{cl.map(e=><li key={e.version}><b>{e.version}</b>（{e.date}）
      <ul>{(e.notes||[]).map((n,i)=><li key={i}>{n}</li>)}
        {(e.auto||[]).map((n,i)=><li key={'a'+i} className="muted">自动：{n}</li>)}</ul></li>)}</ul>
  </>
}
