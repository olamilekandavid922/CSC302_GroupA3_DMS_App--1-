// src/routes/users.js
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const listUsers = db.prepare(`SELECT user_id, full_name, email, role, created_at FROM users ORDER BY full_name`);
const insertUser = db.prepare(
  `INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)`
);
const updateUserRole = db.prepare(`UPDATE users SET role = ? WHERE user_id = ?`);

// Only admins can manage users
router.get("/users", requireAuth, requireRole("admin"), (req, res) => {
  res.render("users", { title: "Manage Users", users: listUsers.all(), error: null });
});

router.post("/users", requireAuth, requireRole("admin"), (req, res) => {
  const { full_name, email, password, role } = req.body;
  if (!full_name || !email || !password || !role) {
    return res.status(400).render("users", {
      title: "Manage Users",
      users: listUsers.all(),
      error: "All fields are required to create a user.",
    });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    insertUser.run(full_name.trim(), email.trim().toLowerCase(), hash, role);
    res.redirect("/users");
  } catch (err) {
    res.status(400).render("users", {
      title: "Manage Users",
      users: listUsers.all(),
      error: "Could not create user — is that email already registered?",
    });
  }
});

router.post("/users/:id/role", requireAuth, requireRole("admin"), (req, res) => {
  updateUserRole.run(req.body.role, req.params.id);
  res.redirect("/users");
});

module.exports = router;
