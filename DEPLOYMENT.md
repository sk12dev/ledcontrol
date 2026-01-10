# Quick Deployment Guide

This is a condensed deployment guide. For detailed information, see [docs/deployment-guide.md](docs/deployment-guide.md).

## Quick Start (Ubuntu Server)

### 1. Transfer Files to Server

From your Windows machine, in PowerShell:

```powershell
# Navigate to project directory
cd C:\Users\Andy\Documents\Development\LedControl\ledcontrol

# Transfer files via SCP (replace with your SSH key if needed)
scp -r -i ~/.ssh/id_rsa * administrator@192.168.1.39:/tmp/ledcontrol/

# Then on server, move to final location:
# ssh administrator@192.168.1.39
# sudo mv /tmp/ledcontrol /var/www/ledcontrol
# sudo chown -R $USER:$USER /var/www/ledcontrol
```

### 2. On Ubuntu Server - Run Automated Deployment

```bash
cd /var/www/ledcontrol
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 3. Manual Steps (if script doesn't complete)

```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Copy environment templates
cp backend/env.template backend/.env
cp env.production.template .env.production

# Edit environment files
nano backend/.env
nano .env.production

# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# Build application
cd backend && npm run build && cd ..
npm run build

# Setup Nginx
sudo cp scripts/nginx-ledcontrol.conf /etc/nginx/sites-available/ledcontrol
sudo ln -s /etc/nginx/sites-available/ledcontrol /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # Follow instructions shown
```

### 4. Verify

- Frontend: http://192.168.1.39
- Backend Health: http://192.168.1.39/api/health
- PM2 Status: `pm2 status`

## Environment Variables Required

### Backend (`backend/.env`)
```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://192.168.1.39
DATABASE_URL="postgresql://wled_user:pass12345@localhost:5432/wled_control?schema=public"
```

### Frontend (`.env.production`)
```env
VITE_API_URL=http://192.168.1.39/api
```

## Update Application

```bash
cd /var/www/ledcontrol
git pull  # or transfer new files
npm install
cd backend && npm install && cd ..
npm run build
cd backend && npm run build && cd ..
npx prisma generate
npx prisma migrate deploy
pm2 restart wled-backend
```

## Troubleshooting

- **Backend not starting**: Check `pm2 logs wled-backend`
- **Frontend not loading**: Check `sudo tail -f /var/log/nginx/error.log`
- **Database issues**: Verify PostgreSQL is running and DATABASE_URL is correct

For detailed troubleshooting, see [docs/deployment-guide.md](docs/deployment-guide.md).
