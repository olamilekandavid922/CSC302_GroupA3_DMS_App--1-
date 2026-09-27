// src/routes/clients.js
const express = require("express");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const listClients = db.prepare(`SELECT * FROM clients ORDER BY name`);
const getClient = db.prepare(`SELECT * FROM clients WHERE client_id = ?`);
const getCasesForClient = db.prepare(
  `SELECT * FROM cases WHERE client_id = ? ORDER BY opened_date DESC`
);
const insertClient = db.prepare(
  `INSERT INTO clients (name, contact_info, address) VALUES (?, ?, ?)`
);

// List all clients
router.get("/clients", requireAuth, (req, res) => {
  res.render("clients", { title: "Clients", clients: listClients.all() });
});

// New client form (admin + lawyer only)
router.get("/clients/new", requireAuth, requireRole("admin", "lawyer"), (req, res) => {
  res.render("client-new", { title: "Add Client", error: null });
});

router.post("/clients", requireAuth, requireRole("admin", "lawyer"), (req, res) => {
  const { name, contact_info, address } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).render("client-new", {
      title: "Add Client",
      error: "Client name is required.",
    });
  }
  insertClient.run(name.trim(), contact_info || "", address || "");
  res.redirect("/clients");
});

// Client detail: shows all cases for that client
router.get("/clients/:id", requireAuth, (req, res) => {
  const client = getClient.get(req.params.id);
  if (!client) return res.status(404).render("error", { title: "Not found", message: "Client not found." });
  const cases = getCasesForClient.all(req.params.id);
  res.render("client-detail", { title: client.name, client, cases });
});

module.exports = router;
