const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/mail_scheduler.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Veritabanı bağlantı hatası:', err);
  } else {
    console.log('SQLite veritabanı bağlandı:', dbPath);
  }
});

// Tabloları oluştur
db.serialize(() => {
  // ── Yeni tablolar ────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      emailVerified INTEGER DEFAULT 0,
      verificationToken TEXT,
      resetToken TEXT,
      resetTokenExpires DATETIME,
      createdAt DATETIME DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      emailCount INTEGER,
      price INTEGER,
      pricePerEmail REAL,
      isActive INTEGER DEFAULT 1,
      paddlePriceId TEXT
    )
  `);
  db.run(`INSERT OR IGNORE INTO packages (name, slug, emailCount, price, pricePerEmail) VALUES ('Ücretsiz', 'free', 50, 0, 0)`);
  db.run(`INSERT OR IGNORE INTO packages (name, slug, emailCount, price, pricePerEmail) VALUES ('Standart', 'standard', 1000, 400, 0.40)`);
  db.run(`INSERT OR IGNORE INTO packages (name, slug, emailCount, price, pricePerEmail) VALUES ('Pro', 'pro', 3000, 1050, 0.35)`);
  db.run(`INSERT OR IGNORE INTO packages (name, slug, emailCount, price, pricePerEmail) VALUES ('Kurumsal', 'enterprise', NULL, NULL, NULL)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_credits (
      userId INTEGER PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      createdAt DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ── Mevcut tablolara userId kolonu ekle (varsa hata vermez) ──
  db.run(`ALTER TABLE mailboxes ADD COLUMN userId INTEGER`, () => {});
  db.run(`ALTER TABLE drafts ADD COLUMN userId INTEGER`, () => {});
  db.run(`ALTER TABLE sessions ADD COLUMN userId INTEGER`, () => {});
  db.run(`ALTER TABLE sessions ADD COLUMN isAdmin INTEGER DEFAULT 0`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN loginOtp TEXT`, () => {});
  db.run(`ALTER TABLE users ADD COLUMN loginOtpExpires DATETIME`, () => {});
  db.run(`ALTER TABLE packages ADD COLUMN paddlePriceId TEXT`, () => {});

  // leads, blacklist, whitelist, company_tags: UNIQUE kısıtı değişmesi gerekiyor
  // Tek seferlik migration ile yeni schema'ya geç
  db.get(`SELECT value FROM settings WHERE key = 'schema_v2'`, (err, row) => {
    if (row) return; // zaten çalıştı
    db.serialize(() => {
      // leads: UNIQUE(email) → UNIQUE(email, userId)
      db.run(`CREATE TABLE IF NOT EXISTS leads_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        company TEXT,
        domain TEXT,
        firstName TEXT,
        lastName TEXT,
        email TEXT NOT NULL,
        title TEXT,
        confidence INTEGER,
        source TEXT DEFAULT 'hunter',
        createdAt DATETIME DEFAULT (datetime('now')),
        UNIQUE(email, userId)
      )`);
      db.run(`INSERT OR IGNORE INTO leads_v2 (id,company,domain,firstName,lastName,email,title,confidence,source,createdAt)
              SELECT id,company,domain,firstName,lastName,email,title,confidence,source,createdAt FROM leads`);
      db.run(`DROP TABLE IF EXISTS leads`);
      db.run(`ALTER TABLE leads_v2 RENAME TO leads`);

      // blacklist: UNIQUE(email) → UNIQUE(email, userId)
      db.run(`CREATE TABLE IF NOT EXISTS blacklist_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        email TEXT NOT NULL,
        reason TEXT,
        source TEXT DEFAULT 'manual',
        createdAt DATETIME DEFAULT (datetime('now')),
        UNIQUE(email, userId)
      )`);
      db.run(`INSERT OR IGNORE INTO blacklist_v2 (id,email,reason,source,createdAt)
              SELECT id,email,reason,source,createdAt FROM blacklist`);
      db.run(`DROP TABLE IF EXISTS blacklist`);
      db.run(`ALTER TABLE blacklist_v2 RENAME TO blacklist`);

      // whitelist: UNIQUE(email) → UNIQUE(email, userId)
      db.run(`CREATE TABLE IF NOT EXISTS whitelist_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        email TEXT NOT NULL,
        confirmedAt DATETIME DEFAULT (datetime('now')),
        UNIQUE(email, userId)
      )`);
      db.run(`INSERT OR IGNORE INTO whitelist_v2 (id,email,confirmedAt)
              SELECT id,email,confirmedAt FROM whitelist`);
      db.run(`DROP TABLE IF EXISTS whitelist`);
      db.run(`ALTER TABLE whitelist_v2 RENAME TO whitelist`);

      // company_tags: UNIQUE(company,tag) → UNIQUE(company,tag,userId)
      db.run(`CREATE TABLE IF NOT EXISTS company_tags_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        company TEXT NOT NULL,
        tag TEXT NOT NULL,
        UNIQUE(company, tag, userId)
      )`);
      db.run(`INSERT OR IGNORE INTO company_tags_v2 (id,company,tag)
              SELECT id,company,tag FROM company_tags`);
      db.run(`DROP TABLE IF EXISTS company_tags`);
      db.run(`ALTER TABLE company_tags_v2 RENAME TO company_tags`);

      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_v2', 'done')`);
    });
  });

  // Mailbox hesapları tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS mailboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      appPassword TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Gönderilecek maillar tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mailboxId INTEGER NOT NULL,
      batchId TEXT,
      recipientEmail TEXT NOT NULL,
      mailSubject TEXT DEFAULT 'Otomatik Mail',
      mailContent TEXT NOT NULL,
      mailSignature TEXT,
      scheduledTime TEXT,
      scheduledDate TEXT,
      status TEXT DEFAULT 'pending',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mailboxId) REFERENCES mailboxes(id) ON DELETE CASCADE
    )
  `);

  // Gönderim logları tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emailId INTEGER NOT NULL,
      mailboxId INTEGER NOT NULL,
      recipientEmail TEXT NOT NULL,
      status TEXT NOT NULL,
      errorMessage TEXT,
      sentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      day TEXT NOT NULL,
      FOREIGN KEY (emailId) REFERENCES emails(id) ON DELETE CASCADE,
      FOREIGN KEY (mailboxId) REFERENCES mailboxes(id) ON DELETE CASCADE
    )
  `);

  // Ayarlar tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('send_overdue', 'false')`);
  db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_rules', '[{"id":1,"text":"Paragraflar arasına mutlaka boş satır bırak, her paragraf ayrı p tagı içinde olsun","active":true},{"id":2,"text":"Uzun cümleleri böl, kısa ve anlaşılır cümleler kullan","active":true},{"id":3,"text":"Önemli noktalarda vurgulama yap","active":true},{"id":4,"text":"Metnin başına gereksiz giriş cümlesi ekleme, direkt içeriğe gir","active":true}]')`);

  // OTP kodları tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      expiresAt DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      deviceId TEXT,
      createdAt DATETIME DEFAULT (datetime('now'))
    )
  `);
  // Mevcut tabloya eksik kolonları ekle (varsa hata vermez)
  db.run(`ALTER TABLE otp_codes ADD COLUMN deviceId TEXT`, () => {});
  db.run(`ALTER TABLE otp_codes ADD COLUMN ipAddress TEXT`, () => {});

  // Cihaz oturumları tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId TEXT NOT NULL,
      deviceName TEXT,
      ipAddress TEXT,
      token TEXT UNIQUE NOT NULL,
      createdAt DATETIME DEFAULT (datetime('now')),
      expiresAt DATETIME NOT NULL,
      isActive INTEGER DEFAULT 1
    )
  `);

  // Şirket etiketleri tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS company_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT NOT NULL,
      tag TEXT NOT NULL,
      UNIQUE(company, tag)
    )
  `);

  // Leads (kişi rehberi) tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company TEXT,
      domain TEXT,
      firstName TEXT,
      lastName TEXT,
      email TEXT UNIQUE NOT NULL,
      title TEXT,
      confidence INTEGER,
      source TEXT DEFAULT 'hunter',
      createdAt DATETIME DEFAULT (datetime('now'))
    )
  `);

  // Taslak maillar tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mailboxId INTEGER NOT NULL,
      draftName TEXT NOT NULL,
      mailSubject TEXT DEFAULT 'Otomatik Mail',
      mailContent TEXT NOT NULL,
      mailSignature TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mailboxId) REFERENCES mailboxes(id) ON DELETE CASCADE
    )
  `);

  // Kara liste
  db.run(`
    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      reason TEXT,
      source TEXT DEFAULT 'manual',
      createdAt DATETIME DEFAULT (datetime('now'))
    )
  `);

  // Beyaz liste
  db.run(`
    CREATE TABLE IF NOT EXISTS whitelist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      confirmedAt DATETIME DEFAULT (datetime('now'))
    )
  `);

  // Bounce izleme — gönderilen her mail 24 saat takip edilir
  db.run(`
    CREATE TABLE IF NOT EXISTS email_bounce_monitoring (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emailId INTEGER NOT NULL,
      mailboxId INTEGER NOT NULL,
      recipientEmail TEXT NOT NULL,
      sentAt DATETIME NOT NULL,
      checkUntil DATETIME NOT NULL,
      status TEXT DEFAULT 'monitoring',
      FOREIGN KEY (emailId) REFERENCES emails(id) ON DELETE CASCADE
    )
  `);

  // pending_admin_actions: silme OTP + kredi onay linkleri
  db.run(`
    CREATE TABLE IF NOT EXISTS pending_admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      adminId INTEGER NOT NULL,
      action TEXT NOT NULL,
      targetId INTEGER,
      data TEXT,
      token TEXT UNIQUE,
      otp TEXT,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME DEFAULT (datetime('now'))
    )
  `);

  // schema_v3: users.permissions kolonu
  db.get(`SELECT value FROM settings WHERE key = 'schema_v3'`, (err, row) => {
    if (row) return;
    db.serialize(() => {
      db.run(`ALTER TABLE users ADD COLUMN permissions TEXT`, () => {});
      db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_v3', 'done')`);
    });
  });
  db.run(`ALTER TABLE users ADD COLUMN permissions TEXT`, () => {});
});

module.exports = db;
