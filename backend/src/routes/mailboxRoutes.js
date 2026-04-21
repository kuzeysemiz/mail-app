const express = require('express');
const router = express.Router();
const db = require('../models/database');
const MailService = require('../services/mailService');
const logger = require('../middleware/logger');

// Mailbox oluştur/ekle
router.post('/mailbox', async (req, res) => {
  const { email, appPassword } = req.body;

  if (!email || !appPassword) {
    return res.status(400).json({ error: 'Email ve uygulama şifresi gereklidir' });
  }

  // Gmail bağlantısını doğrula
  const mailService = new MailService(email, appPassword);
  const isConnected = await mailService.verifyConnection();

  if (!isConnected) {
    return res.status(401).json({ error: 'Gmail bağlantısı başarısız. Kimlik bilgilerini kontrol edin.' });
  }

  db.run(
    `INSERT INTO mailboxes (email, appPassword) VALUES (?, ?)`,
    [email, appPassword],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Bu email zaten ekli' });
        }
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      res.json({ id: this.lastID, email, message: 'Mailbox başarıyla eklendi' });
      logger.info(`Yeni mailbox eklendi: ${email}`);
    }
  );
});

// Tüm mailbox'ları listele
router.get('/mailboxes', (req, res) => {
  db.all(
    `SELECT id, email, createdAt FROM mailboxes ORDER BY createdAt DESC`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      res.json(rows);
    }
  );
});

// Mailbox sil
router.delete('/mailbox/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM mailboxes WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Mailbox bulunamadı' });
      }
      res.json({ message: 'Mailbox başarıyla silindi' });
      logger.info(`Mailbox silindi: ${id}`);
    }
  );
});

module.exports = router;
