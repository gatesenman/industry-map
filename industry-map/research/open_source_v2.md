# 开源产品研究 v2（2026-10-22）

范围：只看和“产业链地图”直接相关的方向：图可视化、图数据库/知识图谱、地理可视化、BI 仪表盘、数据管线与血缘、实体解析、一手数据（SEC）与合规数据。
星标数：2026-10-22 北京时间中午通过 GitHub REST API `/repos/{owner}/{repo}` 实时读取，共 39 个真实仓库。kepler-gl/kepler.gl 和 open-supply-hub/open-supply-hub 返回 404，未列入。

| # | 仓库 | ⭐ | 方向 | 可学习点 | 本项目对应 |
|---|---|---|---|---|---|
| 1 | [d3/d3](https://github.com/d3/d3) | 113,790 | 图可视化 | 数据驱动 SVG/力导向/层级布局 | 已间接使用（G6 d3-force 布局） |
| 2 | [grafana/grafana](https://github.com/grafana/grafana) | 77,416 | 仪表盘 | 面板+告警规则+数据源插件状态 | 数据源健康页借鉴“数据源状态”；告警待办 |
| 3 | [apache/superset](https://github.com/apache/superset) | 75,245 | BI | 联动筛选、语义层、图表库 | 风险/价格视图联动筛选 |
| 4 | [apache/echarts](https://github.com/apache/echarts) | 67,568 | 图表 | 已在用；SVG 导出、大数据量渲染 | 已在用 |
| 5 | [run-llama/llama_index](https://github.com/run-llama/llama_index) | 52,607 | AI 抽取 | 文档解析→结构化抽取 | 年报/公告原句抽取（只做候选，人工复核后入库） |
| 6 | [metabase/metabase](https://github.com/metabase/metabase) | 49,789 | BI | 问题→可分享卡片 | 分享链接（v1.4 已做） |
| 7 | [apache/airflow](https://github.com/apache/airflow) | 47,252 | 管线 | DAG 调度、重试、回填 | evolve.py 已有步骤重试；每日例行任务 |
| 8 | [xyflow/xyflow](https://github.com/xyflow/xyflow) | 38,740 | 节点编辑 | 节点/连线手柄、MiniMap | 流程图交互参考 |
| 9 | [microsoft/graphrag](https://github.com/microsoft/graphrag) | 36,408 | 知识图谱+AI | 从文本抽实体关系并做社区摘要 | 借鉴“关系必须挂原文片段”；不让 AI 直接写入关系 |
| 10 | [getredash/redash](https://github.com/getredash/redash) | 28,843 | BI | 查询+可视化+分享 | — |
| 11 | [PrefectHQ/prefect](https://github.com/PrefectHQ/prefect) | 24,059 | 管线 | 运行可观测性 | 管线运行记录写入 changelog |
| 12 | [dgraph-io/dgraph](https://github.com/dgraph-io/dgraph) | 21,811 | 图数据库 | 分布式图存储 | 当前数据量（228 公司/260 关系）无需图数据库 |
| 13 | [neo4j/neo4j](https://github.com/neo4j/neo4j) | 17,349 | 图数据库 | 属性图、路径查询 | N 层上游遍历（v1.7）在前端完成 |
| 14 | [dagster-io/dagster](https://github.com/dagster-io/dagster) | 16,311 | 管线 | 资产血缘（asset lineage） | 字段级来源徽章（v1.5） |
| 15 | [visgl/deck.gl](https://github.com/visgl/deck.gl) | 14,694 | 地理可视化 | WebGL 大规模弧线/图层 | 世界地图大量流向时的性能方案（备选） |
| 16 | [datahub-project/datahub](https://github.com/datahub-project/datahub) | 12,875 | 元数据 | 数据目录+血缘 | 数据源目录页 |
| 17 | [vesoft-inc/nebula](https://github.com/vesoft-inc/nebula) | 12,441 | 图数据库 | 分布式图 | 同上，暂不需要 |
| 18 | [antvis/G6](https://github.com/antvis/G6) | 12,341 | 图可视化 | 已在用：tooltip、minimap、lasso、combo | 边按等级加粗+原句悬停（v1.5） |
| 19 | [jacomyal/sigma.js](https://github.com/jacomyal/sigma.js) | 12,199 | 图可视化 | WebGL 渲染上万节点 | 节点数 >2000 时的备选 |
| 20 | [OpenRefine/OpenRefine](https://github.com/OpenRefine/OpenRefine) | 12,048 | 数据清洗 | 聚类去重、对齐 Wikidata（reconcile） | 名录对齐 Wikidata 的方法参考 |
| 21 | [maplibre/maplibre-gl-js](https://github.com/maplibre/maplibre-gl-js) | 11,913 | 地理可视化 | 矢量瓦片地图 | 离线矢量底图（备选） |
| 22 | [cytoscape/cytoscape.js](https://github.com/cytoscape/cytoscape.js) | 11,249 | 图可视化 | 图论算法（中心性、最短路） | 路径查找/中心性 |
| 23 | [evidence-dev/evidence](https://github.com/evidence-dev/evidence) | 7,045 | BI as code | Markdown+SQL 生成报告 | 证据包用 Markdown 导出（v1.7） |
| 24 | [gephi/gephi](https://github.com/gephi/gephi) | 6,683 | 图分析 | 模块度/布局算法 | —（桌面端参考） |
| 25 | [lightdash/lightdash](https://github.com/lightdash/lightdash) | 6,198 | BI | 指标定义集中管理 | 指标口径说明 |
| 26 | [apache/age](https://github.com/apache/age) | 4,910 | 图数据库 | PostgreSQL 上的图扩展 | — |
| 27 | [memgraph/memgraph](https://github.com/memgraph/memgraph) | 4,625 | 图数据库 | 内存图计算 | — |
| 28 | [dedupeio/dedupe](https://github.com/dedupeio/dedupe) | 4,519 | 实体解析 | 主动学习的模糊匹配 | 公司去重/别名匹配（已有 QID+LEI 精确匹配） |
| 29 | [visjs/vis-network](https://github.com/visjs/vis-network) | 3,635 | 图可视化 | 物理布局、聚类折叠 | 聚类折叠（待办） |
| 30 | [dgunning/edgartools](https://github.com/dgunning/edgartools) | 2,807 | 一手数据 | SEC 申报解析、XBRL | SEC 全文检索与原文抽取（我们自写 verify.py，可参考） |
| 31 | [OpenLineage/OpenLineage](https://github.com/OpenLineage/OpenLineage) | 2,719 | 数据血缘 | 血缘元数据标准 | 每条记录的 source/url/retrieved 字段 |
| 32 | [moj-analytical-services/splink](https://github.com/moj-analytical-services/splink) | 2,520 | 实体解析 | 概率记录链接（Fellegi-Sunter） | 跨来源公司匹配打分 |
| 33 | [alephdata/aleph](https://github.com/alephdata/aleph) | 2,452 | 调查平台 | 文档+实体图谱，证据可回溯 | “证据包”思路（v1.7） |
| 34 | [vasturiano/force-graph](https://github.com/vasturiano/force-graph) | 2,148 | 图可视化 | Canvas 力导向 | — |
| 35 | [sec-edgar/sec-edgar](https://github.com/sec-edgar/sec-edgar) | 1,418 | 一手数据 | 批量下载 EDGAR 申报 | — |
| 36 | [zinggAI/zingg](https://github.com/zinggAI/zingg) | 1,257 | 实体解析 | 大规模实体解析/MDM | — |
| 37 | [opensanctions/opensanctions](https://github.com/opensanctions/opensanctions) | 849 | 合规数据 | 制裁/PEP 开放数据，FollowTheMoney 数据模型 | 风险旗标（可接入，作为未来数据源） |
| 38 | [wikimedia/wikidata-query-gui](https://github.com/wikimedia/wikidata-query-gui) | 82 | 开放知识 | SPARQL 查询界面 | 已在用 Wikidata SPARQL |
| 39 | [openownership/data-standard](https://github.com/openownership/data-standard) | 82 | 数据标准 | 受益所有权数据标准 BODS | 股权关系字段设计参考 |

## 结论
1. **证据可回溯是共识**：Aleph、GraphRAG 和 OpenLineage 都要求实体或关系能追溯到原文或上游。我们 v1.5 做了字段级来源，v1.7 做了证据包。
2. **AI 只做候选，不直接入库**：LlamaIndex 和 GraphRAG 能从年报里批量抽关系，但会误抽。我们这轮就删掉了 3 条自动抽取错误（比如把 intellectual 匹配成了 Intel），所以坚持“抽取 → 人工逐句复核 → 入库”。
3. **现阶段不需要图数据库**：库里只有 260 条关系，前端 BFS 就能完成 N 层追溯。关系超过 10 万条时再考虑 Neo4j 或 Apache AGE。
4. **实体解析是下一步的瓶颈**：Splink、Dedupe 和 OpenRefine reconcile 可以用来扩大公司名录、匹配港股和 A 股公告里的中文名。
5. **OpenSanctions 是可以接入的开放风险数据**：可以作为后续“风险旗标”的数据源（需要先确认许可）。