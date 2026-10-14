# 追剧日历 Demo

当前汇报版本：v1.0.0。

腾讯视频追剧日历交互原型：详情页续播、选集高亮、固定视频与日历标题、手机日历与锁屏提醒联动、观看进度同步、追剧勋章收藏。

## 运行

无需安装依赖。在项目目录执行 `python3 -m http.server 4173 --directory dist`，访问 `http://localhost:4173/#calendar`。

## GitHub Pages 发布

在仓库 Settings → Pages → Build and deployment 中，将 Source 设为 **GitHub Actions**。

推送到 `main` 时，`.github/workflows/pages.yml` 自动验证脚本并发布 `dist` 文件夹。也可在 Actions → Deploy demo to GitHub Pages → Run workflow 手动发布。

首次部署成功后，以 Pages 设置页显示的网址为准。预计地址：`https://wangdakeke.github.io/aicalendar/`。

## 演示路径

1. 追剧日历 → 加入手机日历 → 右侧出现更新日程。
2. 继续看 → 回到剧集详情页，选集方块高亮第 9 集。
3. 手机外的「快进到本集结束」可以逐集演示；录屏自然结束也会完成当前集数。
4. 第 10、18、30 集节点解锁勋章，可在对应日期行或「我的追剧收藏」查看。
5. 右侧「模拟下一次更新提醒」→ 点击锁屏通知 → 返回详情页续播。
6. 「重新演示」清空本机模拟进度。普通刷新保留观看进度与收藏。

## 范围与素材

- 本项目是交互原型，观看、提醒、会员和奖励均为模拟，不连接腾讯账号或真实手机日历。
- 演示使用用户提供的参考录屏与视觉素材；不声明拥有相关影视、品牌素材版权。公开展示应确保具有相应使用权限。
- GitHub Pages 页面公开可访问，不应放入个人数据或内部机密。
- 此版本不包含剧情竞猜等后续玩法。
