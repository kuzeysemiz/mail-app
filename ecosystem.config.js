module.exports = {
  apps: [
    {
      name: 'mail-api',
      script: './src/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Error/Out logs
      error_file: './logs/api.error.log',
      out_file: './logs/api.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policies
      max_memory_restart: '500M',
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.db'],
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      // Auto restart on crash
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Environment
      merge_logs: true
    },
    {
      name: 'mail-web',
      script: 'serve',
      args: '-s build -l 3000',
      cwd: './frontend',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/web.error.log',
      out_file: './logs/web.out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ],

  // Monitoring and logging
  monitor_interval: 5000,
  
  // Deploy configuration
  deploy: {
    production: {
      user: 'deployer',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/mail-app.git',
      path: '/home/deployer/mail-app',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
