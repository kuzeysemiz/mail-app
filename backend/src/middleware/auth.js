const db = require('../models/database');

module.exports = function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token gerekli' });

  const now = new Date().toISOString();
  db.get(
    'SELECT * FROM sessions WHERE token = ? AND isActive = 1 AND expiresAt > ?',
    [token, now],
    (err, session) => {
      if (err || !session) return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
      req.session  = session;
      req.userId   = session.userId   || null;
      req.isAdmin  = session.isAdmin  === 1 || !session.userId; // userId olmayan eski sessionlar admin
      next();
    }
  );
};
