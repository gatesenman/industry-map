# 竞品研究 v2（2026-10-22，自进化 v1.5–v1.7 依据）
方法：只读公开官网、产品说明、帮助文档及学术方法论文献（下方均附链接）。没有试用付费账号，也不引用竞品的数据，只学习它们的方法和交互。

## 一、数据方法：竞品的数据从哪来、怎么保证可信
| 竞品 | 数据来源（公开说明） | 关键方法 | 对我们的启发 | 出处 |
|---|---|---|---|---|
| Bloomberg SPLC | 年报/季报、电话会纪要、投资者演示、卖方会议、新闻稿、官网；人工+程序采集 | ① 关系量化：收入占比 × 供方营收 ÷ 客户对应成本桶（COGS/CAPEX/R&D/SG&A）；② 无披露时用算法估计（明确区分“披露值/推导值/估计值”）；③ “透明度图标+弹窗”直达申报原文位置；④ 关系在披露后保留 4 年（平均合同期） | 证据弹窗直达原句 ✅v1.5；4 年时效标记 ✅v1.6；量化只用披露值，不做估计 | [Emory 图书馆 SPLC 说明](https://libraries.emory.edu/sites/default/files/migrated-documents/db-pages/bloomberg-splc.pdf)、[Bloomberg Insights](https://www.bloomberg.com/professional/insights/trading/researching-supply-chain-exposures-how-to-analyse-coronavirus-related-risks/)、[Culot 2023, JSCM](https://onlinelibrary.wiley.com/doi/10.1111/jscm.12294) |
| FactSet Revere | 10-K、投资者演示、新闻稿等一手来源；年度全面复核+每日监控 | ① “反向链接”：A 未披露但 B 披露了与 A 的关系，也计入（直接披露/反向披露）；② 4 大类（客户/供应商/伙伴/竞争）13 子类；③ 起止日期、相关度排名、收入依赖度 | 显示披露方（本方/对方/第三方）✅v1.6；关系类型筛选 ✅v1.6 | [FactSet API 目录](https://developer.factset.com/api-catalog/factset-supply-chain-api)、[FactSet 产品页](https://www.factset.com/marketplace/catalog/product/factset-supply-chain-relationships)、[Lancaster 工作论文](http://wp.lancs.ac.uk/ldwcf/files/2025/03/no.10_LPT_Corporate-Social-Responsibility-in-Supply-Chains.pdf) |
| S&P Panjiva | 海关提单（美国等） | 货运级流向、HS 编码过滤 | 提单数据付费，不可得；只记录 | — |
| Sayari Graph / Map | 250+ 司法辖区的工商、贸易记录；称每天刷新 2 次 | ① 自动股权穿透；② 每条连线都有一手来源，可一键生成“证据包”供法务审阅；③ Tier-1 到 Tier-N 上游映射 | 证据包导出 ✅v1.7；N 层上游 ✅v1.7 | [Sayari Graph](https://sayari.com/platform/graph/)、[Sayari Map 发布 2026-04-07](https://sayari.com/resources/newsroom/sayari-launches-new-supply-chain-mapping-solution-to-automate-risk-detection-in-upstream-suppliers/) |
| Altana Atlas | 自有物流数据 + 公开/商业记录 + 客户联邦数据 | N 层价值链遍历、单一来源（单点故障）识别、地理集中度、收入风险 | 上游单点故障标记 ✅v1.7；地理集中度已在“链条风险”视图 | [Altana Platform](https://altana.ai/platform)、[Altana 帮助中心](https://docs.altana.ai/catalog/getting-data-in/article.html) |
| Everstream | 网络映射“数字孪生”、事件预测与告警 | 事件驱动告警 | 告警订阅仍待办（需要事件数据源） | — |
| 企查查 产业链 | 工商大数据 + 行业专家搭建“产业链底座”，称 150+ 条产业链、4100 万+ 企业 | 产业链概况 → 图谱（框架图/树图）→ 节点企业库（按地域/资质筛选、批量导出）→ 政策 → 新闻 | 节点 → 企业库 → 导出 的路径值得学；政策/新闻模块需要数据源，暂缺 | [企查查产品中心](https://b.qcc.com/portal/solutions/industrial-chain)、[证券之星报道](https://wap.stockstar.com/detail/SS2024111400016830) |
| 天眼查 产业链 / 天眼图谱 | 3.5 亿社会实体、8000 细分领域 | 股权全景穿透、最短股权路径 | 我们已有路径查找；股权穿透受限于公开数据 | [中国日报网 2023-04-05](https://caijing.chinadaily.com.cn/a/202304/05/WS642ce86ea3102ada8b236e34.html) |
| Wind / 同花顺 / 东方财富 产业链 | 环节挂个股 + 实时行情 | 环节涨跌着色 | 已有行情；保持 | 公开产品页（无可引用方法说明） |
| 萝卜投研 / 慧博 | 研报汇聚 | 研报原文片段 | 研报版权受限，不抓取 | — |

## 二、学到的 5 条原则
1. **可信 = 能一键回到原文**：Bloomberg 的透明度弹窗、Sayari 的证据包，本质都是“每个连线都能回到一手原句”。我们 v1.5 在网络图和表格里加上原句预览，v1.7 支持导出证据包。
2. **关系会过期**：Bloomberg 对关系保留 4 年，FactSet 记录起止日期。我们没有合同终止数据，所以只按“最新证据披露日”标记超过 4 年的关系为“可能过期”，不自动删除。
3. **谁披露的很重要**：FactSet 区分直接披露和反向披露。供方自己披露、客户披露、第三方文件提到，可信度和含义都不同。
4. **一手优先，估计值要分开标**：Bloomberg 把推导值和算法估计值分开。我们不做任何估计，只展示有原文的数字。
5. **从环节到企业库再到导出**：企查查和天眼查的使用路径很清楚：先看全景，再点环节看企业，最后导出。

## 三、我们不跟进的
- 海关提单、实时事件告警：需要付费数据。
- 研报汇聚：有版权问题。
- 对没有披露的关系做算法估计：这违反“不编数据”的原则。
