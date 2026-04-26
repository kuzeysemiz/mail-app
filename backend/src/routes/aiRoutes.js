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

function toHtml(text) {
  if (text.trimStart().startsWith('<')) return text;
  return text
    .split('\n\n')
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

router.post('/enhance', async (req, res) => {
  const { content, userPrompt, mode } = req.body;

  if (!content) return res.status(400).json({ error: 'İçerik gereklidir' });

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'AI servisi yapılandırılmamış (GROQ_API_KEY eksik)' });
  }

  const text = extractText(content);

  // Çeviri modu — kural ve minimum validasyon yok
  if (mode === 'translate' && userPrompt) {
    const targetLang = userPrompt;
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the email to ${targetLang}.
Rules you MUST follow:
- Translate every single word — nothing stays in the original language
- Keep the exact same paragraph structure and HTML formatting (<p>, <strong>, <ul>, <li> tags)
- Preserve the professional tone
- Return ONLY the translated HTML content, no explanations, no extra text
- First character of your response must be <`
          },
          { role: 'user', content: `Translate this email to ${targetLang}:\n\n${text}` }
        ]
      });
      const result = completion.choices[0].message.content.trim();
      res.json({ enhanced: toHtml(result) });
      logger.info(`Çeviri tamamlandı: ${targetLang} (${text.split(/\s+/).length} kelime)`);
    } catch (error) {
      logger.error('Çeviri hatası:', error);
      res.status(500).json({ error: `Çeviri hatası: ${error.message || error}` });
    }
    return;
  }

  // Geliştirme modu — minimum validasyon gerekli
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const charCount = text.length;

  if (wordCount < 10 || charCount < 150) {
    return res.status(400).json({
      error: `Mail içeriği çok kısa. En az 10 kelime ve 150 karakter gereklidir. (Şu an: ${wordCount} kelime, ${charCount} karakter)`
    });
  }

  const aiRules = await getAiRules();
  const rulesBlock = aiRules
    ? `\n\n=== ZORUNLU KURALLAR (İSTİSNASIZ UYGULANACAK) ===\n${aiRules}\n=== KURALLAR SONU ===`
    : '';

  const formatInstructions = `

=== ÇIKIŞ FORMATI (KESİNLİKLE UYULMALI) ===
- Her paragraf ayrı bir <p>...</p> tagı içinde olmalı
- <strong> ile önemli kelimeleri vurgula
- Gereken yerde <ul><li> madde listesi kullan
- SADECE HTML içeriği döndür — açıklama, başlık, yorum, ön söz YASAK
- Yanıtın ilk karakteri < olmalı
=== FORMAT SONU ===`;

  const baseInstructions = mode === 'advanced' && userPrompt
    ? `Sen bir profesyonel e-posta yazarısın.\n\nKullanıcı talimatları:\n${userPrompt}${rulesBlock}${formatInstructions}`
    : `Sen bir profesyonel e-posta yazarısın. Aşağıdaki kurallara KESINLIKLE uy:
- Kurumsal ve profesyonel ton kullan, büyük bir şirketten yazılmış izlenimi ver
- Gerçek bir insan gibi yaz, kalıp ifadelerden kaçın
- Özgün mesajı koru, sadece ifadeyi güçlendir${rulesBlock}${formatInstructions}`;

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: baseInstructions },
        { role: 'user', content: `Aşağıdaki e-postayı geliştir:\n\n${text}` }
      ]
    });
    const enhancedText = completion.choices[0].message.content.trim();
    res.json({ enhanced: toHtml(enhancedText) });
    logger.info(`AI geliştirme tamamlandı (${wordCount} kelime, mod: ${mode})`);
  } catch (error) {
    logger.error('AI geliştirme hatası:', error);
    res.status(500).json({ error: `AI hatası: ${error.message || error}` });
  }
});

module.exports = router;
