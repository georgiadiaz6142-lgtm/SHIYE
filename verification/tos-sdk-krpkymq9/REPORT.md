# 官方 TOS SDK 与云端启动入口

2026-09-11，Song 要求加快部署。本轮已完成本地接线，未创建或发布云资源。

- 项目内安装官方 `@volcengine/tos-sdk@2.9.1`，锁定版本，禁用安装脚本。新增 `server/tos-client.ts`，仅接受北京官方端点，TLS 验证开启，SDK 重试为 0，连接／请求超时 3／8 秒。
- 新增 `server/cloud-bootstrap.ts` 与 `server/cloud-index.ts`，启动命令为 `node dist/server/cloud-index.js`。只接受 `SHIYE_DEPLOYMENT=cloud-test` 与 `SHIYE_STORAGE=tos`；通过 `SHIYE_APP_ROLE=web|worker` 区分独立网页和异步任务应用，读取 `_FAAS_RUNTIME_PORT`。数据统一接入 TOS；连接／密钥错误时停止，不回退到临时文件。
- 初始管理员、加密密钥、签名密钥和 TOS 凭据通过受控环境提供，不读取本机账号回执；已有身份不会被新的初始化名称覆盖。
- 初始关闭真实 AI，当前入口采用 mock 抠图；正式使用仍须完成原 live 授权配置与供应商集成，不能直接作为正式产品发布。原 `server/index.ts` 与开发服务未改。
- 新增 `server/tos-smoke.ts`，仅当 `SHIYE_TOS_VERIFY=true` 才执行。验证使用唯一 `shiye-verification/<UUID>/` 前缀中的两个合成对象，检查仅创建、同 ETag 并发只有一个成功、新 SDK 实例恢复、删除确认。失败保留检测对象，绝不清理用户作品。未获得桶和专用权限，尚未运行真实验证。
- 新增官方 SDK 真实实例的传输替身测试及云端初始化恢复测试。首次发现 SDK 构造会覆盖 requestAdapter，测试调整为构造后替换适配器；最终 98/98 后端测试通过，见 [日志](backend-tests.txt)。此项不等于真实 TOS 测试。
- 构建及 git diff --check 通过。独立部署源目录 `shiye-deployment-fMbL7q/source` 共 242 文件、119114467 字节，未上传。

## 已核对控制台

已登录 TOS 服务。桶列表仅显示另一个项目的 `huake-beta-2124854174`（北京、私有、标准、单 AZ），未查看对象也未修改。

已在创建表单准备 `shiye-private-20260911-c7f2`：北京、私有、标准存储、多 AZ 关闭、分层命名空间关闭、版本控制暂不开通、日志分析未开通；未点击确定。用于先做合成数据测试，正式数据备份／版本保留需在真实用户进入前另行完成。

官方 [TOS 产品定价](https://www.volcengine.com/product/tos) 显示标准存储单 AZ 0.099 元/GiB/月；10 GiB 平均占用的容量部分约 0.99 元/月，请求和公网流量另计。这不是总月费承诺，未购买资源包。

按 Song 的付费操作规则，下一步需确认该具体桶的创建及小数据测试。实际访问密钥／最小 IAM 权限尚未建立；不能把浏览器登录当成 SDK 已有凭据。仍未创建付费资源，也未对现有应用和路由进行修改。
