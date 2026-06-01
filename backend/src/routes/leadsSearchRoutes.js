const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const FSQ_BASE = 'https://api.foursquare.com/v3/places/search';
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const INVALID_EXTS = /\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|js|css|woff|ttf)$/i;
const SCRAPE_TIMEOUT = 8000;
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

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

async function foursquareSearch(query, near) {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) throw new Error('FOURSQUARE_API_KEY tanımlı değil');
  const resp = await axios.get(FSQ_BASE, {
    params: { query, near, limit: 50, fields: 'fsq_id,name,location,tel,website,rating,stats' },
    headers: { Authorization: apiKey, Accept: 'application/json' },
    timeout: 10000,
  });
  return resp.data.results || [];
}

async function runSearchJobs(queryId, searchParams) {
  const job = searchJobs.get(queryId);
  if (!job) return;
  try {
    const { city, districts, categories } = searchParams;

    // Tüm (ilçe × kategori) aramalarını paralel yap
    const allResults = await Promise.allSettled(
      districts.flatMap(district =>
        categories.map(cat =>
          foursquareSearch(cat.query, `${district}, ${city}`)
        )
      )
    );

    const merged = allResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Deduplicate
    const seen = new Set();
    const unique = merged.filter(b => {
      const key = b.fsq_id || `${b.name}|${b.location?.formatted_address}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    job.total = unique.length;

    // Email tarama paralel
    const withEmails = await Promise.allSettled(
      unique.map(async (b) => {
        const emails = b.website ? await scrapeEmails(b.website).catch(() => []) : [];
        job.completed++;
        return {
          name: b.name || '',
          address: b.location?.formatted_address || b.location?.address || '',
          phone: b.tel || '',
          website: b.website || '',
          rating: b.rating ? Math.round((b.rating / 2) * 10) / 10 : null,
          reviewCount: b.stats?.total_ratings || 0,
          emails,
        };
      })
    );

    job.results = withEmails.filter(r => r.status === 'fulfilled').map(r => r.value);
    job.status = 'completed';
  } catch (e) {
    job.status = 'error';
    job.error = e.message || 'Beklenmeyen hata';
  }
}

// POST /api/leads-search/search
router.post('/search', async (req, res) => {
  const { city, districts, categories } = req.body;
  if (!city) return res.status(400).json({ error: 'Şehir seçin' });
  if (!districts?.length) return res.status(400).json({ error: 'En az bir ilçe seçin' });
  if (!categories?.length) return res.status(400).json({ error: 'En az bir kategori seçin' });
  if (!process.env.FOURSQUARE_API_KEY) return res.status(500).json({ error: 'FOURSQUARE_API_KEY sunucuda tanımlı değil' });

  const queryId = crypto.randomBytes(16).toString('hex');
  const total = districts.length * categories.length;
  searchJobs.set(queryId, { status: 'running', results: [], total, completed: 0, error: null });

  runSearchJobs(queryId, { city, districts, categories });

  res.json({ queryId, total });
});

// GET /api/leads-search/status/:queryId
router.get('/status/:queryId', (req, res) => {
  const job = searchJobs.get(req.params.queryId);
  if (!job) return res.status(404).json({ error: 'Sorgu bulunamadı' });
  res.json({ status: job.status, completed: job.completed, total: job.total, results: job.status === 'completed' ? job.results : [], error: job.error });
});

module.exports = router;
