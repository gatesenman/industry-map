## v2.6 — 2026-10-28
- 每日进化：关系 414→443（A167/B230/C42/待核实4）；新增 29、升级 1（eve>fluence 供货 B→A）、删除 0
- onsemi 图像传感器竞争、Gilead/Lilly/信达对外授权、Catalent>百济供货、锂电隔膜/电解液（恩捷/星源/新宙邦/天赐）、拓普底盘配套、宝马-长城光束、优美科-PowerCo、Iberdrola>微软 PPA
- 修复 Catalent 上市状态（2024-12-18 私有化退市，SEC 8-K/25-NSE/15-12G；新增 listing_status.json）；gwm 营收 URL 改 https
- audit overall 637/637 meets98=true；孤立公司 51→35；失败来源：国家统计局

## v2.5 — 2026-10-27
- 每日进化：关系 390→414（A144/B224/C42/待核实4）；新增 24、升级 1（catl>fluence 供货 待核实→B）、删除 0
- 光伏跟踪支架、Mobileye 芯片竞争、UMC 硅片供应商、Amkor>JCET、Stellantis/GM 合资、高通>传音及翰森/石药对外授权
- 修复 leapmotor/gwm/bydelec 营收单位异常（HKEX/上交所一手披露，新增 revenue_overrides.json）
- audit overall 607/608 meets98=true；失败来源：国家统计局、CTLT

## v2.4 — 2026-10-26
- 每日进化：关系 351→390（A111/B232/C42/待核实5）；新增 39、删除 0
- 医药竞争网（Amgen/Regeneron 10-K）、半导体材料/测试、多晶硅（Daqo 20-F）、储能/充电
- audit overall 583/583 meets98=true

## v2.3 — 2026-10-25
- 每日进化：关系 329→351（A76/B228/C42/待核实5）；新增 22、升级/刷新 16、删除 0
- 半导体制造设备竞争网（Lam/KLA/ASML/TEL/AMAT 等 SEC 原句）；Foundry intel↔gf；制药 lilly>novo、moderna↔pfizer
- samsungsdi>bmw 升 B；sungrow>huawei 升 B（WoodMac 2026）；待核实 5 维持
- refresh：SEC/GLEIF/宏观/贸易 ok；Yahoo 403 fail；国家统计局 fail

## v2.2 — 2026-10-24
- 每日进化：关系 312→329（A60/B220/C44/待核实5）；新增 17、升级/刷新约 21、删除 0
- 恢复 tsmc>samsung 竞争 A；lges>tesla 升 B；ESS/PV/pharma 竞争与供货网扩充
- refresh 微观/宏观刷新；verify 兼容无 items 的 audit；audit meets98=true

## v2.1.1 — 2026-10-23

- UI：深色细滚动条（约 7px），覆盖侧栏 / 主区 / 检查器 / 表格 / 命令面板；Firefox 用 scrollbar-color/width，Chromium/Electron 用 ::-webkit-scrollbar
- 无数据变更（仍为 v2.1）

## v2.1 — 2026-10-23

- 关系：310 → 312（A40→42 / B218→219 / C46 / 待核实6→5）
- 升级：tsmc↔samsung 竞争 待核实→A（Intel FY2025 10-K + GlobalFoundries FY2025 20-F 两份独立监管原文）
- 新增：gf>samsung 竞争 B（GlobalFoundries 20-F 将三星列为 IDM 代工竞争者）
- 仍待核实 5：sanhua>tesla、tongwei>longi 竞争、catl/lges>fluence 供货、wuxibiologics>novo（年报/10-K 均未点名，未编造）
- 刷新：捷泰 / 东方日升 marketCap（Yahoo 回源差价）
- 审计：relations 307/307 CI[98.76%,100%]；overallVerified 505/507 CI[98.57%,99.89%] 达 98%

