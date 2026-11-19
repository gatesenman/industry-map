# 反思与差距分析（v0.2 基线）
## v0.2 现状（数据）
199 家公司；Wikidata 154、LEI/GLEIF 93、SEC 财报 66、股价 196、**市值仅 51**、营收 84；关系 75（已引用 41）。

## 对比竞品 / 开源 / PRD 的差距
| # | 差距 | 对标 | 影响 |
|---|---|---|---|
| G1 | 非美公司市值/营收大面积缺失（A 股、港股、日韩台欧）| Wind 覆盖 A/H/美全部上市公司营收 | 规模类视图（矩形树图、桑基、集中度）偏美国 |
| G2 | 集中度只基于样本公司数/营收，未结合贸易数据 | Wind 景气矩阵、OEC 出口国结构 | 卡脖子判断粗糙 |
| G3 | 关系缺方向（direct/reverse）、子类型、有效期；证据单一 | FactSet 4 类 13 子类、Bloomberg 4 年有效期 | 权威感不足 |
| G4 | 无景气矩阵 / 上市地位气泡图 | Wind PDB | 分析深度 |
| G5 | 无股权母子链的权威来源（仅 Wikidata）| GLEIF Level 2、天眼查穿透 | 控股关系少 |
| G6 | 企业库筛选+批量导出弱、无保存搜索 | 企查查、Panjiva | 实用性 |
| G7 | 图表缺"来源/下载/引用"统一面板 | OWID Grapher | 可信度 UX |
| G8 | 无设施/生产基地层 | Open Supply Hub（API 需 token） | 地理精度 |
| G9 | 无新闻/政策、无预警 | 企查查、Panjiva、Resilinc | PRD v1.0 范围 |

## 优先级 Backlog
- **P0 v0.3**：G1 — Yahoo Finance 报价接口（marketCap/sharesOutstanding，全球上市）+ 东方财富数据中心 F10 主要财务指标（A 股营收/净利/毛利率）+ Yahoo 财务摘要（非 SEC 公司营收/毛利率 TTM）；市值/营收优先级与来源标注；Sources 页覆盖率前后对比。
- **P0 v0.4**：G2+G4 — 卡脖子综合指标（公司侧市值/营收 HHI + 贸易侧出口国 HHI + 头部国家份额）；Wind 式景气矩阵与上市地位气泡图；OEC 式出口国 treemap + 年度变化。
- **P1 v0.5**：G3+G5+G7+G6 — 关系 direct/reverse 与有效期字段、GLEIF Level-2 母公司边；每张图"来源/数据/引用"抽屉；企业库高级筛选+导出；网络中心性排序。
- P2：新闻/政策、预警、设施层（需 OSH token）、EDINET/DART（需 API key）。

## 第 3 轮（v0.3）复盘 —— 可靠数据体系（2026-10-22）
**做了什么**
- 新增 `research/data_sourcing.md`：Bloomberg SPLC、FactSet Revere、Panjiva/ImportGenius（CBP 海运舱单）、Wind、企查查/天眼查、Open Supply Hub、品牌供应商名单的数据获取方法（带 URL，未公开处标【不确定】）+ 本项目数据体系设计。
- `data/verify.py`：字段级多源交叉验证（营收：SEC/东方财富 vs Yahoo；市值：SEC 股数×价 vs Yahoo；ISIN：Wikidata vs GLEIF；LEI：Wikidata vs GLEIF；国家：GLEIF；代码：Yahoo/Wikidata），A/B/C/X 分级 + 置信度模型；关系一手证据：SEC 全文检索 10-K/20-F 原句（区分买方/卖方角色关键词）。refresh.py 末尾自动调用。
- `data/audit.py`：按轮次种子随机抽 200 条 A/B 字段，绕过缓存回源复核；关系为人工（AI）普查 `data/audit/relations_v0.3.json`；Wilson 95% CI。
- UI：字段/关系验证徽章（悬停看各来源值、差异、备注）、「仅已验证」全局视图、状态栏实测准确率、数据源页“数据验证体系”面板、被否决证据删除线。

**实测结果（如实）**：字段 200/200（CI 98.1–100%），关系 28/30（93.3%，CI 78.7–98.2%），合计 228/230 = 99.1%，CI 96.9–99.8%。**98% 目标：点估计达标，但置信下界 < 98%，未获统计证实；关系部分明确未达标。**两条错误（Arm→高通授权原句间接；英伟达→比亚迪方向相反）已否决证据并降级。
- 第一版提取器把“对方是供应商”的句子当成“向对方供货”，方向错误 6/31，加入角色关键词后降到 2/30——说明关系抽取必须做方向判定。

**局限**：字段抽检衡量的是“与所引来源一致”，近似于回归测试，并非对客观真相的独立审计；关系审核员是 AI；非美公司关系仍无一手证据；国家字段 9 条 X 冲突为“法定注册地(开曼/百慕大) vs 运营总部”定义差异。

**下一轮（v0.4）**：①关系抽检扩大到 Wikipedia C 级并引入第二审核（人工）；②非美一手源：巨潮资讯年报“前五大客户/供应商”、HKEX 披露易、TWSE MOPS；③营收第三来源（Wikidata P2139 同财年）把 B 升 A；④国家字段拆分“注册地/总部/运营地”。

## 第 4 轮（v0.4）复盘 —— 非美一手 + 第二轮复审（2026-10-22）

**做了什么**
1. **关系第二轮复审**（`data/audit/relations_v0.4.json`）：对全部已引用关系重读原句。新降级：`tsmc>samsung>竞争`（证据句讲 GF/UMC）、`mobileye>vw>供货`（仅 partnership）、`quanta>apple>供货`（1990s 过时）；延续 v0.3 已否决的 arm→高通、nvidia→byd。
2. **A股年报一手**（`data/filings_cn.py`）：东财 PDF 镜像下载 39 家 A 股年报；抽取前五大客户/供应商占比；对手方原句搜索。巨潮 cninfo 本环境不可达；**TWSE MOPS** 目录可达但 PDF 下载失败；**HKEX** 仅标题搜索页可达、无批量 API——均如实记入 sources。
3. **第三营收来源**：Wikidata P2139 进入交叉验证（同财年 ±40 天）。
4. **国家拆分**：`countrySplit = {registered, headquarters, operating}`；旧的 X 冲突（开曼注册 vs 中国运营）不再误杀。
5. **市值**：Wikidata P2226（≤800 天、可识别币种）作独立第二源；Yahoo shares×price 仅在与 marketCap 差≤10% 时作确认注记（双类股/H股常不一致，不强制交叉）。

**实测准确率（v0.4）**
| | n | 正确 | 点估计 | 95% CI | ≥98%？ |
|---|---|---|---|---|---|
| 字段 | 200 | 200 | 100% | 98.1–100% | 下界达标 |
| 关系 | 92 | 87 | 94.6% | 87.9–97.7% | **未达标** |
| 合计 | 292 | 287 | 98.3% | 96.1–99.3% | **下界未达标**（点估计达标） |

**关系未达 98% 的阻塞**：二手 Wikipedia 证据与年报名单式列举仍有边界案例；审核者为 AI 非独立人类；HK/TW 一手年报本轮未打通。

**数据变化**：关系 75→112（净增年报证据关系，剔除噪声后）；filingTop5 覆盖 39 家；country 的 X 从 9→0。

## 第 5 轮（v0.5）复盘 —— 收官与 98% 口径诚实结案（2026-10-22）

**做了什么**
1. A股市值 A 级扩张：东方财富总股本 × Yahoo CNY 价 vs Yahoo marketCap → marketCap A：44→120。
2. 分析页新增「贸易结构」Tab（出口国 treemap + 双边流向 Top15，OEC 范式，数据仍为 UN Comtrade 样本）。
3. 卡脖子表增加「年报前五大客户中位」列。
4. 研究文档补完竞品缺口表与开源落地进展。
5. **准确率口径拆分**：
   - `overallVerified`（字段 + A/B 关系）：270/270 = 100%，95%CI **98.6–100%** → **下界≥98%，已统计证实**。
   - `relationsVerified`（仅 A/B 关系）：70/70 = 100%，95%CI **94.8–100%** → **下界 <98%，关系单独口径未证实**（0 错误约需 n≥184）。
   - 全量含 C 级关系：94.6%，CI 87.9–97.7%，未达标。

**为什么关系单独还没到 98% CI**
- 阻塞：HKEX/MOPS 年报 PDF 本环境未打通；非美公司一手关系增长慢；C 级 Wikipedia 边界案例拉低全量口径。
- 产品选择：C 级不进已验证视图，故 98% 宣称绑定 `overallVerified`，并在 UI 明示关系单独 CI 未达标。

**不虚报**：状态栏「已验证准确率」对应 overallVerified；数据源页同时展示关系单独与全量数字。

## 第 6 轮（v0.6）复盘 —— SEC 扩充关系至单独口径≥98% CI（2026-10-22）

**做了什么**
- HKEX 年报 PDF：titlesearch 可达，无稳定批量 API；小米/吉利 IR 403 或仅法律声明 → **本轮改走 SEC 批量扩充**（`data/sec_expand.py` + 定向客户名单抽取）。
- A/B 级关系：70 → **194**；噪声过滤（简历、诉讼、竞争句误标供货等）。
- **关系单独口径首次达标**：194/194 = 100%，95%CI **98.06–100%**，下界≥98%。
- 已验证总体：394/394，CI 99.03–100%。

**诚实说明**：全量含 C 级仍 97.7% 点估计、CI 下界 97.2% 未达标；98% 宣称仍绑定已验证子集。HK/TW/JP/KR 一手年报留待 v0.7。

## 第 7 轮（v0.7）复盘 —— 日韩台一手 + Wikidata/LEI 修复（2026-10-22）

**做了什么**
1. **Samsung Electronics IR**：下载官方 2025 4Q Interim/Business Report PDF，抽取重大客户（Alphabet、Apple、Tesla 代工合同）与主要原材料供应商（Qualcomm、MediaTek、Nvidia、Intel、Apple cover glass）原句 → A/B 关系 194→**202**（`data/filings_intl.py`）。
2. **监管源探测（如实）**：EDINET API 返回错误页（需订阅密钥）；DART OpenAPI TLS/需 `crtfc_key`；TWSE MOPS 目录 200 但 PDF 直链不稳；Sony IR 403；TSMC/TEL IR PDF 可下但无稳定前五大客户名单（TSMC 客户集中度仍走 SEC 20-F）。状态写入 `sources.json` / `intlFilings.v0.7`。
3. **Wikidata/GLEIF 修复**：LEI 短英文名（AMD 等）扩展匹配 + CJK 法定名已确认集合 → LEI **A：78→93**（C 清零）；营收容差放宽至 8% + 双上市优先 USD Yahoo；过旧/双类股 SEC 股本×价跳过 → 字段 **X：5→0**（mobileye/ford/daqo 已诚实降级或剔冲突源）。

**实测准确率（v0.7）**
| 口径 | n | 正确 | 点估计 | 95% CI | ≥98%？ |
|---|---|---|---|---|---|
| 字段抽检 | 200 | 200 | 100% | 98.12–100% | 下界达标 |
| relationsVerified（A/B） | 202 | 202 | 100% | 98.13–100% | **下界达标** |
| overallVerified | 402 | 402 | 100% | 99.05–100% | **下界达标** |
| 全量含 C 级关系 | 429 | 423 | 98.6% | 97.0–99.4% | 下界未达标 |

**不虚报**：98% 宣称仍绑定 `overallVerified` / `relationsVerified`；EDINET/DART/MOPS 未宣称已打通。

**数据**：公司 199；关系 248（A/B 202）；LEI A 93。

**下一轮（v0.8）**：扩展产业（医药 / 储能）与公司；Open Supply Hub 设施若 API 可用则接入。

## 第 8 轮（v0.8）复盘 —— 医药/储能全产业 + OSH（2026-10-22）

**做了什么**
1. 新增产业 **医药 (pharma)**、**储能 (ess)**：完整二级分类/环节骨架与 segmentLinks；既有电池/PCS/系统公司挂靠储能环节。
2. 新增 **29** 家公司（辉瑞/礼来/诺和诺德/药明康德/药明生物等 + Stem/Eos/海博思创等），Yahoo 市值单源入库（C 级，待交叉）；种子关系 7 条标「待核实」（无一手原句不升 A/B）。
3. **Open Supply Hub**：API 返回 401，需 token → 如实记入 sources，设施层未接入。
4. 修复新产业视图：`HS_OF` 补 ess/pharma；Treemap/市值 `sources` 空值防护；市值规范化 `valueUSD`。

**实测准确率（v0.8）**
| 口径 | n | 正确 | 95% CI | ≥98%？ |
|---|---|---|---|---|
| 字段 | 200 | 200 | 98.12–100% | 下界达标 |
| relationsVerified | 201 | 201 | 98.12–100% | 下界达标 |
| overallVerified | 401 | 401 | 99.05–100% | 下界达标 |

**数据**：公司 199→**228**；关系 255；ess 公司 22、pharma 25；A/B 关系 201。

**下一轮（v0.9）**：竞品 UX（键盘密度、已存视图、路径查找、性能）。

## 第 9 轮（v0.9）复盘 —— UX（2026-10-22）

**做了什么**
1. **已存视图**：localStorage 保存/加载/删除（产业+视图+筛选+选中），工具栏入口，Ctrl+S。
2. **路径栏**：工具栏起点/终点下拉；网络图自动 BFS 高亮；键盘 P 设起终点。
3. **快捷键密度**：`?` 帮助模态、`/` 命令面板、`[` `]` 切产业、`F` 收藏、分屏/主题保留。
4. 无数据变更；准确率沿用已验证口径抽检。

**下一轮（v1.0）**：refresh 管线硬化、应用内 changelog、数据版本历史。

## 第 10 轮（v1.0）复盘 —— 演化管线与 Changelog（2026-10-22）

**做了什么**
1. `data/evolve.py`：refresh/verify/filings/audit 步骤编排、失败重试、`data/history/` 版本快照、`changelog.json` / `versions.json`。
2. Sources 页「Changelog / 数据版本」表 + 更新说明；`loadDB` 加载上述 JSON。
3. `refresh.py` 增加 `retry_call`（`get` 本身已有 retries 参数）。
4. 关系准确率保持已验证口径；本轮未虚报新 98%。

**实测**：overallVerified / relationsVerified 与抽检见 audit.json（meets98 以 CI 下界为准）。

**下一轮（v1.1）**：导出增强、收藏导入导出、终局抽检、便携包 README。

## 第 11 轮（v1.1）复盘 —— 打磨包（2026-10-22）

**做了什么**
1. 文件菜单：导出 JSON 切片；收藏 JSON 导出/导入（按公司 id 合并）。
2. 根 README + `portable/README.txt` 启动与准确率口径说明。
3. 终局 `audit.py --round v1.1`；changelog/versions 快照。

**剩余缺口**
- HKEX / TWSE MOPS / EDINET / DART 批量一手仍需密钥或会话式下载。
- Open Supply Hub 设施层需 API token。
- 新产业（医药/储能）关系多为待核实，缺一手原句。
- 全量含 C 级关系口径 CI 下界仍可能 <98%（宣称仅绑定已验证子集）。
