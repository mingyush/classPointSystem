# 班级积分管理系统部署指南

## 系统要求

### 硬件要求
- **CPU**: 双核 2.0GHz 或更高
- **内存**: 最少 2GB RAM，推荐 4GB
- **存储**: 最少 1GB 可用空间，推荐 5GB
- **网络**: 稳定的网络连接

### 软件要求
- **操作系统**: Windows 10/11, macOS 10.14+, Ubuntu 18.04+
- **Node.js**: 版本 14.0.0 或更高
- **npm**: 版本 6.0.0 或更高

## 安装步骤

### 1. 环境准备

#### 安装 Node.js
```bash
# 检查 Node.js 版本
node --version

# 如果未安装或版本过低，请访问 https://nodejs.org 下载安装
```

#### 创建系统用户（Linux/macOS）
```bash
# 创建专用用户
sudo useradd -m -s /bin/bash classroom-points
sudo usermod -aG sudo classroom-points

# 切换到系统用户
sudo su - classroom-points
```

### 2. 下载和安装

#### 下载源码
```bash
# 下载项目文件到目标目录
cd /opt
sudo mkdir classroom-points-system
sudo chown classroom-points:classroom-points classroom-points-system
cd classroom-points-system

# 解压项目文件（假设已有项目压缩包）
tar -xzf classroom-points-system.tar.gz
```

#### 安装依赖
```bash
# 安装项目依赖
npm install --production

# 验证安装
npm list --depth=0
```

### 3. 配置系统

#### 环境配置
```bash
# 复制生产环境配置
cp config/production.json config/config.json

# 编辑配置文件
nano config/config.json
```

#### 重要配置项说明
- `security.jwtSecret`: **必须修改**为随机字符串
- `server.port`: 服务端口，默认 3000
- `server.host`: 绑定地址，生产环境建议 "0.0.0.0"
- `logging.file.path`: 日志文件路径
- `database.dataPath`: 数据文件存储路径

#### 创建必要目录
```bash
# 创建数据和日志目录
mkdir -p data logs backups
chmod 755 data logs backups

# 设置权限
chown -R classroom-points:classroom-points data logs backups
```

### 4. 初始化数据

#### 首次运行初始化
```bash
# 初始化系统数据
npm run init

# 或者手动启动一次让系统自动初始化
npm start
# 看到 "班级积分管理系统已启动" 后按 Ctrl+C 停止
```

#### 验证数据文件
```bash
# 检查数据文件是否创建成功
ls -la data/
# 应该看到: students.json, points.json, products.json, orders.json, config.json
```

## 部署方式

### 方式一：直接运行（开发/测试环境）

```bash
# 启动服务
npm start

# 后台运行
nohup npm start > logs/app.log 2>&1 &
```

### 方式二：使用 PM2（推荐生产环境）

#### 安装 PM2
```bash
# 全局安装 PM2
npm install -g pm2

# 验证安装
pm2 --version
```

#### 创建 PM2 配置文件
```bash
# 创建 ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'classroom-points-system',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: 'logs/pm2.log',
    out_file: 'logs/pm2-out.log',
    error_file: 'logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
```

#### 启动服务
```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs classroom-points-system

# 设置开机自启
pm2 startup
pm2 save
```

### 方式三：使用 systemd（Linux 系统）

#### 创建服务文件
```bash
sudo cat > /etc/systemd/system/classroom-points.service << 'EOF'
[Unit]
Description=Classroom Points Management System
After=network.target

[Service]
Type=simple
User=classroom-points
WorkingDirectory=/opt/classroom-points-system
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

# 日志配置
StandardOutput=append:/opt/classroom-points-system/logs/systemd.log
StandardError=append:/opt/classroom-points-system/logs/systemd-error.log

[Install]
WantedBy=multi-user.target
EOF
```

#### 启动服务
```bash
# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start classroom-points

# 设置开机自启
sudo systemctl enable classroom-points

# 查看状态
sudo systemctl status classroom-points

# 查看日志
sudo journalctl -u classroom-points -f
```

## 网络配置

### 防火墙设置

#### Ubuntu/Debian
```bash
# 允许端口 3000
sudo ufw allow 3000/tcp

# 查看状态
sudo ufw status
```

#### CentOS/RHEL
```bash
# 允许端口 3000
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# 查看状态
sudo firewall-cmd --list-ports
```

### 反向代理（可选）

#### 使用 Nginx
```bash
# 安装 Nginx
sudo apt update
sudo apt install nginx

# 创建配置文件
sudo cat > /etc/nginx/sites-available/classroom-points << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # 替换为实际域名

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # SSE 支持
    location /api/sse/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_cache off;
    }
}
EOF

# 启用站点
sudo ln -s /etc/nginx/sites-available/classroom-points /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 数据备份

### 自动备份配置
系统已内置自动备份功能，在 `config/config.json` 中配置：

```json
{
  "database": {
    "autoBackup": {
      "enabled": true,
      "interval": "24h",
      "retention": "30d"
    }
  }
}
```

### 手动备份
```bash
# 创建完整备份
npm run backup

# 或者通过 API
curl -X POST http://localhost:3000/api/backup/create \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN"
```

### 备份恢复
```bash
# 停止服务
pm2 stop classroom-points-system

# 恢复数据文件
cd backups
unzip backup-YYYY-MM-DD-HH-mm-ss.zip
cp -r backup-data/* ../data/

# 重启服务
pm2 start classroom-points-system
```

## 监控和维护

### 健康检查
```bash
# 检查服务状态
curl http://localhost:3000/api/health

# 预期响应
{
  "success": true,
  "status": "HEALTHY",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 日志监控
```bash
# 查看应用日志
tail -f logs/app.log

# 查看 PM2 日志
pm2 logs classroom-points-system

# 查看系统日志
sudo journalctl -u classroom-points -f
```

### 性能监控
```bash
# 查看 PM2 监控
pm2 monit

# 查看系统资源
htop
df -h
free -h
```

## 故障排除

### 常见问题

#### 1. 端口被占用
```bash
# 查看端口占用
sudo netstat -tlnp | grep :3000
sudo lsof -i :3000

# 杀死占用进程
sudo kill -9 PID
```

#### 2. 权限问题
```bash
# 修复文件权限
sudo chown -R classroom-points:classroom-points /opt/classroom-points-system
sudo chmod -R 755 /opt/classroom-points-system
sudo chmod -R 644 /opt/classroom-points-system/data/*
```

#### 3. 内存不足
```bash
# 查看内存使用
free -h

# 清理系统缓存
sudo sync
sudo echo 3 > /proc/sys/vm/drop_caches
```

#### 4. 数据文件损坏
```bash
# 停止服务
pm2 stop classroom-points-system

# 从备份恢复
cd backups
ls -la  # 找到最新备份
unzip backup-YYYY-MM-DD-HH-mm-ss.zip
cp -r backup-data/* ../data/

# 重启服务
pm2 start classroom-points-system
```

### 日志分析
```bash
# 查看错误日志
grep -i error logs/app.log

# 查看最近的访问日志
tail -100 logs/app.log | grep -E "(POST|PUT|DELETE)"

# 统计访问频率
grep "$(date +%Y-%m-%d)" logs/app.log | wc -l
```

## 安全建议

### 1. 系统安全
- 定期更新操作系统和 Node.js
- 使用防火墙限制不必要的端口访问
- 定期更改默认密码和密钥

### 2. 应用安全
- 修改默认的 JWT 密钥
- 启用 HTTPS（使用 SSL 证书）
- 定期备份数据
- 监控异常访问

### 3. 网络安全
- 使用反向代理隐藏应用端口
- 配置适当的 CORS 策略
- 启用访问日志记录

## 更新升级

### 应用更新
```bash
# 停止服务
pm2 stop classroom-points-system

# 备份当前版本
cp -r /opt/classroom-points-system /opt/classroom-points-system-backup

# 更新代码
# （解压新版本文件）

# 更新依赖
npm install --production

# 重启服务
pm2 start classroom-points-system

# 验证更新
curl http://localhost:3000/api/health
```

### 数据迁移
如果新版本需要数据迁移，请参考具体版本的迁移文档。

## 联系支持

如果遇到部署问题，请：
1. 检查日志文件中的错误信息
2. 确认系统要求是否满足
3. 参考故障排除部分
4. 联系技术支持并提供详细的错误日志