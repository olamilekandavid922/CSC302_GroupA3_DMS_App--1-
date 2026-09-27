// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db/init");

const router = express.Router();

const findUserByEmail = db.prepare(`SELECT * FROM users WHERE email = ?`);

router.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/dashboard");
  res.render("login", { title: "Login", error: null });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const user = findUserByEmail.get((email || "").trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    return res.status(401).render("login", {
      title: "Login",
      error: "Invalid email or password.",
    });
  }

  req.session.user = {
    id: user.user_id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
  };
  res.redirect("/dashboard");
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

module.exports = router;
