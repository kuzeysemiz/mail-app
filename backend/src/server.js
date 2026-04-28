require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./models/database');
const logger = require('./middleware/logger');
const requireAuth = require('./middleware/auth');

// Routes
const authRoutes    = require('./routes/authRoutes');
const mailboxRoutes = require('./routes/mailboxRoutes');
const emailRoutes   = require('./routes/emailRoutes');
const logRoutes     = require('./routes/logRoutes');
const draftRoutes   = require('./routes/draftRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const aiRoutes      = require('./routes/aiRoutes');
const leadsRoutes   = require('./routes/leadsRoutes');

const app = express();
const PORT = process.env.PORT || 10001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Auth routes — kimlik doğrulaması gerektirmez
app.use('/api/auth', authRoutes);

// Health check — kimlik doğrulaması gerektirmez
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Korumalı routes — tüm istekler için geçerli token zorunlu
app.use('/api/mailboxes', requireAuth, mailboxRoutes);
app.use('/api/emails',    requireAuth, emailRoutes);
app.use('/api/logs',      requireAuth, logRoutes);
app.use('/api/drafts',    requireAuth, draftRoutes);
app.use('/api/settings',  requireAuth, settingsRoutes);
app.use('/api/ai',        requireAuth, aiRoutes);
app.use('/api/leads',     requireAuth, leadsRoutes);

// Error handling
app.use((err, req, res, next) => {
  logger.error('API Hatası:', err);
  res.status(500).json({ error: 'İç sunucu hatası' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint bulunamadı' });
});

app.listen(PORT, () => {
  logger.info(`Server ${PORT} portunda başlatıldı`);
  console.log(`✓ Backend çalışıyor: http://localhost:${PORT}`);
  console.log(`✓ Veritabanı: mail_scheduler.db`);
});

process.on('SIGINT', () => {
  logger.info('Server kapatılıyor...');
  db.close((err) => {
    if (err) logger.error('Veritabanı kapatılırken hata:', err);
    process.exit(0);
  });
});
