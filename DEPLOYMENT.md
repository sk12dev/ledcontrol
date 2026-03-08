# Quick Deployment Guide

This is a condensed deployment guide. For detailed information, see [docs/deployment-guide.md](docs/deployment-guide.md).

## One-Command Deploy (Fresh Ubuntu Server)

On a new Ubuntu server with SSH access, run:

```bash
curl -sSL https://raw.githubusercontent.com/sk12dev/ledcontrol/main/scripts/deploy.sh | bash
```

This installs Node.js, PostgreSQL, Nginx, PM2, clones from [GitHub](https://github.com/sk12dev/ledcontrol), creates the database, builds the app, and configures everything.

**Custom DB password:** `DB_PASSWORD=yourpassword curl -sSL ... | bash`

---

## Alternative: Transfer Files Then Deploy

### 1. Transfer Files to Server

From your Windows machine, in PowerShell:

```powershell
# Navigate to project directory
cd C:\Users\Andy\Documents\Development\LedControl\ledcontrol

# Transfer files via SCP (use your SSH key path - PowerShell: $env:USERPROFILE\.ssh\id_rsa)
scp -r -i $env:USERPROFILE\.ssh\id_rsa * administrator@192.168.1.39:/tmp/ledcontrol/

# Then on server, move to final location:
# ssh administrator@192.168.1.39
# sudo mkdir -p /var/www
# sudo mv /tmp/ledcontrol /var/www/ledcontrol
# sudo chown -R $USER:$USER /var/www/ledcontrol
```

### 2. Run Deploy Script on Server

The script clones from GitHub if needed, installs PostgreSQL/Nginx/Node.js, and configures everything:

```bash
cd /var/www/ledcontrol
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

If files were transferred manually (not cloned), the script will still run. If the directory exists but isn't a git repo, it backs up and clones fresh.

### 3. Manual Steps (if script doesn't complete)

```bash
# Copy environment templates (do this before deploy script for Prisma to work)
cp backend/env.template backend/.env
cp env.production.template .env.production

# Edit with your values (DATABASE_URL, FRONTEND_URL, VITE_API_URL)
nano backend/.env
nano .env.production

# Install dependencies
npm install
cd backend && npm install && cd ..

# Generate Prisma client and run migrations (DATABASE_URL must be in backend/.env)
export $(grep -v '^#' backend/.env | xargs) && npx prisma generate
export $(grep -v '^#' backend/.env | xargs) && npx prisma migrate deploy

# Build application (backend first, then frontend)
cd backend && npm run build && cd ..
npm run build

# Create log directory
sudo mkdir -p /var/log/wled-backend
sudo chown -R $USER:$USER /var/log/wled-backend

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
cd backend && npm run build && cd ..
npm run build
npx prisma generate
npx prisma migrate deploy
pm2 restart wled-backend
```

## Troubleshooting

- **Backend not starting**: Check `pm2 logs wled-backend`
- **Frontend not loading**: Check `sudo tail -f /var/log/nginx/error.log`
- **Database issues**: Verify PostgreSQL is running and DATABASE_URL is correct

For detailed troubleshooting, see [docs/deployment-guide.md](docs/deployment-guide.md).
