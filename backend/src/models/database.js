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
});

module.exports = db;
