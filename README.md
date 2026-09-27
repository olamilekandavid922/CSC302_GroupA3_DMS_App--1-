# Law Firm Document Management System — CSC 302 Group A3

A web-based Document Management System built for the case study described in
the project write-up (Faculty of Law, University of Ibadan): client/case
management, document upload with categorisation, search, role-based access
control, version tracking, and a full access audit trail.

## Tech stack

| Layer          | Technology                                              |
|----------------|----------------------------------------------------------|
| Frontend       | HTML5, Bootstrap 5, EJS templates, vanilla JavaScript     |
| Backend        | Node.js + Express.js                                      |
| Database       | SQLite via `better-sqlite3` (see note below)               |
| Auth           | `express-session` (sessions) + `bcryptjs` (password hashing) |
| File uploads   | `multer`                                                    |

### Note on database choice

The project proposal specifies MySQL. This implementation uses **SQLite**
instead, because it needs no separate database server, username, or
password — the whole database lives in one file
(`data/dms.sqlite3`) that is created and seeded automatically on first run.
This keeps the project trivial to install and grade.

The schema (`src/db/init.js`) is plain, portable SQL and maps directly onto
the MySQL design in the write-up. **Appendix A** of the write-up has the
exact `CREATE TABLE` statements; converting to MySQL only requires:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`
- `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` → same, MySQL syntax is
  identical for this
- `CHECK (col IN (...))` → keep as-is (MySQL 8.0.16+ supports CHECK) or
  convert to an `ENUM` column if your MySQL version is older

## Getting started

```bash
npm install
npm start
```

Then open **http://localhost:3000**. The database and two demo accounts are
created automatically the first time the server starts:

| Role   | Email                  | Password     |
|--------|------------------------|--------------|
| Admin  | admin@lawfirm.test     | Admin@123    |
| Lawyer | lawyer@lawfirm.test    | Lawyer@123   |

A demo client ("Adewale Ventures Ltd.") and one demo case are seeded too, so
there's something to explore immediately.

To start fresh, stop the server and delete `data/dms.sqlite3*`, then run
`npm start` again.

## Project structure

```
server.js                  Express app entry point
src/
  db/init.js                Database schema + seed data
  middleware/auth.js         requireAuth / requireRole (RBAC)
  routes/
    auth.js                  Login / logout
    dashboard.js              Dashboard (summary stats + recent activity)
    clients.js                Client management
    cases.js                  Case management
    documents.js               Upload, search, versioning, download, audit log
    users.js                   Admin-only user management
  utils/audit.js              logAccess() helper for the audit trail
views/                       EJS templates (Bootstrap 5)
public/css/style.css          Custom styling
uploads/                     Uploaded files are stored here (created at runtime)
data/                        SQLite database file (created at runtime)
```

## Roles and permissions

| Role       | Can do                                                              |
|------------|----------------------------------------------------------------------|
| admin      | Everything, including managing users and viewing the audit trail      |
| lawyer     | Manage clients/cases, upload documents, new versions, view audit trail |
| paralegal  | Upload documents, new versions (no audit trail, no user management)    |
| client     | View-only: browse cases/documents they have access to                  |

Role checks are enforced server-side in `src/middleware/auth.js` via
`requireRole(...)`, not just hidden in the UI.

## Core features implemented

- **Authentication** — session-based login, bcrypt-hashed passwords.
- **Client & case management** — create clients, create cases per client,
  track case status (open/pending/closed).
- **Document upload & categorisation** — PDF/DOC/DOCX/JPG/PNG up to 20MB,
  tagged by case and category.
- **Search & retrieval** — filter by keyword, case number, or category.
- **Version control** — every re-upload creates a new `document_versions`
  row; the document always points at its current version but keeps every
  prior file.
- **Access audit trail** — every view/upload/download/edit is logged with
  the acting user and a timestamp, visible to admin/lawyer roles on each
  document's detail page.
- **Notifications** — admin and lawyer users get an in-app notification
  when a document is uploaded, a new version is added, or a case's status
  changes (the person who triggered the action is not notified about their
  own action). A bell/badge in the navbar shows the unread count, linking
  to `/notifications`, with a "Mark all as read" action.

## Testing performed

The seven test cases in the write-up (Chapter Four, Section 4.3.4) were run
against this exact codebase using curl-based functional tests: valid/invalid
login, document upload, search, download, an unauthorised access attempt,
and a version update. All seven passed.

## Known limitations / suggested next steps

See Chapter Five of the write-up (Recommendations) — e-signatures, external
court e-filing integration, a mobile-friendly UI, backups/disaster recovery,
and user training before any real rollout.
