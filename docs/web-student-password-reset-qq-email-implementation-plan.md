# 网页端学生密码重置 QQ 邮箱验证码实现规划

## 1. 背景

当前 `test-smtp.js` 已经跑通，说明使用 QQ 邮箱 SMTP 可以完成系统发信。下一步可将网页端学生“忘记密码”流程从“直接重置密码”升级为“邮箱验证码校验后重置密码”。

本规划仅覆盖网页端学生密码重置验证码功能，小程序端暂不处理。

## 2. 当前基础

现有能力：

1. 网页端已有登录页“忘记密码？”入口。
2. 网页端已有重置密码页面 `/reset-password`。
3. 学生登录后可从个人主页进入重置密码页。
4. 后端已有最简重置密码接口 `POST /api/auth/reset-password`。
5. 邮箱规则已知：学生邮箱为 `学号@ruc.edu.cn`。
6. QQ 邮箱 SMTP 已通过 `test-smtp.js` 验证可用。

需要改造的核心点：

1. 增加发送验证码接口。
2. 增加验证码校验并重置密码接口。
3. 前端重置密码页增加验证码输入和发送按钮。
4. 上线后移除或停用“只凭学号直接重置密码”的旧逻辑。

## 3. 服务器 `.env` 放置路径

### 3.1 当前测试脚本读取位置

`test-smtp.js` 位于项目根目录，并使用：

```js
require("dotenv").config()
```

因此，如果在项目根目录执行：

```bash
cd ~/software4infotuanwei
node test-smtp.js
```

它默认读取的是：

```bash
~/software4infotuanwei/.env
```

### 3.2 正式后端读取位置

后端入口 `server/index.js` 也使用：

```js
require("dotenv").config()
```

`dotenv` 默认读取当前进程工作目录下的 `.env`。服务器上通常是在 `server/` 目录启动后端：

```bash
cd ~/software4infotuanwei/server
npm start
```

因此正式部署时，后端应读取：

```bash
~/software4infotuanwei/server/.env
```

这也是推荐放置路径。

### 3.3 systemd 或 pm2 场景

如果使用 systemd，建议设置：

```ini
WorkingDirectory=/home/user/software4infotuanwei/server
```

此时 `.env` 放在：

```bash
/home/user/software4infotuanwei/server/.env
```

如果使用 pm2，建议从 `server/` 目录启动，或显式指定工作目录：

```bash
cd ~/software4infotuanwei/server
pm2 start index.js --name software4infotuanwei-server
```

### 3.4 推荐 `.env` 配置项

建议后端统一使用 `SMTP_*` 命名，和 `test-smtp.js` 保持一致：

```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ邮箱地址
SMTP_PASS=你的QQ邮箱SMTP授权码
SMTP_FROM="softwareinfotuanwei系统通知 <你的QQ邮箱地址>"

PASSWORD_RESET_CODE_EXPIRES_MINUTES=5
PASSWORD_RESET_SEND_INTERVAL_SECONDS=60
PASSWORD_RESET_DAILY_LIMIT=10
PASSWORD_RESET_MAX_FAILS=5
```

注意事项：

1. `SMTP_PASS` 应填写 QQ 邮箱生成的 SMTP 授权码，不是 QQ 登录密码。
2. `.env` 已在 `.gitignore` 中忽略，不应提交到仓库。
3. 如果授权码曾经暴露在聊天、截图或仓库中，建议在 QQ 邮箱后台重新生成授权码。

## 4. 验证码生成方案

### 4.1 验证码形式

推荐使用 6 位数字验证码：

```text
000000 - 999999
```

实际生成时应避免手写 `Math.random()`，推荐使用 Node.js `crypto.randomInt`：

```js
const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0")
```

原因：

1. `crypto.randomInt` 适合生成安全随机数。
2. 6 位数字对用户输入友好。
3. 有效期和限流配合后，安全性满足当前找回密码场景。

### 4.2 验证码有效期

推荐默认值：

```text
5 分钟
```

对应环境变量：

```env
PASSWORD_RESET_CODE_EXPIRES_MINUTES=5
```

### 4.3 验证码存储

不建议明文保存验证码。推荐保存验证码哈希：

```js
code_hash = HMAC_SHA256(TOKEN_SECRET, `${role}:${accountId}:${code}`)
```

优点：

1. 数据库泄露时不能直接获得验证码。
2. 校验时重新计算哈希即可比对。
3. 不需要额外保存明文验证码。

### 4.4 验证码一次性使用

规则：

1. 同一学号每次发送新验证码时，旧验证码作废。
2. 验证码校验成功后立即标记为已使用。
3. 已使用验证码不能再次用于重置密码。
4. 过期验证码不能继续使用。

## 5. 数据库表设计

建议新增表：

```sql
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGSERIAL PRIMARY KEY,
  role VARCHAR(32) NOT NULL,
  account_id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  code_hash VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  fail_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_account
  ON password_reset_codes(role, account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email
  ON password_reset_codes(email, created_at DESC);
```

说明：

1. `role` 当前只允许 `student`。
2. `account_id` 存学号。
3. `email` 存最终收件地址，即 `学号@ruc.edu.cn`。
4. `code_hash` 存验证码哈希。
5. `fail_count` 用于限制错误尝试次数。

## 6. 后端接口规划

### 6.1 发送验证码接口

接口：

```http
POST /api/auth/reset-password/send-code
```

请求体：

```json
{
  "role": "student",
  "accountId": "2024201575"
}
```

处理流程：

1. 校验 `role` 必须为 `student`。
2. 校验 `accountId` 不能为空。
3. 校验学号是否在 `permitted_accounts` 中且启用。
4. 生成收件邮箱：`accountId + "@ruc.edu.cn"`。
5. 检查发送频率限制。
6. 作废该学号旧的未使用验证码。
7. 生成 6 位数字验证码。
8. 保存验证码哈希和过期时间。
9. 使用 QQ SMTP 发送邮件。
10. 返回发送成功。

成功响应：

```json
{
  "success": true,
  "message": "验证码已发送"
}
```

错误场景：

1. 学号为空。
2. 学号不在许可名单中。
3. 发送过于频繁。
4. 今日发送次数达到上限。
5. SMTP 发信失败。

### 6.2 校验验证码并重置密码接口

接口：

```http
POST /api/auth/reset-password/by-code
```

请求体：

```json
{
  "role": "student",
  "accountId": "2024201575",
  "code": "123456",
  "newPassword": "new-password",
  "confirmPassword": "new-password"
}
```

处理流程：

1. 校验 `role` 必须为 `student`。
2. 校验学号和密码字段。
3. 查询该学号最新一条未使用验证码。
4. 校验验证码是否过期。
5. 校验错误次数是否超限。
6. 使用同样的 HMAC 规则计算验证码哈希并比对。
7. 验证失败时增加 `fail_count`。
8. 验证成功后更新 `users.password_hash` 和 `users.salt`。
9. 将验证码标记为已使用。
10. 返回重置成功。

成功响应：

```json
{
  "success": true,
  "message": "密码重置成功"
}
```

## 7. 邮件发送模块规划

建议新增后端模块：

```text
server/mail.js
```

职责：

1. 读取 `SMTP_*` 环境变量。
2. 创建 nodemailer transporter。
3. 提供 `sendPasswordResetCode({ to, accountId, code, expiresMinutes })`。
4. 屏蔽 SMTP 细节，路由层只关心发送结果。

需要新增依赖：

```bash
cd ~/software4infotuanwei/server
npm install nodemailer
```

邮件标题建议：

```text
学生服务平台密码重置验证码
```

邮件正文建议：

```text
您好：

您正在进行学生服务平台密码重置操作。

学号：2024201575
验证码：123456

验证码 5 分钟内有效，请勿泄露给他人。

如非本人操作，请忽略此邮件。
```

安全要求：

1. 日志中不要打印验证码。
2. 日志中不要打印 `SMTP_PASS`。
3. 发送失败时只记录错误类型，不记录授权码。

## 8. 前端页面规划

改造页面：

```text
webpage/src/pages/ResetPassword.jsx
```

新增交互：

1. 学号输入框。
2. “发送验证码”按钮。
3. 验证码输入框。
4. 新密码输入框。
5. 确认新密码输入框。
6. “确认重置密码”按钮。

交互规则：

1. 学号为空时不能发送验证码。
2. 发送成功后按钮进入倒计时，例如 `60s 后重新发送`。
3. 重置密码前必须填写验证码。
4. 两次密码必须一致。
5. 重置成功后清除登录态并跳转登录页。
6. 从个人主页进入时继续保留“返回个人主页”和“返回首页”。
7. 从登录页忘记密码进入时不显示“返回首页”。

## 9. 旧接口处理策略

当前旧接口：

```http
POST /api/auth/reset-password
```

上线邮箱验证码后，建议处理方式：

1. 登录前忘记密码流程改用 `/api/auth/reset-password/by-code`。
2. 旧接口不再暴露给登录前用户直接使用。
3. 若保留旧接口，只允许已登录学生从个人主页发起，且后续应增加旧密码校验。

推荐上线第一阶段：

1. 前端不再调用旧接口。
2. 后端旧接口临时保留，但增加明显注释和后续下线计划。

推荐稳定后：

1. 删除旧的无验证码重置入口。
2. 后端旧接口改为仅登录态可用，或直接移除。

## 10. 限流策略

推荐默认值：

1. 同一学号发送间隔：`60` 秒。
2. 同一学号每日发送上限：`10` 次。
3. 同一验证码最大错误次数：`5` 次。
4. 验证码有效期：`5` 分钟。

建议后端同时按以下维度限制：

1. `account_id`
2. `email`
3. 请求 IP

当前最小可实现版本至少应按 `account_id` 限制。

## 11. 实施步骤

### 第一阶段：依赖与配置

1. 在 `server/package.json` 增加 `nodemailer`。
2. 在服务器 `~/software4infotuanwei/server/.env` 增加 `SMTP_*` 配置。
3. 在服务器从 `server/` 目录启动后端，确认后端可以读取 `.env`。

### 第二阶段：数据库

1. 新增 `password_reset_codes` 表。
2. 在服务启动初始化逻辑中增加建表语句，或单独执行 SQL 迁移。
3. 确认线上数据库表创建成功。

### 第三阶段：后端接口

1. 新增邮件发送模块。
2. 新增验证码生成和哈希函数。
3. 新增发送验证码接口。
4. 新增验证码校验并重置密码接口。
5. 增加频率限制和错误次数限制。

### 第四阶段：网页端

1. 改造重置密码页面。
2. 新增发送验证码按钮和倒计时。
3. 对接新接口。
4. 停止调用旧的直接重置接口。

### 第五阶段：上线与回归

1. 构建并部署网页端。
2. 重启后端。
3. 使用测试学号发送验证码。
4. 验证邮箱收到验证码。
5. 使用正确验证码重置密码。
6. 使用旧密码登录失败，新密码登录成功。

## 12. 验收用例

1. 合法学号可收到验证码邮件。
2. 非法学号不能发送验证码。
3. 同一学号 60 秒内重复发送会被拦截。
4. 错误验证码不能重置密码。
5. 过期验证码不能重置密码。
6. 验证码连续错误 5 次后作废。
7. 正确验证码可重置密码。
8. 重置成功后旧密码失效。
9. 重置成功后新密码可登录。
10. 日志中不出现明文验证码和 SMTP 授权码。

## 13. 当前结论

基于 `test-smtp.js` 已跑通的结果，QQ 邮箱验证码方案可以进入实现阶段。

关键部署点是：正式后端的 `.env` 应放在 `~/software4infotuanwei/server/.env`，并确保后端进程的工作目录是 `~/software4infotuanwei/server`。
