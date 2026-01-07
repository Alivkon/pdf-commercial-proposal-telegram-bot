module.exports = {
  apps: [
    {
      name: 'nicolay-charge-gpt',
      script: 'src/telegram.bot.js',
      cwd: '/home/alivkon/bots/NicolayChargeGPT/jscript', // рабочая директория
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};