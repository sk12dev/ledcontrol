#!/bin/bash
# Deployment script for WLED Control Interface
# Run this script on your Ubuntu server

set -e  # Exit on error

APP_DIR="/var/www/ledcontrol"
BACKEND_DIR="$APP_DIR/backend"
LOG_DIR="/var/log/wled-backend"

echo "🚀 Starting WLED Control Interface Deployment..."

# Check if running as root or with sudo
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Please run this script as a regular user (not root)"
    echo "   The script will prompt for sudo when needed"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Check PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Navigate to app directory
if [ ! -d "$APP_DIR" ]; then
    echo "❌ Application directory not found: $APP_DIR"
    echo "   Please clone or copy the application files first"
    exit 1
fi

cd "$APP_DIR"

echo "📦 Installing dependencies..."

# Install root dependencies
if [ -f "package.json" ]; then
    npm install
else
    echo "⚠️  package.json not found in root directory"
fi

# Install backend dependencies
if [ -d "$BACKEND_DIR" ] && [ -f "$BACKEND_DIR/package.json" ]; then
    cd "$BACKEND_DIR"
    npm install
    cd "$APP_DIR"
else
    echo "⚠️  Backend directory or package.json not found"
fi

# Check for .env files
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "⚠️  Backend .env file not found at $BACKEND_DIR/.env"
    echo "   Please create it with required environment variables"
    echo "   See docs/deployment-guide.md for details"
fi

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate || echo "⚠️  Prisma generate failed - make sure DATABASE_URL is set"

# Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy || echo "⚠️  Migration failed - check database connection"

# Build backend
echo "🏗️  Building backend..."
if [ -d "$BACKEND_DIR" ]; then
    cd "$BACKEND_DIR"
    npm run build || {
        echo "❌ Backend build failed"
        exit 1
    }
    cd "$APP_DIR"
fi

# Build frontend
echo "🏗️  Building frontend..."
npm run build || {
    echo "❌ Frontend build failed"
    exit 1
}

# Create log directory
if [ ! -d "$LOG_DIR" ]; then
    echo "📁 Creating log directory..."
    sudo mkdir -p "$LOG_DIR"
    sudo chown -R $USER:$USER "$LOG_DIR"
fi

# Check if PM2 app is already running
if pm2 list | grep -q "wled-backend"; then
    echo "🔄 Restarting existing PM2 application..."
    pm2 restart wled-backend
else
    echo "▶️  Starting PM2 application..."
    if [ -f "ecosystem.config.js" ]; then
        pm2 start ecosystem.config.js
    else
        # Fallback: start directly
        cd "$BACKEND_DIR"
        pm2 start dist/server.js --name wled-backend --cwd "$APP_DIR"
        cd "$APP_DIR"
    fi
fi

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
if ! pm2 startup | grep -q "already setup"; then
    echo "📝 Setting up PM2 startup script..."
    echo "   Please run the command shown above with sudo"
    pm2 startup
fi

echo "✅ Deployment complete!"
echo ""
echo "📊 Application Status:"
pm2 status
echo ""
echo "📝 View logs with: pm2 logs wled-backend"
echo "🌐 Frontend should be available at: http://192.168.1.39"
echo "🔍 Backend API health check: http://192.168.1.39/api/health"
