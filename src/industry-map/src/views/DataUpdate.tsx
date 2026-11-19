import { useEffect, useRef, useState } from 'react'
import { useSt } from '../store'

type D = any
const api = (): D => (window as any).industryDesktop
const fmt = (t?: string) => (t ? String(t).replace('T', ' ').replace('Z', ' UTC').slice(0, 20) : '—')
const PHASE: Record<string, string> = { 行情: '股价与汇率', SEC: 'SEC 财报', GLEIF: 'GLEIF', Wikidata: 'Wikidata', 宏观: '宏观/贸易/大宗', 关系发现: '关系发现', 合并: '合并与校验' }

export default function DataUpdate() {
  const s = useSt(); const d = api()
  const [st, setSt] = useState<D>(null); const [rep, setRep] = useState<D>(null); const [run, setRun] = useState(false)
  const [prog, setProg] = useState<D>(null); const [done, setDone] = useState<D>(null); const [msg, setMsg] = useState(''); const t0 = useRef(0); const [, tick] = useState(0)
  const load = async () => { if (!d) return; setSt(await d.status()); setRep(await d.lastReport()) }
  useEffect(() => {
    if (!d) return; load()
    const o1 = d.on('started', () => { setRun(true); setDone(null); setProg({ phase: '准备', message: '开始' }); t0.current = Date.now() })
    const o2 = d.on('progress', (p: D) => setProg(p))
    const o3 = d.on('done', (r: D) => { setRun(false); setProg(null); setDone(r); load() })
    d.status().then((x: D) => { if (x.running) { setRun(true); t0.current = Date.now() } })
    const iv = setInterval(() => tick(n => n + 1), 1000)
    return () => { o1(); o2(); o3(); clearInterval(iv) }
  }, [])
  if (!d) return <div className="kpi" style={{ marginBottom: 10 }}><b>数据更新</b>：当前为网页版，数据由助手/脚本（<code>python3 data/refresh.py</code>）更新。桌面版内置「更新数据」按钮，可在本机联网自更新。</div>
  const meta = s.db.core.meta as D; const lu = meta.localUpdate
  const act = async (fn: () => Promise<any>, ok = '') => { try { const r = await fn(); if (ok) setMsg(ok); await load(); return r } catch (e: any) { setMsg('操作失败：' + (e?.message || e)) } }
  const autos = s.db.core.relations.filter((r: any) => r.auto)
  const sec = Math.round((Date.now() - t0.current) / 1000)
  return <div style={{ marginBottom: 14 }}>
    <h3>数据更新（本机）</h3>
    <div className="cards">
      <div className="kpi"><div className="kn">当前数据版本</div><div className="kv2">{meta.version}</div><div className="small">{st?.dataKind === 'local' ? '本地更新数据' : '程序内置数据'}　程序 v{st?.appVersion}</div></div>
      <div className="kpi"><div className="kn">基线生成时间</div><div className="small" style={{ fontSize: 13 }}>{fmt(meta.generated)}</div></div>
      <div className="kpi"><div className="kn">最近一次本机更新</div><div className="small" style={{ fontSize: 13 }}>{lu ? fmt(lu.at) : '尚未更新'}</div></div>
      <div className="kpi"><div className="kn">公司 / 关系 / 其中自动发现</div><div className="kv2">{s.db.core.companies.length} / {s.db.core.relations.length} / {autos.length}</div></div>
    </div>
    {st?.staleLocalIgnored && <div className="small warn" style={{ margin: '6px 0' }}>● 程序自带数据比本机旧更新更新，已自动使用内置数据（旧的本地更新被忽略）。</div>}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0' }}>
      <button className="tb" disabled={run} onClick={() => act(() => d.run({}), '')}>{run ? '更新中…' : '更新数据'}</button>
      <button className="tb" disabled={run} title="重新扫描全部 SEC 年报抽取关系（慢，约十几分钟）" onClick={() => act(() => d.run({ deep: true }))}>深度扫描关系</button>
      {run && <button className="tb" onClick={() => d.cancel()}>取消</button>}
      <button className="tb" disabled={run || !st?.backups?.length} onClick={() => confirm('回滚到上一个备份？当前本地数据将被替换（备份被消耗）。') && act(async () => { await d.rollback(); d.reload() })}>回滚到上一版</button>
      <button className="tb" disabled={run || st?.dataKind !== 'local'} onClick={() => confirm('清除本地更新，恢复为程序内置数据？（备份保留）') && act(async () => { await d.reset(); d.reload() })}>恢复内置数据</button>
      <button className="tb" onClick={() => d.openDataDir()}>打开数据目录</button>
      <label className="small">自动更新：<select value={st?.settings?.autoCheck || 'daily'} onChange={e => act(() => d.setSettings({ autoCheck: e.target.value }))}><option value="daily">每天一次（启动时检查；约每 7 天深度扫关系）</option><option value="startup">每次启动（间隔≥6 小时）</option><option value="off">关闭</option></select></label>
    </div>
    {run && <div className="kpi" style={{ marginBottom: 8 }}><b>{PHASE[prog?.phase] || prog?.phase || '运行中'}</b>　<span className="small">{prog?.message} · 已用时 {sec}s{typeof prog?.pct === 'number' ? ` · ${Math.round(prog.pct * 100)}%` : ''}</span>
      <div style={{ height: 4, background: 'var(--bd)', borderRadius: 2, marginTop: 6 }}><div style={{ height: 4, width: `${Math.round((prog?.pct || 0.02) * 100)}%`, background: 'var(--ac)', borderRadius: 2 }} /></div></div>}
    {done && !run && <div className={'kpi ' + (done.ok ? 'okb' : done.guard?.length ? 'warnb' : '')} style={{ marginBottom: 8 }}>
      <b>{done.ok ? '✔ 更新完成' : done.aborted ? '已取消' : done.guard?.length ? '⚠ 保护闸已拦截，数据未改动' : '未写入'}</b>　<span className="small">{done.summary}（{done.durationSec}s）</span>
      {done.ok && <div style={{ marginTop: 6 }}><button className="tb" onClick={() => d.reload()}>重新载入以应用新数据</button></div>}
    </div>}
    {msg && <div className="small muted">{msg}</div>}
    {rep && <details open={!!rep.guard?.length || !rep.ok}><summary className="small"><b>上次运行</b>：{fmt(rep.finished)}　{rep.ok ? '✔' : '✖'}　{rep.summary}</summary>
      {rep.guard?.length > 0 && <div className="warn small">保护闸原因：<ul>{rep.guard.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul></div>}
      {rep.warnings?.length > 0 && <div className="small"><b>警告（{rep.warnings.length}）</b><ul>{rep.warnings.slice(0, 30).map((g: string, i: number) => <li key={i}>{g}</li>)}</ul></div>}
      <table className="grid sm"><thead><tr><th>本轮数据源</th><th>状态</th><th>成功/失败请求</th><th>说明</th></tr></thead><tbody>
        {Object.entries(rep.perSource || {}).map(([k, v]: [string, D]) => <tr key={k}><td>{k}</td><td>{v.skipped ? <span className="muted">跳过</span> : v.ok > 0 && v.fail === 0 ? <span className="ok">● 全部成功</span> : v.ok > 0 ? <span className="warn">● 部分失败</span> : <span className="warn">● 失败</span>}</td><td>{v.ok} / {v.fail}</td><td className="small">{v.detail}</td></tr>)}
      </tbody></table>
      <details><summary className="small">运行日志</summary><pre className="small" style={{ maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{(rep.logs || []).join('\n')}</pre></details>
    </details>}
    {st?.backups?.length > 0 && <div className="small" style={{ margin: '6px 0' }}>可回滚备份：{st.backups.map((b: D) => `${fmt(b.at)}（${b.kind === 'bundled' ? '内置' : b.version || '本地'}）`).join('；')}</div>}
    <details open><summary className="small"><b>数据怎么升级（不必依赖助手）</b></summary>
      <ul className="small">
        <li><b>程序内置基线</b>：安装包自带完整图谱（当前 v3.3）。「恢复内置数据」会回到这版；断网也能用。</li>
        <li><b>本机自动更新（默认每天启动检查一次）</b>：你的电脑直接从公开源拉取——股价/汇率（Yahoo，东方财富兜底）、SEC 财报 XBRL、GLEIF、Wikidata、世界银行/IMF/FRED、UN Comtrade、Pink Sheet；并重算市值与营收。默认无需点按钮，也不需要助手。</li>
        <li><b>关系自动生长</b>：扫描目录内美股/ADR 公司最新 10-K/20-F/40-F 原文，抽取同句点名两家公司的「竞争/供货/合资/授权」；每条保留原句+链接，标 C 级「自动·待复核」，永不改写已有 A/B 关系。日常更新会优先扫新申报，并轮转扫「超过约 45 天未扫」的年报；每周还会自动做一次更深的关系扫描。也可手动点「深度扫描关系」。</li>
        <li><b>本机仍做不到、可选交给助手</b>：A 股/港股/台股年报深度核验、多源交叉把关系升到 A/B、清理「待核实」、新增目录外公司、抽检审计。这些不影响日常数字刷新；助手日更可关掉，需要时再开。</li>
        <li><b>安全</b>：只读公开源；已有关系不删不改；异常缩水整次中止；更新前备份可回滚；数据只在本机 %APPDATA%，不上传。</li>
      </ul></details>
    {autos.length > 0 && <details><summary className="small"><b>自动发现的关系（{autos.length}，待人工复核）</b></summary>
      <table className="grid sm"><thead><tr><th>关系</th><th>原句</th><th>来源</th></tr></thead><tbody>{autos.slice(0, 60).map((r: any, i: number) => <tr key={i}><td>{s.db.COMP[r.from]?.zh} → {s.db.COMP[r.to]?.zh}（{r.type}）</td><td className="small">{r.evidence?.[0]?.quote || r.note}</td><td className="small">{r.evidence?.[0]?.url && <a href={r.evidence[0].url} target="_blank" rel="noreferrer">{r.evidence[0].source || '链接'}</a>}</td></tr>)}</tbody></table></details>}
  </div>
}
