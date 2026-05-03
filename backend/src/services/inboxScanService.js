const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const db = require('../models/database');
const logger = require('../middleware/logger');

// Gönderdiğimiz adreslerin kümesini getir (userId bazlı)
async function getKnownRecipients(userId) {
  const rows = await new Promise(r =>
    db.all(
      `SELECT DISTINCT LOWER(recipientEmail) as email FROM emails
       WHERE mailboxId IN (SELECT id FROM mailboxes WHERE ${userId ? 'userId = ?' : 'userId IS NULL'})`,
      userId ? [userId] : [],
      (_, v) => r(v || [])
    )
  );
  return new Set(rows.map(r => r.email));
}

async function scanMailbox(mailbox) {
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
      // Son 7 günün okunmamış mesajlarını al
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const uids = await client.search({ since, seen: false }, { uid: true }).catch(() => []);
      if (uids.length === 0) return 0;

      const recipients = await getKnownRecipients(mailbox.userId);
      let saved = 0;

      for await (const msg of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
        try {
          const parsed = await simpleParser(msg.source);
          const fromAddr = (parsed.from?.value?.[0]?.address || '').toLowerCase();
          const messageId = parsed.messageId || `uid-${msg.uid}-${mailbox.id}`;

          // Sadece daha önce mail gönderdiğimiz adreslerden gelenleri kaydet
          if (!recipients.has(fromAddr)) continue;

          const fromName = parsed.from?.value?.[0]?.name || null;
          const subject  = parsed.subject || '(Konu yok)';
          const bodyHtml = parsed.html || null;
          const bodyText = parsed.text || null;
          const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
          const inReplyTo  = parsed.inReplyTo || null;

          await new Promise(resolve =>
            db.run(
              `INSERT OR IGNORE INTO inbox_messages
               (mailboxId, userId, fromEmail, fromName, subject, bodyText, bodyHtml, receivedAt, messageId, inReplyTo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [mailbox.id, mailbox.userId || null, fromAddr, fromName, subject, bodyText, bodyHtml, receivedAt, messageId, inReplyTo],
              function(err) {
                if (!err && this.changes > 0) {
                  saved++;
                  logger.info(`Gelen kutusu: yeni mesaj ${fromAddr} → ${mailbox.email}`);
                }
                resolve();
              }
            )
          );
        } catch (parseErr) {
          logger.error(`Mesaj parse hatası: ${parseErr.message}`);
        }
      }
      return saved;
    } finally {
      lock.release();
    }
  } catch (err) {
    logger.error(`IMAP inbox hatası (${mailbox.email}): ${err.message}`);
    return 0;
  } finally {
    try { await client.logout(); } catch {}
  }
}

async function scanAll() {
  const mailboxes = await new Promise(r =>
    db.all(`SELECT id, email, appPassword, userId FROM mailboxes`, (_, v) => r(v || []))
  );
  let total = 0;
  for (const mb of mailboxes) {
    total += await scanMailbox(mb);
  }
  if (total > 0) logger.info(`Gelen kutusu taraması: ${total} yeni mesaj`);
  return total;
}

// Her 5 dakikada bir tara
function startSchedule() {
  setTimeout(async () => {
    await scanAll().catch(e => logger.error(`Inbox scan hatası: ${e.message}`));
    setInterval(async () => {
      await scanAll().catch(e => logger.error(`Inbox scan hatası: ${e.message}`));
    }, 5 * 60 * 1000);
  }, 30 * 1000); // İlk taramayı 30sn geciktir (DB hazır olsun)
}

module.exports = { scanAll, scanMailbox, startSchedule };
