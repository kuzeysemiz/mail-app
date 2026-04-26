const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const db = require('../models/database');
const logger = require('../middleware/logger');

function getAiRules() {
  return new Promise((resolve) => {
    db.get(`SELECT value FROM settings WHERE key = 'ai_rules'`, (err, row) => {
      if (err || !row) return resolve('');
      try {
        const rules = JSON.parse(row.value);
        const activeRules = rules.filter(r => r.active).map(r => `- ${r.text}`);
        resolve(activeRules.join('\n'));
      } catch {
        resolve('');
      }
    });
  });
}

function extractText(html) {
  return html
    .replace(/<img[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI servisi yapılandırılmamış (GROQ_API_KEY eksik)' });
  }

  const aiRules = await getAiRules();
  const rulesBlock = aiRules
    ? `\n\n=== ZORUNLU KURALLAR (İSTİSNASIZ UYGULANACAK) ===\n${aiRules}\n=== KURALLAR SONU ===`
    : '';

  const formatInstructions = `

=== ÇIKIŞ FORMATI (KESİNLİKLE UYULMALI) ===
- Her paragraf ayrı bir <p>...</p> tagı içinde olmalı
- Paragraflar arasına boş satır koyma, sadece <p> tagları yeterli
- <strong> ile önemli kelimeleri vurgula
- Gereken yerde <ul><li> madde listesi kullan
- SADECE HTML içeriği döndür — açıklama, başlık, yorum, ön söz YASAK
- Yanıtın ilk karakteri < olmalı, son karakteri > olmalı
=== FORMAT SONU ===`;

  const baseInstructions = mode === 'advanced' && userPrompt
    ? `Sen bir profesyonel e-posta yazarısın.\n\nKullanıcı talimatları:\n${userPrompt}${rulesBlock}${formatInstructions}`
    : `Sen bir profesyonel e-posta yazarısın. Aşağıdaki kurallara KESINLIKLE uy:

- Kurumsal ve profesyonel ton kullan, büyük bir şirketten yazılmış izlenimi ver
- Gerçek bir insan gibi yaz, kalıp ifadelerden kaçın
- Özgün mesajı koru, sadece ifadeyi güçlendir
- Her kural listede ne diyorsa tam olarak uygula${rulesBlock}${formatInstructions}`;

  const userMessage = `Aşağıdaki e-postayı geliştir:\n\n${text}`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: baseInstructions },
        { role: 'user', content: userMessage }
      ]
    });

    const enhancedText = completion.choices[0].message.content.trim();

    const enhancedHtml = enhancedText.startsWith('<')
      ? enhancedText
      : enhancedText
          .split('\n\n')
          .filter(p => p.trim())
          .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
          .join('');

    res.json({ enhanced: enhancedHtml });
    logger.info(`AI geliştirme tamamlandı (${wordCount} kelime, mod: ${mode})`);
  } catch (error) {
    logger.error('AI geliştirme hatası:', error);
    res.status(500).json({ error: `AI hatası: ${error.message || error}` });
  }
});

module.exports = router;
