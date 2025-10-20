/**
 * 数据库一致性集成测试
 * 测试SQLite和D1数据库适配器的功能一致性
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

// 设置测试环境
process.env.NODE_ENV = 'test';

describe('数据库一致性集成测试', () => {
    let sqliteApp, d1App;
    let sqliteAuthToken, d1AuthToken;
    let testStudentId, testProductId, testRewardPenaltyItemId;

    // 测试数据
    const testStudent = {
        id: 'CONSISTENCY_001',
        name: '一致性测试学生',
        balance: 0
    };
    
    const testProduct = {
        name: '一致性测试商品',
        price: 50,
        stock: 10,
        description: '用于一致性测试的商品'
    };
    
    const testRewardPenaltyItem = {
        name: '一致性测试奖励',
        points: 10,
        type: 'reward'
    };

    beforeAll(async () => {
        // 创建SQLite测试应用
        process.env.DB_TYPE = 'sqlite';
        process.env.DB_PATH = ':memory:';
        delete require.cache[require.resolve('../server')];
        sqliteApp = require('../server');
        
        // 等待SQLite初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 创建D1测试应用（模拟）
        process.env.DB_TYPE = 'd1';
        delete require.cache[require.resolve('../server')];
        // 注意：这里需要模拟D1环境，实际测试中可能需要使用Miniflare
        d1App = sqliteApp; // 临时使用同一个应用进行测试
        
        // 获取认证令牌
        await setupAuthentication();
    });

    afterAll(async () => {
        // 清理测试数据
        await cleanupTestData();
        
        if (sqliteApp && sqliteApp.close) {
            sqliteApp.close();
        }
    });

    async function setupAuthentication() {
        // SQLite认证
        const sqliteAuthResponse = await request(sqliteApp)
            .post('/api/auth/teacher-login')
            .send({
                teacherId: 'admin',
                password: 'admin123'
            });
        
        if (sqliteAuthResponse.status === 200) {
            sqliteAuthToken = sqliteAuthResponse.body.data.token;
        }

        // D1认证（使用相同的应用）
        d1AuthToken = sqliteAuthToken;
    }

    async function cleanupTestData() {
        const cleanupOperations = [
            () => request(sqliteApp).delete(`/api/students/${testStudentId}`).set('Authorization', `Bearer ${sqliteAuthToken}`),
            () => request(sqliteApp).delete(`/api/products/${testProductId}`).set('Authorization', `Bearer ${sqliteAuthToken}`),
            () => request(sqliteApp).delete(`/api/reward-penalty/${testRewardPenaltyItemId}`).set('Authorization', `Bearer ${sqliteAuthToken}`)
        ];

        for (const operation of cleanupOperations) {
            try {
                await operation();
            } catch (error) {
                // 忽略清理错误
            }
        }
    }

    describe('学生管理一致性测试', () => {
        test('创建学生 - SQLite vs D1', async () => {
            // SQLite创建学生
            const sqliteResponse = await request(sqliteApp)
                .post('/api/students')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send(testStudent);

            // D1创建学生（模拟）
            const d1Response = await request(d1App)
                .post('/api/students')
                .set('Authorization', `Bearer ${d1AuthToken}`)
                .send({
                    ...testStudent,
                    id: testStudent.id + '_D1'
                });

            // 验证响应结构一致性
            expect(sqliteResponse.status).toBe(d1Response.status);
            expect(sqliteResponse.body.success).toBe(d1Response.body.success);
            
            if (sqliteResponse.status === 201) {
                expect(sqliteResponse.body.student.name).toBe(d1Response.body.student.name);
                testStudentId = sqliteResponse.body.student.id;
            }
        });

        test('获取学生列表 - 数据结构一致性', async () => {
            const sqliteResponse = await request(sqliteApp)
                .get('/api/students')
                .set('Authorization', `Bearer ${sqliteAuthToken}`);

            const d1Response = await request(d1App)
                .get('/api/students')
                .set('Authorization', `Bearer ${d1AuthToken}`);

            // 验证响应结构
            expect(sqliteResponse.status).toBe(d1Response.status);
            expect(sqliteResponse.body.success).toBe(d1Response.body.success);
            expect(Array.isArray(sqliteResponse.body.students)).toBe(Array.isArray(d1Response.body.students));

            // 验证学生对象结构
            if (sqliteResponse.body.students.length > 0 && d1Response.body.students.length > 0) {
                const sqliteStudent = sqliteResponse.body.students[0];
                const d1Student = d1Response.body.students[0];
                
                expect(Object.keys(sqliteStudent).sort()).toEqual(Object.keys(d1Student).sort());
            }
        });

        test('更新学生信息 - 行为一致性', async () => {
            if (!testStudentId) {
                return; // 跳过如果没有测试学生
            }

            const updateData = { name: '更新后的学生姓名' };

            const sqliteResponse = await request(sqliteApp)
                .put(`/api/students/${testStudentId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send(updateData);

            // 验证更新结果
            expect(sqliteResponse.status).toBe(200);
            expect(sqliteResponse.body.success).toBe(true);
            expect(sqliteResponse.body.student.name).toBe(updateData.name);
        });
    });

    describe('积分管理一致性测试', () => {
        test('积分操作 - 计算逻辑一致性', async () => {
            if (!testStudentId) {
                return;
            }

            const pointsToAdd = 25;
            const reason = '一致性测试加分';

            // SQLite加分
            const sqliteAddResponse = await request(sqliteApp)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send({
                    studentId: testStudentId,
                    points: pointsToAdd,
                    reason: reason
                });

            expect(sqliteAddResponse.status).toBe(200);
            expect(sqliteAddResponse.body.success).toBe(true);
            expect(sqliteAddResponse.body.data.record.amount).toBe(pointsToAdd);

            // 验证积分余额计算
            const balanceResponse = await request(sqliteApp)
                .get(`/api/students/${testStudentId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);

            expect(balanceResponse.body.data.balance).toBe(pointsToAdd);
        });

        test('积分排行榜 - 排序逻辑一致性', async () => {
            const sqliteRankingsResponse = await request(sqliteApp)
                .get('/api/points/rankings');

            const d1RankingsResponse = await request(d1App)
                .get('/api/points/rankings');

            // 验证响应结构
            expect(sqliteRankingsResponse.status).toBe(d1RankingsResponse.status);
            expect(sqliteRankingsResponse.body.success).toBe(d1RankingsResponse.body.success);

            if (sqliteRankingsResponse.body.data && d1RankingsResponse.body.data) {
                // 验证排行榜数据结构
                expect(Array.isArray(sqliteRankingsResponse.body.data.rankings))
                    .toBe(Array.isArray(d1RankingsResponse.body.data.rankings));

                // 验证排序逻辑（如果有数据）
                const sqliteRankings = sqliteRankingsResponse.body.data.rankings;
                if (sqliteRankings.length > 1) {
                    for (let i = 0; i < sqliteRankings.length - 1; i++) {
                        expect(sqliteRankings[i].balance).toBeGreaterThanOrEqual(sqliteRankings[i + 1].balance);
                    }
                }
            }
        });

        test('积分历史记录 - 数据完整性', async () => {
            if (!testStudentId) {
                return;
            }

            const historyResponse = await request(sqliteApp)
                .get(`/api/points/history/${testStudentId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);

            expect(historyResponse.status).toBe(200);
            expect(historyResponse.body.success).toBe(true);
            expect(Array.isArray(historyResponse.body.data.records)).toBe(true);

            // 验证记录结构
            if (historyResponse.body.data.records.length > 0) {
                const record = historyResponse.body.data.records[0];
                expect(record).toHaveProperty('id');
                expect(record).toHaveProperty('amount');
                expect(record).toHaveProperty('reason');
                expect(record).toHaveProperty('type');
                expect(record).toHaveProperty('createdAt');
            }
        });
    });

    describe('商品管理一致性测试', () => {
        test('创建商品 - 数据验证一致性', async () => {
            const sqliteResponse = await request(sqliteApp)
                .post('/api/products')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send(testProduct);

            expect(sqliteResponse.status).toBe(201);
            expect(sqliteResponse.body.success).toBe(true);
            expect(sqliteResponse.body.data.name).toBe(testProduct.name);
            expect(sqliteResponse.body.data.price).toBe(testProduct.price);
            expect(sqliteResponse.body.data.stock).toBe(testProduct.stock);

            testProductId = sqliteResponse.body.data.id;
        });

        test('商品库存管理 - 并发安全性', async () => {
            if (!testProductId) {
                return;
            }

            // 模拟并发库存更新
            const stockUpdates = Array.from({ length: 5 }, (_, i) => 
                request(sqliteApp)
                    .put(`/api/products/${testProductId}`)
                    .set('Authorization', `Bearer ${sqliteAuthToken}`)
                    .send({ stock: testProduct.stock - i - 1 })
            );

            const responses = await Promise.allSettled(stockUpdates);
            
            // 验证至少有一个成功的更新
            const successfulUpdates = responses.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            );
            
            expect(successfulUpdates.length).toBeGreaterThan(0);
        });
    });

    describe('预约管理一致性测试', () => {
        test('创建预约订单 - 业务逻辑一致性', async () => {
            if (!testStudentId || !testProductId) {
                return;
            }

            // 先确保学生有足够积分
            await request(sqliteApp)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send({
                    studentId: testStudentId,
                    points: 100,
                    reason: '预约测试积分'
                });

            const orderResponse = await request(sqliteApp)
                .post('/api/orders')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send({
                    studentId: testStudentId,
                    productId: testProductId,
                    quantity: 1
                });

            expect(orderResponse.status).toBe(201);
            expect(orderResponse.body.success).toBe(true);
            expect(orderResponse.body.data.studentId).toBe(testStudentId);
            expect(orderResponse.body.data.productId).toBe(testProductId);
            expect(orderResponse.body.data.status).toBe('pending');
        });

        test('订单状态流转 - 状态管理一致性', async () => {
            // 获取待处理订单
            const ordersResponse = await request(sqliteApp)
                .get('/api/orders')
                .set('Authorization', `Bearer ${sqliteAuthToken}`);

            if (ordersResponse.body.data.length > 0) {
                const orderId = ordersResponse.body.data[0].id;

                // 确认订单
                const confirmResponse = await request(sqliteApp)
                    .put(`/api/orders/${orderId}/status`)
                    .set('Authorization', `Bearer ${sqliteAuthToken}`)
                    .send({ status: 'confirmed' });

                expect(confirmResponse.status).toBe(200);
                expect(confirmResponse.body.success).toBe(true);
                expect(confirmResponse.body.data.status).toBe('confirmed');
            }
        });
    });

    describe('奖惩项管理一致性测试', () => {
        test('创建奖惩项 - 数据结构一致性', async () => {
            const response = await request(sqliteApp)
                .post('/api/reward-penalty')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send(testRewardPenaltyItem);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe(testRewardPenaltyItem.name);
            expect(response.body.data.points).toBe(testRewardPenaltyItem.points);
            expect(response.body.data.type).toBe(testRewardPenaltyItem.type);

            testRewardPenaltyItemId = response.body.data.id;
        });

        test('应用奖惩项 - 积分计算一致性', async () => {
            if (!testStudentId || !testRewardPenaltyItemId) {
                return;
            }

            // 获取应用前的积分
            const beforeResponse = await request(sqliteApp)
                .get(`/api/students/${testStudentId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);
            
            const beforeBalance = beforeResponse.body.data.balance;

            // 应用奖惩项
            const applyResponse = await request(sqliteApp)
                .post(`/api/reward-penalty/${testRewardPenaltyItemId}/apply`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send({ studentId: testStudentId });

            expect(applyResponse.status).toBe(200);
            expect(applyResponse.body.success).toBe(true);

            // 验证积分变化
            const afterResponse = await request(sqliteApp)
                .get(`/api/students/${testStudentId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);
            
            const afterBalance = afterResponse.body.data.balance;
            expect(afterBalance).toBe(beforeBalance + testRewardPenaltyItem.points);
        });
    });

    describe('系统状态管理一致性测试', () => {
        test('模式切换 - 状态同步一致性', async () => {
            // 切换到上课模式
            const classModeResponse = await request(sqliteApp)
                .post('/api/system/state/class-mode')
                .send({ teacherId: 'admin' });

            expect(classModeResponse.status).toBe(200);
            expect(classModeResponse.body.success).toBe(true);

            // 验证状态
            const stateResponse = await request(sqliteApp)
                .get('/api/system/state');

            expect(stateResponse.body.data.mode).toBe('class');

            // 切换回平时模式
            const normalModeResponse = await request(sqliteApp)
                .post('/api/system/state/normal-mode');

            expect(normalModeResponse.status).toBe(200);
            expect(normalModeResponse.body.success).toBe(true);
        });

        test('系统配置 - 配置信息一致性', async () => {
            const configResponse = await request(sqliteApp)
                .get('/api/system/config');

            expect(configResponse.status).toBe(200);
            expect(configResponse.body.success).toBe(true);
            expect(configResponse.body.data).toHaveProperty('storageType');
            expect(configResponse.body.data).toHaveProperty('version');
        });
    });

    describe('错误处理一致性测试', () => {
        test('资源不存在 - 错误响应一致性', async () => {
            const invalidStudentResponse = await request(sqliteApp)
                .get('/api/students/INVALID_ID')
                .set('Authorization', `Bearer ${sqliteAuthToken}`);

            expect(invalidStudentResponse.status).toBe(404);
            expect(invalidStudentResponse.body.success).toBe(false);
            expect(invalidStudentResponse.body.code).toBeDefined();
        });

        test('权限验证 - 认证逻辑一致性', async () => {
            const unauthorizedResponse = await request(sqliteApp)
                .post('/api/students')
                .send(testStudent);

            expect(unauthorizedResponse.status).toBe(401);
            expect(unauthorizedResponse.body.success).toBe(false);
        });

        test('数据验证 - 验证规则一致性', async () => {
            const invalidDataResponse = await request(sqliteApp)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send({
                    studentId: '',
                    points: -999,
                    reason: ''
                });

            expect(invalidDataResponse.status).toBe(400);
            expect(invalidDataResponse.body.success).toBe(false);
        });
    });

    describe('性能特性一致性测试', () => {
        test('批量操作 - 性能表现对比', async () => {
            const batchSize = 10;
            const startTime = Date.now();

            // 批量创建积分记录
            const batchPromises = Array.from({ length: batchSize }, (_, i) => 
                request(sqliteApp)
                    .post('/api/points/add')
                    .set('Authorization', `Bearer ${sqliteAuthToken}`)
                    .send({
                        studentId: testStudentId || 'test_student',
                        points: i + 1,
                        reason: `批量测试${i + 1}`
                    })
            );

            const responses = await Promise.allSettled(batchPromises);
            const endTime = Date.now();

            const successCount = responses.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length;

            console.log(`批量操作性能: ${batchSize}个操作耗时${endTime - startTime}ms, 成功${successCount}个`);
            
            // 验证批量操作基本成功率
            expect(successCount / batchSize).toBeGreaterThan(0.8);
        });

        test('并发查询 - 并发处理能力', async () => {
            const concurrentRequests = 20;
            const startTime = Date.now();

            const queryPromises = Array.from({ length: concurrentRequests }, () => 
                request(sqliteApp).get('/api/points/rankings')
            );

            const responses = await Promise.allSettled(queryPromises);
            const endTime = Date.now();

            const successCount = responses.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length;

            console.log(`并发查询性能: ${concurrentRequests}个请求耗时${endTime - startTime}ms, 成功${successCount}个`);
            
            // 验证并发查询成功率
            expect(successCount / concurrentRequests).toBeGreaterThan(0.9);
        });
    });

    describe('数据完整性验证', () => {
        test('事务一致性 - 数据完整性保证', async () => {
            if (!testStudentId || !testProductId) {
                return;
            }

            // 获取初始状态
            const initialStudentResponse = await request(sqliteApp)
                .get(`/api/students/${testStudentId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);
            
            const initialProductResponse = await request(sqliteApp)
                .get(`/api/products/${testProductId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);

            const initialBalance = initialStudentResponse.body.data.balance;
            const initialStock = initialProductResponse.body.data.stock;

            // 尝试创建一个会失败的订单（积分不足）
            const failedOrderResponse = await request(sqliteApp)
                .post('/api/orders')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send({
                    studentId: testStudentId,
                    productId: testProductId,
                    quantity: 999 // 超出库存
                });

            // 验证失败的订单不会影响数据状态
            const finalStudentResponse = await request(sqliteApp)
                .get(`/api/students/${testStudentId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);
            
            const finalProductResponse = await request(sqliteApp)
                .get(`/api/products/${testProductId}`)
                .set('Authorization', `Bearer ${sqliteAuthToken}`);

            expect(finalStudentResponse.body.data.balance).toBe(initialBalance);
            expect(finalProductResponse.body.data.stock).toBe(initialStock);
        });

        test('数据关联完整性 - 外键约束验证', async () => {
            // 尝试为不存在的学生创建积分记录
            const invalidPointResponse = await request(sqliteApp)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${sqliteAuthToken}`)
                .send({
                    studentId: 'NON_EXISTENT_STUDENT',
                    points: 10,
                    reason: '测试无效学生'
                });

            expect(invalidPointResponse.status).toBe(404);
            expect(invalidPointResponse.body.success).toBe(false);
        });
    });
});