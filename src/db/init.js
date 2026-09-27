// src/db/init.js
// Sets up the SQLite database, creates all six tables from the ER diagram,
// and seeds one default admin user + a demo client/case so the app is usable
// immediately after `npm install && npm start`.
//
// NOTE ON DATABASE CHOICE
// The project proposal specifies MySQL. This implementation uses SQLite
// (via better-sqlite3) instead, because it needs zero setup (no server,
// no credentials) to run and grade. The schema below is plain, portable SQL
// (INTEGER PRIMARY KEY, TEXT, DATETIME) that maps 1:1 onto the MySQL schema
// in the project write-up — see README.md "Switching to MySQL" for the
// exact CREATE TABLE translations if your lecturer requires MySQL.

const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

   const DB_PATH = path.join(__dirname, "..", "..", "data", "dms.sqlite3");
   const DB_DIR = path.dirname(DB_PATH);
   if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
   const dbExisted = fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin','lawyer','paralegal','client')),
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  client_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  contact_info   TEXT,
  address        TEXT,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cases (
  case_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id      INTEGER NOT NULL REFERENCES clients(client_id),
  case_number    TEXT NOT NULL UNIQUE,
  title          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','closed')),
  opened_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  document_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id          INTEGER NOT NULL REFERENCES cases(case_id),
  uploaded_by      INTEGER NOT NULL REFERENCES users(user_id),
  title            TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'general',
  file_path        TEXT NOT NULL,
  current_version  INTEGER NOT NULL DEFAULT 1,
  upload_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_versions (
  version_id       INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id      INTEGER NOT NULL REFERENCES documents(document_id),
  version_number   INTEGER NOT NULL,
  file_path        TEXT NOT NULL,
  modified_by      INTEGER NOT NULL REFERENCES users(user_id),
  modified_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_logs (
  log_id           INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id      INTEGER NOT NULL REFERENCES documents(document_id),
  user_id          INTEGER NOT NULL REFERENCES users(user_id),
  action           TEXT NOT NULL CHECK (action IN ('upload','view','download','edit')),
  timestamp        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(user_id),
  message          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read')),
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

// ---- Seed data (only on first run) ----
if (!dbExisted) {
  const insertUser = db.prepare(
    `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`
  );
  const adminHash = bcrypt.hashSync("Admin@123", 10);
  const lawyerHash = bcrypt.hashSync("Lawyer@123", 10);
  insertUser.run("System Administrator", "admin@lawfirm.test", adminHash, "admin");
  insertUser.run("Demo Lawyer", "lawyer@lawfirm.test", lawyerHash, "lawyer");

  const clientId = db
    .prepare(`INSERT INTO clients (name, contact_info, address) VALUES (?, ?, ?)`)
    .run("Adewale Ventures Ltd.", "adewale.ventures@example.com", "Ibadan, Oyo State").lastInsertRowid;

  db.prepare(
    `INSERT INTO cases (client_id, case_number, title, status) VALUES (?, ?, ?, ?)`
  ).run(clientId, "UI/LAW/2026/001", "Adewale Ventures vs. Lagos Textiles Ltd.", "open");

  console.log("Database created and seeded.");
  console.log("  Admin login:  admin@lawfirm.test / Admin@123");
  console.log("  Lawyer login: lawyer@lawfirm.test / Lawyer@123");
}

module.exports = db;
