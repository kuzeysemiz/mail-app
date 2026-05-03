const express = require('express');
const router = express.Router();
const db = require('../models/database');
const MailService = require('../services/mailService');
const logger = require('../middleware/logger');

router.post('/mailbox', (req, res) => {
  const { email, appPassword } = req.body;
  if (!email || !appPassword) return res.status(400).json({ error: 'Email ve uygulama şifresi gereklidir' });

  db.run(
    `INSERT INTO mailboxes (email, appPassword, userId) VALUES (?, ?, ?)`,
    [email, appPassword, req.userId || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Bu email zaten ekli' });
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      res.json({ id: this.lastID, email, message: 'Mailbox başarıyla eklendi' });
      logger.info(`Yeni mailbox eklendi: ${email}`);
    }
  );
});

router.get('/mailboxes', (req, res) => {
  db.all(`SELECT id, email, createdAt FROM mailboxes WHERE userId = ? ORDER BY createdAt DESC`, [req.userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json(rows);
  });
});

router.delete('/mailbox/:id', (req, res) => {
  const where = req.isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND userId = ?';
  const params = req.isAdmin ? [req.params.id] : [req.params.id, req.userId];
  db.run(`DELETE FROM mailboxes ${where}`, params, function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (this.changes === 0) return res.status(404).json({ error: 'Mailbox bulunamadı' });
    res.json({ message: 'Mailbox başarıyla silindi' });
    logger.info(`Mailbox silindi: ${req.params.id}`);
  });
});

module.exports = router;
