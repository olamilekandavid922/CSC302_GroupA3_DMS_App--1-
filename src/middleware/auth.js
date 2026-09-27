// src/middleware/auth.js
// Session-based authentication and role-based access control (RBAC).

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.locals.currentUser = req.session.user; // available in every view
  next();
}

// Usage: requireRole('admin') or requireRole('admin', 'lawyer')
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect("/login");
    }
    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).render("error", {
        title: "Access denied",
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
