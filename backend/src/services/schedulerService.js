const schedule = require('node-schedule');
const db = require('../models/database');
const MailService = require('./mailService');
const logger = require('../middleware/logger');

class SchedulerService {
  constructor() {
    this.jobs = {};
    this.loadScheduledEmails();
  }

  loadScheduledEmails() {
    db.get(`SELECT value FROM settings WHERE key = 'send_overdue'`, (err, setting) => {
      const sendOverdue = !err && setting && setting.value === 'true';

      db.all(
        `SELECT e.id, e.mailboxId, e.recipientEmail, e.mailSubject, e.mailContent, e.mailSignature,
                e.scheduledTime, e.scheduledDate, m.email, m.appPassword
         FROM emails e
         JOIN mailboxes m ON e.mailboxId = m.id
         WHERE e.status = 'pending' AND e.scheduledDate >= date('now')`,
        (err, rows) => {
          if (err) {
            logger.error('Zamanlanan maillar yüklenirken hata:', err);
            return;
          }

          const now = new Date();
          rows.forEach(row => {
            const scheduledAt = new Date(`${row.scheduledDate}T${row.scheduledTime}:00`);
            if (sendOverdue && scheduledAt <= now) {
              logger.info(`Zamanı geçmiş email hemen gönderiliyor: ${row.id}`);
              this.sendScheduledEmail(row);
            } else {
              this.scheduleEmail(row);
            }
          });

          logger.info(`${rows.length} adet email yüklendi (geçmiş gönderim: ${sendOverdue})`);
        }
      );
    });
  }

  scheduleEmail(emailData) {
    const jobKey = `email_${emailData.id}`;

    if (this.jobs[jobKey]) {
      this.jobs[jobKey].cancel();
      delete this.jobs[jobKey];
    }

    if (!emailData.scheduledDate || !emailData.scheduledTime) {
      logger.warn(`Email ${emailData.id} için tarih/saat eksik, atlandı`);
      return;
    }

    // Spesifik tarih+saat ile tek seferlik zamanlama
    const scheduledAt = new Date(`${emailData.scheduledDate}T${emailData.scheduledTime}:00`);

    if (isNaN(scheduledAt.getTime())) {
      logger.warn(`Email ${emailData.id} için geçersiz tarih/saat: ${emailData.scheduledDate} ${emailData.scheduledTime}`);
      return;
    }

    if (scheduledAt <= new Date()) {
      logger.warn(`Email ${emailData.id} için zamanlama geçmişte (${emailData.scheduledDate} ${emailData.scheduledTime}), atlandı`);
      return;
    }

    try {
      const job = schedule.scheduleJob(scheduledAt, async () => {
        logger.info(`Zamanlanmış email gönderiliyor: ${emailData.id} (${emailData.scheduledDate} ${emailData.scheduledTime})`);
        await this.sendScheduledEmail(emailData);
        delete this.jobs[jobKey];
      });

      if (!job) {
        logger.warn(`Email ${emailData.id} schedule edilemedi (geçmiş tarih olabilir)`);
        return;
      }

      this.jobs[jobKey] = job;
      logger.info(`Email ${emailData.id} schedule edildi: ${emailData.scheduledDate} ${emailData.scheduledTime}`);
    } catch (error) {
      logger.error(`Email ${emailData.id} schedule edilirken hata:`, error);
    }
  }

  async sendScheduledEmail(emailData) {
    // Gönderim öncesi durumu kontrol et (tekrar gönderimi önle)
    const currentStatus = await new Promise((resolve) => {
      db.get(`SELECT status FROM emails WHERE id = ?`, [emailData.id], (err, row) => {
        resolve(err || !row ? null : row.status);
      });
    });

    if (currentStatus !== 'pending') {
      logger.info(`Email ${emailData.id} zaten ${currentStatus} durumunda, atlandı`);
      return;
    }

    try {
      const mailService = new MailService(emailData.email, emailData.appPassword);

      const result = await mailService.sendMail(
        emailData.recipientEmail,
        emailData.mailSubject || 'Otomatik Mail',
        emailData.mailContent,
        emailData.mailSignature
      );

      const today = new Date().toISOString().split('T')[0];

      if (result.success) {
        db.run(`UPDATE emails SET status = 'sent' WHERE id = ?`, [emailData.id], (err) => {
          if (err) logger.error('Email durumu güncellenirken hata:', err);
        });
        db.run(
          `INSERT INTO logs (emailId, mailboxId, recipientEmail, status, sentAt, day)
           VALUES (?, ?, ?, 'success', datetime('now'), ?)`,
          [emailData.id, emailData.mailboxId, emailData.recipientEmail, today]
        );
      } else {
        db.run(
          `INSERT INTO logs (emailId, mailboxId, recipientEmail, status, errorMessage, sentAt, day)
           VALUES (?, ?, ?, 'failed', ?, datetime('now'), ?)`,
          [emailData.id, emailData.mailboxId, emailData.recipientEmail, result.error, today]
        );
      }
    } catch (error) {
      logger.error(`Email gönderirken kritik hata (${emailData.id}):`, error);
    }
  }

  async sendEmailNow(emailId) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT e.id, e.mailboxId, e.recipientEmail, e.mailSubject, e.mailContent, e.mailSignature,
                e.scheduledTime, e.scheduledDate, m.email, m.appPassword
         FROM emails e
         JOIN mailboxes m ON e.mailboxId = m.id
         WHERE e.id = ?`,
        [emailId],
        async (err, row) => {
          if (err) return reject(err);
          if (!row) return reject(new Error('Email bulunamadı'));
          await this.sendScheduledEmail(row);
          resolve();
        }
      );
    });
  }

  cancelEmail(emailId) {
    const jobKey = `email_${emailId}`;
    if (this.jobs[jobKey]) {
      this.jobs[jobKey].cancel();
      delete this.jobs[jobKey];
      logger.info(`Email ${emailId} schedule'dan kaldırıldı`);
    }
  }
}

module.exports = new SchedulerService();
