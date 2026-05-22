# 数据库与接口更新维护文档

本文档只记录真实发生过的数据库与接口变更。

填写规则、触发条件、模板说明请先阅读：

- [数据库与接口更新说明文档](./database-interface-update-guide.md)

## 1. 总表

每次新增一条记录时，先在总表最上方追加一行。

| 日期 | 模块 | 改动类型 | 摘要 | 是否需要同步数据库 | 是否需要同步前端 | 负责人 | 关联提交/PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-23 | 项目基线 | `db+api` | 补录当前项目已存在的数据库表结构与后端接口基线 | 是 | 是 | Codex | 基线补录 |


## 2. 维护记录

后续真实记录从这里开始，按时间倒序追加，新记录放在最前面。

## 更新记录：2026-05-23 - 项目基线 - 当前数据库与接口补录

### 1. 基本信息

| 字段 | 内容 |
| --- | --- |
| 模块 | 项目基线 |
| 改动类型 | `db+api` |
| 负责人 | Codex |
| 关联提交/PR | 基线补录 |
| 影响范围 | `server` / `webpage` / `miniprogram` / `database` |
| 是否破坏兼容性 | 否 |
| 是否要求其他成员同步操作 | 是 |

### 2. 改动摘要

- 本次改了什么：补录当前仓库中已经实现的数据库表结构和后端接口，作为后续维护文档的起始基线。
- 改动原因：维护文档此前为空，需要先把现状登记清楚，后续新增变更才能做增量维护。
- 主要风险：如果后续代码改动未同步记录，维护文档会再次与实际实现脱节。

### 3. 数据库变更

本次为基线补录，无新增数据库改动；以下内容表示当前代码中的现有表结构。

#### 3.1 涉及表

| 表名 | 操作类型 | 说明 |
| --- | --- | --- |
| `permitted_accounts` | 基线 | 允许登录账号清单 |
| `users` | 基线 | 登录用户与密码摘要 |
| `knowledge_qa` | 基线 | 政策问答知识库 |
| `party_students` | 基线 | 党建学生信息与流程字段 |
| `student_notifications` | 基线 | 通知主表 |
| `student_notification_targets` | 基线 | 通知接收与已读状态 |
| `document_templates` | 基线 | 证书与模板文件 |
| `honor_items` | 基线 | 荣誉信息 |
| `class_activities` | 基线 | 活动主表 |
| `class_activity_rejections` | 基线 | 活动驳回信息 |
| `class_activity_reviews` | 基线 | 活动审核信息 |
| `class_activity_participants` | 基线 | 活动参与人 |
| `training_plans` | 基线 | 培养方案 |
| `semester_courses` | 基线 | 学期课程库 |
| `student_transcripts` | 基线 | 成绩单上传与解析结果 |

#### 3.2 字段变更明细

当前为基线补录，不逐字段展开。字段定义以 [server/schema.sql](../../server/schema.sql) 为准。

#### 3.3 SQL / 建表同步要求

```sql
-- 当前为基线补录
-- 新环境启动后端时会自动执行 server/schema.sql 建表
-- 仍需补充初始化数据，尤其是 permitted_accounts
```

#### 3.4 初始化数据变更

- 是否涉及初始化数据：是
- 涉及表：`permitted_accounts`、`knowledge_qa`、`training_plans`、`semester_courses`、`document_templates` 等
- 变更内容：本次仅补录“现有系统依赖初始化数据”的事实，不新增新数据
- 是否需要重新导入旧数据：新环境需要

### 4. 接口变更

本次为基线补录，无新增接口改动；以下内容表示当前代码中的现有接口。

#### 4.1 涉及接口

| 接口名称 | 方法 | 路径 | 操作类型 | 调用方 |
| --- | --- | --- | --- | --- |
| 用户登录 | `POST` | `/api/auth/login` | 基线 | `webpage` / `miniprogram` |
| 智能政策问答 | `POST` | `/api/qa/ask` | 基线 | `webpage` / `miniprogram` |
| 问答列表 | `GET` | `/api/qa` | 基线 | `webpage` / `miniprogram` |
| 新增问答 | `POST` | `/api/qa` | 基线 | `webpage` / `miniprogram` |
| 修改问答 | `PUT` | `/api/qa/:id` | 基线 | `webpage` / `miniprogram` |
| 删除问答 | `DELETE` | `/api/qa/:id` | 基线 | `webpage` / `miniprogram` |
| 学生查看本人党建信息 | `GET` | `/api/party/student/me` | 基线 | `webpage` / `miniprogram` |
| 管理员查看学生列表 | `GET` | `/api/party/admin/students` | 基线 | `webpage` / `miniprogram` |
| 管理员查看学生详情 | `GET` | `/api/party/admin/students/:accountId` | 基线 | `webpage` / `miniprogram` |
| 管理员保存学生详情 | `PUT` | `/api/party/admin/students/:accountId` | 基线 | `webpage` / `miniprogram` |
| 我的提醒列表 | `GET` | `/api/reminder/my` | 基线 | `webpage` / `miniprogram` |
| 我的提醒标记已读 | `POST` | `/api/reminder/my/:id/read` | 基线 | `webpage` / `miniprogram` |
| 管理员查看提醒消息 | `GET` | `/api/reminder/admin/messages` | 基线 | `webpage` / `miniprogram` |
| 管理员发送提醒消息 | `POST` | `/api/reminder/admin/messages` | 基线 | `webpage` / `miniprogram` |
| 管理员查看学生标签 | `GET` | `/api/reminder/admin/students` | 基线 | `webpage` / `miniprogram` |
| 管理员保存学生标签 | `PUT` | `/api/reminder/admin/students/:accountId/tags` | 基线 | `webpage` / `miniprogram` |
| 用户查看模板列表 | `GET` | `/api/cert/templates` | 基线 | `webpage` / `miniprogram` |
| 管理员查看模板列表 | `GET` | `/api/cert/admin/templates` | 基线 | `webpage` / `miniprogram` |
| 管理员上传模板 | `POST` | `/api/cert/admin/templates` | 基线 | `webpage` / `miniprogram` |
| 下载模板文件 | `GET` | `/api/cert/templates/:id/file` | 基线 | `webpage` / `miniprogram` |
| 生成模板 PDF | `GET` | `/api/cert/templates/:id/pdf` | 基线 | `webpage` / `miniprogram` |
| 荣誉用户列表 | `GET` | `/api/honor/users` | 基线 | `webpage` / `miniprogram` |
| 荣誉用户详情 | `GET` | `/api/honor/users/:accountId` | 基线 | `webpage` / `miniprogram` |
| 我的荣誉列表 | `GET` | `/api/honor/me` | 基线 | `webpage` / `miniprogram` |
| 新增我的荣誉 | `POST` | `/api/honor/me` | 基线 | `webpage` / `miniprogram` |
| 修改我的荣誉 | `PUT` | `/api/honor/me/:id` | 基线 | `webpage` / `miniprogram` |
| 删除我的荣誉 | `DELETE` | `/api/honor/me/:id` | 基线 | `webpage` / `miniprogram` |
| 上传荣誉图片 | `POST` | `/api/honor/me/upload` | 基线 | `webpage` / `miniprogram` |
| 查看培养方案 | `GET` | `/api/academic/plans` | 基线 | `webpage` / `miniprogram` |
| 查看学生学业报告 | `GET` | `/api/academic/student/report` | 基线 | `webpage` / `miniprogram` |
| 上传学生成绩单 | `POST` | `/api/academic/student/transcript/upload` | 基线 | `webpage` / `miniprogram` |
| 管理员查看培养方案 | `GET` | `/api/academic/admin/plans` | 基线 | `webpage` / `miniprogram` |
| 管理员导入培养方案 | `POST` | `/api/academic/admin/plans/import` | 基线 | `webpage` / `miniprogram` |
| 管理员新增培养方案 | `POST` | `/api/academic/admin/plans` | 基线 | `webpage` / `miniprogram` |
| 管理员修改培养方案 | `PUT` | `/api/academic/admin/plans/:id` | 基线 | `webpage` / `miniprogram` |
| 管理员删除培养方案 | `DELETE` | `/api/academic/admin/plans/:id` | 基线 | `webpage` / `miniprogram` |
| 管理员查看学期课程 | `GET` | `/api/academic/admin/semester-courses` | 基线 | `webpage` / `miniprogram` |
| 管理员保存学期课程 | `POST` | `/api/academic/admin/semester-courses` | 基线 | `webpage` / `miniprogram` |
| 我的活动列表 | `GET` | `/api/activity/me` | 基线 | `webpage` / `miniprogram` |
| 班团骨干查看我的活动 | `GET` | `/api/activity/cadre/mine` | 基线 | `webpage` / `miniprogram` |
| 班团骨干创建活动 | `POST` | `/api/activity/cadre` | 基线 | `webpage` / `miniprogram` |
| 班团骨干修改活动 | `PUT` | `/api/activity/cadre/:id` | 基线 | `webpage` / `miniprogram` |
| 管理员查看待审核活动 | `GET` | `/api/activity/admin/pending` | 基线 | `webpage` / `miniprogram` |
| 管理员通过活动审核 | `POST` | `/api/activity/admin/:id/approve` | 基线 | `webpage` / `miniprogram` |
| 管理员驳回活动审核 | `POST` | `/api/activity/admin/:id/reject` | 基线 | `webpage` / `miniprogram` |
| 班团骨干上传活动图片 | `POST` | `/api/activity/cadre/upload` | 基线 | `webpage` / `miniprogram` |
| 健康检查 | `GET` | `/health` | 基线 | `server` |

#### 4.2 请求参数变化

当前为基线补录，不逐接口展开请求参数。详细参数以 [server/index.js](../../server/index.js) 和 [api-spec.md](./api-spec.md) 后续补充内容为准。

#### 4.3 响应字段变化

当前为基线补录，不逐接口展开响应字段。当前后端统一返回结构主要为：

```json
{
  "success": true,
  "data": {}
}
```

失败时主要返回：

```json
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "错误说明"
}
```

#### 4.4 错误码变化

当前为基线补录，不单列全部错误码；后续如有公共契约变更，再在增量记录中单独补充。

### 5. 前端联调影响

- `webpage` 是否需要修改：否
- `miniprogram` 是否需要修改：否
- 受影响页面：当前全量页面均依赖这批基线接口
- 需要同步修改的调用文件：当前基线调用主要集中在 `webpage/src/services/api.js` 与 `miniprogram/services/api.js`

### 6. 本地同步步骤

其他成员拿到代码后需要执行：

1. `git pull`
2. 按 [local-kingbase-setup.md](../local-kingbase-setup.md) 与 [数据库统一建库步骤](../数据库统一建库步骤.md) 配置本地金仓
3. 启动后端，让其自动执行 `server/schema.sql`
4. 导入初始化数据，至少保证 `permitted_accounts` 可用
5. 启动网页端或小程序进行联调

### 7. 验证结果

- 后端验证：基于代码扫描补录，未重新逐接口实测
- 数据库验证：基于 `server/schema.sql` 补录
- 网页端验证：未执行
- 小程序验证：未执行
- 未验证项：接口逐条联调与初始化数据完整性

### 8. 备注

- 兼容性说明：本记录用于建立维护基线，不代表一次新的功能发布。
- 遗留问题：`api-spec.md` 目前还是草案，和真实实现未完全对齐。
- 后续待办：后续如改动任一基线接口或数据库对象，必须以本记录为基础追加增量记录。
