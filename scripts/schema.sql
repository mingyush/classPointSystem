-- 班级积分管理系统 D1 数据库 Schema
-- 创建时间: 2024-01-01
-- 版本: 1.0.0

-- 学生信息表
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,  -- 学号
    name TEXT NOT NULL,               -- 姓名
    class_name TEXT NOT NULL,         -- 班级
    points_balance INTEGER DEFAULT 0, -- 积分余额
    avatar_url TEXT,                  -- 头像URL
    status TEXT DEFAULT 'active',     -- 状态: active, inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 积分记录表
CREATE TABLE IF NOT EXISTS point_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,         -- 学号
    points INTEGER NOT NULL,          -- 积分变动（正数为加分，负数为扣分）
    reason TEXT NOT NULL,             -- 积分变动原因
    type TEXT NOT NULL,               -- 类型: earn, spend, adjust
    teacher_id TEXT,                  -- 操作教师ID
    order_id TEXT,                    -- 关联订单ID（如果是消费）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,               -- 商品名称
    description TEXT,                 -- 商品描述
    price INTEGER NOT NULL,           -- 商品价格（积分）
    stock INTEGER DEFAULT 0,          -- 库存数量
    image_url TEXT,                   -- 商品图片URL
    category TEXT DEFAULT 'general',  -- 商品分类
    status TEXT DEFAULT 'active',     -- 状态: active, inactive
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,    -- 订单号
    student_id TEXT NOT NULL,         -- 学号
    product_id INTEGER NOT NULL,      -- 商品ID
    quantity INTEGER DEFAULT 1,       -- 数量
    total_points INTEGER NOT NULL,    -- 总积分
    status TEXT DEFAULT 'pending',    -- 状态: pending, confirmed, cancelled, completed
    notes TEXT,                       -- 备注
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,         -- 配置键
    value TEXT NOT NULL,              -- 配置值
    description TEXT,                 -- 配置描述
    type TEXT DEFAULT 'string',       -- 数据类型: string, number, boolean, json
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 教师信息表
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id TEXT UNIQUE NOT NULL,  -- 教师ID
    name TEXT NOT NULL,               -- 姓名
    password_hash TEXT NOT NULL,      -- 密码哈希
    role TEXT DEFAULT 'teacher',      -- 角色: teacher, admin
    status TEXT DEFAULT 'active',     -- 状态: active, inactive
    last_login DATETIME,              -- 最后登录时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_class_name ON students(class_name);
CREATE INDEX IF NOT EXISTS idx_point_records_student_id ON point_records(student_id);
CREATE INDEX IF NOT EXISTS idx_point_records_created_at ON point_records(created_at);
CREATE INDEX IF NOT EXISTS idx_point_records_type ON point_records(type);
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);
CREATE INDEX IF NOT EXISTS idx_teachers_teacher_id ON teachers(teacher_id);

-- 插入默认系统配置
INSERT OR IGNORE INTO system_config (key, value, description, type) VALUES
('system_name', '班级积分管理系统', '系统名称', 'string'),
('class_name', '高一(1)班', '班级名称', 'string'),
('teacher_name', '张老师', '班主任姓名', 'string'),
('points_per_good_behavior', '5', '良好行为奖励积分', 'number'),
('points_per_homework', '3', '作业完成奖励积分', 'number'),
('points_per_participation', '2', '课堂参与奖励积分', 'number'),
('max_daily_points', '20', '每日最大获得积分', 'number'),
('ranking_cache_duration', '300', '排行榜缓存时长（秒）', 'number'),
('system_mode', 'normal', '系统模式: normal, class', 'string'),
('auto_backup_enabled', 'true', '是否启用自动备份', 'boolean'),
('backup_interval_hours', '24', '备份间隔（小时）', 'number');

-- 插入默认教师账户（密码: admin123，实际部署时需要修改）
INSERT OR IGNORE INTO teachers (teacher_id, name, password_hash, role) VALUES
('admin', '系统管理员', '$2b$10$rQZ8kHWKQxvKFVeVZHZOHOyNjKJ5YrJQZJQZJQZJQZJQZJQZJQZJQ', 'admin'),
('teacher001', '张老师', '$2b$10$rQZ8kHWKQxvKFVeVZHZOHOyNjKJ5YrJQZJQZJQZJQZJQZJQZJQZJQ', 'teacher');

-- 插入示例商品数据
INSERT OR IGNORE INTO products (name, description, price, stock, category) VALUES
('文具套装', '包含笔、橡皮、尺子等学习用品', 50, 20, 'stationery'),
('课外书籍', '精选课外读物，拓展知识面', 80, 15, 'books'),
('小零食', '健康美味的小零食', 30, 50, 'snacks'),
('学习用品', '实用的学习辅助工具', 60, 25, 'stationery'),
('体育用品', '篮球、跳绳等体育器材', 100, 10, 'sports');