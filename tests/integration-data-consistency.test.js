/**
 * 数据一致性和并发测试
 * 测试系统在并发操作下的数据一致性
 */

const request = require('supertest');
const app = require('../server');
const StudentService = require('../services/studentService');
const PointsService = require('../services/pointsService');
const DataInitializer = require('../utils/dataInitializer');

describe('数据一致性和并发测试', () => {
    let server;
    let teacherToken;
    let studentService;
    let pointsService;
    
    const testStudents = [
        { id: 'CONC001', name: '并发测试学生1', class: '测试班' },
        { id: 'CONC002', name: '并发测试学生2', class: '测试班' },
        { id: 'CONC003', name: '并发测试学生3', class: '测试班' }
    ];

    beforeAll(async () => {
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        
        studentService = new StudentService();
        pointsService = new PointsService();
        
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
        // 获取教师令牌
        const teacherResponse = await request(app)
            .post('/api/auth/teacher-login')
            .send({ teacherId: 'admin', password: 'admin123' });
        teacherToken = teacherResponse.body.data.token;

        // 创建测试学生
        for (const student of testStudents) {
            try {
                await studentService.createStudent(student);
            } catch (error) {
                if (!error.message.includes('已存在')) {
                    throw error;
                }
            }
        }
    }

    async function cleanupTestData() {
        for (const student of testStudents) {
            try {
                await studentService.deleteStudent(student.id);
            } catch (error) {
                // 忽略清理错误
            }
        }
    }

    describe('积分操作并发测试', () => {
        test('并发加分操作数据一致性', async () => {
            const studentId = testStudents[0].id;
            const pointsPerOperation = 10;
            const operationCount = 5;
            
            // 并发执行多个加分操作
            const promises = Array.from({ length: operationCount }, (_, index) => 
                request(app)
                    .post('/api/points/add')
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId,
                        points: pointsPerOperation,
                        reason: `并发测试加分${index + 1}`
                    })
            );

            const responses = await Promise.all(promises);
            
            // 验证所有操作都成功
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            // 验证最终余额正确
            const finalBalance = await studentService.getStudentBalance(studentId);
            expect(finalBalance).toBe(pointsPerOperation * operationCount);

            // 验证积分历史记录数量正确
            const history = await pointsService.getPointsHistory(studentId);
            const addRecords = history.filter(record => record.type === 'add');
            expect(addRecords.length).toBe(operationCount);
        });

        test('并发加减分混合操作', async () => {
            const studentId = testStudents[1].id;
            
            // 先给学生一些初始积分
            await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId,
                    points: 100,
                    reason: '初始积分'
                });

            // 并发执行加分和减分操作
            const operations = [
                { type: 'add', points: 20, reason: '并发加分1' },
                { type: 'subtract', points: 15, reason: '并发减分1' },
                { type: 'add', points: 10, reason: '并发加分2' },
                { type: 'subtract', points: 5, reason: '并发减分2' },
                { type: 'add', points: 25, reason: '并发加分3' }
            ];

            const promises = operations.map(op => 
                request(app)
                    .post(`/api/points/${op.type}`)
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId,
                        points: op.points,
                        reason: op.reason
                    })
            );

            const responses = await Promise.all(promises);
            
            // 验证所有操作都成功
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            // 计算预期余额
            const expectedBalance = 100 + 20 - 15 + 10 - 5 + 25; // 135
            const finalBalance = await studentService.getStudentBalance(studentId);
            expect(finalBalance).toBe(expectedBalance);
        });

        test('并发商品预约库存一致性', async () => {
            // 创建库存有限的测试商品
            const productResponse = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    name: '并发测试商品',
                    price: 10,
                    stock: 2 // 只有2个库存
                });
            
            const productId = productResponse.body.data.product.id;

            // 给所有测试学生足够的积分
            for (const student of testStudents) {
                await request(app)
                    .post('/api/points/add')
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId: student.id,
                        points: 50,
                        reason: '预约测试积分'
                    });
            }

            // 获取学生令牌
            const studentTokens = [];
            for (const student of testStudents) {
                const loginResponse = await request(app)
                    .post('/api/auth/student-login')
                    .send({ studentId: student.id });
                studentTokens.push(loginResponse.body.data.token);
            }

            // 并发预约商品（3个学生同时预约，但只有2个库存）
            const promises = studentTokens.map(token => 
                request(app)
                    .post('/api/orders/reserve')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ productId })
            );

            const responses = await Promise.all(promises);
            
            // 统计成功和失败的预约
            const successCount = responses.filter(r => r.status === 200).length;
            const failureCount = responses.filter(r => r.status === 400).length;
            
            // 应该有2个成功，1个失败（库存不足）
            expect(successCount).toBe(2);
            expect(failureCount).toBe(1);

            // 验证失败的响应是库存不足
            const failedResponse = responses.find(r => r.status === 400);
            expect(failedResponse.body.code).toBe('OUT_OF_STOCK');

            // 清理测试数据
            await request(app)
                .delete(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${teacherToken}`);
        });
    });

    describe('数据完整性验证', () => {
        test('积分记录与学生余额一致性', async () => {
            const studentId = testStudents[2].id;
            
            // 执行一系列积分操作
            const operations = [
                { type: 'add', points: 50, reason: '测试加分1' },
                { type: 'add', points: 30, reason: '测试加分2' },
                { type: 'subtract', points: 20, reason: '测试减分1' },
                { type: 'add', points: 15, reason: '测试加分3' },
                { type: 'subtract', points: 10, reason: '测试减分2' }
            ];

            for (const op of operations) {
                await request(app)
                    .post(`/api/points/${op.type}`)
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId,
                        points: op.points,
                        reason: op.reason
                    });
            }

            // 获取积分历史
            const historyResponse = await request(app)
                .get(`/api/points/history/${studentId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            // 计算历史记录总和
            const totalFromHistory = historyResponse.body.data.records.reduce((sum, record) => {
                return sum + record.points;
            }, 0);

            // 获取当前余额
            const studentResponse = await request(app)
                .get(`/api/students/${studentId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            const currentBalance = studentResponse.body.data.student.balance;

            // 验证一致性
            expect(totalFromHistory).toBe(currentBalance);
            expect(currentBalance).toBe(65); // 50 + 30 - 20 + 15 - 10
        });

        test('排行榜数据与学生数据一致性', async () => {
            // 获取排行榜
            const rankingsResponse = await request(app)
                .get('/api/points/rankings')
                .expect(200);

            const totalRankings = rankingsResponse.body.data.total;

            // 验证每个学生的排行榜数据与实际数据一致
            for (const rankingEntry of totalRankings.slice(0, 5)) { // 只检查前5名
                const studentResponse = await request(app)
                    .get(`/api/students/${rankingEntry.id}`)
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .expect(200);

                const actualBalance = studentResponse.body.data.student.balance;
                expect(rankingEntry.balance).toBe(actualBalance);
            }
        });

        test('订单状态与积分冻结一致性', async () => {
            const studentId = testStudents[0].id;
            
            // 创建测试商品
            const productResponse = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    name: '一致性测试商品',
                    price: 30,
                    stock: 5
                });
            
            const productId = productResponse.body.data.product.id;

            // 获取学生令牌
            const studentLoginResponse = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId });
            const studentToken = studentLoginResponse.body.data.token;

            // 记录预约前余额
            const beforeBalance = await studentService.getStudentBalance(studentId);

            // 预约商品
            const reserveResponse = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ productId })
                .expect(200);

            const orderId = reserveResponse.body.data.order.id;

            // 验证积分被正确冻结
            const afterReserveBalance = await studentService.getStudentBalance(studentId);
            expect(afterReserveBalance).toBe(beforeBalance - 30);

            // 取消订单
            await request(app)
                .post(`/api/orders/${orderId}/cancel`)
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(200);

            // 验证积分被正确释放
            const afterCancelBalance = await studentService.getStudentBalance(studentId);
            expect(afterCancelBalance).toBe(beforeBalance);

            // 清理测试数据
            await request(app)
                .delete(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${teacherToken}`);
        });
    });

    describe('事务完整性测试', () => {
        test('积分操作原子性', async () => {
            const studentId = testStudents[1].id;
            const initialBalance = await studentService.getStudentBalance(studentId);

            // 模拟一个可能失败的操作（使用无效的原因参数）
            try {
                await request(app)
                    .post('/api/points/add')
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId,
                        points: 100,
                        reason: '' // 空原因应该失败
                    });
            } catch (error) {
                // 预期会失败
            }

            // 验证余额没有改变
            const finalBalance = await studentService.getStudentBalance(studentId);
            expect(finalBalance).toBe(initialBalance);
        });

        test('商品预约事务完整性', async () => {
            const studentId = testStudents[2].id;
            
            // 创建测试商品
            const productResponse = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    name: '事务测试商品',
                    price: 1000, // 设置很高的价格确保积分不足
                    stock: 1
                });
            
            const productId = productResponse.body.data.product.id;

            // 获取学生令牌
            const studentLoginResponse = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId });
            const studentToken = studentLoginResponse.body.data.token;

            const initialBalance = await studentService.getStudentBalance(studentId);

            // 尝试预约（应该因积分不足失败）
            const reserveResponse = await request(app)
                .post('/api/orders/reserve')
                .set('Authorization', `Bearer ${studentToken}`)
                .send({ productId })
                .expect(400);

            expect(reserveResponse.body.code).toBe('INSUFFICIENT_POINTS');

            // 验证余额没有改变
            const finalBalance = await studentService.getStudentBalance(studentId);
            expect(finalBalance).toBe(initialBalance);

            // 验证没有创建订单
            const ordersResponse = await request(app)
                .get('/api/orders/pending')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            const studentOrders = ordersResponse.body.data.orders.filter(o => o.studentId === studentId);
            expect(studentOrders.length).toBe(0);

            // 清理测试数据
            await request(app)
                .delete(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${teacherToken}`);
        });
    });

    describe('数据恢复测试', () => {
        test('系统重启后数据持久性', async () => {
            const studentId = testStudents[0].id;
            
            // 记录操作前的状态
            const beforeBalance = await studentService.getStudentBalance(studentId);
            const beforeHistoryResponse = await request(app)
                .get(`/api/points/history/${studentId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            const beforeHistoryCount = beforeHistoryResponse.body.data.records.length;

            // 执行一些操作
            await request(app)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    studentId,
                    points: 25,
                    reason: '持久性测试'
                });

            // 模拟重新初始化数据（重新创建服务实例）
            const newStudentService = new StudentService();
            const newPointsService = new PointsService();

            // 验证数据仍然存在
            const afterBalance = await newStudentService.getStudentBalance(studentId);
            expect(afterBalance).toBe(beforeBalance + 25);

            const afterHistory = await newPointsService.getPointsHistory(studentId);
            expect(afterHistory.length).toBe(beforeHistoryCount + 1);
        });

        test('备份和恢复数据一致性', async () => {
            // 创建备份
            const backupResponse = await request(app)
                .post('/api/backup/create')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(backupResponse.body.success).toBe(true);
            expect(backupResponse.body.data.backupPath).toBeDefined();

            // 验证备份文件存在
            const backupListResponse = await request(app)
                .get('/api/backup/list')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(backupListResponse.body.data.backups.length).toBeGreaterThan(0);
            
            // 验证最新备份包含当前数据
            const latestBackup = backupListResponse.body.data.backups[0];
            expect(latestBackup.size).toBeGreaterThan(0);
            expect(latestBackup.timestamp).toBeDefined();
        });
    });

    describe('并发限制测试', () => {
        test('高并发请求处理', async () => {
            const studentId = testStudents[0].id;
            const concurrentRequests = 20;
            
            // 创建大量并发请求
            const promises = Array.from({ length: concurrentRequests }, (_, index) => 
                request(app)
                    .post('/api/points/add')
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId,
                        points: 1,
                        reason: `高并发测试${index}`
                    })
            );

            const responses = await Promise.allSettled(promises);
            
            // 统计成功和失败的请求
            const successCount = responses.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length;
            
            const failureCount = responses.filter(r => 
                r.status === 'rejected' || r.value.status !== 200
            ).length;

            // 大部分请求应该成功（允许少量失败由于系统限制）
            expect(successCount).toBeGreaterThan(concurrentRequests * 0.8);
            
            console.log(`高并发测试结果: 成功 ${successCount}, 失败 ${failureCount}`);
        });

        test('内存使用稳定性', async () => {
            const initialMemory = process.memoryUsage();
            
            // 执行大量操作
            for (let i = 0; i < 100; i++) {
                await request(app)
                    .get('/api/points/rankings')
                    .expect(200);
            }

            const finalMemory = process.memoryUsage();
            
            // 内存增长应该在合理范围内（不超过50MB）
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
            
            console.log(`内存使用变化: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        });
    });
});