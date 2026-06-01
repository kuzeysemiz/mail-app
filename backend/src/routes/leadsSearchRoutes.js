const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const SCRAPER_URL = process.env.MAPS_SCRAPER_URL || 'http://maps-scraper:8080';
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const INVALID_EXTS = /\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|js|css|woff|ttf)$/i;
const SCRAPE_TIMEOUT = 8000;
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

// In-memory job store (sunucu yeniden başlayınca temizlenir)
const searchJobs = new Map();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractEmails(html) {
  return (html.match(EMAIL_REGEX) || [])
    .map(e => e.toLowerCase())
    .filter(e => !INVALID_EXTS.test(e) && e.includes('.') && !e.startsWith('.'));
}

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    timeout: SCRAPE_TIMEOUT, headers: HTTP_HEADERS, maxRedirects: 4, maxContentLength: 500_000,
  });
  return typeof resp.data === 'string' ? resp.data : '';
}

async function findContactLink(html, baseUrl) {
  const $ = cheerio.load(html);
  const pattern = /contact|iletisim|ulasin|bize-yazin/i;
  let found = null;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (pattern.test(href) || pattern.test($(el).text())) { found = href; return false; }
  });
  if (!found) return null;
  try { return new URL(found, baseUrl).href; } catch { return null; }
}

async function scrapeEmails(websiteUrl) {
  const emails = new Set();
  let baseUrl;
  try { baseUrl = new URL(websiteUrl).origin; } catch { return []; }
  const tryFetch = async (url) => {
    try {
      const html = await fetchHtml(url);
      extractEmails(html).forEach(e => emails.add(e));
      return html;
    } catch { return null; }
  };
  const mainHtml = await tryFetch(websiteUrl);
  if (mainHtml) {
    const contactLink = await findContactLink(mainHtml, baseUrl);
    if (contactLink && contactLink !== websiteUrl) await tryFetch(contactLink);
  }
  await Promise.allSettled(['/contact', '/iletisim', '/bize-ulasin', '/contact-us'].map(p => tryFetch(baseUrl + p)));
  return [...emails];
}

async function waitForScraper(maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`${SCRAPER_URL}/api/v1/health`, { timeout: 3000 });
      return true;
    } catch {
      if (i < maxAttempts - 1) await sleep(3000);
    }
  }
  return false;
}

async function submitJob(keyword) {
  const resp = await axios.post(`${SCRAPER_URL}/api/v1/jobs`, {
    name: keyword.substring(0, 60),
    keywords: [keyword],
    lang: 'en',
    depth: 3,
    fastmode: true,
    email: false,
    maxtime: '5m',
  }, { timeout: 10000 });
  // API yanıtında id alanı farklı isimde olabilir
  return resp.data.id || resp.data.job_id || resp.data.ID;
}

async function pollJob(jobId, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(3000);
    try {
      const resp = await axios.get(`${SCRAPER_URL}/api/v1/jobs/${jobId}`, { timeout: 10000 });
      const data = resp.data;
      const status = (data.status || '').toLowerCase();
      if (['completed', 'done', 'finished'].includes(status)) {
        return data.results || data.data || [];
      }
      if (['failed', 'error', 'cancelled'].includes(status)) return [];
    } catch { /* geçici hata */ }
  }
  return [];
}

function buildQuery(categoryQuery, district, city, options) {
  let q = `${categoryQuery} ${district} ${city}`;
  if (options?.hotelStars && categoryQuery.includes('otel')) {
    q = `${options.hotelStars} yıldızlı otel ${district} ${city}`;
  }
  return q.trim();
}

// Arka planda tüm aramaları yürüt
async function runSearchJobs(queryId, queries, options) {
  const job = searchJobs.get(queryId);
  if (!job) return;

  try {
    const ready = await waitForScraper();
    if (!ready) {
      job.status = 'error';
      job.error = 'Harita tarayıcı servisi hazır değil, 10-20 saniye sonra tekrar deneyin';
      return;
    }

    // Tüm gosom job'larını paralel başlat
    const submitResults = await Promise.allSettled(queries.map(q => submitJob(q)));
    const firstError = submitResults.find(r => r.status === 'rejected');
    const jobIds = submitResults.filter(r => r.status === 'fulfilled').map(r => r.value);

    if (jobIds.length === 0) {
      const errMsg = firstError?.reason?.response?.data
        ? JSON.stringify(firstError.reason.response.data)
        : (firstError?.reason?.message || 'bilinmeyen hata');
      job.status = 'error';
      job.error = `Arama başlatılamadı: ${errMsg}`;
      return;
    }

    job.total = jobIds.length;

    // Her job'u paralel poll et, tamamlandıkça ekle
    await Promise.allSettled(jobIds.map(async (id) => {
      const results = await pollJob(id);
      job.rawResults.push(...results);
      job.completed++;
    }));

    // Deduplicate
    const seen = new Set();
    const unique = job.rawResults.filter(b => {
      const key = b.place_id || `${b.title}|${b.address}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    // Email tarama
    const withEmails = await Promise.allSettled(
      unique.map(async (b) => {
        const emails = b.website ? await scrapeEmails(b.website).catch(() => []) : [];
        return {
          name: b.title || '', address: b.address || '', phone: b.phone || '',
          website: b.website || '', rating: b.review_rating || null,
          reviewCount: b.review_count || 0, emails,
        };
      })
    );

    job.results = withEmails.filter(r => r.status === 'fulfilled').map(r => r.value);
    job.status = 'completed';
  } catch {
    job.status = 'error';
    job.error = 'Beklenmeyen bir hata oluştu';
  }
}

// GET /api/leads-search/debug — gosom API probe (auth gerekmez, geçici)
async function debugHandler(req, res) {
  const results = {};
  try {
    const h = await axios.get(`${SCRAPER_URL}/api/v1/health`, { timeout: 4000 });
    results.health = h.data;
  } catch (e) { results.health = e.message; }

  // Doğru endpoint testi
  try {
    const r = await axios.post(`${SCRAPER_URL}/api/v1/jobs`, {
      name: 'test-job', keywords: ['restoran Kadıköy İstanbul'],
      lang: 'en', depth: 1, fastmode: true, email: false, maxtime: '2m',
    }, { timeout: 6000 });
    results['POST /api/v1/jobs (correct)'] = { status: r.status, data: r.data };
  } catch (e) {
    results['POST /api/v1/jobs (correct)'] = { status: e.response?.status, data: e.response?.data, msg: e.message };
  }
  res.json(results);
}

// POST /api/leads-search/search — hemen queryId döner, arka planda çalışır
router.post('/search', async (req, res) => {
  const { city, districts, categories, options = {} } = req.body;
  if (!city) return res.status(400).json({ error: 'Şehir seçin' });
  if (!districts?.length) return res.status(400).json({ error: 'En az bir ilçe seçin' });
  if (!categories?.length) return res.status(400).json({ error: 'En az bir kategori seçin' });

  const queries = [];
  for (const district of districts) {
    for (const cat of categories) {
      queries.push(buildQuery(cat.query, district, city, options));
    }
  }

  const queryId = crypto.randomBytes(16).toString('hex');
  searchJobs.set(queryId, {
    status: 'running', results: [], rawResults: [],
    total: queries.length, completed: 0, error: null,
  });

  // Arka planda başlat, hemen yanıt ver
  runSearchJobs(queryId, queries, options);

  res.json({ queryId, total: queries.length });
});

// GET /api/leads-search/status/:queryId — frontend bu endpoint'i poll eder
router.get('/status/:queryId', (req, res) => {
  const job = searchJobs.get(req.params.queryId);
  if (!job) return res.status(404).json({ error: 'Sorgu bulunamadı veya süresi dolmuş' });
  res.json({
    status: job.status,
    completed: job.completed,
    total: job.total,
    results: job.status === 'completed' ? job.results : [],
    error: job.error,
  });
});

module.exports = router;
module.exports.debugHandler = debugHandler;
