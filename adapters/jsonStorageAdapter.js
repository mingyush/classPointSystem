/**
 * JSON文件存储适配器
 * 
 * 功能：
 * - 基于JSON文件的数据存储实现
 * - 兼容现有的文件结构
 * - 支持班级数据隔离
 * - 提供事务模拟和数据一致性保证
 */

const { StorageAdapter, PointFilter, OrderFilter } = require('./storageAdapter');
const { createError } = require('../middleware/errorHandler');
const fs = require('fs').promises;
const path = require('path');

class JsonStorageAdapter extends StorageAdapter {
    constructor(config = {}) {
        super(config);
        this.dataDir = config.dataDir || path.join(process.cwd(), 'data');
        this.backupService = null;
        this.transactionStack = [];
        this.isInTransaction = false;
        
        this.initializeBackupService();
    }

    /**
     * 初始化备份服务
     */
    initializeBackupService() {
        try {
            this.backupService = require('../services/backupService');
        } catch (error) {
            console.warn('备份服务不可用:', error.message);
        }
    }

    /**
     * 连接数据库（JSON文件不需要连接）
     */
    async connect() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            this.isConnected = true;
            return true;
        } catch (error) {
            console.error('初始化数据目录失败:', error);
            throw createError('DATABASE_ERROR', '初始化数据存储失败');
        }
    }

    /**
     * 断开连接
     */
    async disconnect() {
        this.isConnected = false;
        return true;
    }

    /**
     * 开始事务（模拟）
     */
    async beginTransaction() {
        this.isInTransaction = true;
        this.transactionStack = [];
        return true;
    }

    /**
     * 提交事务
     */
    async commitTransaction() {
        this.isInTransaction = false;
        this.transactionStack = [];
        return true;
    }

    /**
     * 回滚事务（模拟）
     */
    async rollbackTransaction() {
        if (this.isInTransaction && this.transactionStack.length > 0) {
            // 在实际应用中，这里应该恢复所有文件的备份
            console.warn('JSON存储适配器不支持完整的事务回滚');
        }
        this.isInTransaction = false;
        this.transactionStack = [];
        return true;
    }

    /**
     * 获取文件路径
     */
    getFilePath(classId, fileName) {
        return path.join(this.dataDir, `${classId}_${fileName}`);
    }

    /**
     * 读取JSON文件
     */
    async readJsonFile(filePath, defaultValue = []) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，返回默认值
                return defaultValue;
            }
            throw createError('FILE_OPERATION_ERROR', `读取文件失败: ${error.message}`);
        }
    }

    /**
     * 写入JSON文件
     */
    async writeJsonFile(filePath, data) {
        try {
            // 创建备份
            if (this.backupService) {
                await this.backupService.createBackup(filePath);
            }

            // 写入文件
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
            
            // 记录事务操作
            if (this.isInTransaction) {
                this.transactionStack.push({ action: 'write', filePath, data });
            }
        } catch (error) {
            throw createError('FILE_OPERATION_ERROR', `写入文件失败: ${error.message}`);
        }
    }

    // ==================== 学生管理 ====================
    
    async getStudents(classId, filters = {}) {
        const filePath = this.getFilePath(classId, 'students.json');
        const students = await this.readJsonFile(filePath, []);
        
        // 应用过滤器
        let result = students.filter(student => student.classId === classId);
        
        if (filters.isActive !== undefined) {
            result = result.filter(student => student.isActive === filters.isActive);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            result = result.filter(student => 
                student.name.toLowerCase().includes(searchTerm) ||
                student.classStudentNumber?.includes(searchTerm) ||
                student.fullStudentNumber?.includes(searchTerm)
            );
        }

        // 排序
        result.sort((a, b) => {
            if (a.classStudentNumber && b.classStudentNumber) {
                return a.classStudentNumber.localeCompare(b.classStudentNumber);
            }
            return a.name.localeCompare(b.name);
        });

        return result;
    }

    async getStudentById(classId, studentId) {
        const students = await this.getStudents(classId);
        return students.find(student => student.id === studentId);
    }

    async getStudentByNumber(classId, studentNumber) {
        const students = await this.getStudents(classId);
        return students.find(student => 
            student.classStudentNumber === studentNumber || 
            student.fullStudentNumber === studentNumber
        );
    }

    async createStudent(classId, studentData) {
        const filePath = this.getFilePath(classId, 'students.json');
        const students = await this.readJsonFile(filePath, []);
        
        // 检查学号是否已存在
        const existingStudent = students.find(s => 
            s.classStudentNumber === studentData.classStudentNumber ||
            s.fullStudentNumber === studentData.fullStudentNumber
        );
        
        if (existingStudent) {
            throw createError('DUPLICATE_RESOURCE', '学号已存在');
        }

        const newStudent = {
            id: studentData.id || `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            classId,
            username: studentData.username || studentData.classStudentNumber,
            name: studentData.name,
            role: 'student',
            classStudentNumber: studentData.classStudentNumber,
            fullStudentNumber: studentData.fullStudentNumber,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        students.push(newStudent);
        await this.writeJsonFile(filePath, students);
        
        return newStudent;
    }

    async updateStudent(classId, studentId, updates) {
        const filePath = this.getFilePath(classId, 'students.json');
        const students = await this.readJsonFile(filePath, []);
        
        const studentIndex = students.findIndex(s => s.id === studentId && s.classId === classId);
        if (studentIndex === -1) {
            throw createError('STUDENT_NOT_FOUND', '学生不存在');
        }

        students[studentIndex] = {
            ...students[studentIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.writeJsonFile(filePath, students);
        return students[studentIndex];
    }

    async deleteStudent(classId, studentId) {
        const filePath = this.getFilePath(classId, 'students.json');
        const students = await this.readJsonFile(filePath, []);
        
        const studentIndex = students.findIndex(s => s.id === studentId && s.classId === classId);
        if (studentIndex === -1) {
            throw createError('STUDENT_NOT_FOUND', '学生不存在');
        }

        students.splice(studentIndex, 1);
        await this.writeJsonFile(filePath, students);
        
        return true;
    }

    // ==================== 积分管理 ====================
    
    async getPointRecords(classId, filters = {}) {
        const filePath = this.getFilePath(classId, 'points.json');
        const records = await this.readJsonFile(filePath, []);
        
        let result = records.filter(record => record.classId === classId);
        
        // 应用过滤器
        if (filters.studentId) {
            result = result.filter(record => record.studentId === filters.studentId);
        }
        
        if (filters.teacherId) {
            result = result.filter(record => record.teacherId === filters.teacherId);
        }
        
        if (filters.type) {
            result = result.filter(record => record.type === filters.type);
        }
        
        if (filters.startDate) {
            result = result.filter(record => new Date(record.createdAt) >= new Date(filters.startDate));
        }
        
        if (filters.endDate) {
            result = result.filter(record => new Date(record.createdAt) <= new Date(filters.endDate));
        }

        // 排序（最新的在前）
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // 限制数量
        if (filters.limit) {
            result = result.slice(0, filters.limit);
        }

        return result;
    }

    async createPointRecord(classId, recordData) {
        const filePath = this.getFilePath(classId, 'points.json');
        const records = await this.readJsonFile(filePath, []);
        
        const newRecord = {
            id: recordData.id || `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            classId,
            studentId: recordData.studentId,
            teacherId: recordData.teacherId,
            amount: recordData.amount,
            reason: recordData.reason,
            type: recordData.type || 'manual',
            createdAt: new Date().toISOString()
        };

        records.push(newRecord);
        await this.writeJsonFile(filePath, records);
        
        return newRecord;
    }

    async calculatePointBalance(classId, studentId) {
        const records = await this.getPointRecords(classId, { studentId });
        return records.reduce((balance, record) => balance + record.amount, 0);
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
                rank: 0 // 将在排序后设置
            });
        }

        // 排序并设置排名
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
        const filePath = this.getFilePath(classId, 'products.json');
        const products = await this.readJsonFile(filePath, []);
        
        let result = products.filter(product => product.classId === classId);
        
        if (filters.isActive !== undefined) {
            result = result.filter(product => product.isActive === filters.isActive);
        }
        
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            result = result.filter(product => 
                product.name.toLowerCase().includes(searchTerm) ||
                product.description?.toLowerCase().includes(searchTerm)
            );
        }

        return result;
    }

    async getProductById(classId, productId) {
        const products = await this.getProducts(classId);
        return products.find(product => product.id === productId);
    }

    async createProduct(classId, productData) {
        const filePath = this.getFilePath(classId, 'products.json');
        const products = await this.readJsonFile(filePath, []);
        
        const newProduct = {
            id: productData.id || `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            classId,
            name: productData.name,
            description: productData.description || '',
            price: productData.price,
            stock: productData.stock || 0,
            isActive: productData.isActive !== false,
            createdAt: new Date().toISOString()
        };

        products.push(newProduct);
        await this.writeJsonFile(filePath, products);
        
        return newProduct;
    }

    async updateProduct(classId, productId, updates) {
        const filePath = this.getFilePath(classId, 'products.json');
        const products = await this.readJsonFile(filePath, []);
        
        const productIndex = products.findIndex(p => p.id === productId && p.classId === classId);
        if (productIndex === -1) {
            throw createError('PRODUCT_NOT_FOUND', '商品不存在');
        }

        products[productIndex] = {
            ...products[productIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.writeJsonFile(filePath, products);
        return products[productIndex];
    }

    async deleteProduct(classId, productId) {
        const filePath = this.getFilePath(classId, 'products.json');
        const products = await this.readJsonFile(filePath, []);
        
        const productIndex = products.findIndex(p => p.id === productId && p.classId === classId);
        if (productIndex === -1) {
            throw createError('PRODUCT_NOT_FOUND', '商品不存在');
        }

        products.splice(productIndex, 1);
        await this.writeJsonFile(filePath, products);
        
        return true;
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
        const filePath = this.getFilePath(classId, 'orders.json');
        const orders = await this.readJsonFile(filePath, []);
        
        let result = orders.filter(order => order.classId === classId);
        
        // 应用过滤器
        if (filters.studentId) {
            result = result.filter(order => order.studentId === filters.studentId);
        }
        
        if (filters.productId) {
            result = result.filter(order => order.productId === filters.productId);
        }
        
        if (filters.status) {
            result = result.filter(order => order.status === filters.status);
        }
        
        if (filters.startDate) {
            result = result.filter(order => new Date(order.createdAt) >= new Date(filters.startDate));
        }
        
        if (filters.endDate) {
            result = result.filter(order => new Date(order.createdAt) <= new Date(filters.endDate));
        }

        // 排序（最新的在前）
        result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return result;
    }

    async getOrderById(classId, orderId) {
        const orders = await this.getOrders(classId);
        return orders.find(order => order.id === orderId);
    }

    async createOrder(classId, orderData) {
        const filePath = this.getFilePath(classId, 'orders.json');
        const orders = await this.readJsonFile(filePath, []);
        
        const newOrder = {
            id: orderData.id || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            classId,
            studentId: orderData.studentId,
            productId: orderData.productId,
            quantity: orderData.quantity || 1,
            totalPrice: orderData.totalPrice,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        orders.push(newOrder);
        await this.writeJsonFile(filePath, orders);
        
        return newOrder;
    }

    async updateOrderStatus(classId, orderId, status, updatedBy) {
        const filePath = this.getFilePath(classId, 'orders.json');
        const orders = await this.readJsonFile(filePath, []);
        
        const orderIndex = orders.findIndex(o => o.id === orderId && o.classId === classId);
        if (orderIndex === -1) {
            throw createError('ORDER_NOT_FOUND', '订单不存在');
        }

        const updates = {
            status,
            updatedBy,
            updatedAt: new Date().toISOString()
        };

        if (status === 'confirmed') {
            updates.confirmedAt = new Date().toISOString();
        } else if (status === 'completed') {
            updates.completedAt = new Date().toISOString();
        }

        orders[orderIndex] = {
            ...orders[orderIndex],
            ...updates
        };

        await this.writeJsonFile(filePath, orders);
        return orders[orderIndex];
    }

    async cancelOrder(classId, orderId, reason) {
        return await this.updateOrderStatus(classId, orderId, 'cancelled', null);
    }

    // ==================== 奖惩项管理 ====================
    
    async getRewardPenaltyItems(classId) {
        const filePath = this.getFilePath(classId, 'reward_penalty_items.json');
        const items = await this.readJsonFile(filePath, []);
        
        return items
            .filter(item => item.classId === classId && item.isActive)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    async createRewardPenaltyItem(classId, itemData) {
        const filePath = this.getFilePath(classId, 'reward_penalty_items.json');
        const items = await this.readJsonFile(filePath, []);
        
        const newItem = {
            id: itemData.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            classId,
            name: itemData.name,
            points: itemData.points,
            type: itemData.type,
            isActive: true,
            sortOrder: itemData.sortOrder || 0,
            createdAt: new Date().toISOString()
        };

        items.push(newItem);
        await this.writeJsonFile(filePath, items);
        
        return newItem;
    }

    async updateRewardPenaltyItem(classId, itemId, updates) {
        const filePath = this.getFilePath(classId, 'reward_penalty_items.json');
        const items = await this.readJsonFile(filePath, []);
        
        const itemIndex = items.findIndex(i => i.id === itemId && i.classId === classId);
        if (itemIndex === -1) {
            throw createError('RESOURCE_NOT_FOUND', '奖惩项不存在');
        }

        items[itemIndex] = {
            ...items[itemIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.writeJsonFile(filePath, items);
        return items[itemIndex];
    }

    async deleteRewardPenaltyItem(classId, itemId) {
        const filePath = this.getFilePath(classId, 'reward_penalty_items.json');
        const items = await this.readJsonFile(filePath, []);
        
        const itemIndex = items.findIndex(i => i.id === itemId && i.classId === classId);
        if (itemIndex === -1) {
            throw createError('RESOURCE_NOT_FOUND', '奖惩项不存在');
        }

        items.splice(itemIndex, 1);
        await this.writeJsonFile(filePath, items);
        
        return true;
    }

    // ==================== 用户管理 ====================
    
    async getUsers(classId, filters = {}) {
        const filePath = this.getFilePath(classId, 'users.json');
        const users = await this.readJsonFile(filePath, []);
        
        let result = users.filter(user => user.classId === classId);
        
        if (filters.role) {
            result = result.filter(user => user.role === filters.role);
        }
        
        if (filters.isActive !== undefined) {
            result = result.filter(user => user.isActive === filters.isActive);
        }

        return result;
    }

    async getUserById(classId, userId) {
        const users = await this.getUsers(classId);
        return users.find(user => user.id === userId);
    }

    async getUserByUsername(classId, username) {
        const users = await this.getUsers(classId);
        return users.find(user => user.username === username);
    }

    async createUser(classId, userData) {
        const filePath = this.getFilePath(classId, 'users.json');
        const users = await this.readJsonFile(filePath, []);
        
        // 检查用户名是否已存在
        const existingUser = users.find(u => u.username === userData.username && u.classId === classId);
        if (existingUser) {
            throw createError('DUPLICATE_RESOURCE', '用户名已存在');
        }

        const newUser = {
            id: userData.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            classId,
            username: userData.username,
            name: userData.name,
            role: userData.role,
            password: userData.password,
            classStudentNumber: userData.classStudentNumber || null,
            fullStudentNumber: userData.fullStudentNumber || null,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await this.writeJsonFile(filePath, users);
        
        return newUser;
    }

    async updateUser(classId, userId, updates) {
        const filePath = this.getFilePath(classId, 'users.json');
        const users = await this.readJsonFile(filePath, []);
        
        const userIndex = users.findIndex(u => u.id === userId && u.classId === classId);
        if (userIndex === -1) {
            throw createError('RESOURCE_NOT_FOUND', '用户不存在');
        }

        users[userIndex] = {
            ...users[userIndex],
            ...updates,
            updatedAt: new Date().toISOString()
        };

        await this.writeJsonFile(filePath, users);
        return users[userIndex];
    }

    async deleteUser(classId, userId) {
        const filePath = this.getFilePath(classId, 'users.json');
        const users = await this.readJsonFile(filePath, []);
        
        const userIndex = users.findIndex(u => u.id === userId && u.classId === classId);
        if (userIndex === -1) {
            throw createError('RESOURCE_NOT_FOUND', '用户不存在');
        }

        users.splice(userIndex, 1);
        await this.writeJsonFile(filePath, users);
        
        return true;
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

        // 按类型统计
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
            
            // 导入各类数据
            if (data.students) {
                const filePath = this.getFilePath(classId, 'students.json');
                await this.writeJsonFile(filePath, data.students);
            }
            
            if (data.products) {
                const filePath = this.getFilePath(classId, 'products.json');
                await this.writeJsonFile(filePath, data.products);
            }
            
            if (data.orders) {
                const filePath = this.getFilePath(classId, 'orders.json');
                await this.writeJsonFile(filePath, data.orders);
            }
            
            if (data.pointRecords) {
                const filePath = this.getFilePath(classId, 'points.json');
                await this.writeJsonFile(filePath, data.pointRecords);
            }
            
            if (data.users) {
                const filePath = this.getFilePath(classId, 'users.json');
                await this.writeJsonFile(filePath, data.users);
            }
            
            if (data.rewardPenaltyItems) {
                const filePath = this.getFilePath(classId, 'reward_penalty_items.json');
                await this.writeJsonFile(filePath, data.rewardPenaltyItems);
            }
            
            await this.commitTransaction();
            return true;
        } catch (error) {
            await this.rollbackTransaction();
            throw error;
        }
    }

    // ==================== 系统状态管理 ====================
    
    /**
     * 获取系统状态
     */
    async getSystemState(classId = 'default') {
        const filePath = path.join(this.dataDir, 'system_state.json');
        
        try {
            const data = await this.readJsonFile(filePath);
            return data[classId] || this.createDefaultSystemState(classId);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，创建默认状态
                const defaultState = this.createDefaultSystemState(classId);
                await this.updateSystemState(classId, defaultState);
                return defaultState;
            }
            throw error;
        }
    }

    /**
     * 更新系统状态
     */
    async updateSystemState(classId = 'default', updates) {
        const filePath = path.join(this.dataDir, 'system_state.json');
        
        try {
            let data = {};
            try {
                data = await this.readJsonFile(filePath);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }
            
            // 获取当前状态或创建默认状态
            const currentState = data[classId] || this.createDefaultSystemState(classId);
            
            // 合并更新
            const updatedState = {
                ...currentState,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            data[classId] = updatedState;
            
            // 备份并写入文件
            if (this.backupService) {
                await this.backupService.createBackup(filePath);
            }
            
            await this.writeJsonFile(filePath, data);
            
            return updatedState;
        } catch (error) {
            console.error('更新系统状态失败:', error);
            throw createError('DATABASE_ERROR', `更新系统状态失败: ${error.message}`);
        }
    }

    /**
     * 创建系统状态
     */
    async createSystemState(classId = 'default', stateData) {
        const defaultState = this.createDefaultSystemState(classId);
        const newState = { ...defaultState, ...stateData };
        
        return await this.updateSystemState(classId, newState);
    }

    /**
     * 创建默认系统状态
     */
    createDefaultSystemState(classId) {
        return {
            id: classId,
            classId: classId,
            mode: 'normal',
            currentTeacher: null,
            sessionStartTime: null,
            lastActivity: new Date().toISOString(),
            isAuthenticated: false,
            autoSwitchHours: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    async healthCheck() {
        try {
            // 检查数据目录是否可访问
            await fs.access(this.dataDir);
            
            // 检查是否可以创建临时文件
            const testFile = path.join(this.dataDir, 'health_check_test.json');
            await fs.writeFile(testFile, '{"test": true}');
            await fs.unlink(testFile);
            
            return {
                status: 'healthy',
                message: 'JSON存储适配器运行正常',
                details: {
                    dataDir: this.dataDir,
                    isConnected: this.isConnected,
                    isInTransaction: this.isInTransaction
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `JSON存储适配器异常: ${error.message}`,
                error: error.message
            };
        }
    }
}

module.exports = JsonStorageAdapter;