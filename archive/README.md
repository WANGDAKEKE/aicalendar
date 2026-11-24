# 2026-11-24 项目归档说明

本次以远端 main 的 `eda2092247b9e07705030e55e7197cb76a1544fa` 为基础，在独立干净副本中补档。原电脑的工作目录、未提交文件和旧 Git 历史均未重置、删除或搬走。代码及相关素材已确认可以个人留存和公开，个人信息除外。

## 两份清单

- `source-collection.json`：原目录逐文件的收录、路径调整、文本脱敏、重复映射与排除原因。它记录收集时的字节；后续 README、依赖修复等变化以最终清单为准。
- `publication-manifest.json`：最终受版本管理文件的字节数与 SHA-256；不列自身，以避免循环校验。可用 `node scripts/verify-publication-manifest.mjs` 验证。

项目 ZIP 从最终 Git 提交通过 `git archive` 生成，包含代码和已归档资料，不含 `.git`、登录状态或已安装依赖。ZIP 的提交号、大小和 SHA-256 写入压缩包旁边的校验文件，避免清单反过来改变被校验提交。

## 收录和路径变化

- 当前和历史 `dist/` 页面保留原路径，继续随现有 Pages 工作流发布；当前九图逻辑不变。
- 原先较长的 README 保存在 `docs/project-history.md`，根 README 改为项目入口、变更过程及运行说明。
- 根目录预览图移到 `docs/previews/`，Swift 预览工具移到 `tools/`。
- 已废弃的 `dist/app.js`、`dist/assets/drama-mock.mp4` 保存在 `archive/legacy/`，不进入 Pages 发布目录。
- DOCX、XLSX、PDF、生成源文件、文案数据、截图 ZIP 及设计稿保留；`tmp/` 中的有效交付物也已收录。
- 两个表情导出脚本改为项目依赖 `sharp` / `jszip`，不再使用原电脑的固定缓存路径。最终交付素材仍保留。
- 历史交接文件标注为补档前快照，避免将其“当时未上传”误认为当前状态；发布机器临时路径和账号绑定字段已移除。

## 排除和去重

| 原路径或类别 | 处理 |
| --- | --- |
| `dist/assets/princess/membership-vip-reference.jpg` | 个人昵称原图，不进入 GitHub 或 ZIP；通用昵称示意保留 |
| `.git/`、`.openai/`、凭据及账户配置 | 不收录；新电脑重新克隆 / 登录 |
| `node_modules` 及其软链接、系统文件和字体缓存 | 不收录，不沿软链接遍历其他文件夹 |
| `output/widget-eyes-20261106 2/`、`… 3/` | 与 `output/widget-eyes-20261106/` 逐文件相同，映射到该目录 |
| `output/小眼睛表情扩展包/` | 与 `output/widget-eyes-rich-20261106/` 相同，映射到该目录 |
| 根目录 `参考视频.mp4` | 与 `dist/assets/drama-recording.mp4` SHA-256 一致，只保存后者 |

去重前逐文件核对字节，不对有实际差异的历史交付版本合并。来源映射中的排除目录只记录目录名，不展开凭据或账号信息。

## 没有顺手实现的产品需求

非会员默认会员日历、动漫限免与会员权益分流、完结后隐藏下一周箭头，以及最新九图的离线单文件导出仍未实现。图片设计稿与当前 Demo 的差异已写在根 README，归档不代表这些需求完成。

最终校验结果见 `verification.json`。GitHub Actions 和本地测试验证原型代码，不能证明真实业务接口或客户端支付、通知已接通。
