const express = require('express');
const router = express.Router();
const db = require('../models/database');
const logger = require('../middleware/logger');

router.get('/:mailboxId', (req, res) => {
  const where = req.isAdmin ? 'WHERE mailboxId = ?' : 'WHERE mailboxId = ? AND userId = ?';
  const params = req.isAdmin ? [req.params.mailboxId] : [req.params.mailboxId, req.userId];
  db.all(`SELECT * FROM drafts ${where} ORDER BY updatedAt DESC`, params, (err, drafts) => {
    if (err) return res.status(500).json({ error: 'Taslaklar getirilemedi' });
    res.json(drafts);
  });
});

router.post('/', (req, res) => {
  const { mailboxId, draftName, mailSubject, mailContent, mailSignature } = req.body;
  if (!mailboxId || !draftName || !mailContent) return res.status(400).json({ error: 'Mailbox, taslak adı ve içerik gerekli' });
  db.run(
    `INSERT INTO drafts (mailboxId, draftName, mailSubject, mailContent, mailSignature, userId) VALUES (?, ?, ?, ?, ?, ?)`,
    [mailboxId, draftName, mailSubject || 'Otomatik Mail', mailContent, mailSignature || '', req.userId || null],
    function(err) {
      if (err) return res.status(500).json({ error: 'Taslak kaydedilemedi' });
      logger.info(`Taslak kaydedildi: ${draftName}`);
      res.json({ id: this.lastID, message: 'Taslak başarıyla kaydedildi' });
    }
  );
});

router.put('/:draftId', (req, res) => {
  const { draftName, mailSubject, mailContent, mailSignature } = req.body;
  const where = req.isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND userId = ?';
  const params = req.isAdmin ? [draftName, mailSubject, mailContent, mailSignature, req.params.draftId]
                             : [draftName, mailSubject, mailContent, mailSignature, req.params.draftId, req.userId];
  db.run(
    `UPDATE drafts SET draftName=?, mailSubject=?, mailContent=?, mailSignature=?, updatedAt=CURRENT_TIMESTAMP ${where}`,
    params,
    function(err) {
      if (err) return res.status(500).json({ error: 'Taslak güncellenemedi' });
      res.json({ message: 'Taslak başarıyla güncellendi' });
    }
  );
});

router.delete('/:draftId', (req, res) => {
  const where = req.isAdmin ? 'WHERE id = ?' : 'WHERE id = ? AND userId = ?';
  const params = req.isAdmin ? [req.params.draftId] : [req.params.draftId, req.userId];
  db.run(`DELETE FROM drafts ${where}`, params, function(err) {
    if (err) return res.status(500).json({ error: 'Taslak silinemedi' });
    res.json({ message: 'Taslak başarıyla silindi' });
  });
});

module.exports = router;
