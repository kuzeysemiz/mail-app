const express = require('express');
const router = express.Router();
const db = require('../models/database');
const schedulerService = require('../services/schedulerService');
const timeScheduleService = require('../services/timeScheduleService');
const logger = require('../middleware/logger');

// Kullanıcının sadece kendi mailbox'larına ait verilere erişmesini sağlar
function mbFilter(req, alias = 'e') {
  if (req.isAdmin) return { clause: '', params: [] };
  return {
    clause: `AND ${alias}.mailboxId IN (SELECT id FROM mailboxes WHERE userId = ?)`,
    params: [req.userId],
  };
}

function ownMailbox(req, mailboxId) {
  return new Promise(resolve =>
    db.get(`SELECT id FROM mailboxes WHERE id = ? AND userId = ?`, [mailboxId, req.userId], (_, r) => resolve(!!r))
  );
}

// Toplu email ekle
router.post('/emails/add', async (req, res) => {
  const { mailboxId, recipients, mailSubject, mailContent, mailSignature, manualDate, manualTime, weekNumber, businessHours } = req.body;
  const useBusinessHours = businessHours !== false;

  if (!mailboxId || !recipients || recipients.length === 0 || !mailContent)
    return res.status(400).json({ error: 'mailboxId, recipients ve mailContent gereklidir' });
  if (recipients.length > 100)
    return res.status(400).json({ error: 'Maksimum 100 email ekleyebilirsiniz' });
  if (!(await ownMailbox(req, mailboxId)))
    return res.status(403).json({ error: 'Bu mailbox size ait değil' });

  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  let scheduledTimes;
  if (manualDate && manualTime) {
    scheduledTimes = recipients.map(() => ({ date: manualDate, time: manualTime }));
  } else if (weekNumber) {
    try { scheduledTimes = timeScheduleService.distributeEmailsByWeek(recipients.length, parseInt(weekNumber), useBusinessHours); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  } else {
    try { scheduledTimes = timeScheduleService.distributeEmailsRandomly(recipients.length, mailboxId, useBusinessHours); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }

  let addedCount = 0, errorCount = 0;

  recipients.forEach((email, index) => {
    const { date, time } = scheduledTimes[index];
    db.run(
      `INSERT INTO emails (mailboxId, batchId, recipientEmail, mailSubject, mailContent, mailSignature, scheduledDate, scheduledTime, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [mailboxId, batchId, email.trim(), mailSubject || 'Otomatik Mail', mailContent, mailSignature || '', date, time],
      function(err) {
        if (err) { errorCount++; logger.error(`Email eklenirken hata (${email}):`, err); }
        else {
          addedCount++;
          db.get(
            `SELECT e.id, e.mailboxId, e.recipientEmail, e.mailSubject, e.mailContent, e.mailSignature,
                    e.scheduledTime, e.scheduledDate, m.email, m.appPassword
             FROM emails e JOIN mailboxes m ON e.mailboxId = m.id WHERE e.id = ?`,
            [this.lastID],
            (err, row) => { if (!err && row) schedulerService.scheduleEmail(row); }
          );
        }
        if (addedCount + errorCount === recipients.length) {
          res.json({ message: `${addedCount} email başarıyla eklendi${errorCount > 0 ? `, ${errorCount} hata` : ''}`, addedCount, errorCount, batchId, scheduledTimes: scheduledTimes.slice(0, addedCount) });
          logger.info(`Toplu email eklendi: ${addedCount} başarılı, ${errorCount} hata`, { batchId });
        }
      }
    );
  });
});

// Alıcıların gönderim geçmişi
router.post('/check-recipients', (req, res) => {
  const { emails } = req.body;
  if (!Array.isArray(emails) || emails.length === 0) return res.json({});
  const f = mbFilter(req, 'l');
  const placeholders = emails.map(() => '?').join(',');
  db.all(
    `SELECT l.recipientEmail, COUNT(*) as sendCount, MAX(l.sentAt) as lastSent
     FROM logs l WHERE l.recipientEmail IN (${placeholders}) AND l.status IN ('sent','success') ${f.clause}
     GROUP BY l.recipientEmail`,
    [...emails, ...f.params],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      const result = {};
      rows.forEach(r => { result[r.recipientEmail] = { sendCount: r.sendCount, lastSent: r.lastSent }; });
      res.json(result);
    }
  );
});

// Autocomplete için kayıtlı alıcılar
router.get('/saved-emails', (req, res) => {
  const f = mbFilter(req, 'e');
  db.all(
    `SELECT DISTINCT e.recipientEmail as email FROM emails e WHERE 1=1 ${f.clause} ORDER BY e.recipientEmail`,
    f.params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows);
    }
  );
});

// Mailbox'ın email'lerini listele
router.get('/emails/:mailboxId', async (req, res) => {
  const { mailboxId } = req.params;
  const { status } = req.query;
  if (!(await ownMailbox(req, mailboxId))) return res.status(403).json({ error: 'Erişim reddedildi' });

  let query = `SELECT * FROM emails WHERE mailboxId = ?`;
  const params = [mailboxId];
  if (status) { query += ` AND status = ?`; params.push(status); }
  query += ` ORDER BY scheduledDate ASC, scheduledTime ASC`;

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json(rows);
  });
});

// Email güncelle
router.put('/email/:id', async (req, res) => {
  const { id } = req.params;
  const { recipientEmail, mailSubject, mailContent, mailSignature, scheduledTime, scheduledDate } = req.body;

  const f = mbFilter(req, 'e');
  const row = await new Promise(resolve =>
    db.get(`SELECT e.* FROM emails e WHERE e.id = ? ${f.clause}`, [id, ...f.params], (_, r) => resolve(r))
  );
  if (!row) return res.status(404).json({ error: 'Email bulunamadı' });

  const updates = [], values = [];
  if (recipientEmail !== undefined) { updates.push('recipientEmail = ?'); values.push(recipientEmail); }
  if (mailSubject    !== undefined) { updates.push('mailSubject = ?');    values.push(mailSubject); }
  if (mailContent    !== undefined) { updates.push('mailContent = ?');    values.push(mailContent); }
  if (mailSignature  !== undefined) { updates.push('mailSignature = ?');  values.push(mailSignature); }
  if (scheduledTime  !== undefined) { updates.push('scheduledTime = ?');  values.push(scheduledTime); }
  if (scheduledDate  !== undefined) { updates.push('scheduledDate = ?');  values.push(scheduledDate); }

  if (updates.length === 0) return res.status(400).json({ error: 'Güncellenecek alan yok' });
  values.push(id);

  db.run(`UPDATE emails SET ${updates.join(', ')} WHERE id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    db.get(
      `SELECT e.id, e.mailboxId, e.recipientEmail, e.mailContent, e.scheduledTime, e.scheduledDate, m.email, m.appPassword
       FROM emails e JOIN mailboxes m ON e.mailboxId = m.id WHERE e.id = ?`,
      [id],
      (err, r) => { if (!err && r) { schedulerService.cancelEmail(id); schedulerService.scheduleEmail(r); } }
    );
    res.json({ message: 'Email başarıyla güncellendi' });
    logger.info(`Email güncellendi: ${id}`);
  });
});

// Email sil
router.delete('/email/:id', async (req, res) => {
  const f = mbFilter(req, 'e');
  const row = await new Promise(resolve =>
    db.get(`SELECT e.id FROM emails e WHERE e.id = ? ${f.clause}`, [req.params.id, ...f.params], (_, r) => resolve(r))
  );
  if (!row) return res.status(404).json({ error: 'Email bulunamadı' });

  db.run(`DELETE FROM emails WHERE id = ?`, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    schedulerService.cancelEmail(req.params.id);
    res.json({ message: 'Email başarıyla silindi' });
    logger.info(`Email silindi: ${req.params.id}`);
  });
});

// Email hemen gönder
router.post('/email/:id/send-now', async (req, res) => {
  const f = mbFilter(req, 'e');
  const row = await new Promise(resolve =>
    db.get(`SELECT e.id FROM emails e WHERE e.id = ? ${f.clause}`, [req.params.id, ...f.params], (_, r) => resolve(r))
  );
  if (!row) return res.status(404).json({ error: 'Email bulunamadı' });

  try {
    await schedulerService.sendEmailNow(req.params.id);
    res.json({ message: 'Email başarıyla gönderildi' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Batch hemen gönder
router.post('/batch/:batchId/send-now', async (req, res) => {
  const { batchId } = req.params;
  const f = mbFilter(req, 'e');
  db.all(
    `SELECT e.id FROM emails e WHERE e.batchId = ? AND e.status = 'pending' ${f.clause}`,
    [batchId, ...f.params],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      if (rows.length === 0) return res.json({ message: 'Gönderilecek email yok', sentCount: 0 });
      let sentCount = 0, failCount = 0;
      for (const row of rows) {
        try { await schedulerService.sendEmailNow(row.id); sentCount++; }
        catch (e) { failCount++; logger.error(`Batch send-now hatası (${row.id}):`, e); }
      }
      res.json({ message: `${sentCount} email gönderildi`, sentCount, failCount });
    }
  );
});

// Batch sil
router.delete('/batch/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const f = mbFilter(req, 'e');
  // Önce sahiplik kontrolü
  const check = await new Promise(resolve =>
    db.get(`SELECT e.id FROM emails e WHERE e.batchId = ? ${f.clause} LIMIT 1`, [batchId, ...f.params], (_, r) => resolve(r))
  );
  if (!check && !req.isAdmin) return res.status(403).json({ error: 'Erişim reddedildi' });

  db.run('DELETE FROM emails WHERE batchId = ?', [batchId], function(err) {
    if (err) return res.status(500).json({ error: 'Batch silinemedi' });
    res.json({ message: 'Batch başarıyla silindi', deletedCount: this.changes });
    logger.info(`Batch silindi: ${batchId}`);
  });
});

// Batch listesi
router.get('/batches/:mailboxId', async (req, res) => {
  const { mailboxId } = req.params;
  if (!(await ownMailbox(req, mailboxId))) return res.status(403).json({ error: 'Erişim reddedildi' });

  db.all(
    `SELECT batchId, COUNT(*) as totalCount,
       SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sentCount,
       SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pendingCount,
       SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failedCount,
       MIN(createdAt) as createdAt, MAX(scheduledDate) as lastScheduledDate, mailSubject
     FROM emails WHERE mailboxId = ? AND batchId IS NOT NULL
     GROUP BY batchId ORDER BY createdAt DESC`,
    [mailboxId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows);
    }
  );
});

// Batch detay
router.get('/batch/:batchId/emails', async (req, res) => {
  const { batchId } = req.params;
  const f = mbFilter(req, 'e');
  db.all(
    `SELECT e.* FROM emails e WHERE e.batchId = ? ${f.clause} ORDER BY e.scheduledDate ASC, e.scheduledTime ASC`,
    [batchId, ...f.params],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows);
    }
  );
});

// Batch güncelle
router.put('/batch/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const { mailSubject, mailContent, mailSignature } = req.body;
  if (!mailSubject && !mailContent && !mailSignature) return res.status(400).json({ error: 'Güncellenecek alan yok' });

  const f = mbFilter(req, 'e');
  const check = await new Promise(resolve =>
    db.get(`SELECT e.id FROM emails e WHERE e.batchId = ? ${f.clause} LIMIT 1`, [batchId, ...f.params], (_, r) => resolve(r))
  );
  if (!check) return res.status(404).json({ error: 'Batch bulunamadı' });

  const updates = [], values = [];
  if (mailSubject)              { updates.push('mailSubject = ?');   values.push(mailSubject); }
  if (mailContent)              { updates.push('mailContent = ?');   values.push(mailContent); }
  if (mailSignature !== undefined) { updates.push('mailSignature = ?'); values.push(mailSignature); }
  values.push(batchId);

  db.run(`UPDATE emails SET ${updates.join(', ')} WHERE batchId = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    db.all(
      `SELECT e.id, e.mailboxId, e.recipientEmail, e.mailContent, e.scheduledTime, e.scheduledDate, m.email, m.appPassword
       FROM emails e JOIN mailboxes m ON e.mailboxId = m.id WHERE e.batchId = ?`,
      [batchId],
      (err, rows) => {
        if (!err && rows) rows.forEach(r => { schedulerService.cancelEmail(r.id); schedulerService.scheduleEmail(r); });
      }
    );
    res.json({ message: 'Batch başarıyla güncellendi', updatedCount: this.changes });
    logger.info(`Batch güncellendi: ${batchId}`);
  });
});

module.exports = router;
