# Information College Student Service and Party-Youth Management Platform

This repository is used by the software engineering course team to build the Information College Student Service and Party-Youth Management Platform. The project now contains a Web client, a WeChat mini program, a backend service, database materials, deployment materials, and project documents.

## Current Status

- webpage/: Web client for login, dashboard, student services, and admin pages.
- miniprogram/: WeChat mini program client for mobile scenarios.
- server/: Backend service for authentication, business APIs, permission checks, and data-scope protection.
- database/: Database initialization and schema-related materials.
- deploy/: Deployment notes and server environment materials.
- docs/: Collaboration notes, feature guides, API notes, test checklists, and deployment documents.

The backend implementation is the source of truth for API behavior. If documentation and code differ, verify the current server implementation and update the related document.

## Main Feature Modules

| Module | Description |
| --- | --- |
| Login and permissions | Web login, role recognition, and student/admin access boundary. |
| Dashboard | Grouped feature entry points for common student and admin services. |
| Intelligent Q&A | Entry for policy, process, and frequently asked question support. |
| Party process | Student progress display and admin maintenance of party stages, dates, tags, and reminder nodes. |
| Certificate service | Certificate templates, materials, downloads, and generation flow. |
| Academic analysis | Academic plans, course information, and analysis pages. |
| Honor display | Honor records, photo upload, and display. |
| Notices and reminders | Admin notice sending, including tag-based delivery. |
| Student tag management | Independent page for maintaining student tags; Reminder only sends by tag. |
| Class activity management | Activity creation, editing, cadre setting, and deletion. |
| Admin student list | Party admin student list with account, name, stage, tags, and edit entry. |

## Recent Web Fixes and Improvements

- Login page and dashboard visual polish.
- Dashboard feature entry copy and grouping polish.
- Return-home buttons added to multiple subpages.
- Student tag management separated from the Reminder page.
- Reminder keeps notice sending and tag-based sending, but no longer edits tags.
- Activity keeps set/remove cadre and adds activity deletion.
- Party process date validation now blocks invalid dates, invalid stage order, future historical dates, and display/save date offset issues.
- Backend student-scope protection prevents admin accounts from being treated as student targets in tag, party progress, activity participant, and cadre operations.
- /party/admin/list has been polished as a formal admin-style student list.
- The empty /party/student student-side issue was compared against main and should be tracked as a separate follow-up item.

## Local Development

### Web client

Run these commands from the repository root:

    cd webpage
    npm install
    npm run dev
    npm run build

Use npm run dev for local development. Run npm run build before submitting Web changes when possible. Do not commit node_modules/ or dist/.

### Backend service

Backend code is under server/. Local runtime configuration should be stored in a local .env file. Do not commit real secrets or environment-specific values.

### Mini program

Mini program code is under miniprogram/. Web-only tasks should not modify mini program files unless a task explicitly says so.

## Document Entry Points

| Document | Purpose |
| --- | --- |
| docs/web-feature-overview.md | Web feature map, page paths, role scope, and known limitations. |
| docs/web-test-checklist.md | Manual regression and acceptance checklist for Web testing. |
| docs/web-tag-management-guide.md | Student tag management and Reminder tag sending guide. |
| docs/web-activity-management-guide.md | Class activity, cadre setting, and deletion guide. |
| docs/api/api-spec.md | API notes and known frontend call scenarios. |
| docs/git-flow-collaboration.md | Branch, commit, PR, and collaboration rules. |
| docs/project-structure.md | Repository structure notes. |
| docs/rbac-matrix.md | Role and permission discussion matrix. |

## Collaboration Notes

1. Keep main stable. Use feature branches for feature work, bug fixes, UI polish, and documentation updates.
2. Do not commit .env, local logs, dependency directories, or build outputs.
3. For Web changes, run npm run build from webpage/ before submitting when possible.
4. For backend changes, run node --check server/index.js when server/index.js is touched.
5. Important feature or behavior changes should update docs/ so teammates, testers, and course reviewers can verify the current behavior.
6. If documentation and implementation disagree, record the current state or a TODO in documentation instead of changing code in a documentation-only branch.

## Pre-submit Checks

For code changes:

    git status -sb
    git diff --check
    cd webpage && npm run build

For documentation-only changes:

    git status -sb
    git diff --stat
    git diff --name-only
    git diff --check

## Notes

- Admin accounts are managers. They should not appear as student management targets in student tags, party student lists, activity participants, or cadre setting lists.
- Activity deletion, party date validation, student tag management, and student-scope protection are important regression areas.
- Database structure, deployment configuration, and mini program behavior should only be changed in clearly scoped branches.
