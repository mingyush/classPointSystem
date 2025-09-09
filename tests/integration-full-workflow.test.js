/**
 * 完整用户操作流程集成测试
 * 测试从学生登录到积分操作到商品预约的完整流程
 */

const request = require('supertest');
const app = require('../server');
const StudentService = require('../services/studentService');
const PointsService = require('../services/pointsService');
const ProductService = require('../services/productService');
const OrderService = require('../services/orderService');
const DataInitializer = require('../utils/dataInitializer');

describe('完整用户操作流程集成测试', () => {
    let server;
    let studentService;
    let pointsService;
    let productService;
    let orderService;
    let teacherToken;
    let studentToken;
    
    // 测试数据
    const testStudent = {
        id: 'FLOW001',
        name: '流程测试学生',
        class: '测试班级',
        balance: 0
    };
    
    const testProduct = {
        name: '测试奖品',
        price: 50,
        stock: 10,
        description: '用于流程测试的奖品'
    };
    
    const teacherCredentials = {
        teacherId: 'admin',
        password: 'admin123'
    };

    beforeAll(async () => {
        // 初始化数据
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        
        // 初始化服务
        studentService = new StudentService();
        pointsService = new PointsService();
        productService = new ProductService();
        orderService = new OrderService();
        
        // 启动测试服务器
        server = app.listen(0);
        
        // 准备测试数据
        await setupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
        if (server) {
            server.close();
        }
    });

    async function setupTestData() {
        try {
            // 创建测试学生
            await studentService.createStudent(testStudent);
            
            // 创建测试商品
            const product = await productService.createProduct(testProduct);
            testProduct.id = product.id;
            
            console.log('流程测试数据准备完成');
        } catch (error) {
            if (!error.message.includes('已存在')) {
                throw error;
            }
        }
    }

    async function cleanupTestData() {
        try {
            await studentService.deleteStudent(testStudent.id);
            if (testProduct.id) {
                await productService.deleteProduct(testProduct.id);
            }
            console.log('流程测试数据清理完成');
        } catch (error) {
            console.log('流程测试数据清理完成（部分失败）');
        }
    }

    describe('1. 认证流程测试', () => {
        test('教师登录流程', async () => {
            const response = await request(app)
                .post('/api/auth/teacher-login')
                .send(teacherCredentials)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.userType).toBe('teacher');
            
            teacherToken = response.body.data.token;
        });

        test('学生登录流程', async () => {
            const response = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId: testStudent.id })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data.token).toBeDefined();
            expect(response.body.data.user.userType).toBe('student');
            expect(response.body.data.user.studentId).toBe(testStudent.id);
            
            studentToken = response.body.data.token;
        });
    });

    describe('2. 积分管理完整流程', () => {
        test('教师为学生加分流程', async () => {
            const pointsToAdd = 30;
            const reason = '课堂表现优秀';

            // 教师加分操作
            const addResponse = await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId: testStudent.id,
                    points: pointsToAdd,
                    reason: reason
                })
                .expect(200);

            expect(addResponse.body.success).toBe(true);
            expect(addResponse.body.data.newBalance).toBe(pointsToAdd);
            expect(addResponse.body.data.points).toBe(pointsToAdd);

            // 验证学生积分余额
            const balanceResponse = await request(app)
                .get(`/api/students/${testStudent.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(balanceResponse.body.data.student.balance).toBe(pointsToAdd);
            expect(balanceResponse.body.data.rank).toBeGreaterThan(0);
        });

        test('查看积分历史记录', async () => {
            const historyResponse = await request(app)
                .get(`/api/points/history/${testStudent.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(historyResponse.body.success).toBe(true);
            expect(historyResponse.body.data.records).toHaveLength(1);
            expect(historyResponse.body.data.records[0].points).toBe(30);
            expect(historyResponse.body.data.records[0].type).toBe('add');
        });

        test('教师为学生减分流程', async () => {
            const pointsToSubtract = 10;
            const reason = '迟到扣分';

            const subtractResponse = await request(app)
                .post('/api/points/subtract')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId: testStudent.id,
                    points: pointsToSubtract,
                    reason: reason
                })
                .expect(200);

            expect(subtractResponse.body.success).toBe(true);
            expect(subtractResponse.body.data.newBalance).toBe(20); // 30 - 10
            expect(subtractResponse.body.data.points).toBe(-pointsToSubtract);
        });
    });

    describe('3. 排行榜查询流程', () => {
        test('查看积分排行榜', async () => {
            const rankingsResponse = await request(app)
                .get('/api/points/rankings')
                .expect(200);

            expect(rankingsResponse.body.success).toBe(true);
            expect(rankingsResponse.body.data.total).toBeDefined();
            expect(rankingsResponse.body.data.daily).toBeDefined();
            expect(rankingsResponse.body.data.weekly).toBeDefined();

            // 验证测试学生在排行榜中
            const totalRankings = rankingsResponse.body.data.total;
            const testStudentRank = totalRankings.find(s => s.id === testStudent.id);
            expect(testStudentRank).toBeDefined();
            expect(testStudentRank.balance).toBe(20);
        });
    });

    describe('4. 商品预约完整流程', () => {
        test('学生浏览商品列表', async () => {
            const productsResponse = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(productsResponse.body.success).toBe(true);
            expect(productsResponse.body.data.products).toBeDefined();
            
            const testProductInList = productsResponse.body.data.products.find(p => p.id === testProduct.id);
            expect(testProductInList).toBeDefined();
            expect(testProductInList.price).toBe(testProduct.price);
        });

        test('学生预约商品失败（积分不足）', async () => {
            // 当前学生积分20，商品价格50，应该失败
            const reserveResponse = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    productId: testProduct.id
                })
                .expect(400);

            expect(reserveResponse.body.success).toBe(false);
            expect(reserveResponse.body.code).toBe('INSUFFICIENT_POINTS');
        });

        test('教师增加学生积分后成功预约', async () => {
            // 先增加积分
            await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId: testStudent.id,
                    points: 40,
                    reason: '补充积分用于测试'
                })
                .expect(200);

            // 现在预约应该成功（总积分60）
            const reserveResponse = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({
                    productId: testProduct.id
                })
                .expect(200);

            expect(reserveResponse.body.success).toBe(true);
            expect(reserveResponse.body.data.order.status).toBe('pending');
            expect(reserveResponse.body.data.order.productId).toBe(testProduct.id);
            
            // 保存订单ID用于后续测试
            testProduct.orderId = reserveResponse.body.data.order.id;
        });

        test('验证积分被冻结', async () => {
            const balanceResponse = await request(app)
                .get(`/api/students/${testStudent.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            // 积分应该被冻结，但余额显示应该减去冻结的积分
            expect(balanceResponse.body.data.student.balance).toBe(10); // 60 - 50
        });

        test('教师查看待确认订单', async () => {
            const pendingOrdersResponse = await request(app)
                .get('/api/orders/pending')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(pendingOrdersResponse.body.success).toBe(true);
            expect(pendingOrdersResponse.body.data.orders).toBeDefined();
            
            const testOrder = pendingOrdersResponse.body.data.orders.find(o => o.id === testProduct.orderId);
            expect(testOrder).toBeDefined();
            expect(testOrder.status).toBe('pending');
        });

        test('教师确认订单完成兑换', async () => {
            const confirmResponse = await request(app)
                .post(`/api/orders/${testProduct.orderId}/confirm`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(confirmResponse.body.success).toBe(true);
            expect(confirmResponse.body.data.order.status).toBe('confirmed');

            // 验证积分已扣除
            const balanceResponse = await request(app)
                .get(`/api/students/${testStudent.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            expect(balanceResponse.body.data.student.balance).toBe(10);

            // 验证商品库存减少
            const productsResponse = await request(app)
                .get('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            const updatedProduct = productsResponse.body.data.products.find(p => p.id === testProduct.id);
            expect(updatedProduct.stock).toBe(testProduct.stock - 1);
        });
    });

    describe('5. 系统模式切换流程', () => {
        test('查看当前系统模式', async () => {
            const modeResponse = await request(app)
                .get('/api/config/mode')
                .expect(200);

            expect(modeResponse.body.success).toBe(true);
            expect(['normal', 'class']).toContain(modeResponse.body.data.mode);
        });

        test('教师切换系统模式', async () => {
            const newMode = 'class';
            const switchResponse = await request(app)
                .post('/api/config/mode')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ mode: newMode })
                .expect(200);

            expect(switchResponse.body.success).toBe(true);
            expect(switchResponse.body.data.mode).toBe(newMode);

            // 验证模式已切换
            const verifyResponse = await request(app)
                .get('/api/config/mode')
                .expect(200);

            expect(verifyResponse.body.data.mode).toBe(newMode);
        });
    });

    describe('6. 数据一致性验证', () => {
        test('验证积分记录与余额一致性', async () => {
            // 获取积分历史
            const historyResponse = await request(app)
                .get(`/api/points/history/${testStudent.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            // 计算历史记录总和
            const totalFromHistory = historyResponse.body.data.records.reduce((sum, record) => {
                return sum + record.points;
            }, 0);

            // 获取当前余额
            const balanceResponse = await request(app)
                .get(`/api/students/${testStudent.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            const currentBalance = balanceResponse.body.data.student.balance;

            // 验证一致性（考虑已确认的订单扣除）
            expect(totalFromHistory - 50).toBe(currentBalance); // 减去已确认订单的50积分
        });

        test('验证排行榜数据一致性', async () => {
            const rankingsResponse = await request(app)
                .get('/api/points/rankings')
                .expect(200);

            const studentResponse = await request(app)
                .get(`/api/students/${testStudent.id}`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            const studentInRankings = rankingsResponse.body.data.total.find(s => s.id === testStudent.id);
            const studentBalance = studentResponse.body.data.student.balance;

            expect(studentInRankings.balance).toBe(studentBalance);
        });
    });

    describe('7. 错误处理流程', () => {
        test('处理无效学生ID', async () => {
            const response = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId: 'INVALID_ID' })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('STUDENT_NOT_FOUND');
        });

        test('处理无效商品预约', async () => {
            const response = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ productId: 'INVALID_PRODUCT_ID' })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
        });

        test('处理重复预约', async () => {
            // 先创建一个新商品用于测试
            const newProduct = await productService.createProduct({
                name: '重复测试商品',
                price: 5,
                stock: 1
            });

            // 第一次预约
            await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ productId: newProduct.id })
                .expect(200);

            // 第二次预约同一商品应该失败
            const response = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ productId: newProduct.id })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.code).toBe('ALREADY_RESERVED');

            // 清理测试数据
            await productService.deleteProduct(newProduct.id);
        });
    });
});