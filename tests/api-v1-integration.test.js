/**
 * API V1 集成测试
 * 测试简化后的单班级API接口
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite';
process.env.DB_PATH = ':memory:'; // 使用内存数据库进行测试

const app = require('../server');

describe('API V1 集成测试', () => {
    let authToken;
    let studentId;
    let productId;
    let rewardPenaltyItemId;

    beforeAll(async () => {
        // 等待数据库初始化完成
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    afterAll(async () => {
        // 清理测试数据
        if (app && app.close) {
            app.close();
        }
    });

    describe('认证API', () => {
        test('教师登录', async () => {
            const response = await request(app)
                .post('/api/auth/teacher-login')
                .send({
                    teacherId: 'admin',
                    password: 'admin123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            
            authToken = response.body.data.token;
        });

        test('学生查询（无需密码）', async () => {
            const response = await request(app)
                .post('/api/auth/student-login')
                .send({
                    studentId: '001'
                });

            // 学生可能不存在，这是正常的
            expect([200, 401]).toContain(response.status);
        });
    });

    describe('学生管理API', () => {
        test('创建学生', async () => {
            const response = await request(app)
                .post('/api/students')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    id: '001',
                    name: '测试学生',
                    balance: 100
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.student.id).toBe('001');
            
            studentId = response.body.student.id;
        });

        test('获取学生列表', async () => {
            const response = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.students)).toBe(true);
        });

        test('获取单个学生信息', async () => {
            const response = await request(app)
                .get(`/api/students/${studentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(studentId);
        });
    });

    describe('积分管理API', () => {
        test('加分操作', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    studentId: studentId,
                    points: 10,
                    reason: '测试加分'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.record).toBeDefined();
        });

        test('减分操作', async () => {
            const response = await request(app)
                .post('/api/points/subtract')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    studentId: studentId,
                    points: 5,
                    reason: '测试减分'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.record).toBeDefined();
        });

        test('获取积分排行榜', async () => {
            const response = await request(app)
                .get('/api/points/rankings');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.rankings)).toBe(true);
        });

        test('获取学生积分历史', async () => {
            const response = await request(app)
                .get(`/api/points/history/${studentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data.records)).toBe(true);
        });
    });

    describe('奖惩项管理API', () => {
        test('创建奖惩项', async () => {
            const response = await request(app)
                .post('/api/reward-penalty')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: '回答问题',
                    points: 5,
                    type: 'reward',
                    isActive: true
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('回答问题');
            
            rewardPenaltyItemId = response.body.data.id;
        });

        test('获取奖惩项列表', async () => {
            const response = await request(app)
                .get('/api/reward-penalty');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('应用奖惩项', async () => {
            const response = await request(app)
                .post(`/api/reward-penalty/${rewardPenaltyItemId}/apply`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    studentId: studentId
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.points).toBe(5);
        });
    });

    describe('商品管理API', () => {
        test('创建商品', async () => {
            const response = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: '测试商品',
                    price: 50,
                    stock: 10,
                    description: '测试用商品'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('测试商品');
            
            productId = response.body.data.id;
        });

        test('获取商品列表', async () => {
            const response = await request(app)
                .get('/api/products');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('预约管理API', () => {
        test('创建预约订单', async () => {
            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    studentId: studentId,
                    productId: productId,
                    quantity: 1
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.studentId).toBe(studentId);
        });

        test('获取订单列表', async () => {
            const response = await request(app)
                .get('/api/orders')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    describe('系统管理API', () => {
        test('获取系统状态', async () => {
            const response = await request(app)
                .get('/api/system/state');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.mode).toBeDefined();
        });

        test('切换到上课模式', async () => {
            const response = await request(app)
                .post('/api/system/state/class-mode')
                .send({
                    teacherId: 'admin'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('切换到平时模式', async () => {
            const response = await request(app)
                .post('/api/system/state/normal-mode');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        test('获取系统配置', async () => {
            const response = await request(app)
                .get('/api/system/config');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.storageType).toBeDefined();
        });

        test('系统健康检查', async () => {
            const response = await request(app)
                .get('/api/system/health');

            expect([200, 503]).toContain(response.status);
            expect(response.body.data).toBeDefined();
        });
    });

    describe('前端路由', () => {
        test('主页重定向到大屏', async () => {
            const response = await request(app)
                .get('/');

            expect(response.status).toBe(302);
            expect(response.headers.location).toBe('/display');
        });

        test('教室大屏路由', async () => {
            const response = await request(app)
                .get('/display');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('班级管理后台路由', async () => {
            const response = await request(app)
                .get('/admin');

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/html/);
        });

        test('兼容旧版路由', async () => {
            const teacherResponse = await request(app)
                .get('/teacher');

            expect(teacherResponse.status).toBe(302);
            expect(teacherResponse.headers.location).toBe('/admin');

            const studentResponse = await request(app)
                .get('/student');

            expect(studentResponse.status).toBe(302);
            expect(studentResponse.headers.location).toBe('/display');
        });
    });

    describe('错误处理', () => {
        test('无效的API路径', async () => {
            const response = await request(app)
                .get('/api/invalid-endpoint');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
        });

        test('未授权的操作', async () => {
            const response = await request(app)
                .post('/api/students')
                .send({
                    id: '002',
                    name: '测试学生2'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });

        test('无效的请求参数', async () => {
            const response = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    studentId: '',
                    points: -10,
                    reason: ''
                });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });
});