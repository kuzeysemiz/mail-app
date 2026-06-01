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

// Şehir bounding box'ları (güney_lat, batı_lon, kuzey_lat, doğu_lon)
const CITY_BBOX = {
  'İstanbul':  '40.80,28.50,41.35,29.55',
  'Ankara':    '39.75,32.55,40.15,33.10',
  'İzmir':     '38.25,26.90,38.60,27.30',
  'Bursa':     '40.10,28.80,40.30,29.20',
  'Antalya':   '36.75,30.55,37.05,30.90',
  'Adana':     '36.90,35.20,37.10,35.45',
  'Konya':     '37.80,32.40,37.95,32.60',
  'Gaziantep': '37.00,37.28,37.15,37.45',
  'Mersin':    '36.75,34.55,36.90,34.70',
  'Kayseri':   '38.65,35.40,38.80,35.55',
  'Eskişehir': '39.73,30.47,39.83,30.57',
  'Trabzon':   '40.97,39.68,41.08,39.80',
  'Sakarya':   '40.70,30.25,40.85,30.45',
  'Kocaeli':   '40.72,29.85,40.85,30.05',
  'Diyarbakır':'37.87,40.18,37.96,40.27',
  'Samsun':    '41.25,36.27,41.37,36.40',
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
  const bbox = CITY_BBOX[city] || '36.0,26.0,42.0,45.0';
  const areaQuery = `[out:json][timeout:25];node${osmTag}["name"](${bbox});out body 50;`;

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
