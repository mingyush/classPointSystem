# 班级积分管理系统运行指南

## 系统概述

班级积分管理系统是一个基于 Web 的积分管理工具，主要用于中学班级的积分管理和奖励兑换。系统包含三个主要界面：

- **大屏展示** (`/display`) - 教室投影显示学生积分排行榜
- **教师管理** (`/teacher`) - 教师管理积分和系统设置
- **学生查询** (`/student`) - 学生查看个人积分和预约奖品

## 快速启动

### 开发环境启动
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 或者
npm start
```

### 生产环境启动
```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js

# 或使用 systemd
sudo systemctl start classroom-points

# 或直接启动
NODE_ENV=production npm start
```

### 验证启动
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

## 系统访问

### 访问地址
- **主页**: http://localhost:3000
- **大屏展示**: http://localhost:3000/display
- **教师管理**: http://localhost:3000/teacher
- **学生查询**: http://localhost:3000/student

### 默认账户
- **管理账户**: admin / admin123
- **教师账户**: 8001 / 123
- **学生账户**: 使用学生学号登录（无需密码）

## 日常操作

### 1. 教师操作流程

#### 登录系统
1. 访问 `/teacher` 页面
2. 输入教师账号和密码
3. 点击登录

#### 学生管理
```bash
# 添加学生
POST /api/students
{
  "id": "STU001",
  "name": "张三",
  "class": "高一(1)班"
}

# 查看学生列表
GET /api/students

# 删除学生
DELETE /api/students/STU001
```

#### 积分管理
```bash
# 给学生加分
POST /api/points/add
{
  "studentId": "STU001",
  "points": 10,
  "reason": "课堂表现优秀"
}

# 给学生减分
POST /api/points/subtract
{
  "studentId": "STU001",
  "points": 5,
  "reason": "迟到"
}

# 查看积分历史
GET /api/points/history/STU001
```

#### 商品管理
```bash
# 添加奖品
POST /api/products
{
  "name": "笔记本",
  "price": 50,
  "stock": 10,
  "description": "精美笔记本"
}

# 更新商品
PUT /api/products/PRODUCT_ID
{
  "name": "更新后的商品名",
  "price": 60,
  "stock": 8
}

# 删除商品
DELETE /api/products/PRODUCT_ID
```

#### 订单管理
```bash
# 查看待确认订单
GET /api/orders/pending

# 确认订单
POST /api/orders/ORDER_ID/confirm

# 取消订单
POST /api/orders/ORDER_ID/cancel
```

#### 系统设置
```bash
# 切换系统模式
POST /api/config/mode
{
  "mode": "class"  # 或 "normal"
}

# 查看系统模式
GET /api/config/mode
```

### 2. 学生操作流程

#### 登录系统
1. 访问 `/student` 页面
2. 输入学号
3. 点击登录

#### 查看个人信息
```bash
# 查看个人积分和排名
GET /api/students/STU001

# 查看积分历史
GET /api/points/history/STU001
```

#### 商品预约
```bash
# 查看商品列表
GET /api/products

# 预约商品
POST /api/orders/reserve
{
  "productId": "PRODUCT_ID"
}

# 取消预约
POST /api/orders/ORDER_ID/cancel
```

### 3. 大屏展示操作

大屏展示页面会自动刷新，显示实时的积分排行榜：
- 总积分排行榜
- 今日积分排行榜
- 本周积分排行榜

## 系统维护

### 数据备份

#### 自动备份
系统会根据配置自动创建备份：
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

#### 手动备份
```bash
# 通过 npm 脚本
npm run backup

# 通过 API
curl -X POST http://localhost:3000/api/backup/create \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN"

# 查看备份列表
curl http://localhost:3000/api/backup/list \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN"
```

### 日志管理

#### 查看日志
```bash
# 应用日志
tail -f logs/app.log

# PM2 日志
pm2 logs classroom-points-system

# 系统日志
sudo journalctl -u classroom-points -f
```

#### 日志轮转
系统会自动管理日志文件大小和保留时间：
```json
{
  "logging": {
    "file": {
      "maxSize": "10m",
      "maxFiles": "7d"
    }
  }
}
```

### 性能监控

#### 系统健康检查
```bash
# 健康检查
curl http://localhost:3000/api/health

# 详细统计（开发环境）
curl http://localhost:3000/api/debug/errors?hours=24
```

#### 资源监控
```bash
# PM2 监控
pm2 monit

# 系统资源
htop
df -h
free -h
```

## 配置管理

### 环境配置

#### 开发环境 (development.json)
```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "logging": {
    "level": "debug",
    "console": {
      "enabled": true
    }
  }
}
```

#### 生产环境 (production.json)
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "logging": {
    "level": "info",
    "console": {
      "enabled": false
    }
  }
}
```

### 安全配置

#### JWT 密钥配置
```json
{
  "security": {
    "jwtSecret": "your-secret-key-here",
    "jwtExpiresIn": "24h"
  }
}
```

#### CORS 配置
```json
{
  "security": {
    "cors": {
      "enabled": true,
      "origin": ["http://localhost:3000"],
      "credentials": true
    }
  }
}
```

## 故障处理

### 常见问题

#### 1. 服务无法启动
```bash
# 检查端口占用
sudo netstat -tlnp | grep :3000

# 检查日志
tail -f logs/app.log

# 检查配置文件
node -c server.js
```

#### 2. 数据丢失
```bash
# 从备份恢复
cd backups
ls -la  # 找到最新备份
unzip backup-YYYY-MM-DD-HH-mm-ss.zip
cp -r backup-data/* ../data/
```

#### 3. 内存泄漏
```bash
# 重启服务
pm2 restart classroom-points-system

# 查看内存使用
pm2 monit
```

#### 4. 数据不一致
```bash
# 运行数据一致性检查
npm run test:consistency

# 重新初始化数据（谨慎使用）
npm run init:force
```

### 错误代码说明

| 错误代码 | 说明 | 解决方案 |
|---------|------|----------|
| TOKEN_MISSING | 缺少认证令牌 | 重新登录获取令牌 |
| TOKEN_INVALID | 令牌无效 | 重新登录 |
| STUDENT_NOT_FOUND | 学生不存在 | 检查学生ID |
| INSUFFICIENT_POINTS | 积分不足 | 检查学生积分余额 |
| OUT_OF_STOCK | 商品库存不足 | 等待补货或选择其他商品 |
| ALREADY_RESERVED | 已预约该商品 | 取消现有预约或选择其他商品 |

## 数据管理

### 数据文件结构
```
data/
├── students.json      # 学生信息
├── points.json        # 积分记录
├── products.json      # 商品信息
├── orders.json        # 订单记录
└── config.json        # 系统配置
```

### 数据导入导出

#### 导出数据
```bash
# 创建完整备份
npm run backup

# 导出特定数据
node scripts/export-students.js > students-export.json
```

#### 导入数据
```bash
# 从备份恢复
npm run restore backup-file.zip

# 导入学生数据
node scripts/import-students.js students-data.json
```

### 数据清理

#### 清理过期数据
```bash
# 清理30天前的积分记录
node scripts/cleanup-old-records.js --days 30

# 清理已完成的订单
node scripts/cleanup-orders.js --status completed --days 7
```

## API 文档

### 认证接口
- `POST /api/auth/teacher-login` - 教师登录
- `POST /api/auth/student-login` - 学生登录

### 学生管理
- `GET /api/students` - 获取学生列表
- `POST /api/students` - 创建学生
- `GET /api/students/:id` - 获取学生信息
- `PUT /api/students/:id` - 更新学生信息
- `DELETE /api/students/:id` - 删除学生

### 积分管理
- `POST /api/points/add` - 加分
- `POST /api/points/subtract` - 减分
- `GET /api/points/rankings` - 获取排行榜
- `GET /api/points/history/:studentId` - 获取积分历史

### 商品管理
- `GET /api/products` - 获取商品列表
- `POST /api/products` - 创建商品
- `PUT /api/products/:id` - 更新商品
- `DELETE /api/products/:id` - 删除商品

### 订单管理
- `POST /api/orders/reserve` - 预约商品
- `GET /api/orders/pending` - 获取待确认订单
- `POST /api/orders/:id/confirm` - 确认订单
- `POST /api/orders/:id/cancel` - 取消订单

### 系统管理
- `GET /api/config/mode` - 获取系统模式
- `POST /api/config/mode` - 设置系统模式
- `GET /api/health` - 健康检查
- `POST /api/backup/create` - 创建备份
- `GET /api/backup/list` - 获取备份列表

## 最佳实践

### 1. 日常使用建议
- 每天开始前检查系统健康状态
- 定期查看日志文件，及时发现问题
- 建议每周手动创建一次备份
- 定期清理过期的日志和备份文件

### 2. 性能优化
- 避免在高峰时段进行大量数据操作
- 定期重启服务释放内存
- 监控磁盘空间，及时清理不必要的文件
- 使用反向代理提高访问性能

### 3. 安全建议
- 定期更改教师密码
- 监控异常登录行为
- 定期更新系统依赖
- 启用防火墙保护

### 4. 数据管理
- 定期验证数据一致性
- 保持多个备份副本
- 测试备份恢复流程
- 记录重要的数据变更操作

## 联系支持

如果在使用过程中遇到问题：
1. 查看相关日志文件
2. 参考故障处理部分
3. 检查系统配置是否正确
4. 联系技术支持并提供详细的问题描述和日志信息