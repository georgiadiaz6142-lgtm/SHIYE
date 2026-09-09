# 小剪刀与侧边翻页 · 2026-09-08

【已确认/页面事实】本轮按 Song 最新要求修改同一份 4176 米白版，不新增产品目录，不修改首页布局、HTML、照片素材或用户浏览器作品。正式 AI 主流程仍保留“自动提取主要物体、人工纠错、模型贴边”；未接模型阶段允许先用手工剪刀裁切。

## 交付

- 上传照片默认进入“小剪刀”：按住圈一圈，松手后自动闭合并直接显示透明贴纸预览；手指/鼠标分段点击也可围出区域，再点“剪下来”。支持撤销最近一点，绘制时有局部放大镜。矩形裁切作为备选保留。
- 本地剪刀保留圈内像素，不识别物体、不自动去除圈内背景；未下载或安装模型/依赖，照片不上传。
- 实际打开 Song 提供的[参考首页](https://s5jijm26cfi1b99jdn41p.apigateway-cn-beijing.volceapi.com/)，查看首页下一页动作和页面可见结构。参考其全高侧边弯曲翻过书脊的运动方式，在本项目用独立的纵向分段曲面实现，未复制对方素材或整站代码。
- 首页演示、用户手帐翻阅与编辑前后页按钮采用同一侧边翻页渲染；侧边中部可拖动，不再使用斜向页角折叠。保留正反面、回弹、减少动态、手机单页和单页编辑。
- 编辑翻页先保存；保存失败不翻页。窗口变化或界面重新渲染取消动画，恢复当前页与编辑能力。

## 验证

- [scissors-sideflip-02/results.json](scissors-sideflip-02/results.json)：7/7，通过首页中部侧拖、用户书回弹与背面、编辑侧翻且内容不变、小剪刀自动透明预览、分段点选与撤销、矩形备选、手机触控点选与翻页。第一次同组也为 7/7；之后调整连续阴影与透视并复验。
- [sideflip-guards-01/results.json](sideflip-guards-01/results.json)：2/2，最后新增的编辑翻页取消令牌与窗口变化保护、保存失败保护分别实测。前一组之后仅加入该取消保护，未声称再全量运行前一组。
- JavaScript 语法通过；数据合并单测 10/10。浏览器检查无未处理 JS 异常、无第三方请求；隔离 Chrome，不影响用户作品。
- 人工查看[侧翻背面](scissors-sideflip-02/book-side-backface.png)、[首页侧翻](scissors-sideflip-02/home-side-midturn.png)、[放大镜圈选](scissors-sideflip-02/scissors-loupe.png)、[剪出结果](scissors-sideflip-02/scissors-result.png)。触控是 Chrome 模拟，不等于 Safari/手机真机或大规模性能验收。

最终 app.js SHA-256：`b912360af6fa67dcdb59cb24b9b69cb2c10630cf6762541c87f994553e6be3ad`。
最终 styles.css SHA-256：`2f69c2f5b067e33163dd3d35b764c984bb710b4ed4581d63e0851a711d9cf7de`。
index.html 保持原米白版本：`ff278abca8ecf5a5c76546705b0334d56e2593412fdc3b753d321723bdaf9ea2`。

恢复节点：`archive/2026-09-08-before-scissors-sideflip.tar.gz`，包含修改前 app.js/styles.css/PROJECT；不包含浏览器作品。旧验证基线仍保留为历史，不覆盖成新版本。

## “框个大概后自动收边”的选项

【外部核验】[OpenCV GrabCut](https://docs.opencv.org/4.12.0/d8/d83/tutorial_py_grabcut.html) 支持先框住目标，再根据前景/背景分布求分割；错误时用前景/背景笔画修正。它不要求大型学习模型，但仍是需接入和评测的算法，不是当前剪刀的能力。

【外部核验】[Meta SAM 2](https://ai.meta.com/research/sam2/) 支持点、框、蒙版提示和追加提示纠正分割。

【建议设计】长期优先用代表性照片评测 SAM 类交互分割，统一自动候选与漏提/错提纠正；GrabCut 可作为局部试验备选，但不先承诺复杂背景、相近颜色、细小枝叶能稳定收边。模糊轮廓的平滑处理不等于按图片内容收边。当前未做真实模型/算法分割验收。
