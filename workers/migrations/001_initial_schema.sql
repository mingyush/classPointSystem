-- 班级积分管理系统 - 初始数据库Schema
-- 创建时间: 2024-01-01
-- 描述: 创建所有必要的表和索引

-- 学生表
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    class TEXT NOT NULL,
    points_balance INTEGER DEFAULT 0,
    avatar TEXT,
    email TEXT,
    phone TEXT,
    parent_contact TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 学生表索引
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_points_balance ON students(points_balance);

-- 积分记录表
CREATE TABLE IF NOT EXISTS point_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'adjust')),
    category TEXT NOT NULL,
    description TEXT,
    teacher_id TEXT,
    reference_id TEXT,
    reference_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- 积分记录表索引
CREATE INDEX IF NOT EXISTS idx_point_records_student_id ON point_records(student_id);
CREATE INDEX IF NOT EXISTS idx_point_records_type ON point_records(type);
CREATE INDEX IF NOT EXISTS idx_point_records_category ON point_records(category);
CREATE INDEX IF NOT EXISTS idx_point_records_created_at ON point_records(created_at);
CREATE INDEX IF NOT EXISTS idx_point_records_teacher_id ON point_records(teacher_id);
CREATE INDEX IF NOT EXISTS idx_point_records_reference ON point_records(reference_type, reference_id);

-- 商品表
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    stock INTEGER DEFAULT 0,
    category TEXT NOT NULL,
    image TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 商品表索引
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    student_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- 订单表索引
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT,
    config_type TEXT DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    is_public INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 系统配置表索引
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_system_config_public ON system_config(is_public);

-- 教师表
CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 教师表索引
CREATE INDEX IF NOT EXISTS idx_teachers_teacher_id ON teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teachers_email ON teachers(email);
CREATE INDEX IF NOT EXISTS idx_teachers_role ON teachers(role);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers(status);

-- 插入默认系统配置
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description, is_public) VALUES
('system_name', '班级积分管理系统', 'string', '系统名称', 1),
('system_version', '1.0.0', 'string', '系统版本', 1),
('school_name', '示例学校', 'string', '学校名称', 1),
('class_name', '示例班级', 'string', '班级名称', 1),
('teacher_name', '示例老师', 'string', '班主任姓名', 1),
('points_rules', '{"homework": 10, "behavior": 5, "attendance": 3, "participation": 2}', 'json', '积分规则配置', 1),
('max_daily_points', '50', 'number', '每日最大获得积分', 0),
('min_redeem_points', '10', 'number', '最小兑换积分', 0),
('enable_notifications', 'true', 'boolean', '是否启用通知', 0),
('auto_backup', 'true', 'boolean', '是否自动备份', 0),
('backup_interval', '24', 'number', '备份间隔（小时）', 0),
('theme_color', '#1976d2', 'string', '主题颜色', 1),
('logo_url', '', 'string', 'Logo URL', 1),
('contact_info', '', 'string', '联系信息', 1),
('announcement', '', 'string', '系统公告', 1);

-- 插入默认管理员账户
-- 密码: admin123 (实际使用时应该修改)
INSERT OR IGNORE INTO teachers (teacher_id, name, email, password_hash, role) VALUES
('admin', '系统管理员', 'admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- 创建触发器：自动更新 updated_at 字段

-- 学生表触发器
CREATE TRIGGER IF NOT EXISTS update_students_updated_at
    AFTER UPDATE ON students
    FOR EACH ROW
BEGIN
    UPDATE students SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 商品表触发器
CREATE TRIGGER IF NOT EXISTS update_products_updated_at
    AFTER UPDATE ON products
    FOR EACH ROW
BEGIN
    UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 订单表触发器
CREATE TRIGGER IF NOT EXISTS update_orders_updated_at
    AFTER UPDATE ON orders
    FOR EACH ROW
BEGIN
    UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 系统配置表触发器
CREATE TRIGGER IF NOT EXISTS update_system_config_updated_at
    AFTER UPDATE ON system_config
    FOR EACH ROW
BEGIN
    UPDATE system_config SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 教师表触发器
CREATE TRIGGER IF NOT EXISTS update_teachers_updated_at
    AFTER UPDATE ON teachers
    FOR EACH ROW
BEGIN
    UPDATE teachers SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 创建视图：学生积分统计
CREATE VIEW IF NOT EXISTS student_points_summary AS
SELECT 
    s.id,
    s.student_id,
    s.name,
    s.class,
    s.points_balance,
    COALESCE(earned.total_earned, 0) as total_earned,
    COALESCE(spent.total_spent, 0) as total_spent,
    COALESCE(records.total_records, 0) as total_records,
    s.created_at,
    s.updated_at
FROM students s
LEFT JOIN (
    SELECT student_id, SUM(points) as total_earned
    FROM point_records 
    WHERE type = 'earn' 
    GROUP BY student_id
) earned ON s.student_id = earned.student_id
LEFT JOIN (
    SELECT student_id, SUM(ABS(points)) as total_spent
    FROM point_records 
    WHERE type = 'spend' 
    GROUP BY student_id
) spent ON s.student_id = spent.student_id
LEFT JOIN (
    SELECT student_id, COUNT(*) as total_records
    FROM point_records 
    GROUP BY student_id
) records ON s.student_id = records.student_id;

-- 创建视图：商品销售统计
CREATE VIEW IF NOT EXISTS product_sales_summary AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.price,
    p.stock,
    COALESCE(sales.total_orders, 0) as total_orders,
    COALESCE(sales.total_quantity, 0) as total_quantity,
    COALESCE(sales.total_revenue, 0) as total_revenue,
    p.created_at,
    p.updated_at
FROM products p
LEFT JOIN (
    SELECT 
        product_id,
        COUNT(*) as total_orders,
        SUM(quantity) as total_quantity,
        SUM(total_price) as total_revenue
    FROM orders 
    WHERE status IN ('confirmed', 'completed')
    GROUP BY product_id
) sales ON p.id = sales.product_id
WHERE p.is_deleted = 0;

-- 创建视图：每日积分统计
CREATE VIEW IF NOT EXISTS daily_points_summary AS
SELECT 
    DATE(created_at) as date,
    type,
    category,
    COUNT(*) as record_count,
    SUM(points) as total_points,
    AVG(points) as avg_points
FROM point_records
GROUP BY DATE(created_at), type, category
ORDER BY date DESC, type, category;

-- 创建函数：生成订单号
-- 注意：SQLite不支持存储过程，这个逻辑需要在应用层实现
-- 订单号格式：ORD + YYYYMMDD + 6位随机数

-- 数据完整性检查
-- 确保学生积分余额不为负数
CREATE TRIGGER IF NOT EXISTS check_student_points_balance
    BEFORE UPDATE ON students
    FOR EACH ROW
    WHEN NEW.points_balance < 0
BEGIN
    SELECT RAISE(ABORT, 'Student points balance cannot be negative');
END;

-- 确保商品价格为正数
CREATE TRIGGER IF NOT EXISTS check_product_price
    BEFORE INSERT ON products
    FOR EACH ROW
    WHEN NEW.price <= 0
BEGIN
    SELECT RAISE(ABORT, 'Product price must be positive');
END;

CREATE TRIGGER IF NOT EXISTS check_product_price_update
    BEFORE UPDATE ON products
    FOR EACH ROW
    WHEN NEW.price <= 0
BEGIN
    SELECT RAISE(ABORT, 'Product price must be positive');
END;

-- 确保订单数量为正数
CREATE TRIGGER IF NOT EXISTS check_order_quantity
    BEFORE INSERT ON orders
    FOR EACH ROW
    WHEN NEW.quantity <= 0
BEGIN
    SELECT RAISE(ABORT, 'Order quantity must be positive');
END;

CREATE TRIGGER IF NOT EXISTS check_order_quantity_update
    BEFORE UPDATE ON orders
    FOR EACH ROW
    WHEN NEW.quantity <= 0
BEGIN
    SELECT RAISE(ABORT, 'Order quantity must be positive');
END;

-- 创建全文搜索索引（如果需要）
-- SQLite FTS5 扩展
-- CREATE VIRTUAL TABLE IF NOT EXISTS students_fts USING fts5(student_id, name, class, content='students', content_rowid='id');
-- CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(name, description, category, content='products', content_rowid='id');

-- 插入示例数据（可选，用于测试）
-- 这些数据在生产环境中应该通过迁移脚本插入

/*
-- 示例学生数据
INSERT OR IGNORE INTO students (student_id, name, class, points_balance) VALUES
('S001', '张三', '三年级一班', 100),
('S002', '李四', '三年级一班', 85),
('S003', '王五', '三年级一班', 120);

-- 示例商品数据
INSERT OR IGNORE INTO products (name, description, price, stock, category) VALUES
('铅笔', '2B铅笔，适合写字画画', 5, 100, '文具'),
('橡皮', '4B橡皮，擦除干净', 3, 50, '文具'),
('笔记本', 'A5笔记本，80页', 15, 30, '文具');

-- 示例积分记录
INSERT OR IGNORE INTO point_records (student_id, points, type, category, description) VALUES
('S001', 10, 'earn', '作业', '按时完成数学作业'),
('S001', -5, 'spend', '兑换', '兑换铅笔'),
('S002', 15, 'earn', '表现', '课堂积极发言'),
('S003', 8, 'earn', '考试', '数学测验优秀');
*/

-- 创建数据库版本信息
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description, is_public) VALUES
('db_version', '1.0.0', 'string', '数据库版本', 0),
('db_created_at', datetime('now'), 'string', '数据库创建时间', 0),
('migration_version', '001', 'string', '迁移版本', 0);

-- 完成初始化
-- PRAGMA user_version = 1;