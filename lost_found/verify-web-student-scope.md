# Web Student Scope and Activity Deletion Verification Checklist

This checklist is for manual regression testing. It contains no secrets, does not connect to production data by itself, and should not be used for destructive checks in production.

## Goals

- Admin, disabled, and non-student accounts must not appear as student management targets.
- Student tags, party progress, activity participants, and cadre settings must only apply to real student accounts.
- Frontend pages should defensively filter stale or dirty data.
- Backend APIs must still reject invalid student targets if the frontend is bypassed.
- Web activity deletion must have a clear entry, confirmation prompt, immediate refresh, and correct permission checks.

## Test Accounts and Data

1. One admin account.
2. At least two real student accounts.
3. One student account with the class cadre tag.
4. One normal student account without the class cadre tag.
5. Optional test data: a stale admin row in party_students.
6. Do not perform destructive deletion checks on production business data.

## Student Identity Rule

- A real student account should come from the server permission list: permitted_accounts.role = student and enabled = TRUE.
- party_students is only an extension table for party progress. It is not the source of truth for student accounts.
- Frontend filtering is only a display safeguard. Backend validation is the final protection.

## Tag Management

Entry points:

- Page: /tag-management
- API: PUT /api/reminder/admin/students/:accountId/tags

Steps:

1. Log in as an admin and open /tag-management.
2. Confirm the list only contains real student accounts.
3. Confirm admin accounts do not appear in the list and have no edit entry.
4. Add, edit, and clear tags for a real student account, then refresh and recheck.
5. Bypass the frontend and call the tag-save API for an admin account.

Expected results:

- Real student tags can be maintained normally.
- Admin accounts cannot be edited as student tag targets.
- Direct API calls for admin targets return NOT_STUDENT_ACCOUNT or another clear rejection message.
- Admin login and admin management permissions still work.

## Reminder Tag Sending

Entry points:

- Page: /reminder
- API: POST /api/reminder/admin/messages

Steps:

1. Open /reminder and inspect available tag chips.
2. Confirm available tags come from real student records only.
3. Send a reminder to all users.
4. Send a reminder by selecting one or more tags.
5. If manual tag input exists, combine manual input with selected chips and send once.

Expected results:

- Tag selection and tag-based sending still work.
- Existing reminder history still renders.
- Admin account dirty data does not affect available tags or student recipients.

## Party Admin Student List

Entry points:

- Page: /party-admin
- API: GET /api/party/admin/students

Steps:

1. Log in as an admin and open the party admin student list.
2. Search for or visually check the admin account.
3. If test data includes an admin row in party_students, refresh and check again.

Expected results:

- The list only contains real student accounts.
- Stale party_students rows do not make admin accounts appear as students.
- Real student party progress, labels, dates, and status fields still display.

## Party Progress Editing

Entry points:

- Page: /party-admin/:accountId
- API: GET /api/party/admin/students/:accountId
- API: PUT /api/party/admin/students/:accountId

Steps:

1. Open a real student edit page from the party admin list.
2. Edit and save party progress for the real student.
3. Directly open the edit route for an admin account.
4. Directly call the GET and PUT APIs for an admin account.

Expected results:

- Real student progress can be edited and saved.
- Admin accounts cannot have party student rows created or updated.
- Non-student targets return NOT_STUDENT_ACCOUNT or another clear rejection message.
- Existing date validation behavior is unchanged.

## Activity Cadre Settings

Entry points:

- Page: /activity
- Cadre setting APIs used by the page.

Steps:

1. Open /activity with an account that has permission to manage cadres.
2. Confirm the cadre candidate list only contains real student accounts.
3. Set a real student as cadre.
4. Remove the cadre tag from a real student.
5. Bypass the frontend and try to set an admin account as cadre.

Expected results:

- Real students can be set or removed as cadres.
- Admin accounts do not appear in the candidate list.
- Backend rejects cadre operations for non-student accounts.
- The existing set/remove cadre feature remains available.

## Activity Participant Validation

Entry points:

- Page: /activity
- Activity create and edit APIs used by the page.

Steps:

1. Create or edit an activity using real student accounts as organizers, helpers, or participants.
2. Try to manually enter an admin account as an organizer, helper, or participant.
3. Bypass the frontend and submit an admin account through the API.

Expected results:

- Real student participants can be saved.
- Admin accounts cannot be saved as student activity participants.
- Backend returns INVALID_ACTIVITY_PARTICIPANT, NOT_STUDENT_ACCOUNT, or another clear rejection message.

## Activity Deletion

Entry points:

- Page: /activity, in My Proposals or My Activities.
- API: DELETE /api/activity/cadre/:id or POST /api/activity/cadre/:id/delete.

Steps:

1. Log in as a class cadre student and create an unapproved activity.
2. Confirm editable items show a delete button.
3. Click delete and confirm that a confirmation prompt appears.
4. Cancel the prompt and confirm the list is unchanged.
5. Click delete again, confirm, and check that the list refreshes immediately.
6. Refresh the page and confirm the deleted item is still gone.
7. Try to delete an activity created by another user.
8. Try to delete an approved activity.
9. Try to delete as a normal non-cadre student.

Expected results:

- Deletion requires confirmation.
- Successful deletion immediately refreshes the list.
- Approved activities, activities from other creators, and unauthorized users cannot be deleted.
- Deletion failures show a clear message.
- Existing edit behavior still works.

## API Quick Checks

Use browser developer tools, Postman, curl, or the project's existing debug method. Do not use real sensitive production data.

Recommended checks:

- Save student tags for an admin account: should be rejected.
- Read or save party progress for an admin account: should be rejected.
- Submit an admin account as an activity participant: should be rejected.
- Set an admin account as a class cadre: should be rejected.
- Perform the same operations for real student accounts: should succeed or enter existing business validation.

## Regression Risks

Before accepting the fix, confirm:

- Admin users can still log in and access admin pages.
- Reminder tag sending still exists.
- Activity set/remove cadre still exists.
- Activity deletion does not allow unrelated users to delete others' records.
- Party date validation and existing save fields are unchanged.
- Browser console has no unhandled errors during the tested flows.

## Acceptance Record Template

- Environment:
- Test accounts:
- Date:
- Tag management: pass / fail, notes:
- Reminder tag sending: pass / fail, notes:
- Party student list: pass / fail, notes:
- Party progress editing: pass / fail, notes:
- Activity cadre settings: pass / fail, notes:
- Activity participant validation: pass / fail, notes:
- Activity deletion: pass / fail, notes:
- Remaining issues:
