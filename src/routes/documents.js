// src/routes/documents.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logAccess } = require("../utils/audit");
const { notifyStaff } = require("../utils/notify");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

const listCases = db.prepare(`SELECT case_id, case_number, title FROM cases ORDER BY opened_date DESC`);
const getCaseBrief = db.prepare(`SELECT case_number FROM cases WHERE case_id = ?`);
const insertDocument = db.prepare(`
  INSERT INTO documents (case_id, uploaded_by, title, category, file_path, current_version)
  VALUES (?, ?, ?, ?, ?, 1)
`);
const insertVersionRow = db.prepare(`
  INSERT INTO document_versions (document_id, version_number, file_path, modified_by)
  VALUES (?, ?, ?, ?)
`);
const getDocument = db.prepare(`
  SELECT documents.*, cases.title AS case_title, cases.case_number,
         users.full_name AS uploaded_by_name
  FROM documents
  JOIN cases ON cases.case_id = documents.case_id
  JOIN users ON users.user_id = documents.uploaded_by
  WHERE documents.document_id = ?
`);
const getVersions = db.prepare(`
  SELECT document_versions.*, users.full_name AS modified_by_name
  FROM document_versions
  JOIN users ON users.user_id = document_versions.modified_by
  WHERE document_id = ?
  ORDER BY version_number DESC
`);
const getLogs = db.prepare(`
  SELECT access_logs.*, users.full_name AS user_name
  FROM access_logs
  JOIN users ON users.user_id = access_logs.user_id
  WHERE document_id = ?
  ORDER BY timestamp DESC
`);
const bumpVersion = db.prepare(`
  UPDATE documents SET current_version = ?, file_path = ? WHERE document_id = ?
`);

// ---- Upload form ----
router.get("/documents/upload", requireAuth, requireRole("admin", "lawyer", "paralegal"), (req, res) => {
  res.render("document-upload", { title: "Upload Document", cases: listCases.all(), error: null });
});

router.post(
  "/documents/upload",
  requireAuth,
  requireRole("admin", "lawyer", "paralegal"),
  upload.single("file"),
  (req, res) => {
    const { case_id, title, category } = req.body;
    if (!req.file) {
      return res.status(400).render("document-upload", {
        title: "Upload Document",
        cases: listCases.all(),
        error: "Please choose a valid file (PDF, DOC, DOCX, JPG, or PNG, max 20MB).",
      });
    }
    if (!case_id || !title) {
      fs.unlinkSync(req.file.path); // clean up orphaned upload
      return res.status(400).render("document-upload", {
        title: "Upload Document",
        cases: listCases.all(),
        error: "Case and document title are required.",
      });
    }
    const result = insertDocument.run(
      case_id,
      req.session.user.id,
      title.trim(),
      category || "general",
      req.file.filename
    );
    const documentId = result.lastInsertRowid;
    insertVersionRow.run(documentId, 1, req.file.filename, req.session.user.id);
    logAccess(documentId, req.session.user.id, "upload");

    const caseBrief = getCaseBrief.get(case_id);
    notifyStaff(
      `${req.session.user.fullName} uploaded "${title.trim()}" to case ${caseBrief ? caseBrief.case_number : case_id}.`,
      req.session.user.id
    );

    res.redirect(`/documents/${documentId}`);
  }
);

// ---- Search / retrieval ----
router.get("/documents", requireAuth, (req, res) => {
  const { q, category, case_number } = req.query;
  let sql = `
    SELECT documents.*, cases.case_number, cases.title AS case_title,
           clients.name AS client_name, users.full_name AS uploaded_by_name
    FROM documents
    JOIN cases ON cases.case_id = documents.case_id
    JOIN clients ON clients.client_id = cases.client_id
    JOIN users ON users.user_id = documents.uploaded_by
    WHERE 1=1
  `;
  const params = [];
  if (q) {
    sql += ` AND (documents.title LIKE ? OR clients.name LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += ` AND documents.category = ?`;
    params.push(category);
  }
  if (case_number) {
    sql += ` AND cases.case_number LIKE ?`;
    params.push(`%${case_number}%`);
  }
  sql += ` ORDER BY documents.upload_date DESC`;

  const documents = db.prepare(sql).all(...params);
  res.render("documents", { title: "Documents", documents, filters: { q, category, case_number } });
});

// ---- Document detail (records a "view" in the audit trail) ----
router.get("/documents/:id", requireAuth, (req, res) => {
  const document = getDocument.get(req.params.id);
  if (!document) return res.status(404).render("error", { title: "Not found", message: "Document not found." });

  logAccess(document.document_id, req.session.user.id, "view");

  const versions = getVersions.all(document.document_id);
  const canSeeAuditLog = ["admin", "lawyer"].includes(req.session.user.role);
  const logs = canSeeAuditLog ? getLogs.all(document.document_id) : [];

  res.render("document-detail", {
    title: document.title,
    document,
    versions,
    logs,
    canSeeAuditLog,
  });
});

// ---- Download (records a "download" in the audit trail) ----
router.get("/documents/:id/download", requireAuth, (req, res) => {
  const document = getDocument.get(req.params.id);
  if (!document) return res.status(404).render("error", { title: "Not found", message: "Document not found." });

  logAccess(document.document_id, req.session.user.id, "download");
  const filePath = path.join(UPLOAD_DIR, document.file_path);
  res.download(filePath, `${document.title}${path.extname(document.file_path)}`);
});

// ---- Upload a new version of an existing document ----
router.get(
  "/documents/:id/new-version",
  requireAuth,
  requireRole("admin", "lawyer", "paralegal"),
  (req, res) => {
    const document = getDocument.get(req.params.id);
    if (!document) return res.status(404).render("error", { title: "Not found", message: "Document not found." });
    res.render("document-new-version", { title: `New version — ${document.title}`, document, error: null });
  }
);

router.post(
  "/documents/:id/new-version",
  requireAuth,
  requireRole("admin", "lawyer", "paralegal"),
  upload.single("file"),
  (req, res) => {
    const document = getDocument.get(req.params.id);
    if (!document) return res.status(404).render("error", { title: "Not found", message: "Document not found." });
    if (!req.file) {
      return res.status(400).render("document-new-version", {
        title: `New version — ${document.title}`,
        document,
        error: "Please choose a valid file to upload as the new version.",
      });
    }
    const newVersion = document.current_version + 1;
    insertVersionRow.run(document.document_id, newVersion, req.file.filename, req.session.user.id);
    bumpVersion.run(newVersion, req.file.filename, document.document_id);
    logAccess(document.document_id, req.session.user.id, "edit");

    notifyStaff(
      `${req.session.user.fullName} uploaded a new version (v${newVersion}) of "${document.title}".`,
      req.session.user.id
    );

    res.redirect(`/documents/${document.document_id}`);
  }
);

module.exports = router;
