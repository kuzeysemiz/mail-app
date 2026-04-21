# 📧 Otomatik Mail Gönderme Sistemi

Gmail SMTP kullanarak, hafta içi belirli zaman aralıklarında rastgele olarak toplu mail göndermek için dizayn edilmiş modern bir sistem. **Rich text editor ile zengin metin desteği, HTML formatı, resim ekleme, kalın/italik/çizgili yazı** ve **mail imzası** desteği sunar.

## 🎯 Özellikler

- ✅ **Gmail SMTP Entegrasyonu** - Güvenli uygulama şifresi ile bağlantı
- ✅ **Toplu Mail Ekleme** - Maksimum 100 mail bir defada ekleyebilir
- ✅ **Zengin Metin Editörü (Quill)** - HTML formatı, resim, kalın, italik, çizgili yazı, listeler
- ✅ **Mail Başlığı Özelleştirmesi** - Her mail için farklı başlık
- ✅ **Mail İmzası** - Özel imza ekleme desteği
- ✅ **Rastgele Zamanlama** - 09:00 - 18:00 arasında rastgele saat ataması
- ✅ **Hafta İçi Dağıtımı** - Pazartesi-Cuma günleri, gün başına maksimum 30 mail
- ✅ **Zamanlı Gönderim** - node-schedule ile otomatik gönderim
- ✅ **Günlük Loglar** - Her gün gönderilen maillar ve sonuçları
- ✅ **Email Yönetimi** - Düzenleme, silme, hemen gönderme seçenekleri
- ✅ **Başarı/Başarısız Takibi** - Detaylı istatistikler ve hata logları

## 🛠️ Teknoloji Stack

### Backend
- **Node.js + Express** - REST API sunucusu
- **SQLite** - Hafif veritabanı
- **Nodemailer** - Gmail SMTP entegrasyonu
- **node-schedule** - Otomatik görev zamanlama
- **Winston** - Profesyonel logging

### Frontend
- **React 18** - Modern arayüz
- **React Quill** - Zengin metin editörü (WYSIWYG)
- **Axios** - HTTP iletişimi
- **CSS3** - Responsive tasarım

## 📋 Sistem Gereksinimleri

- Node.js (v14+)
- npm veya yarn
- Gmail hesabı (2 Adımlı Doğrulama etkin)
- Gmail Uygulama Şifresi

## 🚀 Kurulum ve Çalıştırma

### 1. Gmail Uygulama Şifresi Alma

1. https://myaccount.google.com adresine gidin
2. "Güvenlik" → "2 Adımlı Doğrulama" etkinleştirin (eğer aktif değilse)
3. "Uygulama şifresi" bölümüne gelin
4. Uygulama: **Mail**, Cihaz: **Windows Bilgisayar** seçin
5. 16 karakterli şifreyi kopyalayın

### 2. Backend Kurulumu

```bash
cd backend
npm install
```

`.env` dosyası oluşturun (`.env.example`'dan kopya yapın):

```bash
cp .env.example .env
```

`.env` dosyasını düzenleyin:

```
PORT=5000
GMAIL_EMAIL=your-email@gmail.com
GMAIL_PASSWORD=your-16-char-app-password
NODE_ENV=development
```

Backend'i başlatın:

```bash
npm start
```

Backend şu adreste çalışır: `http://localhost:5000`

### 3. Frontend Kurulumu

Yeni bir terminal açın:

```bash
cd frontend
npm install
npm start
```

Frontend şu adreste açılır: `http://localhost:3000`

## 📖 Kullanım Kılavuzu

### 1. Gmail Hesabı Ekleme

1. **Gmail Hesapları** sekmesine gidin
2. Email ve Uygulama Şifresini girin
3. **Hesabı Ekle** düğmesine tıklayın

### 2. Mail Listesi Ekleme

1. **Mail Ekle** sekmesine gidin
2. Gönderilecek Gmail hesabını seçin
3. Mail adresleri yazın (Her satırda bir)
4. **Mail Başlığı** yazın (ör: "Yeni Ürün Duyurusu")
5. **Zengin Metin Editöründe** mail içeriğini yazın:
   - **Kalın, İtalik, Çizgili** yazı
   - Başlık seviyeleri (H1, H2, H3)
   - Sıralı/Sırasız Listeler
   - **Renkli yazı ve arka plan**
   - **Resim ekleme** (URL ile)
   - Link ekleme
6. **İmza (Opsiyonel)** - Özel imzanız varsa ekleyin
7. **Mailları Ekle ve Planla** tıklayın

Sistem otomatik olarak:
- Mailları rastgele hafta içi günlere dağıtır
- Her gün maksimum 30 mail sınırını ayarlar
- 09:00 - 18:00 arasında rastgele saatler atar
- Planlama önizlemesini gösterir

**Örnek Mail İçeriği:**
```html
<h2>Merhaba!</h2>
<p>Yeni <strong>ürünlerimizi</strong> keşfedin.</p>
<p><em>Sınırlı zaman</em> için <u>%30 indirim</u>!</p>
```

### 3. Zamanlanmış Mailları Yönet

1. **Yönet** sekmesine gidin
2. Mailbox seçin ve durum filtreleyebilirsiniz
3. Her mail için:
   - **Düzenle** - Alıcı, başlık, içerik, imza, saat değiştir
   - **Hemen Gönder** - Test için hemen gönder
   - **Sil** - Mailı iptal et

**Düzenleme Modunda:**
- Zengin metin editörü ile HTML yazı şekillendirmesi
- Resim ve link ekleme
- Başlık ve imza değişikliği
- Gönderim tarihi ve saati düzenleme

### 4. Gönderim Loglarını İncele

1. **Loglar** sekmesine gidin
2. Tarih seçin
3. İstatistikleri görüntüleyin:
   - Toplam gönderilen
   - Başarılı
   - Başarısız
   - Başarı oranı
4. Detaylı log kayıtlarını inceleyin

## 📊 Özellikler Karşılaştırması

| Özellik | Durum |
|---------|-------|
| Toplu Mail Ekleme (max 100) | ✅ |
| Zengin Metin Editörü (Quill) | ✅ |
| Mail Başlığı Özelleştirmesi | ✅ |
| Mail İmzası Desteği | ✅ |
| Resim Ekleme | ✅ |
| HTML Formatı | ✅ |
| Rastgele Saat Atama (09:00-18:00) | ✅ |
| Hafta İçi Dağıtımı (Pzt-Cuma) | ✅ |
| Gün Başına 30 Mail Limiti | ✅ |
| Email Düzenleme/Silme | ✅ |
| Hemen Gönderme (Test) | ✅ |
| Günlük Log Kayıtları | ✅ |
| Başarı/Başarısız Takibi | ✅ |
| Gmail SMTP Entegrasyonu | ✅ |

## 📊 Veri Tabanı Şeması

### mailboxes
```sql
- id (INTEGER PRIMARY KEY)
- email (TEXT UNIQUE)
- appPassword (TEXT)
- createdAt (DATETIME)
```

### emails
```sql
- id (INTEGER PRIMARY KEY)
- mailboxId (FOREIGN KEY)
- recipientEmail (TEXT)
- mailSubject (TEXT) ← ÖZELLİK
- mailContent (TEXT - HTML)
- mailSignature (TEXT - HTML) ← ÖZELLİK
- scheduledTime (TEXT)
- scheduledDate (TEXT)
- status (pending|sent|failed)
- createdAt (DATETIME)
```

### logs
```sql
- id (INTEGER PRIMARY KEY)
- emailId (FOREIGN KEY)
- mailboxId (FOREIGN KEY)
- recipientEmail (TEXT)
- status (success|failed)
- errorMessage (TEXT)
- sentAt (DATETIME)
- day (TEXT - YYYY-MM-DD)
```

## 🔒 Güvenlik Notları

- ✅ Uygulama şifreleri `.env` dosyasında saklanır
- ✅ `.gitignore` veritabanı ve şifre dosyalarını hariç tutar
- ✅ Gmail 2FA sağlandığında Uygulama Şifresi gerekir
- ✅ CORS middleware ile sadece izin verilen kaynaklar bağlanabilir

## 🐛 Sorun Giderme

### "Gmail bağlantısı başarısız"
- Uygulama Şifresinin doğru olduğundan emin olun
- 2 Adımlı Doğrulamayı etkinleştirmiş olduğunuzdan emin olun
- Uygulama Şifresini güncelleyip tekrar deneyin

### "Maillar planlanan zamanda gönderilmiyor"
- Backend'in çalışıyor olduğundan emin olun
- Browser konsolunda hata olup olmadığını kontrol edin
- `logs/error.log` dosyasını kontrol edin

### "Port zaten kullanımda"
```bash
# Port 5000 veya 3000'ı kullanan işlemi bulun ve kapatın
# Windows PowerShell'de:
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## 📝 API Endpoints

### Mailbox
- `POST /api/mailboxes/mailbox` - Yeni mailbox ekle
- `GET /api/mailboxes/mailboxes` - Tüm mailbox'ları listele
- `DELETE /api/mailboxes/mailbox/:id` - Mailbox sil

### Email
- `POST /api/emails/emails/add` - Toplu email ekle
- `GET /api/emails/emails/:mailboxId` - Mailbox'ın emaillerini listele
- `PUT /api/emails/email/:id` - Email güncelle
- `DELETE /api/emails/email/:id` - Email sil
- `POST /api/emails/email/:id/send-now` - Email hemen gönder

### Logs
- `GET /api/logs/days` - Tüm günleri listele
- `GET /api/logs/day/:day` - Günün loglarını göster
- `GET /api/logs/mailbox/:mailboxId` - Mailbox'un loglarını göster
- `GET /api/logs/email/:emailId` - Email'in geçmişini göster
- `GET /api/logs/stats/summary` - Özet istatistikler

## 📚 Dosya Yapısı

```
Otomatik Mail Gönderme/
├── backend/
│   ├── src/
│   │   ├── models/
│   │   │   └── database.js
│   │   ├── services/
│   │   │   ├── mailService.js
│   │   │   ├── schedulerService.js
│   │   │   └── timeScheduleService.js
│   │   ├── routes/
│   │   │   ├── mailboxRoutes.js
│   │   │   ├── emailRoutes.js
│   │   │   └── logRoutes.js
│   │   ├── middleware/
│   │   │   └── logger.js
│   │   └── server.js
│   ├── logs/
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MailboxManager.js/css
│   │   │   ├── EmailAdder.js/css
│   │   │   ├── EmailManager.js/css
│   │   │   └── LogViewer.js/css
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.js/css
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   │   └── index.html
│   └── package.json
```

## 🎨 Rasgleleştirilmiş Zaman Atama Algoritması

```
1. Bugünden başlayarak sonraki 14 gün içinde hafta içi günleri belirle
2. Toplam mail sayısını hafta içi gün sayısına böl (max 30/gün)
3. Her mail için:
   a. 30 maili almayan bir gün bul
   b. 09:00-18:00 arasında rastgele saat ata
   c. Günün sayacını arttır
4. Email'leri node-schedule ile schedule et
```

## 📞 Destek

Sorularınız veya önerileriniz için iletişime geçebilirsiniz.

## 📄 Lisans

Bu proje açık kaynak kodludur.

---

**Son Güncelleme:** 20.04.2026
