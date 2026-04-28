const express = require('express');
const router = express.Router();
const db = require('../models/database');
const https = require('https');

// Tüm şirketleri listele
router.get('/companies', (req, res) => {
  const { q } = req.query;
  let query = `SELECT company, domain, COUNT(*) as count FROM leads WHERE company IS NOT NULL`;
  const params = [];
  if (q) {
    query += ` AND (company LIKE ? OR domain LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  query += ` GROUP BY company ORDER BY company ASC`;
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json(rows);
  });
});

// Şirkete göre title listesi
router.get('/titles', (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company parametresi gerekli' });
  db.all(
    `SELECT DISTINCT title FROM leads WHERE company = ? AND title IS NOT NULL ORDER BY title ASC`,
    [company],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows.map(r => r.title));
    }
  );
});

// Kişileri listele (filtreli)
router.get('/', (req, res) => {
  const { company, title, q } = req.query;
  let query = `SELECT * FROM leads WHERE 1=1`;
  const params = [];
  if (company) { query += ` AND company = ?`; params.push(company); }
  if (title)   { query += ` AND title = ?`;   params.push(title); }
  if (q)       { query += ` AND (firstName LIKE ? OR lastName LIKE ? OR email LIKE ?)`;
                 params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  query += ` ORDER BY company, lastName, firstName ASC`;
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json(rows);
  });
});

// API key kaydet
router.post('/apikey', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.trim()) return res.status(400).json({ error: 'API anahtarı boş olamaz' });
  db.run(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('hunter_api_key', ?)`,
    [apiKey.trim()],
    (err) => {
      if (err) return res.status(500).json({ error: 'Kaydedilemedi' });
      res.json({ success: true });
    }
  );
});

// API key durumunu getir (maskelenmiş)
router.get('/apikey', (req, res) => {
  db.get(`SELECT value FROM settings WHERE key = 'hunter_api_key'`, (err, row) => {
    if (err || !row) return res.json({ saved: false });
    const v = row.value;
    const masked = v.slice(0, 4) + '*'.repeat(Math.max(4, v.length - 8)) + v.slice(-4);
    res.json({ saved: true, masked });
  });
});

// API key sil
router.delete('/apikey', (req, res) => {
  db.run(`DELETE FROM settings WHERE key = 'hunter_api_key'`, (err) => {
    if (err) return res.status(500).json({ error: 'Silinemedi' });
    res.json({ success: true });
  });
});

// Hunter.io'dan import et
router.post('/import', async (req, res) => {
  // Önce kaydedilmiş key'i dene, yoksa body'den al
  const getKey = () => new Promise((resolve) => {
    db.get(`SELECT value FROM settings WHERE key = 'hunter_api_key'`, (err, row) => {
      resolve(row?.value || req.body?.apiKey || null);
    });
  });

  const apiKey = await getKey();
  if (!apiKey) return res.status(400).json({ error: 'Hunter.io API anahtarı bulunamadı' });

  const limit = 100;
  let totalImported = 0;
  let totalDuplicate = 0;
  let totalNoEmail = 0;

  const fetchPage = (offset) => new Promise((resolve, reject) => {
    const url = `https://api.hunter.io/v2/leads?api_key=${encodeURIComponent(apiKey)}&limit=${limit}&offset=${offset}`;
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Hunter.io yanıtı ayrıştırılamadı')); }
      });
    }).on('error', reject);
  });

  try {
    // meta.total'a güvenmek yerine sayfa boşalana kadar döngü
    const allLeads = [];
    let offset = 0;
    while (true) {
      const page = await fetchPage(offset);
      if (page.errors) {
        return res.status(400).json({ error: page.errors[0]?.details || 'Hunter.io API hatası' });
      }
      const batch = page.data?.leads || [];
      allLeads.push(...batch);
      if (batch.length < limit) break; // son sayfa
      offset += limit;
    }

    // DB'ye kaydet — INSERT OR IGNORE ile mevcut emailler atlanır
    await new Promise((resolve) => {
      db.serialize(() => {
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO leads (company, domain, firstName, lastName, email, title, confidence, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'hunter')`
        );
        allLeads.forEach(lead => {
          if (!lead.email) { totalNoEmail++; return; }
          stmt.run(
            lead.company || null,
            lead.domain || null,
            lead.first_name || null,
            lead.last_name || null,
            lead.email,
            lead.position || null,
            lead.confidence || null,
            function(err) {
              if (err || this.changes === 0) totalDuplicate++;
              else totalImported++;
            }
          );
        });
        stmt.finalize(resolve);
      });
    });

    res.json({ success: true, totalImported, totalDuplicate, totalNoEmail, totalFetched: allLeads.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İstatistik
router.get('/stats', (req, res) => {
  db.get(
    `SELECT COUNT(*) as total, COUNT(DISTINCT company) as companies FROM leads`,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(row);
    }
  );
});

module.exports = router;
