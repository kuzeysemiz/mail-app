const express = require('express');
const router = express.Router();
const db = require('../models/database');
const https = require('https');
const Groq = require('groq-sdk');

function userFilter(req, alias = 'l') {
  if (req.isAdmin) return { clause: '', params: [] };
  return { clause: `AND ${alias}.userId = ?`, params: [req.userId] };
}

function tagFilter(req, alias = 'ct') {
  if (req.isAdmin) return { clause: '', params: [] };
  return { clause: `AND ${alias}.userId = ?`, params: [req.userId] };
}

// Tüm şirketleri listele (tag filtreli, her şirkete tag'leri ekli)
router.get('/companies', (req, res) => {
  const { q, tag } = req.query;
  const uf = userFilter(req, 'l');
  const tf = tagFilter(req, 'ct');

  let companyQuery = `SELECT l.company, l.domain, COUNT(*) as count FROM leads l WHERE l.company IS NOT NULL ${uf.clause}`;
  const params = [...uf.params];

  if (tag) {
    companyQuery += ` AND l.company IN (SELECT company FROM company_tags ct WHERE tag = ? ${tf.clause})`;
    params.push(tag, ...tf.params);
  }
  if (q) {
    companyQuery += ` AND (l.company LIKE ? OR l.domain LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`);
  }
  companyQuery += ` GROUP BY l.company ORDER BY l.company ASC`;

  db.all(companyQuery, params, (err, companies) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (companies.length === 0) return res.json([]);

    const placeholders = companies.map(() => '?').join(',');
    const companyNames = companies.map(c => c.company);
    const tf2 = tagFilter(req, 'ct');
    db.all(
      `SELECT ct.company, ct.tag FROM company_tags ct WHERE ct.company IN (${placeholders}) ${tf2.clause} ORDER BY ct.tag ASC`,
      [...companyNames, ...tf2.params],
      (err2, tagRows) => {
        const tagMap = {};
        if (!err2) tagRows.forEach(r => {
          if (!tagMap[r.company]) tagMap[r.company] = [];
          tagMap[r.company].push(r.tag);
        });
        res.json(companies.map(c => ({ ...c, tags: tagMap[c.company] || [] })));
      }
    );
  });
});

// Tüm distinct tag'leri getir
router.get('/tags', (req, res) => {
  const tf = tagFilter(req, 'ct');
  db.all(
    `SELECT ct.tag, COUNT(*) as count FROM company_tags ct WHERE 1=1 ${tf.clause} GROUP BY ct.tag ORDER BY count DESC`,
    tf.params,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows);
    }
  );
});

// Şirketi boş olan lead'leri analiz edip şirket ata
router.post('/fill-companies', async (req, res) => {
  const uf = userFilter(req, 'l');
  db.all(
    `SELECT l.id, l.email, l.domain FROM leads l WHERE (l.company IS NULL OR l.company = '') ${uf.clause}`,
    uf.params,
    async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      if (rows.length === 0) return res.json({ filled: 0, message: "Tüm lead'lerin şirketi zaten dolu" });

      rows.forEach(r => {
        if (!r.domain && r.email && r.email.includes('@')) {
          r.domain = r.email.split('@')[1].toLowerCase().trim();
        }
      });

      const uf2 = userFilter(req, 'l');
      db.all(
        `SELECT DISTINCT l.domain, l.company FROM leads l WHERE l.company IS NOT NULL AND l.company != '' AND l.domain IS NOT NULL AND l.domain != '' ${uf2.clause}`,
        uf2.params,
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
            for (let i = 0; i < aiDomains.length; i += BATCH) batches.push(aiDomains.slice(i, i + BATCH));
            const results = await Promise.all(batches.map(async batch => {
              const list = batch.map((d, idx) => `${idx + 1}. ${d}`).join('\n');
              try {
                const completion = await groq.chat.completions.create({
                  model: 'llama-3.3-70b-versatile',
                  max_tokens: 1024,
                  temperature: 0.1,
                  messages: [
                    { role: 'system', content: `Verilen domain adreslerinden şirket isimlerini çıkar. Kısa ve resmi şirket ismi kullan.\nSADECE geçerli JSON döndür, başka hiçbir şey yazma. Format: {"domain.com": "Şirket Adı"}` },
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
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY eksik' });

  const uf = userFilter(req, 'l');
  const tf = tagFilter(req, 'ct');
  db.all(
    `SELECT DISTINCT l.company FROM leads l
     WHERE l.company IS NOT NULL
       AND l.company NOT IN (SELECT DISTINCT ct.company FROM company_tags ct WHERE 1=1 ${tf.clause})
       ${uf.clause}
     ORDER BY l.company ASC`,
    [...tf.params, ...uf.params],
    async (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      if (rows.length === 0) return res.json({ tagged: 0, skipped: 'Tüm şirketler zaten etiketli' });

      const companies = rows.map(r => r.company);
      const BATCH = 50;
      const batches = [];
      for (let i = 0; i < companies.length; i += BATCH) batches.push(companies.slice(i, i + BATCH));

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
              { role: 'user', content: `Bu şirketleri sınıflandır:\n${list}` }
            ]
          });
          const raw = completion.choices[0].message.content.trim();
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) Object.assign(allResults, JSON.parse(jsonMatch[0]));
        } catch { /* batch başarısız, devam et */ }
      }

      const userId = req.isAdmin ? null : req.userId;
      let tagged = 0;
      await new Promise(resolve => {
        db.serialize(() => {
          const stmt = db.prepare(`INSERT OR IGNORE INTO company_tags (company, tag, userId) VALUES (?, ?, ?)`);
          for (const [company, tags] of Object.entries(allResults)) {
            const validTags = (Array.isArray(tags) ? tags : []).slice(0, 2);
            validTags.forEach(tag => {
              if (typeof tag === 'string' && tag.trim()) { stmt.run(company, tag.trim(), userId); tagged++; }
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
  const { company, title, tag, q } = req.query;
  const uf = userFilter(req, 'l');
  const tf = tagFilter(req, 'ct');

  let query = `SELECT l.* FROM leads l WHERE l.email IS NOT NULL ${uf.clause}`;
  const params = [...uf.params];

  if (company) { query += ` AND l.company = ?`; params.push(company); }
  if (title)   { query += ` AND l.title = ?`;   params.push(title); }
  if (q)       { query += ` AND (l.firstName LIKE ? OR l.lastName LIKE ? OR l.email LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (tag)     { query += ` AND l.company IN (SELECT ct.company FROM company_tags ct WHERE ct.tag = ? ${tf.clause})`; params.push(tag, ...tf.params); }
  if (excludeSent) {
    query += ` AND l.email NOT IN (SELECT DISTINCT recipientEmail FROM logs WHERE status IN ('sent','success'))`;
  }
  query += ` ORDER BY RANDOM() LIMIT ?`;
  params.push(count);

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json(rows);
  });
});

// Şirkete göre title listesi
router.get('/titles', (req, res) => {
  const { company } = req.query;
  if (!company) return res.status(400).json({ error: 'company parametresi gerekli' });
  const uf = userFilter(req, 'l');
  db.all(
    `SELECT DISTINCT l.title FROM leads l WHERE l.company = ? AND l.title IS NOT NULL ${uf.clause} ORDER BY l.title ASC`,
    [company, ...uf.params],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(rows.map(r => r.title));
    }
  );
});

// Kişileri listele (filtreli)
router.get('/', (req, res) => {
  const { company, title, q } = req.query;
  const uf = userFilter(req, 'l');
  let query = `SELECT l.* FROM leads l WHERE 1=1 ${uf.clause}`;
  const params = [...uf.params];
  if (company) { query += ` AND l.company = ?`; params.push(company); }
  if (title)   { query += ` AND l.title = ?`;   params.push(title); }
  if (q)       { query += ` AND (l.firstName LIKE ? OR l.lastName LIKE ? OR l.email LIKE ?)`; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  query += ` ORDER BY l.company, l.lastName, l.firstName ASC`;
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
  const getKey = () => new Promise(resolve => {
    db.get(`SELECT value FROM settings WHERE key = 'hunter_api_key'`, (err, row) => {
      resolve(row?.value || req.body?.apiKey || null);
    });
  });

  const apiKey = await getKey();
  if (!apiKey) return res.status(400).json({ error: 'Hunter.io API anahtarı bulunamadı' });

  const userId = req.isAdmin ? null : req.userId;
  const limit = 100;
  let totalImported = 0, totalDuplicate = 0, totalNoEmail = 0;

  const fetchPage = (offset) => new Promise((resolve, reject) => {
    const url = `https://api.hunter.io/v2/leads?api_key=${encodeURIComponent(apiKey)}&limit=${limit}&offset=${offset}`;
    https.get(url, resp => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Hunter.io yanıtı ayrıştırılamadı')); }
      });
    }).on('error', reject);
  });

  try {
    const allLeads = [];
    let offset = 0;
    while (true) {
      const page = await fetchPage(offset);
      if (page.errors) return res.status(400).json({ error: page.errors[0]?.details || 'Hunter.io API hatası' });
      const batch = page.data?.leads || [];
      allLeads.push(...batch);
      if (batch.length < limit) break;
      offset += limit;
    }

    await new Promise(resolve => {
      db.serialize(() => {
        const stmt = db.prepare(
          `INSERT OR IGNORE INTO leads (company, domain, firstName, lastName, email, title, confidence, source, userId)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'hunter', ?)`
        );
        allLeads.forEach(lead => {
          if (!lead.email) { totalNoEmail++; return; }
          stmt.run(
            lead.company || null, lead.domain || null, lead.first_name || null,
            lead.last_name || null, lead.email, lead.position || null, lead.confidence || null, userId,
            function(err) { if (err || this.changes === 0) totalDuplicate++; else totalImported++; }
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
  const uf = userFilter(req, 'l');
  db.get(
    `SELECT COUNT(*) as total, COUNT(DISTINCT l.company) as companies FROM leads l WHERE 1=1 ${uf.clause}`,
    uf.params,
    (err, row) => {
      if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
      res.json(row);
    }
  );
});

module.exports = router;
