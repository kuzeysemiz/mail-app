const express = require('express');
const router = express.Router();
const db = require('../models/database');
const logger = require('../middleware/logger');
const bounceDetection = require('../services/bounceDetectionService');

function uid(req) { return req.isAdmin ? null : (req.userId || null); }

router.get('/stats', (req, res) => {
  const u = uid(req);
  const uf = u ? `AND userId = ${u}` : '';
  db.get(
    `SELECT
       (SELECT COUNT(*) FROM blacklist WHERE 1=1 ${uf}) as blacklistCount,
       (SELECT COUNT(*) FROM whitelist WHERE 1=1 ${uf}) as whitelistCount,
       (SELECT COUNT(*) FROM email_bounce_monitoring WHERE status='monitoring' ${u ? `AND mailboxId IN (SELECT id FROM mailboxes WHERE userId=${u})` : ''}) as monitoringCount`,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(row);
    }
  );
});

router.get('/blacklist', (req, res) => {
  const { q, limit = 100, offset = 0 } = req.query;
  const u = uid(req);
  let query = `SELECT * FROM blacklist WHERE 1=1`;
  const params = [];
  if (u) { query += ` AND userId = ?`; params.push(u); }
  if (q) { query += ` AND email LIKE ?`; params.push(`%${q}%`); }
  query += ` ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    let countQ = `SELECT COUNT(*) as total FROM blacklist WHERE 1=1`;
    const cp = [];
    if (u) { countQ += ` AND userId = ?`; cp.push(u); }
    if (q) { countQ += ` AND email LIKE ?`; cp.push(`%${q}%`); }
    db.get(countQ, cp, (_, c) => res.json({ rows, total: c?.total || 0 }));
  });
});

router.post('/blacklist', (req, res) => {
  const { email, reason } = req.body;
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email zorunlu' });
  const u = uid(req);
  db.run(
    `INSERT OR IGNORE INTO blacklist (email, reason, source, userId) VALUES (?, ?, 'manual', ?)`,
    [email.trim().toLowerCase(), reason || null, u],
    function(err) {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      if (this.changes === 0) return res.status(409).json({ error: 'Bu email zaten kara listede' });
      logger.info(`Kara listeye manuel eklendi: ${email}`);
      res.json({ success: true, id: this.lastID });
    }
  );
});

router.delete('/blacklist/:id', (req, res) => {
  const u = uid(req);
  const where = u ? 'WHERE id = ? AND userId = ?' : 'WHERE id = ?';
  const params = u ? [req.params.id, u] : [req.params.id];
  db.run(`DELETE FROM blacklist ${where}`, params, function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (this.changes === 0) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ success: true });
  });
});

router.get('/whitelist', (req, res) => {
  const { q, limit = 100, offset = 0 } = req.query;
  const u = uid(req);
  let query = `SELECT * FROM whitelist WHERE 1=1`;
  const params = [];
  if (u) { query += ` AND userId = ?`; params.push(u); }
  if (q) { query += ` AND email LIKE ?`; params.push(`%${q}%`); }
  query += ` ORDER BY confirmedAt DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    let countQ = `SELECT COUNT(*) as total FROM whitelist WHERE 1=1`;
    const cp = [];
    if (u) { countQ += ` AND userId = ?`; cp.push(u); }
    if (q) { countQ += ` AND email LIKE ?`; cp.push(`%${q}%`); }
    db.get(countQ, cp, (_, c) => res.json({ rows, total: c?.total || 0 }));
  });
});

router.delete('/whitelist/:id', (req, res) => {
  const u = uid(req);
  const where = u ? 'WHERE id = ? AND userId = ?' : 'WHERE id = ?';
  const params = u ? [req.params.id, u] : [req.params.id];
  db.run(`DELETE FROM whitelist ${where}`, params, function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (this.changes === 0) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ success: true });
  });
});

router.get('/monitoring', (req, res) => {
  const { q, limit = 200 } = req.query;
  const u = uid(req);
  let query = `
    SELECT ebm.id, ebm.recipientEmail as email, ebm.sentAt, ebm.checkUntil, ebm.status, m.email as mailbox
    FROM email_bounce_monitoring ebm
    LEFT JOIN mailboxes m ON m.id = ebm.mailboxId
    WHERE ebm.status = 'monitoring'
  `;
  const params = [];
  if (u) { query += ` AND m.userId = ?`; params.push(u); }
  if (q) { query += ` AND ebm.recipientEmail LIKE ?`; params.push(`%${q}%`); }
  query += ` ORDER BY ebm.sentAt DESC LIMIT ?`;
  params.push(parseInt(limit));
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json({ rows, total: rows.length });
  });
});

let scanRunning = false;
router.post('/scan-bounces', async (req, res) => {
  if (scanRunning) return res.status(409).json({ error: 'Tarama zaten devam ediyor' });
  scanRunning = true;
  try {
    const result = await bounceDetection.deepScan();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    scanRunning = false;
  }
});

module.exports = router;
