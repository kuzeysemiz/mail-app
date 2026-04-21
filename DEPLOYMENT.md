# 🚀 Production Deployment Guide

## Genel Bakış

Bu rehber, Mail Gönderme Sistemi'ni production ortamına Docker ve GitHub Actions ile deploy etmenin adımlarını anlatır.

### Stack
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Web Server**: Nginx (Reverse Proxy)
- **Application Server**: Node.js + PM2
- **Database**: SQLite (Volume'de kalıcı depolanır)
- **SSL**: Let's Encrypt (Certbot)

---

## 1️⃣ GitHub Setup

### 1.1 Repository Oluştur

```bash
# GitHub'ta yeni private repository oluştur
# Repository adı: mail-app
```

### 1.2 GitHub Secrets Ayarla

GitHub repository Settings → Secrets and variables → Actions'a git ve şu sekreti ekle:

```
SERVER_HOST: your-server-ip-or-domain.com
SERVER_USER: deployer (veya başka kullanıcı)
SERVER_SSH_KEY: (SSH private key - aşağı bak)
REACT_APP_API_URL: https://yourdomain.com/api
```

### 1.3 SSH Key Oluştur (Server'da)

Server'da çalıştır:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github-deploy -N ""
cat ~/.ssh/github-deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github-deploy  # Bunu kopyala
```

GitHub Secrets'e `SERVER_SSH_KEY` olarak yapıştır.

---

## 2️⃣ Server Setup

### 2.1 Temel Kurulum

SSH ile server'a bağlan:

```bash
ssh deployer@your-server-ip
```

Setup script'i çalıştır:

```bash
curl -fsSL https://raw.githubusercontent.com/yourusername/mail-app/main/setup-server.sh | bash
```

Ya da manuel olarak:

```bash
# Sistem güncellemesi
sudo apt-get update && sudo apt-get upgrade -y

# Node.js 18 kurulumu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker kurulumu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose kurulumu
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Nginx kurulumu
sudo apt-get install -y nginx

# Certbot kurulumu
sudo apt-get install -y certbot python3-certbot-nginx

# Firewall
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw --force enable
```

### 2.2 SSL Sertifikası Oluştur

```bash
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com
```

### 2.3 Nginx Konfigürasyonu

```bash
# Repository'den indirilen nginx config'i kopyala
sudo cp /home/deployer/mail-app/nginx-production.conf /etc/nginx/sites-available/mail-app.conf

# Dosyada yourdomain.com'u seninkiyle değiştir
sudo sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/mail-app.conf

# Enable et
sudo ln -s /etc/nginx/sites-available/mail-app.conf /etc/nginx/sites-enabled/

# Test et
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

### 2.4 Environment Dosyası

```bash
cd ~/mail-app

# Repository'den example dosyasını kopyala
cp .env.production.example .env

# Güvenli bilgileri ekle
nano .env
```

**Important:** `.env` dosyasına eklenecek bilgiler:
```env
GMAIL_EMAIL=your-email@gmail.com
GMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # 16 karakterli App Password
```

### 2.5 Docker Konteynerlerini Başlat

```bash
cd ~/mail-app

# Docker Hub'da login et (isteğe bağlı - public repo için gerekli değil)
docker login ghcr.io

# Konteynerler başlat
docker compose up -d

# Status kontrol et
docker compose ps

# Logları kontrol et
docker compose logs -f api
docker compose logs -f web
```

---

## 3️⃣ GitHub Actions CI/CD

### 3.1 Workflow Nasıl Çalışır?

```
1. GitHub'a push yap (main branch)
    ↓
2. GitHub Actions: Build ve test
    ↓
3. Docker images oluştur ve push et (ghcr.io)
    ↓
4. SSH ile server'a bağlan
    ↓
5. Latest images'ı pull et
    ↓
6. Docker Compose restart et
    ↓
7. ✅ Production'a live
```

### 3.2 İlk Deploy

```bash
# Lokal bilgisayarında
git clone https://github.com/yourusername/mail-app.git
cd mail-app

# Değişiklik yap (örneğin README)
echo "Deployment test" >> README.md

# Commit ve push
git add .
git commit -m "Test deployment"
git push origin main
```

**Sonra:**
1. GitHub Actions'a git: Repository → Actions tab
2. Deploy workflow'u çalışıyor mu kontrol et
3. Tamamlandıktan sonra, SSH ile server'a bağlan ve kontrol et:

```bash
curl https://yourdomain.com/api/health
```

---

## 4️⃣ Monitoring & Maintenance

### 4.1 Logs Kontrol Et

```bash
# Docker logs
docker compose logs -f api
docker compose logs -f web

# Nginx logs
tail -f /var/log/nginx/mail-app-access.log
tail -f /var/log/nginx/mail-app-error.log

# Uygulama logs
docker compose exec api tail -f logs/combined.log
```

### 4.2 Health Check

```bash
# API health
curl https://yourdomain.com/api/health

# Docker health
docker compose ps
docker inspect mail_api | grep -A 5 "Health"
```

### 4.3 Database Backup

```bash
# Database'i download et
docker compose cp mail_api:/app/mail_scheduler.db ./backup-$(date +%Y%m%d-%H%M%S).db

# SSH'dan indir
scp deployer@your-server:/home/deployer/mail-app/mail_scheduler.db ./local-backup.db
```

### 4.4 Updates

Yeni sürümü deploy etmek için:

```bash
# Lokal bilgisayarında
git pull origin main
# Değişiklikler yap
git commit -m "Description"
git push origin main

# GitHub Actions otomatik deploy yapacak
# Server'da status kontrol et:
docker compose ps
```

---

## 5️⃣ Security Checklist

- [ ] SSH key secure (chmod 600)
- [ ] GitHub Secrets güvenli şifrelerle set
- [ ] Nginx SSL sertifikası aktif (https://yourdomain.com)
- [ ] Firewall kuralları kontrol
- [ ] Database yedekleri alınıyor
- [ ] Nginx Security Headers aktif
- [ ] `.env` dosyası `.gitignore`'da (push edilmesin)
- [ ] Regular backups planlandı

---

## 6️⃣ Troubleshooting

### Container başlamıyor

```bash
# Logs kontrol et
docker compose logs api

# Container'ı restart et
docker compose restart api

# Rebuild et
docker compose build --no-cache
docker compose up -d
```

### API bağlantısı yok

```bash
# Network kontrol
docker network ls
docker network inspect mail_network

# API health
docker compose exec api curl http://localhost:5000/api/health
```

### Nginx 502 Bad Gateway

```bash
# Nginx logs kontrol et
sudo tail -f /var/log/nginx/mail-app-error.log

# Docker containers running mi?
docker compose ps

# Ports kontrol et
sudo netstat -tulpn | grep -E ':(3000|5000|80|443)'
```

### SSL sertifikası süresi doldu

```bash
# Renew et
sudo certbot renew

# Auto-renew test et
sudo certbot renew --dry-run
```

---

## 7️⃣ Konfigürasyonlar

### docker-compose.yml
- API container: Port 5000
- Web container: Port 3000 (Nginx'ten)
- Health checks aktif
- Volumes: Database ve logs persistent

### nginx-production.conf
- HTTP → HTTPS redirect
- SSL/TLS 1.2+
- Security headers
- Reverse proxy: API ve Frontend
- Gzip compression
- Rate limiting (isteğe bağlı)

### .env (Production)
- NODE_ENV=production
- GMAIL_EMAIL ve GMAIL_PASSWORD (secure)
- Database path

---

## 📞 Support

Sorun? Kontrol ettiğin şeyler:

1. GitHub Actions logs: Repository → Actions → Failed workflow
2. Server logs: `docker compose logs`
3. Nginx: `sudo nginx -t` ve `sudo tail -f /var/log/nginx/error.log`
4. SSH connection: `ssh -i ~/.ssh/github-deploy deployer@your-server`

---

**Last Updated:** April 20, 2026
