# 🚀 Quick Start - 5 Dakikada Kurulum

## Step 1: Server Hazırla (⏱️ 2 dakika)

SSH ile server'a bağlan:
```bash
ssh deployer@your-server-ip
```

Setup script'i çalıştır:
```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/mail-app/main/setup-server.sh | bash
```

## Step 2: GitHub Secrets Ekle (⏱️ 1 dakika)

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. 4 secret ekle:
   - `SERVER_HOST`: `your-server-ip-or-domain.com`
   - `SERVER_USER`: `deployer`
   - `SERVER_SSH_KEY`: (SSH private key'ini yapıştır - `cat ~/.ssh/github-deploy`)
   - `REACT_APP_API_URL`: `https://yourdomain.com/api`

## Step 3: SSL Sertifika (⏱️ 1 dakika)

Server'da çalıştır:
```bash
sudo certbot certonly --nginx -d yourdomain.com
```

## Step 4: .env Dosyası (⏱️ 1 dakika)

Server'da:
```bash
cd ~/mail-app
cp .env.production.example .env
nano .env
```

Şu bilgileri ekle:
```env
GMAIL_EMAIL=your-email@gmail.com
GMAIL_PASSWORD=xxxx xxxx xxxx xxxx
```

## Step 5: Start! 🎉

Server'da:
```bash
cd ~/mail-app
docker compose up -d
```

Test et:
```bash
curl https://yourdomain.com/api/health
```

## ✅ Hepsi Tamam!

Şimdi push yap = Otomatik deploy:
```bash
git add .
git commit -m "Deploy"
git push origin main
```

**GitHub Actions** → 2-3 dakika → **Production'da live** 🎊

---

**Daha fazla bilgi için:** [DEPLOYMENT.md](./DEPLOYMENT.md)
