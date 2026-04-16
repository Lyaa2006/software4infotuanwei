# Git 协作规范与操作流程

本文档统一规定本项目的 Git 分支策略、Commit 提交规范和 Pull Request（PR）提交流程，适用于团队全体成员。目标是降低多人并行开发时的合并冲突、权限误改、接口不一致和数据库变更失控等问题，保证项目始终保留一个可演示、可交付、可回退的稳定版本。

## 1. 适用范围

本规范适用于以下开发内容：

- 前端页面与组件开发
- 后端接口与业务逻辑开发
- 权限系统与审批流开发
- Kingbase 数据库表结构与脚本变更
- 文件导入导出、日志审计、消息推送等公共能力开发
- 文档、测试、部署脚本及配置模板维护

## 2. Git Flow 分支模型

项目统一采用 Git Flow 分支模型。

### 2.1 分支类型与职责

#### `main`

- 仅存放经过严格测试、可随时部署、可用于课程展示或阶段验收的稳定版本。
- 禁止直接在 `main` 上开发。
- 禁止未经 PR 审核直接推送到 `main`。
- 每次合并到 `main` 都应对应一个明确的里程碑版本。

#### `develop`

- 作为开发主分支，承接当前阶段已完成并通过联调的功能。
- 所有 `feature/*` 分支最终汇总到 `develop`。
- 日常联调、集成测试、阶段性验收前检查都以 `develop` 为准。

#### `feature/*`

- 每个核心模块或明确功能点单独创建一个功能分支。
- 功能完成后通过 PR 合并回 `develop`。
- 不同模块不得共用一个 `feature` 分支，避免职责混杂。

推荐命名格式：

- `feature/auth-login`
- `feature/party-process`
- `feature/academic-analysis`
- `feature/admin-import-export`

#### `hotfix/*`

- 用于修复已经进入 `main` 的紧急问题，例如演示阻塞、权限泄漏、关键接口故障、数据库脚本错误等。
- 修复完成后应优先合并回 `main`，并同步合并回 `develop`，避免后续开发覆盖修复结果。

推荐命名格式：

- `hotfix/login-permission-bug`
- `hotfix/pdf-export-failure`

### 2.2 分支保护要求

- `main` 和 `develop` 均禁止直接提交。
- 所有合并必须通过 PR。
- PR 合并前至少由 1 名其他成员完成 Review。
- 涉及权限、数据库结构、公共接口、日志审计逻辑的改动，必须明确标注并重点审查。

## 3. 分支使用规定

### 3.0 仓库初始化命令

现在已建立默认主分支 `main` 和分支 `develop`

先查看当前分支：

```bash
git branch
```

执行完成后，团队日常开发统一从 `develop` 拉出 `feature/*` 分支。

### 3.1 创建功能分支  `feature/*` 前

开始开发前，先同步远程分支，确保本地基线最新。

示例：

```bash
git checkout develop
git pull origin develop
git checkout -b feature/party-process
```

每次开发新功能，都从 `develop` 拉分支 `feature/*`，不要直接从 `main` 拉。

例如开发“党团流程”模块新拉取分支：

```bash
git checkout develop
git pull origin develop
git checkout -b feature/party-process 
```

如果是第一次把该功能分支推送到远程，建议使用：

```bash
git push -u origin feature/party-process
```

然后去 GitHub：

  1. 创建 PR：feature/xxx -> develop
  2. Review 后合并到 develop
  3. 到阶段版本时，再创建 PR：develop -> main

### 3.2 功能开发过程中

- 只在自己的功能分支上提交代码。
- 小步提交，不要积攒数天后一次性提交。
- 每次提交只解决一个相对明确的问题。
- 若开发周期较长，应定期同步 `develop` 最新代码。

示例：

```bash
git checkout develop
git pull origin develop
git checkout feature/party-process
git merge develop
```

若团队决定使用变基，也可统一改为 `rebase`，但全组必须保持一致；若没有统一约定，默认使用 `merge`，降低误操作风险。

### 3.3 功能开发完成后

功能完成后，不直接向 `develop` 推送覆盖，而是：

1. 自测
2. 补充文档或接口说明
3. 推送远程分支
4. 发起 PR 到 `develop`

示例：

```bash
git add .
git commit -m "feat(party): 新增入党流程阶段查询接口"
git push origin feature/party-process
```

### 3.4 紧急修复流程

若线上演示版本或 `main` 所代表的稳定版本出现严重问题，应从 `main` 拉出 `hotfix/*` 分支。

示例：

```bash
git checkout main
git pull origin main
git checkout -b hotfix/login-permission-bug
git push -u origin hotfix/login-permission-bug
```

修复后流程：

1. 在 `hotfix/*` 中完成修复和自测
2. 发起 PR 合并到 `main`
3. 合并完成后，再发起 PR 或同步到 `develop`

如果已经进入演示版或稳定版的 `main` 有严重问题，就按这个流程创建热修复分支，不要从 `develop` 直接修。

## 4. 团队日常管理模式

建议团队固定采用以下模式：

1. `main`
只放可演示、可交付、稳定版本。

2. `develop`
作为日常集成分支，所有功能最后都合到这里。

3. `feature/*`
每个人、每个模块单独开分支开发。

4. `hotfix/*`
只处理已经进入 `main` 的紧急问题。

5. 不允许直接往 `main` 和 `develop` 提交
统一走 PR。

6. 每个 PR 至少 1 人 Review
尤其重点看权限、数据库、接口。

## 5. 功能分支拆分原则

分支拆分要以“模块边界清晰、可独立 Review、可独立测试”为原则，不要以“谁今天想写什么”来命名分支。

### 5.1 推荐拆分方式

- 按业务模块拆分：`feature/party-process`
- 按系统能力拆分：`feature/rbac-permission`
- 按后台模块拆分：`feature/admin-audit-log`
- 按数据处理模块拆分：`feature/excel-import`

### 5.2 不推荐的命名

- `feature/test`
- `feature/aaa`
- `feature/fix1`
- `feature/liyianan-work`

这些命名无法体现功能边界，不利于后续排查、Review 和版本追踪。

### 5.3 推荐分支命名

尽量统一使用英文短名，保持可读、可检索、可扩展。

推荐示例：

- `feature/auth-login`
- `feature/party-process`
- `feature/academic-analysis`
- `feature/admin-dashboard`
- `feature/import-export`
- `hotfix/permission-export-bug`

## 6. Commit 提交规范

项目统一使用如下格式：

```text
type(scope): 描述
```

例如：

```text
feat(auth): 新增教师登录鉴权
fix(permission): 修复班团骨干越权查看全院数据问题
refactor(api): 拆分通知推送服务层逻辑
docs(git): 补充 Git 协作规范
test(academic): 增加学分分析接口测试
chore(deps): 升级前端依赖版本
```

### 6.1 type 定义

- `feat`：新增功能
- `fix`：修复缺陷
- `refactor`：重构代码但不新增功能、不修复外部可见缺陷
- `docs`：文档变更
- `test`：测试代码或测试配置变更
- `chore`：构建、依赖、脚本、配置等杂项维护

### 6.2 scope 定义

`scope` 用于标识影响范围，建议填写模块名或子系统名。

推荐写法：

- `auth`
- `party`
- `academic`
- `admin`
- `notice`
- `db`
- `audit`
- `import`
- `export`

### 6.3 描述要求

- 使用简洁中文，直接说明本次变更结果。
- 不写“修改一下”“更新代码”“提交”“最终版”等无意义描述。
- 优先写用户可感知或系统层面的具体变化。

推荐：

- `feat(export): 新增学生荣誉信息批量导出功能`
- `fix(db): 修复 Kingbase 分页查询语法错误`

不推荐：

- `fix: 改 bug`
- `feat: 更新`
- `docs: 最终修改`

### 6.4 提交粒度要求

- 一个 Commit 尽量只做一类事情。
- 不要把“接口修改 + 数据库改表 + 页面重构 + 文档更新”混成一个提交。
- 若涉及数据库迁移，Commit 信息中最好能体现数据库影响。

示例：

```bash
git add src/modules/auth src/routes/auth.ts
git commit -m "feat(auth): 新增教师登录鉴权"
```

```bash
git add db/migrations docs/api-spec.md
git commit -m "feat(db): 新增活动审核状态字段及迁移脚本"
```

## 7. Pull Request 规范

所有合并都必须通过 PR，禁止“口头说明后直接合并”。

### 7.1 PR 标题规范

建议沿用 Commit 风格，便于列表查阅。

示例：

- `feat(party): 完成入党流程查询与提醒功能`
- `fix(permission): 修复管理员导出权限判断错误`
- `docs(git): 新增团队 Git 协作规范`

### 7.2 PR 必填内容

每个 PR 至少说明以下内容：

1. 改了什么
2. 影响哪些模块
3. 是否涉及权限控制
4. 是否修改数据库
5. 是否修改接口
6. 如何测试
7. 是否需要截图或录屏
8. 风险点与注意事项

### 7.3 PR 描述模板

发起 PR 时建议统一使用以下模板：

```md
## 一、改动概述
- 本次完成：
- 主要目标：

## 二、影响范围
- 前端模块：
- 后端模块：
- 数据库：
- 文档：

## 三、权限影响
- 是否涉及权限控制：是 / 否
- 涉及角色：
- 变更说明：

## 四、数据库影响
- 是否修改数据库：是 / 否
- 涉及表：
- 是否附迁移脚本：是 / 否
- 是否影响历史数据：

## 五、接口影响
- 是否修改接口：是 / 否
- 新增接口：
- 修改接口：
- 是否更新接口文档：是 / 否

## 六、测试说明
- 本地测试内容：
- 测试结果：
- 未覆盖部分：

## 七、截图或录屏
- 页面截图 / 接口结果 / 录屏链接：

## 八、风险与备注
- 风险点：
- 合并注意事项：
```

## 7. PR 审核重点

Review 不能只看“代码能不能运行”，还要重点检查以下内容：

### 7.1 通用检查项

- 是否从正确分支发起合并
- 分支目标是否正确（通常是 `develop`）
- Commit 信息是否规范
- 是否存在调试代码、无关改动、临时文件
- 是否修改了不属于本任务的内容

### 7.2 权限相关检查项

- 是否存在越权访问风险
- 前端是否只做展示限制，后端是否真正做了权限校验
- 不同角色的数据范围是否正确隔离
- 导出、审批、日志查看是否受权限控制

### 7.3 数据库相关检查项

- 是否附带迁移脚本
- 是否说明对 Kingbase 的兼容性影响
- 是否会破坏已有数据
- 是否涉及索引、唯一约束、字段默认值等潜在风险

### 7.4 接口相关检查项

- 返回结构是否与前端约定一致
- 错误码和异常提示是否统一
- 是否更新接口文档
- 是否影响已有调用方

## 8. 标准开发流程示例

以下示例展示一个完整的功能开发流程。

### 场景：开发“学业分析”模块中的成绩单解析功能

#### 第一步：从 `develop` 拉取最新代码并新建分支

```bash
git checkout develop
git pull origin develop
git checkout -b feature/academic-analysis
```

#### 第二步：在功能分支开发并小步提交

```bash
git add .
git commit -m "feat(academic): 新增成绩单上传接口"

git add .
git commit -m "feat(academic): 增加培养方案学分比对逻辑"

git add .
git commit -m "test(academic): 补充成绩单解析测试用例"
```

#### 第三步：同步 `develop` 最新代码

```bash
git checkout develop
git pull origin develop
git checkout feature/academic-analysis
git merge develop
```

#### 第四步：推送远程并发起 PR

```bash
git push origin feature/academic-analysis
```

PR 标题示例：

```text
feat(academic): 完成成绩单解析与学分比对基础功能
```

PR 描述示例：

```md
## 一、改动概述
- 完成成绩单上传、解析和学分比对基础逻辑
- 支持返回未修满模块列表

## 二、影响范围
- 前端模块：学业分析页面
- 后端模块：成绩单上传接口、学分分析服务
- 数据库：无
- 文档：已更新接口说明

## 三、权限影响
- 是否涉及权限控制：是
- 涉及角色：普通学生
- 变更说明：仅允许学生查看本人分析结果

## 四、数据库影响
- 是否修改数据库：否

## 五、接口影响
- 是否修改接口：是
- 新增接口：`POST /api/academic/transcript/analyze`
- 是否更新接口文档：是

## 六、测试说明
- 本地测试内容：正常上传、空文件上传、格式错误文件上传
- 测试结果：通过
- 未覆盖部分：大文件压测未完成

## 七、截图或录屏
- 已附页面截图和接口返回示例

## 八、风险与备注
- 当前仅支持固定模板成绩单解析
```

#### 第五步：Review 通过后合并到 `develop`

合并后，分支可以删除。

```bash
git branch -d feature/academic-analysis
git push origin --delete feature/academic-analysis
```

## 9. 紧急修复流程示例

### 场景：演示前发现管理员可以误导出不应导出的学生敏感信息

#### 第一步：从 `main` 创建热修复分支

```bash
git checkout main
git pull origin main
git checkout -b hotfix/export-permission-bug
```

#### 第二步：修复并提交

```bash
git add .
git commit -m "fix(permission): 修复管理员敏感数据导出越权问题"
git push origin hotfix/export-permission-bug
```

#### 第三步：发起 PR 到 `main`

PR 合并后，再将修复同步回 `develop`，避免后续开发分支把问题重新带回去。

## 10. 禁止事项

- 禁止直接在 `main` 上开发
- 禁止不经 PR 直接合并到 `develop`
- 禁止使用无意义 Commit 信息
- 禁止把多个无关功能混在一个分支中开发
- 禁止提交敏感配置、数据库账号密码、本地缓存文件
- 禁止在未说明数据库影响的情况下直接修改表结构
- 禁止未经说明直接修改公共接口返回格式

## 11. 团队执行建议

为保证规范真正落地，建议团队同步建立以下机制：

- 每个新任务先确认对应的 `feature/*` 分支名称
- 每个 PR 至少 1 人 Review 后再合并
- 涉及权限、数据库、接口的 PR 必须重点说明
- 每周至少做一次 `develop` 集成联调
- 每个阶段演示前，从 `develop` 合并出稳定版本进入 `main`

## 12. 推荐的常用命令清单

```bash
git checkout develop
git pull origin develop
git checkout -b feature/module-name

git add .
git commit -m "feat(module): 描述本次改动"
git push origin feature/module-name

git checkout main
git pull origin main
git checkout -b hotfix/bug-name
```
