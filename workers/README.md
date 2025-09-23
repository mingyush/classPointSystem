# 班级积分管理系统 - Cloudflare Workers 后端

基于 Cloudflare Workers + D1 数据库的班级积分管理系统后端实现。

## 🚀 特性

- **无服务器架构**: 基于 Cloudflare Workers，全球边缘计算
- **高性能数据库**: 使用 Cloudflare D1 SQLite 数据库
- **智能缓存**: 集成 KV 存储的多层缓存策略
- **API 兼容**: 与现有前端完全兼容的 RESTful API
- **实时监控**: 内置性能监控和日志记录
- **安全认证**: JWT 令牌认证和角色权限控制

## 📁 项目结构

```
workers/
├── src/
│   ├── api/                 # API 路由
│   │   ├── auth.js         # 认证相关 API
│   │   ├── students.js     # 学生管理 API
│   │   ├── points.js       # 积分管理 API
│   │   ├── products.js     # 商品管理 API
│   │   ├── orders.js       # 订单管理 API
│   │   └── config.js       # 系统配置 API
│   ├── cache/              # 缓存管理
│   │   └── cache-manager.js
│   ├── middleware/         # 中间件
│   │   ├── auth.js         # 认证中间件
│   │   ├── cors.js         # CORS 中间件
│   │   └── performance.js  # 性能优化中间件
│   ├── services/           # 业务逻辑服务
│   │   ├── authService.js
│   │   ├── studentService.js
│   │   ├── pointsService.js
│   │   ├── productService.js
│   │   ├── orderService.js
│   │   └── configService.js
│   ├── utils/              # 工具函数
│   │   ├── response.js     # 响应格式化
│   │   ├── validation.js   # 数据验证
│   │   └── crypto.js       # 加密工具
│   └── index.js            # 主入口文件
├── migrations/             # 数据库迁移文件
├── scripts/                # 部署和迁移脚本
│   ├── deploy.js          # 自动化部署脚本
│   └── migrate-data.js    # 数据迁移脚本
├── tests/                  # 测试文件
├── wrangler.toml          # Cloudflare Workers 配置
└── package.json
```

## 🛠️ 快速开始

### 1. 环境准备

```bash
# 安装依赖
npm install

# 安装 Wrangler CLI (如果未安装)
npm install -g wrangler

# 登录 Cloudflare
wrangler login
```

### 2. 数据库设置

```bash
# 创建 D1 数据库
npm run db:create
npm run db:create:prod

# 应用数据库迁移
npm run deploy:migrations
```

### 3. 本地开发

```bash
# 启动开发服务器
npm run dev

# 在另一个终端运行测试
npm test
```

### 4. 部署

```bash
# 部署到开发环境
npm run deploy:dev

# 部署到生产环境
npm run deploy:prod
```

## 📊 API 文档

### 认证 API

- `POST /api/auth/login/teacher` - 教师登录
- `POST /api/auth/login/student` - 学生登录
- `POST /api/auth/verify` - 验证令牌
- `GET /api/auth/user` - 获取用户信息

### 学生管理 API

- `GET /api/students` - 获取学生列表
- `GET /api/students/:id` - 获取单个学生信息
- `GET /api/students/stats` - 获取学生统计

### 积分管理 API

- `GET /api/points` - 获取积分记录
- `POST /api/points` - 添加积分记录
- `GET /api/points/student/:id` - 获取学生积分历史
- `GET /api/points/leaderboard` - 获取积分排行榜

### 商品管理 API

- `GET /api/products` - 获取商品列表
- `GET /api/products/:id` - 获取单个商品
- `POST /api/products` - 创建商品 (教师)
- `PUT /api/products/:id` - 更新商品 (教师)

### 订单管理 API

- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取单个订单
- `POST /api/orders` - 创建订单 (学生兑换)
- `PUT /api/orders/:id` - 更新订单状态 (教师)

### 系统配置 API

- `GET /api/config` - 获取系统配置
- `PUT /api/config` - 更新系统配置 (教师)

## 🔧 配置说明

### wrangler.toml

主要配置项：

```toml
name = "class-point-system"
main = "src/index.js"
compatibility_date = "2024-01-01"

# D1 数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "class-point-system-dev"
database_id = "your-database-id"

# KV 存储绑定
[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-namespace-id"

[[kv_namespaces]]
binding = "SESSIONS"
id = "your-sessions-namespace-id"
```

### 环境变量

在 Cloudflare Workers 控制台设置：

- `JWT_SECRET` - JWT 签名密钥
- `ADMIN_PASSWORD` - 管理员密码
- `CORS_ORIGIN` - 允许的跨域来源

## 🚀 部署指南

### 自动化部署

使用内置的部署脚本：

```bash
# 开发环境部署
npm run deploy:dev

# 生产环境部署
npm run deploy:prod
```

部署脚本会自动：
1. 检查环境和依赖
2. 运行测试 (生产环境)
3. 应用数据库迁移
4. 部署 Workers
5. 验证部署状态

### 手动部署

```bash
# 部署到开发环境
wrangler deploy --env development

# 部署到生产环境
wrangler deploy --env production

# 应用数据库迁移
wrangler d1 migrations apply class-point-system-dev
```

## 📈 性能优化

### 缓存策略

- **学生数据**: 5分钟缓存
- **积分记录**: 2分钟缓存
- **商品信息**: 10分钟缓存
- **排行榜**: 1分钟缓存
- **系统配置**: 30分钟缓存

### 边缘计算优化

- 响应压缩 (gzip/brotli)
- 条件请求支持 (ETag/Last-Modified)
- 智能缓存失效
- 批量请求优化

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行 API 兼容性测试
npm run test:api

# 监听模式运行测试
npm run test:watch

# 生成测试覆盖率报告
npm run test:coverage
```

## 📊 监控和日志

### 查看实时日志

```bash
# 开发环境日志
npm run logs

# 生产环境日志
npm run logs:prod
```

### 性能监控

系统内置性能监控，包括：
- API 响应时间
- 数据库查询性能
- 缓存命中率
- 错误率统计

## 🔄 数据迁移

### 从现有系统迁移

```bash
# 从 JSON 文件迁移
npm run migrate:data -- --source ./data/backup.json --type json

# 应用生成的迁移文件
npm run deploy:migrations
```

### 创建新迁移

```bash
# 创建新的迁移文件
npm run db:migrations:create -- "migration_name"

# 查看迁移历史
npm run db:migrations:list
```

## 🛡️ 安全特性

- JWT 令牌认证
- 角色权限控制 (教师/学生)
- CORS 跨域保护
- SQL 注入防护
- 请求频率限制
- 数据验证和清理

## 🔧 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查数据库配置
   wrangler d1 list
   ```

2. **缓存问题**
   ```bash
   # 清理 KV 缓存
   wrangler kv:key delete --binding CACHE "cache_key"
   ```

3. **部署失败**
   ```bash
   # 检查认证状态
   wrangler whoami
   
   # 重新登录
   wrangler login
   ```

### 调试模式

```bash
# 启用详细日志
wrangler dev --log-level debug

# 本地数据库调试
wrangler d1 execute class-point-system-dev --local --command "SELECT * FROM students LIMIT 5"
```

## 📝 开发指南

### 添加新 API

1. 在 `src/api/` 创建路由文件
2. 在 `src/services/` 添加业务逻辑
3. 更新 `src/index.js` 注册路由
4. 添加相应测试

### 数据库变更

1. 创建迁移文件
2. 更新服务层代码
3. 运行测试验证
4. 部署迁移

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 运行测试
5. 创建 Pull Request

## 📄 许可证

MIT License

## 🆘 支持

如有问题，请：
1. 查看文档和 FAQ
2. 检查 GitHub Issues
3. 联系开发团队

---

**注意**: 这是一个教育项目，请根据实际需求调整配置和安全设置。