# 全球产业链地图

交互式产业链 / 供应链可视化（半导体、新能源车、光伏、消费电子、**储能**、**医药**）。

## 快速开始（便携包）
- Windows：双击 `portable/启动-Windows.bat`
- macOS：`portable/启动-macOS.command`
- Linux：`portable/start-linux.sh`
- 或：`npm install && npm run build && npx serve dist -l 4173`

## 数据刷新
```bash
python3 data/refresh.py          # 拉取公开 API
python3 data/verify.py           # 交叉验证分级
python3 data/evolve.py --snapshot-only --version vX.Y   # 写 changelog/版本快照
python3 data/audit.py --round vX.Y --n 200              # 抽检 + Wilson CI
```
完整编排：`python3 data/evolve.py --version vX.Y`

## 准确率口径（诚实）
- **已验证子集**（状态栏）：字段 A/B 抽检 + 关系 grade∈{A,B}；仅当 Wilson 95% CI **下界 ≥ 98%** 才宣称达标。
- 含 C 级二手关系的全量口径单独展示，不用于 98% 宣称。
- 从不编造数字；缺失显示「缺失」。

## 版本
见应用内「数据源 → Changelog / 数据版本」，或 `public/data/changelog.json`。

## 截图
`screenshots/vNN-*.png`
