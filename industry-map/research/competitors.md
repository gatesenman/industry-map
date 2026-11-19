# 行业竞品分析（产业链 / 供应链情报产品）
> 2026-10-21 调研。仅记录检索到的公开资料，每条附来源；未检索到详细公开资料的产品单独标注。

## 1. 金融终端类
### Bloomberg SPLC（供应链函数）
- 以单家公司为中心列出**供应商 / 客户 / 竞争对手**；关系量化为"占对方成本 % / 占自身营收 %"，并把供应商支出归入 COGS / CAPEX / R&D / SG&A 四类成本桶。来源：[Emory 图书馆 SPLC 说明](https://dev.libraries.emory.edu/sites/default/files/migrated-documents/db-pages/bloomberg-splc.pdf)
- 数据来源：监管申报（10-K 等）、业绩会纪要、投资者演示、卖方会议、新闻稿、公司网站；人工 + 程序聚合；未披露的金额用"数学推导 / 算法推导"补足（例：INTC 披露 HPQ 占其营收 21% → 推出 INTC 占 HPQ COGS 9.5%）。来源同上；[美国商务部图书馆](https://library.doc.gov/c.php?g=1257152&p=9211692)
- 美国 Reg S-K 只要求披露 >10% 营收的客户，其他市场披露更少，这是供应链数据天然不完整的根因。来源：Emory PDF
- 关系保留 4 年（平均合同期）；只有 Bloomberg 提供金额估计。来源：[Culot 2023, JSCM 方法论评述](https://onlinelibrary.wiley.com/doi/10.1111/jscm.12294)

### FactSet Revere Supply Chain Relationships
- 4 大类（客户/供应商/合作伙伴/竞争对手）+ 13 个子类；区分 **Direct（本公司披露）与 Reverse（对手方披露）**；附关键词、相关性排名、中心性指标、已知营收依赖与营收占比。来源：[FactSet 产品页](https://www.factset.com/marketplace/catalog/product/factset-supply-chain-relationships)、[FactSet Supply Chain API](https://developer.factset.com/api-catalog/factset-supply-chain-api)
- 覆盖：亚洲 21,800、北美 9,500、欧洲 6,800 等实体，每日更新。来源：FactSet 产品页
- API 参数 `relationshipDirection=ALL|DIRECT|REVERSE`、`companyType=PUBLIC/PRIVATE/ALL`。来源：[FactSet SDK 文档](https://github.com/FactSet/enterprise-sdk/blob/main/code/dotnet/FactSetSupplyChain/v1/docs/RelationshipsApi.md)

### Wind 产业链（PDB）& 供应链（SDB）数据库
- 基于 UNSPSC 10000+ 产品词本地化为 10 层产品分类，构建 **8 层、5154 个产业、16 万+ 上下游关系**；公司主营逐项匹配标准产品词，并**取得与该产品相关的营收**（不只是打标签）。来源：[Wind PDB 页](https://www.wind.com.cn/portal/zh/PDB/index.html)、[搜狐转载发布稿](https://www.sohu.com/a/583032903_99992453)
- 视图：树图上下游逐级展开；**产业景气矩阵**（总毛利增速 × 总毛利规模，气泡=关联公司总收入）；**上市地位**（市值/估值/ROE，气泡=总市值）；上市公司主营分析表；产量/销量/库存经营数据；产业地图（颜色深浅=集群数量，可叠加上下游气泡）；产业资讯。来源同上；[CEIBS LibGuides](https://ceibs.libguides.com/blogs/cn/news/newresources/home/Wind)
- SDB：2 万+ A/H 公司披露的客户/供应商，含交易金额 → 风险传导可量化；支持自定义添加关联企业。来源：搜狐转载稿

### 同花顺 iFinD 产业图谱
- 3D 动态图谱；节点扩展（子产业链）、跨图谱跳转、自定义环节公司与指标、**指标公式联动推演**、用户可自绘图谱并共享。来源：[iFinD 使用指南](https://maoyanqing.com/ifind)、[iFinD 产品页](https://www.forfunds.cn/platform/pcweb/productCenter/iFinD/)
- 宏观 EDB 约 160 万指标，与产业图谱联动。来源：iFinD 使用指南

## 2. 企业信息查询类
### 企查查 产业链
- 模块：产业链概况（上中下游结构、区域分布、企业总量/上市/融资/科技荣誉统计）→ 产业链图谱（框架图+树状图，节点可下钻企业库）→ 企业库 → 政策 → 新闻。来源：[新浪财经 2024-09-24](https://finance.sina.com.cn/roll/2024-09-24/doc-incqfnkx1408274.shtml)
- 金融版：150 条精选产业链、区域分布热力图下钻到区县、核心企业名录按节点产品/地域/注册资本等筛选并**批量导出**。来源：[证券之星](https://wap.stockstar.com/detail/SS2024111400016830)、[企查查产品中心](https://b.qcc.com/portal/solutions/industrial-chain)（"150+ 产业链全景图，覆盖 4100 万+ 企业""专家搭建标准化产业链底座"）
### 天眼查 天眼图谱
- 以股权为主：股权全景穿透、股东持股穿透（多节点）、对外投资穿透、两实体间**最短股权路径**；概览汇总、筛选、时间轴、图+表同步导出。来源：[人民网](http://finance.people.com.cn/n1/2023/0404/c1004-32657604.html)、[新浪](https://finance.sina.cn/tech/2023-04-03/detail-imypaxhi0159478.d.html)

## 3. 贸易 / 供应链风险类
### S&P Panjiva
- 提单（BoL）级数据：发货人/收货人、品名、重量、集装箱/TEU、HS/HTS、港口、原产/目的国；实体消歧、企业族谱；Network View 三层买家-供应商图；保存搜索 + 邮件提醒；导出。来源：[S&P Panjiva](https://www.spglobal.com/market-intelligence/en/solutions/products/panjiva-supply-chain-intelligence)、[Panjiva 可视化](https://pages.marketintelligence.spglobal.com/Panjiva-Jump-Start-Visualization.html)、[API 文档](https://panjiva.com/api-guide/)
- 局限：美国只公开海运提单、无货值、企业可申请匿名。来源：[美联储 FEDS 2021-066](https://www.federalreserve.gov/econres/feds/files/2021066pap.pdf)
### Resilinc / Everstream / Interos（多层级映射）
- Resilinc：供应商验证的站点/零件级多层映射 + 实时事件预警；Everstream：网络推断的次级供应商可见性 + 预测性中断分析；Interos：AI 自动多层映射，覆盖金融、网络安全、地缘、ESG、限制名单风险。来源：[Resilinc](https://resilinc.ai/products/multi-tier-mapping/)、[Everstream Discover](https://www.everstream.ai/platform/platform-sub-tier-visibility/)、[Interos](https://www.interos.ai/solutions/supply-chain-mapping)
### 未检索到详细公开资料（本次不下结论）
Altana、Sayari、Craft.co、Crunchbase、PitchBook、CB Insights、Choice、中研普华/前瞻、慧博/券商图谱 —— 本轮检索未取得可引用的功能说明，留待后续。

## 4. 共性提炼：什么让它们"显得权威"
1. **标准化分类底座**（Wind 基于 UNSPSC、企查查"专家搭建底座"）+ 公司→产品→**营收**的量化映射。
2. **关系的方向与出处**：Direct/Reverse（FactSet）、来源文档类型、关系有效期（Bloomberg 4 年）。
3. **量化暴露度**：占营收 %/占成本 %，金额推导方法透明（Bloomberg 区分披露值/推导值）。
4. **景气与规模的二维图**（Wind 景气矩阵、上市地位）、区域热力图下钻、批量导出、保存搜索/预警。
5. **覆盖率声明**（实体数、关系数、更新频率）公开写在产品页上。

## 5. v0.5 补充：对标我们已落地的能力缺口
| 竞品能力 | 我们 v0.5 状态 | 差距 |
|---|---|---|
| Bloomberg 披露值/推导值区分 | 有 A/B/C/X + 方法字段；无金额 %Revenue 推导 | 缺量化暴露度模型 |
| FactSet Direct/Reverse | 关系有方向；SEC/年报原句可判买方/卖方 | 未系统标注 direct/reverse 标签 |
| Wind 景气矩阵 | 分析页有宏观+毛利对比 | 无气泡矩阵专用视图 |
| Panjiva 提单 | 未接入（需付费/美国海运公开数据清洗量大） | 明确不做提单级 |
| Open Supply Hub 工厂 | API 需 token，本环境 401 | 未接入 |
