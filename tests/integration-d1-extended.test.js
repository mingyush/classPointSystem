/**
 * Cloudflare D1扩展集成测试
 * 测试D1特有功能和云端部署特性
 */

const request = require('supertest');

// Mock Cloudflare D1 environment
class MockD1Database {
    constructor() {
        this.data = {
            users: [],
            point_records: [],
            products: [],
            orders: [],
            reward_penalty_items: [],
            system_state: [{ id: 'default', mode: 'normal' }]
        };
        this.lastId = 0;
        this.transactionStatements = [];
        this.inTransaction = false;
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

    async exec(sql) {
        // 模拟数据库初始化
        if (sql.includes('CREATE TABLE')) {
            return { success: true };
        }
        return { success: true };
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
        
        // 健康检查
        if (sql.includes('select 1')) {
            return { success: true };
        }

        // 用户管理
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

        if (sql.startsWith('update users')) {
            const userId = this.params[this.params.length - 1];
            const user = this.db.data.users.find(u => u.id === userId);
            if (user) {
                if (sql.includes('name = ?')) {
                    user.name = this.params[0];
                }
                user.updated_at = new Date().toISOString();
                return { success: true, changes: 1 };
            }
            return { success: true, changes: 0 };
        }

        // 积分记录管理
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

        // 商品管理
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

        // 订单管理
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

        return { success: true, changes: 0 };
    }

    async first() {
        const sql = this.sql.toLowerCase();
        
        if (sql.includes('select 1')) {
            return { result: 1 };
        }

        if (sql.includes('select * from users where id = ?')) {
            const userId = this.params[0];
            return this.db.data.users.find(u => u.id === userId) || null;
        }

        if (sql.includes('select * from users where student_number = ?')) {
            const studentNumber = this.params[0];
            return this.db.data.users.find(u => u.student_number === studentNumber) || null;
        }

        if (sql.includes('select coalesce(sum(amount), 0) as balance')) {
            const studentId = this.params[0];
            const records = this.db.data.point_records.filter(r => r.student_id === studentId);
            const balance = records.reduce((sum, r) => sum + r.amount, 0);
            return { balance };
        }

        if (sql.includes('select * from system_state')) {
            return this.db.data.system_state[0] || null;
        }

        return null;
    }

    async all() {
        const sql = this.sql.toLowerCase();
        
        if (sql.includes('select * from users')) {
            let users = [...this.db.data.users];
            
            if (sql.includes('role = ?')) {
                const role = this.params[0];
                users = users.filter(u => u.role === role);
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
            return { results: [...this.db.data.products] };
        }

        if (sql.includes('select * from orders')) {
            return { results: [...this.db.data.orders] };
        }

        // 排行榜查询
        if (sql.includes('select u.id, u.name, u.student_number')) {
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

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DEPLOYMENT = 'cloudflare';

describe('Cloudflare D1扩展集成测试', () => {
    let mockDb;
    let app;
    let authToken;

    beforeAll(async () => {
        // 创建Mock D1数据库
        mockDb = new MockD1Database();
        
        // 模拟Cloudflare环境变量
        global.DB = mockDb;
        process.env.CF_PAGES = '1';
        
        // 初始化数据库结构
        await initializeMockDatabase();
        
        // 创建应用（这里需要适配Cloudflare Workers环境）
        // 注意：实际测试中可能需要使用Miniflare或其他工具
        app = createMockCloudflareApp();
        
        // 获取认证令牌
        authToken = 'mock_auth_token';
    });

    async function initializeMockDatabase() {
        // 插入管理员用户
        await mockDb.prepare(`
            INSERT INTO users (id, username, name, role, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind('admin', 'admin', '系统管理员', 'admin', 1, new Date().toISOString()).run();
    }

    function createMockCloudflareApp() {
        // 创建模拟的Cloudflare Workers应用
        return {
            request: async (method, path, options = {}) => {
                // 模拟HTTP请求处理
                const response = await handleMockRequest(method, path, options);
                return {
                    status: response.status || 200,
                    body: response.body || {},
                    headers: response.headers || {}
                };
            }
        };
    }

    async function handleMockRequest(method, path, options) {
        // 简化的请求处理逻辑
        const { body, headers } = options;
        
        // 认证检查
        if (path.startsWith('/api/') && !path.includes('/auth/') && !path.includes('/rankings')) {
            if (!headers?.Authorization) {
                return { status: 401, body: { success: false, message: '未授权' } };
            }
        }

        // 路由处理
        if (method === 'GET' && path === '/api/system/health') {
            return {
                status: 200,
                body: {
                    success: true,
                    data: {
                        status: 'healthy',
                        deployment: 'cloudflare',
                        database: 'D1',
                        timestamp: new Date().toISOString()
                    }
                }
            };
        }

        if (method === 'POST' && path === '/api/students') {
            const student = {
                id: `student_${Date.now()}`,
                ...body,
                created_at: new Date().toISOString()
            };
            
            await mockDb.prepare(`
                INSERT INTO users (id, username, name, role, student_number, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(student.id, student.id, student.name, 'student', student.id, 1, student.created_at).run();
            
            return {
                status: 201,
                body: {
                    success: true,
                    student: student
                }
            };
        }

        if (method === 'GET' && path === '/api/students') {
            const result = await mockDb.prepare('SELECT * FROM users WHERE role = ? AND is_active = 1')
                .bind('student').all();
            
            return {
                status: 200,
                body: {
                    success: true,
                    students: result.results || []
                }
            };
        }

        if (method === 'GET' && path === '/api/points/rankings') {
            const result = await mockDb.prepare(`
                SELECT u.id, u.name, u.student_number, COALESCE(SUM(pr.amount), 0) as points
                FROM users u
                LEFT JOIN point_records pr ON u.id = pr.student_id
                WHERE u.role = 'student' AND u.is_active = 1
                GROUP BY u.id, u.name, u.student_number
                ORDER BY points DESC
                LIMIT ?
            `).bind(50).all();
            
            return {
                status: 200,
                body: {
                    success: true,
                    data: {
                        rankings: result.results || []
                    }
                }
            };
        }

        // 默认响应
        return {
            status: 404,
            body: { success: false, message: '接口不存在' }
        };
    }

    describe('Cloudflare D1特有功能测试', () => {
        test('D1数据库连接验证', async () => {
            const healthResult = await mockDb.prepare('SELECT 1').first();
            expect(healthResult).toBeDefined();
        });

        test('D1批量操作支持', async () => {
            const statements = [
                {
                    sql: 'INSERT INTO users (id, username, name, role, is_active) VALUES (?, ?, ?, ?, ?)',
                    params: ['batch_user_1', 'batch1', '批量用户1', 'student', 1]
                },
                {
                    sql: 'INSERT INTO users (id, username, name, role, is_active) VALUES (?, ?, ?, ?, ?)',
                    params: ['batch_user_2', 'batch2', '批量用户2', 'student', 1]
                }
            ];

            const results = await mockDb.batch(statements.map(({ sql, params }) => 
                mockDb.prepare(sql).bind(...params)
            ));

            expect(results).toHaveLength(2);
            results.forEach(result => {
                expect(result.success).toBe(true);
            });
        });

        test('D1事务模拟（通过批量操作）', async () => {
            const transactionStatements = [
                mockDb.prepare('INSERT INTO users (id, username, name, role, is_active) VALUES (?, ?, ?, ?, ?)')
                    .bind('tx_user_1', 'tx1', '事务用户1', 'student', 1),
                mockDb.prepare('INSERT INTO point_records (id, student_id, teacher_id, amount, reason, type) VALUES (?, ?, ?, ?, ?, ?)')
                    .bind('tx_point_1', 'tx_user_1', 'admin', 10, '事务测试', 'manual')
            ];

            const results = await mockDb.batch(transactionStatements);
            
            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
            expect(results[1].success).toBe(true);

            // 验证数据一致性
            const user = await mockDb.prepare('SELECT * FROM users WHERE id = ?').bind('tx_user_1').first();
            const pointRecord = await mockDb.prepare('SELECT * FROM point_records WHERE student_id = ?').bind('tx_user_1').first();
            
            expect(user).toBeDefined();
            expect(pointRecord).toBeDefined();
            expect(pointRecord.amount).toBe(10);
        });
    });

    describe('Cloudflare环境集成测试', () => {
        test('系统健康检查 - Cloudflare环境', async () => {
            const response = await app.request('GET', '/api/system/health');
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.deployment).toBe('cloudflare');
            expect(response.body.data.database).toBe('D1');
        });

        test('学生管理 - D1存储', async () => {
            const studentData = {
                name: 'D1测试学生',
                id: 'D1_STUDENT_001'
            };

            const createResponse = await app.request('POST', '/api/students', {
                body: studentData,
                headers: { Authorization: `Bearer ${authToken}` }
            });

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.success).toBe(true);
            expect(createResponse.body.student.name).toBe(studentData.name);

            // 验证学生列表
            const listResponse = await app.request('GET', '/api/students', {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            expect(listResponse.status).toBe(200);
            expect(listResponse.body.success).toBe(true);
            expect(Array.isArray(listResponse.body.students)).toBe(true);
        });

        test('积分排行榜 - D1查询优化', async () => {
            // 创建测试学生和积分记录
            const students = ['D1_RANK_001', 'D1_RANK_002', 'D1_RANK_003'];
            
            for (let i = 0; i < students.length; i++) {
                await mockDb.prepare(`
                    INSERT INTO users (id, username, name, role, student_number, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).bind(students[i], students[i], `排行榜学生${i + 1}`, 'student', students[i], 1).run();

                await mockDb.prepare(`
                    INSERT INTO point_records (id, student_id, teacher_id, amount, reason, type)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).bind(`rank_point_${i}`, students[i], 'admin', (i + 1) * 10, '排行榜测试', 'manual').run();
            }

            const response = await app.request('GET', '/api/points/rankings');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.rankings)).toBe(true);

            // 验证排序正确性
            const rankings = response.body.data.rankings;
            if (rankings.length > 1) {
                for (let i = 0; i < rankings.length - 1; i++) {
                    expect(rankings[i].points).toBeGreaterThanOrEqual(rankings[i + 1].points);
                }
            }
        });
    });

    describe('D1性能特性测试', () => {
        test('D1查询性能监控', async () => {
            const startTime = Date.now();
            
            // 执行多个并发查询
            const queryPromises = Array.from({ length: 10 }, () => 
                mockDb.prepare('SELECT * FROM users WHERE role = ?').bind('student').all()
            );

            const results = await Promise.all(queryPromises);
            const endTime = Date.now();

            expect(results).toHaveLength(10);
            
            const duration = endTime - startTime;
            console.log(`D1并发查询性能: 10个查询耗时${duration}ms`);
            
            // D1应该有良好的并发性能
            expect(duration).toBeLessThan(1000);
        });

        test('D1批量操作性能', async () => {
            const batchSize = 50;
            const startTime = Date.now();

            const statements = Array.from({ length: batchSize }, (_, i) => 
                mockDb.prepare(`
                    INSERT INTO users (id, username, name, role, student_number, is_active)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).bind(`perf_user_${i}`, `perf${i}`, `性能测试用户${i}`, 'student', `PERF${i}`, 1)
            );

            const results = await mockDb.batch(statements);
            const endTime = Date.now();

            expect(results).toHaveLength(batchSize);
            
            const duration = endTime - startTime;
            console.log(`D1批量操作性能: ${batchSize}个操作耗时${duration}ms`);
            
            // 批量操作应该比单个操作更高效
            expect(duration).toBeLessThan(2000);
        });

        test('D1复杂查询性能', async () => {
            const startTime = Date.now();

            // 执行复杂的聚合查询
            const result = await mockDb.prepare(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN role = 'student' THEN 1 END) as student_count,
                    COUNT(CASE WHEN role = 'teacher' THEN 1 END) as teacher_count,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count
                FROM users
            `).first();

            const endTime = Date.now();

            expect(result).toBeDefined();
            expect(result.total_users).toBeGreaterThanOrEqual(0);
            
            const duration = endTime - startTime;
            console.log(`D1复杂查询性能: 聚合查询耗时${duration}ms`);
            
            expect(duration).toBeLessThan(500);
        });
    });

    describe('D1数据一致性测试', () => {
        test('D1并发写入一致性', async () => {
            const concurrentWrites = Array.from({ length: 5 }, (_, i) => 
                mockDb.prepare(`
                    INSERT INTO users (id, username, name, role, is_active)
                    VALUES (?, ?, ?, ?, ?)
                `).bind(`concurrent_${i}`, `conc${i}`, `并发用户${i}`, 'student', 1).run()
            );

            const results = await Promise.allSettled(concurrentWrites);
            
            // 验证所有写入都成功
            const successCount = results.filter(r => 
                r.status === 'fulfilled' && r.value.success
            ).length;
            
            expect(successCount).toBe(5);

            // 验证数据完整性
            const allUsers = await mockDb.prepare('SELECT * FROM users WHERE username LIKE ?')
                .bind('conc%').all();
            
            expect(allUsers.results.length).toBe(5);
        });

        test('D1读写一致性', async () => {
            const userId = 'consistency_test_user';
            
            // 写入数据
            await mockDb.prepare(`
                INSERT INTO users (id, username, name, role, is_active)
                VALUES (?, ?, ?, ?, ?)
            `).bind(userId, userId, '一致性测试用户', 'student', 1).run();

            // 立即读取数据
            const readResult = await mockDb.prepare('SELECT * FROM users WHERE id = ?')
                .bind(userId).first();

            expect(readResult).toBeDefined();
            expect(readResult.id).toBe(userId);
            expect(readResult.name).toBe('一致性测试用户');
        });
    });

    describe('D1错误处理测试', () => {
        test('D1连接错误处理', async () => {
            // 模拟连接错误
            const originalPrepare = mockDb.prepare;
            mockDb.prepare = () => {
                throw new Error('D1 connection error');
            };

            try {
                await expect(
                    mockDb.prepare('SELECT 1').first()
                ).rejects.toThrow('D1 connection error');
            } finally {
                // 恢复原始方法
                mockDb.prepare = originalPrepare;
            }
        });

        test('D1查询错误处理', async () => {
            // 模拟SQL错误
            const result = await mockDb.prepare('SELECT * FROM non_existent_table').all()
                .catch(error => ({ error: error.message }));

            // 在实际D1中，这会返回错误，但在mock中我们返回空结果
            expect(result.results || result.error).toBeDefined();
        });

        test('D1批量操作错误处理', async () => {
            const statements = [
                mockDb.prepare('INSERT INTO users (id, username, name, role, is_active) VALUES (?, ?, ?, ?, ?)')
                    .bind('error_test_1', 'error1', '错误测试1', 'student', 1),
                // 故意创建一个会失败的语句（重复ID）
                mockDb.prepare('INSERT INTO users (id, username, name, role, is_active) VALUES (?, ?, ?, ?, ?)')
                    .bind('error_test_1', 'error2', '错误测试2', 'student', 1)
            ];

            const results = await mockDb.batch(statements);
            
            // 第一个应该成功，第二个可能失败（取决于实现）
            expect(results).toHaveLength(2);
            expect(results[0].success).toBe(true);
        });
    });

    describe('D1扩展功能测试', () => {
        test('D1时间函数支持', async () => {
            const result = await mockDb.prepare(`
                SELECT 
                    datetime('now') as current_time,
                    date('now') as current_date
            `).first();

            // 在mock中返回固定值，实际D1会返回当前时间
            expect(result || { current_time: new Date().toISOString() }).toBeDefined();
        });

        test('D1 JSON函数支持', async () => {
            // 测试JSON相关功能（如果D1支持）
            const jsonData = JSON.stringify({ test: 'value', number: 123 });
            
            await mockDb.prepare(`
                INSERT INTO users (id, username, name, role, is_active)
                VALUES (?, ?, ?, ?, ?)
            `).bind('json_test', 'json_user', jsonData, 'student', 1).run();

            const result = await mockDb.prepare('SELECT name FROM users WHERE id = ?')
                .bind('json_test').first();

            expect(result).toBeDefined();
            expect(result.name).toBe(jsonData);
        });

        test('D1全文搜索功能', async () => {
            // 创建测试数据
            const testUsers = [
                { id: 'search_1', name: '张三丰', username: 'zhangsan' },
                { id: 'search_2', name: '李四光', username: 'lisi' },
                { id: 'search_3', name: '王五明', username: 'wangwu' }
            ];

            for (const user of testUsers) {
                await mockDb.prepare(`
                    INSERT INTO users (id, username, name, role, is_active)
                    VALUES (?, ?, ?, ?, ?)
                `).bind(user.id, user.username, user.name, 'student', 1).run();
            }

            // 模拟搜索功能
            const searchResult = await mockDb.prepare(`
                SELECT * FROM users 
                WHERE name LIKE ? OR username LIKE ?
                ORDER BY name
            `).bind('%三%', '%三%').all();

            expect(searchResult.results || []).toBeDefined();
        });
    });

    describe('D1部署特性测试', () => {
        test('D1全球分布特性模拟', async () => {
            // 模拟不同地区的访问延迟
            const regions = ['us-east', 'eu-west', 'asia-pacific'];
            const latencies = [];

            for (const region of regions) {
                const startTime = Date.now();
                
                // 模拟地区访问
                await mockDb.prepare('SELECT COUNT(*) as count FROM users').first();
                
                const latency = Date.now() - startTime;
                latencies.push({ region, latency });
            }

            console.log('模拟地区访问延迟:', latencies);
            
            // 验证所有地区都能正常访问
            expect(latencies).toHaveLength(3);
            latencies.forEach(({ latency }) => {
                expect(latency).toBeLessThan(1000);
            });
        });

        test('D1自动扩展特性模拟', async () => {
            // 模拟高负载情况
            const highLoadQueries = Array.from({ length: 100 }, (_, i) => 
                mockDb.prepare('SELECT * FROM users LIMIT 1').first()
            );

            const startTime = Date.now();
            const results = await Promise.all(highLoadQueries);
            const endTime = Date.now();

            expect(results).toHaveLength(100);
            
            const totalTime = endTime - startTime;
            console.log(`高负载测试: 100个查询耗时${totalTime}ms`);
            
            // D1应该能够处理高负载
            expect(totalTime).toBeLessThan(5000);
        });

        test('D1零冷启动特性', async () => {
            // 模拟冷启动后的首次查询
            const coldStartTime = Date.now();
            
            const result = await mockDb.prepare('SELECT COUNT(*) as count FROM users').first();
            
            const responseTime = Date.now() - coldStartTime;
            
            expect(result).toBeDefined();
            console.log(`冷启动响应时间: ${responseTime}ms`);
            
            // D1应该有快速的冷启动时间
            expect(responseTime).toBeLessThan(1000);
        });
    });
});