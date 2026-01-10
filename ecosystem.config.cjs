/**
 * PM2 Ecosystem Configuration
 * Manages the backend API process
 */
const fs = require('fs');
const path = require('path');

// Load environment variables from backend/.env file
function loadEnvFile(envPath) {
  const env = {};
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=');
          // Remove quotes if present
          value = value.replace(/^["']|["']$/g, '');
          env[key.trim()] = value.trim();
        }
      }
    });
  }
  return env;
}

const backendEnvPath = path.join(__dirname, 'backend', '.env');
const backendEnv = loadEnvFile(backendEnvPath);

module.exports = {
  apps: [{
    name: 'wled-backend',
    script: '/var/www/ledcontrol/backend/dist/server.js',
    cwd: '/var/www/ledcontrol/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      ...backendEnv
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      ...backendEnv
    },
    error_file: '/var/log/wled-backend/error.log',
    out_file: '/var/log/wled-backend/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
};