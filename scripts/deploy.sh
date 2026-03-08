#!/bin/bash
# Deployment script for WLED Control Interface
# Installs all dependencies (Node.js, PostgreSQL, Nginx, PM2) and deploys from GitHub
# Run on Ubuntu server: curl -sSL <url> | bash  OR  ./deploy.sh

set -e

APP_DIR="/var/www/ledcontrol"
BACKEND_DIR="$APP_DIR/backend"
LOG_DIR="/var/log/wled-backend"
REPO_URL="https://github.com/sk12dev/ledcontrol.git"
DB_USER="wled_user"
DB_NAME="wled_control"
DB_PASSWORD="${DB_PASSWORD:-pass12345}"

echo "🚀 Starting WLED Control Interface Deployment..."

# Check not running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please run as a regular user (not root). Script will prompt for sudo when needed."
    exit 1
fi

# Detect server IP for env files (use first non-loopback address)
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="localhost"
fi

echo "📍 Server IP detected: $SERVER_IP"
echo ""

# --- Install system dependencies ---
echo "📦 Updating package lists..."
sudo apt-get update -qq

# Install Node.js 20
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi
echo "✅ Node.js $(node --version)"

# Install Git
if ! command -v git &> /dev/null; then
    echo "📦 Installing Git..."
    sudo apt-get install -y git
fi

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    sudo apt-get install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi
echo "✅ PostgreSQL installed"

# Create database and user (idempotent)
echo "🗄️  Setting up database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
echo "✅ Database $DB_NAME ready"

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    sudo apt-get install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi
echo "✅ Nginx installed"

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# --- Clone or update application ---
echo ""
echo "📥 Fetching application from GitHub..."

sudo mkdir -p /var/www
if [ ! -d "$APP_DIR/.git" ]; then
    if [ -d "$APP_DIR" ]; then
        echo "⚠️  $APP_DIR exists but is not a git repo. Backing up and cloning..."
        sudo mv "$APP_DIR" "${APP_DIR}.bak.$(date +%s)"
    fi
    sudo git clone "$REPO_URL" "$APP_DIR"
else
    cd "$APP_DIR"
    git fetch origin
    git reset --hard origin/main
fi
sudo chown -R $USER:$USER "$APP_DIR"
cd "$APP_DIR"

# Prisma: remove prisma.config.ts (requires prisma/config module, fails on server)
# Use prisma.config.mjs instead which works without that import
rm -f prisma.config.ts
if [ ! -f "prisma.config.mjs" ]; then
    echo "📝 Creating prisma.config.mjs..."
    cat > prisma.config.mjs << 'PRISMA_CONFIG'
import "dotenv/config";

export default {
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL,
  },
};
PRISMA_CONFIG
fi

# --- Environment files ---
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "📝 Creating backend/.env from template..."
    cp backend/env.template backend/.env
    sed -i "s|192.168.1.39|$SERVER_IP|g" backend/.env
    echo "   Edit backend/.env if you need to change DATABASE_URL or FRONTEND_URL"
fi

if [ ! -f ".env.production" ]; then
    echo "📝 Creating .env.production from template..."
    cp env.production.template .env.production
    sed -i "s|192.168.1.39|$SERVER_IP|g" .env.production
fi

# Load backend .env for Prisma
if [ -f "$BACKEND_DIR/.env" ]; then
    set -a
    source "$BACKEND_DIR/.env"
    set +a
fi

# --- Build ---
echo ""
echo "📦 Installing dependencies..."
# Root and backend need devDependencies (tsc, vite, @types/*) for build - ensure they install even if NODE_ENV=production
npm install --include=dev
cd backend && npm install --include=dev && cd ..

echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "🗄️  Running migrations..."
npx prisma migrate deploy

echo "🏗️  Building backend..."
cd backend && npm run build && cd ..

echo "🏗️  Building frontend..."
npm run build

# --- Log directory ---
if [ ! -d "$LOG_DIR" ]; then
    sudo mkdir -p "$LOG_DIR"
    sudo chown -R $USER:$USER "$LOG_DIR"
fi

# --- PM2 ---
echo ""
if pm2 list 2>/dev/null | grep -q "wled-backend"; then
    echo "🔄 Restarting PM2 application..."
    pm2 restart wled-backend
else
    echo "▶️  Starting PM2 application..."
    if [ -f "ecosystem.config.cjs" ]; then
        pm2 start ecosystem.config.cjs
    else
        cd "$BACKEND_DIR"
        pm2 start dist/server.js --name wled-backend --cwd "$BACKEND_DIR"
        cd "$APP_DIR"
    fi
fi
pm2 save

echo "📝 Run the sudo command below to enable PM2 on boot (optional):"
pm2 startup systemd 2>/dev/null || true

# --- Nginx ---
echo ""
echo "🌐 Configuring Nginx..."

# Replace server IP in nginx config
sudo cp scripts/nginx-ledcontrol.conf /etc/nginx/sites-available/ledcontrol
sudo sed -i "s|192.168.1.39|$SERVER_IP|g" /etc/nginx/sites-available/ledcontrol

if [ ! -L /etc/nginx/sites-enabled/ledcontrol ]; then
    sudo ln -sf /etc/nginx/sites-available/ledcontrol /etc/nginx/sites-enabled/
fi

# Disable default site if it exists
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

sudo nginx -t && sudo systemctl reload nginx
echo "✅ Nginx configured"

# --- Done ---
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Application Status:"
pm2 status
echo ""
echo "🌐 Frontend:  http://$SERVER_IP"
echo "🔍 API Health: http://$SERVER_IP/api/health"
echo "📝 Logs: pm2 logs wled-backend"
echo ""
echo "⚠️  Change DB password: set DB_PASSWORD before running, or edit backend/.env"
