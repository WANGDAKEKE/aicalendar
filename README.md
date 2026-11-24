# 追剧日历与桌面小组件原型

从单剧追剧日历出发，逐步探索多身份日历、成长电子票、运营 IP 皮肤与桌面续看小组件。这里保存交互代码、设计依据、历史方案和可编辑交付物，便于回顾设计过程或继续迭代。

这是产品评审原型。页面使用模拟身份、观看记录和排播数据，没有接入真实账号、媒资、支付、通知或原生桌面小组件。

## 推荐查看

| 入口 | 内容 |
| --- | --- |
| [尚公主 · 九图对照](https://wangdakeke.github.io/aicalendar/princess-calendar-refine-compare.html?v=calendar-label-v1) | 三排：全屏、半屏矮图、半屏高图；三列：SVIP、VIP、非 VIP |
| [斩神Ⅱ · 九图对照](https://wangdakeke.github.io/aicalendar/zhanshen-calendar-refine-compare.html?v=nav-v3) | 蓝紫 IP 皮肤、限免批次及回锁节点 |
| [日历与虚拟后台](https://wangdakeke.github.io/aicalendar/lab.html?v=2.9.2) | 模拟排播、观看记录、成长电子票、企鹅互动与组件回流 |
| [早期首页](https://wangdakeke.github.io/aicalendar/) | 早期日历交互；[双栏对照](https://wangdakeke.github.io/aicalendar/compare.html) |

两个九图页互设品类切换入口。本次归档保留原有页面路径，没有修改最新九图的排播、权益或日历交互。

### 历史方案

这些是过程稿，日期和文案反映当时讨论，不作为最新业务规则：

- [日历风格探索](https://wangdakeke.github.io/aicalendar/calendar-concepts.html?all=1)：清新、纸上长安和强 IP 氛围等方向。
- [全屏与播放页对照](https://wangdakeke.github.io/aicalendar/calendar-player-compare.html)、[品类对照](https://wangdakeke.github.io/aicalendar/calendar-category-compare.html)：三种展示比例的早期六图版本。
- [桌面小组件 v4](https://wangdakeke.github.io/aicalendar/widget-v4.html)、[组件图谱](https://wangdakeke.github.io/aicalendar/widget-atlas.html)。
- [组件展示规则](https://wangdakeke.github.io/aicalendar/widget-policy.html)、[文案策略](https://wangdakeke.github.io/aicalendar/widget-strategy.html)、[组件视觉探索](https://wangdakeke.github.io/aicalendar/widget-refresh.html)。

## 设计和实现的演进

| 时间 | 主要变化 |
| --- | --- |
| 2026-10-14～10-16 | 从详情页与选集入口探索日历；按身份展示排播，对齐会员与月份信息，加入成长徽章。 |
| 2026-10-20～10-21 | 固定日期、集号和运营氛围元素的位置；区分完整、部分和跳集观看；探索荔枝主题、成长电子票及下载。 |
| 2026-10-23 | 发布 lab v2.9.0～v2.9.2：虚拟后台、企鹅四状态、组件添加与回流、手机适配及运营配置。 |
| 2026-10 月底～11 月初 | 比较清新与强 IP 方向，参考设计网格调整方块比例；扩展小组件状态、尺寸、海报背景和文案策略。 |
| 2026-11-05 | 输出尚公主与斩神的早期六图离线 HTML，比较全屏、半屏矮图、半屏高图。 |
| 2026-11-06 | 两个品类扩展为九图；会员入口按模拟身份区分，使用白色半屏截图演示；斩神加入完整限免活动节点。 |
| 2026-11-09 | 尚公主调换会员说明与桌面组件入口位置，会员信息进入日历底部，桌面入口独立展示；斩神未同步此位置调整。 |
| 2026-11-17 | 选择器统一改为“SVIP日历 / VIP日历 / 非VIP日历”；另保留完结状态的图片设计稿。 |
| 2026-11-24 | 补齐可公开的历史代码、素材与交付物；整理 README、归档清单和完整项目 ZIP；移除个人信息原图与机器绑定，修复表情导出脚本的依赖路径。 |

更详细的原始笔记见 [项目过程记录](docs/project-history.md)、[版本记录](CHANGELOG.md) 和 [九图评审说明](CALENDAR-REVIEW.md)。历史笔记中“未发布”等说法只代表记录时点。

## 当前已实现和待完成的部分

已实现的原型包含身份日历预览、周/月切换、运营皮肤、模拟更新提醒、电子票成长、桌面组件预览，以及截图形式的会员开通页。最新九图版中，非 VIP 入口指向 VIP 开通示意，VIP 指向 SVIP，SVIP 不展示升级入口；点击不会真实购买或改变账号身份。

斩神当前三个身份共用同一份**限免活动日历**：10 月 29 日 2–3 集、11 月 5 日 4–6 集、11 月 12 日 7–9 集、11 月 19 日 10–12 集、11 月 26 日 13–15 集并标注全季免费、12 月 3 日第 2–15 集回锁会员。回锁不撤销已有会员权益。这是当前演示行为，后续讨论的身份差异尚未实现。

以下仍需继续设计或接入：

- 非会员默认查看会员日历的策略；当前仍按模拟身份默认选择，非会员排播未知处不编造数据。
- 限免只针对免费用户的展示策略，以及 VIP / SVIP 自身正常权益日历；尚未取得完整正常会员排播，不推算集号或上线钟点。
- 11 月 8 日完结后隐藏下一周箭头：目前只有 [图片设计稿](handoff/2026-11-24/design-only/princess-finale-20261117.png)，尚未写入 Demo。
- 最新九图版的单文件离线导出；现有导出脚本和离线 HTML 对应早期六图，不能当作最新九图交付。
- 真实登录、媒资与排播接口、观看历史、会员支付、通知及客户端原生组件。

## 在新电脑上打开

日历预览只需 Python 3，不需要安装前端依赖：

```sh
git clone https://github.com/WANGDAKEKE/aicalendar.git
cd aicalendar
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

打开 `http://127.0.0.1:4173/princess-calendar-refine-compare.html`。也可以将完整 ZIP 解压，进入 `aicalendar` 目录后运行同一条 Python 命令。含模块的页面建议通过本地 HTTP 打开；早期单文件离线 HTML 可直接打开。

测试使用 Node.js 22 或更新版本，本次在 Node.js 24.22.3 验证：

```sh
node --test tests/*.test.mjs
```

如需重新生成透明表情 PNG / ZIP，安装项目中固定版本的开发依赖后运行：

```sh
npm install
npm run export:eyes
npm run export:eyes:rich
```

历史文档和表格生成脚本中仍有外部工具运行时依赖；最终 DOCX、XLSX、PDF 已保留，不能保证只安装上述图像依赖就能重新生成所有办公文档。`npm run export:calendar` 仍对应早期六图。

## 文件怎么找

| 路径 | 保存内容 |
| --- | --- |
| `dist/` | Pages 发布的当前与历史页面、模块、样式及素材 |
| `design/` | 设计依据、素材来源、配色记录和使用约束 |
| `tests/`、`scripts/` | 自动化检查，以及图片和早期评审 HTML 的导出脚本 |
| `output/documents/` | 小组件 PRD、策略说明 DOCX |
| `output/widget-eyes*/`、`output/*.zip` | 透明表情、预览、导出清单和素材包 |
| `outputs/` | 文案与规则 XLSX、相关生成源文件、早期离线评审 HTML |
| `tmp/` | 历史制作过程：PDF、渲染图、生成脚本和数据；这里不全是可删除缓存 |
| `docs/` | 详细过程记录和预览图 |
| `handoff/2026-11-24/` | 补档前盘点快照、设计稿及原始收集脚本 |
| `archive/` | [收录与排除说明](archive/README.md)、逐文件来源映射、最终 SHA-256 清单及不再发布的旧文件 |

常用交付物：

- [小组件 PRD](output/documents/腾讯视频长视频续看小组件PRD_v0.1_20261102.docx)、[策略说明](output/documents/腾讯视频续看小组件策略说明_v0.1_20261102.docx)。
- [每日文案策略表](outputs/01a184f9-af95-7622-b2c4-748107966286/腾讯视频小组件每日文案策略_v0.2_20261102.xlsx)。另外两个规则 / 文案表见该目录的 `widget-spec-20261106/` 和 `widget-copy-tones-20261106/`。
- [表情扩展包](output/小眼睛表情扩展包_新增32款_20261106.zip)、[透明 PNG 包](output/小眼睛透明PNG_20261106.zip)。
- 2026-11-05 离线 HTML 位于 `outputs/calendar-review-20261105/`，属于历史六图方案。

## 归档范围和素材说明

已按授权补齐可公开的项目代码、运营参考素材、设计过程和交付物。排除了含个人昵称的原始会员截图、账号绑定配置、凭据、依赖目录、系统缓存和 Git 工作副本；保留的会员示意使用通用昵称“腾讯网友”。几组完全相同的表情目录及重复视频只存一份，映射记录在 [source-collection.json](archive/source-collection.json)。原始本地文件未被删除或搬走。

检查覆盖项目文本、Office 内容和归档条目，没有对所有图片或视频做逐像素、逐帧 OCR。如后续发现遗漏的个人信息，应先撤下相应素材再更新归档。

剧集、动漫、腾讯视频、Apple 及其他品牌素材仍受各自权利约束。素材来源和已有授权说明随项目保留；本仓库没有为这些素材授予通用商业许可，也没有新增全仓库 MIT 授权。生成的企鹅概念素材不是腾讯官方动作包。
