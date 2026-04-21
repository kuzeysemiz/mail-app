const nodemailer = require('nodemailer');
const logger = require('../middleware/logger');

class MailService {
  constructor(gmailEmail, appPassword) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailEmail,
        pass: appPassword
      }
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
      let imgIndex = 0;

      while ((match = imgRegex.exec(finalContent)) !== null) {
        const mimeType = `image/${match[1]}`;
        const base64Data = match[2];
        const cid = `image-${imgIndex}@cid`;

        // Base64'ü Buffer'a çevir
        attachments.push({
          filename: `image-${imgIndex}.${match[1]}`,
          content: Buffer.from(base64Data, 'base64'),
          cid: cid
        });

        // HTML'deki base64 resmi CID referansı ile değiştir
        finalContent = finalContent.replace(match[0], `<img src="cid:${cid}" style="max-width: 100%; height: auto; border-radius: 4px;" />`);
        imgIndex++;
      }

      const mailOptions = {
        from: this.senderEmail,
        to: recipientEmail,
        subject: subject,
        html: finalContent,
        text: finalContent.replace(/<[^>]*>/g, ''),
        attachments: attachments.length > 0 ? attachments : undefined
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Mail gönderildi: ${recipientEmail}`, { messageId: info.messageId, imageCount: imgIndex });
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
