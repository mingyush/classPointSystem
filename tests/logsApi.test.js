const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const logsRouter = require('../api/logs');
const { errorHandler } = require('../middleware/errorHandler');
const { loggingService } = require('../services/loggingService');

describe('日志API测试', () => {
    let app;
    let teacherToken;
    let studentToken;
    let testLogDir;

    beforeAll(() => {
        // 创建测试应用
        app = express();
        app.use(express.json());
        app.use('/api/logs', logsRouter);
        app.use(errorHandler);

        // 创建测试token
        const jwtSecret = process.env.JWT_SECRET || 'test-secret';
        teacherToken = jwt.sign(
            { userId: 'teacher1', userType: 'teacher', name: '测试教师' },
            jwtSecret,
            { expiresIn: '1h' }
        );
        studentToken = jwt.sign(
            { userId: 'student1', userType: 'student', name: '测试学生' },
            jwtSecret,
            { expiresIn: '1h' }
        );
    });

    beforeEach(async () => {
        // 设置测试日志目录
        testLogDir = path.join(__dirname, 'test-logs-api');
        loggingService.logDir = testLogDir;
        loggingService.logFiles = {
            SYSTEM: path.join(testLogDir, 'system.log'),
            OPERATION: path.join(testLogDir, 'operation.log'),
            SECURITY: path.join(testLogDir, 'security.log'),
            PERFORMANCE: path.join(testLogDir, 'performance.log'),
            BUSINESS: path.join(testLogDir, 'business.log'),
            error: path.join(testLogDir, 'error.log'),
            combined: path.join(testLogDir, 'combined.log')
        };

        await fs.mkdir(testLogDir, { recursive: true });
    });

    afterEach(async () => {
        // 清理测试文件
        try {
            await fs.rmdir(testLogDir, { recursive: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    describe('GET /api/logs/statistics', () => {
        test('教师应该能够获取日志统计', async () => {
            // 先写入一些测试日志
            await loggingService.info('测试日志1');
            await loggingService.error('测试错误1');
            await loggingService.warn('测试警告1');

            const response = await request(app)
                .get('/api/logs/statistics?hours=1')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('statistics');
            expect(response.body.data.timeRange).toBe('1小时');
        });

        test('学生不应该能够访问日志统计', async () => {
            await request(app)
                .get('/api/logs/statistics')
                .set('Authorization', `Bearer ${studentToken}`)
                .expect(403);
        });

        test('应该验证时间范围参数', async () => {
            await request(app)
                .get('/api/logs/statistics?hours=200')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('时间范围必须为1-168小时之间');
                });
        });

        test('应该验证日志类型参数', async () => {
            await request(app)
                .get('/api/logs/statistics?type=INVALID_TYPE')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('日志类型必须为');
                });
        });
    });

    describe('GET /api/logs/export', () => {
        test('应该能够导出JSON格式的日志', async () => {
            // 写入测试日志
            await loggingService.info('导出测试日志');

            const today = new Date().toISOString().split('T')[0];

            const response = await request(app)
                .get(`/api/logs/export?startDate=${today}&endDate=${today}&format=json`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('logs');
            expect(Array.isArray(response.body.data.logs)).toBe(true);
        });

        test('应该能够导出CSV格式的日志', async () => {
            // 写入测试日志
            await loggingService.info('CSV导出测试');

            const today = new Date().toISOString().split('T')[0];

            const response = await request(app)
                .get(`/api/logs/export?startDate=${today}&endDate=${today}&format=csv`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.headers['content-type']).toContain('text/csv');
            expect(response.text).toContain('timestamp,level,type,message');
        });

        test('应该验证必需的日期参数', async () => {
            await request(app)
                .get('/api/logs/export')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('开始日期和结束日期不能为空');
                });
        });

        test('应该验证导出格式', async () => {
            const today = new Date().toISOString().split('T')[0];

            await request(app)
                .get(`/api/logs/export?startDate=${today}&endDate=${today}&format=xml`)
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('导出格式必须为json或csv');
                });
        });
    });

    describe('GET /api/logs/health', () => {
        test('应该返回系统健康状态', async () => {
            const response = await request(app)
                .get('/api/logs/health')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.data).toHaveProperty('status');
            expect(response.body.data).toHaveProperty('message');
            expect(response.body.data).toHaveProperty('logStatistics');
            expect(response.body.data).toHaveProperty('uptime');
            expect(response.body.data).toHaveProperty('memory');
        });

        test('不健康状态应该返回503', async () => {
            // 模拟不健康状态
            const { errorMonitor } = require('../middleware/errorHandler');
            const originalGetSystemHealth = errorMonitor.getSystemHealth;
            
            errorMonitor.getSystemHealth = jest.fn().mockResolvedValue({
                status: 'UNHEALTHY',
                message: '系统不健康',
                statistics: {}
            });

            await request(app)
                .get('/api/logs/health')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(503);

            // 恢复原始方法
            errorMonitor.getSystemHealth = originalGetSystemHealth;
        });
    });

    describe('POST /api/logs/cleanup', () => {
        test('应该能够清理旧日志', async () => {
            const response = await request(app)
                .post('/api/logs/cleanup')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ daysToKeep: 7 })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('成功清理7天前的旧日志');
        });

        test('应该验证保留天数参数', async () => {
            await request(app)
                .post('/api/logs/cleanup')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({ daysToKeep: 400 })
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('保留天数必须为1-365之间的数字');
                });
        });
    });

    describe('GET /api/logs/definitions', () => {
        test('应该返回日志类型和级别定义', async () => {
            const response = await request(app)
                .get('/api/logs/definitions')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.data).toHaveProperty('logLevels');
            expect(response.body.data).toHaveProperty('logTypes');
            expect(response.body.data).toHaveProperty('descriptions');
            
            expect(Array.isArray(response.body.data.logLevels)).toBe(true);
            expect(Array.isArray(response.body.data.logTypes)).toBe(true);
        });
    });

    describe('POST /api/logs/search', () => {
        test('应该能够搜索日志', async () => {
            // 写入测试日志
            await loggingService.info('搜索测试日志', { keyword: 'searchable' });
            await loggingService.error('错误日志', { keyword: 'error' });

            const today = new Date().toISOString().split('T')[0];

            const response = await request(app)
                .post('/api/logs/search')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    startDate: today,
                    endDate: today,
                    keyword: '搜索测试',
                    limit: 10
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('searchCriteria');
            expect(response.body.data).toHaveProperty('totalFound');
            expect(response.body.data).toHaveProperty('logs');
        });

        test('应该按级别过滤日志', async () => {
            // 写入不同级别的日志
            await loggingService.info('信息日志');
            await loggingService.error('错误日志');

            const today = new Date().toISOString().split('T')[0];

            const response = await request(app)
                .post('/api/logs/search')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    startDate: today,
                    endDate: today,
                    level: 'ERROR'
                })
                .expect(200);

            expect(response.body.data.logs.every(log => log.level === 'ERROR')).toBe(true);
        });

        test('应该验证搜索参数', async () => {
            await request(app)
                .post('/api/logs/search')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    startDate: '2024-01-01'
                    // 缺少endDate
                })
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('开始日期和结束日期不能为空');
                });
        });

        test('应该限制搜索结果数量', async () => {
            const today = new Date().toISOString().split('T')[0];

            await request(app)
                .post('/api/logs/search')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    startDate: today,
                    endDate: today,
                    limit: 2000
                })
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('限制数量必须为1-1000之间的数字');
                });
        });
    });

    describe('GET /api/logs/error-trends', () => {
        test('应该返回错误趋势分析', async () => {
            // 写入一些错误日志
            await loggingService.error('趋势测试错误1');
            await loggingService.error('趋势测试错误2');

            const response = await request(app)
                .get('/api/logs/error-trends?days=1')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('trends');
            expect(response.body.data).toHaveProperty('summary');
            expect(Array.isArray(response.body.data.trends)).toBe(true);
        });

        test('应该验证天数参数', async () => {
            await request(app)
                .get('/api/logs/error-trends?days=50')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(400)
                .expect(res => {
                    expect(res.body.message).toContain('天数必须为1-30之间的数字');
                });
        });
    });

    describe('权限控制', () => {
        test('未认证用户不应该能够访问任何日志API', async () => {
            await request(app)
                .get('/api/logs/statistics')
                .expect(401);

            await request(app)
                .get('/api/logs/health')
                .expect(401);

            await request(app)
                .post('/api/logs/search')
                .send({})
                .expect(401);
        });

        test('学生用户不应该能够访问日志API', async () => {
            const endpoints = [
                { method: 'get', path: '/api/logs/statistics' },
                { method: 'get', path: '/api/logs/export?startDate=2024-01-01&endDate=2024-01-01' },
                { method: 'get', path: '/api/logs/health' },
                { method: 'post', path: '/api/logs/cleanup' },
                { method: 'get', path: '/api/logs/definitions' },
                { method: 'post', path: '/api/logs/search' },
                { method: 'get', path: '/api/logs/error-trends' }
            ];

            for (const endpoint of endpoints) {
                await request(app)
                    [endpoint.method](endpoint.path)
                    .set('Authorization', `Bearer ${studentToken}`)
                    .send({})
                    .expect(403);
            }
        });
    });

    describe('错误处理', () => {
        test('应该处理日志服务错误', async () => {
            // 模拟日志服务错误
            const originalGetLogStatistics = loggingService.getLogStatistics;
            loggingService.getLogStatistics = jest.fn().mockResolvedValue(null);

            await request(app)
                .get('/api/logs/statistics')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(500)
                .expect(res => {
                    expect(res.body.message).toContain('获取日志统计失败');
                });

            // 恢复原始方法
            loggingService.getLogStatistics = originalGetLogStatistics;
        });

        test('应该处理健康检查错误', async () => {
            const { errorMonitor } = require('../middleware/errorHandler');
            const originalGetSystemHealth = errorMonitor.getSystemHealth;
            
            errorMonitor.getSystemHealth = jest.fn().mockRejectedValue(new Error('健康检查失败'));

            await request(app)
                .get('/api/logs/health')
                .set('Authorization', `Bearer ${teacherToken}`)
                .expect(500);

            // 恢复原始方法
            errorMonitor.getSystemHealth = originalGetSystemHealth;
        });
    });

    describe('性能测试', () => {
        test('大量日志搜索应该在合理时间内完成', async () => {
            // 写入大量测试日志
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(loggingService.info(`性能测试日志 ${i}`, { index: i }));
            }
            await Promise.all(promises);

            const today = new Date().toISOString().split('T')[0];
            const startTime = Date.now();

            const response = await request(app)
                .post('/api/logs/search')
                .set('Authorization', `Bearer ${teacherToken}`)
                .send({
                    startDate: today,
                    endDate: today,
                    keyword: '性能测试'
                })
                .expect(200);

            const duration = Date.now() - startTime;
            
            expect(response.body.success).toBe(true);
            expect(duration).toBeLessThan(5000); // 应该在5秒内完成
        });
    });
});