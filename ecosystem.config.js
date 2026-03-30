module.exports = {
  apps: [
    {
      name: 'elter-bot',
      script: 'src/telegram.bot.js',
      cwd: '/home/alivkon/bots/ElterBotAI', // рабочая директория
      node_args: '-r dotenv/config',
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