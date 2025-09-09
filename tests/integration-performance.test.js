/**
 * 性能和压力测试用例
 * 测试系统在高负载下的性能表现
 */

const request = require('supertest');
const app = require('../server');
const DataInitializer = require('../utils/dataInitializer');

describe('性能和压力测试', () => {
    let server;
    let teacherToken;
    let studentTokens = [];
    
    // 性能测试配置
    const PERFORMANCE_THRESHOLDS = {
        API_RESPONSE_TIME: 1000, // 1秒
        BATCH_OPERATION_TIME: 5000, // 5秒
        CONCURRENT_REQUESTS: 50,
        LARGE_DATA_SIZE: 1000
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
        // 获取教师令牌
        const teacherResponse = await request(app)
            .post('/api/auth/teacher-login')
            .send({ teacherId: 'admin', password: 'admin123' });
        teacherToken = teacherResponse.body.data.token;

        // 创建大量测试学生用于性能测试
        const studentPromises = [];
        for (let i = 1; i <= 100; i++) {
            const student = {
                id: `PERF${i.toString().padStart(3, '0')}`,
                name: `性能测试学生${i}`,
                class: '性能测试班'
            };
            
            studentPromises.push(
                request(app)
                    .post('/api/students')
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send(student)
            );
        }

        await Promise.all(studentPromises);

        // 获取部分学生令牌
        for (let i = 1; i <= 10; i++) {
            const studentId = `PERF${i.toString().padStart(3, '0')}`;
            const loginResponse = await request(app)
                .post('/api/auth/student-login')
                .send({ studentId });
            studentTokens.push(loginResponse.body.data.token);
        }
    }

    async function cleanupTestData() {
        // 清理测试学生
        const deletePromises = [];
        for (let i = 1; i <= 100; i++) {
            const studentId = `PERF${i.toString().padStart(3, '0')}`;
            deletePromises.push(
                request(app)
                    .delete(`/api/students/${studentId}`)
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .catch(() => {}) // 忽略删除错误
            );
        }
        await Promise.all(deletePromises);
    }

    describe('API响应时间测试', () => {
        test('学生列表查询性能', async () => {
            const startTime = Date.now();
            
            const response = await request(app)
                .get('/api/students')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            const responseTime = Date.now() - startTime;
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.students.length).toBeGreaterThan(90);
            expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
            
            console.log(`学生列表查询响应时间: ${responseTime}ms`);
        });

        test('积分排行榜查询性能', async () => {
            // 先为学生添加一些积分数据
            const addPointsPromises = [];
            for (let i = 1; i <= 50; i++) {
                const studentId = `PERF${i.toString().padStart(3, '0')}`;
                addPointsPromises.push(
                    request(app)
                        .post('/api/points/add')
                        .set('Authorization', `Bearer ${teacherToken}`)
                        .send({
                            studentId,
                            points: Math.floor(Math.random() * 100) + 1,
                            reason: '性能测试积分'
                        })
                );
            }
            await Promise.all(addPointsPromises);

            const startTime = Date.now();
            
            const response = await request(app)
                .get('/api/points/rankings')
                .expect(200);

            const responseTime = Date.now() - startTime;
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.total.length).toBeGreaterThan(40);
            expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
            
            console.log(`积分排行榜查询响应时间: ${responseTime}ms`);
        });

        test('单个学生信息查询性能', async () => {
            const studentId = 'PERF001';
            const iterations = 10;
            const responseTimes = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = Date.now();
                
                const response = await request(app)
                    .get(`/api/students/${studentId}`)
                    .set('Authorization', `Bearer ${studentTokens[0]}`)
                    .expect(200);

                const responseTime = Date.now() - startTime;
                responseTimes.push(responseTime);
                
                expect(response.body.success).toBe(true);
            }

            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / iterations;
            const maxResponseTime = Math.max(...responseTimes);
            
            expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME / 2);
            expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
            
            console.log(`单个学生查询平均响应时间: ${avgResponseTime.toFixed(2)}ms, 最大: ${maxResponseTime}ms`);
        });

        test('积分历史查询性能', async () => {
            const studentId = 'PERF001';
            
            // 先创建大量积分记录
            const addRecordsPromises = [];
            for (let i = 0; i < 50; i++) {
                addRecordsPromises.push(
                    request(app)
                        .post('/api/points/add')
                        .set('Authorization', `Bearer ${teacherToken}`)
                        .send({
                            studentId,
                            points: Math.floor(Math.random() * 10) + 1,
                            reason: `历史记录${i + 1}`
                        })
                );
            }
            await Promise.all(addRecordsPromises);

            const startTime = Date.now();
            
            const response = await request(app)
                .get(`/api/points/history/${studentId}`)
                .set('Authorization', `Bearer ${studentTokens[0]}`)
                .expect(200);

            const responseTime = Date.now() - startTime;
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.records.length).toBeGreaterThan(45);
            expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
            
            console.log(`积分历史查询响应时间: ${responseTime}ms, 记录数: ${response.body.data.records.length}`);
        });
    });

    describe('批量操作性能测试', () => {
        test('批量积分操作性能', async () => {
            const batchSize = 50;
            const startTime = Date.now();
            
            const promises = [];
            for (let i = 1; i <= batchSize; i++) {
                const studentId = `PERF${i.toString().padStart(3, '0')}`;
                promises.push(
                    request(app)
                        .post('/api/points/add')
                        .set('Authorization', `Bearer ${teacherToken}`)
                        .send({
                            studentId,
                            points: 10,
                            reason: '批量操作测试'
                        })
                );
            }

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;
            
            // 验证所有操作都成功
            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
            });

            expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_OPERATION_TIME);
            
            const avgTimePerOperation = totalTime / batchSize;
            console.log(`批量积分操作总时间: ${totalTime}ms, 平均每操作: ${avgTimePerOperation.toFixed(2)}ms`);
        });

        test('批量商品创建性能', async () => {
            const batchSize = 20;
            const startTime = Date.now();
            
            const promises = [];
            for (let i = 1; i <= batchSize; i++) {
                promises.push(
                    request(app)
                        .post('/api/products')
                        .set('Authorization', `Bearer ${teacherToken}`)
                        .send({
                            name: `性能测试商品${i}`,
                            price: Math.floor(Math.random() * 50) + 10,
                            stock: Math.floor(Math.random() * 20) + 5,
                            description: `批量创建的测试商品${i}`
                        })
                );
            }

            const responses = await Promise.all(promises);
            const totalTime = Date.now() - startTime;
            
            // 验证所有操作都成功
            responses.forEach(response => {
                expect(response.status).toBe(201);
                expect(response.body.success).toBe(true);
            });

            expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.BATCH_OPERATION_TIME);
            
            // 清理创建的商品
            const deletePromises = responses.map(response => 
                request(app)
                    .delete(`/api/products/${response.body.data.product.id}`)
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .catch(() => {}) // 忽略删除错误
            );
            await Promise.all(deletePromises);
            
            console.log(`批量商品创建总时间: ${totalTime}ms, 平均每操作: ${(totalTime / batchSize).toFixed(2)}ms`);
        });
    });

    describe('并发压力测试', () => {
        test('高并发API请求处理', async () => {
            const concurrentRequests = PERFORMANCE_THRESHOLDS.CONCURRENT_REQUESTS;
            const startTime = Date.now();
            
            // 创建大量并发请求
            const promises = Array.from({ length: concurrentRequests }, (_, index) => {
                const endpoint = index % 3 === 0 ? '/api/points/rankings' :
                                index % 3 === 1 ? '/api/students' :
                                '/api/products';
                
                const token = index % 3 === 1 ? teacherToken : 
                             index % 3 === 2 ? teacherToken :
                             null; // 排行榜不需要认证

                const requestBuilder = request(app).get(endpoint);
                if (token) {
                    requestBuilder.set('Authorization', `Bearer ${token}`);
                }
                
                return requestBuilder;
            });

            const responses = await Promise.allSettled(promises);
            const totalTime = Date.now() - startTime;
            
            // 统计结果
            const successCount = responses.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length;
            
            const failureCount = responses.length - successCount;
            const successRate = (successCount / responses.length) * 100;
            
            // 至少80%的请求应该成功
            expect(successRate).toBeGreaterThan(80);
            
            console.log(`并发压力测试结果:`);
            console.log(`- 总请求数: ${concurrentRequests}`);
            console.log(`- 成功数: ${successCount}`);
            console.log(`- 失败数: ${failureCount}`);
            console.log(`- 成功率: ${successRate.toFixed(2)}%`);
            console.log(`- 总时间: ${totalTime}ms`);
            console.log(`- 平均响应时间: ${(totalTime / concurrentRequests).toFixed(2)}ms`);
        });

        test('并发积分操作压力测试', async () => {
            const concurrentOperations = 30;
            const studentId = 'PERF001';
            
            const startTime = Date.now();
            
            // 创建并发积分操作
            const promises = Array.from({ length: concurrentOperations }, (_, index) => {
                const isAdd = index % 2 === 0;
                return request(app)
                    .post(`/api/points/${isAdd ? 'add' : 'subtract'}`)
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId,
                        points: 1,
                        reason: `并发压力测试${index}`
                    });
            });

            const responses = await Promise.allSettled(promises);
            const totalTime = Date.now() - startTime;
            
            const successCount = responses.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length;
            
            // 验证数据一致性
            const finalBalanceResponse = await request(app)
                .get(`/api/students/${studentId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            
            const historyResponse = await request(app)
                .get(`/api/points/history/${studentId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            
            // 计算预期余额（从历史记录）
            const calculatedBalance = historyResponse.body.data.records.reduce((sum, record) => {
                return sum + record.points;
            }, 0);
            
            expect(finalBalanceResponse.body.data.student.balance).toBe(calculatedBalance);
            
            console.log(`并发积分操作压力测试:`);
            console.log(`- 并发操作数: ${concurrentOperations}`);
            console.log(`- 成功操作数: ${successCount}`);
            console.log(`- 总时间: ${totalTime}ms`);
            console.log(`- 最终余额: ${finalBalanceResponse.body.data.student.balance}`);
            console.log(`- 历史记录数: ${historyResponse.body.data.records.length}`);
        });

        test('并发商品预约压力测试', async () => {
            // 创建库存有限的商品
            const productResponse = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    name: '压力测试商品',
                    price: 5,
                    stock: 10
                });
            
            const productId = productResponse.body.data.product.id;
            
            // 给学生足够积分
            const addPointsPromises = studentTokens.map((_, index) => {
                const studentId = `PERF${(index + 1).toString().padStart(3, '0')}`;
                return request(app)
                    .post('/api/points/add')
                    .set('Authorization', `Bearer ${teacherToken}`)
                    .send({
                        studentId,
                        points: 20,
                        reason: '预约测试积分'
                    });
            });
            await Promise.all(addPointsPromises);

            const startTime = Date.now();
            
            // 并发预约（学生数量大于库存）
            const promises = studentTokens.map(token => 
                request(app)
                    .post('/api/orders/reserve')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ productId })
            );

            const responses = await Promise.allSettled(promises);
            const totalTime = Date.now() - startTime;
            
            const successCount = responses.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length;
            
            const outOfStockCount = responses.filter(r => 
                r.status === 'fulfilled' && 
                r.value.status === 400 && 
                r.value.body.code === 'OUT_OF_STOCK'
            ).length;
            
            // 成功预约数应该等于库存数
            expect(successCount).toBe(10);
            expect(outOfStockCount).toBeGreaterThan(0);
            
            console.log(`并发商品预约压力测试:`);
            console.log(`- 并发请求数: ${studentTokens.length}`);
            console.log(`- 成功预约数: ${successCount}`);
            console.log(`- 库存不足数: ${outOfStockCount}`);
            console.log(`- 总时间: ${totalTime}ms`);
            
            // 清理测试数据
            await request(app)
                .delete(`/api/products/${productId}`)
                .set('Authorization', `Bearer ${teacherToken}`);
        });
    });

    describe('内存和资源使用测试', () => {
        test('大数据量处理内存稳定性', async () => {
            const initialMemory = process.memoryUsage();
            
            // 创建大量数据
            const largeDataOperations = [];
            for (let i = 0; i < PERFORMANCE_THRESHOLDS.LARGE_DATA_SIZE; i++) {
                largeDataOperations.push(
                    request(app)
                        .get('/api/points/rankings')
                        .expect(200)
                );
            }

            await Promise.all(largeDataOperations);
            
            // 强制垃圾回收（如果可用）
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            // 内存增长应该在合理范围内
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
            
            console.log(`大数据量处理内存使用:`);
            console.log(`- 初始内存: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`- 最终内存: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
            console.log(`- 内存增长: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        });

        test('长时间运行稳定性', async () => {
            const duration = 30000; // 30秒
            const interval = 1000; // 每秒一次请求
            const startTime = Date.now();
            const responseTimes = [];
            
            while (Date.now() - startTime < duration) {
                const requestStart = Date.now();
                
                const response = await request(app)
                    .get('/api/points/rankings')
                    .expect(200);
                
                const requestTime = Date.now() - requestStart;
                responseTimes.push(requestTime);
                
                expect(response.body.success).toBe(true);
                
                // 等待到下一个间隔
                const elapsed = Date.now() - requestStart;
                if (elapsed < interval) {
                    await new Promise(resolve => setTimeout(resolve, interval - elapsed));
                }
            }
            
            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const maxResponseTime = Math.max(...responseTimes);
            const minResponseTime = Math.min(...responseTimes);
            
            // 响应时间应该保持稳定
            expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
            expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 2);
            
            console.log(`长时间运行稳定性测试 (${duration/1000}秒):`);
            console.log(`- 总请求数: ${responseTimes.length}`);
            console.log(`- 平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
            console.log(`- 最大响应时间: ${maxResponseTime}ms`);
            console.log(`- 最小响应时间: ${minResponseTime}ms`);
        }, 35000); // 增加测试超时时间
    });

    describe('数据库性能测试', () => {
        test('大量数据查询性能', async () => {
            // 创建大量积分记录
            const studentId = 'PERF050';
            const recordCount = 200;
            
            const addRecordsPromises = [];
            for (let i = 0; i < recordCount; i++) {
                addRecordsPromises.push(
                    request(app)
                        .post('/api/points/add')
                        .set('Authorization', `Bearer ${teacherToken}`)
                        .send({
                            studentId,
                            points: Math.floor(Math.random() * 10) + 1,
                            reason: `大量数据测试${i}`
                        })
                );
            }
            
            await Promise.all(addRecordsPromises);
            
            // 测试查询性能
            const startTime = Date.now();
            
            const response = await request(app)
                .get(`/api/points/history/${studentId}`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);
            
            const queryTime = Date.now() - startTime;
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.records.length).toBeGreaterThan(recordCount - 10); // 允许少量失败
            expect(queryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
            
            console.log(`大量数据查询性能:`);
            console.log(`- 记录数: ${response.body.data.records.length}`);
            console.log(`- 查询时间: ${queryTime}ms`);
        });

        test('复杂排行榜计算性能', async () => {
            // 确保有足够的数据用于排行榜计算
            const startTime = Date.now();
            
            const response = await request(app)
                .get('/api/points/rankings')
                .expect(200);
            
            const calculationTime = Date.now() - startTime;
            
            expect(response.body.success).toBe(true);
            expect(response.body.data.total.length).toBeGreaterThan(50);
            expect(response.body.data.daily).toBeDefined();
            expect(response.body.data.weekly).toBeDefined();
            expect(calculationTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
            
            console.log(`复杂排行榜计算性能:`);
            console.log(`- 学生数量: ${response.body.data.total.length}`);
            console.log(`- 计算时间: ${calculationTime}ms`);
        });
    });
});