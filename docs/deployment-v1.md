# 班级积分系统 V1 部署指南

## 概述

班级积分系统 V1 支持两种部署方式：
1. **本地部署** - 使用 Node.js + SQLite，适合学校内网环境
2. **Cloudflare部署** - 使用 Cloudflare Pages + Workers + D1，适合云端访问

## 本地部署

### 环境要求
- Node.js 18.0 或更高版本
- npm 或 yarn 包管理器
- 至少 100MB 可用磁盘空间

### 部署步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **初始化数据库**
   ```bash
   # SQLite数据库会在首次启动时自动创建
   # 数据库文件位置：./data/classroom_points.db
   ```

3. **启动服务**
   ```bash
   npm start
   ```

4. **访问系统**
   - 教室大屏：http://localhost:3000/display
   - 管理后台：http://localhost:3000/admin
   - 默认管理员：用户名 `admin`，密码需要在首次访问时设置

### 配置选项

在 `config/local.json` 中可以配置：
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "database": {
    "type": "sqlite",
    "path": "./data/classroom_points.db"
  },
  "features": {
    "autoBackup": true,
    "backupInterval": "0 2 * * *"
  }
}
```

### 数据备份

```bash
# 手动备份
npm run backup

# 备份文件位置
./backups/classroom_points_YYYYMMDD_HHMMSS.db
```

## Cloudflare部署

### 环境要求
- Cloudflare账号
- Wrangler CLI工具
- Node.js 18.0 或更高版本

### 部署步骤

1. **安装Wrangler CLI**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **创建D1数据库**
   ```bash
   # 创建数据库
   wrangler d1 create classroom-points-v1
   
   # 记录返回的database_id，更新wrangler.toml文件
   ```

3. **更新配置文件**
   编辑 `wrangler.toml`，填入database_id：
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "classroom-points-v1"
   database_id = "your-database-id-here"
   ```

4. **初始化数据库表**
   ```bash
   wrangler d1 execute classroom-points-v1 --file=sql/init.sql
   ```

5. **部署应用**
   ```bash
   # 构建并部署
   npm run deploy:cf
   
   # 或分别部署
   npm run deploy:cf:pages    # 部署静态文件到Pages
   npm run deploy:cf:workers  # 部署API到Workers
   ```

6. **访问系统**
   - 系统会部署到 `https://classroom-points-system-v1.your-subdomain.workers.dev`
   - 或配置自定义域名

### 自定义域名配置

1. 在Cloudflare Dashboard中添加域名
2. 配置DNS记录指向Workers
3. 更新 `wrangler.toml` 中的路由配置

### 环境变量配置

在Cloudflare Dashboard中设置：
- `NODE_ENV`: production
- `DEPLOYMENT`: cloudflare

## 数据迁移

### 从JSON文件迁移到SQLite

```bash
# 使用内置迁移工具
node scripts/migrate-json-to-sqlite.js
```

### 从SQLite迁移到D1

```bash
# 导出SQLite数据
sqlite3 ./data/classroom_points.db .dump > export.sql

# 导入到D1
wrangler d1 execute classroom-points-v1 --file=export.sql
```

### 从D1导出到SQLite

```bash
# 导出D1数据
wrangler d1 export classroom-points-v1 --output=export.sql

# 导入到SQLite
sqlite3 ./data/classroom_points.db < export.sql
```

## 性能优化

### 本地部署优化
- 启用SQLite WAL模式（默认启用）
- 定期清理旧的积分记录
- 配置适当的备份策略

### Cloudflare部署优化
- 利用D1的全球分布特性
- 配置适当的缓存策略
- 监控Workers的执行时间

## 故障排除

### 常见问题

1. **SQLite数据库锁定**
   ```bash
   # 检查是否有其他进程占用数据库
   lsof ./data/classroom_points.db
   ```

2. **D1数据库连接失败**
   - 检查wrangler.toml配置
   - 确认数据库ID正确
   - 检查Workers绑定设置

3. **静态文件访问失败**
   - 检查Pages部署状态
   - 确认路由配置正确

### 日志查看

**本地部署：**
```bash
# 查看应用日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log
```

**Cloudflare部署：**
```bash
# 查看Workers日志
wrangler tail

# 查看实时日志
wrangler tail --format=pretty
```

## 安全建议

1. **本地部署安全**
   - 配置防火墙规则
   - 使用HTTPS（配置SSL证书）
   - 定期更新系统和依赖

2. **Cloudflare部署安全**
   - 启用Cloudflare安全功能
   - 配置访问规则
   - 监控异常访问

## 监控和维护

### 健康检查
- 本地：http://localhost:3000/api/health
- Cloudflare：https://your-domain.com/api/health

### 定期维护任务
- 数据库备份（本地部署）
- 清理过期数据
- 更新系统依赖
- 监控存储使用情况

## 技术支持

如遇到部署问题，请检查：
1. 系统日志文件
2. 数据库连接状态
3. 网络配置
4. 依赖包版本兼容性

更多技术细节请参考：
- [设计文档](./design.md)
- [需求文档](./requirements.md)
- [API文档](./api.md)