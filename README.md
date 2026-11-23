# 全球产业链地图

**3.3.0** · 全球产业链关系地图。数据版本 v3.3：228 家公司、618 条关系。桌面程序可在本机自动更新行情与关系，断网也能使用内置基线。

## 功能特性

- 网页版（React + Vite + TypeScript）与 Electron 桌面版。
- 内置 v3.3 基线数据，断网可用；可「恢复内置数据」。
- 本机自动更新（默认每天检查）：行情、汇率、SEC、GLEIF、Wikidata、宏观与贸易等来源，并重算市值 / 营收。
- 关系自动生长：扫描美股 / ADR 年报抽取关系，标记为待复核，不改写已有高置信度关系。

## 下载

本仓库目前没有已发布的 GitHub Release 安装包。请从源码运行。GitHub 自动生成的 Source code zip/tar 不算安装包。

## 界面截图

仓库里目前还没有已提交的真实产品界面截图（图标、logo 或品牌图不算）。请不要把下列预留路径当成已经存在的图片去引用（避免破链）。待在真实运行窗口中截取后放入：

- `docs/screenshots/01-workbench.png`
- `docs/screenshots/02-main-or-result.png`

截图说明必须写明操作系统、软件版本、是否示例/演示数据，以及是否在 Windows 安装后截取。

## 技术栈

- 网页：React 19 + Vite 8 + TypeScript（`industry-map`）
- 桌面：Electron（`desktop`）
- 可选 Python 数据脚本（`industry-map/data`）

## 从源码运行

源码在仓库根目录。本仓库不包含安装包。

网页版：

```bash
cd industry-map
npm install
npm run build
```
桌面版：将网页构建结果放到 `desktop/web` 后：

```bash
cd desktop
npm install
npx electron .          # 调试可用 IM_NOAUTO=1
```
本机数据目录（Windows）为 `%APPDATA%\全球产业链地图\industry-data\`。详见 `README-构建说明.md` 与 `使用说明.txt`。

## 文档

- [构建说明](README-构建说明.md)
- [使用说明](使用说明.txt)

## 贡献

欢迎通过 Issue 和 Pull Request 参与，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。参与时请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 许可证

本仓库尚未附带 LICENSE 文件，许可证未指定。

---

## English

# Industry Map

**3.3.0** · A global industry-chain map. Data version v3.3: 228 companies and 618 relations. The desktop app can update quotes and relations locally, and ships an offline baseline.

## Features

- A web app (React + Vite + TypeScript) and an Electron desktop app.
- Bundled v3.3 baseline data works offline; you can restore the built-in dataset.
- Local auto-update (daily by default): quotes, FX, SEC, GLEIF, Wikidata, macro and trade sources, then recalculated market cap / revenue.
- Relation growth: scan US-listed / ADR annual reports, mark new edges for review, and leave existing high-confidence relations untouched.

## Downloads

This repository has no published GitHub Release installer. Run it from source. The automatic Source code zip/tar from GitHub is not an installer.

## Screenshots

No real product-window screenshot has been committed yet (icons, logos, and brand art do not count). Do not add markdown image links to the reserved paths below until the files exist (that would be a broken link). After a live capture, place:

- `docs/screenshots/01-workbench.png`
- `docs/screenshots/02-main-or-result.png`

Captions must state the OS, version, whether the data is sample/demo, and whether the shot was taken after a Windows install.

## Tech stack

- 网页：React 19 + Vite 8 + TypeScript（`industry-map`）
- 桌面：Electron（`desktop`）
- 可选 Python 数据脚本（`industry-map/data`）

## Getting started

Source is at the repository root. This repository does not include installers.

Web app:

```bash
cd industry-map
npm install
npm run build
```
Desktop: copy the web build into `desktop/web`, then:

```bash
cd desktop
npm install
npx electron .          # IM_NOAUTO=1 for debug
```
On Windows, local data lives in `%APPDATA%\全球产业链地图\industry-data\`. See `README-构建说明.md` and `使用说明.txt`.

## Documentation

- [构建说明](README-构建说明.md)
- [使用说明](使用说明.txt)

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Please report vulnerabilities privately via [SECURITY.md](SECURITY.md). This project follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

No LICENSE file is included in this repository; the license is unspecified.
