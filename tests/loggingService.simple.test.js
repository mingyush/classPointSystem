const fs = require('fs').promises;
const path = require('path');
const { LoggingService, LogLevel, LogType } = require('../services/loggingService');

describe('日志服务 - 简化测试', () => {
    let testLoggingService;
    let testLogDir;

    beforeEach(async () => {
        // 创建测试日志服务实例
        testLogDir = path.join(__dirname, 'test-logs-simple');
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
                headers: { 'user-agent': 'test-agent' },
                params: { id: '123' },
                query: { limit: '10' },
                ip: '127.0.0.1',
                connection: { remoteAddress: '127.0.0.1' },
                get: jest.fn().mockReturnValue('test-agent'),
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
                metadata: { extra: 'data' }
            });

            expect(entry.request).toMatchObject({
                method: 'POST',
                url: '/api/test',
                params: { id: '123' },
                query: { limit: '10' },
                ip: '127.0.0.1'
            });

            expect(entry.user).toMatchObject({
                userId: 'test-user',
                userType: 'student',
                name: '测试用户'
            });
        });

        test('应该正确清理敏感头信息', () => {
            const headers = {
                'authorization': 'Bearer secret-token',
                'cookie': 'session=123456',
                'content-type': 'application/json',
                'user-agent': 'test-agent'
            };

            const sanitized = testLoggingService.sanitizeHeaders(headers);

            expect(sanitized.authorization).toBe('[REDACTED]');
            expect(sanitized.cookie).toBe('[REDACTED]');
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

        test('应该使用便捷方法记录日志', async () => {
            const mockReq = { 
                method: 'GET', 
                url: '/test',
                connection: { remoteAddress: '127.0.0.1' },
                get: jest.fn().mockReturnValue('test-agent')
            };

            await testLoggingService.info('信息消息', {}, mockReq);
            await testLoggingService.error('错误消息', null, {}, mockReq);
            await testLoggingService.warn('警告消息', {}, mockReq);

            // 验证日志文件有内容
            const combinedLog = await fs.readFile(testLoggingService.logFiles.combined, 'utf8');
            expect(combinedLog).toContain('信息消息');
            expect(combinedLog).toContain('错误消息');
            expect(combinedLog).toContain('警告消息');
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

    describe('错误处理', () => {
        test('应该处理空的敏感头信息', () => {
            const sanitized = testLoggingService.sanitizeHeaders(null);
            expect(sanitized).toEqual({});
            
            const sanitized2 = testLoggingService.sanitizeHeaders(undefined);
            expect(sanitized2).toEqual({});
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
});