// src/routes/notifications.js
const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const listForUser = db.prepare(
  `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
);
const markAllRead = db.prepare(
  `UPDATE notifications SET status = 'read' WHERE user_id = ? AND status = 'unread'`
);

router.get("/notifications", requireAuth, (req, res) => {
  const notifications = listForUser.all(req.session.user.id);
  res.render("notifications", { title: "Notifications", notifications });
});

router.post("/notifications/mark-read", requireAuth, (req, res) => {
  markAllRead.run(req.session.user.id);
  res.redirect("/notifications");
});

module.exports = router;
