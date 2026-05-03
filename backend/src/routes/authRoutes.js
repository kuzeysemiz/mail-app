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

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
}

// POST /api/auth/request-code
router.post('/request-code', (req, res) => {
  const { deviceId, deviceInfo } = req.body;
  const ip = getClientIp(req);

  if (!deviceId) {
    return res.status(400).json({ error: 'Cihaz ID gerekli' });
  }

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  // IP kontrolü — gizli sekme, farklı tarayıcı vb. tüm bypass'ları kapatır
  db.get(
    `SELECT createdAt FROM otp_codes WHERE ipAddress = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT 1`,
    [ip, twoMinutesAgo],
    (err, recentByIp) => {
      if (recentByIp) {
        const remaining = Math.ceil((new Date(recentByIp.createdAt).getTime() + 2 * 60 * 1000 - Date.now()) / 1000);
        return res.status(429).json({
          error: `Bu ağdan ${remaining} saniye sonra tekrar kod isteyebilirsiniz.`,
          remaining
        });
      }

      // DeviceId kontrolü (aynı ağ, farklı cihaz durumu için ek güvence)
      db.get(
        `SELECT createdAt FROM otp_codes WHERE deviceId = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT 1`,
        [deviceId, twoMinutesAgo],
        (err, recentByDevice) => {
          if (recentByDevice) {
            const remaining = Math.ceil((new Date(recentByDevice.createdAt).getTime() + 2 * 60 * 1000 - Date.now()) / 1000);
            return res.status(429).json({
              error: `Bu cihazdan ${remaining} saniye sonra tekrar kod isteyebilirsiniz.`,
              remaining
            });
          }

          db.get('SELECT email, appPassword FROM mailboxes LIMIT 1', async (err, mailbox) => {
            if (err || !mailbox) {
              return res.status(400).json({ error: 'Kayıtlı Gmail hesabı bulunamadı. Önce hesap ekleyin.' });
            }

            // Bu cihazın eski kullanılmamış kodlarını geçersiz kıl
            db.run('UPDATE otp_codes SET used = 1 WHERE deviceId = ? AND used = 0', [deviceId]);

            const code = generateOTP();
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

            db.run(
              'INSERT INTO otp_codes (code, expiresAt, deviceId, ipAddress) VALUES (?, ?, ?, ?)',
              [code, expiresAt, deviceId, ip],
              async (err) => {
                if (err) {
                  logger.error('OTP oluşturma hatası:', err);
                  return res.status(500).json({ error: 'Kod oluşturulamadı' });
                }

                const info = deviceInfo || {};
                const deviceRows = [
                  ['Tarayıcı', info.browser || '—'],
                  ['İşletim Sistemi', info.os || '—'],
                  ['Platform', info.platform || '—'],
                  ['Ekran Çözünürlüğü', info.screen || '—'],
                  ['Dil', info.language || '—'],
                  ['Saat Dilimi', info.timezone || '—'],
                  ['Cihaz ID', deviceId],
                  ['IP Adresi', ip],
                  ['Zaman', new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })],
                ];

                const deviceTable = `
                  <table style="width:100%;border-collapse:collapse;margin-top:8px;">
                    ${deviceRows.map(([k, v]) => `
                      <tr>
                        <td style="padding:6px 10px;font-size:12px;color:#6b7280;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${k}</td>
                        <td style="padding:6px 10px;font-size:12px;color:#111827;border-bottom:1px solid #f3f4f6;word-break:break-all;">${v}</td>
                      </tr>`).join('')}
                  </table>`;

                const mailService = new MailService(mailbox.email, mailbox.appPassword);
                const result = await mailService.sendMail(
                  mailbox.email,
                  'Mail Sistemi - Giriş Kodu',
                  `<div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                    <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Giriş Kodunuz</h2>
                    <p style="color:#6b7280;margin:0 0 24px;font-size:14px;">Mail Sistemi paneline giriş için aşağıdaki kodu kullanın.</p>

                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
                      <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#111827;">${code}</span>
                    </div>

                    <p style="color:#ef4444;font-size:13px;margin:0 0 28px;">⏱ Bu kod 2 dakika geçerlidir.</p>

                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
                      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#92400e;">⚠️ Bu isteği siz yapmadıysanız kodu kimseyle paylaşmayın.</p>
                      <p style="margin:0 0 8px;font-size:12px;color:#78350f;">Kodu isteyen cihaz bilgileri:</p>
                      ${deviceTable}
                    </div>
                  </div>`
                );

                if (!result.success) {
                  logger.error('OTP gönderme hatası:', result.error);
                  return res.status(500).json({ error: 'Kod gönderilemedi: ' + result.error });
                }

                const masked = mailbox.email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(1, b.length)) + c);
                logger.info(`OTP gönderildi — IP: ${ip} — cihaz: ${deviceId}`);
                res.json({ success: true, email: masked });
              }
            );
          });
        }
      );
    }
  );
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
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const ip = getClientIp(req);

      db.get('SELECT id FROM sessions WHERE deviceId = ?', [deviceId], (err, existing) => {
        if (existing) {
          db.run(
            'UPDATE sessions SET token = ?, expiresAt = ?, isActive = 1, deviceName = ?, ipAddress = ? WHERE deviceId = ?',
            [token, expiresAt, deviceName || 'Bilinmeyen Cihaz', ip, deviceId],
            (err) => {
              if (err) return res.status(500).json({ error: 'Oturum güncellenemedi' });
              res.json({ success: true, token, expiresAt });
            }
          );
        } else {
          db.run(
            'INSERT INTO sessions (deviceId, deviceName, ipAddress, token, expiresAt) VALUES (?, ?, ?, ?, ?)',
            [deviceId, deviceName || 'Bilinmeyen Cihaz', ip, token, expiresAt],
            (err) => {
              if (err) return res.status(500).json({ error: 'Oturum oluşturulamadı' });
              res.json({ success: true, token, expiresAt });
            }
          );
        }
      });
    }
  );
});

// GET /api/auth/me
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

// GET /api/auth/sessions
router.get('/sessions', requireAuth, (req, res) => {
  const [clause, params] = req.userId
    ? ['AND userId = ?', [req.userId]]
    : ['AND userId IS NULL', []];
  db.all(
    `SELECT id, deviceId, deviceName, ipAddress, createdAt, expiresAt
     FROM sessions WHERE isActive = 1 ${clause} ORDER BY createdAt DESC`,
    params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// DELETE /api/auth/sessions/:id
router.delete('/sessions/:id', requireAuth, (req, res) => {
  const [clause, params] = req.userId
    ? ['AND userId = ?', [req.userId]]
    : ['AND userId IS NULL', []];
  db.run(
    `UPDATE sessions SET isActive = 0 WHERE id = ? ${clause}`,
    [req.params.id, ...params],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(403).json({ error: 'Bu oturumu kapatma yetkiniz yok' });
      logger.info(`Oturum kapatıldı: ${req.params.id}`);
      res.json({ success: true });
    }
  );
});

// Logout — mevcut token'ı geçersiz kıl
router.post('/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (token) db.run(`UPDATE sessions SET isActive = 0 WHERE token = ?`, [token]);
  res.json({ success: true });
});

module.exports = router;
