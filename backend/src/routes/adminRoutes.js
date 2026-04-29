const express = require('express');
const router = express.Router();
const db = require('../models/database');
const requireAuth = require('../middleware/auth');
const logger = require('../middleware/logger');

function requireAdmin(req, res, next) {
  if (!req.isAdmin) return res.status(403).json({ error: 'Yetki gerekli' });
  next();
}

// Tüm kullanıcılar
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  db.all(
    `SELECT u.id, u.email, u.isAdmin, u.emailVerified, u.createdAt,
            COALESCE(uc.balance, 0) as credits
     FROM users u
     LEFT JOIN user_credits uc ON uc.userId = u.id
     ORDER BY u.createdAt DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows);
    }
  );
});

// Kullanıcıya kredi ekle/çıkar
router.post('/users/:id/credits', requireAuth, requireAdmin, (req, res) => {
  const { amount, description } = req.body;
  const userId = parseInt(req.params.id);
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Miktar zorunlu' });

  db.run(`INSERT OR IGNORE INTO user_credits (userId, balance) VALUES (?, 0)`, [userId], () => {
    db.run(
      `UPDATE user_credits SET balance = MAX(0, balance + ?) WHERE userId = ?`,
      [amount, userId],
      function(err) {
        if (err) return res.status(500).json({ error: 'Güncelleme başarısız' });
        db.run(
          `INSERT INTO credit_transactions (userId, amount, type, description) VALUES (?, ?, ?, ?)`,
          [userId, amount, amount > 0 ? 'admin_add' : 'admin_deduct', description || 'Admin işlemi']
        );
        logger.info(`Admin kredi güncelledi: userId=${userId}, miktar=${amount}`);
        res.json({ success: true });
      }
    );
  });
});

// Admin flag toggle
router.post('/users/:id/toggle-admin', requireAuth, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  db.run(`UPDATE users SET isAdmin = CASE WHEN isAdmin = 1 THEN 0 ELSE 1 END WHERE id = ?`, [userId], function(err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json({ success: true });
  });
});

// Genel istatistikler
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  db.get(
    `SELECT
       (SELECT COUNT(*) FROM users) as totalUsers,
       (SELECT COUNT(*) FROM users WHERE emailVerified = 1) as verifiedUsers,
       (SELECT COALESCE(SUM(balance), 0) FROM user_credits) as totalCredits,
       (SELECT COUNT(*) FROM logs WHERE status = 'success') as totalEmailsSent`,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(row);
    }
  );
});

module.exports = router;
