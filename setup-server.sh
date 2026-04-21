#!/bin/bash

# Mail Gönderme Sistemi - Production Server Setup Script
# Bu script sunucuya ilk kurulum yapacak

set -e

echo "🚀 Mail Gönderme Sistemi - Production Setup"
echo "=========================================="

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Sistem güncellemesi
echo -e "${YELLOW}1/10: Sistem paketleri güncelleniyor...${NC}"
sudo apt-get update && sudo apt-get upgrade -y

# Node.js kurulumu
echo -e "${YELLOW}2/10: Node.js ve NPM kurulumu...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker kurulumu
echo -e "${YELLOW}3/10: Docker kurulumu...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Docker Compose kurulumu
echo -e "${YELLOW}4/10: Docker Compose kurulumu...${NC}"
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# PM2 global kurulumu
echo -e "${YELLOW}5/10: PM2 global kurulumu...${NC}"
sudo npm install -g pm2
pm2 startup
pm2 save

# Nginx kurulumu
echo -e "${YELLOW}6/10: Nginx kurulumu...${NC}"
sudo apt-get install -y nginx

# Certbot (Let's Encrypt) kurulumu
echo -e "${YELLOW}7/10: Certbot kurulumu...${NC}"
sudo apt-get install -y certbot python3-certbot-nginx

# Firewall konfigürasyonu (UFW)
echo -e "${YELLOW}8/10: Firewall konfigürasyonu...${NC}"
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw --force enable

# Uygulama klasörü oluştur
echo -e "${YELLOW}9/10: Uygulama klasörleri oluşturuluyor...${NC}"
mkdir -p ~/mail-app
mkdir -p ~/mail-app/logs

# Git kurulumu (varsa)
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}10/10: Git kurulumu...${NC}"
    sudo apt-get install -y git
fi

echo -e "${GREEN}✅ Temel setup tamamlandı!${NC}"
echo ""
echo -e "${YELLOW}Sonraki adımlar:${NC}"
echo "1. GitHub repository'ni klonla:"
echo "   cd ~/mail-app"
echo "   git clone https://github.com/yourusername/mail-app.git ."
echo ""
echo "2. Environment dosyasını oluştur:"
echo "   cp .env.production.example .env"
echo "   nano .env  # Güvenli bilgileri ekle"
echo ""
echo "3. SSL sertifikası al:"
echo "   sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com"
echo ""
echo "4. Nginx konfigürasyonunu kopyala:"
echo "   sudo cp nginx-production.conf /etc/nginx/sites-available/mail-app.conf"
echo "   sudo ln -s /etc/nginx/sites-available/mail-app.conf /etc/nginx/sites-enabled/"
echo "   sudo nginx -t"
echo "   sudo systemctl restart nginx"
echo ""
echo "5. Docker konteynerlerini başlat:"
echo "   cd ~/mail-app"
echo "   docker compose up -d"
echo ""
echo "6. Health check et:"
echo "   curl https://yourdomain.com/api/health"
echo ""
