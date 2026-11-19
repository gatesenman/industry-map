# 全球产业链地图 源代码包 3.3.0

内容（数据版本 **v3.3**：228 家公司 / 618 条关系；桌面程序 3.3.0，内置 v3.3 基线 + 本机自更新）

```
industry-map/   网页版（React 19 + Vite 8 + TypeScript）
  src/            前端（含「数据源」页 DataUpdate.tsx：本机更新说明）
  public/data/    数据包（core/micro/macro/…/versions.json）
  data/           Python 数据脚本（可选：助手/研究员用；桌面日常更新不依赖它们）
desktop/        Electron 桌面版
  main.js preload.js
  updater/        本机数据自更新器（行情/SEC/GLEIF/Wikidata/宏观/贸易/大宗 + SEC 年报关系发现与轮转扫描）
  seed/           别名、营收覆盖、墓碑关系、已扫描年报种子
  web/            构建好的前端 + 内置数据（也可由 industry-map/dist 覆盖）
```

## 数据怎么升级（程序自己能做）
- **内置基线**：asar 内 `web/data`，断网可用；「恢复内置数据」回到此版。
- **本机自动更新（默认每天启动检查）**：Yahoo/东方财富股价与汇率、SEC XBRL、GLEIF、Wikidata、World Bank/IMF/FRED、UN Comtrade、Pink Sheet；重算市值/营收。
- **关系自动生长**：扫描目录内美股/ADR 最新 10-K/20-F/40-F，抽取竞争/供货/合资/授权原句 → C 级「自动·待复核」；不改已有 A/B。日常轮转扫过期年报；约每 7 天自动深度扫描。
- **仍需人工/助手（可选）**：A/H/台股年报深度核验、多源升 A/B、待核实清理、新增公司、抽检审计。

## 构建网页版
```
cd industry-map && npm install && npm run build
```

## 构建桌面版（Windows x64）
```
# 把 industry-map/dist 复制到 desktop/web
cd desktop && npm install
# package.json 的 build.directories.output 请改成自己的目录
npx electron-builder --win zip --x64
# Linux 交叉编译加：-c.win.signAndEditExecutable=false
```
调试：`IM_NOAUTO=1 npx electron .`

## 桌面数据位置
- 内置：`resources\app.asar` → `web\data`
- 本机：`%APPDATA%\全球产业链地图\industry-data\current`（备份在 backups）
