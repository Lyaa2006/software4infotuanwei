# RBAC 权限矩阵（初版模板）

本文档用于整理“权限和角色要先商量什么”，并在讨论完成后沉淀角色、权限点、资源范围和操作矩阵，作为后端鉴权、前端展示控制、接口设计和 Review 的共同依据。

当前仍处于第一轮准备阶段，还没开始正式商量 RBAC 细节，因此本文档先提供会前讨论提纲和后续填写模板。

## 1. 当前要先商量的内容

- 系统第一轮到底需要哪些核心角色，哪些角色可以先合并，不要一开始拆得过细
- 是否允许一个用户同时拥有多个角色，角色冲突时怎么处理
- 学生、班团骨干、辅导员、教师、学院管理员、系统管理员的边界分别是什么
- 数据范围如何划分：`self`、`class`、`grade`、`college`、`all` 是否够用
- 哪些能力必须做后端强校验：审批、导出、日志查看、导入、跨范围查询
- 前端展示权限和后端真实权限如何分工，哪些字段需要通过接口返回
- 第一批核心资源有哪些：用户信息、党团流程、学业分析、通知、导入导出、审计日志
- 每类资源需要哪些动作：`read`、`create`、`update`、`approve`、`export`、`publish`
- 哪些权限要细到按钮级，哪些只需要接口级或页面级控制
- 哪些角色和权限由成员 A 先起草，哪些业务模块需要成员 B 补资源定义

## 2. 当前使用方法

- 现在还没开始商量时，先用本文档统一“讨论范围”，不要把矩阵里的 `TBD` 当成结论
- 成员 A 先补角色、权限点命名和数据范围草案
- 成员 B 按业务模块补资源和操作项，特别是党团流程、学业分析、导入导出、日志
- 成员 C、D 在做菜单、按钮、路由守卫和页面占位前，先看本文档确认哪些能力明显依赖权限
- 团队正式讨论时，先定角色和数据范围，再定权限点，再回填接口权限要求
- 某项权限讨论完成后，再同步更新 `docs/api/api-spec.md` 中相关接口的“权限要求”

## 3. 文档目标

- 统一角色命名，避免前后端各自定义一套
- 明确“谁能看什么、谁能操作什么、范围到哪里”
- 减少越权访问、字段误用、导出权限失控等风险
- 为 `docs/api/api-spec.md` 中的“权限要求”提供引用依据

## 4. 使用规则

- 角色、权限点、数据范围发生变化时，必须同步更新本文档
- 前端页面是否显示按钮，不能替代后端真实鉴权
- 未确认项统一标记为 `待确认`
- 涉及越权风险的变更，先开 issue 再修改
- 公共权限命名一旦冻结，不要在不同模块随意换风格

## 5. 当前版本信息

| 字段 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 当前阶段 | 项目初始化阶段 / 第一轮骨架设计 |
| 状态 | 草稿 |
| 最近更新 | 2026-04-18 |
| 关联文档 | `docs/api/api-spec.md` |

## 6. 基本概念

### 6.1 RBAC 组成

- 用户（User）：系统登录主体
- 角色（Role）：一组权限的集合
- 权限点（Permission）：可执行的最小操作单元
- 数据范围（Data Scope）：该权限能作用到哪些数据

### 6.2 当前建议命名方式

权限点建议采用以下格式：

```text
资源.动作.范围
```

示例：

- `party.process.read.self`
- `party.process.read.college`
- `academic.analysis.export.college`
- `audit.log.read.all`

说明：

- `资源`：如 `party.process`、`academic.analysis`、`audit.log`
- `动作`：如 `read`、`create`、`update`、`approve`、`export`
- `范围`：如 `self`、`class`、`college`、`all`

## 7. 第一批建议角色

> 说明：以下为准备阶段的初步角色模板，后续需结合需求文档继续细化。

| 角色编码 | 角色名称 | 角色说明 | 当前状态 | owner | issue |
| --- | --- | --- | --- | --- | --- |
| `student` | 普通学生 | 主要使用学生端，查看本人信息、流程和分析结果 | `draft` | 成员 A（建议） | 待补 |
| `class_cadre` | 班团骨干 | 在学生基础上，可能具备班级范围内的部分查看或上报能力 | `draft` | 成员 A（建议） | 待补 |
| `counselor` | 辅导员 | 面向班级或年级的管理、审批、查看能力 | `draft` | 成员 A（建议） | 待补 |
| `teacher` | 教师/业务老师 | 处理学业分析、业务数据查看等能力 | `draft` | 成员 A（建议） | 待补 |
| `college_admin` | 学院管理员 | 学院范围内管理、审批、导入导出、日志查看等能力 | `draft` | 成员 A（建议） | 待补 |
| `system_admin` | 系统管理员 | 全局管理与配置能力 | `draft` | 成员 A（建议） | 待补 |

## 8. 数据范围定义（建议）

| 范围编码 | 含义 | 说明 |
| --- | --- | --- |
| `self` | 仅本人数据 | 普通学生常用 |
| `class` | 本班级数据 | 班团骨干、辅导员可能使用 |
| `grade` | 本年级数据 | 是否保留待确认 |
| `college` | 本学院数据 | 学院管理员常用 |
| `all` | 全局数据 | 系统管理员或少数全局角色使用 |

## 9. 资源与操作清单（第一批模板）

| 资源编码 | 资源名称 | 典型操作 | 备注 |
| --- | --- | --- | --- |
| `auth.session` | 登录会话 | `create`、`read` | 登录、获取当前用户信息 |
| `user.profile` | 用户信息 | `read`、`update` | 个人资料、基础身份信息 |
| `party.process` | 党团流程 | `read`、`create`、`update`、`approve` | 第一批核心业务 |
| `academic.analysis` | 学业分析 | `read`、`create`、`export` | 上传成绩单、查看结果 |
| `notice` | 通知公告 | `read`、`create`、`publish` | 后续补充 |
| `import.task` | 导入任务 | `create`、`read` | 管理端导入 |
| `export.task` | 导出任务 | `create`、`read` | 管理端导出 |
| `audit.log` | 审计日志 | `read` | 敏感能力，需严格控制 |

## 10. 角色权限矩阵（初步填写模板）

说明：

- `Y`：默认允许
- `N`：默认不允许
- `TBD`：待确认
- 如需限制数据范围，写在“范围”列

| 资源 | 操作 | student | class_cadre | counselor | teacher | college_admin | system_admin | 范围/备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `auth.session` | `create` | Y | Y | Y | Y | Y | Y | 登录 |
| `auth.session` | `read` | Y | Y | Y | Y | Y | Y | 获取当前用户信息 |
| `user.profile` | `read` | Y | Y | Y | Y | Y | Y | `self / class / college / all` 待细化 |
| `user.profile` | `update` | TBD | TBD | TBD | TBD | TBD | TBD | 是否允许修改基础信息待确认 |
| `party.process` | `read` | Y | TBD | Y | TBD | Y | Y | 学生默认 `self` |
| `party.process` | `create` | TBD | TBD | TBD | N | TBD | Y | 谁能发起流程待确认 |
| `party.process` | `update` | TBD | TBD | Y | N | Y | Y | 按流程节点限制 |
| `party.process` | `approve` | N | N | Y | N | Y | Y | 审批链待细化 |
| `academic.analysis` | `create` | Y | TBD | TBD | TBD | TBD | Y | 上传或发起分析 |
| `academic.analysis` | `read` | Y | TBD | Y | Y | Y | Y | 学生默认 `self` |
| `academic.analysis` | `export` | N | N | TBD | TBD | Y | Y | 导出权限需严格控制 |
| `notice` | `read` | Y | Y | Y | Y | Y | Y | 公告查看 |
| `notice` | `create` | N | N | TBD | TBD | Y | Y | 发布链路待确认 |
| `notice` | `publish` | N | N | TBD | TBD | Y | Y | 待确认 |
| `import.task` | `create` | N | N | N | N | Y | Y | 管理端能力 |
| `import.task` | `read` | N | N | TBD | TBD | Y | Y | 是否允许查看导入结果待确认 |
| `export.task` | `create` | N | N | TBD | TBD | Y | Y | 导出任务 |
| `export.task` | `read` | N | N | TBD | TBD | Y | Y | 是否允许查看导出历史待确认 |
| `audit.log` | `read` | N | N | N | N | TBD | Y | 建议仅少数角色可看 |

## 11. 第一批关键权限点建议

> 这些权限点可作为后端权限常量、前端按钮控制和接口文档中的“权限要求”起点。

| 权限点 | 含义 | 建议角色 |
| --- | --- | --- |
| `auth.session.create` | 用户登录 | 全角色 |
| `user.profile.read.self` | 查看本人信息 | `student` 及以上 |
| `party.process.read.self` | 查看本人党团流程 | `student` |
| `party.process.read.class` | 查看班级党团流程 | `class_cadre` / `counselor`（待确认） |
| `party.process.read.college` | 查看学院党团流程 | `college_admin` |
| `party.process.approve.class` | 班级范围审批 | `counselor`（待确认） |
| `party.process.approve.college` | 学院范围审批 | `college_admin` |
| `academic.analysis.create.self` | 发起本人学业分析 | `student` |
| `academic.analysis.read.self` | 查看本人分析结果 | `student` |
| `academic.analysis.read.college` | 查看学院分析结果 | `teacher` / `college_admin`（待确认） |
| `academic.analysis.export.college` | 导出学院分析数据 | `college_admin` |
| `audit.log.read.all` | 查看全局审计日志 | `system_admin` |

## 12. 接口与权限映射模板

后续可按接口维度持续补充，避免“接口写了但没写权限要求”。

| 接口 | 方法 | 权限点 | 数据范围 | 说明 | issue |
| --- | --- | --- | --- | --- | --- |
| `/api/auth/login` | `POST` | `auth.session.create` | 匿名 | 登录接口 | 待补 |
| `/api/auth/me` | `GET` | `user.profile.read.self` | `self` | 获取当前用户信息 | 待补 |
| `/api/auth/permissions` | `GET` | 已登录 | `self` | 返回角色和权限集合 | 待补 |
| `/api/party/processes` | `GET` | `party.process.read.*` | `self / class / college / all` | 按角色决定范围 | 待补 |
| `/api/academic/transcript/analyze` | `POST` | `academic.analysis.create.self` | `self` | 学生上传分析 | 待补 |
| `/api/admin/audit-logs` | `GET` | `audit.log.read.all` 或学院级权限 | `college / all` | 待细化 | 待补 |

## 13. 审查清单

- 是否只在前端限制按钮，却没有后端鉴权
- 是否把查询权限和导出权限混为一谈
- 是否遗漏了数据范围限制
- 是否存在“班级角色能看到全院数据”的越权风险
- 是否把审计日志、导入导出等敏感能力开放过宽
- 是否在接口文档中同步标注权限要求

## 14. 待确认事项

- 最终角色集合是否只保留 5 到 6 个核心角色
- 是否需要把学生干部与班团骨干拆成不同角色
- 辅导员、教师、学院管理员的数据范围边界如何划分
- 审批链各节点分别对应哪些角色
- 导入、导出、日志查看是否需要单独更细粒度权限
- 是否需要支持用户多角色并存

## 15. 变更记录

| 日期 | 变更内容 | 处理人 | 关联 issue / PR |
| --- | --- | --- | --- |
| 2026-04-18 | 新增 RBAC 初版模板、角色清单、权限矩阵骨架，并补充会前讨论清单与当前使用方式 | Codex | 待补 |
