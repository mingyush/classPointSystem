/**
 * Cloudflare D1存储适配器
 * 
 * 功能：
 * - 基于Cloudflare D1数据库的数据存储实现
 * - 支持Workers运行时环境
 * - 兼容现有的存储适配器接口
 * - 适用于Cloudflare部署场景
 */

const { StorageAdapter } = require('./storageAdapter');
const { createError } = require('../middleware/errorHandler');

class D1StorageAdapter extends StorageAdapter {
    constructor(config = {}) {
        super(config);
        this.db = config.db || config.binding; // D1 database binding
        this.currentTransaction = null;
    }

    /**
     * 连接数据库（D1不需要显式连接）
     */
    async connect() {
        if (!this.db) {
            throw createError('DATABASE_ERROR', 'D1数据库绑定未配置');
        }
        
        this.isConnected = true;
        await this.initializeDatabase();
        return true;
    }

    /**
     * 初始化数据库表结构
     */
    async initializeDatabase() {
        // D1数据库表结构应该在部署时通过wrangler命令初始化
        // 这里只做健康检查
        try {
            await this.db.prepare('SELECT 1').first();
        } catch (error) {
            console.error('D1数据库初始化检查失败:', error);
            throw createError('DATABASE_ERROR', `D1数据库初始化失败: ${error.message}`);
        }
    }

    /**
     * 断开连接（D1不需要显式断开）
     */
    async disconnect() {
        this.isConnected = false;
        return true;
    }

    /**
     * 开始事务
     */
    async beginTransaction() {
        // D1暂不支持显式事务，使用批处理模拟
        this.currentTransaction = [];
        return true;
    }

    /**
     * 提交事务
     */
    async commitTransaction() {
        if (this.currentTransaction && this.currentTransaction.length > 0) {
            try {
                await this.db.batch(this.currentTransaction);
                this.currentTransaction = null;
                return true;
            } catch (error) {
                this.currentTransaction = null;
                throw createError('DATABASE_ERROR', `事务提交失败: ${error.message}`);
            }
        }
        return true;
    }

    /**
     * 回滚事务
     */
    async rollbackTransaction() {
        this.currentTransaction = null;
        return true;
    }

    /**
     * 执行SQL语句
     */
    async runSQL(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql).bind(...params);
            
            if (this.currentTransaction) {
                this.currentTransaction.push(stmt);
                return { success: true };
            } else {
                const result = await stmt.run();
                return result;
            }
        } catch (error) {
            throw createError('DATABASE_ERROR', `SQL执行失败: ${error.message}`);
        }
    }

    /**
     * 查询SQL语句
     */
    async querySQL(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql).bind(...params);
            const result = await stmt.all();
            return result.results || [];
        } catch (error) {
            throw createError('DATABASE_ERROR', `SQL查询失败: ${error.message}`);
        }
    }

    /**
     * 查询单行
     */
    async getSQL(sql, params = []) {
        try {
            const stmt = this.db.prepare(sql).bind(...params);
            const result = await stmt.first();
            return result || null;
        } catch (error) {
            throw createError('DATABASE_ERROR', `SQL查询失败: ${error.message}`);
        }
    }

    // ==================== 学生管理 ====================
    
    async getStudents(classId = 'default', filters = {}) {
        let sql = 'SELECT * FROM users WHERE role = "student"';
        const params = [];

        if (filters.isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }

        if (filters.search) {
            sql += ' AND (name LIKE ? OR student_number LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        sql += ' ORDER BY student_number, name';

        const rows = await this.querySQL(sql, params);
        return rows.map(row => this.mapUserFromDB(row));
    }

    async getStudentById(classId = 'default', studentId) {
        const sql = 'SELECT * FROM users WHERE id = ? AND role = "student"';
        const row = await this.getSQL(sql, [studentId]);
        return row ? this.mapUserFromDB(row) : null;
    }

    async getStudentByNumber(classId = 'default', studentNumber) {
        const sql = 'SELECT * FROM users WHERE student_number = ? AND role = "student"';
        const row = await this.getSQL(sql, [studentNumber]);
        return row ? this.mapUserFromDB(row) : null;
    }

    async createStudent(classId = 'default', studentData) {
        const id = studentData.id || `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO users (id, username, name, role, student_number, is_active, created_at)
            VALUES (?, ?, ?, "student", ?, 1, datetime('now'))
        `;
        
        try {
            await this.runSQL(sql, [
                id,
                studentData.username || studentData.studentNumber,
                studentData.name,
                studentData.studentNumber
            ]);
            
            return await this.getStudentById(classId, id);
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw createError('DUPLICATE_RESOURCE', '学号已存在');
            }
            throw error;
        }
    }

    async updateStudent(classId = 'default', studentId, updates) {
        const setParts = [];
        const params = [];

        if (updates.name) {
            setParts.push('name = ?');
            params.push(updates.name);
        }
        if (updates.studentNumber) {
            setParts.push('student_number = ?');
            params.push(updates.studentNumber);
        }
        if (updates.isActive !== undefined) {
            setParts.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }

        if (setParts.length === 0) {
            throw createError('VALIDATION_ERROR', '没有要更新的字段');
        }

        const sql = `UPDATE users SET ${setParts.join(', ')} WHERE id = ? AND role = "student"`;
        params.push(studentId);

        const result = await this.runSQL(sql, params);
        if (result.changes === 0) {
            throw createError('STUDENT_NOT_FOUND', '学生不存在');
        }

        return await this.getStudentById(classId, studentId);
    }

    async deleteStudent(classId = 'default', studentId) {
        const sql = 'DELETE FROM users WHERE id = ? AND role = "student"';
        const result = await this.runSQL(sql, [studentId]);
        
        if (result.changes === 0) {
            throw createError('STUDENT_NOT_FOUND', '学生不存在');
        }
        
        return true;
    }

    // ==================== 积分管理 ====================
    
    async getPointRecords(classId = 'default', filters = {}) {
        let sql = 'SELECT * FROM point_records WHERE 1=1';
        const params = [];

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

        const rows = await this.querySQL(sql, params);
        return rows.map(row => this.mapPointRecordFromDB(row));
    }

    async createPointRecord(classId = 'default', recordData) {
        const id = recordData.id || `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO point_records (id, student_id, teacher_id, amount, reason, type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        await this.runSQL(sql, [
            id,
            recordData.studentId,
            recordData.teacherId,
            recordData.amount,
            recordData.reason,
            recordData.type || 'manual'
        ]);

        return await this.getPointRecordById(id);
    }

    async getPointRecordById(recordId) {
        const sql = 'SELECT * FROM point_records WHERE id = ?';
        const row = await this.getSQL(sql, [recordId]);
        return row ? this.mapPointRecordFromDB(row) : null;
    }

    async calculatePointBalance(classId = 'default', studentId) {
        const sql = 'SELECT COALESCE(SUM(amount), 0) as balance FROM point_records WHERE student_id = ?';
        const row = await this.getSQL(sql, [studentId]);
        return row ? row.balance : 0;
    }

    async getPointRanking(classId = 'default', type = 'total', limit = 50) {
        let sql = `
            SELECT u.*, COALESCE(SUM(pr.amount), 0) as points
            FROM users u
            LEFT JOIN point_records pr ON u.id = pr.student_id
            WHERE u.role = "student" AND u.is_active = 1
        `;

        if (type === 'daily') {
            sql += ` AND (pr.created_at >= date('now') OR pr.created_at IS NULL)`;
        } else if (type === 'weekly') {
            sql += ` AND (pr.created_at >= date('now', '-7 days') OR pr.created_at IS NULL)`;
        }

        sql += ` GROUP BY u.id ORDER BY points DESC LIMIT ?`;

        const rows = await this.querySQL(sql, [limit]);
        return rows.map((row, index) => ({
            student: this.mapUserFromDB(row),
            points: row.points,
            rank: index + 1
        }));
    }

    async batchPointOperations(classId = 'default', operations) {
        try {
            await this.beginTransaction();
            
            const results = [];
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

    async resetAllPoints(classId = 'default', teacherId, reason) {
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
    
    async getProducts(classId = 'default', filters = {}) {
        let sql = 'SELECT * FROM products WHERE 1=1';
        const params = [];

        if (filters.isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }

        if (filters.search) {
            sql += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        sql += ' ORDER BY name';

        const rows = await this.querySQL(sql, params);
        return rows.map(row => this.mapProductFromDB(row));
    }

    async getProductById(classId = 'default', productId) {
        const sql = 'SELECT * FROM products WHERE id = ?';
        const row = await this.getSQL(sql, [productId]);
        return row ? this.mapProductFromDB(row) : null;
    }

    async createProduct(classId = 'default', productData) {
        const id = productData.id || `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO products (id, name, description, price, stock, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `;

        await this.runSQL(sql, [
            id,
            productData.name,
            productData.description || '',
            productData.price,
            productData.stock || 0,
            productData.isActive !== false ? 1 : 0
        ]);

        return await this.getProductById(classId, id);
    }

    async updateProduct(classId = 'default', productId, updates) {
        const setParts = [];
        const params = [];

        if (updates.name) {
            setParts.push('name = ?');
            params.push(updates.name);
        }
        if (updates.description !== undefined) {
            setParts.push('description = ?');
            params.push(updates.description);
        }
        if (updates.price !== undefined) {
            setParts.push('price = ?');
            params.push(updates.price);
        }
        if (updates.stock !== undefined) {
            setParts.push('stock = ?');
            params.push(updates.stock);
        }
        if (updates.isActive !== undefined) {
            setParts.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }

        if (setParts.length === 0) {
            throw createError('VALIDATION_ERROR', '没有要更新的字段');
        }

        const sql = `UPDATE products SET ${setParts.join(', ')} WHERE id = ?`;
        params.push(productId);

        const result = await this.runSQL(sql, params);
        if (result.changes === 0) {
            throw createError('PRODUCT_NOT_FOUND', '商品不存在');
        }

        return await this.getProductById(classId, productId);
    }

    async deleteProduct(classId = 'default', productId) {
        const sql = 'DELETE FROM products WHERE id = ?';
        const result = await this.runSQL(sql, [productId]);
        
        if (result.changes === 0) {
            throw createError('PRODUCT_NOT_FOUND', '商品不存在');
        }
        
        return true;
    }

    async updateProductStock(classId = 'default', productId, stockChange) {
        const sql = 'UPDATE products SET stock = stock + ? WHERE id = ? AND stock + ? >= 0';
        const result = await this.runSQL(sql, [stockChange, productId, stockChange]);
        
        if (result.changes === 0) {
            const product = await this.getProductById(classId, productId);
            if (!product) {
                throw createError('PRODUCT_NOT_FOUND', '商品不存在');
            } else {
                throw createError('PRODUCT_OUT_OF_STOCK', '库存不足');
            }
        }

        return await this.getProductById(classId, productId);
    }

    // ==================== 预约管理 ====================
    
    async getOrders(classId = 'default', filters = {}) {
        let sql = 'SELECT * FROM orders WHERE 1=1';
        const params = [];

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

        const rows = await this.querySQL(sql, params);
        return rows.map(row => this.mapOrderFromDB(row));
    }

    async getOrderById(classId = 'default', orderId) {
        const sql = 'SELECT * FROM orders WHERE id = ?';
        const row = await this.getSQL(sql, [orderId]);
        return row ? this.mapOrderFromDB(row) : null;
    }

    async createOrder(classId = 'default', orderData) {
        const id = orderData.id || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO orders (id, student_id, product_id, quantity, total_price, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
        `;

        await this.runSQL(sql, [
            id,
            orderData.studentId,
            orderData.productId,
            orderData.quantity || 1,
            orderData.totalPrice
        ]);

        return await this.getOrderById(classId, id);
    }

    async updateOrderStatus(classId = 'default', orderId, status, updatedBy) {
        let sql = 'UPDATE orders SET status = ?';
        const params = [status];

        if (status === 'confirmed') {
            sql += ', confirmed_at = datetime("now")';
        } else if (status === 'completed') {
            sql += ', completed_at = datetime("now")';
        }

        sql += ' WHERE id = ?';
        params.push(orderId);

        const result = await this.runSQL(sql, params);
        if (result.changes === 0) {
            throw createError('ORDER_NOT_FOUND', '订单不存在');
        }

        return await this.getOrderById(classId, orderId);
    }

    async cancelOrder(classId = 'default', orderId, reason) {
        return await this.updateOrderStatus(classId, orderId, 'cancelled', null);
    }

    // ==================== 奖惩项管理 ====================
    
    async getRewardPenaltyItems(classId = 'default') {
        const sql = 'SELECT * FROM reward_penalty_items WHERE is_active = 1 ORDER BY sort_order, name';
        const rows = await this.querySQL(sql);
        return rows.map(row => this.mapRewardPenaltyItemFromDB(row));
    }

    async createRewardPenaltyItem(classId = 'default', itemData) {
        const id = itemData.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO reward_penalty_items (id, name, points, type, is_active, sort_order, created_at)
            VALUES (?, ?, ?, ?, 1, ?, datetime('now'))
        `;

        await this.runSQL(sql, [
            id,
            itemData.name,
            itemData.points,
            itemData.type,
            itemData.sortOrder || 0
        ]);

        return await this.getRewardPenaltyItemById(id);
    }

    async getRewardPenaltyItemById(itemId) {
        const sql = 'SELECT * FROM reward_penalty_items WHERE id = ?';
        const row = await this.getSQL(sql, [itemId]);
        return row ? this.mapRewardPenaltyItemFromDB(row) : null;
    }

    async updateRewardPenaltyItem(classId = 'default', itemId, updates) {
        const setParts = [];
        const params = [];

        if (updates.name) {
            setParts.push('name = ?');
            params.push(updates.name);
        }
        if (updates.points !== undefined) {
            setParts.push('points = ?');
            params.push(updates.points);
        }
        if (updates.type) {
            setParts.push('type = ?');
            params.push(updates.type);
        }
        if (updates.isActive !== undefined) {
            setParts.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }
        if (updates.sortOrder !== undefined) {
            setParts.push('sort_order = ?');
            params.push(updates.sortOrder);
        }

        if (setParts.length === 0) {
            throw createError('VALIDATION_ERROR', '没有要更新的字段');
        }

        const sql = `UPDATE reward_penalty_items SET ${setParts.join(', ')} WHERE id = ?`;
        params.push(itemId);

        const result = await this.runSQL(sql, params);
        if (result.changes === 0) {
            throw createError('RESOURCE_NOT_FOUND', '奖惩项不存在');
        }

        return await this.getRewardPenaltyItemById(itemId);
    }

    async deleteRewardPenaltyItem(classId = 'default', itemId) {
        const sql = 'DELETE FROM reward_penalty_items WHERE id = ?';
        const result = await this.runSQL(sql, [itemId]);
        
        if (result.changes === 0) {
            throw createError('RESOURCE_NOT_FOUND', '奖惩项不存在');
        }
        
        return true;
    }

    // ==================== 用户管理 ====================
    
    async getUsers(classId = 'default', filters = {}) {
        let sql = 'SELECT * FROM users WHERE 1=1';
        const params = [];

        if (filters.role) {
            sql += ' AND role = ?';
            params.push(filters.role);
        }

        if (filters.isActive !== undefined) {
            sql += ' AND is_active = ?';
            params.push(filters.isActive ? 1 : 0);
        }

        sql += ' ORDER BY role, name';

        const rows = await this.querySQL(sql, params);
        return rows.map(row => this.mapUserFromDB(row));
    }

    async getUserById(classId = 'default', userId) {
        const sql = 'SELECT * FROM users WHERE id = ?';
        const row = await this.getSQL(sql, [userId]);
        return row ? this.mapUserFromDB(row) : null;
    }

    async getUserByUsername(classId = 'default', username) {
        const sql = 'SELECT * FROM users WHERE username = ?';
        const row = await this.getSQL(sql, [username]);
        return row ? this.mapUserFromDB(row) : null;
    }

    async createUser(classId = 'default', userData) {
        const id = userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sql = `
            INSERT INTO users (id, username, name, role, student_number, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        `;

        try {
            await this.runSQL(sql, [
                id,
                userData.username,
                userData.name,
                userData.role,
                userData.studentNumber || null
            ]);

            return await this.getUserById(classId, id);
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw createError('DUPLICATE_RESOURCE', '用户名已存在');
            }
            throw error;
        }
    }

    async updateUser(classId = 'default', userId, updates) {
        const setParts = [];
        const params = [];

        if (updates.username) {
            setParts.push('username = ?');
            params.push(updates.username);
        }
        if (updates.name) {
            setParts.push('name = ?');
            params.push(updates.name);
        }
        if (updates.studentNumber !== undefined) {
            setParts.push('student_number = ?');
            params.push(updates.studentNumber);
        }
        if (updates.isActive !== undefined) {
            setParts.push('is_active = ?');
            params.push(updates.isActive ? 1 : 0);
        }

        if (setParts.length === 0) {
            throw createError('VALIDATION_ERROR', '没有要更新的字段');
        }

        const sql = `UPDATE users SET ${setParts.join(', ')} WHERE id = ?`;
        params.push(userId);

        const result = await this.runSQL(sql, params);
        if (result.changes === 0) {
            throw createError('RESOURCE_NOT_FOUND', '用户不存在');
        }

        return await this.getUserById(classId, userId);
    }

    async deleteUser(classId = 'default', userId) {
        const sql = 'DELETE FROM users WHERE id = ?';
        const result = await this.runSQL(sql, [userId]);
        
        if (result.changes === 0) {
            throw createError('RESOURCE_NOT_FOUND', '用户不存在');
        }
        
        return true;
    }

    // ==================== 统计查询 ====================
    
    async getClassStatistics(classId = 'default') {
        const [studentCount, productCount, orderCount, pointRecordCount] = await Promise.all([
            this.getSQL('SELECT COUNT(*) as count FROM users WHERE role = "student" AND is_active = 1'),
            this.getSQL('SELECT COUNT(*) as count FROM products WHERE is_active = 1'),
            this.getSQL('SELECT COUNT(*) as count FROM orders'),
            this.getSQL('SELECT COUNT(*) as count FROM point_records')
        ]);

        const totalPointsResult = await this.getSQL('SELECT COALESCE(SUM(amount), 0) as total FROM point_records');
        const totalPoints = totalPointsResult.total;
        const averagePoints = studentCount.count > 0 ? totalPoints / studentCount.count : 0;

        const pendingOrdersResult = await this.getSQL('SELECT COUNT(*) as count FROM orders WHERE status = "pending"');
        const completedOrdersResult = await this.getSQL('SELECT COUNT(*) as count FROM orders WHERE status = "completed"');

        return {
            totalStudents: studentCount.count,
            totalProducts: productCount.count,
            totalOrders: orderCount.count,
            totalPointRecords: pointRecordCount.count,
            totalPoints,
            averagePoints,
            pendingOrders: pendingOrdersResult.count,
            completedOrders: completedOrdersResult.count
        };
    }

    async getStudentPointStatistics(classId = 'default', studentId, dateRange = {}) {
        let sql = 'SELECT * FROM point_records WHERE student_id = ?';
        const params = [studentId];

        if (dateRange.startDate) {
            sql += ' AND created_at >= ?';
            params.push(dateRange.startDate);
        }

        if (dateRange.endDate) {
            sql += ' AND created_at <= ?';
            params.push(dateRange.endDate);
        }

        const records = await this.querySQL(sql, params);

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

    async getProductSalesStatistics(classId = 'default', dateRange = {}) {
        let sql = 'SELECT o.*, p.name as product_name FROM orders o LEFT JOIN products p ON o.product_id = p.id WHERE o.status = "completed"';
        const params = [];

        if (dateRange.startDate) {
            sql += ' AND o.created_at >= ?';
            params.push(dateRange.startDate);
        }

        if (dateRange.endDate) {
            sql += ' AND o.created_at <= ?';
            params.push(dateRange.endDate);
        }

        const completedOrders = await this.querySQL(sql, params);

        const salesByProduct = {};
        let totalRevenue = 0;

        completedOrders.forEach(order => {
            if (!salesByProduct[order.product_id]) {
                salesByProduct[order.product_id] = {
                    productName: order.product_name || '未知商品',
                    quantity: 0,
                    totalRevenue: 0
                };
            }
            salesByProduct[order.product_id].quantity += order.quantity;
            salesByProduct[order.product_id].totalRevenue += order.total_price;
            totalRevenue += order.total_price;
        });

        return {
            totalSales: completedOrders.length,
            totalRevenue,
            salesByProduct
        };
    }

    // ==================== 数据备份和恢复 ====================
    
    async exportClassData(classId = 'default') {
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

    async importClassData(classId = 'default', data) {
        try {
            await this.beginTransaction();

            // 清空现有数据
            await this.runSQL('DELETE FROM point_records');
            await this.runSQL('DELETE FROM orders');
            await this.runSQL('DELETE FROM products');
            await this.runSQL('DELETE FROM reward_penalty_items WHERE id NOT LIKE "reward_%" AND id NOT LIKE "penalty_%"');
            await this.runSQL('DELETE FROM users WHERE id != "admin_default"');

            // 导入用户数据
            if (data.users) {
                for (const user of data.users) {
                    await this.createUser(classId, user);
                }
            }

            // 导入学生数据（如果没有用户数据）
            if (data.students && !data.users) {
                for (const student of data.students) {
                    await this.createStudent(classId, student);
                }
            }

            // 导入商品数据
            if (data.products) {
                for (const product of data.products) {
                    await this.createProduct(classId, product);
                }
            }

            // 导入奖惩项数据
            if (data.rewardPenaltyItems) {
                for (const item of data.rewardPenaltyItems) {
                    await this.createRewardPenaltyItem(classId, item);
                }
            }

            // 导入积分记录
            if (data.pointRecords) {
                for (const record of data.pointRecords) {
                    await this.createPointRecord(classId, record);
                }
            }

            // 导入订单数据
            if (data.orders) {
                for (const order of data.orders) {
                    await this.createOrder(classId, order);
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
            await this.db.prepare('SELECT 1').first();
            return {
                status: 'healthy',
                message: 'D1数据库连接正常',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'error',
                message: `D1数据库连接异常: ${error.message}`,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ==================== 数据映射辅助方法 ====================
    
    mapUserFromDB(row) {
        return {
            id: row.id,
            classId: 'default', // D1适配器使用默认班级ID
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

    mapPointRecordFromDB(row) {
        return {
            id: row.id,
            classId: 'default',
            studentId: row.student_id,
            teacherId: row.teacher_id,
            amount: row.amount,
            reason: row.reason,
            type: row.type,
            createdAt: row.created_at
        };
    }

    mapProductFromDB(row) {
        return {
            id: row.id,
            classId: 'default',
            name: row.name,
            description: row.description,
            price: row.price,
            stock: row.stock,
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    mapOrderFromDB(row) {
        return {
            id: row.id,
            classId: 'default',
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

    mapRewardPenaltyItemFromDB(row) {
        return {
            id: row.id,
            classId: 'default',
            name: row.name,
            points: row.points,
            type: row.type,
            isActive: Boolean(row.is_active),
            sortOrder: row.sort_order,
            createdAt: row.created_at
        };
    }

    // ==================== 系统状态管理 ====================
    
    async getSystemState(classId = 'default') {
        const stmt = this.db.prepare('SELECT * FROM system_state WHERE id = ? LIMIT 1');
        const result = await stmt.bind('default').first();
        
        if (!result) {
            // 如果不存在，创建默认状态
            const defaultState = {
                id: 'default',
                classId: 'default',
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
        
        return this.mapSystemStateFromDB(result);
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
        
        fields.push('updated_at = datetime(\'now\')');
        
        const sql = `UPDATE system_state SET ${fields.join(', ')} WHERE id = ?`;
        params.push('default');
        
        const stmt = this.db.prepare(sql);
        await stmt.bind(...params).run();
        
        return await this.getSystemState(classId);
    }

    async createSystemState(classId = 'default', state) {
        const sql = `
            INSERT OR REPLACE INTO system_state 
            (id, mode, current_teacher, session_start_time, last_activity, is_authenticated, auto_switch_hours, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        const params = [
            'default',
            state.mode || 'normal',
            state.currentTeacher || null,
            state.sessionStartTime || null,
            state.lastActivity || new Date().toISOString(),
            state.isAuthenticated ? 1 : 0,
            state.autoSwitchHours || 2
        ];
        
        const stmt = this.db.prepare(sql);
        await stmt.bind(...params).run();
        
        return await this.getSystemState(classId);
    }

    mapSystemStateFromDB(row) {
        return {
            id: row.id,
            classId: 'default',
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

module.exports = D1StorageAdapter;