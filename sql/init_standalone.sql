-- 班级积分系统 数据库初始化脚本
-- 支持 SQLite 和 Cloudflare D1

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  student_number TEXT UNIQUE,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 积分记录表
CREATE TABLE IF NOT EXISTS point_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('manual', 'reward', 'penalty', 'purchase')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- 常用奖惩项表
CREATE TABLE IF NOT EXISTS reward_penalty_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('reward', 'penalty')),
  is_active BOOLEAN DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 系统状态表
CREATE TABLE IF NOT EXISTS system_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT DEFAULT 'normal' CHECK (mode IN ('normal', 'class')),
  current_teacher TEXT,
  session_start_time DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_point_records_student_id ON point_records(student_id);
CREATE INDEX IF NOT EXISTS idx_point_records_created_at ON point_records(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_users_student_number ON users(student_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 插入默认系统状态
INSERT OR IGNORE INTO system_state (id, mode) VALUES (1, 'normal');

-- 插入默认管理员用户（密码需要在应用层设置）
INSERT OR IGNORE INTO users (id, username, name, role, is_active) 
VALUES ('admin_default', 'admin', '系统管理员', 'admin', 1);

-- 插入默认奖惩项
INSERT OR IGNORE INTO reward_penalty_items (id, name, points, type, sort_order) VALUES
('reward_1', '课堂表现优秀', 5, 'reward', 1),
('reward_2', '作业完成优秀', 3, 'reward', 2),
('reward_3', '帮助同学', 2, 'reward', 3),
('penalty_1', '上课讲话', -2, 'penalty', 4),
('penalty_2', '作业未完成', -3, 'penalty', 5),
('penalty_3', '迟到', -1, 'penalty', 6);

-- 插入示例商品
INSERT OR IGNORE INTO products (id, name, description, price, stock) VALUES
('product_1', '笔记本', '精美笔记本一本', 10, 20),
('product_2', '铅笔', '2B铅笔一支', 3, 50),
('product_3', '橡皮', '优质橡皮一块', 2, 30),
('product_4', '书签', '精美书签一枚', 5, 25);