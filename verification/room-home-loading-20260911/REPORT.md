# 首页场景版本与加载异常核验

## 已核实的事实

Song 澄清“日历改成书”是指清理日历事项文字，保留日历造型。

本轮实际打开 4191 参考页与 4176 当前产品，逐项核对：桌面房子换成可翻阅书本；日历事项文字清理；右侧立书复用拾页封面；原桌面说明纸移除。

- [4191 参考画面](reference-4191.png)
- [当前首页重试成功画面](retry-success.png)
- [源文件比较](source-comparison.json)：书体逻辑、书板几何、基础模型与 4191 相同；日夜日历图集可见 RGB 与 alpha 的不同像素数均为 0。

## 复现的问题与修复

【已确认】模拟书页素材失败后，修复前 `bookReady=null`、`bookError="The source image cannot be decoded."`，进入按钮仍可用，原始场景已经露出。原房子、旧立书封面和说明纸都依赖后续替换脚本成功完成；旧逻辑只等基础模型加载完成便开放进入。

【未知】没有用户当时浏览器的错误日志，因此不能把这次复现等同于用户当时的唯一原因。

修复仅涉及首页的 3 个文件：`room-home/index.html`、`preview-health.js`、`integration.css`。原场景在替换全部完成前保持隐藏；成功后才恢复原有有声/无声两个入口；失败时遮住旧场景、禁用进入并提供重新加载。已有登录和开始创作入口仍可使用。未改动 4191 源文件、模型外观、API 配置、用户账号或作品。

修复前文件备份：[恢复节点](../../archive/20260911-152704-before-room-loading-fix/README.md)。

## 验证结果

- 使用 Tabbit 实际浏览器和 4176 当前本机服务，未调用真实 AI 或提交用户作品。
- 素材失败时：`sceneReady=failed`、画布 `visibility=hidden`、两个进入按钮 disabled、重试按钮可见。
- 重试成功后：`bookReady=true`、`standingBookCover=shiye`、`explanationPaperRemoved=true`，两个进入按钮恢复；无声进入时 `bookMusic=false`。[失败页面](load-failed.png)
- 正常加载回归：有声进入成功，进入前 `sceneReady=true`，示例书可打开并翻页；测试完成已关闭音乐。
- 新脚本 `node --check` 通过，`git diff --check` 通过。
- 慢加载的独立网络阻塞模拟触发浏览器执行器超时，未计为通过；已按恢复协议检查保留标签，未发现真实页面或用户作品修改。失败重试与正常加载分别验证，不以模拟超时冒充成功。

此修复无需重启后端服务，重新加载 4176 首页即可使用新文件。
