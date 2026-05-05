const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../models/database');
const requireAuth = require('../middleware/auth');
const logger = require('../middleware/logger');
const MailService = require('../services/mailService');

const PERMISSIONS = ['credits', 'users', 'settings', 'stats'];
const PERMISSION_LABELS = {
  credits: 'Kredi Yönetimi',
  users: 'Kullanıcı Yönetimi',
  settings: 'Sistem Ayarları',
  stats: 'İstatistikler',
};

function requireAdmin(req, res, next) {
  // Legacy OTP admin (userId=null) — session yeterli
  if (!req.userId) {
    if (!req.isAdmin) return res.status(403).json({ error: 'Yetki gerekli' });
    return next();
  }
  // Kullanıcı bazlı admin: session cache'i değil DB'yi oku (yetki sonradan verilmiş olabilir)
  db.get(`SELECT isAdmin FROM users WHERE id = ?`, [req.userId], (err, row) => {
    if (!row || !row.isAdmin) return res.status(403).json({ error: 'Yetki gerekli' });
    next();
  });
}

function parsePerms(raw) {
  if (raw === null || raw === undefined) return null; // null = tüm yetkiler
  try { return JSON.parse(raw); } catch { return []; }
}

function hasPerm(raw, perm) {
  const arr = parsePerms(raw);
  if (arr === null) return true;
  return Array.isArray(arr) && arr.includes(perm);
}

// Belirli bir yetkiyi kontrol et
function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.userId) return next(); // kurucu admin
    db.get(`SELECT permissions FROM users WHERE id = ?`, [req.userId], (_, row) => {
      if (!row) return res.status(403).json({ error: 'Yetkisiz' });
      if (!hasPerm(row.permissions, perm))
        return res.status(403).json({ error: `Bu işlem için '${PERMISSION_LABELS[perm]}' yetkisi gerekli` });
      next();
    });
  };
}

// Tam yönetici: tüm 4 yetki seçili veya kurucu admin
function requireFullAdmin(req, res, next) {
  if (!req.userId) return next(); // kurucu admin
  db.get(`SELECT permissions FROM users WHERE id = ?`, [req.userId], (_, row) => {
    if (!row) return res.status(403).json({ error: 'Yetkisiz' });
    const perms = parsePerms(row.permissions);
    const isFull = perms === null || PERMISSIONS.every(p => perms.includes(p));
    if (!isFull) return res.status(403).json({ error: 'Bu işlem için tam yönetici yetkisi gerekli' });
    next();
  });
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

function randomOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getAdminMailbox() {
  return new Promise(r => db.get(`SELECT email, appPassword FROM mailboxes LIMIT 1`, (_, row) => r(row)));
}

async function sendAdminEmail(toEmail, subject, html) {
  const mb = await getAdminMailbox();
  if (!mb) return;
  const ms = new MailService(mb.email, mb.appPassword);
  await ms.sendMail(toEmail, subject, html).catch(() => {});
}

// Admin emailini bul: userId varsa users tablosundan, yoksa (legacy OTP admin) ilk mailbox emailini kullan
async function getAdminEmail(userId) {
  if (userId) {
    const row = await new Promise(r => db.get(`SELECT email FROM users WHERE id = ?`, [userId], (_, r2) => r(r2)));
    if (row) return row.email;
  }
  const mb = await getAdminMailbox();
  return mb ? mb.email : null;
}

// ── Tüm kullanıcılar — herhangi bir admin görebilir ──────────────────────────
router.get('/users', requireAuth, requireAdmin, (req, res) => {
  db.all(
    `SELECT u.id, u.email, u.isAdmin, u.emailVerified, u.createdAt, u.permissions,
            COALESCE(uc.balance, 0) as credits
     FROM users u
     LEFT JOIN user_credits uc ON uc.userId = u.id
     ORDER BY u.createdAt DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      // userId=NULL mailbox'ları varsa kurucu yöneticiyi listenin başına ekle
      db.get(`SELECT email FROM mailboxes WHERE userId IS NULL LIMIT 1`, (_, mb) => {
        const result = mb
          ? [{ id: null, email: mb.email, isAdmin: 1, emailVerified: 1, createdAt: null, credits: null, permissions: null, isFounder: true }, ...rows]
          : rows;
        res.json(result);
      });
    }
  );
});

// ── Kullanıcı sil — OTP iste — 'users' yetkisi gerekli ──────────────────────
router.delete('/users/:id', requireAuth, requireAdmin, requirePerm('users'), async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.userId) return res.status(400).json({ error: 'Kendinizi silemezsiniz' });

  const target = await new Promise(r => db.get(`SELECT id, email FROM users WHERE id = ?`, [targetId], (_, row) => r(row)));
  if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  const adminEmail = await getAdminEmail(req.userId);
  if (!adminEmail) return res.status(403).json({ error: 'Admin e-postası bulunamadı' });

  const otp = randomOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.run(
    `INSERT INTO pending_admin_actions (adminId, action, targetId, data, otp, expiresAt)
     VALUES (?, 'delete_user', ?, ?, ?, ?)`,
    [req.userId || null, targetId, JSON.stringify({ targetEmail: target.email }), otp, expiresAt],
    async function(err) {
      if (err) return res.status(500).json({ error: 'İşlem oluşturulamadı' });

      await sendAdminEmail(adminEmail, 'Kullanıcı Silme Onayı', `
        <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#111827;">Kullanıcı Silme Onayı</h2>
          <p style="color:#6b7280;margin:0 0 8px;"><strong>${target.email}</strong> adlı kullanıcıyı silmek için aşağıdaki kodu girin. Kod 10 dakika geçerlidir.</p>
          <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#ef4444;text-align:center;padding:20px;background:#fef2f2;border-radius:8px;">${otp}</div>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Bu isteği siz yapmadıysanız görmezden gelin.</p>
        </div>
      `);

      logger.info(`Kullanıcı silme OTP gönderildi: admin=${adminEmail}, target=${target.email}`);
      res.json({ success: true, actionId: this.lastID });
    }
  );
});

// ── Silme OTP onayla ─────────────────────────────────────────────────────────
router.post('/users/:id/delete-confirm', requireAuth, requireAdmin, requirePerm('users'), (req, res) => {
  const targetId = parseInt(req.params.id);
  const { otp, actionId } = req.body;
  if (!otp || !actionId) return res.status(400).json({ error: 'OTP ve actionId zorunlu' });

  const now = new Date().toISOString();
  db.get(
    `SELECT * FROM pending_admin_actions WHERE id = ? AND (adminId = ? OR (adminId IS NULL AND ? IS NULL)) AND action = 'delete_user' AND targetId = ? AND otp = ? AND expiresAt > ?`,
    [actionId, req.userId, req.userId, targetId, otp, now],
    (err, row) => {
      if (err || !row) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş kod' });

      db.run(`DELETE FROM pending_admin_actions WHERE id = ?`, [row.id]);
      db.run(`DELETE FROM users WHERE id = ?`, [targetId], function(err2) {
        if (err2 || this.changes === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        logger.info(`Kullanıcı silindi: userId=${targetId} by admin=${req.userId}`);
        res.json({ success: true });
      });
    }
  );
});

// ── Kullanıcı yetkilerini getir — tam admin gerekli ──────────────────────────
router.get('/users/:id/permissions', requireAuth, requireAdmin, requireFullAdmin, (req, res) => {
  db.get(`SELECT id, email, isAdmin, permissions FROM users WHERE id = ?`, [parseInt(req.params.id)], (err, row) => {
    if (!row) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    let perms = null;
    if (row.permissions !== null && row.permissions !== undefined) {
      try { perms = JSON.parse(row.permissions); } catch { perms = []; }
    }
    res.json({ userId: row.id, email: row.email, isAdmin: row.isAdmin, permissions: perms, allPermissions: PERMISSIONS, labels: PERMISSION_LABELS });
  });
});

// ── Kullanıcı yetkilerini güncelle — tam admin gerekli ───────────────────────
router.post('/users/:id/permissions', requireAuth, requireAdmin, requireFullAdmin, (req, res) => {
  const { permissions } = req.body; // null = super admin, dizi = kısıtlı
  const userId = parseInt(req.params.id);

  if (userId === req.userId) return res.status(400).json({ error: 'Kendi yetkilerinizi değiştiremezsiniz' });

  const permsValue = permissions === null
    ? null
    : JSON.stringify((Array.isArray(permissions) ? permissions : []).filter(p => PERMISSIONS.includes(p)));

  db.run(`UPDATE users SET permissions = ? WHERE id = ?`, [permsValue, userId], function(err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    logger.info(`Yetki güncellendi: userId=${userId}, permissions=${permsValue}`);
    res.json({ success: true });
  });
});

// ── Admin flag toggle — tam admin gerekli ────────────────────────────────────
router.post('/users/:id/toggle-admin', requireAuth, requireAdmin, requireFullAdmin, (req, res) => {
  const userId = parseInt(req.params.id);
  if (userId === req.userId) return res.status(400).json({ error: 'Kendi admin durumunuzu değiştiremezsiniz' });
  db.run(`UPDATE users SET isAdmin = CASE WHEN isAdmin = 1 THEN 0 ELSE 1 END WHERE id = ?`, [userId], function(err) {
    if (err || this.changes === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json({ success: true });
  });
});

// ── Kredi güncelle — onay maili gönder ───────────────────────────────────────
router.post('/users/:id/credits', requireAuth, requireAdmin, requirePerm('credits'), async (req, res) => {
  const { amount, description } = req.body;
  const targetId = parseInt(req.params.id);
  if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Miktar zorunlu' });

  const target = await new Promise(r => db.get(`SELECT id, email FROM users WHERE id = ?`, [targetId], (_, row) => r(row)));
  if (!target) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

  const adminEmail = await getAdminEmail(req.userId);
  if (!adminEmail) return res.status(403).json({ error: 'Admin e-postası bulunamadı' });

  const token = randomToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const amountNum = parseInt(amount);
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const confirmLink = `${appUrl}/api/admin/credits/confirm/${token}`;

  db.run(
    `INSERT INTO pending_admin_actions (adminId, action, targetId, data, token, expiresAt)
     VALUES (?, 'transfer_credits', ?, ?, ?, ?)`,
    [req.userId || null, targetId, JSON.stringify({ amount: amountNum, description: description || 'Admin işlemi' }), token, expiresAt],
    async function(err) {
      if (err) return res.status(500).json({ error: 'İşlem oluşturulamadı' });

      const actionLabel = amountNum > 0 ? `+${amountNum}` : `${amountNum}`;
      await sendAdminEmail(adminEmail, 'Kredi Transferi Onayı', `
        <div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#111827;">Kredi Transferi Onayı</h2>
          <p style="color:#6b7280;margin:0 0 8px;"><strong>${target.email}</strong> kullanıcısına <strong>${actionLabel} kredi</strong> göndermek istiyorsunuz.</p>
          ${description ? `<p style="color:#6b7280;margin:0 0 8px;">Açıklama: ${description}</p>` : ''}
          <p style="color:#6b7280;margin:0 0 24px;">Onaylamak için aşağıdaki butona tıklayın. Link 24 saat geçerlidir.</p>
          <a href="${confirmLink}" style="display:inline-block;background:#00c896;color:#07090f;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Transferi Onayla</a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Bu işlemi siz başlatmadıysanız görmezden gelin.</p>
        </div>
      `);

      logger.info(`Kredi onay maili gönderildi: admin=${adminEmail}, target=${target.email}, amount=${amountNum}`);
      res.json({ success: true, pending: true });
    }
  );
});

// ── Kredi onaylama linki (auth gerektirmez) ────────────────────────────────────
router.get('/credits/confirm/:token', (req, res) => {
  const { token } = req.params;
  const now = new Date().toISOString();

  db.get(
    `SELECT * FROM pending_admin_actions WHERE token = ? AND action = 'transfer_credits' AND expiresAt > ?`,
    [token, now],
    (err, row) => {
      if (err || !row) return res.status(400).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
          <h2 style="color:#ef4444;">Geçersiz veya süresi dolmuş link</h2>
        </body></html>
      `);

      const { amount, description } = JSON.parse(row.data);
      const targetId = row.targetId;

      db.run(`DELETE FROM pending_admin_actions WHERE id = ?`, [row.id]);
      db.run(`INSERT OR IGNORE INTO user_credits (userId, balance) VALUES (?, 0)`, [targetId], () => {
        db.run(`UPDATE user_credits SET balance = MAX(0, balance + ?) WHERE userId = ?`, [amount, targetId], function(err2) {
          if (err2) return res.status(500).send(`<html><body style="font-family:sans-serif;text-align:center;padding:60px;"><h2 style="color:#ef4444;">Hata oluştu</h2></body></html>`);
          db.run(
            `INSERT INTO credit_transactions (userId, amount, type, description) VALUES (?, ?, ?, ?)`,
            [targetId, amount, amount > 0 ? 'admin_add' : 'admin_deduct', description]
          );
          logger.info(`Kredi transferi onaylandı: targetId=${targetId}, amount=${amount}`);
          res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px;">
              <div style="max-width:400px;margin:0 auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
                <div style="font-size:48px;margin-bottom:16px;">✓</div>
                <h2 style="color:#00c896;margin:0 0 8px;">Transfer Onaylandı</h2>
                <p style="color:#6b7280;">${amount > 0 ? '+' : ''}${amount} kredi başarıyla aktarıldı.</p>
              </div>
            </body></html>
          `);
        });
      });
    }
  );
});

// ── Genel istatistikler — herhangi bir admin görebilir ───────────────────────
router.get('/stats', requireAuth, requireAdmin, (req, res) => {
  db.get(
    `SELECT
       (SELECT COUNT(*) FROM users) as totalUsers,
       (SELECT COUNT(*) FROM users WHERE emailVerified = 1) as verifiedUsers,
       (SELECT COALESCE(SUM(balance), 0) FROM user_credits) as totalCredits,
       (SELECT COUNT(*) FROM logs WHERE status = 'success') as totalEmailsSent`,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(row);
    }
  );
});

module.exports = router;
