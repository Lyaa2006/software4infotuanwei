# 初始文件结构

当前仓库处于未正式开工阶段，建议先采用以下最小结构，便于后续分工、扩展和环境统一。

```text
.
├── .env.example              # 环境变量模板
├── .gitignore                # Git 忽略规则
├── docs/                     # 项目文档
│   ├── api/                  # 接口文档
│   ├── git-flow-collaboration.md
│   ├── rbac-matrix.md        # 角色与权限讨论/沉淀文档
│   └── project-structure.md
├── frontend/                 # 前端代码
├── backend/                  # 后端代码
├── database/                 # 数据库相关文件
│   └── migrations/           # 迁移脚本
├── scripts/                  # 本地脚本、初始化脚本
├── deploy/                   # Docker / 部署配置
└── tests/                    # 测试代码
```

## 待填环境变量

以下变量当前只是占位，后续需要由团队统一后填入：

- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SCHEMA`
- `MAIL_HOST`
- `MAIL_PORT`
- `MAIL_USER`
- `MAIL_PASSWORD`
- `SMS_PROVIDER`
- `SMS_API_KEY`

## 当前约定

- 前后端分离，代码分别进入 `frontend/` 和 `backend/`
- 数据库迁移脚本统一进入 `database/migrations/`
- 环境变量模板统一维护在 `.env.example`
- 本地真实配置只写入 `.env`，不提交到 Git
- 正式商量接口前，先在 `docs/api/api-spec.md` 整理第一批接口讨论项
- 正式商量权限前，先在 `docs/rbac-matrix.md` 整理角色、数据范围和资源操作讨论项
- 前端开工前先看接口清单和 RBAC 讨论项，不要在代码里自行定义最终契约
