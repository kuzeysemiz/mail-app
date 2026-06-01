const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');

const SCRAPER_URL = process.env.MAPS_SCRAPER_URL || 'http://maps-scraper:8080';
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const INVALID_EXTS = /\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|js|css|woff|ttf)$/i;
const SCRAPE_TIMEOUT = 8000;
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function extractEmails(html) {
  return (html.match(EMAIL_REGEX) || [])
    .map(e => e.toLowerCase())
    .filter(e => !INVALID_EXTS.test(e) && e.includes('.') && !e.startsWith('.'));
}

async function fetchHtml(url) {
  const resp = await axios.get(url, {
    timeout: SCRAPE_TIMEOUT,
    headers: HTTP_HEADERS,
    maxRedirects: 4,
    maxContentLength: 500_000,
  });
  return typeof resp.data === 'string' ? resp.data : '';
}

async function findContactLink(html, baseUrl) {
  const $ = cheerio.load(html);
  const pattern = /contact|iletisim|ulasin|bize-yazin/i;
  let found = null;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (pattern.test(href) || pattern.test($(el).text())) {
      found = href;
      return false;
    }
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
  await Promise.allSettled(
    ['/contact', '/iletisim', '/bize-ulasin', '/contact-us'].map(p => tryFetch(baseUrl + p))
  );
  return [...emails];
}

async function submitJob(keyword) {
  const resp = await axios.post(`${SCRAPER_URL}/api/v1/scrape`, {
    keyword,
    lang: 'tr',
    max_depth: 3,
    email: false,
    fast_mode: true,
  }, { timeout: 10000 });
  return resp.data.job_id;
}

async function pollJob(jobId, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(3000);
    const resp = await axios.get(`${SCRAPER_URL}/api/v1/jobs/${jobId}`, { timeout: 10000 });
    const { status, results } = resp.data;
    if (status === 'completed') return results || [];
    if (status === 'failed' || status === 'cancelled') return [];
  }
  return [];
}

// POST /api/leads-search/search
router.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) return res.status(400).json({ error: 'Sorgu zorunlu' });

  // Scraper servisinin hazır olduğunu kontrol et
  try {
    await axios.get(`${SCRAPER_URL}/api/v1/health`, { timeout: 5000 });
  } catch {
    return res.status(503).json({ error: 'Harita tarayıcı servisi hazır değil, birkaç saniye sonra tekrar deneyin' });
  }

  let jobId;
  try {
    jobId = await submitJob(query.trim());
  } catch {
    return res.status(502).json({ error: 'Arama başlatılamadı' });
  }

  let places;
  try {
    places = await pollJob(jobId);
  } catch {
    return res.status(502).json({ error: 'Sonuçlar alınamadı' });
  }

  if (places.length === 0) return res.json({ results: [] });

  // Email tarama (paralel)
  const withEmails = await Promise.allSettled(
    places.map(async (b) => {
      const emails = b.website ? await scrapeEmails(b.website).catch(() => []) : [];
      return {
        name: b.title || '',
        address: b.address || '',
        phone: b.phone || '',
        website: b.website || '',
        rating: b.review_rating || null,
        reviewCount: b.review_count || 0,
        emails,
      };
    })
  );

  res.json({
    results: withEmails.filter(r => r.status === 'fulfilled').map(r => r.value),
  });
});

module.exports = router;
