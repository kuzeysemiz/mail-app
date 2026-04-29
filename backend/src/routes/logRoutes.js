const express = require('express');
const router = express.Router();
const db = require('../models/database');

function userFilter(req, alias = '') {
  const col = alias ? `${alias}.mailboxId` : 'mailboxId';
  if (req.isAdmin) return { clause: '', params: [] };
  return {
    clause: `AND ${col} IN (SELECT id FROM mailboxes WHERE userId = ?)`,
    params: [req.userId],
  };
}

router.get('/days', (req, res) => {
  const f = userFilter(req);
  db.all(
    `SELECT DISTINCT day FROM logs WHERE 1=1 ${f.clause} ORDER BY day DESC`,
    f.params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows.map(r => r.day));
    }
  );
});

router.get('/day/:day', (req, res) => {
  const { mailboxId } = req.query;
  const f = userFilter(req);
  let query = `SELECT * FROM logs WHERE day = ? ${f.clause}`;
  const params = [req.params.day, ...f.params];
  if (mailboxId) { query += ` AND mailboxId = ?`; params.push(mailboxId); }
  query += ` ORDER BY sentAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    const stats = {
      total: rows.length,
      successful: rows.filter(r => r.status === 'success').length,
      failed: rows.filter(r => r.status === 'failed').length,
      successRate: rows.length > 0 ? ((rows.filter(r => r.status === 'success').length / rows.length) * 100).toFixed(2) : 0,
    };
    res.json({ stats, logs: rows });
  });
});

router.get('/mailbox/:mailboxId', (req, res) => {
  const { days } = req.query;
  const f = userFilter(req);
  let query = `SELECT * FROM logs WHERE mailboxId = ? ${f.clause}`;
  const params = [req.params.mailboxId, ...f.params];
  if (days) { query += ` AND day >= date('now', '-' || ? || ' days')`; params.push(days); }
  query += ` ORDER BY day DESC, sentAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    const grouped = {};
    rows.forEach(log => { if (!grouped[log.day]) grouped[log.day] = []; grouped[log.day].push(log); });
    res.json(grouped);
  });
});

router.get('/email/:emailId', (req, res) => {
  db.all(`SELECT * FROM logs WHERE emailId = ? ORDER BY sentAt DESC`, [req.params.emailId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json(rows);
  });
});

router.get('/stats/summary', (req, res) => {
  const f = userFilter(req);
  db.get(
    `SELECT COUNT(*) as totalSent, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as totalFailed, MAX(sentAt) as lastActivity
     FROM logs WHERE status='success' ${f.clause}`,
    f.params,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json({ totalSent: row?.totalSent || 0, totalFailed: row?.totalFailed || 0, lastActivity: row?.lastActivity || null });
    }
  );
});

module.exports = router;
