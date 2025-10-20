/**
 * SQLite存储适配器单元测试
 */

const SQLiteStorageAdapter = require('../adapters/sqliteStorageAdapter');
const path = require('path');
const fs = require('fs').promises;

describe('SQLiteStorageAdapter', () => {
    let adapter;
    const testDbPath = path.join(__dirname, 'test_classroom.db');
    const testClassId = 'test_class_001';

    beforeAll(async () => {
        // 创建测试适配器
        adapter = new SQLiteStorageAdapter({
            database: testDbPath,
            enableWAL: false // 测试时禁用WAL模式
        });
        
        await adapter.connect();
        
        // 创建测试表结构
        await createTestTables(adapter);
    });

    afterAll(async () => {
        // 清理测试数据库
        await adapter.disconnect();
        try {
            await fs.unlink(testDbPath);
        } catch (error) {
            // 忽略文件不存在的错误
        }
    });

    beforeEach(async () => {
        // 清空测试数据
        await adapter.run('DELETE FROM users WHERE class_id = ?', [testClassId]);
        await adapter.run('DELETE FROM point_records WHERE class_id = ?', [testClassId]);
        await adapter.run('DELETE FROM products WHERE class_id = ?', [testClassId]);
        await adapter.run('DELETE FROM orders WHERE class_id = ?', [testClassId]);
        await adapter.run('DELETE FROM reward_penalty_items WHERE class_id = ?', [testClassId]);
    });

    describe('连接管理', () => {
        test('应该能够连接到SQLite数据库', async () => {
            expect(adapter.isConnected).toBe(true);
        });

        test('健康检查应该返回正常状态', async () => {
            const health = await adapter.healthCheck();
            expect(health.status).toBe('healthy');
            expect(health.message).toContain('SQLite数据库连接正常');
        });
    });

    describe('事务管理', () => {
        test('应该能够开始、提交事务', async () => {
            await expect(adapter.beginTransaction()).resolves.toBe(true);
            await expect(adapter.commitTransaction()).resolves.toBe(true);
        });

        test('应该能够开始、回滚事务', async () => {
            await expect(adapter.beginTransaction()).resolves.toBe(true);
            await expect(adapter.rollbackTransaction()).resolves.toBe(true);
        });
    });

    describe('学生管理', () => {
        test('应该能够创建学生', async () => {
            const studentData = {
                name: '张三',
                classStudentNumber: '001',
                username: '001'
            };

            const student = await adapter.createStudent(testClassId, studentData);
            
            expect(student).toBeDefined();
            expect(student.name).toBe('张三');
            expect(student.studentNumber).toBe('001');
            expect(student.classId).toBe(testClassId);
        });

        test('应该能够获取学生列表', async () => {
            // 创建测试学生
            await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });
            await adapter.createStudent(testClassId, {
                name: '李四',
                classStudentNumber: '002'
            });

            const students = await adapter.getStudents(testClassId);
            
            expect(students).toHaveLength(2);
            expect(students[0].name).toBe('张三');
            expect(students[1].name).toBe('李四');
        });

        test('应该能够根据学号查找学生', async () => {
            await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });

            const student = await adapter.getStudentByNumber(testClassId, '001');
            
            expect(student).toBeDefined();
            expect(student.name).toBe('张三');
        });

        test('应该能够更新学生信息', async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });

            const updated = await adapter.updateStudent(testClassId, student.id, {
                name: '张三丰'
            });
            
            expect(updated.name).toBe('张三丰');
        });

        test('应该能够删除学生', async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });

            const result = await adapter.deleteStudent(testClassId, student.id);
            expect(result).toBe(true);

            const found = await adapter.getStudentById(testClassId, student.id);
            expect(found).toBeNull();
        });

        test('创建重复学号应该抛出错误', async () => {
            await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });

            await expect(adapter.createStudent(testClassId, {
                name: '李四',
                classStudentNumber: '001'
            })).rejects.toThrow('学号已存在');
        });
    });

    describe('积分管理', () => {
        let studentId;

        beforeEach(async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });
            studentId = student.id;
        });

        test('应该能够创建积分记录', async () => {
            const recordData = {
                studentId,
                teacherId: 'teacher_001',
                amount: 10,
                reason: '课堂表现优秀',
                type: 'reward'
            };

            const record = await adapter.createPointRecord(testClassId, recordData);
            
            expect(record).toBeDefined();
            expect(record.amount).toBe(10);
            expect(record.reason).toBe('课堂表现优秀');
        });

        test('应该能够计算积分余额', async () => {
            // 创建多条积分记录
            await adapter.createPointRecord(testClassId, {
                studentId,
                teacherId: 'teacher_001',
                amount: 10,
                reason: '加分',
                type: 'reward'
            });
            await adapter.createPointRecord(testClassId, {
                studentId,
                teacherId: 'teacher_001',
                amount: -5,
                reason: '减分',
                type: 'penalty'
            });

            const balance = await adapter.calculatePointBalance(testClassId, studentId);
            expect(balance).toBe(5);
        });

        test('应该能够获取积分排行榜', async () => {
            // 创建另一个学生
            const student2 = await adapter.createStudent(testClassId, {
                name: '李四',
                classStudentNumber: '002'
            });

            // 为两个学生创建积分记录
            await adapter.createPointRecord(testClassId, {
                studentId,
                teacherId: 'teacher_001',
                amount: 20,
                reason: '加分',
                type: 'reward'
            });
            await adapter.createPointRecord(testClassId, {
                studentId: student2.id,
                teacherId: 'teacher_001',
                amount: 30,
                reason: '加分',
                type: 'reward'
            });

            const ranking = await adapter.getPointRanking(testClassId, 'total', 10);
            
            expect(ranking).toHaveLength(2);
            expect(ranking[0].points).toBe(30); // 李四排第一
            expect(ranking[0].rank).toBe(1);
            expect(ranking[1].points).toBe(20); // 张三排第二
            expect(ranking[1].rank).toBe(2);
        });

        test('应该能够批量操作积分', async () => {
            const operations = [
                {
                    studentId,
                    teacherId: 'teacher_001',
                    amount: 10,
                    reason: '操作1',
                    type: 'reward'
                },
                {
                    studentId,
                    teacherId: 'teacher_001',
                    amount: 5,
                    reason: '操作2',
                    type: 'reward'
                }
            ];

            const results = await adapter.batchPointOperations(testClassId, operations);
            
            expect(results).toHaveLength(2);
            
            const balance = await adapter.calculatePointBalance(testClassId, studentId);
            expect(balance).toBe(15);
        });

        test('应该能够清零所有积分', async () => {
            // 创建另一个学生
            const student2 = await adapter.createStudent(testClassId, {
                name: '李四',
                classStudentNumber: '002'
            });

            // 为两个学生创建积分记录
            await adapter.createPointRecord(testClassId, {
                studentId,
                teacherId: 'teacher_001',
                amount: 20,
                reason: '加分',
                type: 'reward'
            });
            await adapter.createPointRecord(testClassId, {
                studentId: student2.id,
                teacherId: 'teacher_001',
                amount: 30,
                reason: '加分',
                type: 'reward'
            });

            await adapter.resetAllPoints(testClassId, 'teacher_001', '学期结束');

            const balance1 = await adapter.calculatePointBalance(testClassId, studentId);
            const balance2 = await adapter.calculatePointBalance(testClassId, student2.id);
            
            expect(balance1).toBe(0);
            expect(balance2).toBe(0);
        });
    });

    describe('商品管理', () => {
        test('应该能够创建商品', async () => {
            const productData = {
                name: '精美笔记本',
                description: '高质量笔记本',
                price: 50,
                stock: 10
            };

            const product = await adapter.createProduct(testClassId, productData);
            
            expect(product).toBeDefined();
            expect(product.name).toBe('精美笔记本');
            expect(product.price).toBe(50);
            expect(product.stock).toBe(10);
        });

        test('应该能够获取商品列表', async () => {
            await adapter.createProduct(testClassId, {
                name: '商品1',
                price: 10,
                stock: 5
            });
            await adapter.createProduct(testClassId, {
                name: '商品2',
                price: 20,
                stock: 3
            });

            const products = await adapter.getProducts(testClassId);
            
            expect(products).toHaveLength(2);
        });

        test('应该能够更新商品库存', async () => {
            const product = await adapter.createProduct(testClassId, {
                name: '商品1',
                price: 10,
                stock: 5
            });

            const updated = await adapter.updateProductStock(testClassId, product.id, -2);
            
            expect(updated.stock).toBe(3);
        });

        test('库存不足时应该抛出错误', async () => {
            const product = await adapter.createProduct(testClassId, {
                name: '商品1',
                price: 10,
                stock: 5
            });

            await expect(adapter.updateProductStock(testClassId, product.id, -10))
                .rejects.toThrow('库存不足');
        });
    });

    describe('预约管理', () => {
        let studentId, productId;

        beforeEach(async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });
            const product = await adapter.createProduct(testClassId, {
                name: '商品1',
                price: 10,
                stock: 5
            });
            studentId = student.id;
            productId = product.id;
        });

        test('应该能够创建预约订单', async () => {
            const orderData = {
                studentId,
                productId,
                quantity: 1,
                totalPrice: 10
            };

            const order = await adapter.createOrder(testClassId, orderData);
            
            expect(order).toBeDefined();
            expect(order.studentId).toBe(studentId);
            expect(order.productId).toBe(productId);
            expect(order.status).toBe('pending');
        });

        test('应该能够更新订单状态', async () => {
            const order = await adapter.createOrder(testClassId, {
                studentId,
                productId,
                quantity: 1,
                totalPrice: 10
            });

            const updated = await adapter.updateOrderStatus(testClassId, order.id, 'confirmed', 'teacher_001');
            
            expect(updated.status).toBe('confirmed');
            expect(updated.confirmedAt).toBeDefined();
        });

        test('应该能够取消订单', async () => {
            const order = await adapter.createOrder(testClassId, {
                studentId,
                productId,
                quantity: 1,
                totalPrice: 10
            });

            const cancelled = await adapter.cancelOrder(testClassId, order.id, '学生取消');
            
            expect(cancelled.status).toBe('cancelled');
        });
    });

    describe('奖惩项管理', () => {
        test('应该能够创建奖惩项', async () => {
            const itemData = {
                name: '课堂表现优秀',
                points: 10,
                type: 'reward',
                sortOrder: 1
            };

            const item = await adapter.createRewardPenaltyItem(testClassId, itemData);
            
            expect(item).toBeDefined();
            expect(item.name).toBe('课堂表现优秀');
            expect(item.points).toBe(10);
            expect(item.type).toBe('reward');
        });

        test('应该能够获取奖惩项列表', async () => {
            await adapter.createRewardPenaltyItem(testClassId, {
                name: '奖励项1',
                points: 10,
                type: 'reward',
                sortOrder: 1
            });
            await adapter.createRewardPenaltyItem(testClassId, {
                name: '惩罚项1',
                points: -5,
                type: 'penalty',
                sortOrder: 2
            });

            const items = await adapter.getRewardPenaltyItems(testClassId);
            
            expect(items).toHaveLength(2);
            expect(items[0].sortOrder).toBe(1); // 按排序顺序返回
            expect(items[1].sortOrder).toBe(2);
        });
    });

    describe('数据导入导出', () => {
        test('应该能够导出班级数据', async () => {
            // 创建测试数据
            await adapter.createStudent(testClassId, {
                name: '张三',
                classStudentNumber: '001'
            });
            await adapter.createProduct(testClassId, {
                name: '商品1',
                price: 10,
                stock: 5
            });

            const exportData = await adapter.exportClassData(testClassId);
            
            expect(exportData.classId).toBe(testClassId);
            expect(exportData.data.students).toHaveLength(1);
            expect(exportData.data.products).toHaveLength(1);
        });

        test('应该能够导入班级数据', async () => {
            const importData = {
                students: [{
                    name: '李四',
                    classStudentNumber: '002'
                }],
                products: [{
                    name: '商品2',
                    price: 20,
                    stock: 3
                }]
            };

            await adapter.importClassData(testClassId, importData);

            const students = await adapter.getStudents(testClassId);
            const products = await adapter.getProducts(testClassId);
            
            expect(students).toHaveLength(1);
            expect(students[0].name).toBe('李四');
            expect(products).toHaveLength(1);
            expect(products[0].name).toBe('商品2');
        });
    });
});

/**
 * 创建测试表结构
 */
async function createTestTables(adapter) {
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            username TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
            student_number TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT
        )`,
        
        `CREATE TABLE IF NOT EXISTS point_records (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            teacher_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('manual', 'reward', 'penalty', 'purchase')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
        
        `CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            price INTEGER NOT NULL,
            stock INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT
        )`,
        
        `CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            student_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            total_price INTEGER NOT NULL,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            confirmed_at TEXT,
            completed_at TEXT,
            updated_at TEXT
        )`,
        
        `CREATE TABLE IF NOT EXISTS reward_penalty_items (
            id TEXT PRIMARY KEY,
            class_id TEXT NOT NULL,
            name TEXT NOT NULL,
            points INTEGER NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('reward', 'penalty')),
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0
        )`
    ];

    for (const sql of tables) {
        await adapter.run(sql);
    }
}