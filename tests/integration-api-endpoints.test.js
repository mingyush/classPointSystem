/**
 * API接口集成测试
 * 测试所有API端点的集成功能
 */

const request = require('supertest');
const app = require('../server');
const DataInitializer = require('../utils/dataInitializer');

describe('API接口集成测试', () => {
    let server;
    let teacherToken;
    let studentToken;
    
    const testData = {
        teacher: {
            teacherId: 'api_teacher',
            password: 'admin123'
        },
        student: {
            id: 'API001',
            name: 'API测试学生',
            class: 'API测试班'
        },
        product: {
            name: 'API测试商品',
            price: 25,
            stock: 5
        }
    };

    beforeAll(async () => {
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        
        server = app.listen(0);
        await setupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
        if (server) {
            server.close();
        }
    });

    async function setupTestData() {
        // 获取认证令牌
        const teacherResponse = await request(app)
            .post('/api/auth/teacher-login')
            .send(testData.teacher);
        teacherToken = teacherResponse.body.data.token;

        // 创建测试学生
        await request(app)
            .post('/api/students')
            .set('Authorization', `Bearer ${teacherToken}`)
            .send(testData.student);

        const studentResponse = await request(app)
            .post('/api/auth/student-login')
            .send({ studentId: testData.student.id });
        studentToken = studentResponse.body.data.token;
    }

    async function cleanupTestData() {
        try {
            await request(app)
                .delete(`/api/students/${testData.student.id}`)
                .set('Authorization', `Bearer ${teacherToken}`);
        } catch (error) {
            // 忽略清理错误
        }
    }

    describe('认证API集成测试', () => {
        test('POST /api/auth/teacher-login - 教师登录', async () => {
            const response = await request(app)
                .post('/api/auth/teacher-login')
                .send(testData.teacher)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.userType).toBe('teacher');
        });

        test('POST /api/auth/student-login - 学生登录', async () => {
            const response = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId: testData.student.id })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.userType).toBe('student');
        });

        test('POST /api/auth/teacher-login - 错误密码', async () => {
            const response = await request(app)
                .post('/api/auth/teacher-login')
                .send({
                    teacherId: testData.teacher.teacherId,
                    password: 'wrong_password'
                })
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('INVALID_CREDENTIALS');
        });

        test('POST /api/auth/student-login - 不存在的学生', async () => {
            const response = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId: 'NONEXISTENT' })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('STUDENT_NOT_FOUND');
        });
    });

    describe('学生管理API集成测试', () => {
        test('GET /api/students - 获取学生列表（教师权限）', async () => {
            const response = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.students)).toBe(true);
            
            const testStudent = response.body.data.students.find(s => s.id === testData.student.id);
            expect(testStudent).toBeDefined();
        });

        test('GET /api/students - 学生访问被拒绝', async () => {
            const response = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });

        test('GET /api/students/:id - 学生查看自己信息', async () => {
            const response = await request(app)
                .get(`/api/students/${testData.student.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.student.id).toBe(testData.student.id);
            expect(response.body.data.rank).toBeDefined();
        });

        test('GET /api/students/:id - 学生访问他人信息被拒绝', async () => {
            const response = await request(app)
                .get('/api/students/OTHER_STUDENT')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('ACCESS_DENIED');
        });

        test('POST /api/students - 创建学生（教师权限）', async () => {
            const newStudent = {
                id: 'API002',
                name: '新API学生',
                class: 'API测试班'
            };

            const response = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send(newStudent)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.student.id).toBe(newStudent.id);

            // 清理
            await request(app)
                .delete(`/api/students/${newStudent.id}`)
                .set('Authorization', `Bearer ${teacherToken}`);
        });

        test('POST /api/students - 学生创建被拒绝', async () => {
            const response = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    id: 'SHOULD_FAIL',
                    name: '应该失败',
                    class: '测试班'
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });
    });

    describe('积分管理API集成测试', () => {
        test('POST /api/points/add - 教师加分', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId: testData.student.id,
                    points: 20,
                    reason: 'API测试加分'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.points).toBe(20);
            expect(response.body.data.newBalance).toBe(20);
        });

        test('POST /api/points/subtract - 教师减分', async () => {
            const response = await request(app)
                .post('/api/points/subtract')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId: testData.student.id,
                    points: 5,
                    reason: 'API测试减分'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.points).toBe(-5);
            expect(response.body.data.newBalance).toBe(15);
        });

        test('POST /api/points/add - 学生操作被拒绝', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    studentId: testData.student.id,
                    points: 10,
                    reason: '学生不能加分'
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });

        test('GET /api/points/rankings - 获取排行榜', async () => {
            const response = await request(app)
                .get('/api/points/rankings')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.total).toBeDefined();
            expect(response.body.data.daily).toBeDefined();
            expect(response.body.data.weekly).toBeDefined();
            expect(Array.isArray(response.body.data.total)).toBe(true);
        });

        test('GET /api/points/history/:studentId - 获取积分历史', async () => {
            const response = await request(app)
                .get(`/api/points/history/${testData.student.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.records)).toBe(true);
            expect(response.body.data.records.length).toBeGreaterThan(0);
        });

        test('POST /api/points/add - 无效学生ID', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId: 'INVALID_ID',
                    points: 10,
                    reason: '测试无效ID'
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('STUDENT_NOT_FOUND');
        });

        test('POST /api/points/add - 无效积分数值', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId: testData.student.id,
                    points: -10, // 负数应该用subtract接口
                    reason: '测试无效积分'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('INVALID_POINTS');
        });
    });

    describe('商品管理API集成测试', () => {
        let productId;

        test('POST /api/products - 创建商品（教师权限）', async () => {
            const response = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send(testData.product)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.product.name).toBe(testData.product.name);
            expect(response.body.data.product.price).toBe(testData.product.price);
            
            productId = response.body.data.product.id;
        });

        test('GET /api/products - 获取商品列表', async () => {
            const response = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.products)).toBe(true);
            
            const testProduct = response.body.data.products.find(p => p.id === productId);
            expect(testProduct).toBeDefined();
        });

        test('PUT /api/products/:id - 更新商品（教师权限）', async () => {
            const updateData = {
                name: '更新后的商品名',
                price: 30,
                stock: 8
            };

            const response = await request(app)
                .put(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .send(updateData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.product.name).toBe(updateData.name);
            expect(response.body.data.product.price).toBe(updateData.price);
        });

        test('PUT /api/products/:id - 学生更新被拒绝', async () => {
            const response = await request(app)
                .put(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ name: '学生不能修改' })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });

        test('DELETE /api/products/:id - 删除商品（教师权限）', async () => {
            const response = await request(app)
                .delete(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('GET /api/products/:id - 获取不存在的商品', async () => {
            const response = await request(app)
                .get(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
        });
    });

    describe('订单管理API集成测试', () => {
        let productId;
        let orderId;

        beforeAll(async () => {
            // 创建测试商品
            const productResponse = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    name: '订单测试商品',
                    price: 10,
                    stock: 3
                });
            productId = productResponse.body.data.product.id;
        });

        afterAll(async () => {
            // 清理测试商品
            try {
                await request(app)
                    .delete(`/api/products/${productId}`)
                    .set('Authorization', `Bearer ${teacherToken}`);
            } catch (error) {
                // 忽略清理错误
            }
        });

        test('POST /api/orders/reserve - 学生预约商品', async () => {
            const response = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ productId })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.order.status).toBe('pending');
            expect(response.body.data.order.productId).toBe(productId);
            
            orderId = response.body.data.order.id;
        });

        test('GET /api/orders/pending - 教师查看待确认订单', async () => {
            const response = await request(app)
                .get('/api/orders/pending')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.orders)).toBe(true);
            
            const testOrder = response.body.data.orders.find(o => o.id === orderId);
            expect(testOrder).toBeDefined();
        });

        test('GET /api/orders/pending - 学生访问被拒绝', async () => {
            const response = await request(app)
                .get('/api/orders/pending')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });

        test('POST /api/orders/:id/confirm - 教师确认订单', async () => {
            const response = await request(app)
                .post(`/api/orders/${orderId}/confirm`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.order.status).toBe('confirmed');
        });

        test('POST /api/orders/reserve - 积分不足预约失败', async () => {
            // 创建高价商品
            const expensiveProductResponse = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    name: '昂贵商品',
                    price: 1000,
                    stock: 1
                });

            const response = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ productId: expensiveProductResponse.body.data.product.id })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('INSUFFICIENT_POINTS');

            // 清理
            await request(app)
                .delete(`/api/products/${expensiveProductResponse.body.data.product.id}`)
                .set('Authorization', `Bearer ${teacherToken}`);
        });
    });

    describe('系统配置API集成测试', () => {
        test('GET /api/config/mode - 获取系统模式', async () => {
            const response = await request(app)
                .get('/api/config/mode')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(['normal', 'class']).toContain(response.body.data.mode);
        });

        test('POST /api/config/mode - 教师切换模式', async () => {
            const response = await request(app)
                .post('/api/config/mode')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ mode: 'class' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.mode).toBe('class');
        });

        test('POST /api/config/mode - 学生切换被拒绝', async () => {
            const response = await request(app)
                .post('/api/config/mode')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ mode: 'normal' })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });

        test('POST /api/config/mode - 无效模式', async () => {
            const response = await request(app)
                .post('/api/config/mode')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ mode: 'invalid_mode' })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('INVALID_MODE');
        });
    });

    describe('健康检查API集成测试', () => {
        test('GET /api/health - 系统健康检查', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.status).toBe('HEALTHY');
            expect(response.body.timestamp).toBeDefined();
        });
    });

    describe('备份API集成测试', () => {
        test('POST /api/backup/create - 创建备份（教师权限）', async () => {
            const response = await request(app)
                .post('/api/backup/create')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.backupPath).toBeDefined();
        });

        test('GET /api/backup/list - 获取备份列表（教师权限）', async () => {
            const response = await request(app)
                .get('/api/backup/list')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.backups)).toBe(true);
        });

        test('POST /api/backup/create - 学生访问被拒绝', async () => {
            const response = await request(app)
                .post('/api/backup/create')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });
    });

    describe('SSE API集成测试', () => {
        test('GET /api/sse/status - 获取SSE状态', async () => {
            const response = await request(app)
                .get('/api/sse/status')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.activeConnections).toBeDefined();
            expect(Array.isArray(response.body.data.connections)).toBe(true);
        });

        test('POST /api/sse/test - 发送测试消息（教师权限）', async () => {
            const testMessage = {
                event: 'api_test',
                message: 'API集成测试消息'
            };

            const response = await request(app)
                .post('/api/sse/test')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send(testMessage)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.event).toBe(testMessage.event);
        });

        test('POST /api/sse/test - 学生访问被拒绝', async () => {
            const response = await request(app)
                .post('/api/sse/test')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    event: 'test',
                    message: '学生测试'
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('TEACHER_REQUIRED');
        });
    });

    describe('参数验证集成测试', () => {
        test('缺少必需参数', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    // 缺少studentId
                    points: 10,
                    reason: '测试'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('VALIDATION_ERROR');
        });

        test('无效的JSON格式', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .set('Content-Type', 'application/json')
                .send('invalid json')
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        test('超大请求体', async () => {
            const largeData = {
                studentId: testData.student.id,
                points: 10,
                reason: 'x'.repeat(1000000) // 1MB的字符串
            };

            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send(largeData)
                .expect(413);

            expect(response.body.success).toBe(false);
        });
    });
});