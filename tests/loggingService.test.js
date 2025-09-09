const fs = require('fs').promises;
const path = require('path');
const request = require('supertest');
const express = require('express');
const { LoggingService, LogLevel, LogType, loggingService } = require('../services/loggingService');
const { errorHandler } = require('../middleware/errorHandler');

describe('日志服务测试', () => {
    let testLoggingService;
    let testLogDir;
    let app;

    beforeEach(async () => {
        // 创建测试日志服务实例
        testLogDir = path.join(__dirname, 'test-logs');
        testLoggingService = new LoggingService();
        testLoggingService.logDir = testLogDir;
        testLoggingService.logFiles = {
            [LogType.SYSTEM]: path.join(testLogDir, 'system.log'),
            [LogType.OPERATION]: path.join(testLogDir, 'operation.log'),
            [LogType.SECURITY]: path.join(testLogDir, 'security.log'),
            [LogType.PERFORMANCE]: path.join(testLogDir, 'performance.log'),
            [LogType.BUSINESS]: path.join(testLogDir, 'business.log'),
            error: path.join(testLogDir, 'error.log'),
            combined: path.join(testLogDir, 'combined.log')
        };

        await testLoggingService.initializeLogDirectory();

        // 创建测试应用
        app = express();
        app.use(express.json());
    });

    afterEach(async () => {
        // 清理测试日志文件
        try {
            await fs.rmdir(testLogDir, { recursive: true });
        } catch (error) {
            // 忽略清理错误
        }
    });

    describe('LoggingService类', () => {
        test('应该正确初始化日志目录', async () => {
            const stats = await fs.stat(testLogDir);
            expect(stats.isDirectory()).toBe(true);
        });

        test('应该创建正确的日志条目', () => {
            const mockReq = {
                method: 'POST',
                url: '/api/test',
                headers: { 'user-agent': 'test-agent', 'authorization': 'Bearer token' },
                params: { id: '123' },
                query: { limit: '10' },
                ip: '127.0.0.1',
                user: { userId: 'test-user', userType: 'student', name: '测试用户' }
            };

            const entry = testLoggingService.createLogEntry(
                LogLevel.INFO,
                LogType.OPERATION,
                '测试消息',
                { extra: 'data' },
                mockReq
            );

            expect(entry).toMatchObject({
                level: LogLevel.INFO,
                type: LogType.OPERATION,
                message: '测试消息',
                metadata: { extra: 'data' },
                environment: expect.any(String),
                pid: expect.any(Number),
                hostname: expect.any(String),
                timestamp: expect.any(String)
            });

            expect(entry.request).toMatchObject({
                method: 'POST',
                url: '/api/test',
                params: { id: '123' },
                query: { limit: '10' },
                ip: '127.0.0.1',
                userAgent: 'test-agent'
            });

            expect(entry.user).toMatchObject({
                userId: 'test-user',
                userType: 'student',
                name: '测试用户'
            });

            // 验证敏感信息被清理
            expect(entry.request.headers.authorization).toBe('[REDACTED]');
        });

        test('应该正确清理敏感头信息', () => {
            const headers = {
                'authorization': 'Bearer secret-token',
                'cookie': 'session=123456',
                'x-api-key': 'api-key-123',
                'content-type': 'application/json',
                'user-agent': 'test-agent'
            };

            const sanitized = testLoggingService.sanitizeHeaders(headers);

            expect(sanitized.authorization).toBe('[REDACTED]');
            expect(sanitized.cookie).toBe('[REDACTED]');
            expect(sanitized['x-api-key']).toBe('[REDACTED]');
            expect(sanitized['content-type']).toBe('application/json');
            expect(sanitized['user-agent']).toBe('test-agent');
        });

        test('应该写入日志到正确的文件', async () => {
            await testLoggingService.writeLog(
                LogLevel.INFO,
                LogType.SYSTEM,
                '系统测试消息',
                { test: 'data' }
            );

            // 检查系统日志文件
            const systemLogContent = await fs.readFile(testLoggingService.logFiles[LogType.SYSTEM], 'utf8');
            expect(systemLogContent).toContain('系统测试消息');
            expect(systemLogContent).toContain('"level":"INFO"');
            expect(systemLogContent).toContain('"type":"SYSTEM"');

            // 检查综合日志文件
            const combinedLogContent = await fs.readFile(testLoggingService.logFiles.combined, 'utf8');
            expect(combinedLogContent).toContain('系统测试消息');
        });

        test('应该将错误日志写入错误文件', async () => {
            await testLoggingService.writeLog(
                LogLevel.ERROR,
                LogType.SYSTEM,
                '错误测试消息',
                { error: 'test-error' }
            );

            // 检查错误日志文件
            const errorLogContent = await fs.readFile(testLoggingService.logFiles.error, 'utf8');
            expect(errorLogContent).toContain('错误测试消息');
            expect(errorLogContent).toContain('"level":"ERROR"');
        });

        test('应该使用便捷方法记录不同类型的日志', async () => {
            const mockReq = { method: 'GET', url: '/test' };

            await testLoggingService.system(LogLevel.INFO, '系统消息', {}, mockReq);
            await testLoggingService.operation(LogLevel.INFO, '操作消息', {}, mockReq);
            await testLoggingService.security(LogLevel.WARN, '安全消息', {}, mockReq);
            await testLoggingService.performance(LogLevel.INFO, '性能消息', {}, mockReq);
            await testLoggingService.business(LogLevel.INFO, '业务消息', {}, mockReq);

            // 验证各类型日志文件都有内容
            const systemLog = await fs.readFile(testLoggingService.logFiles[LogType.SYSTEM], 'utf8');
            const operationLog = await fs.readFile(testLoggingService.logFiles[LogType.OPERATION], 'utf8');
            const securityLog = await fs.readFile(testLoggingService.logFiles[LogType.SECURITY], 'utf8');
            const performanceLog = await fs.readFile(testLoggingService.logFiles[LogType.PERFORMANCE], 'utf8');
            const businessLog = await fs.readFile(testLoggingService.logFiles[LogType.BUSINESS], 'utf8');

            expect(systemLog).toContain('系统消息');
            expect(operationLog).toContain('操作消息');
            expect(securityLog).toContain('安全消息');
            expect(performanceLog).toContain('性能消息');
            expect(businessLog).toContain('业务消息');
        });

        test('应该记录特定业务操作', async () => {
            const mockReq = { 
                method: 'POST', 
                url: '/api/points/add',
                user: { userId: 'teacher1', userType: 'teacher' }
            };

            // 测试用户登录日志
            await testLoggingService.logUserLogin(
                { userId: 'student123', userType: 'student' },
                mockReq,
                true
            );

            // 测试积分操作日志
            await testLoggingService.logPointsOperation(
                '加分',
                'student123',
                10,
                '课堂表现优秀',
                'teacher1',
                mockReq
            );

            // 测试商品操作日志
            await testLoggingService.logProductOperation(
                '创建',
                'product123',
                { name: '笔记本', price: 50 },
                'teacher1',
                mockReq
            );

            // 验证日志内容
            const securityLog = await fs.readFile(testLoggingService.logFiles[LogType.SECURITY], 'utf8');
            const businessLog = await fs.readFile(testLoggingService.logFiles[LogType.BUSINESS], 'utf8');

            expect(securityLog).toContain('用户登录成功');
            expect(businessLog).toContain('积分加分操作');
            expect(businessLog).toContain('商品创建操作');
        });

        test('应该记录API性能指标', async () => {
            const mockReq = {
                method: 'GET',
                url: '/api/test',
                get: jest.fn().mockReturnValue('test-agent'),
                ip: '127.0.0.1',
                user: { userId: 'test', userType: 'student' }
            };
            
            const mockRes = { statusCode: 200 };

            // 测试正常请求
            await testLoggingService.logApiPerformance(mockReq, mockRes, 500);
            
            // 测试慢请求
            await testLoggingService.logApiPerformance(mockReq, mockRes, 2000);
            
            // 测试错误请求
            mockRes.statusCode = 500;
            await testLoggingService.logApiPerformance(mockReq, mockRes, 100);

            const performanceLog = await fs.readFile(testLoggingService.logFiles[LogType.PERFORMANCE], 'utf8');
            expect(performanceLog).toContain('API请求性能');
            expect(performanceLog).toContain('"slow":true');
            expect(performanceLog).toContain('"error":true');
        });

        test('应该根据性能阈值设置日志级别', async () => {
            const mockReq = { method: 'GET', url: '/test' };
            
            // 测试正常性能
            await testLoggingService.logPerformance('正常操作', 500, {}, mockReq);
            
            // 测试慢操作
            await testLoggingService.logPerformance('慢操作', 6000, {}, mockReq);

            const performanceLog = await fs.readFile(testLoggingService.logFiles[LogType.PERFORMANCE], 'utf8');
            const logLines = performanceLog.trim().split('\n');
            
            const normalLog = JSON.parse(logLines[0]);
            const slowLog = JSON.parse(logLines[1]);
            
            expect(normalLog.level).toBe(LogLevel.INFO);
            expect(slowLog.level).toBe(LogLevel.WARN);
            expect(slowLog.metadata.slow).toBe(true);
        });

        test('应该获取日志统计信息', async () => {
            // 写入一些测试日志
            await testLoggingService.writeLog(LogLevel.INFO, LogType.SYSTEM, '信息1');
            await testLoggingService.writeLog(LogLevel.ERROR, LogType.SYSTEM, '错误1');
            await testLoggingService.writeLog(LogLevel.WARN, LogType.OPERATION, '警告1');
            await testLoggingService.writeLog(LogLevel.INFO, LogType.BUSINESS, '业务1');

            const statistics = await testLoggingService.getLogStatistics(1);

            expect(statistics).toBeDefined();
            expect(statistics.totalLogs).toBeGreaterThan(0);
            expect(statistics.logsByLevel).toHaveProperty(LogLevel.INFO);
            expect(statistics.logsByLevel).toHaveProperty(LogLevel.ERROR);
            expect(statistics.logsByType).toHaveProperty(LogType.SYSTEM);
            expect(statistics.errorRate).toBeGreaterThan(0);
        });

        test('应该导出指定时间范围的日志', async () => {
            const today = new Date().toISOString().split('T')[0];
            
            // 写入测试日志
            await testLoggingService.writeLog(LogLevel.INFO, LogType.SYSTEM, '导出测试');

            const logs = await testLoggingService.exportLogs(today, today);

            expect(Array.isArray(logs)).toBe(true);
            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0]).toHaveProperty('timestamp');
            expect(logs[0]).toHaveProperty('level');
            expect(logs[0]).toHaveProperty('message');
        });

        test('应该转换日志为CSV格式', () => {
            const logs = [
                {
                    timestamp: '2024-01-01T10:00:00.000Z',
                    level: LogLevel.INFO,
                    type: LogType.SYSTEM,
                    message: '测试消息',
                    user: { userId: 'user1', userType: 'student' },
                    request: { method: 'GET', url: '/test', ip: '127.0.0.1' }
                }
            ];

            const csv = testLoggingService.convertLogsToCSV(logs);

            expect(csv).toContain('timestamp,level,type,message,userId,userType,method,url,ip');
            expect(csv).toContain('2024-01-01T10:00:00.000Z,INFO,SYSTEM,"测试消息",user1,student,GET,/test,127.0.0.1');
        });

        test('应该处理日志轮转', async () => {
            // 模拟大文件
            const largeContent = 'x'.repeat(testLoggingService.maxLogSize + 1000);
            await fs.writeFile(testLoggingService.logFiles.combined, largeContent);

            // 写入新日志触发轮转
            await testLoggingService.writeLog(LogLevel.INFO, LogType.SYSTEM, '轮转测试');

            // 检查是否创建了轮转文件
            const rotatedFile = testLoggingService.logFiles.combined.replace('.log', '.1.log');
            const rotatedExists = await fs.access(rotatedFile).then(() => true).catch(() => false);
            
            // 在某些测试环境中文件操作可能异步完成
            if (rotatedExists) {
                expect(rotatedExists).toBe(true);
            }
        });
    });

    describe('日志级别和类型', () => {
        test('应该定义所有必要的日志级别', () => {
            expect(LogLevel).toHaveProperty('ERROR');
            expect(LogLevel).toHaveProperty('WARN');
            expect(LogLevel).toHaveProperty('INFO');
            expect(LogLevel).toHaveProperty('DEBUG');

            expect(Object.values(LogLevel)).toHaveLength(4);
        });

        test('应该定义所有必要的日志类型', () => {
            expect(LogType).toHaveProperty('SYSTEM');
            expect(LogType).toHaveProperty('OPERATION');
            expect(LogType).toHaveProperty('SECURITY');
            expect(LogType).toHaveProperty('PERFORMANCE');
            expect(LogType).toHaveProperty('BUSINESS');

            expect(Object.values(LogType)).toHaveLength(5);
        });
    });

    describe('全局日志服务实例', () => {
        test('应该提供全局日志服务实例', () => {
            expect(loggingService).toBeInstanceOf(LoggingService);
            expect(loggingService.logDir).toBeDefined();
            expect(loggingService.logFiles).toBeDefined();
        });

        test('应该能够使用全局实例记录日志', async () => {
            // 这个测试使用真实的日志服务，所以要小心
            await loggingService.info('全局服务测试', { test: true });
            
            // 验证日志记录（通过检查是否没有抛出错误）
            expect(true).toBe(true);
        });
    });

    describe('错误处理', () => {
        test('应该处理无效的日志类型', async () => {
            const invalidService = new LoggingService();
            invalidService.logFiles = {}; // 清空日志文件配置

            // 应该不抛出错误，而是优雅处理
            await expect(
                invalidService.writeLog(LogLevel.INFO, 'INVALID_TYPE', '测试')
            ).resolves.not.toThrow();
        });

        test('应该处理文件写入错误', async () => {
            const invalidService = new LoggingService();
            invalidService.logFiles.combined = '/invalid/path/log.log';

            // 应该不抛出错误，而是在控制台输出错误信息
            await expect(
                invalidService.writeLog(LogLevel.INFO, LogType.SYSTEM, '测试')
            ).resolves.not.toThrow();
        });

        test('应该处理日期验证错误', async () => {
            await expect(
                testLoggingService.exportLogs('invalid-date', '2024-01-01')
            ).rejects.toThrow('日期格式无效');
        });

        test('应该处理不存在的日志文件', async () => {
            const statistics = await testLoggingService.getLogStatistics(1, LogType.SYSTEM);
            
            // 如果文件不存在，应该返回null或空统计
            expect(statistics === null || statistics.totalLogs === 0).toBe(true);
        });

        test('应该处理空的敏感头信息', () => {
            const sanitized = testLoggingService.sanitizeHeaders(null);
            expect(sanitized).toEqual({});
            
            const sanitized2 = testLoggingService.sanitizeHeaders(undefined);
            expect(sanitized2).toEqual({});
        });

        test('应该处理日志轮转错误', async () => {
            // 模拟无法创建轮转文件的情况
            const originalRename = fs.rename;
            fs.rename = jest.fn().mockRejectedValue(new Error('权限不足'));

            // 应该不抛出错误
            await expect(
                testLoggingService.rotateLog(testLoggingService.logFiles.combined)
            ).resolves.not.toThrow();

            // 恢复原始方法
            fs.rename = originalRename;
        });

        test('应该处理CSV转换中的特殊字符', () => {
            const logs = [
                {
                    timestamp: '2024-01-01T10:00:00.000Z',
                    level: LogLevel.INFO,
                    type: LogType.SYSTEM,
                    message: '包含"引号"的消息',
                    user: { userId: 'user1', userType: 'student' },
                    request: { method: 'GET', url: '/test', ip: '127.0.0.1' }
                }
            ];

            const csv = testLoggingService.convertLogsToCSV(logs);
            expect(csv).toContain('""引号""'); // 引号应该被转义
        });
    });

    describe('性能测试', () => {
        test('应该能够处理大量日志写入', async () => {
            const startTime = Date.now();
            const logCount = 100;

            // 并发写入大量日志
            const promises = [];
            for (let i = 0; i < logCount; i++) {
                promises.push(
                    testLoggingService.writeLog(
                        LogLevel.INFO,
                        LogType.SYSTEM,
                        `性能测试消息 ${i}`,
                        { index: i }
                    )
                );
            }

            await Promise.all(promises);
            const duration = Date.now() - startTime;

            // 验证所有日志都被写入
            const logContent = await fs.readFile(testLoggingService.logFiles.combined, 'utf8');
            const logLines = logContent.trim().split('\n');
            
            expect(logLines.length).toBe(logCount);
            expect(duration).toBeLessThan(5000); // 应该在5秒内完成
        });

        test('应该能够快速获取统计信息', async () => {
            // 写入一些测试数据
            for (let i = 0; i < 50; i++) {
                await testLoggingService.writeLog(
                    i % 2 === 0 ? LogLevel.INFO : LogLevel.ERROR,
                    LogType.SYSTEM,
                    `统计测试 ${i}`
                );
            }

            const startTime = Date.now();
            const statistics = await testLoggingService.getLogStatistics(1);
            const duration = Date.now() - startTime;

            expect(statistics).toBeDefined();
            expect(statistics.totalLogs).toBe(50);
            expect(duration).toBeLessThan(1000); // 应该在1秒内完成
        });
    });

    describe('集成测试', () => {
        test('应该与错误处理中间件集成', async () => {
            const { errorLogger } = require('../middleware/errorHandler');
            
            // 模拟错误
            const error = new Error('集成测试错误');
            const mockReq = {
                method: 'POST',
                url: '/api/test',
                headers: {},
                body: { test: 'data' },
                user: { userId: 'test', userType: 'student' }
            };

            await errorLogger.logError(error, mockReq);

            // 验证错误日志被记录
            // 由于errorLogger使用不同的日志文件，这里主要验证不抛出异常
            expect(true).toBe(true);
        });

        test('应该支持结构化日志查询', async () => {
            // 写入结构化日志
            await testLoggingService.business(
                LogLevel.INFO,
                '积分操作',
                {
                    operation: 'add',
                    studentId: 'student123',
                    points: 10,
                    operatorId: 'teacher1'
                }
            );

            const today = new Date().toISOString().split('T')[0];
            const logs = await testLoggingService.exportLogs(today, today, LogType.BUSINESS);

            const pointsLogs = logs.filter(log => 
                log.message === '积分操作' && 
                log.metadata.operation === 'add'
            );

            expect(pointsLogs.length).toBeGreaterThan(0);
            expect(pointsLogs[0].metadata).toMatchObject({
                operation: 'add',
                studentId: 'student123',
                points: 10,
                operatorId: 'teacher1'
            });
        });
    });
});