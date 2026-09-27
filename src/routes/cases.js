// src/routes/cases.js
const express = require("express");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");
const { notifyStaff } = require("../utils/notify");

const router = express.Router();

const listCases = db.prepare(`
  SELECT cases.*, clients.name AS client_name
  FROM cases JOIN clients ON clients.client_id = cases.client_id
  ORDER BY cases.opened_date DESC
`);
const getCase = db.prepare(`
  SELECT cases.*, clients.name AS client_name
  FROM cases JOIN clients ON clients.client_id = cases.client_id
  WHERE cases.case_id = ?
`);
const listDocumentsForCase = db.prepare(`
  SELECT documents.*, users.full_name AS uploaded_by_name
  FROM documents JOIN users ON users.user_id = documents.uploaded_by
  WHERE documents.case_id = ?
  ORDER BY documents.upload_date DESC
`);
const listClients = db.prepare(`SELECT * FROM clients ORDER BY name`);
const insertCase = db.prepare(
  `INSERT INTO cases (client_id, case_number, title, status) VALUES (?, ?, ?, ?)`
);
const updateCaseStatus = db.prepare(`UPDATE cases SET status = ? WHERE case_id = ?`);

// List all cases
router.get("/cases", requireAuth, (req, res) => {
  res.render("cases", { title: "Cases", cases: listCases.all() });
});

// New case form (admin + lawyer only)
router.get("/cases/new", requireAuth, requireRole("admin", "lawyer"), (req, res) => {
  res.render("case-new", { title: "Add Case", clients: listClients.all(), error: null });
});

router.post("/cases", requireAuth, requireRole("admin", "lawyer"), (req, res) => {
  const { client_id, case_number, title, status } = req.body;
  if (!client_id || !case_number || !title) {
    return res.status(400).render("case-new", {
      title: "Add Case",
      clients: listClients.all(),
      error: "Client, case number, and title are all required.",
    });
  }
  try {
    insertCase.run(client_id, case_number.trim(), title.trim(), status || "open");
    res.redirect("/cases");
  } catch (err) {
    res.status(400).render("case-new", {
      title: "Add Case",
      clients: listClients.all(),
      error: "Could not save case — is the case number already in use?",
    });
  }
});

// Case detail: shows all documents linked to the case
router.get("/cases/:id", requireAuth, (req, res) => {
  const theCase = getCase.get(req.params.id);
  if (!theCase) return res.status(404).render("error", { title: "Not found", message: "Case not found." });
  const documents = listDocumentsForCase.all(req.params.id);
  res.render("case-detail", { title: theCase.title, theCase, documents });
});

// Update case status (admin + lawyer only)
router.post("/cases/:id/status", requireAuth, requireRole("admin", "lawyer"), (req, res) => {
  const theCase = getCase.get(req.params.id);
  updateCaseStatus.run(req.body.status, req.params.id);
  if (theCase) {
    notifyStaff(
      `${req.session.user.fullName} changed case ${theCase.case_number} status to "${req.body.status}".`,
      req.session.user.id
    );
  }
  res.redirect(`/cases/${req.params.id}`);
});

module.exports = router;
