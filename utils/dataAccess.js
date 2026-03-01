const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * 数据访问层 - SQLite 实现
 * 提供规范化的数据库表结构和直接 SQL 操作
 */
class DataAccess {
    constructor(dataDir = 'data') {
        this._dataDir = dataDir;
        this.backupDir = path.join(dataDir, 'backups');
        this.databasePath = path.join(dataDir, 'database.sqlite');
        this.db = null;
        this.initialized = false;

        // 性能监控
        this.metrics = {
            readCount: 0,
            writeCount: 0,
            averageReadTime: 0,
            averageWriteTime: 0
        };
    }

    get dataDir() {
        return this._dataDir;
    }

    set dataDir(nextDataDir) {
        if (!nextDataDir || nextDataDir === this._dataDir) return;
        this._dataDir = nextDataDir;
        this.backupDir = path.join(nextDataDir, 'backups');
        this.databasePath = path.join(nextDataDir, 'database.sqlite');
        this.initialized = false;
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * 确保数据库初始化
     */
    async ensureDirectories() {
        if (this.initialized) return;

        // 创建目录
        await fs.mkdir(this.dataDir, { recursive: true });
        await fs.mkdir(this.backupDir, { recursive: true });

        // 创建数据库连接
        if (!this.db) {
            this.db = await new Promise((resolve, reject) => {
                const db = new sqlite3.Database(this.databasePath, error => {
                    if (error) reject(error);
                    else resolve(db);
                });
            });
        }

        // 创建表结构
        await this._createTables();

        // 迁移旧数据
        await this._migrateLegacyData();

        this.initialized = true;
    }

    /**
     * 创建数据库表
     */
    async _createTables() {
        // 启用外键约束
        await this._runRaw('PRAGMA foreign_keys = ON');

        // 学生表
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                class TEXT NOT NULL,
                balance INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        `);

        // 积分记录表
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS point_records (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                points INTEGER NOT NULL,
                reason TEXT NOT NULL,
                operator_id TEXT,
                timestamp TEXT NOT NULL,
                type TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `);

        // 商品表
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price INTEGER NOT NULL DEFAULT 0,
                stock INTEGER NOT NULL DEFAULT 0,
                description TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
        `);

        // 订单表
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reserved_at TEXT NOT NULL,
                confirmed_at TEXT,
                cancelled_at TEXT,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);

        // 教师表
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS teachers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'teacher',
                department TEXT DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
        `);

        // 系统配置表
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);

        // 创建索引
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_point_records_student_id ON point_records(student_id)`);
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_point_records_timestamp ON point_records(timestamp)`);
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id)`);
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)`);
    }

    /**
     * 迁移旧的 JSON 数据
     */
    async _migrateLegacyData() {
        // 检查是否已有学生数据
        const row = await this._getRaw('SELECT COUNT(*) as count FROM students');
        if (row && row.count > 0) return;

        const now = new Date().toISOString();
        const jsonFiles = [
            { name: 'students.json', key: 'students' },
            { name: 'points.json', key: 'records' },
            { name: 'products.json', key: 'products' },
            { name: 'orders.json', key: 'orders' },
            { name: 'teachers.json', key: 'teachers' }
        ];

        for (const file of jsonFiles) {
            const filePath = path.join(this.dataDir, file.name);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const data = JSON.parse(content);
                const items = data[file.key] || [];

                for (const item of items) {
                    try {
                        await this._importItem(file.name, item, now);
                    } catch (e) {
                        // 忽略重复键等错误
                    }
                }
                console.log(`迁移 ${file.name} 完成: ${items.length} 条记录`);
            } catch (e) {
                // 文件不存在，忽略
            }
        }
    }

    /**
     * 导入单条数据
     */
    async _importItem(filename, item, now) {
        switch (filename) {
            case 'students.json':
                await this._runRaw(
                    'INSERT INTO students (id, name, class, balance, created_at) VALUES (?, ?, ?, ?, ?)',
                    [item.id, item.name, item.class || '', item.balance || 0, item.createdAt || now]
                );
                break;
            case 'points.json':
                await this._runRaw(
                    'INSERT INTO point_records (id, student_id, points, reason, operator_id, timestamp, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.studentId, item.points, item.reason, item.operatorId || '', item.timestamp, item.type || 'add']
                );
                break;
            case 'products.json':
                await this._runRaw(
                    'INSERT INTO products (id, name, price, stock, description, image_url, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.name, item.price || 0, item.stock || 0, item.description || '', item.imageUrl || '', item.isActive !== false ? 1 : 0, item.createdAt || now]
                );
                break;
            case 'orders.json':
                await this._runRaw(
                    'INSERT INTO orders (id, student_id, product_id, status, reserved_at, confirmed_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.studentId, item.productId, item.status || 'pending', item.reservedAt || now, item.confirmedAt || null, item.cancelledAt || null]
                );
                break;
            case 'teachers.json':
                await this._runRaw(
                    'INSERT INTO teachers (id, name, password, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.name, item.password, item.role || 'teacher', item.department || '', item.isActive !== false ? 1 : 0, item.createdAt || now]
                );
                break;
        }
    }

    // ==================== 基础数据库操作 ====================

    async _runRaw(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (error) {
                if (error) reject(error);
                else resolve(this);
            });
        });
    }

    async _getRaw(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (error, row) => {
                if (error) reject(error);
                else resolve(row || null);
            });
        });
    }

    async _allRaw(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (error, rows) => {
                if (error) reject(error);
                else resolve(rows || []);
            });
        });
    }

    async _run(sql, params = []) {
        await this.ensureDirectories();
        return this._runRaw(sql, params);
    }

    async _get(sql, params = []) {
        await this.ensureDirectories();
        return this._getRaw(sql, params);
    }

    async _all(sql, params = []) {
        await this.ensureDirectories();
        return this._allRaw(sql, params);
    }

    async _count(tableName, whereClause = '', params = []) {
        const sql = `SELECT COUNT(*) as count FROM ${tableName}${whereClause ? ' WHERE ' + whereClause : ''}`;
        const row = await this._get(sql, params);
        return row ? row.count : 0;
    }

    // ==================== 学生操作 ====================

    async getAllStudents() {
        const rows = await this._all('SELECT * FROM students ORDER BY id ASC');
        return rows.map(row => this._rowToStudent(row));
    }

    async getStudentById(id) {
        const row = await this._get('SELECT * FROM students WHERE id = ?', [id]);
        return row ? this._rowToStudent(row) : null;
    }

    async createStudent(data) {
        const now = new Date().toISOString();
        await this._run(
            'INSERT INTO students (id, name, class, balance, created_at) VALUES (?, ?, ?, ?, ?)',
            [data.id, data.name, data.class, data.balance || 0, data.createdAt || now]
        );
        return this.getStudentById(data.id);
    }

    async updateStudent(id, updateData) {
        const fields = [];
        const values = [];
        ['name', 'class', 'balance'].forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });
        if (fields.length === 0) return this.getStudentById(id);
        values.push(id);
        await this._run(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getStudentById(id);
    }

    async deleteStudent(id) {
        await this._run('DELETE FROM students WHERE id = ?', [id]);
        return true;
    }

    async searchStudents(keyword) {
        const searchTerm = `%${keyword.toLowerCase()}%`;
        const rows = await this._all(
            'SELECT * FROM students WHERE LOWER(id) LIKE ? OR LOWER(name) LIKE ? ORDER BY id ASC',
            [searchTerm, searchTerm]
        );
        return rows.map(row => this._rowToStudent(row));
    }

    async getStudentsByClass(className) {
        const rows = await this._all('SELECT * FROM students WHERE class = ? ORDER BY id ASC', [className]);
        return rows.map(row => this._rowToStudent(row));
    }

    _rowToStudent(row) {
        return {
            id: row.id,
            name: row.name,
            class: row.class,
            balance: row.balance,
            createdAt: row.created_at
        };
    }

    // ==================== 积分记录操作 ====================

    async getAllPointRecords() {
        const rows = await this._all('SELECT * FROM point_records ORDER BY timestamp DESC');
        return rows.map(row => this._rowToPointRecord(row));
    }

    async getPointRecordsByStudent(studentId, limit = null) {
        let sql = 'SELECT * FROM point_records WHERE student_id = ? ORDER BY timestamp DESC';
        if (limit) sql += ` LIMIT ${parseInt(limit)}`;
        const rows = await this._all(sql, [studentId]);
        return rows.map(row => this._rowToPointRecord(row));
    }

    async getPointRecordsByDateRange(startDate, endDate, studentId = null) {
        let sql = 'SELECT * FROM point_records WHERE timestamp >= ? AND timestamp <= ?';
        const params = [startDate, endDate];
        if (studentId) {
            sql += ' AND student_id = ?';
            params.push(studentId);
        }
        sql += ' ORDER BY timestamp DESC';
        const rows = await this._all(sql, params);
        return rows.map(row => this._rowToPointRecord(row));
    }

    async createPointRecord(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('point');
        await this._run(
            'INSERT INTO point_records (id, student_id, points, reason, operator_id, timestamp, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, data.studentId, data.points, data.reason, data.operatorId || '', data.timestamp || now, data.type || 'add']
        );
        return {
            id,
            studentId: data.studentId,
            points: data.points,
            reason: data.reason,
            operatorId: data.operatorId || '',
            timestamp: data.timestamp || now,
            type: data.type || 'add'
        };
    }

    _rowToPointRecord(row) {
        return {
            id: row.id,
            studentId: row.student_id,
            points: row.points,
            reason: row.reason,
            operatorId: row.operator_id,
            timestamp: row.timestamp,
            type: row.type
        };
    }

    // ==================== 商品操作 ====================

    async getAllProducts(activeOnly = false) {
        let sql = 'SELECT * FROM products';
        if (activeOnly) sql += ' WHERE is_active = 1';
        sql += ' ORDER BY created_at DESC';
        const rows = await this._all(sql);
        return rows.map(row => this._rowToProduct(row));
    }

    async getProductById(id) {
        const row = await this._get('SELECT * FROM products WHERE id = ?', [id]);
        return row ? this._rowToProduct(row) : null;
    }

    async createProduct(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('prod');
        await this._run(
            'INSERT INTO products (id, name, price, stock, description, image_url, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, data.name, data.price || 0, data.stock || 0, data.description || '', data.imageUrl || '', data.isActive !== false ? 1 : 0, data.createdAt || now]
        );
        return this.getProductById(id);
    }

    async updateProduct(id, updateData) {
        const fields = [];
        const values = [];
        const fieldMap = { name: 'name', price: 'price', stock: 'stock', description: 'description', imageUrl: 'image_url', isActive: 'is_active' };
        for (const [key, dbField] of Object.entries(fieldMap)) {
            if (updateData[key] !== undefined) {
                fields.push(`${dbField} = ?`);
                values.push(key === 'isActive' ? (updateData[key] ? 1 : 0) : updateData[key]);
            }
        }
        if (fields.length === 0) return this.getProductById(id);
        values.push(id);
        await this._run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getProductById(id);
    }

    async deleteProduct(id) {
        await this._run('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
        return true;
    }

    async reduceProductStock(id, quantity = 1) {
        await this._run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [quantity, id, quantity]);
        return this.getProductById(id);
    }

    async increaseProductStock(id, quantity = 1) {
        await this._run('UPDATE products SET stock = stock + ? WHERE id = ?', [quantity, id]);
        return this.getProductById(id);
    }

    _rowToProduct(row) {
        return {
            id: row.id,
            name: row.name,
            price: row.price,
            stock: row.stock,
            description: row.description,
            imageUrl: row.image_url,
            isActive: row.is_active === 1,
            createdAt: row.created_at
        };
    }

    // ==================== 订单操作 ====================

    async getAllOrders(status = null) {
        let sql = 'SELECT * FROM orders';
        const params = [];
        if (status) {
            sql += ' WHERE status = ?';
            params.push(status);
        }
        sql += ' ORDER BY reserved_at DESC';
        const rows = await this._all(sql, params);
        return rows.map(row => this._rowToOrder(row));
    }

    async getOrderById(id) {
        const row = await this._get('SELECT * FROM orders WHERE id = ?', [id]);
        return row ? this._rowToOrder(row) : null;
    }

    async getOrdersByStudentId(studentId, status = null) {
        let sql = 'SELECT * FROM orders WHERE student_id = ?';
        const params = [studentId];
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        sql += ' ORDER BY reserved_at DESC';
        const rows = await this._all(sql, params);
        return rows.map(row => this._rowToOrder(row));
    }

    async createOrder(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('order');
        await this._run(
            'INSERT INTO orders (id, student_id, product_id, status, reserved_at, confirmed_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, data.studentId, data.productId, data.status || 'pending', data.reservedAt || now, data.confirmedAt || null, data.cancelledAt || null]
        );
        return this.getOrderById(id);
    }

    async updateOrderStatus(id, status, confirmedAt = null, cancelledAt = null) {
        const now = new Date().toISOString();
        if (status === 'confirmed') {
            await this._run('UPDATE orders SET status = ?, confirmed_at = ? WHERE id = ?', [status, confirmedAt || now, id]);
        } else if (status === 'cancelled') {
            await this._run('UPDATE orders SET status = ?, cancelled_at = ? WHERE id = ?', [status, cancelledAt || now, id]);
        } else {
            await this._run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        }
        return this.getOrderById(id);
    }

    _rowToOrder(row) {
        return {
            id: row.id,
            studentId: row.student_id,
            productId: row.product_id,
            status: row.status,
            reservedAt: row.reserved_at,
            confirmedAt: row.confirmed_at,
            cancelledAt: row.cancelled_at
        };
    }

    // ==================== 教师操作 ====================

    async getAllTeachers() {
        const rows = await this._all('SELECT * FROM teachers ORDER BY id ASC');
        return rows.map(row => this._rowToTeacher(row));
    }

    async getTeacherById(id) {
        const row = await this._get('SELECT * FROM teachers WHERE id = ?', [id]);
        return row ? this._rowToTeacher(row) : null;
    }

    async createTeacher(data) {
        const now = new Date().toISOString();
        await this._run(
            'INSERT INTO teachers (id, name, password, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data.id, data.name, data.password, data.role || 'teacher', data.department || '', data.isActive !== false ? 1 : 0, data.createdAt || now]
        );
        return this.getTeacherById(data.id);
    }

    async updateTeacher(id, updateData) {
        const fields = [];
        const values = [];
        const fieldMap = { name: 'name', password: 'password', role: 'role', department: 'department', isActive: 'is_active' };
        for (const [key, dbField] of Object.entries(fieldMap)) {
            if (updateData[key] !== undefined) {
                fields.push(`${dbField} = ?`);
                values.push(key === 'isActive' ? (updateData[key] ? 1 : 0) : updateData[key]);
            }
        }
        if (fields.length === 0) return this.getTeacherById(id);
        values.push(id);
        await this._run(`UPDATE teachers SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getTeacherById(id);
    }

    async deleteTeacher(id) {
        await this._run('UPDATE teachers SET is_active = 0 WHERE id = ?', [id]);
        return true;
    }

    _rowToTeacher(row) {
        return {
            id: row.id,
            name: row.name,
            password: row.password,
            role: row.role,
            department: row.department,
            isActive: row.is_active === 1,
            createdAt: row.created_at
        };
    }

    // ==================== 配置操作 ====================

    async getConfig(key, defaultValue = null) {
        const row = await this._get('SELECT value FROM system_config WHERE key = ?', [key]);
        if (!row) return defaultValue;
        try { return JSON.parse(row.value); }
        catch { return row.value; }
    }

    async setConfig(key, value) {
        const now = new Date().toISOString();
        const jsonValue = JSON.stringify(value);
        await this._run(
            'INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?, ?, ?)',
            [key, jsonValue, now]
        );
    }

    async getAllConfig() {
        const rows = await this._all('SELECT key, value FROM system_config');
        const config = {};
        for (const row of rows) {
            try { config[row.key] = JSON.parse(row.value); }
            catch { config[row.key] = row.value; }
        }
        return config;
    }

    // ==================== 工具方法 ====================

    _generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getPerformanceMetrics() {
        return { ...this.metrics, cacheSize: 0, queueSize: 0 };
    }

    async getDatabaseStats() {
        return {
            students: await this._count('students'),
            pointRecords: await this._count('point_records'),
            products: await this._count('products'),
            activeProducts: await this._count('products', 'is_active = 1'),
            orders: await this._count('orders'),
            pendingOrders: await this._count('orders', 'status = ?', ['pending']),
            teachers: await this._count('teachers'),
            activeTeachers: await this._count('teachers', 'is_active = 1')
        };
    }

    async createBackup(filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, filename || `database_${timestamp}.backup`);
        return new Promise((resolve, reject) => {
            const backupDb = new sqlite3.Database(backupPath, (error) => {
                if (error) return reject(error);
                this.db.backup(backupDb, (error) => {
                    if (error) reject(error);
                    else { console.log(`数据库备份成功: ${backupPath}`); resolve(backupPath); }
                    backupDb.close();
                });
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((error) => {
                    if (error) reject(error);
                    else { this.db = null; this.initialized = false; resolve(); }
                });
            });
        }
    }
}

module.exports = DataAccess;
