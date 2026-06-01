const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const INVALID_EXTS = /\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|js|css|woff|ttf)$/i;
const SCRAPE_TIMEOUT = 8000;
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

function extractEmails(html) {
  const matches = html.match(EMAIL_REGEX) || [];
  return matches
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
  const contactPatterns = /contact|iletisim|ulasin|bize-yazin/i;
  let found = null;
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (contactPatterns.test(href) || contactPatterns.test($(el).text())) {
      found = href;
      return false;
    }
  });
  if (!found) return null;
  try {
    return new URL(found, baseUrl).href;
  } catch {
    return null;
  }
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

  // Sayfada bulunan iletişim linkini takip et
  if (mainHtml) {
    const contactLink = await findContactLink(mainHtml, baseUrl);
    if (contactLink && contactLink !== websiteUrl) await tryFetch(contactLink);
  }

  // Yaygın iletişim path'leri de dene
  const paths = ['/contact', '/iletisim', '/bize-ulasin', '/contact-us'];
  await Promise.allSettled(paths.map(p => tryFetch(baseUrl + p)));

  return [...emails];
}

// POST /api/leads-search/search
router.post('/search', async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) return res.status(400).json({ error: 'Sorgu zorunlu' });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY tanımlı değil' });

  let places;
  try {
    const searchResp = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      { params: { query: query.trim(), key: apiKey }, timeout: 10000 }
    );
    if (searchResp.data.status === 'REQUEST_DENIED') {
      return res.status(403).json({ error: 'Google API anahtarı geçersiz veya yetkisiz' });
    }
    if (searchResp.data.status === 'OVER_QUERY_LIMIT') {
      return res.status(429).json({ error: 'Google API limiti aşıldı' });
    }
    places = searchResp.data.results || [];
  } catch {
    return res.status(502).json({ error: 'Google Places API erişilemedi' });
  }

  if (places.length === 0) return res.json({ results: [] });

  // Her işletme için details çek (paralel)
  const detailsResults = await Promise.allSettled(
    places.map(p =>
      axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: { place_id: p.place_id, fields: 'name,formatted_address,formatted_phone_number,website', key: apiKey },
        timeout: 10000,
      })
    )
  );

  const businesses = detailsResults
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value.data.result)
    .filter(Boolean);

  // Website varsa email tara (paralel)
  const withEmails = await Promise.allSettled(
    businesses.map(async (b) => {
      const emails = b.website ? await scrapeEmails(b.website).catch(() => []) : [];
      return {
        name: b.name || '',
        address: b.formatted_address || '',
        phone: b.formatted_phone_number || '',
        website: b.website || '',
        emails,
      };
    })
  );

  const results = withEmails
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  res.json({ results });
});

module.exports = router;
