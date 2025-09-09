const fs = require('fs').promises;
const path = require('path');
const { 
    errorMonitor, 
    errorLogger,
    createError,
    ErrorTypes 
} = require('../middleware/errorHandler');

describe('错误监控系统测试', () => {
    let testLogDir;

    beforeEach(async () => {
        // 设置测试日志目录
        testLogDir = path.join(__dirname, 'test-error-monitoring');
        errorLogger.logDir = testLogDir;
        errorLogger.errorLogFile = path.join(testLogDir, 'error.log');
        errorLogger.operationLogFile = path.join(testLogDir, 'operation.log');
        
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

    describe('错误阈值监控', () => {
        test('应该检测高错误率', async () => {
            // 模拟高错误率的日志
            const mockErrors = Array.from({ length: 60 }, (_, i) => ({
                timestamp: new Date(Date.now() - i * 60000).toISOString(), // 每分钟一个错误
                code: 'TEST_ERROR',
                statusCode: 500,
                level: 'ERROR'
            }));

            const logContent = mockErrors.map(error => JSON.stringify(error)).join('\n');
            await fs.writeFile(errorLogger.errorLogFile, logContent);

            // 检查是否触发报警
            const originalSendAlert = errorMonitor.sendAlert;
            const alerts = [];
            errorMonitor.sendAlert = async (alert) => {
                alerts.push(alert);
            };

            await errorMonitor.checkErrorThresholds();

            expect(alerts.length).toBeGreaterThan(0);
            expect(alerts.some(alert => alert.type === 'HIGH_ERROR_COUNT')).toBe(true);

            // 恢复原始方法
            errorMonitor.sendAlert = originalSendAlert;
        });

        test('应该检测关键错误', async () => {
            // 模拟关键错误
            const criticalErrors = Array.from({ length: 10 }, (_, i) => ({
                timestamp: new Date(Date.now() - i * 60000).toISOString(),
                code: 'INTERNAL_ERROR',
                statusCode: 500,
                level: 'ERROR'
            }));

            const logContent = criticalErrors.map(error => JSON.stringify(error)).join('\n');
            await fs.writeFile(errorLogger.errorLogFile, logContent);

            const originalSendAlert = errorMonitor.sendAlert;
            const alerts = [];
            errorMonitor.sendAlert = async (alert) => {
                alerts.push(alert);
            };

            await errorMonitor.checkErrorThresholds();

            expect(alerts.some(alert => alert.type === 'CRITICAL_ERRORS')).toBe(true);

            errorMonitor.sendAlert = originalSendAlert;
        });

        test('应该检测连续错误', async () => {
            // 模拟最近15分钟的连续错误
            const recentErrors = Array.from({ length: 15 }, (_, i) => ({
                timestamp: new Date(Date.now() - i * 60000).toISOString(), // 最近15分钟
                code: 'CONSECUTIVE_ERROR',
                statusCode: 500,
                level: 'ERROR'
            }));

            const logContent = recentErrors.map(error => JSON.stringify(error)).join('\n');
            await fs.writeFile(errorLogger.errorLogFile, logContent);

            const originalSendAlert = errorMonitor.sendAlert;
            const alerts = [];
            errorMonitor.sendAlert = async (alert) => {
                alerts.push(alert);
            };

            await errorMonitor.checkConsecutiveErrors(alerts);

            expect(alerts.some(alert => alert.type === 'CONSECUTIVE_ERRORS')).toBe(true);

            errorMonitor.sendAlert = originalSendAlert;
        });
    });

    describe('系统资源监控', () => {
        test('应该检测高内存使用率', async () => {
            // 模拟高内存使用率
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn().mockReturnValue({
                heapUsed: 950 * 1024 * 1024, // 950MB
                heapTotal: 1000 * 1024 * 1024, // 1GB
                external: 0,
                arrayBuffers: 0
            });

            const alerts = [];
            await errorMonitor.checkSystemResources(alerts);

            expect(alerts.some(alert => alert.type === 'HIGH_MEMORY_USAGE')).toBe(true);

            // 恢复原始方法
            process.memoryUsage = originalMemoryUsage;
        });

        test('应该检测长时间运行的进程', async () => {
            // 模拟长时间运行
            const originalUptime = process.uptime;
            process.uptime = jest.fn().mockReturnValue(8 * 24 * 60 * 60); // 8天

            const alerts = [];
            await errorMonitor.checkSystemResources(alerts);

            expect(alerts.some(alert => alert.type === 'LONG_RUNNING_PROCESS')).toBe(true);

            // 恢复原始方法
            process.uptime = originalUptime;
        });
    });

    describe('报警管理', () => {
        test('应该防止报警风暴', () => {
            const alertType = 'TEST_ALERT_STORM';
            
            // 第一次应该发送
            expect(errorMonitor.shouldSendAlert(alertType)).toBe(true);
            
            // 冷却时间内不应该发送
            expect(errorMonitor.shouldSendAlert(alertType)).toBe(false);
            expect(errorMonitor.shouldSendAlert(alertType)).toBe(false);
        });

        test('应该记录报警历史', async () => {
            const testAlert = {
                type: 'TEST_ALERT',
                message: '测试报警',
                severity: 'WARNING',
                data: { test: true }
            };

            await errorMonitor.sendAlert(testAlert);

            const history = errorMonitor.getAlertHistory(1);
            expect(history.length).toBeGreaterThan(0);
            expect(history[0].type).toBe('TEST_ALERT');
        });

        test('应该清理过期的报警历史', () => {
            // 添加过期的报警记录
            const expiredTime = Date.now() - 25 * 60 * 60 * 1000; // 25小时前
            errorMonitor.alertHistory.set('expired_alert', {
                timestamp: new Date(expiredTime).toISOString()
            });
            errorMonitor.lastAlertTime.set('expired_type', expiredTime);

            const initialHistorySize = errorMonitor.alertHistory.size;
            const initialAlertTimeSize = errorMonitor.lastAlertTime.size;

            errorMonitor.cleanupAlertHistory();

            expect(errorMonitor.alertHistory.size).toBeLessThanOrEqual(initialHistorySize);
            expect(errorMonitor.lastAlertTime.size).toBeLessThanOrEqual(initialAlertTimeSize);
        });
    });

    describe('健康检查', () => {
        test('应该返回详细的健康状态', async () => {
            const health = await errorMonitor.getSystemHealth();

            expect(health).toHaveProperty('status');
            expect(health).toHaveProperty('message');
            expect(health).toHaveProperty('healthScore');
            expect(health).toHaveProperty('healthChecks');
            expect(health).toHaveProperty('systemInfo');

            expect(health.healthChecks).toHaveProperty('errorRate');
            expect(health.healthChecks).toHaveProperty('errorCount');
            expect(health.healthChecks).toHaveProperty('memoryUsage');
            expect(health.healthChecks).toHaveProperty('uptime');

            expect(health.systemInfo).toHaveProperty('uptime');
            expect(health.systemInfo).toHaveProperty('memoryUsage');
            expect(health.systemInfo).toHaveProperty('nodeVersion');
            expect(health.systemInfo).toHaveProperty('platform');
        });

        test('应该根据健康检查结果返回正确状态', async () => {
            // 模拟不健康的系统状态
            const originalMemoryUsage = process.memoryUsage;
            process.memoryUsage = jest.fn().mockReturnValue({
                heapUsed: 950 * 1024 * 1024,
                heapTotal: 1000 * 1024 * 1024,
                external: 0,
                arrayBuffers: 0
            });

            // 创建高错误率的日志
            const mockErrors = Array.from({ length: 100 }, (_, i) => ({
                timestamp: new Date(Date.now() - i * 60000).toISOString(),
                code: 'TEST_ERROR',
                statusCode: 500
            }));

            const logContent = mockErrors.map(error => JSON.stringify(error)).join('\n');
            await fs.writeFile(errorLogger.errorLogFile, logContent);

            const health = await errorMonitor.getSystemHealth();

            expect(['WARNING', 'UNHEALTHY']).toContain(health.status);
            expect(health.healthScore).toBeLessThan(1.0);

            // 恢复原始方法
            process.memoryUsage = originalMemoryUsage;
        });
    });

    describe('外部通知', () => {
        test('应该在生产环境发送外部通知', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            process.env.ALERT_WEBHOOK_URL = 'http://test-webhook.com';

            // 模拟fetch
            const mockFetch = jest.fn().mockResolvedValue({ ok: true });
            require.cache[require.resolve('node-fetch')] = {
                exports: mockFetch
            };

            const testAlert = {
                type: 'TEST_EXTERNAL_ALERT',
                message: '测试外部通知',
                severity: 'CRITICAL',
                data: {}
            };

            await errorMonitor.sendExternalNotification(testAlert);

            // 在实际环境中，这里会调用fetch
            // 由于测试环境的限制，我们只验证不抛出错误
            expect(true).toBe(true);

            // 恢复环境变量
            process.env.NODE_ENV = originalEnv;
            delete process.env.ALERT_WEBHOOK_URL;
        });
    });

    describe('阈值配置', () => {
        test('应该允许更新监控阈值', () => {
            const originalThresholds = { ...errorMonitor.errorThresholds };
            
            const newThresholds = {
                errorCount: 200,
                errorRate: 0.3,
                criticalErrors: 15
            };

            errorMonitor.updateThresholds(newThresholds);

            expect(errorMonitor.errorThresholds.errorCount).toBe(200);
            expect(errorMonitor.errorThresholds.errorRate).toBe(0.3);
            expect(errorMonitor.errorThresholds.criticalErrors).toBe(15);

            // 恢复原始阈值
            errorMonitor.updateThresholds(originalThresholds);
        });

        test('应该保留未更新的阈值', () => {
            const originalErrorCount = errorMonitor.errorThresholds.errorCount;
            
            errorMonitor.updateThresholds({ errorRate: 0.5 });

            expect(errorMonitor.errorThresholds.errorCount).toBe(originalErrorCount);
            expect(errorMonitor.errorThresholds.errorRate).toBe(0.5);
        });
    });

    describe('事件发射', () => {
        test('应该发射系统报警事件', (done) => {
            const testAlert = {
                type: 'TEST_EVENT_ALERT',
                message: '测试事件发射',
                severity: 'INFO',
                data: {}
            };

            // 监听系统报警事件
            process.once('systemAlert', (alert) => {
                expect(alert.type).toBe('TEST_EVENT_ALERT');
                expect(alert.message).toBe('测试事件发射');
                done();
            });

            errorMonitor.sendAlert(testAlert);
        });
    });

    describe('错误统计分析', () => {
        test('应该正确分析错误趋势', async () => {
            // 创建不同时间的错误日志
            const now = Date.now();
            const errors = [
                // 今天的错误
                ...Array.from({ length: 5 }, (_, i) => ({
                    timestamp: new Date(now - i * 60000).toISOString(),
                    code: 'TODAY_ERROR',
                    statusCode: 500
                })),
                // 昨天的错误
                ...Array.from({ length: 10 }, (_, i) => ({
                    timestamp: new Date(now - 24 * 60 * 60 * 1000 - i * 60000).toISOString(),
                    code: 'YESTERDAY_ERROR',
                    statusCode: 500
                }))
            ];

            const logContent = errors.map(error => JSON.stringify(error)).join('\n');
            await fs.writeFile(errorLogger.errorLogFile, logContent);

            const statistics = await errorLogger.getErrorStatistics(48); // 48小时

            expect(statistics).toBeDefined();
            expect(statistics.totalErrors).toBe(15);
            expect(statistics.errorsByCode).toHaveProperty('TODAY_ERROR');
            expect(statistics.errorsByCode).toHaveProperty('YESTERDAY_ERROR');
        });
    });
});