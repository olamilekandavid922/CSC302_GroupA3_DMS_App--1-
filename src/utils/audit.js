// src/utils/audit.js
const db = require("../db/init");

const insertLog = db.prepare(
  `INSERT INTO access_logs (document_id, user_id, action) VALUES (?, ?, ?)`
);

/**
 * Records an entry in the access audit trail.
 * @param {number} documentId
 * @param {number} userId
 * @param {'upload'|'view'|'download'|'edit'} action
 */
function logAccess(documentId, userId, action) {
  insertLog.run(documentId, userId, action);
}

module.exports = { logAccess };
