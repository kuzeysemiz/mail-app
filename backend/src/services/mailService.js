const nodemailer = require('nodemailer');
const logger = require('../middleware/logger');

class MailService {
  constructor(gmailEmail, appPassword) {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS
      family: 4,     // IPv4 zorla (Docker bridge IPv6 desteklemiyor)
      auth: {
        user: gmailEmail,
        pass: appPassword
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
    this.senderEmail = gmailEmail;
  }

  async sendMail(recipientEmail, subject, content, signature = '') {
    try {
      // İmzayı içeriğe ekle
      let finalContent = signature 
        ? `${content}<br/><br/>---<br/>${signature}`
        : content;

      // Base64 resim attachmentlara çevir
      const attachments = [];
      const imgRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;
      let match;
      const matches = [];
      
      // Tüm eşleşmeleri topla
      while ((match = imgRegex.exec(finalContent)) !== null) {
        matches.push({
          fullMatch: match[0],
          mimeType: `image/${match[1]}`,
          base64Data: match[2],
          extension: match[1]
        });
      }

      // Her eşleşme için attachment oluştur ve HTML güncelle
      matches.forEach((imgMatch, imgIndex) => {
        const cid = `image-${imgIndex}@cid`;

        // Base64'ü Buffer'a çevir
        attachments.push({
          filename: `image-${imgIndex}.${imgMatch.extension}`,
          content: Buffer.from(imgMatch.base64Data, 'base64'),
          cid: cid
        });

        // HTML'deki base64 resmi CID referansı ile değiştir
        finalContent = finalContent.replace(imgMatch.fullMatch, `<img src="cid:${cid}" style="max-width: 100%; height: auto; border-radius: 4px;" />`);
      })

      const mailOptions = {
        from: this.senderEmail,
        to: recipientEmail,
        subject: subject,
        html: finalContent,
        text: finalContent.replace(/<[^>]*>/g, ''),
        attachments: attachments.length > 0 ? attachments : undefined
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Mail gönderildi: ${recipientEmail}`, { messageId: info.messageId, imageCount: matches.length });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Mail gönderme hatası (${recipientEmail}):`, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('Gmail bağlantısı başarılı');
      return true;
    } catch (error) {
      logger.error('Gmail bağlantı hatası:', { error: error.message });
      return false;
    }
  }
}

module.exports = MailService;
