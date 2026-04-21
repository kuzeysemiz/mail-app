const express = require('express');
const db = require('../models/database');
const logger = require('../middleware/logger');

const router = express.Router();

// Tüm taslakları getir
router.get('/:mailboxId', (req, res) => {
  const { mailboxId } = req.params;
  
  db.all(
    'SELECT * FROM drafts WHERE mailboxId = ? ORDER BY updatedAt DESC',
    [mailboxId],
    (err, drafts) => {
      if (err) {
        logger.error('Taslaklar getirilemedi', { error: err.message });
        return res.status(500).json({ error: 'Taslaklar getirilemedi' });
      }
      res.json(drafts);
    }
  );
});

// Taslak oluştur
router.post('/', (req, res) => {
  const { mailboxId, draftName, mailSubject, mailContent, mailSignature } = req.body;

  if (!mailboxId || !draftName || !mailContent) {
    return res.status(400).json({ error: 'Mailbox, taslak adı ve içerik gerekli' });
  }

  db.run(
    `INSERT INTO drafts (mailboxId, draftName, mailSubject, mailContent, mailSignature)
     VALUES (?, ?, ?, ?, ?)`,
    [mailboxId, draftName, mailSubject || 'Otomatik Mail', mailContent, mailSignature || ''],
    function(err) {
      if (err) {
        logger.error('Taslak kaydedilemedi', { error: err.message });
        return res.status(500).json({ error: 'Taslak kaydedilemedi' });
      }
      logger.info(`Taslak kaydedildi: ${draftName}`, { draftId: this.lastID });
      res.json({ id: this.lastID, message: 'Taslak başarıyla kaydedildi' });
    }
  );
});

// Taslağı güncelle
router.put('/:draftId', (req, res) => {
  const { draftId } = req.params;
  const { draftName, mailSubject, mailContent, mailSignature } = req.body;

  db.run(
    `UPDATE drafts 
     SET draftName = ?, mailSubject = ?, mailContent = ?, mailSignature = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [draftName, mailSubject, mailContent, mailSignature, draftId],
    function(err) {
      if (err) {
        logger.error('Taslak güncellenemedi', { error: err.message });
        return res.status(500).json({ error: 'Taslak güncellenemedi' });
      }
      logger.info(`Taslak güncellendi: ${draftName}`, { draftId });
      res.json({ message: 'Taslak başarıyla güncellendi' });
    }
  );
});

// Taslağı sil
router.delete('/:draftId', (req, res) => {
  const { draftId } = req.params;

  db.run(
    'DELETE FROM drafts WHERE id = ?',
    [draftId],
    function(err) {
      if (err) {
        logger.error('Taslak silinemedi', { error: err.message });
        return res.status(500).json({ error: 'Taslak silinemedi' });
      }
      logger.info('Taslak silindi', { draftId });
      res.json({ message: 'Taslak başarıyla silindi' });
    }
  );
});

module.exports = router;
