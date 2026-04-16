# 初始文件结构

当前仓库处于未正式开工阶段，建议先采用以下最小结构，便于后续分工、扩展和环境统一。

```text
.
├── .env.example              # 环境变量模板
├── .gitignore                # Git 忽略规则
├── docs/                     # 项目文档
│   ├── api/                  # 接口文档
│   ├── git-flow-collaboration.md
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
