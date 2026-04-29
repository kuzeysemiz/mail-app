const express = require('express');
const router = express.Router();
const db = require('../models/database');
const logger = require('../middleware/logger');

// Stats
router.get('/stats', (req, res) => {
  db.get(
    `SELECT
       (SELECT COUNT(*) FROM blacklist) as blacklistCount,
       (SELECT COUNT(*) FROM whitelist) as whitelistCount,
       (SELECT COUNT(*) FROM email_bounce_monitoring WHERE status = 'monitoring') as monitoringCount`,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(row);
    }
  );
});

// Kara liste — listele
router.get('/blacklist', (req, res) => {
  const { q, limit = 100, offset = 0 } = req.query;
  let query = `SELECT * FROM blacklist WHERE 1=1`;
  const params = [];
  if (q) { query += ` AND email LIKE ?`; params.push(`%${q}%`); }
  query += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    db.get(
      `SELECT COUNT(*) as total FROM blacklist${q ? ' WHERE email LIKE ?' : ''}`,
      q ? [`%${q}%`] : [],
      (_, countRow) => res.json({ rows, total: countRow?.total || 0 })
    );
  });
});

// Kara liste — ekle
router.post('/blacklist', (req, res) => {
  const { email, reason } = req.body;
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email zorunlu' });
  db.run(
    `INSERT OR IGNORE INTO blacklist (email, reason, source) VALUES (?, ?, 'manual')`,
    [email.trim().toLowerCase(), reason || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      if (this.changes === 0) return res.status(409).json({ error: 'Bu email zaten kara listede' });
      logger.info(`Kara listeye manuel eklendi: ${email}`);
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Kara liste — sil
router.delete('/blacklist/:id', (req, res) => {
  db.run(`DELETE FROM blacklist WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (this.changes === 0) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ success: true });
  });
});

// Beyaz liste — listele
router.get('/whitelist', (req, res) => {
  const { q, limit = 100, offset = 0 } = req.query;
  let query = `SELECT * FROM whitelist WHERE 1=1`;
  const params = [];
  if (q) { query += ` AND email LIKE ?`; params.push(`%${q}%`); }
  query += ` ORDER BY confirmedAt DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    db.get(
      `SELECT COUNT(*) as total FROM whitelist${q ? ' WHERE email LIKE ?' : ''}`,
      q ? [`%${q}%`] : [],
      (_, countRow) => res.json({ rows, total: countRow?.total || 0 })
    );
  });
});

// Beyaz liste — sil
router.delete('/whitelist/:id', (req, res) => {
  db.run(`DELETE FROM whitelist WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (this.changes === 0) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ success: true });
  });
});

module.exports = router;
