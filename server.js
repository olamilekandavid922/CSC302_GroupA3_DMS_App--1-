// server.js
const path = require("path");
const express = require("express");
const session = require("express-session");

require("./src/db/init"); // creates + seeds the database on first run
const db = require("./src/db/init");

const authRoutes = require("./src/routes/auth");
const dashboardRoutes = require("./src/routes/dashboard");
const clientRoutes = require("./src/routes/clients");
const caseRoutes = require("./src/routes/cases");
const documentRoutes = require("./src/routes/documents");
const userRoutes = require("./src/routes/users");
const notificationRoutes = require("./src/routes/notifications");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "csc302-dms-dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 4 }, // 4 hours
  })
);

// Make the logged-in user (or null) available to every view
const countUnread = db.prepare(
  `SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND status = 'unread'`
);
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.unreadCount = req.session.user ? countUnread.get(req.session.user.id).n : 0;
  next();
});

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(clientRoutes);
app.use(caseRoutes);
app.use(documentRoutes);
app.use(userRoutes);
app.use(notificationRoutes);

app.use((req, res) => {
  res.status(404).render("error", { title: "Not found", message: "Page not found." });
});

app.listen(PORT, () => {
  console.log(`Law Firm DMS running at http://localhost:${PORT}`);
});
