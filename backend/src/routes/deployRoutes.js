const express = require('express');
const router = express.Router();
const https = require('https');
const db = require('../models/database');

const REPO = 'kuzeysemiz/mail-app';

function githubGet(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        'User-Agent': 'mail-app-monitor',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    https.get(options, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (resp.statusCode >= 400) return reject(Object.assign(new Error(parsed.message || 'GitHub API hatası'), { status: resp.statusCode }));
          resolve(parsed);
        } catch (e) { reject(new Error('GitHub yanıtı ayrıştırılamadı')); }
      });
    }).on('error', reject);
  });
}

async function getToken() {
  return new Promise(resolve =>
    db.get(`SELECT value FROM settings WHERE key = 'github_token'`, (_, row) => resolve(row?.value || null))
  );
}

// Token kaydet
router.post('/config', (req, res) => {
  const { token } = req.body;
  if (!token || !token.trim()) return res.status(400).json({ error: 'Token zorunlu' });
  db.run(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('github_token', ?)`,
    [token.trim()],
    err => err ? res.status(500).json({ error: 'Kaydedilemedi' }) : res.json({ success: true })
  );
});

// Token durumu (maskelenmiş)
router.get('/config', (req, res) => {
  db.get(`SELECT value FROM settings WHERE key = 'github_token'`, (_, row) => {
    if (!row) return res.json({ saved: false });
    const v = row.value;
    res.json({ saved: true, masked: v.slice(0, 4) + '****' + v.slice(-4) });
  });
});

// Token sil
router.delete('/config', (req, res) => {
  db.run(`DELETE FROM settings WHERE key = 'github_token'`, err =>
    err ? res.status(500).json({ error: 'Silinemedi' }) : res.json({ success: true })
  );
});

// Son workflow run'larını listele
router.get('/runs', async (req, res) => {
  try {
    const token = await getToken();
    const data = await githubGet(`/repos/${REPO}/actions/runs?per_page=20`, token);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Tek bir run
router.get('/runs/:runId', async (req, res) => {
  try {
    const token = await getToken();
    const data = await githubGet(`/repos/${REPO}/actions/runs/${req.params.runId}`, token);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Run'ın job'larını getir
router.get('/runs/:runId/jobs', async (req, res) => {
  try {
    const token = await getToken();
    const data = await githubGet(`/repos/${REPO}/actions/runs/${req.params.runId}/jobs`, token);
    res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
