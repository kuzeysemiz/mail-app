const express = require('express');
const router = express.Router();
const db = require('../models/database');
const schedulerService = require('../services/schedulerService');
const timeScheduleService = require('../services/timeScheduleService');
const logger = require('../middleware/logger');

// Mailbox'a yeni email'ler ekle (toplu)
router.post('/emails/add', (req, res) => {
  const { mailboxId, recipients, mailSubject, mailContent, mailSignature } = req.body;

  if (!mailboxId || !recipients || recipients.length === 0 || !mailContent) {
    return res.status(400).json({ error: 'mailboxId, recipients (dizi) ve mailContent gereklidir' });
  }

  if (recipients.length > 100) {
    return res.status(400).json({ error: 'Maksimum 100 email ekleyebilirsiniz' });
  }

  // Batch ID oluştur (timestamp + random)
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Rastgele zaman dağıtımı yap
  let scheduledTimes;
  try {
    scheduledTimes = timeScheduleService.distributeEmailsRandomly(recipients.length, mailboxId);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  // Veritabanına ekle
  let addedCount = 0;
  let errorCount = 0;

  recipients.forEach((email, index) => {
    const { date, time } = scheduledTimes[index];

    db.run(
      `INSERT INTO emails (mailboxId, batchId, recipientEmail, mailSubject, mailContent, mailSignature, scheduledDate, scheduledTime, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [mailboxId, batchId, email.trim(), mailSubject || 'Otomatik Mail', mailContent, mailSignature || '', date, time],
      function(err) {
        if (err) {
          logger.error(`Email eklenirken hata (${email}):`, err);
          errorCount++;
        } else {
          addedCount++;
          // Schedule et
          db.get(
            `SELECT e.id, e.mailboxId, e.recipientEmail, e.mailSubject, e.mailContent, e.mailSignature,
                    e.scheduledTime, e.scheduledDate, m.email, m.appPassword
             FROM emails e
             JOIN mailboxes m ON e.mailboxId = m.id
             WHERE e.id = ?`,
            [this.lastID],
            (err, row) => {
              if (!err && row) {
                schedulerService.scheduleEmail(row);
              }
            }
          );
        }

        // Hepsini eklemeyi denediğimizde
        if (addedCount + errorCount === recipients.length) {
          res.json({
            message: `${addedCount} email başarıyla eklendi${errorCount > 0 ? `, ${errorCount} hata` : ''}`,
            addedCount,
            errorCount,
            batchId,
            scheduledTimes: scheduledTimes.slice(0, addedCount)
          });
          logger.info(`Toplu email eklendi: ${addedCount} başarılı, ${errorCount} hata`, { batchId });
        }
      }
    );
  });
});

// Mailbox'ın tüm email'lerini listele
router.get('/emails/:mailboxId', (req, res) => {
  const { mailboxId } = req.params;
  const { status } = req.query; // 'pending', 'sent', 'failed'

  let query = `SELECT * FROM emails WHERE mailboxId = ?`;
  const params = [mailboxId];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY scheduledDate ASC, scheduledTime ASC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Veritabanı hatası' });
    }
    res.json(rows);
  });
});

// Spesifik email'i güncelle
router.put('/email/:id', (req, res) => {
  const { id } = req.params;
  const { recipientEmail, mailSubject, mailContent, mailSignature, scheduledTime, scheduledDate } = req.body;

  const updates = [];
  const values = [];

  if (recipientEmail !== undefined) {
    updates.push('recipientEmail = ?');
    values.push(recipientEmail);
  }
  if (mailSubject !== undefined) {
    updates.push('mailSubject = ?');
    values.push(mailSubject);
  }
  if (mailContent !== undefined) {
    updates.push('mailContent = ?');
    values.push(mailContent);
  }
  if (mailSignature !== undefined) {
    updates.push('mailSignature = ?');
    values.push(mailSignature);
  }
  if (scheduledTime !== undefined) {
    updates.push('scheduledTime = ?');
    values.push(scheduledTime);
  }
  if (scheduledDate !== undefined) {
    updates.push('scheduledDate = ?');
    values.push(scheduledDate);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Güncellenecek alan yok' });
  }

  values.push(id);

  db.run(
    `UPDATE emails SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Email bulunamadı' });
      }

      // Schedule'ı güncelle
      db.get(
        `SELECT e.id, e.mailboxId, e.recipientEmail, e.mailContent, 
                e.scheduledTime, e.scheduledDate, m.email, m.appPassword
         FROM emails e
         JOIN mailboxes m ON e.mailboxId = m.id
         WHERE e.id = ?`,
        [id],
        (err, row) => {
          if (!err && row) {
            schedulerService.cancelEmail(id);
            schedulerService.scheduleEmail(row);
          }
        }
      );

      res.json({ message: 'Email başarıyla güncellendi' });
      logger.info(`Email güncellendi: ${id}`);
    }
  );
});

// Email sil
router.delete('/email/:id', (req, res) => {
  const { id } = req.params;

  db.run(
    `DELETE FROM emails WHERE id = ?`,
    [id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Veritabanı hatası' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Email bulunamadı' });
      }

      schedulerService.cancelEmail(id);

      res.json({ message: 'Email başarıyla silindi' });
      logger.info(`Email silindi: ${id}`);
    }
  );
});

// Email'i hemen gönder (test)
router.post('/email/:id/send-now', async (req, res) => {
  const { id } = req.params;

  try {
    await schedulerService.sendEmailNow(id);
    res.json({ message: 'Email başarıyla gönderildi' });
    logger.info(`Email hemen gönderildi: ${id}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch'in tüm email'lerini sil
router.delete('/batch/:batchId', (req, res) => {
  const { batchId } = req.params;

  db.run(
    'DELETE FROM emails WHERE batchId = ?',
    [batchId],
    function(err) {
      if (err) {
        logger.error('Batch silinirken hata:', err);
        return res.status(500).json({ error: 'Batch silinemedi' });
      }
      logger.info(`Batch silindi: ${batchId}`, { deletedCount: this.changes });
      res.json({ message: 'Batch başarıyla silindi', deletedCount: this.changes });
    }
  );
});

module.exports = router;
