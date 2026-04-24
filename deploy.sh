#!/bin/bash
set -e

cd /home/kuzey/mail-app

echo "📥 Kod çekiliyor..."
git pull origin main

echo "🛑 Container'lar durduruluyor..."
docker compose down

echo "🔨 Build alınıp başlatılıyor..."
docker compose up -d --build

echo "⏳ Servisler hazır olana kadar bekleniyor..."
sleep 8

echo "📋 Durum:"
docker compose ps

echo "✅ Deploy tamamlandı!"
