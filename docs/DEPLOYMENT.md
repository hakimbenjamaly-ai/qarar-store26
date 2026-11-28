# نشر قرار على الإنترنت

الطريقة المقترحة: خادم VPS (Ubuntu 24.04، 2 GB رام على الأقل) مع PostgreSQL ونطاق خاص وشهادة HTTPS مجانية. لا يتطلب خدمات مدفوعة غير الخادم والنطاق.

## 1) تجهيز الخادم

```bash
sudo apt update && sudo apt install -y postgresql nginx certbot python3-certbot-nginx git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo -u postgres psql -c "create user qarar with password 'كلمة-مرور-قوية';" -c "create database qarar owner qarar;"
```

## 2) الكود والإعداد

```bash
sudo useradd -m -s /bin/bash qarar && sudo -iu qarar
git clone https://github.com/hakimbenjamaly-ai/qarar-store26.git app && cd app
cp .env.example .env
# عدّل .env:
#   DATABASE_URL="postgresql://qarar:كلمة-المرور@localhost:5432/qarar"
#   UPLOAD_DIR="/home/qarar/uploads"
#   COOKIE_SECURE="true"
#   SITE_URL="https://your-domain.ly"          # لروابط التتبع في رسائل العملاء والبريد
#   CRON_SECRET="سلسلة-عشوائية-طويلة"
#   (اختياري) بريد الإشعارات:
#   SMTP_HOST="smtp.example.com"  SMTP_PORT="587"  SMTP_USER="..."  SMTP_PASS="..."  SMTP_FROM="قرار <no-reply@your-domain.ly>"
npm ci
npx prisma migrate deploy
npm run db:seed
npm run create-admin -- --email you@example.com --name "المدير العام" --password "كلمة-مرور-قوية"
npm run build
cp -r public .next/static .next/standalone/ 2>/dev/null; cp -r .next/static .next/standalone/.next/
```

## 3) تشغيل دائم (systemd)

`/etc/systemd/system/qarar.service`:

```ini
[Unit]
Description=Qarar store
After=network.target postgresql.service

[Service]
User=qarar
WorkingDirectory=/home/qarar/app/.next/standalone
EnvironmentFile=/home/qarar/app/.env
Environment=PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now qarar
```

## 4) النطاق و HTTPS (nginx)

وجّه سجل A للنطاق إلى عنوان الخادم، ثم `/etc/nginx/sites-available/qarar`:

```nginx
server {
  server_name example.ly www.example.ly;
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/qarar /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.ly -d www.example.ly
```

## 5) النسخ الاحتياطي اليومي

`/home/qarar/backup.sh`:

```bash
#!/bin/bash
set -e
D=/home/qarar/backups/$(date +%F)
mkdir -p "$D"
pg_dump -Fc qarar > "$D/db.dump"
tar -czf "$D/uploads.tgz" -C /home/qarar uploads
find /home/qarar/backups -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
```

أضفه إلى cron للمستخدم qarar: `0 3 * * * /home/qarar/backup.sh`. انسخ مجلد backups دورياً إلى مكان آخر خارج الخادم.
الاستعادة: `pg_restore -c -d qarar db.dump` ثم فك ملف الصور في `/home/qarar/uploads`.

## 5.1) إرسال إشعارات البريد دورياً

تُرسل الإشعارات تلقائياً عند فتح لوحة الإدارة. لإرسالها حتى عند عدم فتح اللوحة أضف مهمة cron كل 5 دقائق (`crontab -e` للمستخدم qarar):

```
*/5 * * * * curl -fsS "http://127.0.0.1:3000/api/cron/notify?key=CRON_SECRET" > /dev/null
```

استبدل CRON_SECRET بالقيمة في `.env`. بدون SMTP مضبوط يُرجع المسار `configured: false` ولا يرسل شيئاً.

## 6) التحديث لإصدار جديد

```bash
cd ~/app && git pull && npm ci && npx prisma migrate deploy && npm run build \
  && cp -r .next/static .next/standalone/.next/ && sudo systemctl restart qarar
```
