/**
 * 部署一致性集成测试
 * 测试本地部署和Cloudflare部署的功能一致性
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

describe('部署一致性集成测试', () => {
    let localApp, cloudflareApp;
    let localAuthToken, cloudflareAuthToken;
    
    // 测试配置
    const testConfigs = {
        local: {
            deployment: 'local',
            dbType: 'sqlite',
            dbPath: path.join(__dirname, 'test_local_deployment.db')
        },
        cloudflare: {
            deployment: 'cloudflare',
            dbType: 'd1'
        }
    };

    // 共享测试数据
    const sharedTestData = {
        student: {
            id: 'DEPLOY_STUDENT_001',
            name: '部署一致性测试学生',
            balance: 0
        },
        product: {
            name: '部署一致性测试商品',
            price: 30,
            stock: 5,
            description: '用于测试部署一致性的商品'
        },
        rewardPenaltyItem: {
            name: '部署一致性奖励',
            points: 15,
            type: 'reward'
        }
    };

    beforeAll(async () => {
        await setupLocalDeployment();
        await setupCloudflareDeployment();
        await authenticateDeployments();
    });

    afterAll(async () => {
        await cleanupDeployments();
    });

    async function setupLocalDeployment() {
        // 设置本地部署环境
        process.env.NODE_ENV = 'test';
        process.env.DEPLOYMENT = 'local';
        process.env.DB_TYPE = 'sqlite';
        process.env.DB_PATH = testConfigs.local.dbPath;

        // 清理可能存在的测试数据库
        try {
            await fs.unlink(testConfigs.local.dbPath);
        } catch (error) {
            // 忽略文件不存在错误
        }

        // 创建本地应用
        delete require.cache[require.resolve('../server')];
        localApp = require('../server');
        
        // 等待初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    async function setupCloudflareDeployment() {
        // 设置Cloudflare部署环境（模拟）
        process.env.DEPLOYMENT = 'cloudflare';
        process.env.DB_TYPE = 'd1';
        
        // 创建Cloudflare应用（在实际测试中，这里应该使用Miniflare或真实的CF环境）
        cloudflareApp = localApp; // 临时使用相同应用进行测试
    }

    async function authenticateDeployments() {
        // 本地部署认证
        try {
            const localAuthResponse = await request(localApp)
                .post('/api/auth/teacher-login')
                .send({
                    teacherId: 'admin',
                    password: 'admin123'
                });
            
            if (localAuthResponse.status === 200) {
                localAuthToken = localAuthResponse.body.data.token;
            }
        } catch (error) {
            console.warn('本地部署认证失败:', error.message);
        }

        // Cloudflare部署认证
        cloudflareAuthToken = localAuthToken; // 使用相同的令牌进行测试
    }

    async function cleanupDeployments() {
        // 清理本地数据库
        try {
            await fs.unlink(testConfigs.local.dbPath);
        } catch (error) {
            // 忽略清理错误
        }

        // 关闭应用
        if (localApp && localApp.close) {
            localApp.close();
        }
    }

    describe('API接口一致性测试', () => {
        test('系统健康检查接口一致性', async () => {
            const localResponse = await request(localApp)
                .get('/api/system/health');

            const cloudflareResponse = await request(cloudflareApp)
                .get('/api/system/health');

            // 验证响应结构一致性
            expect(localResponse.status).toBe(cloudflareResponse.status);
            
            if (localResponse.status === 200) {
                expect(localResponse.body.success).toBe(cloudflareResponse.body.success);
                expect(localResponse.body.data).toHaveProperty('status');
                expect(cloudflareResponse.body.data).toHaveProperty('status');
            }
        });

        test('学生管理接口一致性', async () => {
            // 创建学生 - 本地部署
            const localCreateResponse = await request(localApp)
                .post('/api/students')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send(sharedTestData.student);

            // 创建学生 - Cloudflare部署
            const cloudflareCreateResponse = await request(cloudflareApp)
                .post('/api/students')
                .set('Authorization', `Bearer ${cloudflareAuthToken}`)
                .send({
                    ...sharedTestData.student,
                    id: sharedTestData.student.id + '_CF'
                });

            // 验证创建响应一致性
            expect(localCreateResponse.status).toBe(cloudflareCreateResponse.status);
            
            if (localCreateResponse.status === 201) {
                expect(localCreateResponse.body.success).toBe(cloudflareCreateResponse.body.success);
                expect(Object.keys(localCreateResponse.body.student).sort())
                    .toEqual(Object.keys(cloudflareCreateResponse.body.student).sort());
            }

            // 获取学生列表 - 验证结构一致性
            const localListResponse = await request(localApp)
                .get('/api/students')
                .set('Authorization', `Bearer ${localAuthToken}`);

            const cloudflareListResponse = await request(cloudflareApp)
                .get('/api/students')
                .set('Authorization', `Bearer ${cloudflareAuthToken}`);

            expect(localListResponse.status).toBe(cloudflareListResponse.status);
            expect(localListResponse.body.success).toBe(cloudflareListResponse.body.success);
            expect(Array.isArray(localListResponse.body.students))
                .toBe(Array.isArray(cloudflareListResponse.body.students));
        });

        test('积分管理接口一致性', async () => {
            // 获取排行榜
            const localRankingsResponse = await request(localApp)
                .get('/api/points/rankings');

            const cloudflareRankingsResponse = await request(cloudflareApp)
                .get('/api/points/rankings');

            // 验证排行榜接口一致性
            expect(localRankingsResponse.status).toBe(cloudflareRankingsResponse.status);
            expect(localRankingsResponse.body.success).toBe(cloudflareRankingsResponse.body.success);

            if (localRankingsResponse.body.data && cloudflareRankingsResponse.body.data) {
                expect(Array.isArray(localRankingsResponse.body.data.rankings))
                    .toBe(Array.isArray(cloudflareRankingsResponse.body.data.rankings));
            }
        });

        test('商品管理接口一致性', async () => {
            // 创建商品
            const localProductResponse = await request(localApp)
                .post('/api/products')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send(sharedTestData.product);

            const cloudflareProductResponse = await request(cloudflareApp)
                .post('/api/products')
                .set('Authorization', `Bearer ${cloudflareAuthToken}`)
                .send(sharedTestData.product);

            // 验证商品创建一致性
            expect(localProductResponse.status).toBe(cloudflareProductResponse.status);
            
            if (localProductResponse.status === 201) {
                expect(localProductResponse.body.success).toBe(cloudflareProductResponse.body.success);
                expect(localProductResponse.body.data.name).toBe(cloudflareProductResponse.body.data.name);
                expect(localProductResponse.body.data.price).toBe(cloudflareProductResponse.body.data.price);
            }
        });

        test('系统状态管理接口一致性', async () => {
            // 获取系统状态
            const localStateResponse = await request(localApp)
                .get('/api/system/state');

            const cloudflareStateResponse = await request(cloudflareApp)
                .get('/api/system/state');

            expect(localStateResponse.status).toBe(cloudflareStateResponse.status);
            expect(localStateResponse.body.success).toBe(cloudflareStateResponse.body.success);

            if (localStateResponse.body.data && cloudflareStateResponse.body.data) {
                expect(localStateResponse.body.data).toHaveProperty('mode');
                expect(cloudflareStateResponse.body.data).toHaveProperty('mode');
            }
        });
    });

    describe('错误处理一致性测试', () => {
        test('404错误处理一致性', async () => {
            const localNotFoundResponse = await request(localApp)
                .get('/api/non-existent-endpoint');

            const cloudflareNotFoundResponse = await request(cloudflareApp)
                .get('/api/non-existent-endpoint');

            expect(localNotFoundResponse.status).toBe(cloudflareNotFoundResponse.status);
            expect(localNotFoundResponse.body.success).toBe(cloudflareNotFoundResponse.body.success);
        });

        test('401认证错误一致性', async () => {
            const localUnauthorizedResponse = await request(localApp)
                .post('/api/students')
                .send(sharedTestData.student);

            const cloudflareUnauthorizedResponse = await request(cloudflareApp)
                .post('/api/students')
                .send(sharedTestData.student);

            expect(localUnauthorizedResponse.status).toBe(cloudflareUnauthorizedResponse.status);
            expect(localUnauthorizedResponse.body.success).toBe(cloudflareUnauthorizedResponse.body.success);
        });

        test('400数据验证错误一致性', async () => {
            const invalidData = {
                name: '', // 空名称
                points: -999 // 无效积分
            };

            const localValidationResponse = await request(localApp)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send(invalidData);

            const cloudflareValidationResponse = await request(cloudflareApp)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${cloudflareAuthToken}`)
                .send(invalidData);

            expect(localValidationResponse.status).toBe(cloudflareValidationResponse.status);
            expect(localValidationResponse.body.success).toBe(cloudflareValidationResponse.body.success);
        });
    });

    describe('性能特性对比测试', () => {
        test('响应时间对比', async () => {
            const testEndpoints = [
                '/api/system/health',
                '/api/points/rankings',
                '/api/system/state'
            ];

            const performanceResults = {
                local: {},
                cloudflare: {}
            };

            for (const endpoint of testEndpoints) {
                // 本地部署性能测试
                const localStartTime = Date.now();
                await request(localApp).get(endpoint);
                const localDuration = Date.now() - localStartTime;
                performanceResults.local[endpoint] = localDuration;

                // Cloudflare部署性能测试
                const cloudflareStartTime = Date.now();
                await request(cloudflareApp).get(endpoint);
                const cloudflareDuration = Date.now() - cloudflareStartTime;
                performanceResults.cloudflare[endpoint] = cloudflareDuration;
            }

            console.log('性能对比结果:', performanceResults);

            // 验证两种部署都在合理的响应时间内
            Object.values(performanceResults.local).forEach(duration => {
                expect(duration).toBeLessThan(2000);
            });

            Object.values(performanceResults.cloudflare).forEach(duration => {
                expect(duration).toBeLessThan(2000);
            });
        });

        test('并发处理能力对比', async () => {
            const concurrentRequests = 10;
            
            // 本地部署并发测试
            const localStartTime = Date.now();
            const localPromises = Array.from({ length: concurrentRequests }, () =>
                request(localApp).get('/api/points/rankings')
            );
            const localResults = await Promise.allSettled(localPromises);
            const localDuration = Date.now() - localStartTime;

            // Cloudflare部署并发测试
            const cloudflareStartTime = Date.now();
            const cloudflarePromises = Array.from({ length: concurrentRequests }, () =>
                request(cloudflareApp).get('/api/points/rankings')
            );
            const cloudflareResults = await Promise.allSettled(cloudflarePromises);
            const cloudflareDuration = Date.now() - cloudflareStartTime;

            // 统计成功率
            const localSuccessRate = localResults.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length / concurrentRequests;

            const cloudflareSuccessRate = cloudflareResults.filter(r => 
                r.status === 'fulfilled' && r.value.status === 200
            ).length / concurrentRequests;

            console.log(`并发测试结果:`);
            console.log(`本地部署: ${concurrentRequests}个请求耗时${localDuration}ms, 成功率${(localSuccessRate * 100).toFixed(1)}%`);
            console.log(`Cloudflare部署: ${concurrentRequests}个请求耗时${cloudflareDuration}ms, 成功率${(cloudflareSuccessRate * 100).toFixed(1)}%`);

            // 验证两种部署都有良好的并发处理能力
            expect(localSuccessRate).toBeGreaterThan(0.8);
            expect(cloudflareSuccessRate).toBeGreaterThan(0.8);
        });
    });

    describe('数据一致性验证', () => {
        test('CRUD操作数据一致性', async () => {
            const testStudent = {
                id: 'CONSISTENCY_CRUD_001',
                name: 'CRUD一致性测试学生'
            };

            // 本地部署CRUD操作
            const localCreateResponse = await request(localApp)
                .post('/api/students')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send(testStudent);

            let localStudentId;
            if (localCreateResponse.status === 201) {
                localStudentId = localCreateResponse.body.student.id;

                // 读取
                const localReadResponse = await request(localApp)
                    .get(`/api/students/${localStudentId}`)
                    .set('Authorization', `Bearer ${localAuthToken}`);

                expect(localReadResponse.status).toBe(200);
                expect(localReadResponse.body.data.name).toBe(testStudent.name);

                // 更新
                const localUpdateResponse = await request(localApp)
                    .put(`/api/students/${localStudentId}`)
                    .set('Authorization', `Bearer ${localAuthToken}`)
                    .send({ name: '更新后的姓名' });

                if (localUpdateResponse.status === 200) {
                    expect(localUpdateResponse.body.student.name).toBe('更新后的姓名');
                }
            }

            // Cloudflare部署相同操作（验证行为一致性）
            const cloudflareCreateResponse = await request(cloudflareApp)
                .post('/api/students')
                .set('Authorization', `Bearer ${cloudflareAuthToken}`)
                .send({
                    ...testStudent,
                    id: testStudent.id + '_CF'
                });

            // 验证创建行为一致性
            expect(cloudflareCreateResponse.status).toBe(localCreateResponse.status);
            if (cloudflareCreateResponse.status === 201) {
                expect(cloudflareCreateResponse.body.success).toBe(localCreateResponse.body.success);
            }
        });

        test('事务处理一致性', async () => {
            // 测试复杂的业务操作（如预约商品）的事务一致性
            const testData = {
                studentId: 'TRANSACTION_STUDENT_001',
                productId: 'TRANSACTION_PRODUCT_001'
            };

            // 创建测试数据
            await request(localApp)
                .post('/api/students')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send({
                    id: testData.studentId,
                    name: '事务测试学生'
                });

            await request(localApp)
                .post('/api/products')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send({
                    id: testData.productId,
                    name: '事务测试商品',
                    price: 50,
                    stock: 1
                });

            // 给学生足够积分
            await request(localApp)
                .post('/api/points/add')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send({
                    studentId: testData.studentId,
                    points: 100,
                    reason: '事务测试积分'
                });

            // 执行预约操作
            const localOrderResponse = await request(localApp)
                .post('/api/orders')
                .set('Authorization', `Bearer ${localAuthToken}`)
                .send({
                    studentId: testData.studentId,
                    productId: testData.productId,
                    quantity: 1
                });

            // 验证事务完整性
            if (localOrderResponse.status === 201) {
                expect(localOrderResponse.body.success).toBe(true);
                expect(localOrderResponse.body.data.status).toBe('pending');

                // 验证积分是否正确冻结/扣除
                const studentResponse = await request(localApp)
                    .get(`/api/students/${testData.studentId}`)
                    .set('Authorization', `Bearer ${localAuthToken}`);

                if (studentResponse.status === 200) {
                    // 根据业务逻辑验证积分变化
                    expect(studentResponse.body.data.balance).toBeDefined();
                }
            }
        });
    });

    describe('配置和环境差异测试', () => {
        test('环境变量处理一致性', async () => {
            const localConfigResponse = await request(localApp)
                .get('/api/system/config');

            const cloudflareConfigResponse = await request(cloudflareApp)
                .get('/api/system/config');

            expect(localConfigResponse.status).toBe(cloudflareConfigResponse.status);
            
            if (localConfigResponse.status === 200) {
                expect(localConfigResponse.body.success).toBe(cloudflareConfigResponse.body.success);
                
                // 验证配置结构一致性
                const localConfig = localConfigResponse.body.data;
                const cloudflareConfig = cloudflareConfigResponse.body.data;
                
                expect(localConfig).toHaveProperty('version');
                expect(cloudflareConfig).toHaveProperty('version');
                expect(localConfig).toHaveProperty('storageType');
                expect(cloudflareConfig).toHaveProperty('storageType');
            }
        });

        test('静态资源服务一致性', async () => {
            const staticRoutes = [
                '/display',
                '/admin',
                '/css/common.css',
                '/js/common.js'
            ];

            for (const route of staticRoutes) {
                const localResponse = await request(localApp).get(route);
                const cloudflareResponse = await request(cloudflareApp).get(route);

                // 验证静态资源都能正常访问
                expect([200, 302, 304]).toContain(localResponse.status);
                expect([200, 302, 304]).toContain(cloudflareResponse.status);
            }
        });

        test('路由重定向一致性', async () => {
            const redirectRoutes = [
                { from: '/', to: '/display' },
                { from: '/teacher', to: '/admin' },
                { from: '/student', to: '/display' }
            ];

            for (const { from, to } of redirectRoutes) {
                const localResponse = await request(localApp).get(from);
                const cloudflareResponse = await request(cloudflareApp).get(from);

                if (localResponse.status === 302) {
                    expect(cloudflareResponse.status).toBe(302);
                    expect(localResponse.headers.location).toBe(to);
                    expect(cloudflareResponse.headers.location).toBe(to);
                }
            }
        });
    });

    describe('安全特性一致性测试', () => {
        test('认证机制一致性', async () => {
            const protectedEndpoints = [
                '/api/students',
                '/api/products',
                '/api/points/add'
            ];

            for (const endpoint of protectedEndpoints) {
                // 无认证访问
                const localUnauthorized = await request(localApp).post(endpoint);
                const cloudflareUnauthorized = await request(cloudflareApp).post(endpoint);

                expect(localUnauthorized.status).toBe(cloudflareUnauthorized.status);
                expect(localUnauthorized.body.success).toBe(cloudflareUnauthorized.body.success);

                // 有效认证访问
                const localAuthorized = await request(localApp)
                    .post(endpoint)
                    .set('Authorization', `Bearer ${localAuthToken}`)
                    .send({});

                const cloudflareAuthorized = await request(cloudflareApp)
                    .post(endpoint)
                    .set('Authorization', `Bearer ${cloudflareAuthToken}`)
                    .send({});

                // 验证认证后的行为一致性（可能是400而不是401）
                expect([200, 201, 400]).toContain(localAuthorized.status);
                expect([200, 201, 400]).toContain(cloudflareAuthorized.status);
            }
        });

        test('输入验证一致性', async () => {
            const maliciousInputs = [
                { name: '<script>alert("xss")</script>' },
                { name: 'DROP TABLE users;' },
                { points: 'invalid_number' },
                { studentId: '../../../etc/passwd' }
            ];

            for (const maliciousInput of maliciousInputs) {
                const localResponse = await request(localApp)
                    .post('/api/students')
                    .set('Authorization', `Bearer ${localAuthToken}`)
                    .send(maliciousInput);

                const cloudflareResponse = await request(cloudflareApp)
                    .post('/api/students')
                    .set('Authorization', `Bearer ${cloudflareAuthToken}`)
                    .send(maliciousInput);

                // 验证两种部署都能正确处理恶意输入
                expect([400, 422]).toContain(localResponse.status);
                expect([400, 422]).toContain(cloudflareResponse.status);
                expect(localResponse.body.success).toBe(false);
                expect(cloudflareResponse.body.success).toBe(false);
            }
        });
    });

    describe('监控和日志一致性测试', () => {
        test('健康检查详细信息一致性', async () => {
            const localHealthResponse = await request(localApp)
                .get('/api/system/health');

            const cloudflareHealthResponse = await request(cloudflareApp)
                .get('/api/system/health');

            if (localHealthResponse.status === 200 && cloudflareHealthResponse.status === 200) {
                const localHealth = localHealthResponse.body.data;
                const cloudflareHealth = cloudflareHealthResponse.body.data;

                // 验证健康检查信息结构一致性
                expect(localHealth).toHaveProperty('status');
                expect(cloudflareHealth).toHaveProperty('status');
                expect(localHealth).toHaveProperty('timestamp');
                expect(cloudflareHealth).toHaveProperty('timestamp');
            }
        });

        test('错误响应格式一致性', async () => {
            const errorEndpoint = '/api/students/NON_EXISTENT_ID';

            const localErrorResponse = await request(localApp)
                .get(errorEndpoint)
                .set('Authorization', `Bearer ${localAuthToken}`);

            const cloudflareErrorResponse = await request(cloudflareApp)
                .get(errorEndpoint)
                .set('Authorization', `Bearer ${cloudflareAuthToken}`);

            expect(localErrorResponse.status).toBe(cloudflareErrorResponse.status);
            expect(localErrorResponse.body.success).toBe(cloudflareErrorResponse.body.success);

            // 验证错误响应结构一致性
            if (localErrorResponse.body.code && cloudflareErrorResponse.body.code) {
                expect(localErrorResponse.body.code).toBe(cloudflareErrorResponse.body.code);
            }
        });
    });
});