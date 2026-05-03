const express = require('express');
const router = express.Router();
const db = require('../models/database');
const MailService = require('../services/mailService');
const { scanAll } = require('../services/inboxScanService');
const logger = require('../middleware/logger');

function mbFilter(req) {
  if (req.userId) return { clause: 'AND userId = ?', params: [req.userId] };
  return { clause: 'AND userId IS NULL', params: [] };
}

// Okunmamış mesaj sayısı (bildirim için)
router.get('/unread-count', (req, res) => {
  const f = mbFilter(req);
  db.get(
    `SELECT COUNT(*) as count FROM inbox_messages WHERE isRead = 0 ${f.clause}`,
    f.params,
    (err, row) => res.json({ count: row?.count ?? 0 })
  );
});

// Mesaj listesi
router.get('/', (req, res) => {
  const { page = '1', limit = '30', unreadOnly } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const f = mbFilter(req);
  const unreadClause = unreadOnly === 'true' ? 'AND isRead = 0' : '';

  db.all(
    `SELECT id, fromEmail, fromName, subject, receivedAt, isRead, inReplyTo, messageId
     FROM inbox_messages
     WHERE 1=1 ${f.clause} ${unreadClause}
     ORDER BY receivedAt DESC
     LIMIT ? OFFSET ?`,
    [...f.params, parseInt(limit), offset],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      db.get(`SELECT COUNT(*) as total FROM inbox_messages WHERE 1=1 ${f.clause} ${unreadClause}`, f.params, (_, cnt) => {
        res.json({ messages: rows || [], total: cnt?.total ?? 0 });
      });
    }
  );
});

// Mesaj detayı (okundu olarak işaretle)
router.get('/:id', (req, res) => {
  const f = mbFilter(req);
  db.get(
    `SELECT m.*, mb.email as mailboxEmail FROM inbox_messages m
     JOIN mailboxes mb ON mb.id = m.mailboxId
     WHERE m.id = ? ${f.clause}`,
    [parseInt(req.params.id), ...f.params],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Mesaj bulunamadı' });
      db.run(`UPDATE inbox_messages SET isRead = 1 WHERE id = ?`, [row.id]);
      res.json(row);
    }
  );
});

// Okundu olarak işaretle
router.put('/:id/read', (req, res) => {
  const f = mbFilter(req);
  db.run(
    `UPDATE inbox_messages SET isRead = 1 WHERE id = ? ${f.clause}`,
    [parseInt(req.params.id), ...f.params],
    function(err) {
      if (err) return res.status(500).json({ error: 'Güncelleme başarısız' });
      res.json({ success: true });
    }
  );
});

// Tümünü okundu yap
router.put('/read-all', (req, res) => {
  const f = mbFilter(req);
  db.run(`UPDATE inbox_messages SET isRead = 1 WHERE isRead = 0 ${f.clause}`, f.params, function(err) {
    if (err) return res.status(500).json({ error: 'Güncelleme başarısız' });
    res.json({ success: true, updated: this.changes });
  });
});

// Mesajı sil
router.delete('/:id', (req, res) => {
  const f = mbFilter(req);
  db.run(`DELETE FROM inbox_messages WHERE id = ? ${f.clause}`, [parseInt(req.params.id), ...f.params], function(err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'Mesaj bulunamadı' });
    res.json({ success: true });
  });
});

// Yanıt gönder
router.post('/:id/reply', async (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'Yanıt içeriği zorunlu' });

  const f = mbFilter(req);
  const msg = await new Promise(r =>
    db.get(
      `SELECT m.*, mb.email as mbEmail, mb.appPassword FROM inbox_messages m
       JOIN mailboxes mb ON mb.id = m.mailboxId
       WHERE m.id = ? ${f.clause}`,
      [parseInt(req.params.id), ...f.params],
      (_, row) => r(row)
    )
  );
  if (!msg) return res.status(404).json({ error: 'Mesaj bulunamadı' });

  const subject = msg.subject?.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;
  const ms = new MailService(msg.mbEmail, msg.appPassword);
  const result = await ms.sendMail(msg.fromEmail, subject, body);

  if (!result.success) return res.status(500).json({ error: result.error || 'Yanıt gönderilemedi' });

  db.run(`UPDATE inbox_messages SET isRead = 1 WHERE id = ?`, [msg.id]);
  logger.info(`Inbox yanıt gönderildi: ${msg.mbEmail} → ${msg.fromEmail}`);
  res.json({ success: true });
});

// Manuel tarama tetikle
router.post('/scan', async (req, res) => {
  try {
    const count = await scanAll();
    res.json({ success: true, newMessages: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
