const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../models/database');
const MailService = require('../services/mailService');
const logger = require('../middleware/logger');
const requireAuth = require('../middleware/auth');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/request-code
// Kayıtlı ilk mailbox'a 6 haneli OTP gönderir
router.post('/request-code', (req, res) => {
  db.get('SELECT email, appPassword FROM mailboxes LIMIT 1', async (err, mailbox) => {
    if (err || !mailbox) {
      return res.status(400).json({ error: 'Kayıtlı Gmail hesabı bulunamadı. Önce hesap ekleyin.' });
    }

    // Mevcut kullanılmamış kodları geçersiz kıl
    db.run('UPDATE otp_codes SET used = 1 WHERE used = 0');

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    db.run('INSERT INTO otp_codes (code, expiresAt) VALUES (?, ?)', [code, expiresAt], async (err) => {
      if (err) {
        logger.error('OTP oluşturma hatası:', err);
        return res.status(500).json({ error: 'Kod oluşturulamadı' });
      }

      const mailService = new MailService(mailbox.email, mailbox.appPassword);
      const result = await mailService.sendMail(
        mailbox.email,
        'Mail Sistemi - Giriş Kodu',
        `<div style="font-family:sans-serif;max-width:400px;margin:40px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Giriş Kodunuz</h2>
          <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Mail Sistemi paneline giriş için aşağıdaki kodu kullanın.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#111827;">${code}</span>
          </div>
          <p style="color:#ef4444;font-size:13px;margin:0;">⏱ Bu kod 2 dakika geçerlidir.</p>
        </div>`
      );

      if (!result.success) {
        logger.error('OTP gönderme hatası:', result.error);
        return res.status(500).json({ error: 'Kod gönderilemedi: ' + result.error });
      }

      // Email adresini maskele: ab***@gmail.com
      const masked = mailbox.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(1, b.length)) + c);
      logger.info(`OTP gönderildi: ${mailbox.email}`);
      res.json({ success: true, email: masked });
    });
  });
});

// POST /api/auth/verify-code
router.post('/verify-code', (req, res) => {
  const { code, deviceId, deviceName } = req.body;
  if (!code || !deviceId) {
    return res.status(400).json({ error: 'Kod ve cihaz ID gerekli' });
  }

  const now = new Date().toISOString();
  db.get(
    'SELECT * FROM otp_codes WHERE code = ? AND used = 0 AND expiresAt > ?',
    [code, now],
    (err, otp) => {
      if (err || !otp) {
        return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş kod' });
      }

      db.run('UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 saat
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

      db.get('SELECT id FROM sessions WHERE deviceId = ?', [deviceId], (err, existing) => {
        if (existing) {
          db.run(
            'UPDATE sessions SET token = ?, expiresAt = ?, isActive = 1, deviceName = ?, ipAddress = ? WHERE deviceId = ?',
            [token, expiresAt, deviceName || 'Bilinmeyen Cihaz', ip, deviceId],
            (err) => {
              if (err) return res.status(500).json({ error: 'Oturum güncellenemedi' });
              logger.info(`Oturum güncellendi: ${deviceId}`);
              res.json({ success: true, token, expiresAt });
            }
          );
        } else {
          db.run(
            'INSERT INTO sessions (deviceId, deviceName, ipAddress, token, expiresAt) VALUES (?, ?, ?, ?, ?)',
            [deviceId, deviceName || 'Bilinmeyen Cihaz', ip, token, expiresAt],
            (err) => {
              if (err) return res.status(500).json({ error: 'Oturum oluşturulamadı' });
              logger.info(`Yeni oturum oluşturuldu: ${deviceId}`);
              res.json({ success: true, token, expiresAt });
            }
          );
        }
      });
    }
  );
});

// GET /api/auth/me — token geçerliliği kontrolü
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    session: {
      id: req.session.id,
      deviceId: req.session.deviceId,
      deviceName: req.session.deviceName,
      expiresAt: req.session.expiresAt,
    },
  });
});

// GET /api/auth/sessions — tüm aktif oturumlar
router.get('/sessions', requireAuth, (req, res) => {
  db.all(
    `SELECT id, deviceId, deviceName, ipAddress, createdAt, expiresAt
     FROM sessions WHERE isActive = 1 ORDER BY createdAt DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// DELETE /api/auth/sessions/:id — oturumu sonlandır
router.delete('/sessions/:id', requireAuth, (req, res) => {
  db.run('UPDATE sessions SET isActive = 0 WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    logger.info(`Oturum kapatıldı: ${req.params.id}`);
    res.json({ success: true });
  });
});

module.exports = router;
