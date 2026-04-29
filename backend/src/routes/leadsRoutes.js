const express = require('express');
const router = express.Router();
const db = require('../models/database');
const https = require('https');
const Groq = require('groq-sdk');

// Tüm şirketleri listele (tag filtreli, her şirkete tag'leri ekli)
router.get('/companies', (req, res) => {
  const { q, tag } = req.query;

  // Önce tag filtreli şirket + count sorgula
  let companyQuery = `
    SELECT l.company, l.domain, COUNT(*) as count
    FROM leads l
    WHERE l.company IS NOT NULL
  `;
  const params = [];

  if (tag) {
    companyQuery += ` AND l.company IN (SELECT company FROM company_tags WHERE tag = ?)`;
    params.push(tag);
  }
  if (q) {
    companyQuery += ` AND (l.company LIKE ? OR l.domain LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  companyQuery += ` GROUP BY l.company ORDER BY l.company ASC`;

  db.all(companyQuery, params, (err, companies) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (companies.length === 0) return res.json([]);

    // Her şirketin tag'lerini çek
    const companyNames = companies.map(c => `'${c.company.replace(/'/g, "''")}'`).join(',');
    db.all(
      `SELECT company, tag FROM company_tags WHERE company IN (${companyNames}) ORDER BY tag ASC`,
      [],
      (err2, tagRows) => {
        const tagMap = {};
        if (!err2) tagRows.forEach(r => {
          if (!tagMap[r.company]) tagMap[r.company] = [];
          tagMap[r.company].push(r.tag);
        });
        const result = companies.map(c => ({ ...c, tags: tagMap[c.company] || [] }));
        res.json(result);
      }
    );
  });
});

// Tüm distinct tag'leri getir
router.get('/tags', (req, res) => {
  db.all(
    `SELECT tag, COUNT(*) as count FROM company_tags GROUP BY tag ORDER BY count DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows);
    }
  );
});

// Şirketi boş olan lead'leri analiz edip şirket ata
router.post('/fill-companies', async (req, res) => {
  db.all(
    `SELECT id, email, domain FROM leads WHERE company IS NULL OR company = ''`,
    async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      if (rows.length === 0) return res.json({ filled: 0, message: 'Tüm lead\'lerin şirketi zaten dolu' });

      rows.forEach(r => {
        if (!r.domain && r.email && r.email.includes('@')) {
          r.domain = r.email.split('@')[1].toLowerCase().trim();
        }
      });

      db.all(
        `SELECT DISTINCT domain, company FROM leads WHERE company IS NOT NULL AND company != '' AND domain IS NOT NULL AND domain != ''`,
        async (err2, domainMap) => {
          if (err2) return res.status(500).json({ error: 'Veritabanı hatası' });

          const domainToCompany = {};
          domainMap.forEach(r => { if (!domainToCompany[r.domain]) domainToCompany[r.domain] = r.company; });

          const toUpdate = [];
          const needAI = {};

          rows.forEach(r => {
            if (!r.domain) return;
            const existing = domainToCompany[r.domain];
            if (existing) {
              toUpdate.push({ id: r.id, company: existing, domain: r.domain });
            } else {
              if (!needAI[r.domain]) needAI[r.domain] = [];
              needAI[r.domain].push({ id: r.id, domain: r.domain });
            }
          });

          const aiDomains = Object.keys(needAI);
          const aiMap = {};

          if (aiDomains.length > 0 && process.env.GROQ_API_KEY) {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const BATCH = 50;
            const batches = [];
            for (let i = 0; i < aiDomains.length; i += BATCH) {
              batches.push(aiDomains.slice(i, i + BATCH));
            }
            const results = await Promise.all(batches.map(async batch => {
              const list = batch.map((d, idx) => `${idx + 1}. ${d}`).join('\n');
              try {
                const completion = await groq.chat.completions.create({
                  model: 'llama-3.3-70b-versatile',
                  max_tokens: 1024,
                  temperature: 0.1,
                  messages: [
                    {
                      role: 'system',
                      content: `Verilen domain adreslerinden şirket isimlerini çıkar. Kısa ve resmi şirket ismi kullan.
SADECE geçerli JSON döndür, başka hiçbir şey yazma. Format: {"domain.com": "Şirket Adı"}`
                    },
                    { role: 'user', content: `Bu domainlerin şirket isimlerini ver:\n${list}` }
                  ]
                });
                const raw = completion.choices[0].message.content.trim();
                const jsonMatch = raw.match(/\{[\s\S]*\}/);
                return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
              } catch { return {}; }
            }));
            results.forEach(r => Object.assign(aiMap, r));
          }

          aiDomains.forEach(domain => {
            const company = aiMap[domain] || domain;
            needAI[domain].forEach(r => toUpdate.push({ id: r.id, company, domain }));
          });

          let filled = 0;
          await new Promise(resolve => {
            db.serialize(() => {
              const stmt = db.prepare(`UPDATE leads SET company = ?, domain = ? WHERE id = ?`);
              toUpdate.forEach(r => { stmt.run(r.company, r.domain, r.id); filled++; });
              stmt.finalize(resolve);
            });
          });

          res.json({ success: true, filled, total: rows.length });
        }
      );
    }
  );
});

// AI ile şirketleri otomatik etiketle
router.post('/auto-tag', async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY eksik' });
  }

  // Sadece henüz hiç etiketi olmayan şirketleri al
  db.all(
    `SELECT DISTINCT l.company FROM leads l
     WHERE l.company IS NOT NULL
       AND l.company NOT IN (SELECT DISTINCT company FROM company_tags)
     ORDER BY l.company ASC`,
    async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      if (rows.length === 0) return res.json({ tagged: 0, skipped: 'Tüm şirketler zaten etiketli' });

      const companies = rows.map(r => r.company);

      // 50'şer gruplara böl (prompt sınırı için)
      const BATCH = 50;
      const batches = [];
      for (let i = 0; i < companies.length; i += BATCH) {
        batches.push(companies.slice(i, i + BATCH));
      }

      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const allResults = {};

      for (const batch of batches) {
        const list = batch.map((c, i) => `${i + 1}. ${c}`).join('\n');
        try {
          const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 2048,
            temperature: 0.1,
            messages: [
              {
                role: 'system',
                content: `Sen bir iş sektörü sınıflandırma uzmanısın. Verilen şirket isimlerinin her birine maksimum 2 sektör etiketi ata.
Etiketler Türkçe, kısa (1-2 kelime) ve genel sektör isimleri olmalı.
Örnekler: Teknoloji, Lojistik, E-ticaret, Finans, Sağlık, Perakende, Üretim, Medya, Eğitim, Gayrimenkul, Enerji, Tarım, Turizm, Hukuk, Danışmanlık, Sigorta, Gıda, Otomotiv, Tekstil, İnşaat

SADECE geçerli JSON döndür, başka hiçbir şey yazma. Format:
{"Şirket İsmi": ["Tag1", "Tag2"], "Diğer Şirket": ["Tag1"]}`
              },
              {
                role: 'user',
                content: `Bu şirketleri sınıflandır:\n${list}`
              }
            ]
          });

          const raw = completion.choices[0].message.content.trim();
          // JSON bloğunu çıkar
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            Object.assign(allResults, parsed);
          }
        } catch (e) {
          // Batch başarısız olursa devam et
        }
      }

      // company_tags tablosuna kaydet
      let tagged = 0;
      await new Promise((resolve) => {
        db.serialize(() => {
          const stmt = db.prepare(`INSERT OR IGNORE INTO company_tags (company, tag) VALUES (?, ?)`);
          for (const [company, tags] of Object.entries(allResults)) {
            const validTags = (Array.isArray(tags) ? tags : []).slice(0, 2);
            validTags.forEach(tag => {
              if (typeof tag === 'string' && tag.trim()) {
                stmt.run(company, tag.trim());
                tagged++;
              }
            });
          }
          stmt.finalize(resolve);
        });
      });

      res.json({ success: true, tagged, companies: companies.length });
    }
  );
});

// Rastgele lead seç
router.get('/random', (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 10, 500);
  const excludeSent = req.query.excludeSent === 'true';

  let query = `SELECT * FROM leads WHERE email IS NOT NULL`;
  if (excludeSent) {
    query += ` AND email NOT IN (
      SELECT DISTINCT recipientEmail FROM logs WHERE status IN ('sent','success')
    )`;
  }
  query += ` ORDER BY RANDOM() LIMIT ?`;

  db.all(query, [count], (err, rows) => {
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
