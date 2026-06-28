# Web Feature Overview

This document summarizes the current Web client features for teammates, testers, and course reviewers. It is a navigation and acceptance reference, not an API contract. Backend implementation remains the source of truth for permission and data-scope rules.

## Web Entry Points

| Page | Path | Main users | Purpose |
| --- | --- | --- | --- |
| Login | /login | All users | Sign in with an enabled account. |
| Dashboard | / | All signed-in users | Central feature entry page. |
| Intelligent Q&A | varies by dashboard entry | Students, admins | Ask policy and process questions. |
| Student party page | /party/student | Students | View personal party process information. |
| Party admin list | /party/admin/list | Admins | View real student accounts and enter progress editing. |
| Party admin edit | /party/admin/edit/:accountId | Admins | Edit party stage, dates, tags, and reminder nodes for one real student. |
| Reminder | /reminder | Admins, supported users | Send notices; admins can send by student tags. |
| Student tag management | /tag-management | Admins | Maintain tags for real student accounts. |
| Activity | /activity | Students, cadres, admins by existing rules | Manage class activities and cadre settings. |
| Certificate pages | varies by dashboard entry | Students, admins | Certificate template and material flows. |
| Academic pages | varies by dashboard entry | Students, admins | Academic plan and course analysis. |
| Honor pages | varies by dashboard entry | Students, admins | Honor display and photo upload flows. |

## Role Notes

| Role | Current Web behavior |
| --- | --- |
| Student | Can access student-facing services according to current route and backend rules. |
| Admin | Can manage student data, send notices, maintain tags, and use admin party pages. Admin accounts must not be treated as student records. |
| Class cadre | Can use activity management capabilities according to existing backend permission rules. |

## Important Behavior Boundaries

- Student identity should be determined by backend permission data. The current backend rule is based on enabled student accounts.
- party_students is an extension table for party progress; it is not the source of truth for the full student list.
- Frontend filtering is defensive only. Backend APIs must still reject invalid student targets.
- Reminder sends notices and can target tags, but tag editing is handled in Student Tag Management.
- Activity cadre setting is separate from general student tag editing, although both may use student tags internally.
- Activity deletion is only available where current backend rules allow it. Approved activities, records created by another user, and unauthorized users should be rejected.

## Recent UI and Behavior Updates

- Dashboard copy and grouping were polished for a more formal platform feel.
- Subpages gained return-home buttons where appropriate.
- /party/admin/list was changed from a sparse vertical list to a management-style list with count, toolbar, student rows, tags, party stage, reminder due dates, and edit action.
- Student tag management was separated into its own page.
- Activity gained a deletion action for editable records.
- Party date validation was strengthened.
- Admin accounts are protected from appearing in student-only lists or being edited as student objects.

## Known Follow-up Items

- The student-side /party/student empty display issue was compared with main and should be tracked separately. It should not be treated as a regression from recent Web UI polish.
- API documentation should be kept synchronized when backend request or response fields change.
- Test accounts should include at least one admin, one normal student, and one class cadre student for acceptance checks.
