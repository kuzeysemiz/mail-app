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

// Hunter.io'dan import et
router.post('/import', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'Hunter.io API anahtarı gerekli' });

  let offset = 0;
  const limit = 100;
  let totalImported = 0;
  let totalSkipped = 0;

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
    // İlk sayfayı çek, toplam sayıyı öğren
    const first = await fetchPage(0);
    if (first.errors) {
      return res.status(400).json({ error: first.errors[0]?.details || 'Hunter.io API hatası' });
    }

    const total = first.data?.meta?.total || 0;
    const allLeads = [...(first.data?.leads || [])];

    // Kalan sayfaları çek
    const pages = Math.ceil(total / limit);
    for (let p = 1; p < pages; p++) {
      const page = await fetchPage(p * limit);
      allLeads.push(...(page.data?.leads || []));
    }

    // DB'ye kaydet
    await new Promise((resolve) => {
      db.serialize(() => {
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO leads (company, domain, firstName, lastName, email, title, confidence, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'hunter')`
        );
        allLeads.forEach(lead => {
          if (!lead.email) { totalSkipped++; return; }
          stmt.run(
            lead.company || null,
            lead.domain || null,
            lead.first_name || null,
            lead.last_name || null,
            lead.email,
            lead.position || null,
            lead.confidence || null,
            function(err) {
              if (err || this.changes === 0) totalSkipped++;
              else totalImported++;
            }
          );
        });
        stmt.finalize(resolve);
      });
    });

    res.json({ success: true, totalImported, totalSkipped, totalFetched: allLeads.length });
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
