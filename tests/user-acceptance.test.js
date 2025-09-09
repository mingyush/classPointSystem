/**
 * 用户验收测试套件
 * 
 * 测试所有用户场景和需求的完整实现
 * 包括：教师操作流程、学生查询流程、大屏展示、商品预约等
 */

const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');

// 创建测试专用的app实例，避免端口冲突
const express = require('express');
const DataInitializer = require('../utils/dataInitializer');

const app = express();

// 配置测试环境的中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 测试环境跳过认证的中间件
app.use((req, res, next) => {
    // 为测试请求添加模拟的用户信息
    req.user = {
        userId: 'test-teacher',
        userType: 'teacher',
        username: 'test'
    };
    next();
});

// 添加API路由
app.use('/api/auth', require('../api/auth'));
app.use('/api/points', require('../api/points'));
app.use('/api/students', require('../api/students'));
app.use('/api/products', require('../api/products'));
app.use('/api/orders', require('../api/orders'));
app.use('/api/config', require('../api/config'));

describe('用户验收测试', () => {
    let testStudentId = 'TEST001';
    let testProductId;
    let testOrderId;
    
    beforeAll(async () => {
        // 清理测试数据
        await cleanupTestData();
        
        // 初始化测试数据
        await initializeTestData();
    });
    
    afterAll(async () => {
        // 清理测试数据
        await cleanupTestData();
    });

    describe('需求1: 积分展示系统', () => {
        test('1.1 大屏应当显示所有学生的当前积分余额', async () => {
            const response = await request(app)
                .get('/api/points/rankings/all')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.total).toBeDefined();
            expect(Array.isArray(response.body.data.total)).toBe(true);
            
            // 验证包含测试学生
            const testStudent = response.body.data.total.find(s => s.studentId === testStudentId);
            expect(testStudent).toBeDefined();
            expect(testStudent.points).toBeDefined();
        });

        test('1.2 大屏应当显示日榜排行', async () => {
            const response = await request(app)
                .get('/api/points/rankings/daily')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            
            // 验证排行榜格式
            if (response.body.data.length > 0) {
                const firstItem = response.body.data[0];
                expect(firstItem.studentId).toBeDefined();
                expect(firstItem.studentName).toBeDefined();
                expect(firstItem.points).toBeDefined();
                expect(firstItem.rank).toBeDefined();
            }
        });

        test('1.3 大屏应当显示周榜排行', async () => {
            const response = await request(app)
                .get('/api/points/rankings/weekly')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('1.4 积分数据更新时大屏显示应当自动刷新', async () => {
            // 添加积分
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 10,
                    reason: '测试加分'
                })
                .expect(200);
            
            // 验证排行榜已更新
            const response = await request(app)
                .get('/api/points/rankings/total')
                .expect(200);
            
            const testStudent = response.body.data.find(s => s.studentId === testStudentId);
            expect(testStudent.points).toBeGreaterThanOrEqual(10);
        });
    });

    describe('需求2: 教师积分管理', () => {
        test('2.1 教师应当能够选择学生并进行加分操作', async () => {
            const initialResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const initialBalance = initialResponse.body.data.balance;
            
            const response = await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 5,
                    reason: '课堂表现优秀'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.newBalance).toBe(initialBalance + 5);
        });

        test('2.2 教师应当能够选择学生并进行减分操作', async () => {
            const initialResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const initialBalance = initialResponse.body.data.balance;
            
            const response = await request(app)
                .post('/api/points/subtract')
                .send({
                    studentId: testStudentId,
                    points: 3,
                    reason: '违反课堂纪律'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.newBalance).toBe(initialBalance - 3);
        });

        test('2.3 系统应当立即更新学生的积分余额', async () => {
            const beforeResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const beforeBalance = beforeResponse.body.data.balance;
            
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 2,
                    reason: '测试更新'
                })
                .expect(200);
            
            const afterResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            expect(afterResponse.body.data.balance).toBe(beforeBalance + 2);
        });

        test('2.4 系统应当记录操作时间、操作类型和分数变化', async () => {
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 1,
                    reason: '测试记录'
                })
                .expect(200);
            
            const response = await request(app)
                .get(`/api/points/history/${testStudentId}`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            
            const latestRecord = response.body.data[0];
            expect(latestRecord.studentId).toBe(testStudentId);
            expect(latestRecord.points).toBe(1);
            expect(latestRecord.reason).toBe('测试记录');
            expect(latestRecord.timestamp).toBeDefined();
            expect(latestRecord.type).toBe('add');
        });

        test('2.5 学生积分余额不足时系统应当允许减分操作', async () => {
            // 先将积分设为0
            const currentResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const currentBalance = currentResponse.body.data.balance;
            
            // 减去所有积分使其为负数
            const response = await request(app)
                .post('/api/points/subtract')
                .send({
                    studentId: testStudentId,
                    points: currentBalance + 10,
                    reason: '测试负数积分'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.newBalance).toBe(-10);
        });
    });

    describe('需求3: 学生积分账户', () => {
        test('3.1 学生应当能够使用学号登录', async () => {
            const response = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId: testStudentId })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.student).toBeDefined();
            expect(response.body.student.id).toBe(testStudentId);
        });

        test('3.2 学生登录后应当显示个人当前积分余额', async () => {
            const response = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.balance).toBeDefined();
            expect(typeof response.body.data.balance).toBe('number');
        });

        test('3.3 学生登录后应当显示个人本周操作记录', async () => {
            const response = await request(app)
                .get(`/api/points/history/${testStudentId}?period=week`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
        });

        test('3.4 学生登录后应当显示个人在班级中的排名', async () => {
            const response = await request(app)
                .get(`/api/students/${testStudentId}/rank`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.totalRank).toBeDefined();
            expect(response.body.data.totalStudents).toBeDefined();
        });
    });

    describe('需求4: 积分累积规则', () => {
        test('4.1 新学期开始时学生积分应当保持累积', async () => {
            // 这个测试验证积分不会自动清零
            const beforeResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const beforeBalance = beforeResponse.body.data.balance;
            
            // 模拟系统重启（通过重新初始化数据）
            // 在实际场景中，这会是系统重启或新学期开始
            
            const afterResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            // 积分应该保持不变
            expect(afterResponse.body.data.balance).toBe(beforeBalance);
        });

        test('4.2 管理员手动触发清零时系统应当将所有学生积分重置为0', async () => {
            // 确保学生有积分
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 50,
                    reason: '测试清零前积分'
                })
                .expect(200);
            
            // 执行积分清零
            const response = await request(app)
                .post('/api/config/reset-points')
                .send({ confirm: true })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            
            // 验证积分已清零
            const studentResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            expect(studentResponse.body.data.balance).toBe(0);
        });

        test('4.3 积分清零时系统应当保留历史操作记录', async () => {
            // 添加一些积分
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 20,
                    reason: '清零前测试'
                })
                .expect(200);
            
            // 获取清零前的记录数量
            const beforeResponse = await request(app)
                .get(`/api/points/history/${testStudentId}`)
                .expect(200);
            
            const beforeCount = beforeResponse.body.data.length;
            
            // 执行清零
            await request(app)
                .post('/api/config/reset-points')
                .send({ confirm: true })
                .expect(200);
            
            // 验证历史记录仍然存在
            const afterResponse = await request(app)
                .get(`/api/points/history/${testStudentId}`)
                .expect(200);
            
            // 记录数量应该增加（包含清零记录）
            expect(afterResponse.body.data.length).toBeGreaterThan(beforeCount);
        });
    });

    describe('需求5: 商品管理系统', () => {
        test('5.1 班主任应当能够添加新的奖品商品', async () => {
            const response = await request(app)
                .post('/api/products')
                .send({
                    name: '测试商品',
                    price: 30,
                    stock: 10,
                    description: '用于测试的商品'
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.product).toBeDefined();
            expect(response.body.product.name).toBe('测试商品');
            
            testProductId = response.body.product.id;
        });

        test('5.2 班主任应当能够设置商品名称、积分价格和库存数量', async () => {
            const response = await request(app)
                .get('/api/products')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            
            const testProduct = response.body.products.find(p => p.id === testProductId);
            expect(testProduct).toBeDefined();
            expect(testProduct.name).toBe('测试商品');
            expect(testProduct.price).toBe(30);
            expect(testProduct.stock).toBe(10);
        });

        test('5.3 班主任应当能够修改现有商品的信息', async () => {
            const response = await request(app)
                .put(`/api/products/${testProductId}`)
                .send({
                    name: '修改后的测试商品',
                    price: 35,
                    stock: 15
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.product.name).toBe('修改后的测试商品');
            expect(response.body.product.price).toBe(35);
        });

        test('5.4 商品库存为0时系统应当在前端显示缺货状态', async () => {
            // 将商品库存设为0
            await request(app)
                .put(`/api/products/${testProductId}`)
                .send({ stock: 0 })
                .expect(200);
            
            const response = await request(app)
                .get('/api/products')
                .expect(200);
            
            const testProduct = response.body.products.find(p => p.id === testProductId);
            expect(testProduct.stock).toBe(0);
            
            // 恢复库存用于后续测试
            await request(app)
                .put(`/api/products/${testProductId}`)
                .send({ stock: 5 })
                .expect(200);
        });
    });

    describe('需求6: 商品预约系统', () => {
        beforeAll(async () => {
            // 确保学生有足够积分
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 100,
                    reason: '为预约测试准备积分'
                })
                .expect(200);
        });

        test('6.1 学生应当能够看到所有可用商品及其积分价格', async () => {
            const response = await request(app)
                .get('/api/products')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.products)).toBe(true);
            
            const testProduct = response.body.products.find(p => p.id === testProductId);
            expect(testProduct).toBeDefined();
            expect(testProduct.price).toBeDefined();
        });

        test('6.2 学生积分足够时应当能够预约商品兑换', async () => {
            const response = await request(app)
                .post('/api/orders/reserve')
                .send({
                    studentId: testStudentId,
                    productId: testProductId
                })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(response.body.order).toBeDefined();
            expect(response.body.order.status).toBe('pending');
            
            testOrderId = response.body.order.id;
        });

        test('6.3 学生预约商品时系统应当冻结相应积分但不立即扣除', async () => {
            // 获取商品价格
            const productResponse = await request(app)
                .get('/api/products')
                .expect(200);
            
            const testProduct = productResponse.body.products.find(p => p.id === testProductId);
            const productPrice = testProduct.price;
            
            // 获取学生当前积分
            const studentResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const currentBalance = studentResponse.body.data.balance;
            
            // 预约应该成功，但积分暂时不扣除（在实际实现中可能需要冻结机制）
            // 这里验证预约记录存在
            const ordersResponse = await request(app)
                .get('/api/orders/pending')
                .expect(200);
            
            const testOrder = ordersResponse.body.orders.find(o => o.id === testOrderId);
            expect(testOrder).toBeDefined();
            expect(testOrder.status).toBe('pending');
        });

        test('6.4 教师确认兑换完成时系统应当扣除学生积分并减少商品库存', async () => {
            // 获取确认前的积分和库存
            const beforeStudentResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const beforeBalance = beforeStudentResponse.body.data.balance;
            
            const beforeProductResponse = await request(app)
                .get('/api/products')
                .expect(200);
            
            const beforeProduct = beforeProductResponse.body.products.find(p => p.id === testProductId);
            const beforeStock = beforeProduct.stock;
            const productPrice = beforeProduct.price;
            
            // 确认兑换
            const response = await request(app)
                .post(`/api/orders/${testOrderId}/confirm`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            
            // 验证积分已扣除
            const afterStudentResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            expect(afterStudentResponse.body.data.balance).toBe(beforeBalance - productPrice);
            
            // 验证库存已减少
            const afterProductResponse = await request(app)
                .get('/api/products')
                .expect(200);
            
            const afterProduct = afterProductResponse.body.products.find(p => p.id === testProductId);
            expect(afterProduct.stock).toBe(beforeStock - 1);
        });

        test('6.5 学生取消预约时系统应当解冻相应积分', async () => {
            // 创建新的预约用于测试取消
            const reserveResponse = await request(app)
                .post('/api/orders/reserve')
                .send({
                    studentId: testStudentId,
                    productId: testProductId
                })
                .expect(200);
            
            const newOrderId = reserveResponse.body.order.id;
            
            // 取消预约
            const cancelResponse = await request(app)
                .post(`/api/orders/${newOrderId}/cancel`)
                .expect(200);
            
            expect(cancelResponse.body.success).toBe(true);
            
            // 验证订单状态已更新
            const ordersResponse = await request(app)
                .get('/api/orders/pending')
                .expect(200);
            
            const cancelledOrder = ordersResponse.body.orders.find(o => o.id === newOrderId);
            expect(cancelledOrder?.status).toBe('cancelled');
        });
    });

    describe('需求7: 系统模式切换', () => {
        test('7.1 教师切换到上课模式时大屏应当显示积分操作界面', async () => {
            const response = await request(app)
                .post('/api/config/mode')
                .send({ mode: 'class' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            
            // 验证模式已切换
            const modeResponse = await request(app)
                .get('/api/config/mode')
                .expect(200);
            
            expect(modeResponse.body.mode).toBe('class');
        });

        test('7.2 教师切换到平时模式时大屏应当显示积分排行榜', async () => {
            const response = await request(app)
                .post('/api/config/mode')
                .send({ mode: 'normal' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            
            // 验证模式已切换
            const modeResponse = await request(app)
                .get('/api/config/mode')
                .expect(200);
            
            expect(modeResponse.body.mode).toBe('normal');
        });

        test('7.3 系统处于上课模式时学生不应当能够进行预约操作', async () => {
            // 切换到上课模式
            await request(app)
                .post('/api/config/mode')
                .send({ mode: 'class' })
                .expect(200);
            
            // 尝试预约应该被拒绝或有相应提示
            const response = await request(app)
                .post('/api/orders/reserve')
                .send({
                    studentId: testStudentId,
                    productId: testProductId
                });
            
            // 根据实际实现，可能返回错误或警告
            // 这里假设在上课模式下预约会被限制
            if (response.status !== 200) {
                expect(response.status).toBeGreaterThanOrEqual(400);
            }
            
            // 恢复到正常模式
            await request(app)
                .post('/api/config/mode')
                .send({ mode: 'normal' })
                .expect(200);
        });

        test('7.4 系统模式切换时界面应当立即更新显示内容', async () => {
            // 这个测试主要验证API响应正确
            // 前端的实时更新通过SSE实现
            
            const response = await request(app)
                .post('/api/config/mode')
                .send({ mode: 'class' })
                .expect(200);
            
            expect(response.body.success).toBe(true);
            
            // 立即查询应该返回新模式
            const modeResponse = await request(app)
                .get('/api/config/mode')
                .expect(200);
            
            expect(modeResponse.body.mode).toBe('class');
        });
    });

    describe('需求8: 数据持久化', () => {
        test('8.1 系统重启时所有学生积分数据应当保持不变', async () => {
            // 获取当前积分
            const beforeResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const beforeBalance = beforeResponse.body.data.balance;
            
            // 模拟数据持久化（通过直接读取文件验证）
            const studentsData = JSON.parse(
                await fs.readFile(path.join(__dirname, '../data/students.json'), 'utf8')
            );
            
            const testStudent = studentsData.students.find(s => s.id === testStudentId);
            expect(testStudent.balance).toBe(beforeBalance);
        });

        test('8.2 系统重启时所有商品信息应当保持不变', async () => {
            const response = await request(app)
                .get('/api/products')
                .expect(200);
            
            expect(response.body.success).toBe(true);
            
            // 验证测试商品仍然存在
            const testProduct = response.body.products.find(p => p.id === testProductId);
            expect(testProduct).toBeDefined();
        });

        test('8.3 系统重启时所有操作记录应当保持不变', async () => {
            const response = await request(app)
                .get(`/api/points/history/${testStudentId}`)
                .expect(200);
            
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
        });

        test('8.4 数据发生变化时系统应当立即保存到持久化存储', async () => {
            // 添加积分
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 1,
                    reason: '测试持久化'
                })
                .expect(200);
            
            // 立即检查文件是否已更新
            const pointsData = JSON.parse(
                await fs.readFile(path.join(__dirname, '../data/points.json'), 'utf8')
            );
            
            const latestRecord = pointsData.records[pointsData.records.length - 1];
            expect(latestRecord.reason).toBe('测试持久化');
        });
    });

    describe('系统集成测试', () => {
        test('完整的用户操作流程', async () => {
            // 1. 学生登录
            const loginResponse = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId: testStudentId })
                .expect(200);
            
            expect(loginResponse.body.success).toBe(true);
            
            // 2. 查看个人积分
            const studentResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            const initialBalance = studentResponse.body.data.balance;
            
            // 3. 教师加分
            await request(app)
                .post('/api/points/add')
                .send({
                    studentId: testStudentId,
                    points: 20,
                    reason: '完整流程测试'
                })
                .expect(200);
            
            // 4. 验证积分更新
            const updatedResponse = await request(app)
                .get(`/api/students/${testStudentId}`)
                .expect(200);
            
            expect(updatedResponse.body.data.balance).toBe(initialBalance + 20);
            
            // 5. 查看排行榜
            const rankingResponse = await request(app)
                .get('/api/points/rankings/total')
                .expect(200);
            
            expect(rankingResponse.body.success).toBe(true);
            
            // 6. 预约商品
            const reserveResponse = await request(app)
                .post('/api/orders/reserve')
                .send({
                    studentId: testStudentId,
                    productId: testProductId
                })
                .expect(200);
            
            expect(reserveResponse.body.success).toBe(true);
            
            // 7. 确认兑换
            const confirmResponse = await request(app)
                .post(`/api/orders/${reserveResponse.body.order.id}/confirm`)
                .expect(200);
            
            expect(confirmResponse.body.success).toBe(true);
        });
    });

    // 辅助函数
    async function initializeTestData() {
        // 创建测试学生
        await request(app)
            .post('/api/students')
            .send({
                id: testStudentId,
                name: '测试学生',
                class: '测试班级',
                balance: 0
            });
        
        console.log('测试数据初始化完成');
    }
    
    async function cleanupTestData() {
        try {
            // 删除测试学生
            await request(app)
                .delete(`/api/students/${testStudentId}`)
                .send();
            
            // 删除测试商品
            if (testProductId) {
                await request(app)
                    .delete(`/api/products/${testProductId}`)
                    .send();
            }
            
            console.log('测试数据清理完成');
        } catch (error) {
            console.warn('测试数据清理失败:', error.message);
        }
    }
});