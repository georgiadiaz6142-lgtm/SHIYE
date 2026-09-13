# 千问文案接入 · 2026-09-10

【已完成】Song 选择先试千问。本轮在既有 AI 文案功能中增加阿里云百炼（北京）适配与管理员供应商选择，修改前节点为 `2accc86`，沿用 `feat/ai-copy-20260910`。

【待配置】真实千问 API Key 尚未配置，真实文案仍停用。本轮没有请求真实大模型、上传用户图片或产生模型调用费用。模拟响应只验证集成流程，不代表千问实际生成质量。

## 使用

管理工具 → API 管理 → AI 手账文案 → 编辑配置：

- 新配置默认千问（北京），固定模型 `qwen3.7-flash-2026-07-15`，参考单价输入 0.2、输出 0.8 元/百万 tokens。
- 填入北京地域按量付费 API Key、累计请求上限和未来截止时间，再勾选启用并保存。保存本身不调用模型；用户主动生成时才调用。
- 原提示词设置继续使用。接口采用非思考模式与严格 JSON Schema，接收当前页低清贴纸缩略图和约定用户输入，保留本地结果校验。
- 旧方舟配置按原供应商加载，不自动迁移密钥。切换已有密钥的供应商必须填写新密钥；留空保存不会把其他供应商密钥发送给千问。
- 保留预览后应用、有效结果计次、失败释放用户次数、持久任务幂等和费用记录。千问来源标记可随结构化作品同步和重新打开。

## 官方依据

- [模型信息与价格](https://help.aliyun.com/zh/model-studio/qwen3-7-flash)
- [JSON Schema 支持](https://help.aliyun.com/zh/model-studio/qwen-structured-output)
- [视觉输入及思考开关](https://help.aliyun.com/zh/model-studio/vision/)
- [接入地址](https://help.aliyun.com/zh/model-studio/base-url)：当前北京 DashScope 共享域名仍可使用；本轮固定 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`，不开放任意 URL。
- [获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)：需与北京地域匹配的按量付费密钥。本功能不使用 Coding Plan / Token Plan 专用接口。

## 验证

- 编译与完整后端回归：62 项通过，[记录](./backend-tests.txt)。首次有 10 项受沙箱回环端口 EPERM 限制，允许本机测试监听后全部通过。
- 原型语法与本地合并：10 项通过，[记录](./prototype-tests.txt)；管理员脚本语法检查通过。
- 隔离 Chrome：7 组通过，[结果](./browser-results.json)、[可复跑脚本](./browser.cjs)。使用真实适配器配合隔离进程的测试传输，不访问模型服务。覆盖配置默认值/切换/保存/密钥隐藏、旧密钥保护、390px 布局、普通用户拒绝、保存提示词和图片输入、预览/应用、原字号字体保留、撤销/重做、账号同步/刷新、供应商失败退次和费用。
- 浏览器脚本最初两次分别因关闭按钮重复匹配、手动查询漏带身份请求头失败；修正测试后通过，未更改产品门禁。
- 已查看[桌面配置](./admin-qwen.png)、[手机配置](./admin-qwen-mobile.png)、[测试响应预览](./qwen-fixture-preview.png)。未验证真机 Safari。
- 本机 4176 更新与冒烟通过：[服务更新](./restart-results.json)、[冒烟](./live-smoke-results.json)。管理员、邀请码、环境文件和既有提示词/文案配置保持不变，百度服务配置保留。真实文案关闭、请求 0 次。

下一步：管理员填写真实千问密钥及试用范围，然后以明确选定的样例验证文案自然度、事实准确性、延迟和实际用量。本轮不修改百度抠图、原位文字输入或字号逻辑，不部署到公网。
