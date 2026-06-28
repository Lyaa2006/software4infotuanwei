# Web Test and Acceptance Checklist

This checklist is for manual regression testing before a demo, review, or merge. It focuses on current Web behavior and recent fixes. Use test data whenever an action may create, update, or delete records.

## 1. Login and Basic Navigation

- Log in with a valid student account.
- Log in with a valid admin account.
- Try an invalid or disabled account and confirm the failure message is clear.
- Confirm the Dashboard loads after login.
- Confirm main feature cards route to the expected pages.
- Confirm subpages with a return-home button can navigate back to the Dashboard.

## 2. Permission and Data Scope

- Admin can access admin pages.
- Student cannot perform admin-only operations unless existing rules allow it.
- Admin accounts do not appear as student records in student-only lists.
- Disabled or non-student accounts are rejected when used as student targets.
- Browser console should not show unhandled errors during these flows.

## 3. Student Tag Management

- Open /tag-management as an admin.
- Confirm only real student accounts appear.
- Confirm admin accounts do not appear in the list.
- Edit tags for a real student and save.
- Clear tags for a real student and save.
- Refresh the page and confirm saved tags remain correct.
- Bypass the page and try saving tags for an admin account through the API; it should be rejected.

## 4. Reminder Tag Sending

- Open /reminder.
- Confirm notice history still displays.
- Confirm tag chips or tag input are based on real student tags.
- Send a notice to all recipients.
- Send a notice by selected tags.
- Confirm Reminder does not provide student tag editing; tag maintenance should happen in /tag-management.

## 5. Activity Management

- Open /activity.
- Create an activity with valid student participant data.
- Edit an existing editable activity.
- Confirm set/remove cadre still works for real students.
- Confirm admin accounts do not appear in student/cadre candidate lists.
- Try to submit an admin account as an activity participant; it should be rejected.

## 6. Activity Deletion

- Create an unapproved activity as a user allowed by current rules.
- Confirm editable records show a delete action.
- Click delete and cancel the confirmation; the item should remain.
- Click delete and confirm; the list should refresh and the item should disappear.
- Refresh the page and confirm the deletion persists.
- Try deleting an approved activity; it should be rejected or unavailable.
- Try deleting another user's activity; it should be rejected or unavailable.
- Try deleting as a user without the required permission; it should be rejected or unavailable.

## 7. Party Process Date Validation

Use a real student record in the party admin edit page.

- Save valid historical dates and confirm display is stable after refresh.
- Enter an invalid date string; it should be rejected.
- Enter a future date for a historical party stage; it should be rejected.
- Enter dates out of stage order; it should be rejected.
- Confirm previous date offset issues do not reappear after save and reload.

## 8. Party Admin Student List

- Open /party/admin/list as an admin.
- Confirm the toolbar shows the student count.
- Confirm refresh works.
- Confirm add/edit student prompts for an account id and routes to the edit page.
- Confirm each row shows account id, name, party stage, tags, reminder nodes, and edit action when data exists.
- Confirm empty tags display a clear empty label.
- Confirm admin accounts do not appear as student rows.
- Check the page on a narrow viewport; rows should remain readable without page-level horizontal overflow.

## 9. UI Smoke Check

- Dashboard copy should be user-facing, not development-facing.
- Cards, buttons, hover states, and spacing should look consistent with the rest of the Web client.
- Important text should not overflow buttons or cards on narrow screens.
- No page should show raw implementation notes such as route preservation or jump path comments as user-facing copy.

## Acceptance Record Template

- Environment:
- Tester:
- Date:
- Login/navigation: pass / fail, notes:
- Permission/data scope: pass / fail, notes:
- Tag management: pass / fail, notes:
- Reminder: pass / fail, notes:
- Activity create/edit/cadre/delete: pass / fail, notes:
- Party date validation: pass / fail, notes:
- Party admin list UI: pass / fail, notes:
- Remaining issues:
