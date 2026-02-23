const { sqliteConnection } = require('./sqliteConnection');

/**
 * SQLite数据库初始化器
 * 创建所有必要的表结构和索引
 */
class SQLiteInitializer {
    constructor() {
        this.initialized = false;
    }

    /**
     * 初始化数据库 - 创建所有表结构
     */
    async initializeDatabase() {
        if (this.initialized) {
            console.log('数据库已经初始化，跳过');
            return;
        }

        try {
            // 连接数据库
            await sqliteConnection.connect();
            
            console.log('开始创建数据库表结构...');
            
            // 创建所有表
            await this.createStudentsTable();
            await this.createTeachersTable();
            await this.createPointsTable();
            await this.createProductsTable();
            await this.createOrdersTable();
            await this.createSystemConfigTable();
            
            console.log('数据库表结构创建完成');
            this.initialized = true;
            
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 创建学生表
     * @private
     */
    createStudentsTable() {
        // 创建学生表
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                class TEXT NOT NULL,
                studentId TEXT UNIQUE NOT NULL,
                totalPoints INTEGER DEFAULT 0,
                balance INTEGER DEFAULT 0,
                isActive INTEGER DEFAULT 1,
                avatar TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        sqliteConnection.run(createTableSQL);
        console.log('学生表创建完成');
        
        // 检查并添加 isActive 字段（如果不存在）
        try {
            const tableInfo = sqliteConnection.all("PRAGMA table_info(students)");
            const hasIsActiveField = tableInfo.some(column => column.name === 'isActive');
            
            if (!hasIsActiveField) {
                console.log('检测到学生表缺少 isActive 字段，正在添加...');
                sqliteConnection.run('ALTER TABLE students ADD COLUMN isActive INTEGER DEFAULT 1');
                console.log('学生表 isActive 字段添加完成');
            }
        } catch (error) {
            console.log('检查学生表字段时出错:', error.message);
        }
        
        // 创建索引
        try {
            sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_students_studentId ON students(studentId)');
            
            // 只有在 isActive 字段存在时才创建索引
            const tableInfo = sqliteConnection.all("PRAGMA table_info(students)");
            const hasIsActiveField = tableInfo.some(column => column.name === 'isActive');
            if (hasIsActiveField) {
                sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_students_isActive ON students(isActive)');
            }
            
            console.log('学生表索引创建完成');
        } catch (error) {
            console.log('创建学生表索引时出错:', error.message);
        }
    }

    /**
     * 创建教师表
     * @private
     */
    createTeachersTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS teachers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'teacher',
                department TEXT,
                avatar TEXT,
                isActive INTEGER DEFAULT 1,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        sqliteConnection.run(createTableSQL);
        console.log('教师表创建完成');
    }

    /**
     * 创建积分记录表
     * @private
     */
    createPointsTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS points (
                id TEXT PRIMARY KEY,
                studentId TEXT NOT NULL,
                points INTEGER NOT NULL,
                reason TEXT NOT NULL,
                type TEXT NOT NULL,
                teacherId TEXT,
                createdBy TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (studentId) REFERENCES students(studentId)
            )
        `;
        
        sqliteConnection.run(createTableSQL);
        sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_points_studentId ON points(studentId)');
        sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_points_createdAt ON points(createdAt)');
        
        console.log('积分记录表创建完成');
    }

    /**
     * 创建商品表
     * @private
     */
    createProductsTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                price INTEGER NOT NULL,
                stock INTEGER DEFAULT 0,
                image TEXT,
                category TEXT,
                isActive INTEGER DEFAULT 1,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        sqliteConnection.run(createTableSQL);
        sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
        sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)');
        
        console.log('商品表创建完成');
    }

    /**
     * 创建订单表
     * @private
     */
    createOrdersTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                studentId TEXT NOT NULL,
                productId TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                totalPrice INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                reservedAt TEXT,
                confirmedAt TEXT,
                cancelledAt TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        sqliteConnection.run(createTableSQL);
        sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_orders_studentId ON orders(studentId)');
        sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
        
        console.log('订单表创建完成');
    }

    /**
     * 创建系统配置表
     * @private
     */
    createSystemConfigTable() {
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS system_config (
                id TEXT PRIMARY KEY,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                description TEXT,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
                updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        sqliteConnection.run(createTableSQL);
        sqliteConnection.run('CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key)');
        
        console.log('系统配置表创建完成');
    }

    /**
     * 插入默认系统配置
     */
    async insertDefaultConfig() {
        const defaultConfigs = [
            {
                key: 'systemName',
                value: '班级积分管理系统',
                description: '系统名称',
                updatedAt: new Date().toISOString()
            },
            {
                key: 'pointsName',
                value: '积分',
                description: '积分名称',
                updatedAt: new Date().toISOString()
            },
            {
                key: 'allowNegative',
                value: 'true',
                description: '是否允许负积分',
                updatedAt: new Date().toISOString()
            }
        ];

        for (const config of defaultConfigs) {
            const exists = sqliteConnection.get(
                'SELECT key FROM system_config WHERE key = ?',
                [config.key]
            );
            
            if (!exists) {
                sqliteConnection.run(
                    'INSERT INTO system_config (id, key, value, description, updatedAt) VALUES (?, ?, ?, ?, ?)',
                    [`config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, config.key, config.value, config.description, config.updatedAt]
                );
            }
        }
        
        console.log('默认系统配置插入完成');
    }

    /**
     * 获取数据库状态
     */
    async getDatabaseStatus() {
        try {
            // 获取表信息
            const tables = sqliteConnection.all(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            );
            
            return {
                connected: sqliteConnection.isConnected,
                version: '3.x',
                path: sqliteConnection.dbPath,
                tables: tables.map(t => t.name),
                initialized: this.initialized
            };
        } catch (error) {
            console.error('获取数据库状态失败:', error);
            return {
                connected: false,
                error: error.message
            };
        }
    }
}

// 创建全局单例实例
const sqliteInitializer = new SQLiteInitializer();

module.exports = {
    SQLiteInitializer,
    sqliteInitializer
};