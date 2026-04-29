const express = require('express');
const router = express.Router();
const db = require('../models/database');
const requireAuth = require('../middleware/auth');

// Kredi bakiyesi + işlem geçmişi
router.get('/balance', requireAuth, (req, res) => {
  if (!req.userId) return res.json({ balance: null, unlimited: true });
  db.get(`SELECT balance FROM user_credits WHERE userId = ?`, [req.userId], (err, row) => {
    res.json({ balance: row?.balance ?? 0 });
  });
});

router.get('/transactions', requireAuth, (req, res) => {
  if (!req.userId) return res.json([]);
  db.all(
    `SELECT * FROM credit_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`,
    [req.userId],
    (err, rows) => res.json(rows || [])
  );
});

// Paketleri listele
router.get('/packages', (req, res) => {
  db.all(`SELECT * FROM packages WHERE isActive = 1 ORDER BY id ASC`, (err, rows) => {
    res.json(rows || []);
  });
});

module.exports = router;
