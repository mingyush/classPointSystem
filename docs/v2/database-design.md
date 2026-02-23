# 班级积分管理系统 V2 - 数据库设计

## 一、数据库选型

### 1.1 选择SQLite的理由

| 优势 | 说明 |
|------|------|
| 零配置 | 无需安装数据库服务 |
| 轻量级 | 单文件存储，便于备份迁移 |
| 性能足够 | 对于班级级别的数据量完全够用 |
| 嵌入式 | 随应用启动，无需额外进程 |
| 可靠性 | ACID事务支持 |

### 1.2 ORM选择

使用 **Prisma** 作为ORM工具：
- 类型安全的数据库操作
- 自动生成TypeScript类型
- 迁移管理
- 优秀的开发体验

---

## 二、数据库模型设计

### 2.1 Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // file:./data.db
}

// ==================== 学期管理 ====================

model Semester {
  id          String   @id @default(uuid())
  name        String   @unique   // "2024-2025第一学期"
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean  @default(false)
  isArchived  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 关联
  pointRecords PointRecord[]
  orders       Order[]
  
  @@index([isActive])
  @@index([startDate, endDate])
}

// ==================== 学生管理 ====================

model Student {
  id           String   @id               // 学号
  name         String
  gender       String?  // 'M' | 'F'
  class        String
  groupId      String?
  avatar       String?
  balance      Int      @default(0)       // 当前学期积分
  totalBalance Int      @default(0)       // 历史累计积分
  status       String   @default("active") // active, graduated, transferred
  remark       String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  // 关联
  points PointRecord[]
  orders Order[]
  
  @@index([class])
  @@index([status])
  @@index([balance])
}

// ==================== 积分管理 ====================

model PointRecord {
  id         String    @id @default(uuid())
  studentId  String
  student    Student   @relation(fields: [studentId], references: [id])
  semesterId String
  semester   Semester  @relation(fields: [semesterId], references: [id])
  points     Int
  reason     String
  type       String    // add, subtract, purchase, refund
  category   String?   // 学习、纪律、活动、其他
  operatorId String?
  createdAt  DateTime  @default(now())
  
  @@index([studentId, semesterId])
  @@index([semesterId, createdAt])
  @@index([type])
  @@index([category])
}

model PointRule {
  id        String   @id @default(uuid())
  name      String
  points    Int
  reason    String
  category  String   // 学习、纪律、活动、其他
  icon      String?
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([category, isActive])
  @@index([sortOrder])
}

// ==================== 商品与订单 ====================

model Product {
  id          String   @id @default(uuid())
  name        String
  price       Int
  stock       Int
  description String?
  imageUrl    String?
  category    String?   // 文具、书籍、其他
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // 关联
  orders Order[]
  
  @@index([isActive])
  @@index([category])
}

model Order {
  id          String    @id @default(uuid())
  studentId   String
  student     Student   @relation(fields: [studentId], references: [id])
  productId   String
  product     Product   @relation(fields: [productId], references: [id])
  semesterId  String
  semester    Semester  @relation(fields: [semesterId], references: [id])
  status      String    @default("pending") // pending, confirmed, cancelled
  reservedAt  DateTime  @default(now())
  confirmedAt DateTime?
  cancelledAt DateTime?
  cancelReason String?
  operatorId  String?   // 确认/取消操作者
  
  @@index([semesterId, status])
  @@index([studentId])
  @@index([status])
}

// ==================== 教师管理 ====================

model Teacher {
  id           String   @id
  name         String
  passwordHash String
  role         String   @default("teacher")  // teacher, admin
  department   String?
  isActive     Boolean  @default(true)
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@index([role, isActive])
}

// ==================== 系统管理 ====================

model SystemLog {
  id         String   @id @default(uuid())
  action     String
  module     String?   // points, orders, students, system
  details    String?   // JSON string
  operatorId String?
  operatorName String?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
  
  @@index([module, createdAt])
  @@index([operatorId])
}

model SystemConfig {
  id    String @id @default("system")
  key   String @unique
  value String
}

// ==================== 登录日志 ====================

model LoginLog {
  id         String   @id @default(uuid())
  userId     String
  userType   String   // teacher, student
  loginTime  DateTime @default(now())
  ipAddress  String?
  userAgent  String?
  success    Boolean
  failReason String?
  
  @@index([userId, userType])
  @@index([loginTime])
}

// ==================== 备份记录 ====================

model BackupRecord {
  id          String   @id @default(uuid())
  filename    String
  filesize    Int
  type        String   // auto, manual
  status      String   // success, failed
  createdAt   DateTime @default(now())
  
  @@index([createdAt])
}
```

---

## 三、索引设计

### 3.1 主键索引

所有表使用UUID作为主键，自动创建主键索引。

### 3.2 业务索引

| 表 | 索引字段 | 用途 |
|------|---------|------|
| Semester | isActive | 查询当前学期 |
| Semester | startDate, endDate | 时间范围查询 |
| Student | class | 按班级筛选 |
| Student | status | 按状态筛选 |
| Student | balance | 排行榜排序 |
| PointRecord | studentId, semesterId | 查询学生学期积分 |
| PointRecord | semesterId, createdAt | 按时间查询记录 |
| PointRecord | type | 按类型筛选 |
| Order | status | 按状态筛选 |
| Order | studentId | 查询学生订单 |

---

## 四、数据关系图

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Semester   │────<│   PointRecord   │>────│   Student   │
└─────────────┘     └─────────────────┘     └─────────────┘
      │                                           │
      │         ┌─────────────┐                   │
      │         │  PointRule  │                   │
      │         └─────────────┘                   │
      │                                           │
      │     ┌─────────────────┐                   │
      └────<│      Order      │>──────────────────┘
            └─────────────────┘
                   │
                   │
            ┌──────┴──────┐
            │   Product   │
            └─────────────┘

┌─────────────┐     ┌─────────────────┐
│   Teacher   │────<│   SystemLog     │
└─────────────┘     └─────────────────┘

┌─────────────┐     ┌─────────────────┐
│  (系统)     │────<│  SystemConfig   │
└─────────────┘     └─────────────────┘
```

---

## 五、数据字典

### 5.1 枚举值定义

**Student.status**
| 值 | 说明 |
|------|------|
| active | 在读 |
| graduated | 已毕业 |
| transferred | 已转学 |

**PointRecord.type**
| 值 | 说明 |
|------|------|
| add | 加分 |
| subtract | 减分 |
| purchase | 兑换消费 |
| refund | 退还 |

**PointRule.category**
| 值 | 说明 |
|------|------|
| 学习 | 作业、考试、课堂等 |
| 纪律 | 考勤、行为规范等 |
| 活动 | 比赛、志愿服务等 |
| 其他 | 其他类别 |

**Order.status**
| 值 | 说明 |
|------|------|
| pending | 待处理 |
| confirmed | 已确认 |
| cancelled | 已取消 |

**Teacher.role**
| 值 | 说明 |
|------|------|
| teacher | 普通教师 |
| admin | 管理员 |

---

## 六、初始数据

### 6.1 默认积分规则

```sql
INSERT INTO PointRule (id, name, points, reason, category, sortOrder, isActive) VALUES
  (uuid(), '课堂积极发言', 3, '课堂积极发言', '学习', 1, 1),
  (uuid(), '作业优秀', 5, '作业完成优秀', '学习', 2, 1),
  (uuid(), '考试进步', 10, '考试成绩有明显进步', '学习', 3, 1),
  (uuid(), '帮助同学', 2, '主动帮助同学', '其他', 4, 1),
  (uuid(), '迟到', -2, '迟到', '纪律', 5, 1),
  (uuid(), '未交作业', -3, '未按时提交作业', '纪律', 6, 1);
```

### 6.2 默认系统配置

```sql
INSERT INTO SystemConfig (id, key, value) VALUES
  ('system', 'maxPointsPerOperation', '100'),
  ('system', 'allowNegativeBalance', 'false'),
  ('system', 'undoTimeLimit', '5'),
  ('system', 'autoRefreshInterval', '30'),
  ('system', 'rankingDisplayCount', '10'),
  ('system', 'showStudentId', 'true'),
  ('system', 'autoBackupEnabled', 'true'),
  ('system', 'backupInterval', '24'),
  ('system', 'maxBackupCount', '30'),
  ('system', 'maxPendingOrders', '3'),
  ('system', 'orderExpireDays', '7');
```

### 6.3 默认管理员

```typescript
// 密码需要使用bcrypt加密
const adminPassword = await bcrypt.hash('admin123', 12);

INSERT INTO Teacher (id, name, passwordHash, role, isActive) VALUES
  ('admin', '系统管理员', adminPassword, 'admin', 1);
```

---

## 七、数据库配置

### 7.1 环境变量

```env
# .env
DATABASE_URL="file:./data.db"

# JWT配置
JWT_SECRET="your-secret-key-here"
JWT_EXPIRES_IN="8h"

# 应用配置
NODE_ENV="development"
PORT=3000
```

### 7.2 Prisma配置

```javascript
// prisma/prisma.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
})

export default prisma
```

---

## 八、数据迁移脚本

### 8.1 创建迁移

```bash
# 创建迁移
npx prisma migrate dev --name init

# 生成客户端
npx prisma generate

# 打开数据库GUI
npx prisma studio
```

### 8.2 V1到V2迁移

详见 [migration-guide.md](./migration-guide.md)
