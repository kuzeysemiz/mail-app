require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./models/database');
const logger = require('./middleware/logger');

// Routes
const mailboxRoutes = require('./routes/mailboxRoutes');
const emailRoutes = require('./routes/emailRoutes');
const logRoutes = require('./routes/logRoutes');
const draftRoutes = require('./routes/draftRoutes');

const app = express();
const PORT = process.env.PORT || 10001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.use('/api/mailboxes', mailboxRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/drafts', draftRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('API Hatası:', err);
  res.status(500).json({ error: 'İç sunucu hatası' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

// Server başlat
app.listen(PORT, () => {
  logger.info(`Server ${PORT} portunda başlatıldı`);
  console.log(`✓ Backend çalışıyor: http://localhost:${PORT}`);
  console.log(`✓ Veritabanı: mail_scheduler.db`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Server kapatılıyor...');
  db.close((err) => {
    if (err) {
      logger.error('Veritabanı kapatılırken hata:', err);
    }
    process.exit(0);
  });
});
