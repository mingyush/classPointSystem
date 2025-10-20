/**
 * Cloudflare D1存储适配器单元测试
 */

const D1StorageAdapter = require('../adapters/d1StorageAdapter');

// Mock D1 database for testing
class MockD1Database {
    constructor() {
        this.data = {
            users: [],
            point_records: [],
            products: [],
            orders: [],
            reward_penalty_items: []
        };
        this.lastId = 0;
    }

    prepare(sql) {
        return new MockD1Statement(sql, this);
    }

    async batch(statements) {
        const results = [];
        for (const stmt of statements) {
            const result = await stmt.run();
            results.push(result);
        }
        return results;
    }
}

class MockD1Statement {
    constructor(sql, db) {
        this.sql = sql;
        this.db = db;
        this.params = [];
    }

    bind(...params) {
        this.params = params;
        return this;
    }

    async run() {
        const sql = this.sql.toLowerCase();
        
        if (sql.includes('select 1')) {
            return { success: true };
        }

        if (sql.startsWith('insert into users')) {
            const user = {
                id: this.params[0],
                username: this.params[1],
                name: this.params[2],
                role: this.params[3],
                student_number: this.params[4],
                is_active: 1,
                created_at: new Date().toISOString()
            };
            this.db.data.users.push(user);
            return { success: true, changes: 1, meta: { last_row_id: this.params[0] } };
        }

        if (sql.startsWith('insert into point_records')) {
            const record = {
                id: this.params[0],
                student_id: this.params[1],
                teacher_id: this.params[2],
                amount: this.params[3],
                reason: this.params[4],
                type: this.params[5],
                created_at: new Date().toISOString()
            };
            this.db.data.point_records.push(record);
            return { success: true, changes: 1 };
        }

        if (sql.startsWith('insert into products')) {
            const product = {
                id: this.params[0],
                name: this.params[1],
                description: this.params[2],
                price: this.params[3],
                stock: this.params[4],
                is_active: this.params[5],
                created_at: new Date().toISOString()
            };
            this.db.data.products.push(product);
            return { success: true, changes: 1 };
        }

        if (sql.startsWith('insert into orders')) {
            const order = {
                id: this.params[0],
                student_id: this.params[1],
                product_id: this.params[2],
                quantity: this.params[3],
                total_price: this.params[4],
                status: 'pending',
                created_at: new Date().toISOString()
            };
            this.db.data.orders.push(order);
            return { success: true, changes: 1 };
        }

        if (sql.startsWith('insert into reward_penalty_items')) {
            const item = {
                id: this.params[0],
                name: this.params[1],
                points: this.params[2],
                type: this.params[3],
                is_active: 1,
                sort_order: this.params[4],
                created_at: new Date().toISOString()
            };
            this.db.data.reward_penalty_items.push(item);
            return { success: true, changes: 1 };
        }

        if (sql.startsWith('update users')) {
            const userId = this.params[this.params.length - 1];
            const user = this.db.data.users.find(u => u.id === userId);
            if (user) {
                if (sql.includes('name = ?')) {
                    user.name = this.params[0];
                }
                return { success: true, changes: 1 };
            }
            return { success: true, changes: 0 };
        }

        if (sql.startsWith('update products')) {
            const productId = this.params[this.params.length - 1];
            const product = this.db.data.products.find(p => p.id === productId);
            if (product) {
                if (sql.includes('stock = stock + ?')) {
                    product.stock += this.params[0];
                }
                return { success: true, changes: 1 };
            }
            return { success: true, changes: 0 };
        }

        if (sql.startsWith('update orders')) {
            const orderId = this.params[this.params.length - 1];
            const order = this.db.data.orders.find(o => o.id === orderId);
            if (order) {
                order.status = this.params[0];
                if (this.params[0] === 'confirmed') {
                    order.confirmed_at = new Date().toISOString();
                }
                return { success: true, changes: 1 };
            }
            return { success: true, changes: 0 };
        }

        if (sql.startsWith('delete from users')) {
            const userId = this.params[0];
            const index = this.db.data.users.findIndex(u => u.id === userId);
            if (index !== -1) {
                this.db.data.users.splice(index, 1);
                return { success: true, changes: 1 };
            }
            return { success: true, changes: 0 };
        }

        if (sql.startsWith('delete from products')) {
            const productId = this.params[0];
            const index = this.db.data.products.findIndex(p => p.id === productId);
            if (index !== -1) {
                this.db.data.products.splice(index, 1);
                return { success: true, changes: 1 };
            }
            return { success: true, changes: 0 };
        }

        return { success: true, changes: 0 };
    }

    async first() {
        const sql = this.sql.toLowerCase();
        
        if (sql.includes('select 1')) {
            return { result: 1 };
        }

        if (sql.includes('select * from users where id = ?')) {
            const userId = this.params[0];
            const user = this.db.data.users.find(u => u.id === userId);
            return user || null;
        }

        if (sql.includes('select * from users where student_number = ?')) {
            const studentNumber = this.params[0];
            return this.db.data.users.find(u => u.student_number === studentNumber) || null;
        }

        if (sql.includes('select * from users where username = ?')) {
            const username = this.params[0];
            return this.db.data.users.find(u => u.username === username) || null;
        }

        if (sql.includes('select * from point_records where id = ?')) {
            const recordId = this.params[0];
            return this.db.data.point_records.find(r => r.id === recordId) || null;
        }

        if (sql.includes('select * from products where id = ?')) {
            const productId = this.params[0];
            return this.db.data.products.find(p => p.id === productId) || null;
        }

        if (sql.includes('select * from orders where id = ?')) {
            const orderId = this.params[0];
            return this.db.data.orders.find(o => o.id === orderId) || null;
        }

        if (sql.includes('select * from reward_penalty_items where id = ?')) {
            const itemId = this.params[0];
            return this.db.data.reward_penalty_items.find(i => i.id === itemId) || null;
        }

        if (sql.includes('select coalesce(sum(amount), 0) as balance')) {
            const studentId = this.params[0];
            const records = this.db.data.point_records.filter(r => r.student_id === studentId);
            const balance = records.reduce((sum, r) => sum + r.amount, 0);
            return { balance };
        }

        if (sql.includes('select count(*) as count')) {
            if (sql.includes('from users')) {
                return { count: this.db.data.users.filter(u => u.role === 'student' && u.is_active).length };
            }
            if (sql.includes('from products')) {
                return { count: this.db.data.products.filter(p => p.is_active).length };
            }
            if (sql.includes('from orders')) {
                if (sql.includes('status = "pending"')) {
                    return { count: this.db.data.orders.filter(o => o.status === 'pending').length };
                }
                if (sql.includes('status = "completed"')) {
                    return { count: this.db.data.orders.filter(o => o.status === 'completed').length };
                }
                return { count: this.db.data.orders.length };
            }
            if (sql.includes('from point_records')) {
                return { count: this.db.data.point_records.length };
            }
        }

        if (sql.includes('select coalesce(sum(amount), 0) as total from point_records')) {
            const total = this.db.data.point_records.reduce((sum, r) => sum + r.amount, 0);
            return { total };
        }

        return null;
    }

    async all() {
        const sql = this.sql.toLowerCase();
        
        if (sql.includes('select * from users')) {
            let users = [...this.db.data.users];
            
            if (sql.includes('role = "student"')) {
                users = users.filter(u => u.role === 'student');
            }
            
            if (sql.includes('is_active = 1')) {
                users = users.filter(u => u.is_active);
            }
            
            return { results: users };
        }

        if (sql.includes('select * from point_records')) {
            let records = [...this.db.data.point_records];
            
            if (this.params.length > 0 && sql.includes('student_id = ?')) {
                const studentId = this.params[0];
                records = records.filter(r => r.student_id === studentId);
            }
            
            return { results: records };
        }

        if (sql.includes('select * from products')) {
            let products = [...this.db.data.products];
            
            if (sql.includes('is_active = 1')) {
                products = products.filter(p => p.is_active);
            }
            
            return { results: products };
        }

        if (sql.includes('select * from orders')) {
            return { results: [...this.db.data.orders] };
        }

        if (sql.includes('select * from reward_penalty_items')) {
            return { results: this.db.data.reward_penalty_items.filter(i => i.is_active) };
        }

        if (sql.includes('select u.*, coalesce(sum(pr.amount), 0) as points')) {
            const users = this.db.data.users.filter(u => u.role === 'student' && u.is_active);
            const results = users.map(user => {
                const records = this.db.data.point_records.filter(r => r.student_id === user.id);
                const points = records.reduce((sum, r) => sum + r.amount, 0);
                return { ...user, points };
            });
            
            results.sort((a, b) => b.points - a.points);
            return { results: results.slice(0, this.params[0] || 50) };
        }

        return { results: [] };
    }
}

describe('D1StorageAdapter', () => {
    let adapter;
    let mockDb;
    const testClassId = 'default';

    beforeAll(async () => {
        mockDb = new MockD1Database();
        adapter = new D1StorageAdapter({
            db: mockDb
        });
        
        await adapter.connect();
    });

    beforeEach(() => {
        // 清空测试数据
        mockDb.data = {
            users: [],
            point_records: [],
            products: [],
            orders: [],
            reward_penalty_items: []
        };
    });

    describe('连接管理', () => {
        test('应该能够连接到D1数据库', async () => {
            expect(adapter.isConnected).toBe(true);
        });

        test('健康检查应该返回正常状态', async () => {
            const health = await adapter.healthCheck();
            expect(health.status).toBe('healthy');
            expect(health.message).toContain('D1数据库连接正常');
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
                studentNumber: '001',
                username: '001'
            };

            const student = await adapter.createStudent(testClassId, studentData);
            
            expect(student).toBeDefined();
            expect(student).not.toBeNull();
            if (student) {
                expect(student.name).toBe('张三');
                expect(student.studentNumber).toBe('001');
            }
        });

        test('应该能够获取学生列表', async () => {
            // 创建测试学生
            await adapter.createStudent(testClassId, {
                name: '张三',
                studentNumber: '001'
            });
            await adapter.createStudent(testClassId, {
                name: '李四',
                studentNumber: '002'
            });

            const students = await adapter.getStudents(testClassId);
            
            expect(students).toHaveLength(2);
            expect(students.find(s => s.name === '张三')).toBeDefined();
            expect(students.find(s => s.name === '李四')).toBeDefined();
        });

        test('应该能够根据学号查找学生', async () => {
            await adapter.createStudent(testClassId, {
                name: '张三',
                studentNumber: '001'
            });

            const student = await adapter.getStudentByNumber(testClassId, '001');
            
            expect(student).toBeDefined();
            expect(student.name).toBe('张三');
        });

        test('应该能够更新学生信息', async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                studentNumber: '001'
            });

            const updated = await adapter.updateStudent(testClassId, student.id, {
                name: '张三丰'
            });
            
            expect(updated.name).toBe('张三丰');
        });

        test('应该能够删除学生', async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                studentNumber: '001'
            });

            const result = await adapter.deleteStudent(testClassId, student.id);
            expect(result).toBe(true);

            const found = await adapter.getStudentById(testClassId, student.id);
            expect(found).toBeNull();
        });
    });

    describe('积分管理', () => {
        let studentId;

        beforeEach(async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                studentNumber: '001'
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
                studentNumber: '002'
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
    });

    describe('预约管理', () => {
        let studentId, productId;

        beforeEach(async () => {
            const student = await adapter.createStudent(testClassId, {
                name: '张三',
                studentNumber: '001'
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
        });
    });

    describe('数据导入导出', () => {
        test('应该能够导出班级数据', async () => {
            // 创建测试数据
            await adapter.createStudent(testClassId, {
                name: '张三',
                studentNumber: '001'
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
    });
});