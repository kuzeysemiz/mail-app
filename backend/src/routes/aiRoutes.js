const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../middleware/logger');

function extractText(html) {
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImages(html) {
  const images = [];
  const regex = /<img[^>]+src="(data:image\/(jpeg|png|gif|webp);base64,([^"]+))"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    images.push({
      mimeType: `image/${match[2]}`,
      data: match[3]
    });
  }
  return images;
}

router.post('/enhance', async (req, res) => {
  const { content, userPrompt, mode } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'İçerik gereklidir' });
  }

  const text = extractText(content);
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = text.length;

  if (wordCount < 10 || charCount < 150) {
    return res.status(400).json({
      error: `Mail içeriği çok kısa. En az 10 kelime ve 150 karakter gereklidir. (Şu an: ${wordCount} kelime, ${charCount} karakter)`
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'AI servisi yapılandırılmamış (GEMINI_API_KEY eksik)' });
  }

  const images = extractImages(content);

  const systemInstruction = mode === 'advanced' && userPrompt
    ? `Sen bir profesyonel e-posta yazarısın. Kullanıcının talimatlarına göre e-posta içeriğini geliştir. Sadece geliştirilmiş içeriği HTML formatında döndür (<p>, <strong>, <em>, <ul>, <li>, <br> taglarını kullanabilirsin). Ekstra açıklama veya yorum ekleme, sadece e-posta metnini döndür.`
    : `Sen bir profesyonel e-posta yazarısın. Verilen e-posta içeriğini şu kurallara göre geliştir:
- Kurumsal ve profesyonel bir ton kullan, büyük bir şirketten yazılmış gibi hissettir
- Kişisel bir dokunuş ekle, robot gibi değil gerçek bir insan gibi hissettir
- Özgün mesaj ve amacı koru, içeriği değiştirme sadece ifadeyi güçlendir
- Alıcıya özel yazılmış gibi, genel bir şablon gibi değil
- İçerik hangi dildeyse o dilde yaz
- Sadece geliştirilmiş e-posta metnini HTML formatında döndür (<p>, <strong>, <em>, <ul>, <li>, <br> taglarını kullanabilirsin)
- Ekstra açıklama, yorum veya başlık ekleme — sadece e-posta gövdesini döndür`;

  const userMessage = mode === 'advanced' && userPrompt
    ? `Talimatlar: ${userPrompt}\n\nGeliştirilecek e-posta:\n${text}`
    : `Bu e-posta içeriğini geliştir:\n${text}`;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction
    });

    const parts = [];

    images.forEach(img => {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    });

    parts.push({ text: userMessage });

    const result = await model.generateContent(parts);
    const enhancedText = result.response.text().trim();

    const enhancedHtml = enhancedText.startsWith('<')
      ? enhancedText
      : enhancedText
          .split('\n\n')
          .filter(p => p.trim())
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');

    res.json({ enhanced: enhancedHtml });
    logger.info(`AI geliştirme tamamlandı (${wordCount} kelime, ${images.length} resim, mod: ${mode})`);
  } catch (error) {
    logger.error('AI geliştirme hatası:', error);
    res.status(500).json({ error: `AI hatası: ${error.message || error}` });
  }
});

module.exports = router;
