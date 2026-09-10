# 本机开发作品保存接口 v1

2026-09-10 自动同步更新：Song 已确认账号作品默认自动同步，只有访客作品首次归入需选择。完整自动同步验收见 [报告](../auto-sync-20260910/REPORT.md)。

基础路径 `/api/works`。先通过现有账号登录流程取得会话。账号归属来自服务端会话，不接受请求中的 ownerId。仅有邀请码、未设置账号时返回 401。写请求要求同源 Origin；请求和响应中不传输云密钥。

| 方法与路径 | 作用 |
| --- | --- |
| GET `/workspace` | 读取账号书架、素材、归档素材的完整快照及 revision |
| PUT `/workspace` | 使用 operationId/baseRevision 提交完整快照，包括未使用的素材及删除 |
| GET `/status` | 返回 `storage: local-development, cloudConnected: false` |
| POST `/images/{imageId}` | 持久保存一张图片，Content-Type 为 application/octet-stream |
| GET `/images/{imageId}` | 按账号读取规范化 PNG |
| GET `/books` | 当前账号手账列表，按服务端更新时间倒序 |
| PUT `/books/{bookId}` | 保存单本手账与所需素材元数据 |
| GET `/books/{bookId}` | 读取 content、revision、updatedAt |

imageId 为客户端首次上传前生成并保留的 UUID。同账号相同 ID、相同规范化图片重试不会增加记录；同 ID 换图返回 409 IMAGE_ID_CONFLICT。不同账号各自拥有独立的 ID 空间，不共享可访问图片。

保存请求示例（ID 均为示意测试值）：

```json
{
  "operationId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "baseRevision": 0,
  "content": {
    "schemaVersion": 1,
    "book": {
      "id": "book-1",
      "title": "我的第一本手账",
      "cover": "olive",
      "page": 0,
      "pages": [{
        "id": "page-1",
        "paper": "plain",
        "elements": [{
          "id": "element-1", "type": "sticker",
          "x": 20, "y": 20, "w": 35, "rotation": 0,
          "assetId": "sticker-1"
        }]
      }]
    },
    "assets": [{
      "id": "sticker-1", "name": "一枚贴纸", "category": "照片",
      "image": {"imageId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}
    }]
  }
}
```

保存前必须上传上述 imageId 对应图片。初次 baseRevision 为 0；后续使用最近读取／保存确认的 revision。响应示例：

```json
{"bookId":"book-1","revision":1,"updatedAt":1789000000000}
```

请求中的操作 ID、baseRevision 和快照必须一起保留。连接中断时原样重试；修改快照后必须换操作 ID。若重试历史操作，返回当时的保存确认；需要最新内容时再 GET，不将旧确认当成最新快照。

## 本机作品转换约定

- 保留 book/page/element/asset 原 ID、数组顺序与编辑属性；服务端 revision 独立于 IndexedDB 工作区 revision。
- `blobKey`、`src: data:...`、`src: blob:...` 不能直接同步。客户端读取对应图片，上传后改为 `image: {imageId}`。完整原照片不作为抠图保存的附带文件上传。
- 官方示例照片可用 `image: {builtinPath: "assets/lake.jpg"}`；内置贴纸可用 `image: {builtinId: "flower"}`。服务端不抓取外部 URL。
- 书页中的 photo 元素同样使用 image 引用；sticker 元素保留 assetId。
- 从 assets 和 archivedAssets 收集该书引用的全部贴纸。归档素材标记 archived=true；不能因为素材不在仓库可见列表而漏传图片。
- 字体、竖排、h、flip、跨缝 spreadWith 和双页纸张 paperSpread 必须保留。具体可用字段以 `shared/works.ts` 为准，未支持字段会拒绝而非静默丢失。
- 账号作品默认自动同步；访客作品经首次明确归入后同步，保留在访客空间的作品不上传。

## 错误与恢复

| 状态／错误 | 客户端处理 |
| --- | --- |
| 401 ACCOUNT_REQUIRED | 保留账号本机作品，重新登录后继续 |
| 404 WORK_NOT_FOUND / WORK_IMAGE_NOT_FOUND | 不存在或不属于当前账号；不披露其他账号资源 |
| 409 WORK_REVISION_CONFLICT | 保留本机改动，读取新版后合并或另存冲突副本 |
| 409 OPERATION_CONFLICT | 同一次保存换了内容；检查持久操作 ID 的使用 |
| 422 WORK_IMAGE_MISSING | 依赖图片未就绪或归属不符；先处理图片，不标记保存完成 |
| 503 WORK_IMAGE_UNAVAILABLE | 文件暂不可用／校验失败；保留本机副本后重试 |
| 413 / 422 图片或结构校验失败 | 显示原因，不自动循环提交 |
| 500 / 连接中断 | 未得到确认；保留相同请求并查询或重试 |

图片接口原文件限制 10 MiB，静态 JPG/PNG/WebP、2400 万像素以内，转换后 PNG 不超过 32 MiB。保存 JSON 请求最大 2 MiB。图片接口不执行百度分割，不收模型调用费用。

自动同步页面已接通整库快照与删除；生产数据库和 TOS 尚未接通。响应头 `X-Shiye-Work-Storage: local-development` 用于开发验收，不应显示成“已保存到云端”。


## 自动同步快照

`PUT /workspace` 请求为 `{operationId, baseRevision, content: {schemaVersion:1, books:[], assets:[], archivedAssets:[]}}`。books 直接使用 bookDocument，图片引用与上面的转换规则一致。快照 JSON 上限 16 MiB。同一次操作的重试返回原确认，不回滚后续版本。

客户端发送 `X-Shiye-Work-Account` 与服务端会话账号核对；不匹配返回 409 WORK_ACCOUNT_CHANGED。账号启用整库同步后旧版单本 PUT 返回 409 WORKSPACE_SYNC_ACTIVE，避免两个保存模型互相覆盖；单本 GET 仍可读取最新结果。未迁入的旧版单本写入也参与整库初始 revision 计算，迁移期间出现新修改会拒绝旧快照。
