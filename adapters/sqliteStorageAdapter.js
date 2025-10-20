/**
 * SQLite存储适配器
 * 
 * 功能：
 * - 基于SQLite数据库的数据存储实现
 * - 支持事务和数据一致性
 * - 兼容现有的存储适配器接口
 * - 适合本地部署的单班级系统
 */

const { StorageAdapter, PointFilter, OrderFilter } = require('./storageAdapter');
const { createError } = require('../middleware/errorHandler');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

class SQLiteStorageAdapter extends StorageAdapter {
    constructor(config = {}) {
        super(config);
        this.dbPath = config.database || path.join(process.cwd(), 'data', 'classroom_points.db');
        this.db = null;
        this.enableWAL = config.enableWAL !== false;
        this.currentTransaction = null;
    }

    /**
     * 连接数据库
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                // 确保数据目录存在
                const dbDir = path.dirname(this.dbPath);
                fs.mkdir(dbDir, { recursive: true }).then(() => {
                    this.db = new sqlite3.Database(this.dbPath, (err) => {
                        if (err) {
                            console.error('SQLite连接失败:', err);
                            reject(createError('DATABASE_ERROR', `SQLite连接失败: ${err.message}`));
                        } else {
                            console.log(`SQLite数据库已连接: ${this.dbPath}`);
                            this.isConnected = true;
                            
                            // 启用WAL模式以提高并发性能
                            if (this.enableWAL) {
                                this.db.run('PRAGMA journal_mode = WAL;');
                            }
                            
                            // 启用外键约束
                            this.db.run('PRAGMA foreign_keys = ON;');
                            
                            resolve(true);
                        }
                    });
                }).catch(reject);
            } catch (error) {
                reject(createError('DATABASE_ERROR', `SQLite初始化失败: ${error.message}`));
            }
        });
    }

    /**
     * 断开连接
     */
    async disconnect() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('SQLite关闭失败:', err);
                    } else {
                        console.log('SQLite数据库连接已关闭');
                    }
                    this.isConnected = false;
                    resolve(true);
                });
            } else {
                resolve(true);
            }
        });
    }

    /**
     * 开始事务
     */
    async beginTransaction() {
        return new Promise((resolve, reject) => {
            this.db.run('BEGIN TRANSACTION', (err) => {
                if (err) {
                    reject(createError('DATABASE_ERROR', `开始事务失败: ${err.message}`));
                } else {
                    this.currentTransaction = true;
                    resolve(true);
                }
            });
        });
    }

    /**
     * 提交事务
     */
    async commitTransaction() {
        return new Promise((resolve, reject) => {
            this.db.run('COMMIT', (err) => {
                if (err) {
                    reject(createError('DATABASE_ERROR', `提交事务失败: ${err.message}`));
                } else {
                    this.currentTransaction = null;
                    resolve(true);
                }
            });
        });
    }

    /**
     * 回滚事务
     */
    async rollbackTransaction() {
        return new Promise((resolve, reject) => {
            this.db.run('ROLLBACK', (err) => {
                if (err) {
                    reject(createError('DATABASE_ERROR', `回滚事务失败: ${err.message}`));
                } else {
                    this.currentTransaction = null;
                    resolve(true);
                }
            });
        });
    }

    /**
     * 执行SQL查询
     */
    async query(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('SQL查询失败:', err, 'SQL:', sql, 'Params:', params);
                    reject(createError('DATABASE_ERROR', `查询失败: ${err.message}`));
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * 执行SQL命令（INSERT, UPDATE, DELETE）
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('SQL执行失败:', err, 'SQL:', sql, 'Params:', params);
                    reject(createError('DATABASE_ERROR', `执行失败: ${err.message}`));
                } else {
                    resolve({
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            });
        });
    }

    /**
     * 获取单行数据
     */
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('SQL查询失败:', err, 'SQL:', sql, 'Params:', params);
                    reject(createError('DATABASE_ERROR', `查询失败: ${err.message}`));
                } else {
                    resolve(row);
                }
            });
        });
    }

    // ==================== 学生管理 ====================
    
    async getStudents(classId, filters = {}) {
        let sql = 'SELECT * FROM users WHERE role = ? AND class_id = ?';
        const params = ['student', classId];
        
        if (filters.isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }
        
        if (filters.search) {
            sql += ' AND (name LIKE ? OR student_number LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        sql += ' ORDER BY student_number ASC';
        
        const rows = await this.query(sql, params);
        return rows.map(row => this.mapUserRow(row));
    }

    async getStudentById(classId, studentId) {
        const sql = 'SELECT * FROM users WHERE id = ? AND class_id = ? AND role = ?';
        const row = await this.get(sql, [studentId, classId, 'student']);
        return row ? this.mapUserRow(row) : null;
    }

    async getStudentByNumber(classId, studentNumber) {
        const sql = 'SELECT * FROM users WHERE student_number = ? AND class_id = ? AND role = ?';
        const row = await this.get(sql, [studentNumber, classId, 'student']);
        return row ? this.mapUserRow(row) : null;
    }

    async createStudent(classId, studentData) {
        // 检查学号是否已存在
        const existing = await this.getStudentByNumber(classId, studentData.classStudentNumber || studentData.studentNumber);
        if (existing) {
            throw createError('DUPLICATE_RESOURCE', '学号已存在');
        }

        const id = studentData.id || `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO users (id, class_id, username, name, role, student_number, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id,
            classId,
            studentData.username || studentData.classStudentNumber || studentData.studentNumber,
            studentData.name,
            'student',
            studentData.classStudentNumber || studentData.studentNumber,
            1,
            new Date().toISOString()
        ];

        await this.run(sql, params);
        return await this.getStudentById(classId, id);
    }

    async updateStudent(classId, studentId, updates) {
        const student = await this.getStudentById(classId, studentId);
        if (!student) {
            throw createError('STUDENT_NOT_FOUND', '学生不存在');
        }

        const fields = [];
        const params = [];
        
        if (updates.name !== undefined) {
            fields.push('name = ?');
            params.push(updates.name);
        }
        
        if (updates.studentNumber !== undefined) {
            fields.push('student_number = ?');
            params.push(updates.studentNumber);
        }
        
        if (updates.isActive !== undefined) {
            fields.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }
        
        if (fields.length === 0) {
            return student;
        }
        
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(studentId, classId);

        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND class_id = ?`;
        await this.run(sql, params);
        
        return await this.getStudentById(classId, studentId);
    }

    async deleteStudent(classId, studentId) {
        const sql = 'DELETE FROM users WHERE id = ? AND class_id = ? AND role = ?';
        const result = await this.run(sql, [studentId, classId, 'student']);
        return result.changes > 0;
    }

    // ==================== 积分管理 ====================
    
    async getPointRecords(classId, filters = {}) {
        let sql = 'SELECT * FROM point_records WHERE class_id = ?';
        const params = [classId];
        
        if (filters.studentId) {
            sql += ' AND student_id = ?';
            params.push(filters.studentId);
        }
        
        if (filters.teacherId) {
            sql += ' AND teacher_id = ?';
            params.push(filters.teacherId);
        }
        
        if (filters.type) {
            sql += ' AND type = ?';
            params.push(filters.type);
        }
        
        if (filters.startDate) {
            sql += ' AND created_at >= ?';
            params.push(filters.startDate);
        }
        
        if (filters.endDate) {
            sql += ' AND created_at <= ?';
            params.push(filters.endDate);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }
        
        const rows = await this.query(sql, params);
        return rows.map(row => this.mapPointRecordRow(row));
    }

    async createPointRecord(classId, recordData) {
        const id = recordData.id || `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO point_records (id, class_id, student_id, teacher_id, amount, reason, type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id,
            classId,
            recordData.studentId,
            recordData.teacherId,
            recordData.amount,
            recordData.reason,
            recordData.type || 'manual',
            new Date().toISOString()
        ];

        await this.run(sql, params);
        return await this.get('SELECT * FROM point_records WHERE id = ?', [id]).then(row => this.mapPointRecordRow(row));
    }

    async calculatePointBalance(classId, studentId) {
        const sql = 'SELECT COALESCE(SUM(amount), 0) as balance FROM point_records WHERE class_id = ? AND student_id = ?';
        const row = await this.get(sql, [classId, studentId]);
        return row ? row.balance : 0;
    }

    async getPointRanking(classId, type = 'total', limit = 50) {
        const students = await this.getStudents(classId, { isActive: true });
        const rankings = [];

        for (const student of students) {
            let points = 0;
            
            if (type === 'total') {
                points = await this.calculatePointBalance(classId, student.id);
            } else if (type === 'daily') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const records = await this.getPointRecords(classId, {
                    studentId: student.id,
                    startDate: today.toISOString()
                });
                points = records.reduce((sum, record) => sum + record.amount, 0);
            } else if (type === 'weekly') {
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);
                const records = await this.getPointRecords(classId, {
                    studentId: student.id,
                    startDate: weekStart.toISOString()
                });
                points = records.reduce((sum, record) => sum + record.amount, 0);
            }

            rankings.push({
                student,
                points,
                rank: 0
            });
        }

        rankings.sort((a, b) => b.points - a.points);
        rankings.forEach((item, index) => {
            item.rank = index + 1;
        });

        return rankings.slice(0, limit);
    }

    async batchPointOperations(classId, operations) {
        const results = [];
        
        try {
            await this.beginTransaction();
            
            for (const operation of operations) {
                const record = await this.createPointRecord(classId, operation);
                results.push(record);
            }
            
            await this.commitTransaction();
            return results;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    async resetAllPoints(classId, teacherId, reason) {
        const students = await this.getStudents(classId, { isActive: true });
        const operations = [];

        for (const student of students) {
            const currentBalance = await this.calculatePointBalance(classId, student.id);
            if (currentBalance !== 0) {
                operations.push({
                    studentId: student.id,
                    teacherId,
                    amount: -currentBalance,
                    reason: `积分清零: ${reason}`,
                    type: 'manual'
                });
            }
        }

        return await this.batchPointOperations(classId, operations);
    }

    // ==================== 商品管理 ====================
    
    async getProducts(classId, filters = {}) {
        let sql = 'SELECT * FROM products WHERE class_id = ?';
        const params = [classId];
        
        if (filters.isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }
        
        if (filters.search) {
            sql += ' AND (name LIKE ? OR description LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const rows = await this.query(sql, params);
        return rows.map(row => this.mapProductRow(row));
    }

    async getProductById(classId, productId) {
        const sql = 'SELECT * FROM products WHERE id = ? AND class_id = ?';
        const row = await this.get(sql, [productId, classId]);
        return row ? this.mapProductRow(row) : null;
    }

    async createProduct(classId, productData) {
        const id = productData.id || `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO products (id, class_id, name, description, price, stock, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id,
            classId,
            productData.name,
            productData.description || '',
            productData.price,
            productData.stock || 0,
            productData.isActive !== false ? 1 : 0,
            new Date().toISOString()
        ];

        await this.run(sql, params);
        return await this.getProductById(classId, id);
    }

    async updateProduct(classId, productId, updates) {
        const product = await this.getProductById(classId, productId);
        if (!product) {
            throw createError('PRODUCT_NOT_FOUND', '商品不存在');
        }

        const fields = [];
        const params = [];
        
        if (updates.name !== undefined) {
            fields.push('name = ?');
            params.push(updates.name);
        }
        
        if (updates.description !== undefined) {
            fields.push('description = ?');
            params.push(updates.description);
        }
        
        if (updates.price !== undefined) {
            fields.push('price = ?');
            params.push(updates.price);
        }
        
        if (updates.stock !== undefined) {
            fields.push('stock = ?');
            params.push(updates.stock);
        }
        
        if (updates.isActive !== undefined) {
            fields.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }
        
        if (fields.length === 0) {
            return product;
        }
        
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(productId, classId);

        const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ? AND class_id = ?`;
        await this.run(sql, params);
        
        return await this.getProductById(classId, productId);
    }

    async deleteProduct(classId, productId) {
        const sql = 'DELETE FROM products WHERE id = ? AND class_id = ?';
        const result = await this.run(sql, [productId, classId]);
        return result.changes > 0;
    }

    async updateProductStock(classId, productId, stockChange) {
        const product = await this.getProductById(classId, productId);
        if (!product) {
            throw createError('PRODUCT_NOT_FOUND', '商品不存在');
        }

        const newStock = product.stock + stockChange;
        if (newStock < 0) {
            throw createError('PRODUCT_OUT_OF_STOCK', '库存不足');
        }

        return await this.updateProduct(classId, productId, { stock: newStock });
    }

    // ==================== 预约管理 ====================
    
    async getOrders(classId, filters = {}) {
        let sql = 'SELECT * FROM orders WHERE class_id = ?';
        const params = [classId];
        
        if (filters.studentId) {
            sql += ' AND student_id = ?';
            params.push(filters.studentId);
        }
        
        if (filters.productId) {
            sql += ' AND product_id = ?';
            params.push(filters.productId);
        }
        
        if (filters.status) {
            sql += ' AND status = ?';
            params.push(filters.status);
        }
        
        if (filters.startDate) {
            sql += ' AND created_at >= ?';
            params.push(filters.startDate);
        }
        
        if (filters.endDate) {
            sql += ' AND created_at <= ?';
            params.push(filters.endDate);
        }
        
        sql += ' ORDER BY created_at DESC';
        
        const rows = await this.query(sql, params);
        return rows.map(row => this.mapOrderRow(row));
    }

    async getOrderById(classId, orderId) {
        const sql = 'SELECT * FROM orders WHERE id = ? AND class_id = ?';
        const row = await this.get(sql, [orderId, classId]);
        return row ? this.mapOrderRow(row) : null;
    }

    async createOrder(classId, orderData) {
        const id = orderData.id || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO orders (id, class_id, student_id, product_id, quantity, total_price, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id,
            classId,
            orderData.studentId,
            orderData.productId,
            orderData.quantity || 1,
            orderData.totalPrice,
            'pending',
            new Date().toISOString()
        ];

        await this.run(sql, params);
        return await this.getOrderById(classId, id);
    }

    async updateOrderStatus(classId, orderId, status, updatedBy) {
        const order = await this.getOrderById(classId, orderId);
        if (!order) {
            throw createError('ORDER_NOT_FOUND', '订单不存在');
        }

        const fields = ['status = ?', 'updated_at = ?'];
        const params = [status, new Date().toISOString()];
        
        if (status === 'confirmed') {
            fields.push('confirmed_at = ?');
            params.push(new Date().toISOString());
        } else if (status === 'completed') {
            fields.push('completed_at = ?');
            params.push(new Date().toISOString());
        }
        
        params.push(orderId, classId);

        const sql = `UPDATE orders SET ${fields.join(', ')} WHERE id = ? AND class_id = ?`;
        await this.run(sql, params);
        
        return await this.getOrderById(classId, orderId);
    }

    async cancelOrder(classId, orderId, reason) {
        return await this.updateOrderStatus(classId, orderId, 'cancelled', null);
    }

    // ==================== 奖惩项管理 ====================
    
    async getRewardPenaltyItems(classId) {
        const sql = 'SELECT * FROM reward_penalty_items WHERE class_id = ? AND is_active = 1 ORDER BY sort_order ASC';
        const rows = await this.query(sql, [classId]);
        return rows.map(row => this.mapRewardPenaltyItemRow(row));
    }

    async createRewardPenaltyItem(classId, itemData) {
        const id = itemData.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO reward_penalty_items (id, class_id, name, points, type, is_active, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id,
            classId,
            itemData.name,
            itemData.points,
            itemData.type,
            1,
            itemData.sortOrder || 0
        ];

        await this.run(sql, params);
        return await this.get('SELECT * FROM reward_penalty_items WHERE id = ?', [id]).then(row => this.mapRewardPenaltyItemRow(row));
    }

    async updateRewardPenaltyItem(classId, itemId, updates) {
        const item = await this.get('SELECT * FROM reward_penalty_items WHERE id = ? AND class_id = ?', [itemId, classId]);
        if (!item) {
            throw createError('RESOURCE_NOT_FOUND', '奖惩项不存在');
        }

        const fields = [];
        const params = [];
        
        if (updates.name !== undefined) {
            fields.push('name = ?');
            params.push(updates.name);
        }
        
        if (updates.points !== undefined) {
            fields.push('points = ?');
            params.push(updates.points);
        }
        
        if (updates.type !== undefined) {
            fields.push('type = ?');
            params.push(updates.type);
        }
        
        if (updates.isActive !== undefined) {
            fields.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }
        
        if (updates.sortOrder !== undefined) {
            fields.push('sort_order = ?');
            params.push(updates.sortOrder);
        }
        
        if (fields.length === 0) {
            return this.mapRewardPenaltyItemRow(item);
        }
        
        params.push(itemId, classId);

        const sql = `UPDATE reward_penalty_items SET ${fields.join(', ')} WHERE id = ? AND class_id = ?`;
        await this.run(sql, params);
        
        const updated = await this.get('SELECT * FROM reward_penalty_items WHERE id = ?', [itemId]);
        return this.mapRewardPenaltyItemRow(updated);
    }

    async deleteRewardPenaltyItem(classId, itemId) {
        const sql = 'DELETE FROM reward_penalty_items WHERE id = ? AND class_id = ?';
        const result = await this.run(sql, [itemId, classId]);
        return result.changes > 0;
    }

    // ==================== 用户管理 ====================
    
    async getUsers(classId, filters = {}) {
        let sql = 'SELECT * FROM users WHERE class_id = ?';
        const params = [classId];
        
        if (filters.role) {
            sql += ' AND role = ?';
            params.push(filters.role);
        }
        
        if (filters.isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }
        
        const rows = await this.query(sql, params);
        return rows.map(row => this.mapUserRow(row));
    }

    async getUserById(classId, userId) {
        const sql = 'SELECT * FROM users WHERE id = ? AND class_id = ?';
        const row = await this.get(sql, [userId, classId]);
        return row ? this.mapUserRow(row) : null;
    }

    async getUserByUsername(classId, username) {
        const sql = 'SELECT * FROM users WHERE username = ? AND class_id = ?';
        const row = await this.get(sql, [username, classId]);
        return row ? this.mapUserRow(row) : null;
    }

    async createUser(classId, userData) {
        // 检查用户名是否已存在
        const existing = await this.getUserByUsername(classId, userData.username);
        if (existing) {
            throw createError('DUPLICATE_RESOURCE', '用户名已存在');
        }

        const id = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO users (id, class_id, username, name, role, student_number, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            id,
            classId,
            userData.username,
            userData.name,
            userData.role,
            userData.classStudentNumber || userData.fullStudentNumber || null,
            1,
            new Date().toISOString()
        ];

        await this.run(sql, params);
        return await this.getUserById(classId, id);
    }

    async updateUser(classId, userId, updates) {
        const user = await this.getUserById(classId, userId);
        if (!user) {
            throw createError('RESOURCE_NOT_FOUND', '用户不存在');
        }

        const fields = [];
        const params = [];
        
        if (updates.name !== undefined) {
            fields.push('name = ?');
            params.push(updates.name);
        }
        
        if (updates.username !== undefined) {
            fields.push('username = ?');
            params.push(updates.username);
        }
        
        if (updates.studentNumber !== undefined) {
            fields.push('student_number = ?');
            params.push(updates.studentNumber);
        }
        
        if (updates.isActive !== undefined) {
            fields.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }
        
        if (fields.length === 0) {
            return user;
        }
        
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(userId, classId);

        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ? AND class_id = ?`;
        await this.run(sql, params);
        
        return await this.getUserById(classId, userId);
    }

    async deleteUser(classId, userId) {
        const sql = 'DELETE FROM users WHERE id = ? AND class_id = ?';
        const result = await this.run(sql, [userId, classId]);
        return result.changes > 0;
    }

    // ==================== 统计查询 ====================
    
    async getClassStatistics(classId) {
        const [students, products, orders, pointRecords] = await Promise.all([
            this.getStudents(classId, { isActive: true }),
            this.getProducts(classId, { isActive: true }),
            this.getOrders(classId),
            this.getPointRecords(classId)
        ]);

        const totalPoints = pointRecords.reduce((sum, record) => sum + record.amount, 0);
        const averagePoints = students.length > 0 ? totalPoints / students.length : 0;

        return {
            totalStudents: students.length,
            totalProducts: products.length,
            totalOrders: orders.length,
            totalPointRecords: pointRecords.length,
            totalPoints,
            averagePoints,
            pendingOrders: orders.filter(o => o.status === 'pending').length,
            completedOrders: orders.filter(o => o.status === 'completed').length
        };
    }

    async getStudentPointStatistics(classId, studentId, dateRange = {}) {
        const filters = { studentId };
        if (dateRange.startDate) filters.startDate = dateRange.startDate;
        if (dateRange.endDate) filters.endDate = dateRange.endDate;
        
        const records = await this.getPointRecords(classId, filters);
        
        const statistics = {
            totalRecords: records.length,
            totalPoints: records.reduce((sum, record) => sum + record.amount, 0),
            earnedPoints: records.filter(r => r.amount > 0).reduce((sum, r) => sum + r.amount, 0),
            spentPoints: Math.abs(records.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0)),
            recordsByType: {}
        };

        records.forEach(record => {
            if (!statistics.recordsByType[record.type]) {
                statistics.recordsByType[record.type] = { count: 0, points: 0 };
            }
            statistics.recordsByType[record.type].count++;
            statistics.recordsByType[record.type].points += record.amount;
        });

        return statistics;
    }

    async getProductSalesStatistics(classId, dateRange = {}) {
        const filters = { status: 'completed' };
        if (dateRange.startDate) filters.startDate = dateRange.startDate;
        if (dateRange.endDate) filters.endDate = dateRange.endDate;
        
        const completedOrders = await this.getOrders(classId, filters);
        const products = await this.getProducts(classId);
        
        const salesByProduct = {};
        
        completedOrders.forEach(order => {
            if (!salesByProduct[order.productId]) {
                const product = products.find(p => p.id === order.productId);
                salesByProduct[order.productId] = {
                    productName: product?.name || '未知商品',
                    quantity: 0,
                    totalRevenue: 0
                };
            }
            salesByProduct[order.productId].quantity += order.quantity;
            salesByProduct[order.productId].totalRevenue += order.totalPrice;
        });

        return {
            totalSales: completedOrders.length,
            totalRevenue: completedOrders.reduce((sum, order) => sum + order.totalPrice, 0),
            salesByProduct
        };
    }

    // ==================== 数据备份和恢复 ====================
    
    async exportClassData(classId) {
        const [students, products, orders, pointRecords, users, rewardPenaltyItems] = await Promise.all([
            this.getStudents(classId),
            this.getProducts(classId),
            this.getOrders(classId),
            this.getPointRecords(classId),
            this.getUsers(classId),
            this.getRewardPenaltyItems(classId)
        ]);

        return {
            classId,
            exportTime: new Date().toISOString(),
            data: {
                students,
                products,
                orders,
                pointRecords,
                users,
                rewardPenaltyItems
            }
        };
    }

    async importClassData(classId, data) {
        try {
            await this.beginTransaction();
            
            // 清空现有数据
            await this.run('DELETE FROM users WHERE class_id = ?', [classId]);
            await this.run('DELETE FROM products WHERE class_id = ?', [classId]);
            await this.run('DELETE FROM orders WHERE class_id = ?', [classId]);
            await this.run('DELETE FROM point_records WHERE class_id = ?', [classId]);
            await this.run('DELETE FROM reward_penalty_items WHERE class_id = ?', [classId]);
            
            // 导入新数据
            if (data.students) {
                for (const student of data.students) {
                    await this.createStudent(classId, student);
                }
            }
            
            if (data.products) {
                for (const product of data.products) {
                    await this.createProduct(classId, product);
                }
            }
            
            if (data.orders) {
                for (const order of data.orders) {
                    await this.createOrder(classId, order);
                }
            }
            
            if (data.pointRecords) {
                for (const record of data.pointRecords) {
                    await this.createPointRecord(classId, record);
                }
            }
            
            if (data.rewardPenaltyItems) {
                for (const item of data.rewardPenaltyItems) {
                    await this.createRewardPenaltyItem(classId, item);
                }
            }
            
            await this.commitTransaction();
            return true;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return {
                status: 'healthy',
                message: 'SQLite数据库连接正常',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: `SQLite数据库连接异常: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ==================== 数据映射辅助方法 ====================
    
    mapUserRow(row) {
        return {
            id: row.id,
            classId: row.class_id,
            username: row.username,
            name: row.name,
            role: row.role,
            classStudentNumber: row.student_number,
            fullStudentNumber: row.student_number,
            studentNumber: row.student_number,
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    mapPointRecordRow(row) {
        return {
            id: row.id,
            classId: row.class_id,
            studentId: row.student_id,
            teacherId: row.teacher_id,
            amount: row.amount,
            reason: row.reason,
            type: row.type,
            createdAt: row.created_at
        };
    }

    mapProductRow(row) {
        return {
            id: row.id,
            classId: row.class_id,
            name: row.name,
            description: row.description,
            price: row.price,
            stock: row.stock,
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    mapOrderRow(row) {
        return {
            id: row.id,
            classId: row.class_id,
            studentId: row.student_id,
            productId: row.product_id,
            quantity: row.quantity,
            totalPrice: row.total_price,
            status: row.status,
            createdAt: row.created_at,
            confirmedAt: row.confirmed_at,
            completedAt: row.completed_at,
            updatedAt: row.updated_at
        };
    }

    mapRewardPenaltyItemRow(row) {
        return {
            id: row.id,
            classId: row.class_id,
            name: row.name,
            points: row.points,
            type: row.type,
            isActive: Boolean(row.is_active),
            sortOrder: row.sort_order
        };
    }

    // ==================== 系统状态管理 ====================
    
    async getSystemState(classId = 'default') {
        const sql = 'SELECT * FROM system_state WHERE class_id = ? LIMIT 1';
        const row = await this.get(sql, [classId]);
        
        if (!row) {
            // 如果不存在，创建默认状态
            const defaultState = {
                id: 'default',
                classId,
                mode: 'normal',
                currentTeacher: null,
                sessionStartTime: null,
                lastActivity: new Date().toISOString(),
                isAuthenticated: false,
                autoSwitchHours: 2
            };
            await this.createSystemState(classId, defaultState);
            return defaultState;
        }
        
        return this.mapSystemStateRow(row);
    }

    async updateSystemState(classId = 'default', updates) {
        const fields = [];
        const params = [];
        
        if (updates.mode !== undefined) {
            fields.push('mode = ?');
            params.push(updates.mode);
        }
        
        if (updates.currentTeacher !== undefined) {
            fields.push('current_teacher = ?');
            params.push(updates.currentTeacher);
        }
        
        if (updates.sessionStartTime !== undefined) {
            fields.push('session_start_time = ?');
            params.push(updates.sessionStartTime);
        }
        
        if (updates.lastActivity !== undefined) {
            fields.push('last_activity = ?');
            params.push(updates.lastActivity);
        }
        
        if (updates.isAuthenticated !== undefined) {
            fields.push('is_authenticated = ?');
            params.push(updates.isAuthenticated ? 1 : 0);
        }
        
        if (updates.autoSwitchHours !== undefined) {
            fields.push('auto_switch_hours = ?');
            params.push(updates.autoSwitchHours);
        }
        
        if (fields.length === 0) {
            return await this.getSystemState(classId);
        }
        
        fields.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(classId);

        const sql = `UPDATE system_state SET ${fields.join(', ')} WHERE class_id = ?`;
        await this.run(sql, params);
        
        return await this.getSystemState(classId);
    }

    async createSystemState(classId = 'default', state) {
        const sql = `
            INSERT OR REPLACE INTO system_state 
            (id, class_id, mode, current_teacher, session_start_time, last_activity, is_authenticated, auto_switch_hours, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const now = new Date().toISOString();
        const params = [
            state.id || 'default',
            classId,
            state.mode || 'normal',
            state.currentTeacher || null,
            state.sessionStartTime || null,
            state.lastActivity || now,
            state.isAuthenticated ? 1 : 0,
            state.autoSwitchHours || 2,
            now,
            now
        ];
        
        await this.run(sql, params);
        return await this.getSystemState(classId);
    }

    mapSystemStateRow(row) {
        return {
            id: row.id,
            classId: row.class_id,
            mode: row.mode,
            currentTeacher: row.current_teacher,
            sessionStartTime: row.session_start_time,
            lastActivity: row.last_activity,
            isAuthenticated: Boolean(row.is_authenticated),
            autoSwitchHours: row.auto_switch_hours,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
}

module.exports = SQLiteStorageAdapter;