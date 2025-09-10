# 班级积分系统 Cloudflare 部署指南

## 概述

班级积分系统 支持部署到 Cloudflare 平台，利用 Cloudflare Workers、D1 数据库、Pages 和 KV 存储等服务，提供高性能、全球分布的云端解决方案。

## 架构说明

### Cloudflare 服务组件
- **Cloudflare Workers**: 后端 API 和业务逻辑
- **Cloudflare D1**: SQLite 兼容的无服务器数据库
- **Cloudflare Pages**: 静态文件托管
- **Cloudflare KV**: 会话存储和缓存
- **Cloudflare R2**: 文件上传存储（可选）

### 部署架构
```
用户请求 → Cloudflare CDN → Workers → D1 数据库
                              ↓
                         Pages (静态文件)
                              ↓
                         KV (会话/缓存)
```

## 前置要求

### 账户和工具
1. **Cloudflare 账户**: 免费或付费账户
2. **Wrangler CLI**: Cloudflare 官方命令行工具
3. **Node.js**: 18.0.0 或更高版本
4. **Git**: 版本控制工具

### 安装 Wrangler CLI
```bash
# 全局安装 Wrangler
npm install -g wrangler

# 验证安装
wrangler --version

# 登录 Cloudflare 账户
wrangler login
```

## 部署步骤

### 第一步：准备项目

```bash
# 克隆项目
git clone <repository-url>
cd classroom-points-system

# 安装依赖
npm install

# 构建项目
npm run build:worker
```

### 第二步：配置 Cloudflare 服务

#### 1. 创建 D1 数据库

```bash
# 创建 D1 数据库
wrangler d1 create classroom-points

# 记录返回的数据库 ID，例如：
# database_id = "12345678-1234-1234-1234-123456789abc"
```

#### 2. 创建 KV 命名空间

```bash
# 创建生产环境 KV 命名空间
wrangler kv:namespace create "SESSIONS"

# 创建预览环境 KV 命名空间
wrangler kv:namespace create "SESSIONS" --preview

# 记录返回的命名空间 ID
```

#### 3. 创建 R2 存储桶（可选）

```bash
# 创建 R2 存储桶用于文件上传
wrangler r2 bucket create classroom-points-uploads
```

### 第三步：配置 wrangler.toml

编辑 `wrangler.toml` 文件，填入实际的 ID：

```toml
name = "classroom-points-system"
main = "src/worker.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# D1 数据库配置
[[d1_databases]]
binding = "DB"
database_name = "classroom-points"
database_id = "your-actual-database-id-here"

# KV 存储配置
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-actual-kv-id-here"
preview_id = "your-actual-preview-kv-id-here"

# 环境变量
[vars]
DEPLOYMENT = "cloudflare"
NODE_ENV = "production"
DB_TYPE = "d1"

# 可选：R2 存储配置
[[r2_buckets]]
binding = "UPLOADS"
bucket_name = "classroom-points-uploads"

# 定时任务配置
[triggers]
crons = ["0 2 * * *"]  # 每天凌晨2点执行维护任务
```

### 第四步：初始化数据库

```bash
# 使用脚本初始化数据库
node scripts/init-d1-database.js

# 或手动执行 SQL
wrangler d1 execute classroom-points --file=sql/init.sql

# 验证数据库结构
wrangler d1 execute classroom-points --command="SELECT name FROM sqlite_master WHERE type='table'"
```

### 第五步：部署 Workers

```bash
# 部署到生产环境
wrangler deploy

# 或部署到预览环境
wrangler deploy --env staging
```

### 第六步：部署静态文件到 Pages

#### 方法一：通过 Git 集成（推荐）

1. 将代码推送到 GitHub/GitLab
2. 在 Cloudflare Dashboard 中创建 Pages 项目
3. 连接 Git 仓库
4. 设置构建配置：
   - 构建命令: `npm run build:static`
   - 输出目录: `dist`
   - 环境变量: `NODE_VERSION=18`

#### 方法二：直接上传

```bash
# 构建静态文件
npm run build:static

# 部署到 Pages
wrangler pages deploy dist --project-name=classroom-points-system
```

### 第七步：配置自定义域名（可选）

```bash
# 添加自定义域名到 Workers
wrangler route add "classroom.your-domain.com/*" classroom-points-system

# 或在 wrangler.toml 中配置
[env.production]
route = { pattern = "classroom.your-domain.com/*", zone_name = "your-domain.com" }
```

## 配置说明

### 环境变量配置

在 Cloudflare Dashboard 或 wrangler.toml 中设置：

```toml
[vars]
# 基础配置
DEPLOYMENT = "cloudflare"
NODE_ENV = "production"
DB_TYPE = "d1"

# 功能开关
ENABLE_ANALYTICS = "true"
ENABLE_CACHING = "true"
ENABLE_RATE_LIMITING = "true"

# 安全配置
SESSION_SECRET = "your-strong-secret-here"
CORS_ORIGIN = "https://your-domain.com"

# 可选：第三方服务
# SENTRY_DSN = "your-sentry-dsn"
# ANALYTICS_ID = "your-analytics-id"
```

### 数据库配置

D1 数据库配置示例：

```toml
[[d1_databases]]
binding = "DB"
database_name = "classroom-points"
database_id = "your-database-id"
migrations_dir = "sql/migrations"

# 多环境配置
[env.staging]
[[env.staging.d1_databases]]
binding = "DB"
database_name = "classroom-points-staging"
database_id = "your-staging-database-id"
```

### KV 存储配置

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

# 多个 KV 命名空间
[[kv_namespaces]]
binding = "CACHE"
id = "your-cache-kv-namespace-id"
```

## 数据管理

### 数据库操作

```bash
# 查看数据库列表
wrangler d1 list

# 执行 SQL 查询
wrangler d1 execute classroom-points --command="SELECT COUNT(*) FROM users"

# 执行 SQL 文件
wrangler d1 execute classroom-points --file=sql/query.sql

# 导出数据
wrangler d1 export classroom-points --output=backup.sql
```

### KV 存储操作

```bash
# 查看 KV 命名空间
wrangler kv:namespace list

# 查看 KV 键值
wrangler kv:key list --binding=SESSIONS

# 获取 KV 值
wrangler kv:key get "session:12345" --binding=SESSIONS

# 设置 KV 值
wrangler kv:key put "test:key" "test value" --binding=SESSIONS

# 删除 KV 键
wrangler kv:key delete "test:key" --binding=SESSIONS
```

### 数据备份

```bash
# 创建数据库备份
wrangler d1 export classroom-points --output=backup-$(date +%Y%m%d).sql

# 恢复数据库（需要先清空）
wrangler d1 execute classroom-points --file=backup-20241201.sql
```

## 监控和日志

### 查看日志

```bash
# 实时查看 Workers 日志
wrangler tail

# 查看特定时间段的日志
wrangler tail --since="2024-01-01T00:00:00Z"

# 过滤日志
wrangler tail --grep="ERROR"
```

### 性能监控

1. **Cloudflare Analytics**: 在 Dashboard 中查看请求统计
2. **Workers Analytics**: 查看 Workers 执行统计
3. **D1 Analytics**: 查看数据库查询统计

### 设置告警

在 Cloudflare Dashboard 中设置：
- 错误率告警
- 响应时间告警
- 数据库连接告警

## 故障排除

### 常见问题

#### 1. Workers 部署失败

```bash
# 检查配置文件语法
wrangler validate

# 查看详细错误信息
wrangler deploy --verbose

# 检查兼容性
wrangler compatibility-date --help
```

#### 2. D1 数据库连接问题

```bash
# 测试数据库连接
wrangler d1 execute classroom-points --command="SELECT 1"

# 检查数据库绑定
wrangler d1 list

# 验证数据库 ID
grep -n "database_id" wrangler.toml
```

#### 3. KV 存储问题

```bash
# 检查 KV 命名空间
wrangler kv:namespace list

# 测试 KV 读写
wrangler kv:key put "test" "value" --binding=SESSIONS
wrangler kv:key get "test" --binding=SESSIONS
```

#### 4. 静态文件访问问题

- 检查 Pages 部署状态
- 验证构建输出目录
- 确认文件路径正确

### 调试技巧

#### 1. 本地开发

```bash
# 启动本地开发服务器
wrangler dev

# 使用本地数据库
wrangler dev --local

# 指定端口
wrangler dev --port 8787
```

#### 2. 远程调试

```bash
# 查看 Workers 指标
wrangler metrics

# 查看 D1 指标
wrangler d1 metrics classroom-points

# 查看详细日志
wrangler tail --format=pretty
```

#### 3. 性能分析

```bash
# 分析 Workers 性能
wrangler analytics

# 查看请求分布
wrangler analytics --since="1h"
```

## 安全配置

### 访问控制

```javascript
// 在 Workers 中实现 IP 白名单
const ALLOWED_IPS = ['192.168.1.0/24', '10.0.0.0/8'];

function isAllowedIP(request) {
  const clientIP = request.headers.get('CF-Connecting-IP');
  // 实现 IP 检查逻辑
  return true; // 或 false
}
```

### CORS 配置

```javascript
// 配置 CORS 策略
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};
```

### 速率限制

```javascript
// 使用 KV 实现速率限制
async function rateLimit(request, env) {
  const clientIP = request.headers.get('CF-Connecting-IP');
  const key = `rate_limit:${clientIP}`;
  
  const current = await env.SESSIONS.get(key);
  if (current && parseInt(current) > 100) {
    return new Response('Too Many Requests', { status: 429 });
  }
  
  await env.SESSIONS.put(key, (parseInt(current) || 0) + 1, { expirationTtl: 3600 });
  return null;
}
```

## 成本优化

### 免费额度

Cloudflare 免费计划包括：
- Workers: 100,000 请求/天
- D1: 5GB 存储，25M 行读取/天
- KV: 100,000 读取/天，1,000 写入/天
- Pages: 无限静态请求

### 付费计划

根据使用量选择合适的付费计划：
- **Workers Paid**: $5/月 + 使用量计费
- **D1**: 按存储和查询量计费
- **KV**: 按操作次数计费

### 优化建议

1. **缓存策略**: 合理使用 KV 缓存减少 D1 查询
2. **请求合并**: 批量处理数据库操作
3. **静态资源**: 利用 CDN 缓存静态文件
4. **定时任务**: 合理设置 cron 任务频率

## 升级和维护

### 版本升级

```bash
# 更新 Wrangler CLI
npm update -g wrangler

# 更新项目依赖
npm update

# 重新部署
wrangler deploy
```

### 数据库迁移

```bash
# 创建迁移文件
mkdir -p sql/migrations
echo "ALTER TABLE users ADD COLUMN new_field TEXT;" > sql/migrations/001_add_new_field.sql

# 执行迁移
wrangler d1 execute classroom-points --file=sql/migrations/001_add_new_field.sql
```

### 回滚策略

```bash
# 回滚到上一个版本
wrangler rollback

# 查看部署历史
wrangler deployments list

# 回滚到特定版本
wrangler rollback --version-id=<version-id>
```

## 最佳实践

### 开发流程

1. **本地开发**: 使用 `wrangler dev` 进行本地测试
2. **预览环境**: 部署到 staging 环境测试
3. **生产部署**: 确认无误后部署到生产环境
4. **监控告警**: 设置监控和告警机制

### 代码组织

```
src/
├── worker.js          # Workers 入口文件
├── handlers/          # 请求处理器
├── api/              # API 路由
├── utils/            # 工具函数
├── adapters/         # 数据库适配器
└── middleware/       # 中间件
```

### 配置管理

- 使用环境变量管理配置
- 敏感信息使用 Secrets 存储
- 不同环境使用不同配置

### 错误处理

```javascript
// 统一错误处理
export function handleError(error, request) {
  console.error('Error:', error);
  
  return new Response(JSON.stringify({
    success: false,
    message: '服务暂时不可用',
    requestId: crypto.randomUUID()
  }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 支持和资源

### 官方文档
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 数据库文档](https://developers.cloudflare.com/d1/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

### 社区资源
- [Cloudflare Discord](https://discord.gg/cloudflaredev)
- [Workers Examples](https://github.com/cloudflare/workers-examples)
- [D1 Examples](https://github.com/cloudflare/d1-examples)

### 技术支持
- Cloudflare Dashboard 支持中心
- 社区论坛
- 企业客户技术支持

---

**注意**: 本文档基于 Cloudflare 平台的最新功能编写，部分功能可能需要付费计划。请根据实际需求选择合适的服务计划。