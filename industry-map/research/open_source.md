# 开源产品 / 开放数据调研
| 项目 | 可复用点 | 许可 / 访问 | 来源 |
|---|---|---|---|
| FollowTheMoney / OpenSanctions | 实体图模型：实体=id+schema+多值属性；关系也是"中间实体"（Ownership 含 owner/asset/percentage/startDate/sourceUrl）。适合我们把"关系"建模为带证据的一等实体 | 数据 CC BY-NC（OpenSanctions），模型 MIT | [Entity structure](https://www.opensanctions.org/docs/entities/)、[Ownership schema](https://followthemoney.tech/explorer/schemata/Ownership/)、[Bulk JSON](https://www.opensanctions.org/docs/bulk/json/) |
| Open Supply Hub | 全球工厂/设施开放数据库，OS ID；可补"公司→生产基地(经纬度)"层 | 数据 CC BY-SA 4.0；**API 需订阅 token**（本机测试 401） | [FAQ](https://info.opensupplyhub.org/faqs)、[API 文档](https://info.opensupplyhub.org/resources/api-documentation)、[API ToS](https://info.opensupplyhub.org/resources/api-terms-of-service) |
| Wikidata | 已用：QID、ISIN、LEI、官网、产品、母子公司、市值/营收（带时点）| CC0 | https://query.wikidata.org/ |
| GLEIF | 已用：LEI 法定名称/注册地；还提供 **直接/最终母公司关系（Level 2）** 可用于股权链 | CC0 | https://api.gleif.org/ |
| OpenCorporates | 全球注册公司数据；API 需 key | ODbL / 商业 | https://opencorporates.com/ |
| OEC（经济复杂度观察站） | Tesseract API（BACI 数据）按 HS×出口国×年份；**出口国 treemap、产品空间**视图范式 | 部分免费，API 需 token | [Endpoints](https://oec.world/en/resources/api/endpoints)、[Fetching data](https://oec.world/en/resources/api/data) |
| UN Comtrade | 已用：公开预览 API，HS6×申报国×伙伴国 | UN 条款 | https://comtradeplus.un.org/ |
| AntV G6 v5 | 已用：dagre/力导、minimap、套索/框选、右键、hover 激活；还可用 combo（分组）、bubble-sets、edge-bundling、timebar 插件 | MIT | node_modules/@antv/g6/lib/plugins |
| AntV X6 | 可编辑流程图（用户自绘产业链，对标 iFinD"图谱可编辑"）| MIT | https://x6.antv.antgroup.com/ |
| Cytoscape.js / Sigma.js / Gephi | 大图渲染（Sigma WebGL 万级节点）、图算法（中心性、社区发现）| MIT/GPL | https://js.cytoscape.org/ 、https://www.sigmajs.org/ |
| Kepler.gl / deck.gl | ArcLayer 大规模 OD 弧线、Hexagon 聚合；比 ECharts-GL 更适合设施级点位 | MIT | https://deck.gl/ |
| Apache Superset / Observable Plot | 仪表盘与快速统计图范式（小多图 small multiples）| Apache-2 / ISC | https://superset.apache.org/ 、https://observablehq.com/plot/ |
| Our World in Data Grapher | 每张图自带"来源 + 下载 + 引用本图"标签页、时间滑块、国家选择器 → **权威感的 UX 模板** | CC BY | https://ourworldindata.org/ |
| Kumu | 系统图/关系图的"视图=过滤+装饰"配置化思路 | 商业（免费公开项目） | https://kumu.io/ |

## 可直接落地的想法
1. 关系建模参考 FtM：`Relation{type, subtype, direction(direct/reverse), evidence[], start/end, status}`。
2. GLEIF Level-2 母公司关系 → 自动补"控股"边（权威、CC0）。
3. OWID 式"来源/下载/引用"标签页附在每个图表上。
4. OEC 式"出口国 treemap + 年度对比"视图（我们已有 Comtrade 数据）。
5. 中心性（度/介数）指标作为"关键企业"排序（FactSet 也提供 centrality）。

## v0.5 落地进展
- ✅ OEC 式贸易：分析页增加「贸易结构」Tab（按 HS 出口国 treemap + 同比）。
- ✅ 卡脖子：HHI + 年报前五大客户占比中位数双信号。
- ✅ GLEIF 注册地/总部拆分（countrySplit）。
- ⏸ GLEIF Level-2 母公司边、OWID 式每图「来源」页：列入后续。
- ⏸ Open Supply Hub / OpenCorporates：需 token，本轮不做。
