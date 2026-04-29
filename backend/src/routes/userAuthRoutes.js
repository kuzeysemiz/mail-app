const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../models/database');
const MailService = require('../services/mailService');
const logger = require('../middleware/logger');
const requireAuth = require('../middleware/auth');

const SESSION_DAYS = 30;

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendVerificationEmail(email, token) {
  const row = await new Promise(r => db.get('SELECT email, appPassword FROM mailboxes LIMIT 1', (_, v) => r(v)));
  if (!row) return;
  const link = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const ms = new MailService(row.email, row.appPassword);
  await ms.sendMail(email, 'E-posta adresinizi doğrulayın', `
    <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
      <h2 style="margin:0 0 16px;color:#111827;">E-posta Doğrulama</h2>
      <p style="color:#6b7280;margin:0 0 24px;">Hesabınızı aktif etmek için aşağıdaki butona tıklayın.</p>
      <a href="${link}" style="display:inline-block;background:#00c896;color:#07090f;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Doğrula</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Bu linki siz talep etmediyseniz görmezden gelin.</p>
    </div>
  `).catch(() => {});
}

// Kayıt
router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email ve şifre zorunlu' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });

  const passwordHash = await bcrypt.hash(password, 10);
  const verificationToken = randomToken();

  db.run(
    `INSERT INTO users (email, passwordHash, verificationToken) VALUES (?, ?, ?)`,
    [email.trim().toLowerCase(), passwordHash, verificationToken],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Bu email zaten kayıtlı' });
        return res.status(500).json({ error: 'Kayıt başarısız' });
      }
      const userId = this.lastID;
      // Ücretsiz 50 kredi ver
      db.run(`INSERT INTO user_credits (userId, balance) VALUES (?, 50)`, [userId]);
      db.run(`INSERT INTO credit_transactions (userId, amount, type, description) VALUES (?, 50, 'bonus', 'Hoş geldin kredisi')`, [userId]);

      sendVerificationEmail(email.trim().toLowerCase(), verificationToken);
      logger.info(`Yeni kullanıcı kaydı: ${email}`);
      res.json({ success: true, message: 'Kayıt başarılı. Doğrulama maili gönderildi.' });
    }
  );
});

// Giriş
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email ve şifre zorunlu' });

  db.get(`SELECT * FROM users WHERE email = ?`, [email.trim().toLowerCase()], async (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Email veya şifre hatalı' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Email veya şifre hatalı' });

    const token = randomToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.run(
      `INSERT INTO sessions (deviceId, deviceName, token, expiresAt, userId, isAdmin)
       VALUES (?, 'Web', ?, ?, ?, ?)`,
      [`user_${user.id}_${Date.now()}`, token, expiresAt, user.id, user.isAdmin],
      err => {
        if (err) return res.status(500).json({ error: 'Oturum oluşturulamadı' });
        logger.info(`Kullanıcı girişi: ${email}`);
        res.json({
          success: true,
          token,
          expiresAt,
          user: { id: user.id, email: user.email, isAdmin: user.isAdmin, emailVerified: user.emailVerified },
        });
      }
    );
  });
});

// E-posta doğrulama
router.get('/verify-email', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token gerekli' });

  db.run(
    `UPDATE users SET emailVerified = 1, verificationToken = NULL WHERE verificationToken = ?`,
    [token],
    function(err) {
      if (err || this.changes === 0) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş token' });
      res.json({ success: true, message: 'E-posta doğrulandı' });
    }
  );
});

// Şifre sıfırlama isteği
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email zorunlu' });

  db.get(`SELECT * FROM users WHERE email = ?`, [email.trim().toLowerCase()], async (err, user) => {
    // Kullanıcı yoksa da success dön (bilgi sızdırma önlemi)
    if (!user) return res.json({ success: true });

    const resetToken = randomToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.run(`UPDATE users SET resetToken = ?, resetTokenExpires = ? WHERE id = ?`, [resetToken, expires, user.id]);

    const row = await new Promise(r => db.get('SELECT email, appPassword FROM mailboxes LIMIT 1', (_, v) => r(v)));
    if (row) {
      const link = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      const ms = new MailService(row.email, row.appPassword);
      ms.sendMail(user.email, 'Şifre Sıfırlama', `
        <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#111827;">Şifre Sıfırlama</h2>
          <p style="color:#6b7280;margin:0 0 24px;">Bu linke tıklayarak yeni şifrenizi belirleyebilirsiniz. Link 1 saat geçerlidir.</p>
          <a href="${link}" style="display:inline-block;background:#00c896;color:#07090f;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Şifreyi Sıfırla</a>
        </div>
      `).catch(() => {});
    }
    res.json({ success: true });
  });
});

// Yeni şifre belirle
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token ve şifre zorunlu' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });

  const now = new Date().toISOString();
  db.get(`SELECT * FROM users WHERE resetToken = ? AND resetTokenExpires > ?`, [token, now], async (err, user) => {
    if (!user) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş link' });
    const passwordHash = await bcrypt.hash(password, 10);
    db.run(`UPDATE users SET passwordHash = ?, resetToken = NULL, resetTokenExpires = NULL WHERE id = ?`, [passwordHash, user.id]);
    res.json({ success: true, message: 'Şifre güncellendi' });
  });
});

// Mevcut kullanıcı bilgisi + kredi
router.get('/me', requireAuth, (req, res) => {
  if (req.isAdmin && !req.userId) {
    return res.json({ success: true, user: { isAdmin: true }, credits: null });
  }
  db.get(`SELECT id, email, isAdmin, emailVerified, createdAt FROM users WHERE id = ?`, [req.userId], (err, user) => {
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    db.get(`SELECT balance FROM user_credits WHERE userId = ?`, [req.userId], (_, credits) => {
      res.json({ success: true, user, credits: credits?.balance ?? 0 });
    });
  });
});

module.exports = router;
