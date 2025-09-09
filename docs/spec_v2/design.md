# 设计文档 - 班级积分系统第二版

## 概述

班级积分系统第二版是一个支持多班级的简洁积分管理工具。系统通过三个入口地址提供服务，每个班级数据完全隔离，支持数据库和JSON文件双重存储方案。

### 核心特性
- 多班级支持，数据完全隔离
- 三个独立入口：教室大屏、班级后台、系统管理
- 灵活的权限管理：班主任、任课老师、学生
- 双存储支持：数据库 + JSON文件兼容
- 实时数据同步和自动状态管理

## 系统架构

### 整体架构图

```mermaid
graph TB
    subgraph "前端层"
        A[教室大屏<br/>/class/[key]/display]
        B[班级后台<br/>/class/[key]/admin]
        C[系统管理<br/>暂不提供界面]
    end
    
    subgraph "应用层"
        D[Express.js 服务器]
        E[路由中间件]
        F[权限验证中间件]
        G[班级隔离中间件]
    end
    
    subgraph "业务层"
        H[积分管理服务]
        I[用户管理服务]
        J[商品管理服务]
        K[预约管理服务]
        L[班级管理服务]
    end
    
    subgraph "数据层"
        M[MySQL适配器]
        N[SQLite适配器]
        O[存储适配器工厂]
    end
    
    subgraph "存储层"
        P[(MySQL8)]
        Q[(SQLite)]
    end
    
    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    G --> I
    G --> J
    G --> K
    G --> L
    H --> M
    I --> M
    J --> M
    K --> M
    L --> M
    M --> N
    N --> O
    O --> P
    O --> Q
```

### 路由设计

```
/class/[classKey]/display     # 教室大屏入口
/class/[classKey]/admin       # 班级后台入口
/api/class/[classKey]/*       # 班级API接口
/api/system/*                 # 系统管理API（内部使用）
```

## 核心组件设计

### 1. 班级隔离中间件

负责根据URL中的classKey进行数据隔离：

```javascript
// 班级隔离中间件接口
interface ClassIsolationMiddleware {
  validateClassKey(classKey: string): Promise<boolean>  // 验证班级标识
  setClassContext(req: Request, classKey: string): void  // 设置班级上下文
  getClassContext(req: Request): ClassContext           // 获取班级上下文
}

interface ClassContext {
  classId: string      // 班级ID
  classKey: string     // 班级标识
  className: string    // 班级名称
  settings: ClassSettings  // 班级设置
}
```

### 2. 权限管理系统

```javascript
// 用户权限接口
interface UserPermission {
  userId: string       // 用户ID
  classId: string      // 班级ID
  role: 'admin' | 'teacher' | 'student'  // 角色：班主任/任课老师/学生
  permissions: string[]  // 权限列表
}

// 权限验证器接口
interface PermissionValidator {
  validateTeacherAccess(classKey: string, teacherId: string): Promise<boolean>  // 验证教师访问权限
  validateAdminAccess(classKey: string, userId: string): Promise<boolean>       // 验证班主任访问权限
  validateDisplayAccess(classKey: string): Promise<boolean>                     // 验证大屏访问权限
}
```

### 3. 教室大屏状态管理

```javascript
// 大屏状态接口
interface DisplayState {
  classKey: string              // 班级标识
  mode: 'normal' | 'class'      // 模式：平时模式/上课模式
  isAuthenticated: boolean      // 是否已认证
  currentTeacher?: string       // 当前教师
  sessionStartTime?: Date       // 会话开始时间
  autoSwitchTimer?: NodeJS.Timeout  // 自动切换定时器
}

// 大屏管理器接口
interface DisplayManager {
  authenticateDisplay(classKey: string, adminCredentials: any): Promise<boolean>  // 认证大屏
  switchToClassMode(classKey: string, teacherId: string, password?: string): Promise<boolean>  // 切换到上课模式
  switchToNormalMode(classKey: string): Promise<boolean>  // 切换到平时模式
  startAutoSwitchTimer(classKey: string): void           // 启动自动切换定时器
  clearAutoSwitchTimer(classKey: string): void           // 清除自动切换定时器
}
```

### 4. 数据存储适配器

```javascript
// 存储适配器接口
interface StorageAdapter {
  // 学生管理
  getStudents(classId: string): Promise<Student[]>  // 获取学生列表
  createStudent(classId: string, student: Student): Promise<Student>  // 创建学生
  updateStudent(classId: string, studentId: string, updates: Partial<Student>): Promise<Student>  // 更新学生信息
  deleteStudent(classId: string, studentId: string): Promise<boolean>  // 删除学生
  
  // 积分管理
  getPointRecords(classId: string, filters?: PointFilter): Promise<PointRecord[]>  // 获取积分记录
  createPointRecord(classId: string, record: PointRecord): Promise<PointRecord>    // 创建积分记录
  calculatePointBalance(classId: string, studentId: string): Promise<number>       // 计算积分余额
  
  // 商品管理
  getProducts(classId: string): Promise<Product[]>  // 获取商品列表
  createProduct(classId: string, product: Product): Promise<Product>  // 创建商品
  updateProduct(classId: string, productId: string, updates: Partial<Product>): Promise<Product>  // 更新商品信息
  
  // 预约管理
  getOrders(classId: string, filters?: OrderFilter): Promise<Order[]>  // 获取预约订单
  createOrder(classId: string, order: Order): Promise<Order>           // 创建预约订单
  updateOrderStatus(classId: string, orderId: string, status: OrderStatus): Promise<Order>  // 更新订单状态
}
```

## 数据模型设计

### 核心数据模型

```javascript
// 学校信息
interface School {
  id: string
  name: string             // 学校名称
  address?: string         // 学校地址
  createdAt: Date         // 创建时间
  updatedAt: Date         // 更新时间
}

// 班级信息
interface Class {
  id: string
  schoolId: string         // 学校ID
  key: string              // 唯一访问标识，默认为id
  name: string             // 班级名称（可由班主任修改）
  grade: string            // 年级
  graduationYear: number   // 毕业年份（如2028届）
  studentNumberPrefix: string  // 学号前缀
  settings: ClassSettings  // 班级设置
  createdAt: Date         // 创建时间
  updatedAt: Date         // 更新时间
}

// 班级设置
interface ClassSettings {
  requireSwitchPassword: boolean    // 是否需要切换密码
  switchPassword?: string          // 切换密码
  autoSwitchHours: number         // 自动切换时间（小时）
  displayConfig: DisplayConfig     // 显示配置
}

// 显示配置
interface DisplayConfig {
  showStudentQuery: boolean       // 是否显示学生查询入口
  queryPosition: 'bottom' | 'top' // 查询入口位置
  theme: string                   // 界面主题
}

// 用户信息
interface User {
  id: string
  classId: string                 // 班级ID
  username: string                // 用户名
  name: string                    // 姓名
  role: 'admin' | 'teacher' | 'student'  // 角色：班主任/任课老师/学生
  classStudentNumber?: string     // 班内学号（01-99，学生专用）
  fullStudentNumber?: string      // 完整学号（前缀+班内学号，学生专用）
  isActive: boolean              // 是否激活
  createdAt: Date                // 创建时间
}

// 学生信息（继承用户）
interface Student extends User {
  classStudentNumber: string      // 班内学号（01-99）
  fullStudentNumber: string       // 完整学号（前缀+班内学号）
  currentBalance: number          // 当前积分余额
  totalEarned: number            // 累计获得积分
  totalSpent: number             // 累计消费积分
}

// 积分记录
interface PointRecord {
  id: string
  classId: string                 // 班级ID
  studentId: string               // 学生ID
  teacherId: string               // 教师ID
  amount: number                  // 积分变化（正数加分，负数减分）
  reason: string                  // 操作原因
  type: 'manual' | 'reward' | 'penalty' | 'purchase'  // 类型：手动/奖励/惩罚/消费
  createdAt: Date                 // 创建时间
}

// 常用奖惩项
interface RewardPenaltyItem {
  id: string
  classId: string                 // 班级ID
  name: string                    // 奖惩项名称
  points: number                  // 积分数（正数奖励，负数惩罚）
  type: 'reward' | 'penalty'      // 类型：奖励/惩罚
  isActive: boolean              // 是否启用
  sortOrder: number              // 排序
}

// 商品信息
interface Product {
  id: string
  classId: string                 // 班级ID
  name: string                    // 商品名称
  description?: string            // 商品描述
  price: number                   // 积分价格
  stock: number                   // 库存数量
  isActive: boolean              // 是否上架
  createdAt: Date                // 创建时间
}

// 预约订单
interface Order {
  id: string
  classId: string                 // 班级ID
  studentId: string               // 学生ID
  productId: string               // 商品ID
  quantity: number                // 数量
  totalPrice: number              // 总价格
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'  // 状态：待确认/已确认/已取消/已完成
  createdAt: Date                 // 创建时间
  confirmedAt?: Date              // 确认时间
  completedAt?: Date              // 完成时间
}
```

### 数据库表设计

```sql
-- 学校表
CREATE TABLE schools (
  id VARCHAR(36) PRIMARY KEY COMMENT '学校ID',
  name VARCHAR(100) NOT NULL COMMENT '学校名称',
  address VARCHAR(200) COMMENT '学校地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) COMMENT='学校信息表';

-- 班级表
CREATE TABLE classes (
  id VARCHAR(36) PRIMARY KEY COMMENT '班级ID',
  school_id VARCHAR(36) NOT NULL COMMENT '学校ID',
  key VARCHAR(50) UNIQUE NOT NULL COMMENT '班级访问标识',
  name VARCHAR(100) NOT NULL COMMENT '班级名称（可由班主任修改）',
  grade VARCHAR(20) COMMENT '年级',
  graduation_year INT COMMENT '毕业年份（如2028届）',
  student_number_prefix VARCHAR(10) COMMENT '学号前缀',
  settings JSON COMMENT '班级设置',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (school_id) REFERENCES schools(id)
) COMMENT='班级信息表';

-- 用户表
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY COMMENT '用户ID',
  class_id VARCHAR(36) NOT NULL COMMENT '班级ID',
  username VARCHAR(50) NOT NULL COMMENT '用户名',
  name VARCHAR(100) NOT NULL COMMENT '姓名',
  role ENUM('admin', 'teacher', 'student') NOT NULL COMMENT '角色：班主任/任课老师/学生',
  class_student_number VARCHAR(2) COMMENT '班内学号（01-99）',
  full_student_number VARCHAR(20) COMMENT '完整学号（前缀+班内学号）',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (class_id) REFERENCES classes(id),
  UNIQUE KEY unique_username_class (username, class_id),
  UNIQUE KEY unique_class_student_number (class_id, class_student_number),
  UNIQUE KEY unique_full_student_number (full_student_number)
) COMMENT='用户信息表';

-- 积分记录表
CREATE TABLE point_records (
  id VARCHAR(36) PRIMARY KEY COMMENT '记录ID',
  class_id VARCHAR(36) NOT NULL COMMENT '班级ID',
  student_id VARCHAR(36) NOT NULL COMMENT '学生ID',
  teacher_id VARCHAR(36) NOT NULL COMMENT '教师ID',
  amount INT NOT NULL COMMENT '积分变化',
  reason VARCHAR(200) NOT NULL COMMENT '操作原因',
  type ENUM('manual', 'reward', 'penalty', 'purchase') NOT NULL COMMENT '类型',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
) COMMENT='积分记录表';

-- 常用奖惩项表
CREATE TABLE reward_penalty_items (
  id VARCHAR(36) PRIMARY KEY COMMENT '奖惩项ID',
  class_id VARCHAR(36) NOT NULL COMMENT '班级ID',
  name VARCHAR(100) NOT NULL COMMENT '奖惩项名称',
  points INT NOT NULL COMMENT '积分数',
  type ENUM('reward', 'penalty') NOT NULL COMMENT '类型：奖励/惩罚',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  sort_order INT DEFAULT 0 COMMENT '排序',
  FOREIGN KEY (class_id) REFERENCES classes(id)
) COMMENT='常用奖惩项表';

-- 商品表
CREATE TABLE products (
  id VARCHAR(36) PRIMARY KEY COMMENT '商品ID',
  class_id VARCHAR(36) NOT NULL COMMENT '班级ID',
  name VARCHAR(100) NOT NULL COMMENT '商品名称',
  description TEXT COMMENT '商品描述',
  price INT NOT NULL COMMENT '积分价格',
  stock INT DEFAULT 0 COMMENT '库存数量',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否上架',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (class_id) REFERENCES classes(id)
) COMMENT='商品信息表';

-- 订单表
CREATE TABLE orders (
  id VARCHAR(36) PRIMARY KEY COMMENT '订单ID',
  class_id VARCHAR(36) NOT NULL COMMENT '班级ID',
  student_id VARCHAR(36) NOT NULL COMMENT '学生ID',
  product_id VARCHAR(36) NOT NULL COMMENT '商品ID',
  quantity INT NOT NULL COMMENT '数量',
  total_price INT NOT NULL COMMENT '总价格',
  status ENUM('pending', 'confirmed', 'cancelled', 'completed') DEFAULT 'pending' COMMENT '状态',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  confirmed_at TIMESTAMP NULL COMMENT '确认时间',
  completed_at TIMESTAMP NULL COMMENT '完成时间',
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) COMMENT='预约订单表';
```

## 错误处理策略

### 1. 班级访问错误
- 无效班级标识：返回404页面，提示"班级不存在"
- 权限不足：返回403页面，提示"权限不足"
- 班级未激活：返回503页面，提示"班级暂时不可用"

### 2. 数据存储错误
- MySQL连接失败：记录错误日志，提示检查数据库配置
- SQLite文件损坏：尝试从备份恢复，失败则初始化默认数据
- 数据操作失败：回滚事务，记录错误日志

### 3. 业务逻辑错误
- 积分不足：友好提示，不阻止操作（允许负数）
- 库存不足：阻止预约，提示"库存不足"
- 重复操作：防重复提交机制

### 4. 前端错误处理
- 网络连接失败：显示"网络连接失败"提示，支持重试
- 数据加载失败：显示错误信息，提供刷新按钮
- 操作超时：自动重试，超过次数后提示用户

## 测试策略

### 1. 单元测试
- 数据模型验证测试
- 业务逻辑功能测试
- 权限验证测试
- 数据存储适配器测试

### 2. 集成测试
- API接口测试
- 数据库操作测试
- 班级隔离测试
- 实时通信测试

### 3. 端到端测试
- 用户操作流程测试
- 多班级并发测试
- 数据迁移测试
- 错误恢复测试

### 4. 性能测试
- 并发用户访问测试
- 大数据量查询测试
- 内存使用监控
- 响应时间测试

## 部署和运维

### 1. 部署架构
- 单机部署：适合小规模使用
- 容器化部署：支持Docker容器
- 负载均衡：支持多实例部署
- 数据库集群：支持主从复制

### 2. 监控和日志
- 应用性能监控
- 错误日志收集
- 用户行为分析
- 系统资源监控

### 3. 备份和恢复
- 自动数据备份
- 定期备份验证
- 快速恢复机制
- 灾难恢复预案

### 4. 安全措施
- 数据传输加密
- 敏感信息脱敏
- 访问日志审计
- 安全漏洞扫描