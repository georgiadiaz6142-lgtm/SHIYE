# 拾页 · 编辑出版风格交互原型

最初基于《拾页-产品设计文档》V1.3 的界面方向制作。2026-09-08 按 Song 截图恢复米白首页：左侧品牌、宣传语和创作／观看演示按钮，右侧绿皮书和漂浮照片贴纸；不是木桌背景版。当前产品规则以 PRD / 产品设计文档 V1.5 为准，不代表本原型已完整实现。入口为本目录的 `index.html`，地址为 4176；旧实验在 `../archive/2026-09-07-experiments/`。

最新交互升级：原目录内增加收藏直达创作和原页回流、贴纸拖入、柔光与缩放旋转手柄、双指操作、横竖文字，以及真实手帐的双页/正反面翻阅。恢复节点为 `../archive/2026-09-08-before-interaction-upgrade.tar.gz`（代码、三份正式文档及 PROJECT，不含浏览器作品）。验证与已知边界见 [INTERACTIONS.md](../verification/cream-20260908/INTERACTIONS.md)。

## 运行

2026-09-08 最新交互：上传照片默认“小剪刀”，支持按住圈选自动预览，或分段点击后“剪下来”；附局部放大镜。首页、手帐翻阅和编辑前后页改为侧边整页弯曲翻页，替代下文历史页角描述。当前没有按图片内容自动收边能力。最新验证见 [SCISSORS-SIDEFLIP.md](../verification/cream-20260908/SCISSORS-SIDEFLIP.md)。

在此目录运行：

```sh
python3 -m http.server 4176 --bind 127.0.0.1
```

浏览器访问 `http://127.0.0.1:4176`。无需安装依赖，页面、插画和照片均从本机加载。建议使用 HTTP 预览，以便稳定使用浏览器存储。

## 可以体验

- 首页：首开显示品牌与宣传语、合上的演示书和漂浮照片贴纸；“开始创作贴纸”直达工坊，“从一本空白手帐开始”复用现有创建弹窗。
- 首页演示：点击“观看演示”或书封打开双页手帐；6 页内容、角部拖动折页、前后翻页、重新观看、合书。仅为独立演示，不写入书架和个人素材。
- 书架：查看示例书、按时间或名称排序、封面/列表切换、新建、重命名、确认删除。
- 手帐：桌面双页翻阅、手机竖屏单页阅读，页角折页含独立正反面、内封、封面和封底；编辑聚焦单页，支持创建/复制/删除页面、拖动缩略图排序。
- 编辑：添加贴纸和文字，拖动、缩放、旋转、复制、翻转、前后层级、删除，切换四种纸张。
- 文字：双击修改、横排/竖排切换，三种字体风格。
- 撤销/重做：当前编辑会话内的页面内容操作，最多 30 步。
- 收藏：内置原创插画收藏、按分类筛选、名称搜索、重命名、移出收藏、将贴纸加入指定手帐。移出收藏保留已被页面引用的素材。
- 工坊：演示素材多选、独立贴纸预览、命名、白边调节、批量收藏。
- 自有照片：本机读取、框选或自由轮廓裁切、透明 PNG 预览、收入收藏；不是自动识别或自动贴边。
- 保存：浏览器 IndexedDB 自动保存，重新加载后恢复书本、页面与贴纸。
- 桌面与移动端响应式布局；移动端采用底部导航和工具抽屉。

## 体验边界

- 这是交互设计原型，不是正式全栈应用。账号、邀请码、会员、AI 文案/排版、云同步和后台未接入。
- 三本初始手帐明确标为示例，可自由编辑；个人贴纸收藏初始为空。
- 演示多主体采用预制透明 SVG 插画，不调用真实图像分割服务。
- 上传的 JPG、PNG、WebP 支持最大 10 MB，会在本机缩放至最长边 1400 像素。手动框选输出矩形裁切，保留区域背景，不冒充透明 AI 抠图。
- 白边使用浏览器视觉滤镜预览，保留参数，不生成正式可下载贴纸文件。
- 数据仅保存在当前浏览器、当前站点地址下；清理网站数据、切换浏览器或端口不能自动找回。保存失败会保留内存并阻止归架。
- 按已确认首发范围，不增加自动分类、自定义贴纸包、手帐绘画和用户作品导出；内置演示分类不是自动分类。正式流程是自动提取所有主要物体，再对漏提/错提对象手绘大致轮廓，由 AI 贴合真实边缘；当前无真实分割服务，此项仍未实现。用户作品双页翻阅已实现，与首页演示书保持独立。

## 快捷操作

- 首页演示打开后：左右方向键翻页，Escape 合书；右下角向左拖动翻到下一组，左下角向右拖动返回。拖动不足距离会回弹；系统“减少动态效果”开启时跳过动画。
- 单击选择元素，拖动移动；选中后工具栏支持缩放和旋转。
- 双击文字修改内容。
- Delete / Backspace 删除选中元素；方向键微移，Shift + 方向键加大移动幅度。
- Cmd/Ctrl + Z 撤销，Cmd/Ctrl + Shift + Z 重做。
- Escape 取消选择或关闭工具面板。

## 文件与素材

- `index.html`：应用入口。
- `styles.css`：响应式视觉系统与动效。
- `app.js`：交互、页面数据、原创 SVG 插画与 IndexedDB 保存。
- `assets/lake.jpg`、`forest.jpg`、`coffee.jpg`：实际使用的三张示例照片。历史来源记录为 Unsplash 图片服务，原图标识分别为 [山湖](https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1)、[森林](https://images.unsplash.com/photo-1441974231531-c6227db76b6e)、[咖啡](https://images.unsplash.com/photo-1495474472287-4d71bcdd2085)。本轮未重新核验授权，正式发布前仍需核对。
- `assets/home-landscape-sticker.png`：米白首页及演示书实际使用的透明风景贴纸，共用原始素材，保留。
- `checkpoint-before-home-20260907.tar.gz`：首页改版前代码、说明及三张照片；`checkpoint-before-desk-20260907.tar.gz`：桌面背景改版前的三份代码文件，不含素材，不能单独视为完整备份。两者均不是浏览器作品备份。

## 目录恢复与整理 · 2026-09-07

当前更正（2026-09-08）：此前仅以目录、标题和 4176 响应确认“新版”不充分，误测了木桌背景版。已按截图恢复米白版的 `index.html`、`app.js`、`styles.css`，三文件与 `checkpoint-before-desk-20260907.tar.gz` 逐字节一致；缺失咖啡照片从 `checkpoint-before-home-20260907.tar.gz` 补回。两张木桌背景图在本轮开始时已不存在；剩余来源 JSON、轻量 WebP 副本及 `verification/2026-09-08/` 误测文件已清理。清理前相关文件逐字节核验并保存在 `../archive/2026-09-08-before-cream-restore.tar.gz`。不恢复木桌背景，不更改浏览器作品。下文为历史记录，不能代替当前米白版重新验收。

本目录曾暂时缺失，导致 4176 新请求返回 404；随后重新出现，首页、脚本和样式已恢复 200，并与本地文件逐字节一致。旧根目录实验与 UI 验证目录已归档；此次只更新本说明，没有改变当前原型代码、素材、checkpoint 或浏览器数据。

下面的交互验收条目是原有历史记录，不是本次归档重新执行的验收。本次只核对文件完整性及 HTTP 来源，新版完整技术验证仍待执行。

## 原编辑器验证记录（首页改版前）

2026-09-07，以本地 HTTP 服务在 Tabbit 浏览器中完成实际操作验证：

- 新建手帐、插入贴纸、复制、撤销、重做、添加文字、缩放与旋转。
- 指针拖动前后坐标发生变化；更换纸张保留页面内容。
- 新增页面后切换回原页；归架和刷新后恢复 2 页及原页的 3 个元素。
- 演示素材勾选 3 个主体、分别生成预览、修改名称并批量收藏。
- 本地示例照片经同一照片处理入口，完成拖动框选、真实裁切、预览、命名与收藏。
- 移出收藏后，已引用该自制贴纸的手帐仍正常显示图片。
- 手机尺寸下的工具抽屉、页面前移/后移正常；320px 和 390px 宽度没有横向溢出；桌面 1440px 和手机 390×844 已查看实际截图。
- 已删除本轮创建的临时验收手帐，并将验收贴纸移出收藏，保留三本初始示例书供体验。

自动化浏览器不允许设置系统文件选择器的文件路径，因此未自动验证“从系统文件选择器选择个人文件”这一步；已通过本机示例照片验证其后的同一图片解码、框选、裁切和存储逻辑。未验证真实手机硬件、真实 AI、账号安全或云端数据链路。

## 首页改版节点 · 2026-09-07

本轮在原目录修改 `app.js`、`styles.css` 和本说明，新增一枚首页风景素材；没有另建原型项目，没有修改 PRD、正式设计文档、工坊逻辑、编辑器内容或 IndexedDB 数据结构。

修改前恢复节点：`checkpoint-before-home-20260907.tar.gz`。包含改版前的 `index.html`、`styles.css`、`app.js`、`README.md` 及三张原始照片。不包含浏览器 IndexedDB 中的用户作品，不能替代作品备份。恢复时应先保留当前版本，再提取需要恢复的文件；本轮未执行恢复或覆盖用户作品。

恢复节点 SHA-256：`032ef6d535e81c123d317a8959c1eb53215523a5c1e36cb3c3d8db8fc9b4ca6c`。

### 本轮实际验证

- JavaScript 语法检查通过；14 组双向折页几何检查通过（剪裁面积守恒、角点反射位置正确）。
- 在内置浏览器检查 1440×900、390×844、320×740；检查范围内没有横向溢出。修正桌面翻页控件与书本下沿重叠、森林页面文字靠近页脚，以及 320px 标题孤字换行。
- 首开为合书首页，点击演示展开左右页；下一组、上一组、末页禁用、重新观看及合书均实际操作通过。
- 在手机尺寸下实际从右下角向左拖动，页码从 01—02 变为 03—04；左右方向键与 Escape 合书入口已实际检查。
- 创作贴纸直接到现有工坊；首页创建手帐弹窗可打开及取消；桌面工作区品牌入口可返回首页。
- 检查时书架仍为原有 3 本示例、我的创作 0 本；演示未向书架增加作品。没有新建或删除验收手帐，没有更改既有作品。
- 首页图片加载正常，浏览器检查未观察到控制台错误。未测试真实手机硬件或 Safari；翻页是前端折页模拟，不是纸张物理仿真。
- 历史记录曾提及 `preview-desktop.png`、`preview-mobile-editor.png`；本次整理时当前目录未见这两份文件，不能作为现存验收证据。它们也不代表新首页。

### 首页贴纸素材

原始素材：`assets/home-landscape-sticker.png`，也是恢复后当前页面实际使用的素材。历史制作记录为 1535×1024、RGBA，alpha 范围 0—255、四角透明、362196 个完全透明像素；本次未重新执行像素质量验收。素材只用于首页演示，不代表贴纸工坊已接入 AI 分割。

制作方式：内置 imagegen 基于原有 `assets/lake.jpg` 制作摄影风景白边贴纸。两次生成都出现烘焙棋盘格、无 alpha 的问题；Song 随后明确同意本地处理，最终用本地 Pillow/NumPy 提取照片连通主体、填补内部孔洞、重建白色轮廓和透明通道。原照片、两次生成源图均保留，未上传其他个人图片。生成结果经过模型处理，不是逐像素保真的原照片分割。

生成提示词：

> Use case: background-extraction. Asset type: ONE photographic landscape die-cut sticker for a literary website homepage and interactive book demo. Input image 1 is the edit target, an actual lake-and-mountain photo viewed from a wooden boat. Primary request: extract this photographed landscape into a single irregular die-cut sticker on a genuinely transparent background with real alpha. Remove all sky and background beyond the natural mountain+forest+lake+boat silhouette. Keep the original distinctive grey rocky mountains, green conifer forests, turquoise lake, and warm brown foreground boat, preserving their photographic textures, perspective, and natural colors. Give the lower and side edges a gently irregular cut-paper contour so this is not a rectangular photograph. Add a clean narrow white die-cut contour around the entire isolated photographic silhouette. Composition: one unified landscape sticker, fully visible and centered with a small transparent margin on every side. Absolutely no text, letters, watermark, decorative objects, vector shapes, cartoon style, illustration, artificial painted texture, opaque backdrop, checkerboard pixels, or drop-shadow background. Preserve realistic photographic detail inside the silhouette. Output must be PNG with genuine transparency outside the white sticker contour.

定向纠正提示：仅删除白色贴纸轮廓外的全部棋盘格像素，使其 alpha=0；输出真实 RGBA PNG；保持摄影内容、白边、构图、轮廓不变，不得用棋盘格或实色模拟透明。该纠正仍未产生 alpha，因此采用上述已授权本地处理。
