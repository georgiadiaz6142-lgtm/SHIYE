# 拾页 SHIYE：项目入口

> 当前启动方式（2026-09-13）：本项目使用 Node.js 前后端服务。请按下方命令启动；早期静态原型的 Python 预览方式不能提供账号、抠图和作品同步接口。

> 2026-09-11 清理说明：经 Song 确认，早期原型与已撤回画笔实验的代码、专用测试和产物已删除；下文相关描述属于历史记录，旧路径不再作为可运行入口。重复截图的现存路径见[清理记录](archive/CLEANUP-20260911.md)。

当前前端代码和素材位于 [shiye-editorial-prototype](./shiye-editorial-prototype/README.md)，服务端位于 `server/`，共享类型和数据约定位于 `shared/`。目录名沿用原型阶段名称。

## 当前预览

- 地址：[拾页线上预览](https://sm994o19l0g1rajv9qfqf.apigateway-cn-beijing.volceapi.com/)
- 页面标题：拾页 SHIYE — 把日子，慢慢收好。
- 当前入口包含书房首页、手帐和贴纸制作；历史外观描述与旧实验不作为当前版本入口。
- 入口文件：`shiye-editorial-prototype/index.html`。
- 页面脚本、样式和素材均位于该目录中。

使用 Node.js `>=22.22.0 <23`。首次克隆后，在项目根目录安装依赖并构建：

```sh
npm ci
npm run build
npm start
```

需要真实 AI 服务时，参考 `.env.example` 配置本机 `.env.local`；未配置时默认使用模拟模式。环境变量、账号、邀请码和运行数据不随 Git 仓库分发。若 4176 已有服务，不要重复启动。

浏览器作品、本机或线上账号与作品数据独立于代码仓库，克隆仓库不会复制这些数据。代码归档和 checkpoint 均不等于作品备份。

基础检查：`npm run typecheck`、`npm run check:prototype`、`npm run test:frontend`。完整后端测试可运行 `npm test`。

## 文档与目录

| 位置 | 用途 |
|---|---|
| [PROJECT.md](./PROJECT.md) | 当前阶段、执行约束及下一步 |
| [PRD](./拾页-PRD.md) | 产品范围、已确认规则与验收要求 |
| [产品设计文档](./拾页-产品设计文档.md) | 交互与视觉设计基线 |
| [AI 与后端技术方案](./拾页-AI与后端技术方案.md) | 正式数据、服务与 AI 边界 |
| [技术验证记录](./拾页-技术验证记录.md) | 区分旧版测试、新版状态与待验证能力 |
| [当前原型](./shiye-editorial-prototype/README.md) | 4176 实际使用的界面与交互代码 |
| [已清理：历史实验归档](archive/CLEANUP-20260911.md) | 已退役旧实验的清理记录 |

## 2026-09-07 归档说明

2026-09-08：按 Song 截图确认，从 `checkpoint-before-desk-20260907.tar.gz` 恢复米白首页三份代码，并从首页改版前节点补回缺失的 `assets/coffee.jpg`。清理木桌专属素材副本、来源记录及误测目录；操作前内容集中保留在 `archive/2026-09-08-before-cream-restore.tar.gz`，仅供恢复，不作验收入口。浏览器作品未读取、清理或迁移。

旧版根目录四个文件及 `shiye-ui-validation` 已原样移入历史归档。新版原型代码、素材、两个回退 checkpoint 和三份正式产品文档未修改。归档只移动、不删除。

此前新版目录缺失导致的 404 已解除：首页、JS、CSS 的新请求返回 200，内容与新版目录文件一致。该检查只证明服务及文件来源恢复，不代表新版完整技术验收通过；旧版的“7 项通过、3 项未通过”不能作为新版结果。
