# 米白版交互升级 · 2026-09-08

## 结果与范围

【已确认/页面事实】Song 确认的正式主流程是：自动提取照片中的所有主要物体；对漏提或错提对象画大致轮廓；由真实交互分割自动贴边，再预览确认。当前静态应用没有分割服务。本轮未调用模型、上传个人图片、安装依赖或部署。

原产品目录和地址不变：`/Users/song/Documents/拾页/shiye-editorial-prototype`，`http://127.0.0.1:4176/`。首页保持米白底、左文右书；index.html 和全部素材未改。只在原 app.js/styles.css 中扩展交互；三份正式需求/设计/技术文档和状态说明同步更新。

### 已实现

- 收藏 / 收藏并用于创作；保存成功后选择已有书或新建。从编辑器进入工坊则按 bookId/pageId 回到来源页；失败不跳转，重试不重复生成资产。仓库提供创作入口和单枚使用按钮。
- 从编辑器贴纸匣拖到纸页；手机点击添加或长按拖入，短滑动用于滚动素材列表。
- 柔光选中、四角等比缩放柄、上方旋转柄；保留按钮。双指缩放/旋转一次手势一次撤销；双击文字仍可编辑。
- 横排/竖排文字，真实 vertical-rl 排布而非旋转图片，刷新保留。
- 桌面内封＋第 1 页，第 2＋3 页……；纸张正反面使用不同页面内容，页角折叠、回弹与翻页。封面和封底可进入；手机竖屏单页。编辑仍聚焦单页，不跨书脊。
- 本地自由轮廓裁切与撤销选区：输出轮廓外透明 PNG；界面明确“不会自动贴边”。此项是裁切试用，不是正式 AI 提取功能。

## 验证证据

使用隔离 Chrome 152，通过 4176 的真实 HTTP 响应和磁盘 SHA-256 匹配确认目标；不使用 Song 的浏览器存储。截图人工查看；触控使用 Chrome CDP 输入，不是手机真机。

| 检查 | 结果 | 证据 |
|---|---|---|
| 米白首页身份 | 1/1 | [首页截图](fix-identity/cream-home-identity.png) |
| 原有功能回归 | 21/21 | [interaction-regression-02](interaction-regression-02/results.json) |
| 新交互主链路 | 8/8 | [interaction-features-02](interaction-features-02/results.json) |
| 最终布局与边界 | 7/7 | [interaction-edges-01](interaction-edges-01/results.json) |
| 数据合并单测 | 10/10 | `node verification/cream-20260908/merge-unit.cjs`，本轮执行通过 |
| JavaScript 语法 | 通过 | `node --check shiye-editorial-prototype/app.js` |
| 真实多主体分割 / 自动贴边 | 未实现、未验收 | 无真实服务端或分割提供方 |

前两组通过后，人工查看发现手机页边按钮受旧 top 定位与宽度计算影响，最终仅修正 fitReading 尺寸计算与 reader-stage 箭头位置。最后 7 项针对最终代码：320/390/700/1440 阅读布局、手机短滑动不误添加、收藏失败重试、窗口变化取消折页。没有把布局修改后的版本冒称又完整运行了一遍前两组；各结果保留自身代码哈希，最终基线见 [interaction-baseline.json](interaction-baseline.json)。

调试记录保留：第一次回归 20/21，新增指针捕获导致双击文字目标变成画布，已改为元素捕获；第一次新增测试 5/8，书页/双指两处为测试未等待异步保存切换，长按一处为真实浏览器滚动取消手势，已补短滑动滚动与长按拖入的区分。第二次均通过，不删除或掩盖首轮失败。

### 关键截图

- [竖排文字和操作柄](interaction-features-01/vertical-text-and-handles.png)
- [用户手帐第 2、3 页](interaction-features-02/real-book-spread.png)
- [翻页时纸张背面](interaction-features-02/real-book-corner-fold.png)
- [最终手机阅读布局](interaction-edges-01/reading-layout-390.png)
- [手机长按拖入结果](interaction-features-02/mobile-longpress-result.png)

## 恢复与边界

修改前节点：`archive/2026-09-08-before-interaction-upgrade.tar.gz`，包含原 app.js/styles.css/index.html、三份正式文档及 PROJECT。它不包含浏览器 IndexedDB 用户作品，不是作品备份；恢复前先保留当前版本，勿直接覆盖后续用户修改。

尚未验证：iPhone/iPad/Android 真机、Safari/Firefox、手写笔、极端图片分辨率、长文本溢出、数百页与大量资产性能、正式账号/同步/额度/后端。真实 AI 需要可用的多主体及交互分割能力与代表性照片评测，不能凭本地裁切通过第一关。

使用时先确认旧标签页显示“已保存到本机”，再刷新 4176 加载新代码；不要清除网站数据。没有更换端口或创建新的产品版本目录。
