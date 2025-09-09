module.exports = {
  apps: [{
    name: 'classroom-points-system',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // 环境变量
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // 日志配置
    log_file: 'logs/pm2.log',
    out_file: 'logs/pm2-out.log',
    error_file: 'logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    
    // 重启策略
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    
    // 监控配置
    watch: false,
    ignore_watch: [
      'node_modules',
      'logs',
      'data',
      'backups',
      'tests'
    ],
    
    // 进程配置
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // 自动重启条件
    autorestart: true,
    
    // 错误处理
    exp_backoff_restart_delay: 100,
    
    // 健康检查
    health_check_grace_period: 3000
  }],

  deploy: {
    production: {
      user: 'classroom-points',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:username/classroom-points-system.git',
      path: '/opt/classroom-points-system',
      'pre-deploy-local': '',
      'post-deploy': 'npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};