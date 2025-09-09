# 班级积分系统 V1

一个简洁高效的单班级积分管理工具，支持本地部署和云端部署两种方式。

## 🚀 快速开始

### 本地部署
```bash
# 安装依赖
npm install

# 启动服务
npm start

# 访问系统
# 教室大屏: http://localhost:3000/display
# 管理后台: http://localhost:3000/admin
```

### Cloudflare部署
```bash
# 安装Wrangler CLI
npm install -g wrangler
wrangler login

# 创建D1数据库
npm run cf:d1:create

# 初始化数据库
npm run cf:d1:init

# 部署应用
npm run deploy:cf
```

## 📋 功能特性

### 🎯 核心功能
- **双模式大屏**: 平时模式显示排行榜，上课模式支持快速积分操作
- **积分管理**: 支持加分、减分、积分清零，允许负数积分
- **学生查询**: 学生可通过学号查询个人积分和排名
- **商品预约**: 简化的商品兑换预约系统
- **奖惩项**: 预设常用奖惩项，支持一键操作

### 🔧 技术特性
- **双部署支持**: 本地SQLite + 云端Cloudflare D1
- **实时同步**: 数据变更实时更新到大屏
- **自动切换**: 上课模式2小时后自动切换回平时模式
- **数据安全**: 完整的备份和恢复机制

## 🏗️ 系统架构

```
┌─────────────────┬─────────────────┐
│   本地部署      │   Cloudflare部署 │
├─────────────────┼─────────────────┤
│ Node.js + Express│ Cloudflare Workers│
│ SQLite 数据库    │ D1 数据库        │
│ 静态文件服务     │ Cloudflare Pages │
│ 本地存储        │ 全球CDN         │
└─────────────────┴─────────────────┘
```

## 📱 界面说明

### 教室大屏 (`/display`)
- **平时模式**: 显示积分排行榜，底部提供学生查询入口
- **上课模式**: 显示学生列表和奖惩项按钮，支持快速积分操作

### 管理后台 (`/admin`)
- **学生管理**: 添加、编辑、删除学生信息
- **积分管理**: 查看积分记录，手动调整积分，积分清零
- **商品管理**: 管理奖品商品，设置价格和库存
- **预约管理**: 处理学生预约，确认兑换
- **奖惩项管理**: 设置常用奖惩项供大屏使用

## 🔐 权限说明

- **班主任**: 拥有所有功能权限
- **任课老师**: 只能操作积分相关功能
- **学生**: 只能查询个人积分信息

## 📊 数据存储

### SQLite (本地部署)
- 数据库文件: `./data/classroom_points.db`
- 自动备份: 每日凌晨2点
- 支持WAL模式，提高并发性能

### Cloudflare D1 (云端部署)
- 全球分布式数据库
- 自动备份和恢复
- 零运维成本

## 🔄 数据迁移

### 从现有JSON文件迁移
```bash
npm run migrate:json-to-sqlite
```

### SQLite与D1互相迁移
```bash
# SQLite导出
sqlite3 ./data/classroom_points.db .dump > export.sql

# D1导入
wrangler d1 execute classroom-points-v1 --file=export.sql

# D1导出
wrangler d1 export classroom-points-v1 --output=export.sql

# SQLite导入
sqlite3 ./data/classroom_points.db < export.sql
```

## 🛠️ 开发指南

### 项目结构
```
├── adapters/           # 数据库适配器
├── api/               # API路由
├── services/          # 业务逻辑服务
├── middleware/        # 中间件
├── public/            # 静态文件
├── sql/               # 数据库脚本
├── src/               # Cloudflare Workers源码
└── scripts/           # 工具脚本
```

### 添加新功能
1. 在 `adapters/` 中定义数据访问接口
2. 在 `services/` 中实现业务逻辑
3. 在 `api/` 中添加API路由
4. 在 `public/` 中更新前端界面

### 运行测试
```bash
npm test
```

## 📈 性能优化

### 本地部署优化
- SQLite WAL模式（默认启用）
- 定期清理历史数据
- 合理的索引设计

### Cloudflare部署优化
- 全球CDN加速
- 边缘计算优势
- 自动扩展能力

## 🔍 故障排除

### 常见问题
1. **数据库连接失败**: 检查文件权限和路径
2. **端口占用**: 修改配置文件中的端口设置
3. **静态文件404**: 检查public目录和路由配置

### 日志查看
```bash
# 本地部署
tail -f logs/combined.log

# Cloudflare部署
wrangler tail
```

## 📞 技术支持

- 查看 [部署指南](docs/deployment-v1.md)
- 查看 [API文档](docs/api.md)
- 提交 [Issue](https://github.com/your-repo/issues)

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

**班级积分系统 V1** - 让积分管理更简单高效 🎓