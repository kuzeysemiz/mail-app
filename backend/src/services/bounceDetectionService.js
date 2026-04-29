const { ImapFlow } = require('imapflow');
const db = require('../models/database');
const logger = require('../middleware/logger');

// Bounce mesajlarından başarısız alıcı emaili çıkar
function extractFailedRecipient(source) {
  const checks = [
    /Final-Recipient:\s*rfc822;\s*([^\s\r\n]+)/i,
    /X-Failed-Recipients:\s*([^\r\n,]+)/i,
    /Original-Recipient:\s*rfc822;\s*([^\s\r\n]+)/i,
  ];
  for (const re of checks) {
    const m = source.match(re);
    if (m) return m[1].toLowerCase().trim();
  }
  return null;
}

async function checkMailbox(mailbox) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: mailbox.email, pass: mailbox.appPassword },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date(Date.now() - 25 * 60 * 60 * 1000);
      // Birden fazla kritere göre ayrı ayrı ara, birleştir
      const [r1, r2, r3] = await Promise.all([
        client.search({ since, from: 'mailer-daemon' }, { uid: true }).catch(() => []),
        client.search({ since, subject: 'Delivery Status Notification' }, { uid: true }).catch(() => []),
        client.search({ since, subject: 'Undelivered Mail' }, { uid: true }).catch(() => []),
      ]);
      const uids = [...new Set([...r1, ...r2, ...r3])];
      if (uids.length === 0) return;

      for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
        const failed = extractFailedRecipient(msg.source.toString());
        if (failed) await handleBounce(mailbox.id, failed);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    logger.error(`IMAP hatası (${mailbox.email}): ${err.message}`);
    try { await client.logout(); } catch {}
  }
}

async function handleBounce(mailboxId, failedEmail) {
  const row = await new Promise(resolve =>
    db.get(
      `SELECT id FROM email_bounce_monitoring
       WHERE mailboxId = ? AND recipientEmail = ? AND status = 'monitoring'`,
      [mailboxId, failedEmail],
      (_, r) => resolve(r)
    )
  );
  if (!row) return;

  db.run(`UPDATE email_bounce_monitoring SET status = 'bounced' WHERE id = ?`, [row.id]);
  db.run(
    `INSERT OR IGNORE INTO blacklist (email, reason, source) VALUES (?, 'Bounce — adres bulunamadı', 'bounce')`,
    [failedEmail],
    err => { if (!err) logger.info(`Kara listeye eklendi (bounce): ${failedEmail}`); }
  );
}

async function confirmExpired() {
  const rows = await new Promise(resolve =>
    db.all(
      `SELECT id, recipientEmail FROM email_bounce_monitoring
       WHERE status = 'monitoring' AND checkUntil < datetime('now')`,
      (_, r) => resolve(r || [])
    )
  );
  for (const r of rows) {
    db.run(`UPDATE email_bounce_monitoring SET status = 'confirmed' WHERE id = ?`, [r.id]);
    db.run(
      `INSERT OR IGNORE INTO whitelist (email) VALUES (?)`,
      [r.recipientEmail],
      err => { if (!err) logger.info(`Beyaz listeye eklendi: ${r.recipientEmail}`); }
    );
  }
}

// Tüm gelen kutuyu geçmişe dönük tara (zaman sınırı yok, tüm klasörler)
async function deepScanMailbox(mailbox) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: mailbox.email, pass: mailbox.appPassword },
    logger: false,
  });

  // Gmail dil ayarına göre farklı klasör adları kullanabilir
  const FOLDERS = [
    'INBOX',
    '[Gmail]/All Mail',
    '[Google Mail]/All Mail',
    '[Gmail]/Spam',
    '[Google Mail]/Spam',
  ];

  const FETCH_BATCH = 50;
  const found = new Set();

  try {
    await client.connect();

    for (const folder of FOLDERS) {
      let lock;
      try {
        lock = await client.getMailboxLock(folder);
      } catch {
        continue; // klasör yoksa atla
      }
      try {
        const [r1, r2, r3, r4] = await Promise.all([
          client.search({ from: 'mailer-daemon' }, { uid: true }).catch(() => []),
          client.search({ subject: 'Delivery Status Notification' }, { uid: true }).catch(() => []),
          client.search({ subject: 'Undelivered Mail' }, { uid: true }).catch(() => []),
          client.search({ subject: 'Mail delivery failed' }, { uid: true }).catch(() => []),
        ]);
        const uids = [...new Set([...r1, ...r2, ...r3, ...r4])];
        if (uids.length === 0) continue;

        logger.info(`Deep scan: ${folder} — ${uids.length} mesaj bulundu (${mailbox.email})`);

        // Büyük listelerde zaman aşımını önlemek için batch'le çek
        for (let i = 0; i < uids.length; i += FETCH_BATCH) {
          const batch = uids.slice(i, i + FETCH_BATCH);
          for await (const msg of client.fetch(batch, { source: true }, { uid: true })) {
            const failed = extractFailedRecipient(msg.source.toString());
            if (failed) found.add(failed);
          }
        }
      } finally {
        lock.release();
      }
    }

    await client.logout();
  } catch (err) {
    logger.error(`Deep scan IMAP hatası (${mailbox.email}): ${err.message}`);
    try { await client.logout(); } catch {}
  }
  return [...found];
}

async function deepScan() {
  const mailboxes = await new Promise(resolve =>
    db.all(`SELECT id, email, appPassword FROM mailboxes`, (_, rows) => resolve(rows || []))
  );

  let added = 0;
  for (const mailbox of mailboxes) {
    const emails = await deepScanMailbox(mailbox);
    for (const email of emails) {
      await new Promise(resolve =>
        db.run(
          `INSERT OR IGNORE INTO blacklist (email, reason, source) VALUES (?, 'Bounce — geçmiş tarama', 'bounce')`,
          [email],
          function(err) {
            if (!err && this.changes > 0) {
              logger.info(`Kara listeye eklendi (deep scan): ${email}`);
              added++;
            }
            resolve();
          }
        )
      );
    }
  }
  return { added, scanned: mailboxes.length };
}

let running = false;

async function run() {
  if (running) return;
  running = true;
  try {
    await confirmExpired();

    const mailboxes = await new Promise(resolve =>
      db.all(
        `SELECT DISTINCT m.id, m.email, m.appPassword
         FROM mailboxes m
         JOIN email_bounce_monitoring ebm ON m.id = ebm.mailboxId
         WHERE ebm.status = 'monitoring'`,
        (_, rows) => resolve(rows || [])
      )
    );

    await Promise.all(mailboxes.map(checkMailbox));
  } catch (err) {
    logger.error('Bounce detection genel hata:', err.message);
  } finally {
    running = false;
  }
}

function start() {
  // İlk kontrol 1 dakika sonra, sonra her 5 dakikada bir
  setTimeout(() => {
    run();
    setInterval(run, 5 * 60 * 1000);
  }, 60 * 1000);
  logger.info('Bounce detection servisi başlatıldı (5 dk\'da bir kontrol)');
}

module.exports = { start, deepScan };
