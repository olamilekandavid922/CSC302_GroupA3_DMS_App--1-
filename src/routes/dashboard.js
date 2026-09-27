// src/routes/dashboard.js
const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const countClients = db.prepare(`SELECT COUNT(*) AS n FROM clients`);
const countOpenCases = db.prepare(`SELECT COUNT(*) AS n FROM cases WHERE status = 'open'`);
const countDocuments = db.prepare(`SELECT COUNT(*) AS n FROM documents`);
const recentDocuments = db.prepare(`
  SELECT documents.*, cases.case_number, users.full_name AS uploaded_by_name
  FROM documents
  JOIN cases ON cases.case_id = documents.case_id
  JOIN users ON users.user_id = documents.uploaded_by
  ORDER BY documents.upload_date DESC LIMIT 5
`);
const recentActivity = db.prepare(`
  SELECT access_logs.*, users.full_name AS user_name, documents.title AS document_title
  FROM access_logs
  JOIN users ON users.user_id = access_logs.user_id
  JOIN documents ON documents.document_id = access_logs.document_id
  ORDER BY timestamp DESC LIMIT 8
`);

router.get("/", requireAuth, (req, res) => res.redirect("/dashboard"));

router.get("/dashboard", requireAuth, (req, res) => {
  res.render("dashboard", {
    title: "Dashboard",
    stats: {
      clients: countClients.get().n,
      openCases: countOpenCases.get().n,
      documents: countDocuments.get().n,
    },
    recentDocuments: recentDocuments.all(),
    recentActivity: ["admin", "lawyer"].includes(req.session.user.role) ? recentActivity.all() : [],
  });
});

module.exports = router;
