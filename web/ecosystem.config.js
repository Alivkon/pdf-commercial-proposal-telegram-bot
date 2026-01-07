module.exports = {
  apps: [
    {
      name: 'elter-web',
      script: './server.js',
      cwd: '/home/alivkon/projects/FL/ElterKPtoPDF/jscript/web',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        WEB_PORT: 3000,
        WEB_HOST: '0.0.0.0'
      },
      env_development: {
        NODE_ENV: 'development',
        WEB_PORT: 3000,
        WEB_HOST: 'localhost'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
