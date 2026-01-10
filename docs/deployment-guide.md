# Deployment Guide - WLED Control Interface

This guide covers deploying the WLED Control Interface to your Ubuntu server (192.168.1.39).

## Prerequisites

- Ubuntu server with SSH access
- Node.js 18+ installed on the server
- PostgreSQL database (already set up on 192.168.1.39)
- Nginx installed and configured
- Git installed on the server

## Architecture Overview

```
┌─────────────────┐
│   Web Browser   │
└────────┬────────┘
         │
         │ HTTPS/HTTP
         ▼
┌─────────────────┐
│     Nginx       │ (Port 80/443)
│  Reverse Proxy  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────┐
│Frontend│ │   Backend    │
│ (Static│ │  API Server  │ (Port 3001)
│  Files)│ │   Node.js    │
└────────┘ └──────┬───────┘
                  │
                  ▼
          ┌──────────────┐
          │  PostgreSQL  │
          │   Database   │ (Port 5432)
          └──────────────┘
```

## Step 1: Server Setup

### Install Node.js (if not already installed)

```bash
# On Ubuntu server via SSH
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

### Install Nginx (if not already installed)

```bash
sudo apt update
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Install PM2 (Process Manager for Node.js)

```bash
sudo npm install -g pm2
```

## Step 2: Clone Repository to Server

```bash
# Create application directory
sudo mkdir -p /var/www
cd /var/www

# Clone your repository (replace with your actual repo URL if using Git)
# If deploying manually, create the directory and transfer files via SCP/SFTP
sudo mkdir -p ledcontrol
cd ledcontrol
```

**Option A: Using Git (Recommended)**

```bash
sudo git clone https://github.com/sk12dev/ledcontrol.git
sudo chown -R $USER:$USER /var/www/ledcontrol
```

**Option B: Manual Transfer from Windows**

```powershell
# From Windows PowerShell, in your project directory
scp -r -i <path-to-ssh-key> * administrator@192.168.1.39:/var/www/ledcontrol/
```

## Step 3: Install Dependencies

```bash
cd /var/www/ledcontrol

# Install root dependencies (frontend)
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

## Step 4: Configure Environment Variables

### Backend Environment Variables

Create `/var/www/ledcontrol/backend/.env`:

```bash
sudo nano /var/www/ledcontrol/backend/.env
```

Add the following (adjust values as needed):

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Frontend URL (for CORS)
FRONTEND_URL=http://192.168.1.39

# Database Configuration
DATABASE_URL="postgresql://wled_user:pass12345@localhost:5432/wled_control?schema=public"
```

### Frontend Environment Variables

Create `/var/www/ledcontrol/.env.production`:

```bash
sudo nano /var/www/ledcontrol/.env.production
```

Add:

```env
VITE_API_URL=http://192.168.1.39/api
```

## Step 5: Database Setup

If the database is already set up, just run migrations:

```bash
cd /var/www/ledcontrol

# Generate Prisma Client
npx prisma generate

# Run migrations (if not already done)
npx prisma migrate deploy
```

## Step 6: Build Application

### Build Backend

```bash
cd /var/www/ledcontrol/backend
npm run build
```

### Build Frontend

```bash
cd /var/www/ledcontrol
npm run build
```

This creates a `dist` folder with static files that will be served by Nginx.

## Step 7: Set Up Process Manager (PM2)

Create a PM2 ecosystem file at `/var/www/ledcontrol/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "wled-backend",
      script: "./backend/dist/server.js",
      cwd: "/var/www/ledcontrol",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "/var/log/wled-backend/error.log",
      out_file: "/var/log/wled-backend/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
    },
  ],
};
```

Create log directory:

```bash
sudo mkdir -p /var/log/wled-backend
sudo chown -R $USER:$USER /var/log/wled-backend
```

Start the backend with PM2:

```bash
cd /var/www/ledcontrol
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

The last command will give you a command to run with `sudo` to enable PM2 on system boot.

## Step 8: Configure Nginx

Create Nginx configuration at `/etc/nginx/sites-available/ledcontrol`:

```nginx
server {
    listen 80;
    server_name 192.168.1.39;  # Or your domain name if you have one

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend static files
    root /var/www/ledcontrol/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Serve frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api {
        proxy_pass http://localhost:3001/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Increase timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/ledcontrol /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Step 9: Firewall Configuration

Ensure ports 80 (and 443 if using SSL) are open:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

## Step 10: Verify Deployment

1. **Check Backend is Running:**

   ```bash
   pm2 status
   pm2 logs wled-backend
   ```

2. **Check Nginx Status:**

   ```bash
   sudo systemctl status nginx
   ```

3. **Test Backend API:**

   ```bash
   curl http://localhost:3001/health
   ```

4. **Test Frontend:**
   Open `http://192.168.1.39` in your browser

## Updating the Application

When you need to update the application:

```bash
cd /var/www/ledcontrol

# Pull latest changes (if using Git)
git pull

# Or transfer new files manually

# Reinstall dependencies if package.json changed
npm install
cd backend && npm install && cd ..

# Rebuild
npm run build
cd backend && npm run build && cd ..

# Regenerate Prisma Client
npx prisma generate

# Run new migrations if any
npx prisma migrate deploy

# Restart backend
pm2 restart wled-backend

# Check status
pm2 status
pm2 logs wled-backend --lines 50
```

## Troubleshooting

### Backend Not Starting

1. Check PM2 logs:

   ```bash
   pm2 logs wled-backend
   ```

2. Check if port 3001 is already in use:

   ```bash
   sudo netstat -tulpn | grep 3001
   ```

3. Verify environment variables:

   ```bash
   cd /var/www/ledcontrol/backend
   cat .env
   ```

4. Test database connection:
   ```bash
   psql -U wled_user -d wled_control -h localhost
   ```

### Frontend Not Loading

1. Check Nginx error logs:

   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. Verify static files exist:

   ```bash
   ls -la /var/www/ledcontrol/dist
   ```

3. Check Nginx configuration:
   ```bash
   sudo nginx -t
   ```

### Database Connection Issues

1. Verify PostgreSQL is running:

   ```bash
   sudo systemctl status postgresql
   ```

2. Check database connection from server:

   ```bash
   psql -U wled_user -d wled_control -h localhost
   ```

3. Verify DATABASE_URL in backend/.env matches your setup

## Optional: SSL/HTTPS Setup

If you have a domain name and want SSL:

1. Install Certbot:

   ```bash
   sudo apt install certbot python3-certbot-nginx
   ```

2. Obtain certificate:

   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

3. Auto-renewal is set up automatically

## Security Recommendations

1. **Change default database password** - Don't use `pass12345` in production
2. **Use environment variables** - Never commit `.env` files
3. **Set up firewall** - Only allow necessary ports
4. **Enable SSL** - Use HTTPS in production
5. **Regular updates** - Keep Node.js, Nginx, and PostgreSQL updated
6. **Backup database** - Set up regular database backups

## Backup Strategy

### Database Backup

Create a backup script at `/var/www/ledcontrol/scripts/backup-db.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/wled-db"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

pg_dump -U wled_user -h localhost wled_control > $BACKUP_DIR/wled_control_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "wled_control_*.sql" -mtime +7 -delete
```

Add to crontab for daily backups:

```bash
crontab -e
# Add: 0 2 * * * /var/www/ledcontrol/scripts/backup-db.sh
```

## Monitoring

Monitor your application:

```bash
# PM2 monitoring
pm2 monit

# Check logs
pm2 logs

# System resources
htop

# Nginx access logs
sudo tail -f /var/log/nginx/access.log
```
