/**
 * PM2 Ecosystem Configuration
 * Manages the backend API process
 */
module.exports = {
  apps: [{
    name: 'wled-backend',
    script: '/var/www/ledcontrol/backend/dist/server.js',
    cwd: '/var/www/ledcontrol',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
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