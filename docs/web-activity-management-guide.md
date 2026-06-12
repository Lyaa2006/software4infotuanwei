# Web 端班团活动管理指南

## 入口和角色

网页端班团活动管理入口为 `/activity`。

不同角色看到的内容不同：

- 普通学生：查看自己参与的已通过活动。
- 班团骨干：创建、编辑、删除自己的活动提案。
- 管理员：审核活动提案，并维护学生的“班团骨干”标签。

管理员账号可以管理学生活动数据，但管理员账号本身不会被当作学生参与人或骨干设置对象。

## 学生账号范围

活动参与人、组织者、协助者和骨干设置对象都必须是真实学生账号。真实学生账号以服务端 `permitted_accounts` 权限清单为准。

如果手动填写管理员账号、禁用账号或不存在于学生权限清单中的账号，后端会拒绝活动创建或编辑请求。

## 创建活动提案

班团骨干可以在页面下方创建活动提案。提案字段包括：

- 活动标题
- 活动日期
- 活动摘要
- 目标标签
- 组织者
- 参与者
- 协助者
- 活动照片

参与人账号支持用逗号、空格或换行分隔。保存时后端会逐个校验参与人是否是真实学生。

## 编辑活动提案

待审核或已驳回的提案可以编辑。已通过审核的活动不可编辑。

编辑后，提案会重新进入待审核状态，相关审核记录和驳回记录会按现有后端逻辑清理。

## 删除活动提案

“班团骨干申请 / 我的提案”列表中，可编辑项会显示红色“删除”按钮。

删除规则：

1. 只有提案创建者可以删除。
2. 创建者必须仍是学生账号。
3. 创建者必须仍拥有“班团骨干”标签。
4. 已审核通过的活动不可删除。
5. 删除前页面会弹出确认提示。
6. 删除成功后列表会立即刷新。

前端删除按钮只是展示和确认控制；最终权限由后端删除接口判断。

## 删除失败怎么办

如果删除失败，请检查：

- 当前账号是否是提案创建者。
- 当前账号是否仍是班团骨干。
- 活动是否已经审核通过。
- 后端服务是否正常。
- 浏览器是否还使用有效登录 token。

## 管理员审核

管理员可以在“待审核活动”区域预览、通过或驳回提案。审核功能保持原有接口语义不变。

管理员不能通过学生侧删除接口删除学生提案。若已通过活动需要更正，应按后续管理流程处理，而不是绕过权限删除。

## 骨干设置

管理员可以在 `/activity` 学生列表中执行：

- 设为骨干
- 移除骨干

该列表只展示真实学生账号。骨干身份通过学生标签“班团骨干”维护。

## 和学生标签管理的关系

- `/tag-management` 负责集中维护学生标签。
- `/activity` 负责活动场景下维护“班团骨干”。
- 两者都只能作用于真实学生账号。
- 管理员账号不会出现在任一学生对象列表中。

## 人工验证摘要

1. 班团骨干创建待审核活动。
2. 待审核提案显示编辑和删除按钮。
3. 点击删除出现确认。
4. 确认后提案从列表消失。
5. 已通过活动不显示删除按钮或被后端拒绝删除。
6. 手填管理员账号作为参与人应被后端拒绝。
7. 管理员骨干设置列表不显示管理员账号。

## Current Web Behavior Notes

This section records the current activity management behavior after the recent Web updates.

### Activity page scope

- Activity management is available from the Web activity page, currently reached through the Dashboard activity entry.
- Existing create and edit flows should continue to use the current backend APIs.
- The set/remove cadre function must remain available. It is not replaced by Student Tag Management.

### Cadre setting and student tags

- Cadre setting is an activity-management operation.
- Student Tag Management is the general place for maintaining student tags.
- Both areas may depend on student account scope, but they serve different workflows.
- Admin accounts must not appear as student/cadre candidates.

### Activity deletion

The Web page now provides a deletion entry for editable activity records.

Expected behavior:

- A delete action should only appear for records that the current user can edit/delete according to existing rules.
- The page should ask for confirmation before deletion.
- Cancelling the confirmation should keep the list unchanged.
- Confirming deletion should refresh the list immediately.
- Refreshing the page should keep the deleted record removed.

Deletion should be rejected or unavailable when:

- The activity has already been approved.
- The current user is not the creator or does not satisfy the current backend permission rule.
- The current user is not allowed to manage that activity record.

### Participant account scope

- Organizers, helpers, and participants should be real student accounts when the field represents student participants.
- Admin accounts should not be accepted as student activity participants.
- Frontend filtering helps the UI, but backend validation must still reject invalid participant accounts.

### Troubleshooting

- If the delete button is missing, check whether the record is editable by the current user.
- If deletion fails, check whether the record is approved, owned by another user, or blocked by permission rules.
- If a non-student account can be saved as a participant or cadre, treat it as a student-scope protection bug.
- If set/remove cadre disappears, treat it as a regression because the feature should remain available.
