const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../models/database');
const logger = require('../middleware/logger');

function getSetting(key) {
  return new Promise(r =>
    db.get(`SELECT value FROM settings WHERE key = ?`, [key], (_, row) => r(row?.value || null))
  );
}

// Public: frontend için client token
router.get('/config', async (req, res) => {
  const clientToken = await getSetting('paddle_client_token');
  const environment = await getSetting('paddle_environment') || 'sandbox';
  res.json({ clientToken, environment });
});

// Admin: Paddle anahtarlarını kaydet
router.post('/config', async (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Yetkisiz' });
  const { clientToken, apiKey, webhookSecret, environment } = req.body;
  const entries = [
    ['paddle_client_token', clientToken],
    ['paddle_api_key', apiKey],
    ['paddle_webhook_secret', webhookSecret],
    ['paddle_environment', environment || 'sandbox'],
  ].filter(([, v]) => v);

  await new Promise(resolve => {
    db.serialize(() => {
      const stmt = db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`);
      entries.forEach(([k, v]) => stmt.run(k, v));
      stmt.finalize(resolve);
    });
  });
  res.json({ success: true });
});

// Admin: paket için Paddle priceId ata
router.post('/packages/:slug/price', (req, res) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Yetkisiz' });
  const { paddlePriceId } = req.body;
  db.run(`UPDATE packages SET paddlePriceId = ? WHERE slug = ?`, [paddlePriceId, req.params.slug], function(err) {
    if (err) return res.status(500).json({ error: 'Güncellenemedi' });
    res.json({ success: true });
  });
});

// Paddle webhook — raw body ile çağrılır, server.js'de ayrı mount edilir
async function webhookHandler(req, res) {
  const signature = req.headers['paddle-signature'];
  const rawBody = req.body.toString();
  const secret = await getSetting('paddle_webhook_secret');

  if (secret && signature) {
    try {
      const parts = Object.fromEntries(signature.split(';').map(p => p.split('=')));
      const ts = parts['ts'];
      const h1 = parts['h1'];
      const expected = crypto.createHmac('sha256', secret)
        .update(`${ts}:${rawBody}`)
        .digest('hex');
      if (expected !== h1) {
        logger.warn('Paddle webhook imza uyuşmazlığı');
        return res.status(400).json({ error: 'Geçersiz imza' });
      }
    } catch {
      return res.status(400).json({ error: 'İmza doğrulanamadı' });
    }
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Geçersiz JSON' }); }

  if (event.event_type === 'transaction.completed') {
    const userId = event.data?.custom_data?.userId;
    const priceId = event.data?.items?.[0]?.price?.id;

    if (userId && priceId) {
      const pkg = await new Promise(r =>
        db.get(`SELECT * FROM packages WHERE paddlePriceId = ?`, [priceId], (_, row) => r(row))
      );
      if (pkg?.emailCount) {
        db.run(
          `INSERT INTO user_credits (userId, balance) VALUES (?, ?)
           ON CONFLICT(userId) DO UPDATE SET balance = balance + ?`,
          [userId, pkg.emailCount, pkg.emailCount]
        );
        db.run(
          `INSERT INTO credit_transactions (userId, amount, type, description) VALUES (?, ?, 'purchase', ?)`,
          [userId, pkg.emailCount, `${pkg.name} paketi satın alındı`]
        );
        logger.info(`Kredi yüklendi: userId=${userId} +${pkg.emailCount} (${pkg.name})`);
      }
    }
  }

  res.json({ received: true });
}

module.exports = { router, webhookHandler };
