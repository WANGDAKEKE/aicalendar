# 通用桌面小组件基础框架

新版本地界面稿：`http://127.0.0.1:4173/widget-v4.html`。旧版 `widget.html` 和 `widget-v3.html` 保留。独立于单剧日历，基于跨剧观看历史生成续看目标。不安装系统小组件，未接真实账号或播放器，未发布线上。

## 状态方案墙（本地讨论稿）

- `widget-atlas.html`：左侧仅一部固定手机，右侧两组各5种状态×4种方案，共40张。浅色纯色、浅色轻渐变、深色纯色、深色轻渐变按行完整铺开，同列保持文案一致；点选或键盘Enter/空格选择后同步手机与唯一选中态。小窗口保留紧凑左右布局，≤560px改上下，不覆盖 `widget-v4.html`。
- A组：普通续看、晚间等待、久未观看、回来之后、已经追平。每张显示虚构剧名以及当前集播放位置，追平明确为24/24集已看完；不把最高集号当作看完数。
- B组：默认按累计有效观看自然日探索，示意1/7/30/100/365天；不要求连续，不因间断清零。这是待确认的数据口径，不代表已接入腾讯账号或研发已支持。`metric=minutes` / `metric=away` 保留两种本地备选。
- 点选只改变内存中的预览方案，无观看回写、自动计时、真实用户数据、奖励承诺或时长任务；两组共享同一渲染器与配色模型。使用项目小组件Figma取色色卡的真实值，不称作最终腾讯品牌标准；浅深外观不代表情绪或催促强度。
- 原始提取见 `widget-figma-color-card.csv` 与 `widget-figma-color-card-source.json`，132色填充/图层透明度均为100%。`widget-figma-colors.mjs`静态保存本次五列原值：ready=H80、evening=H20、waiting=H260、returned=H160、resting=H200，单测逐值对照CSV，不能按色相公式重建原表。
- `widget-atlas-palettes.mjs`将情绪色与appearance/finish分开：浅色纯色取C1，主字C5、次字C3；浅色轻渐变从C1到80%C1+20%C2的sRGB通道四舍五入混合值；深色纯色取C4，深色轻渐变C4→C3，主次字均C1；渐变160°。这些角色分配和渐变方式均为本次提案，不是原Figma已定义的规则。四方案共20套颜色，两个端点及9个中间采样点的主次文字对比度均≥4.5:1。
- 每张色卡标注背景HEX及色卡位置；左侧显示背景、主字、次字HEX与来源。浅色渐变终点明确标为延展，纯色无background-image，不使用伪造的30%/50%源色alpha。眼睛使用Grey/C1与Grey/C5中性色，细描边/阴影为视觉辅助；半眯眼不使用实色遮罩，以免破坏渐变。
- 初始组件与手机桌面外观跟随 `prefers-color-scheme`；`appearance=light|dark`可显式指定，手动选卡后按所选外观比较。手机背景、状态栏、App标签、搜索、Dock及底部指示条同步变更。设备图为原授权素材、App图标仍为本地SVG示意，不是Apple官方UI Kit，也不代表已经接入原生WidgetKit或系统着色模式。

## 0.4 彩色情绪组件精修

用户明确认可 0.2 的表情和配色，要求优化圆角、字体、留白及桌面背景，而不是删除趣味元素。0.3 黑白稿不是本次认可方向。

- 保留紫色久未观看、桃色晚间等待、绿色回归欢迎以及对应眼神；统一 20px 卡片圆角、16px 内边距、26/31px 主句和 12px 续看信息。情绪状态变化不挤占文案。
- 展示页只保留完整手机界面与静态状态标题，无外围状态按钮、设计说明、风格面板或营销标题。三种状态并排，第一行横版、第二行方形；小屏纵向排列；`view=single` 可只显示一屏，追加 `size=square` 切换为方形。更多异常情境仍可由 `scene` 参数输入，不新增面板。
- 横版保持 345×170 CSS px，新增方形 170×170 CSS px，均为手机界面缩放前尺寸。方形沿用同一套配色、眼神、文案和数据，只压缩字号、调整眼睛位置、精简底部信息；完整播放位置保留在无障碍描述与续看层。页面的“1:1”指宽高比，不等于 iOS 桌面占格；正式尺寸需依客户端既有小组件框架适配。方形右侧排布四个系统 App 图标，原横版排布不变。
- 主屏幕为纯浅暖灰，系统图标沿用 0.2 的同一套本地 SVG 示意；不含摄影壁纸。仍使用原始 Apple 官方设备外框，不能将示意主屏幕称为 Apple 官方 UI Kit。官方硬件图片不裁剪、不另加阴影。
- 续看层在手机内呈现，仍只有明确点击“模拟观看 5 分钟”才回写演示历史；单击组件只打开续看预览。同一场景的横版与方形共享数据并同步更新，三个场景的内存数据独立，任何操作不修改已上线日历或真实账号。
- 新增 `widget-v4.*`、`companion-view-v4.mjs`、`companion-v4.css`、`ios-home-v4.*`；复用原有 model/copy。旧 `ios-home.mjs` 只增加图标 helper 导出，原视图不变。
- 当前只调整小组件界面；所提供日历参考作为后续日历的视觉方向，未擅自改动日历功能和线上版本。

## 0.3 原生组件设计提案

- 字体与布局：两行主文案 26/33px、字重 600；底部一行 13/18px 剧名和集号；组件内边距 16px。去掉内部品牌、状态标签、眼睛、重复进度说明。文案趣味保留，不按情绪更换整套背景色。
- 外观：统一浅色/深色，单一绿色仅作提案强调色，不宣称是腾讯视频品牌标准值。操作区域仍只有整块组件一个回流入口，无目标时播放图标切换为进入箭头。
- 官方设备外框：`dist/assets/apple/iphone-16-black-portrait.png`，Apple 官方原图 1359×2736，未裁剪、重绘或另加设备阴影。以 453×912 展示，屏幕开口 left/top=30px、393×852；灵动岛已在原始图片中，不另绘制。
- 官方模板使用许可由用户明确确认后接入，本地保留 `design/apple-template-license.txt` 和 `dist/assets/apple/App-Store-Marketing-Artwork-License-Agreement.rtf`；来源与校验值见 `dist/assets/apple/SOURCE.txt`。设备素材包不含主屏幕或系统 App 图标；屏幕是 HTML 原型，不应称为 Apple 官方 UI Kit。
- 主屏幕仅保留本产品组件和腾讯视频入口图示，不再手绘一套系统 App。腾讯视频图标来自官网公开的 apple-touch-icon，原图及来源见 `dist/assets/tencent/`。
- `widget-v3.*` 负责独立本地预览；`companion-view-v3.mjs` / `companion-v3.css` 负责纯展示；`ios-preview-v3.mjs` 负责官方外框与屏幕定位。与旧版样式和播放/用户数据隔离。
- 参照 [Apple Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets)、[Apple Design Resources](https://developer.apple.com/design/resources/)、[TDesign 字体](https://tdesign.tencent.com/design/fonts)和[色彩规范](https://tdesign.tencent.com/design/color)。TDesign 通用设计体系不等于腾讯视频品牌规范，不直接照搬其中后台布局。

## 调研依据

- [多邻国官方组件介绍](https://blog.duolingo.com/widget-feature/)：突出当天是否学习及连续学习状态；未完成时表情随时段递进，完成后切换为轻松、开心的状态；点击组件引导回到学习。
- [Duolingo 设计师的组件方案](https://dribbble.com/shots/17312669-Duolingo-Streak-Widget)：以同一角色的情绪变化表达当天行为，强调完成前后的反差。
- [Apple 主屏幕与组件指南](https://support.apple.com/en-mide/guide/iphone/iph385473442/ios)：预览按 iOS 主屏幕结构重建，采用灵动岛状态栏、四列 App、中号组件与磨砂 Dock；系统图标为本地 SVG 示意，壁纸为生成素材，不是下载的官方 UI 资产。

追剧场景的设计判断：用观看记录与时段驱动轻提醒、晚间催促、久未观看、回归欢迎四种语气。主文案吸引注意，剧名、集号和播放位置说明点击收益。先验证大字版的回访作用，角色素材留待品牌及设计确认。

## 数据与交互

- `companion-model.mjs`：纯函数选择最近可续看的剧；跨剧排序，按北京时间自然日计算多久没看、今天是否看过。已完结末集不推荐重看，不可播内容过滤或回退。
- `companion-copy.mjs`：独立文案池；轻柔和有点欠两种语气，同一状态可切台词。文案切换不会产生观看记录。
- `widget.mjs`：页面编排与内存演示状态；点击打开回流预览，只有明确点击“模拟观看 5 分钟”才增加演示播放进度。
- `widget.html` / `widget.css`：独立预览页面及响应式样式；大字主文案、状态说明、续看内容和统一点击入口。适配减少动态效果及键盘交互。
- `ios-home.mjs` / `ios-home.css`：独立 iOS 主屏幕示意模板，与组件数据逻辑分离。组件使用状态色和眼神表达情绪，不预设待确认的角色 IP。

场景：白天等你、今晚还没看、三天没来、今天回来了、已经追平、暂无历史、尚未登录、内容不可播。首次默认晚间场景；可通过 `?scene=away&tone=cheeky` 分享本机演示状态。

## 后续接入点

客户端提供当前账号身份、跨剧观看历史、各内容对当前账号的可播集数及继续播放入口。排期、付费权限以客户端传入的真实可播结果为准。系统刷新频率和回流协议由现有小组件框架接入时确定。

原型不引入连续观看打卡、不发电子票、不使用倒计时或虚构更新，以免把学习的每日任务直接套在追剧上。

## 预览壁纸素材

- 项目素材：`dist/assets/widget-misty-lake-v1.jpg`，内置图像生成工具制作，JPEG 压缩后用于本地 iOS 桌面预览。只调整壁纸和系统磨砂底色，不改变组件交互。
- 生成描述：

> Use case: photorealistic-natural. Asset type: portrait iPhone home-screen wallpaper only, no device or UI. Create an exceptionally refined, serene fine-art landscape photograph of misty mountain ridges at dawn, viewed across a perfectly still alpine lake, subtle luminous peach sunrise fading into dusty lavender-grey sky, distant soft blue-slate mountains, very gentle pale blush reflected in the lake, minimal Zen-like composition, authentic atmospheric photography and natural detail, not an illustration or digital gradient. Tall portrait 9:19.5 composition. The top 45% should be smooth uncluttered dusk-blue/lavender sky, medium tonal values so white status labels read and a colored app widget at upper top remains distinct. Layered silhouettes of mountain ridges around the middle to lower third, a calm reflection in the bottom. Elegant soft natural light, restrained contrast, sophisticated muted cinematic tones. No harsh orange, no neon, no strong bright sun disc, no foreground objects, no trees near camera, no city. No text, no logos, no watermark, no phone frame, no icons, no interface. Deliver only the wallpaper image.
