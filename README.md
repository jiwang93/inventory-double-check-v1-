# RUNERGY · Daily Inbound Verification

润阳 · 每日入库核验

一个在浏览器本地完成库存对账的网页版看板。导入系统库存和每日现场扫描文件后，按 `SKU + 库位` 聚合，自动识别盘盈、盘亏、未扫描和系统缺失，并导出 Excel 纠正清单。

## 支持的文件

- `.xlsx`、`.xls`、`.csv`
- SKU 列可命名为：`SKU`、`商品编码`、`物料编码`、`货号`、`条码`
- 名称列可命名为：`商品名称`、`物料名称`、`品名`、`name`
- 库位列可命名为：`库位`、`仓位`、`货位`、`location`
- 数量列可命名为：`数量`、`库存数量`、`实盘数量`、`盘点数量`、`qty`

数据只在用户浏览器内解析，不上传到服务器。

## 本地运行

```bash
pnpm install
pnpm dev
```

## 部署到 Vercel

把仓库导入 Vercel，Framework Preset 选 `Next.js`，保持默认构建设置即可。若 Vercel 对 vinext 兼容层有特殊要求，也可以把同一仓库作为静态/Cloudflare Worker 项目发布；当前正式版本由 OpenAI Sites 托管。
