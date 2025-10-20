-- SQLite数据库表结构
-- 班级积分管理系统

-- 用户表（包含学生、教师、管理员）
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL DEFAULT 'default',
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    student_number TEXT,
    password_hash TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT,
    UNIQUE(class_id, username)
);

-- 积分记录表
CREATE TABLE IF NOT EXISTS point_records (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL DEFAULT 'default',
    student_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('manual', 'reward', 'penalty', 'purchase', 'refund')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK (price >= 0),
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL DEFAULT 'default',
    student_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_price INTEGER NOT NULL CHECK (total_price >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 奖惩项表
CREATE TABLE IF NOT EXISTS reward_penalty_items (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('reward', 'penalty')),
    description TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    class_id TEXT NOT NULL DEFAULT 'default',
    mode TEXT DEFAULT 'normal' CHECK (mode IN ('class', 'normal')),
    auto_refresh_interval INTEGER DEFAULT 30,
    points_reset_enabled INTEGER DEFAULT 0,
    max_points_per_operation INTEGER DEFAULT 100,
    semester_start_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT
);

-- 系统状态表（用于大屏状态管理）
CREATE TABLE IF NOT EXISTS system_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    class_id TEXT NOT NULL DEFAULT 'default',
    mode TEXT DEFAULT 'normal' CHECK (mode IN ('normal', 'class')),
    current_teacher TEXT,
    session_start_time TEXT,
    last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
    is_authenticated INTEGER DEFAULT 0,
    auto_switch_hours INTEGER DEFAULT 2,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_users_class_role ON users(class_id, role);
CREATE INDEX IF NOT EXISTS idx_users_student_number ON users(student_number) WHERE student_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_class_student_number ON users(class_id, student_number) WHERE student_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_point_records_student ON point_records(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_point_records_class ON point_records(class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_products_class_active ON products(class_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_student ON orders(student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_class_status ON orders(class_id, status);
CREATE INDEX IF NOT EXISTS idx_reward_penalty_items_class ON reward_penalty_items(class_id, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_system_state_class ON system_state(class_id);

-- 插入默认管理员用户
INSERT OR IGNORE INTO users (id, username, name, role, password_hash, created_at) 
VALUES ('admin_default', 'admin', '系统管理员', 'admin', 'default_hash', CURRENT_TIMESTAMP);

-- 插入默认系统配置
INSERT OR IGNORE INTO system_config (id, class_id, created_at) 
VALUES ('default', 'default', CURRENT_TIMESTAMP);

-- 插入默认系统状态
INSERT OR IGNORE INTO system_state (id, class_id, created_at, updated_at) 
VALUES ('default', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 插入默认奖惩项
INSERT OR IGNORE INTO reward_penalty_items (id, class_id, name, points, type, sort_order, created_at) VALUES
('reward_homework', 'default', '按时完成作业', 5, 'reward', 1, CURRENT_TIMESTAMP),
('reward_participation', 'default', '积极参与课堂', 3, 'reward', 2, CURRENT_TIMESTAMP),
('reward_help_others', 'default', '帮助同学', 4, 'reward', 3, CURRENT_TIMESTAMP),
('reward_excellent_performance', 'default', '表现优秀', 10, 'reward', 4, CURRENT_TIMESTAMP),
('penalty_late', 'default', '迟到', -2, 'penalty', 5, CURRENT_TIMESTAMP),
('penalty_no_homework', 'default', '未完成作业', -5, 'penalty', 6, CURRENT_TIMESTAMP),
('penalty_disruption', 'default', '课堂违纪', -3, 'penalty', 7, CURRENT_TIMESTAMP);

-- 插入默认商品
INSERT OR IGNORE INTO products (id, class_id, name, description, price, stock, created_at) VALUES
('product_notebook', 'default', '精美笔记本', '高质量笔记本，适合学习记录', 50, 10, CURRENT_TIMESTAMP),
('product_pen', 'default', '优质钢笔', '书写流畅的钢笔', 30, 20, CURRENT_TIMESTAMP),
('product_bookmark', 'default', '精美书签', '漂亮的书签，阅读好伴侣', 10, 50, CURRENT_TIMESTAMP),
('product_stationery_set', 'default', '学习用品套装', '包含笔、橡皮、尺子等学习用品', 80, 5, CURRENT_TIMESTAMP),
('product_stickers', 'default', '励志贴纸', '激励学习的精美贴纸', 5, 100, CURRENT_TIMESTAMP);