const express = require('express');
const router = express.Router();
const db = require('../models/database');

// Tüm günleri listele
router.get('/days', (req, res) => {
  db.all(
    `SELECT DISTINCT day FROM logs ORDER BY day DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      res.json(rows.map(row => row.day));
    }
  );
});

// Spesifik günün logları
router.get('/day/:day', (req, res) => {
  const { day } = req.params;
  const { mailboxId } = req.query;

  let query = `SELECT * FROM logs WHERE day = ?`;
  const params = [day];

  if (mailboxId) {
    query += ` AND mailboxId = ?`;
    params.push(mailboxId);
  }

  query += ` ORDER BY sentAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }

    // İstatistikler hesapla
    const stats = {
      total: rows.length,
      successful: rows.filter(r => r.status === 'success').length,
      failed: rows.filter(r => r.status === 'failed').length,
      successRate: rows.length > 0 
        ? ((rows.filter(r => r.status === 'success').length / rows.length) * 100).toFixed(2)
        : 0
    };

    res.json({ stats, logs: rows });
  });
});

// Mailbox'un tüm logları
router.get('/mailbox/:mailboxId', (req, res) => {
  const { mailboxId } = req.params;
  const { days } = req.query; // Kaç gün geriye bakılacak

  let query = `SELECT * FROM logs WHERE mailboxId = ?`;
  const params = [mailboxId];

  if (days) {
    query += ` AND day >= date('now', '-' || ? || ' days')`;
    params.push(days);
  }

  query += ` ORDER BY day DESC, sentAt DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }

    // Günlere göre gruplaştır
    const groupedByDay = {};
    rows.forEach(log => {
      if (!groupedByDay[log.day]) {
        groupedByDay[log.day] = [];
      }
      groupedByDay[log.day].push(log);
    });

    res.json(groupedByDay);
  });
});

// Email'in gönderim geçmişi
router.get('/email/:emailId', (req, res) => {
  const { emailId } = req.params;

  db.all(
    `SELECT * FROM logs WHERE emailId = ? ORDER BY sentAt DESC`,
    [emailId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      res.json(rows);
    }
  );
});

// Özet istatistikler
router.get('/stats/summary', (req, res) => {
  db.get(
    `SELECT
       COUNT(*) as totalSent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as totalFailed,
       MAX(sentAt) as lastActivity
     FROM logs
     WHERE status = 'success'`,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json({
        totalSent:    row?.totalSent    || 0,
        totalFailed:  row?.totalFailed  || 0,
        lastActivity: row?.lastActivity || null,
      });
    }
  );
});

module.exports = router;
