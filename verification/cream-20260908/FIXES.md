# 米白版四项修复与回归

日期：2026-09-08。Song 已授权修复；本轮在原目录实施，不另建产品，不改变米白 UI。

## 结果

【已确认/实测事实】4 项原问题已修复。本轮浏览器回归 **21 项全部通过**，包含原来 19 项及两个新增并发／异步用例；另外 **10 项数据合并纯函数测试通过**。前者是直接访问 4176 的实际交互／IndexedDB 读回，后者是独立逻辑测试，二者不混为同一通过率。

- [最终浏览器结果](./fix-run-02/results.json)：21 通过、0 失败，未捕获 pageerror 或 HTTP 错误。
- [首次修复回归](./fix-run-01/results.json)：同为 21 通过；最终轮加强了 SAVE-03，等待保存事务明确失败后才判断是否仍在编辑态，避免中间状态误判。
- [修复后首页截图](./fix-identity/cream-home-identity.png)：已人工核对，仍是米白左文右书。HTML、CSS 与原米白 checkpoint 一致。
- [修复前报告](./REPORT.md)及 `run-02` 保留为历史证据，不覆盖成“通过”。

## 改了什么

| 问题 | 修复 | 回归证据 |
|---|---|---|
| 多标签覆盖已保存书本 | 在同一 IndexedDB readwrite 事务里读取最新 workspace，以最后成功读取／提交的数据作比较基线，仅合并本页改变的书本和素材记录；同书冲突保留远端原书并另存本页冲突副本 | DATA-01：两个新建书都在；DATA-02：同书两段不同文字均保留，当前页面指向副本，再归架不重复生成副本 |
| 迟到照片替换当前页面 | 请求代次、导航代次和当前工坊状态三重检查；解码、示例照片请求及生成完成后均丢弃过期结果 | ASYNC-01：离开后旧结果不回填；ASYNC-02：改选演示素材后，旧照片不能抢占 |
| 保存失败仍进入翻阅 | 切翻阅等待提交，确认成功、当前书及当前视图仍匹配后才切换；失败保留工具和内容 | SAVE-03 等待明确失败后仍为编辑态；原有失败归架／解除故障后重试继续通过 |
| 双击文字无弹窗 | 单击选择仅更新选框与工具栏，不再重建整个 canvas；拖动完成仍保存和重绘 | TEXT-01 双击打开弹窗；文字工具栏、拖动、撤销及移动端触控回归通过 |

核心代码：[事务合并](/Users/song/Documents/拾页/shiye-editorial-prototype/app.js:41)、[保存期间的增量保留](/Users/song/Documents/拾页/shiye-editorial-prototype/app.js:65)、[保存提交](/Users/song/Documents/拾页/shiye-editorial-prototype/app.js:94)、[稳定选择／双击](/Users/song/Documents/拾页/shiye-editorial-prototype/app.js:160)、[切换翻阅](/Users/song/Documents/拾页/shiye-editorial-prototype/app.js:348)、[照片时效检查](/Users/song/Documents/拾页/shiye-editorial-prototype/app.js:380)。

初始化也改为原子“读取，若确实不存在才创建”，并记录成功读取的比较基线。读取失败不会将示例数据当作已有作品覆盖写回。旧 workspace 不要求已有 revision 字段，无 schema 升级或清库。

### 数据合并的保护范围

- 不同书本的变化可合并；同一本书采用整本冲突副本，不做逐字段或逐页自动合并。
- 保存期间继续编辑的内容留在内存等待下一次提交，不被较早快照替换；如果与新读到的书本冲突，也保留副本。
- 旧删除请求碰到远端已修改记录、同一素材存在无法合并的冲突时拒绝覆盖并提示失败；本轮没有增加完整的冲突处理管理界面。
- 纯函数测试覆盖旧数据、不同书本新增、同书冲突、旧删除遇到远端修改、远端删除遇到旧编辑、素材冲突、保存中的新编辑、重试不重复副本，共 10 项。脚本：[merge-unit.cjs](./merge-unit.cjs)。

## 改动与恢复边界

- 产品运行文件仅修改 `shiye-editorial-prototype/app.js`，SHA-256 为 `3f3cc6dfd77e3ab7731f17cde149814d66ab56b60e346362e65c126d1e4b140e`。
- HTML、CSS、四张共用素材、三份正式产品文档哈希均与修复前一致。
- 更新验证脚本、修复基线、证据和状态文档；没有安装依赖、调用 AI、部署或修改当前浏览器作品。
- [修复前恢复节点](/Users/song/Documents/拾页/archive/2026-09-08-before-four-fixes.tar.gz)保留代码、当时测试脚本和状态文档；它不是浏览器作品备份。不要直接回退后继续多标签写入旧代码。

## 使用与剩余边界

在确认没有未保存内容后刷新 4176，加载修复版。其他已打开的拾页标签页也需要加载新版；**仍运行旧 JS 的标签页不具备新的保护逻辑**，不要让旧、新版本同时写入。若旧页仍有未保存内容，先保留内容，不要直接刷新或清理站点数据。此次没有擅自刷新 Song 的标签页。

已查看修复后首页、冲突副本、文字弹窗、失败保留编辑及迟到响应后的书架截图。测试仍是隔离 Chrome、桌面和 390/320px 触控模拟；不是实际手机／Safari 验收。

本次消除的是已复现的 4 个问题，不代表完整数据层或产品验收。仍为本机单 workspace 原型，未接入真实抠图、文案、排版、账号权限、正式 Blob 分区、云同步、生产数据库或短信。高负载、长期容量、真实设备等仍待验证，**正式技术第一关依然不能标记全部通过**。

复跑（在项目根目录，label 必须唯一）：

```sh
node verification/cream-20260908/verify.cjs --four-fixes --baseline --label=fix-identity-new
node verification/cream-20260908/verify.cjs --four-fixes --label=fix-run-new
node verification/cream-20260908/merge-unit.cjs
```

先人工核对首页截图。`--four-fixes` 使用固定 [four-fixes-baseline.json](./four-fixes-baseline.json) 核验三份运行代码哈希，不是跳过版本校验。默认不带该参数仍检查修复前 checkpoint，适用于历史复现而不是现行代码。
