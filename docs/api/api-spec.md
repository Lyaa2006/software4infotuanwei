# API 规格说明（初版模板）

本文档用于整理“接口要先商量什么”，并在讨论完成后沉淀第一批接口契约，作为前后端并行开发、联调、Review 和补充 issue 的基础文档。

当前项目还没开始正式商量接口细节，因此本文档现阶段优先承担两个作用：

- 列出接口设计会前必须讨论的内容
- 提供后续讨论完成后的填写模板和落地位置

## 1. 当前要先商量的内容

- 统一接口基础风格：是否统一使用 `/api` 前缀，是否需要版本号如 `/api/v1`
- 统一认证方式：登录后返回什么令牌，请求头怎么传，是否需要刷新令牌
- 统一响应结构：`code`、`message`、`data`、`requestId` 是否作为固定格式
- 统一分页结构：是否固定使用 `items`、`page`、`pageSize`、`total`
- 统一错误码范围：参数错误、未登录、无权限、状态冲突、系统异常怎么编号
- 明确第一批必须先定的接口：登录、当前用户、权限、党团流程、学业分析、导入导出、审计日志
- 明确字段命名风格：如 `userId`、`roleCodes`、`processId` 是否统一采用驼峰命名
- 明确哪些接口是学生端调用，哪些接口是管理端调用，哪些是共用接口
- 明确哪些接口要先出草案，哪些接口可以后补
- 明确每个模块的接口 owner、对应 issue 和补充顺序

## 2. 当前使用方法

- 现在还没开始商量时，先看本节和“第一批接口清单”，不要直接把后面的草案当最终定稿
- 成员 A、B 先按模块补充“待确认项”和候选字段，作为会前准备
- 成员 C、D 在开始写前端页面和请求层前，先看第一批接口清单，明确自己依赖哪些接口
- 团队开始讨论时，按模块逐项确认：路径、方法、参数、返回结构、权限要求
- 某个接口讨论完成后，再把对应接口状态从 `draft` 往后推进，并补 owner、issue、联调备注
- 后续接口变更时，先改本文档，再改代码和 PR 描述

## 3. 文档使用规则

- 接口 owner 先补骨架，调用方再补充字段说明和联调备注
- 未确认的设计不要伪装成最终定稿，统一标记为 `待确认`
- 每个接口至少补齐：路径、方法、用途、权限、请求、响应、错误码、issue
- 接口发生变更时，同步更新前端调用方、后端实现、相关 PR 描述
- 涉及公共契约的大改动，先开 issue 再改文档

## 4. 当前版本信息

| 字段 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 当前阶段 | 项目初始化阶段 / 第一轮骨架设计 |
| 状态 | 草稿 |
| 维护目录 | `docs/api/` |
| 最近更新 | 2026-04-18 |
| 维护方式 | 按模块持续补充 |

## 5. 全局约定（待确认项可继续补充）

### 5.1 路径前缀

- 建议统一前缀：`/api`
- 管理端接口建议按模块分组，不建议前缀里直接写前端端类型
- 如后续采用版本化，可扩展为：`/api/v1`

### 5.2 数据格式

- 请求体默认使用 `application/json`
- 文件上传接口使用 `multipart/form-data`
- 导出接口返回文件流时，需要在接口说明中单独标明

### 5.3 认证方式

- 暂定：登录成功后返回访问令牌
- 暂定：通过请求头传递认证信息
- 请求头占位：`Authorization: Bearer <token>`
- 是否引入刷新令牌：`待确认`

### 5.4 统一响应结构（建议模板）

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "trace-id-placeholder"
}
```

字段建议：

- `code`：业务状态码，`0` 表示成功，其他值表示失败
- `message`：用户可读提示
- `data`：实际返回数据
- `requestId`：链路追踪 ID，便于排查问题

### 5.5 分页结构（建议模板）

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 10,
    "total": 0
  },
  "requestId": "trace-id-placeholder"
}
```

### 5.6 通用错误码（初步占位）

| 错误码 | 含义 | 备注 |
| --- | --- | --- |
| `0` | 成功 | 固定保留 |
| `40000` | 请求参数错误 | 待统一 |
| `40100` | 未登录或 token 无效 | 待统一 |
| `40300` | 无权限访问 | 待统一 |
| `40400` | 资源不存在 | 待统一 |
| `40900` | 状态冲突或重复提交 | 待统一 |
| `50000` | 系统内部错误 | 待统一 |

## 6. 接口状态说明

| 状态 | 含义 |
| --- | --- |
| `draft` | 仅有草案，尚未冻结 |
| `reviewing` | 正在评审 |
| `frozen` | 已冻结，可按此联调 |
| `implemented` | 后端已实现 |
| `deprecated` | 已废弃，不再新增调用 |

## 7. 第一批接口清单

> 说明：以下接口为当前阶段建议优先冻结的范围，便于第一轮并行开发。

| 模块 | 接口名称 | 方法 | 路径 | 主要调用方 | owner | 状态 | issue |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 认证 | 用户登录 | `POST` | `/api/auth/login` | 学生端 / 管理端 | 待定 | `draft` | 待补 |
| 认证 | 获取当前用户信息 | `GET` | `/api/auth/me` | 学生端 / 管理端 | 待定 | `draft` | 待补 |
| 权限 | 获取当前用户权限 | `GET` | `/api/auth/permissions` | 学生端 / 管理端 | 待定 | `draft` | 待补 |
| 党团流程 | 查询流程列表 | `GET` | `/api/party/processes` | 学生端 / 管理端 | 待定 | `draft` | 待补 |
| 党团流程 | 查询流程详情 | `GET` | `/api/party/processes/{processId}` | 学生端 / 管理端 | 待定 | `draft` | 待补 |
| 学业分析 | 上传成绩单并分析 | `POST` | `/api/academic/transcript/analyze` | 学生端 | 待定 | `draft` | 待补 |
| 学业分析 | 查询分析结果 | `GET` | `/api/academic/analyses/{analysisId}` | 学生端 / 管理端 | 待定 | `draft` | 待补 |
| 管理导入导出 | 导入学生数据 | `POST` | `/api/admin/import/students` | 管理端 | 待定 | `draft` | 待补 |
| 管理导入导出 | 导出学生数据 | `POST` | `/api/admin/export/students` | 管理端 | 待定 | `draft` | 待补 |
| 审计日志 | 查询操作日志 | `GET` | `/api/admin/audit-logs` | 管理端 | 待定 | `draft` | 待补 |

## 8. 接口模板

后续新增接口时，直接复制以下模板补充。

~~~md
## X.Y 接口名称

| 字段 | 内容 |
| --- | --- |
| 模块 | 例如：认证 / 党团流程 / 学业分析 |
| 接口名称 |  |
| 状态 | `draft` / `reviewing` / `frozen` / `implemented` / `deprecated` |
| owner |  |
| 对应 issue |  |
| 最近更新人 |  |
| 最近更新时间 |  |

### 1. 基本信息

- 方法：
- 路径：
- 用途：
- 调用方：
- 权限要求：

### 2. 请求参数

#### Path 参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
|  |  |  |  |

#### Query 参数

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

#### Body 参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
|  |  |  |  |

请求示例：

```json
{}
```

### 3. 响应结果

成功响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
|  |  |  |

### 4. 错误码

| 错误码 | 场景 | 说明 |
| --- | --- | --- |
|  |  |  |

### 5. 业务规则 / 待确认项

- 待确认：
- 数据范围限制：
- 是否需要审计日志：
- 是否涉及导入导出或文件流：

### 6. 联调备注

- 前端备注：
- 后端备注：
- 测试备注：
~~~

## 9. 第一批接口草案

## 9.1 用户登录

| 字段 | 内容 |
| --- | --- |
| 模块 | 认证 |
| 接口名称 | 用户登录 |
| 状态 | `draft` |
| owner | 成员 A（建议） |
| 对应 issue | 待补 |
| 最近更新人 | 待补 |
| 最近更新时间 | 2026-04-18 |

### 1. 基本信息

- 方法：`POST`
- 路径：`/api/auth/login`
- 用途：用户通过统一入口登录系统，获取访问凭证和基础身份信息
- 调用方：学生端、管理端
- 权限要求：匿名可访问

### 2. 请求参数

#### Body 参数

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `username` | `string` | 是 | 账号、工号或学号，待统一 |
| `password` | `string` | 是 | 登录密码 |
| `loginType` | `string` | 否 | 登录端类型，是否保留待确认 |
| `captchaToken` | `string` | 否 | 若后续接入验证码可使用 |

请求示例：

```json
{
  "username": "20230001",
  "password": "******",
  "loginType": "student"
}
```

### 3. 响应结果

成功响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "token-placeholder",
    "tokenType": "Bearer",
    "expiresIn": 7200,
    "user": {
      "userId": "u_001",
      "name": "张三",
      "roleCodes": [
        "student"
      ]
    }
  },
  "requestId": "trace-id-placeholder"
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `accessToken` | `string` | 访问令牌 |
| `tokenType` | `string` | 令牌类型，建议固定为 `Bearer` |
| `expiresIn` | `number` | 令牌有效期，单位秒 |
| `user.userId` | `string` | 用户唯一标识 |
| `user.name` | `string` | 用户姓名 |
| `user.roleCodes` | `string[]` | 当前用户角色编码列表 |

### 4. 错误码

| 错误码 | 场景 | 说明 |
| --- | --- | --- |
| `40000` | 参数缺失 | 用户名或密码为空 |
| `40100` | 登录失败 | 账号不存在或密码错误 |
| `40300` | 账号不可用 | 账号被禁用、未授权等 |

### 5. 业务规则 / 待确认项

- 待确认：是否区分学生端与管理端登录入口
- 待确认：是否支持验证码、单点登录、初始密码修改
- 是否需要审计日志：是

### 6. 联调备注

- 前端备注：字段命名冻结前不要自行改成其他风格
- 后端备注：返回结构尽量保持稳定，避免影响所有调用方
- 测试备注：需覆盖错误密码、禁用账号、空参数

## 9.2 获取当前用户信息

| 字段 | 内容 |
| --- | --- |
| 模块 | 认证 |
| 接口名称 | 获取当前用户信息 |
| 状态 | `draft` |
| owner | 成员 A（建议） |
| 对应 issue | 待补 |
| 最近更新人 | 待补 |
| 最近更新时间 | 2026-04-18 |

### 1. 基本信息

- 方法：`GET`
- 路径：`/api/auth/me`
- 用途：获取当前登录用户基础资料、角色和展示所需身份信息
- 调用方：学生端、管理端
- 权限要求：已登录

### 2. Query 参数

当前无

### 3. 响应结果

成功响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "userId": "u_001",
    "username": "20230001",
    "name": "张三",
    "userType": "student",
    "roleCodes": [
      "student"
    ],
    "organization": {
      "collegeId": "info-college",
      "classId": "class-2023-1"
    }
  },
  "requestId": "trace-id-placeholder"
}
```

### 4. 错误码

| 错误码 | 场景 | 说明 |
| --- | --- | --- |
| `40100` | 未登录 | token 缺失或失效 |
| `40300` | 无权限 | 账号状态异常 |

### 5. 业务规则 / 待确认项

- 待确认：组织字段最终范围
- 待确认：是否在该接口直接返回权限点
- 是否需要审计日志：否

## 9.3 获取当前用户权限

| 字段 | 内容 |
| --- | --- |
| 模块 | 权限 |
| 接口名称 | 获取当前用户权限 |
| 状态 | `draft` |
| owner | 成员 A（建议） |
| 对应 issue | 待补 |
| 最近更新人 | 待补 |
| 最近更新时间 | 2026-04-18 |

### 1. 基本信息

- 方法：`GET`
- 路径：`/api/auth/permissions`
- 用途：返回当前用户的角色、权限点、数据范围，用于前端展示控制和后端联调校验
- 调用方：学生端、管理端
- 权限要求：已登录

### 2. 响应结果

成功响应示例：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "roleCodes": [
      "student"
    ],
    "permissions": [
      "party.process.read.self",
      "academic.analysis.read.self"
    ],
    "dataScopes": [
      "self"
    ]
  },
  "requestId": "trace-id-placeholder"
}
```

### 3. 业务规则 / 待确认项

- 前端权限仅用于展示控制，不能替代后端鉴权
- 待确认：是否返回菜单权限、按钮权限、数据范围三类信息
- 是否需要审计日志：否

## 9.4 查询党团流程列表

| 字段 | 内容 |
| --- | --- |
| 模块 | 党团流程 |
| 接口名称 | 查询党团流程列表 |
| 状态 | `draft` |
| owner | 成员 B（建议） |
| 对应 issue | 待补 |
| 最近更新人 | 待补 |
| 最近更新时间 | 2026-04-18 |

### 1. 基本信息

- 方法：`GET`
- 路径：`/api/party/processes`
- 用途：查询党团流程记录列表，可用于学生查看本人进度，也可用于管理端按条件筛选
- 调用方：学生端、管理端
- 权限要求：已登录，具体数据范围见 RBAC 矩阵

### 2. Query 参数

| 字段 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `page` | `number` | 否 | `1` | 页码 |
| `pageSize` | `number` | 否 | `10` | 每页条数 |
| `keyword` | `string` | 否 |  | 学号、姓名等关键词 |
| `status` | `string` | 否 |  | 流程状态 |
| `studentId` | `string` | 否 |  | 学生 ID，学生端通常不传 |

### 3. 业务规则 / 待确认项

- 待确认：流程状态枚举值
- 待确认：学生端是否允许查看历史全部记录
- 是否需要审计日志：管理端查询建议记录

## 9.5 上传成绩单并分析

| 字段 | 内容 |
| --- | --- |
| 模块 | 学业分析 |
| 接口名称 | 上传成绩单并分析 |
| 状态 | `draft` |
| owner | 成员 B（建议） |
| 对应 issue | 待补 |
| 最近更新人 | 待补 |
| 最近更新时间 | 2026-04-18 |

### 1. 基本信息

- 方法：`POST`
- 路径：`/api/academic/transcript/analyze`
- 用途：上传成绩单文件并触发分析，返回分析任务或分析结果
- 调用方：学生端
- 权限要求：已登录，普通学生仅可分析本人数据

### 2. 请求参数

- Content-Type：`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `file` | `file` | 是 | 成绩单文件 |
| `studentId` | `string` | 否 | 管理端代分析场景下待确认 |

### 3. 业务规则 / 待确认项

- 待确认：同步返回分析结果还是异步任务 ID
- 待确认：支持的文件格式、大小限制、模板要求
- 是否需要审计日志：是

## 10. 接口变更记录

| 日期 | 接口 | 变更类型 | 说明 | 处理人 | 关联 issue / PR |
| --- | --- | --- | --- | --- | --- |
| 2026-04-18 | 全文档 | 新增 | 初始化 API 模板与第一批接口草案，并补充会前讨论清单与当前使用方式 | Codex | 待补 |

## 11. 后续待补

- 补齐每个接口的最终 owner 和 issue 编号
- 冻结统一错误码、分页参数、时间字段格式
- 补齐管理端审批、通知、导入导出相关接口
- 与后续数据库设计文档、RBAC 矩阵文档互相引用

## Current Web API Documentation Notes

The API details in this directory should be synchronized with the current backend implementation. When there is any uncertainty, use server/ as the source of truth and update this document after confirming the actual request and response shape.

### Current known Web call areas

| Area | Typical frontend scenario | Documentation note |
| --- | --- | --- |
| Authentication | Web login and role-based access | Keep role and account-state behavior aligned with backend auth checks. |
| Party admin student list | /party/admin/list loads real student accounts | Student lists should not be derived from party_students alone. |
| Party admin edit | Admin edits one student's party progress | Target account must be a real student account. |
| Student tag management | /tag-management maintains student tags | Saving tags for admin or non-student accounts should be rejected. |
| Reminder | /reminder sends notices to all or by tags | Tag sending should use real student tag data. |
| Activity management | /activity creates, edits, deletes, and manages cadres | Participant and cadre targets should be real student accounts where the field represents students. |
| Certificates, academics, honors | Dashboard feature modules | Keep request parameters and file handling notes updated when implementation changes. |

### Student-scope API rule

For student-only operations, backend APIs should validate the target account. This includes student tag editing, party progress editing, activity participants, and cadre settings. Frontend filtering is helpful for display but should not be treated as security or data-scope protection.

### Update rule

When an endpoint path, request body, response field, permission rule, or error code changes, update this document or add a link to a more specific API note. If the exact contract is still under discussion, mark it as pending instead of guessing.
