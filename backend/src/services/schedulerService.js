const schedule = require('node-schedule');
const db = require('../models/database');
const MailService = require('./mailService');
const logger = require('../middleware/logger');

class SchedulerService {
  constructor() {
    this.jobs = {};
    this.loadScheduledEmails();
  }

  // Veritabanından tüm zamanlanan mailları yükle ve schedule et
  loadScheduledEmails() {
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

        rows.forEach(row => {
          this.scheduleEmail(row);
        });
        logger.info(`${rows.length} adet email başarıyla schedule edildi`);
      }
    );
  }

  // Tek bir email'i schedule et
  scheduleEmail(emailData) {
    const jobKey = `email_${emailData.id}`;

    // Eğer zaten schedule edildiyse, iptal et
    if (this.jobs[jobKey]) {
      this.jobs[jobKey].cancel();
    }

    try {
      const [hours, minutes] = emailData.scheduledTime.split(':');
      const cronExpression = `${minutes} ${hours} * * 1-5`; // Pazartesi-Cuma
      
      const job = schedule.scheduleJob(cronExpression, async () => {
        logger.info(`Zamanlanmış email gönderiliyor: ${emailData.id}`);
        await this.sendScheduledEmail(emailData);
      });

      this.jobs[jobKey] = job;
      logger.info(`Email ${emailData.id} schedule edildi: ${emailData.scheduledTime}`);
    } catch (error) {
      logger.error(`Email ${emailData.id} schedule edilirken hata:`, error);
    }
  }

  // Zamanlanmış email gönder
  async sendScheduledEmail(emailData) {
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
        // Veritabanını güncelle
        db.run(
          `UPDATE emails SET status = 'sent' WHERE id = ?`,
          [emailData.id],
          (err) => {
            if (err) logger.error('Email durumu güncellenirken hata:', err);
          }
        );

        // Log kaydı ekle
        db.run(
          `INSERT INTO logs (emailId, mailboxId, recipientEmail, status, sentAt, day)
           VALUES (?, ?, ?, 'success', datetime('now'), ?)`,
          [emailData.id, emailData.mailboxId, emailData.recipientEmail, today]
        );
      } else {
        // Hata log kaydı ekle
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

  // Email'i hemen gönder (test için)
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
          if (err) {
            return reject(err);
          }
          if (!row) {
            return reject(new Error('Email bulunamadı'));
          }

          await this.sendScheduledEmail(row);
          resolve();
        }
      );
    });
  }

  // Email'i schedule'dan kaldır
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
