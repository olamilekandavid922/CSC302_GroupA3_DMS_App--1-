// src/utils/notify.js
const db = require("../db/init");

const insertNotification = db.prepare(
  `INSERT INTO notifications (user_id, message) VALUES (?, ?)`
);
const findUsersByRoles = db.prepare(
  `SELECT user_id FROM users WHERE role IN ('admin','lawyer')`
);

/**
 * Notifies every admin and lawyer user (the roles responsible for
 * overseeing cases and documents) with an in-app message.
 * @param {string} message
 * @param {number} [excludeUserId] - skip notifying the user who triggered the event
 */
function notifyStaff(message, excludeUserId = null) {
  const recipients = findUsersByRoles.all();
  for (const { user_id } of recipients) {
    if (excludeUserId && user_id === excludeUserId) continue;
    insertNotification.run(user_id, message);
  }
}

module.exports = { notifyStaff };
