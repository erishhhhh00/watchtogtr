module.exports = {
  apps: [
    {
      name: 'watchtogtr-backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
        REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
      },
      watch: false,
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      max_restarts: 10,
      min_uptime: 5000,
      restart_delay: 2000,
    },
  ],
};
