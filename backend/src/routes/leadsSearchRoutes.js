const express = require('express');
const router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const INVALID_EXTS = /\.(png|jpg|jpeg|gif|svg|webp|pdf|zip|js|css|woff|ttf)$/i;
const SCRAPE_TIMEOUT = 8000;
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

// OSM kategori eşleştirmesi
const OSM_TAGS = {
  'restoran':   '[amenity=restaurant]',
  'kafe':       '[amenity=cafe]',
  'otel':       '[tourism=hotel]',
  'dis-klinigi':'[amenity=dentist]',
  'guzellik':   '[shop~"hairdresser|beauty"]',
  'spor':       '[leisure=fitness_centre]',
  'eczane':     '[amenity=pharmacy]',
  'avukat':     '[office=lawyer]',
  'muhasebe':   '[office=accountant]',
  'emlak':      '[office=estate_agent]',
  'oto-servis': '[shop=car_repair]',
  'ozel-okul':  '[amenity~"school|college"]',
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

async function overpassSearch(district, city, osmTag) {
  const areaQuery = `
    [out:json][timeout:30];
    area["name"="${district}"]["admin_level"~"^(6|7|8|9)$"]->.district;
    area["name"="${city}"]["admin_level"~"^(4|5|6)$"]->.city;
    (
      node${osmTag}(area.district);
      node${osmTag}(area.city)["addr:district"="${district}"];
      way${osmTag}(area.district);
    );
    out body 50;
  `.trim();

  const resp = await axios.post(OVERPASS_URL, `data=${encodeURIComponent(areaQuery)}`, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MailSistemi/1.0 (lead-search; contact@ms.kuzeysemiz.com)',
    },
    timeout: 35000,
  });

  return (resp.data.elements || []).map(el => {
    const t = el.tags || {};
    return {
      osm_id: el.id,
      name: t.name || t['name:tr'] || '',
      address: [t['addr:street'], t['addr:housenumber'], t['addr:district'], t['addr:city']]
        .filter(Boolean).join(', '),
      phone: t.phone || t['contact:phone'] || '',
      website: t.website || t['contact:website'] || '',
    };
  }).filter(b => b.name);
}

async function runSearchJobs(queryId, searchParams) {
  const job = searchJobs.get(queryId);
  if (!job) return;
  try {
    const { city, districts, categories } = searchParams;

    const allResults = await Promise.allSettled(
      districts.flatMap(district =>
        categories.map(cat => {
          const tag = OSM_TAGS[cat.id] || `[name~"${cat.query}",i]`;
          return overpassSearch(district, city, tag);
        })
      )
    );

    const firstError = allResults.find(r => r.status === 'rejected');
    const merged = allResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

    if (merged.length === 0 && firstError) {
      job.status = 'error';
      job.error = `Overpass hatası: ${firstError.reason?.message || 'bilinmeyen hata'}`;
      return;
    }

    // Deduplicate
    const seen = new Set();
    const unique = merged.filter(b => {
      const key = String(b.osm_id) || `${b.name}|${b.address}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    job.total = unique.length;

    // Email tarama paralel
    const withEmails = await Promise.allSettled(
      unique.map(async (b) => {
        const emails = b.website ? await scrapeEmails(b.website).catch(() => []) : [];
        job.completed++;
        return { name: b.name, address: b.address, phone: b.phone, website: b.website, rating: null, reviewCount: 0, emails };
      })
    );

    job.results = withEmails.filter(r => r.status === 'fulfilled').map(r => r.value);
    job.status = 'completed';
  } catch (e) {
    job.status = 'error';
    job.error = e.message || 'Beklenmeyen hata';
  }
}

router.post('/search', async (req, res) => {
  const { city, districts, categories } = req.body;
  if (!city) return res.status(400).json({ error: 'Şehir seçin' });
  if (!districts?.length) return res.status(400).json({ error: 'En az bir ilçe seçin' });
  if (!categories?.length) return res.status(400).json({ error: 'En az bir kategori seçin' });

  const queryId = crypto.randomBytes(16).toString('hex');
  const total = districts.length * categories.length;
  searchJobs.set(queryId, { status: 'running', results: [], total, completed: 0, error: null });

  runSearchJobs(queryId, { city, districts, categories });
  res.json({ queryId, total });
});

router.get('/status/:queryId', (req, res) => {
  const job = searchJobs.get(req.params.queryId);
  if (!job) return res.status(404).json({ error: 'Sorgu bulunamadı' });
  res.json({ status: job.status, completed: job.completed, total: job.total, results: job.status === 'completed' ? job.results : [], error: job.error });
});

module.exports = router;
