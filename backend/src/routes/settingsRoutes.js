const express = require('express');
const router = express.Router();
const db = require('../models/database');

router.get('/:key', (req, res) => {
  db.get(`SELECT value FROM settings WHERE key = ?`, [req.params.key], (err, row) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (!row) return res.status(404).json({ error: 'Ayar bulunamadı' });
    res.json({ key: req.params.key, value: row.value });
  });
});

router.post('/', (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key ve value gereklidir' });
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value], (err) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    res.json({ message: 'Ayar kaydedildi' });
  });
});

module.exports = router;
