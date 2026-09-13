# 拾页函数执行角色与云端存储验证

2026-09-11，Song 授权继续专用权限配置、程序读写验证及测试版部署。

## 已确认的云端变更

- 新建自定义策略 `ShiyeTosObjectsAccess`，仅允许 `tos:GetObject`、`tos:PutObject`、`tos:DeleteObject`，资源限定为 `shiye-private-20260911-c7f2` 的 `shiye/*` 和 `shiye-verification/*`。精确 JSON 见 [tos-policy.json](tos-policy.json)。
- 新建 `ShiyeTosRuntimeRole`（ID `155188982`），TRN `trn:iam::2124854174:role/ShiyeTosRuntimeRole`。信任关系仅为服务 `vefaas` 执行 `sts:AssumeRole`；详情页确认只绑定上述一个策略。未创建长期 Access Key 或子用户，未改变其他角色。
- 新建测试应用 `shiye-web-test`，应用 ID `862432459a9a`，关联函数 `ulvzu4v3`；复用 `hydrogen-gw`，新增独立服务与路由，不修改既有应用入口。
- 已向此函数提交角色、0.5 vCPU／1 GiB、60 秒请求超时与平台允许的最低共享并发 10。第一次并发 1 被平台参数校验拒绝，修正后配置提交成功。
- 写入仅用于合成验证的环境配置及临时口令，不含本机账号、AI 密钥或用户作品；口令不进入源码包或报告。

## 代码与验证

- 官方角色文档指出，Web 应用通过平台请求头获取 STS 临时凭证：[通过 IAM 角色授予实例访问云服务的权限](https://www.volcengine.com/docs/6662/1827370)，更新时间 2025-10-10。
- 新增请求级凭证作用域。并发请求使用各自的凭证，后续请求重新读取临时凭证；不修改 `process.env`，不将首次凭证永久缓存。
- 新增角色模式的延迟初始化入口，平台请求到达后才访问 TOS；缺少凭证或初始化失败返回统一 503，不泄露底层错误或退回本机文件。
- 新增独立受口令及期限保护的存储验证服务，只检查合成对象，不开放用户业务。每个实例启动后只允许开始一次验证；这不是跨实例恰好一次保证。
- 最终 102/102 后端测试通过，包含新增加的凭证缺失、重复头、并发隔离、凭证更新、初始化失败恢复及真实本地 HTTP 路由测试，详见 [backend-tests.txt](backend-tests.txt)。首次普通沙箱运行的 HTTP 测试受回环端口 EPERM 限制，获执行权限后通过；测试样例 UUID 类型问题已修正。

## 运行环境与部署包

平台默认 Native Node 环境为 Node 20，而项目要求 Node 22。按 Native 代码包支持自带可执行文件的方式，准备官方 Node 22.22.0 Linux x64 可执行文件，启动命令为 `./runtime/node dist/server/tos-check-index.js`。是否能在实际平台启动须以发布后 HTTP 验证为准。

第一次下载不完整（30,754,944 字节），哈希失败后未执行、未上传。重新下载完整包（30,779,824 字节）与官方 SHASUMS256 清单一致：`9aa8e9d2298ab68c600bd6fb86a6c13bce11a4eca1ba9b39d79fa021755d7c37`。保留 Node 许可证。未安装或修改本机全局 Node／Docker。

独立源码目录 `/var/folders/t7/ndjlm0z500sgk_2x1vgys5780000gn/T/shiye-deployment-10nxo8/source`，248 个文件，清单见 [source-manifest.json](source-manifest.json)。排除 `.env*`、`.local`、Git、归档与验证目录；临时验证口令文件位于部署源码目录之外。

当前提交的是存储测试入口；尚不能据此标记产品正式上线、SDK 实测通过或真实 AI 可用。正式用户业务、迁移、备份、worker 调度及入口请求头覆盖仍须实测确认。

## 本轮发布结果：未成功

完整包通过 CLI 提交后长时间无输出；查询应用仍为 `create_success`、函数 `not released`、代码大小 922,684 字节（创建时模板），发布版本 0。中断此 CLI 进程后，再次核对没有开始发布。

改为仅包含服务器代码、依赖清单与 Node 22 的轻量验证包：`/tmp/shiye-storage-deploy-k7zoxzs4/source`，49 个文件、123,813,641 字节（解压前大小未据此推算），清单见 [storage-check-manifest.json](storage-check-manifest.json)。同一应用的第二次上传明确输出 `Error: Upload failed`，随后停止失败进程，未重复发布。

首次轻量上传命令的自动审批超时，命令未执行；按工具提示仅重试一次后审批通过。这不是上传失败原因。后续云端状态查询另返回 `NETWORK_TIMEOUT: timeout of 60000ms exceeded`，具体网络故障点尚未定位。

对该函数设置零预留／最多一实例时，云端明确返回 `InvalidOperation: This operation is not supported. Function ulvzu4v3 not deployed`（请求 ID `2026091123191317A21B47C876FA08B591`）。因此不能声称实例上限已经生效；须在部署成功后检查并设置。该响应同时确认当时函数尚未部署。

专用桶、策略、角色及应用外壳保留，没有删除其他资源。真实 SDK 条件写入、并发恢复、临时凭证注入和请求头覆盖验证未执行。当前阻断是上传失败及随后出现的云端 API 超时；可恢复下一步为检查官方控制台上传通道，沿用同一个应用，不再重复创建资源。临时口令会按设定期限失效，再次验证前需要重新生成受控验证口令。

最终实际请求测试入口 `/healthz` 返回 HTTP 404、`revision_not_found`，提示函数 `ulvzu4v3` 没有已发布版本（请求 ID `a09d1eae-dc37-9301-bc04-92f4956921ab`），与未部署状态一致。
