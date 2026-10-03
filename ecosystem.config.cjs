const path = require('path');

module.exports = {
  apps: [
    {
      name: 'vynaa-bot',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1000M',
      node_args: '--expose-gc --max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Jakarta'
      },
      time: true,
      error_file: path.join(__dirname, 'logs', 'error.log'),
      out_file: path.join(__dirname, 'logs', 'out.log'),
      merge_logs: true,
      restart_delay: 2000,
      exp_backoff_restart_delay: 100
    }
  ]
};
