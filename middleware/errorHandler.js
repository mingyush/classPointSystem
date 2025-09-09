const fs = require('fs').promises;
const path = require('path');

/**
 * 错误类型定义
 */
class AppError extends Error {
    constructor(message, statusCode, code = null, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        this.timestamp = new Date().toISOString();
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 预定义错误类型
 */
const ErrorTypes = {
    // 验证错误 (400)
    VALIDATION_ERROR: { statusCode: 400, code: 'VALIDATION_ERROR' },
    INVALID_STUDENT_ID: { statusCode: 400, code: 'INVALID_STUDENT_ID' },
    INVALID_POINTS: { statusCode: 400, code: 'INVALID_POINTS' },
    INVALID_REASON: { statusCode: 400, code: 'INVALID_REASON' },
    INVALID_LIMIT: { statusCode: 400, code: 'INVALID_LIMIT' },
    INVALID_DATE_RANGE: { statusCode: 400, code: 'INVALID_DATE_RANGE' },
    INVALID_RANKING_TYPE: { statusCode: 400, code: 'INVALID_RANKING_TYPE' },
    
    // 认证错误 (401)
    TOKEN_MISSING: { statusCode: 401, code: 'TOKEN_MISSING' },
    TOKEN_INVALID: { statusCode: 401, code: 'TOKEN_INVALID' },
    INVALID_CREDENTIALS: { statusCode: 401, code: 'INVALID_CREDENTIALS' },
    
    // 权限错误 (403)
    PERMISSION_DENIED: { statusCode: 403, code: 'PERMISSION_DENIED' },
    TEACHER_REQUIRED: { statusCode: 403, code: 'TEACHER_REQUIRED' },
    STUDENT_REQUIRED: { statusCode: 403, code: 'STUDENT_REQUIRED' },
    
    // 资源不存在 (404)
    STUDENT_NOT_FOUND: { statusCode: 404, code: 'STUDENT_NOT_FOUND' },
    PRODUCT_NOT_FOUND: { statusCode: 404, code: 'PRODUCT_NOT_FOUND' },
    ORDER_NOT_FOUND: { statusCode: 404, code: 'ORDER_NOT_FOUND' },
    RESOURCE_NOT_FOUND: { statusCode: 404, code: 'RESOURCE_NOT_FOUND' },
    
    // 业务逻辑错误 (409)
    INSUFFICIENT_POINTS: { statusCode: 409, code: 'INSUFFICIENT_POINTS' },
    PRODUCT_OUT_OF_STOCK: { statusCode: 409, code: 'PRODUCT_OUT_OF_STOCK' },
    ORDER_ALREADY_EXISTS: { statusCode: 409, code: 'ORDER_ALREADY_EXISTS' },
    DUPLICATE_RESOURCE: { statusCode: 409, code: 'DUPLICATE_RESOURCE' },
    
    // 系统错误 (500)
    INTERNAL_ERROR: { statusCode: 500, code: 'INTERNAL_ERROR' },
    DATABASE_ERROR: { statusCode: 500, code: 'DATABASE_ERROR' },
    FILE_OPERATION_ERROR: { statusCode: 500, code: 'FILE_OPERATION_ERROR' },
    SERVICE_UNAVAILABLE: { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },
    
    // 限流错误 (429)
    TOO_MANY_REQUESTS: { statusCode: 429, code: 'TOO_MANY_REQUESTS' },
    
    // 超时错误 (408)
    REQUEST_TIMEOUT: { statusCode: 408, code: 'REQUEST_TIMEOUT' },
    
    // 配置错误 (500)
    CONFIGURATION_ERROR: { statusCode: 500, code: 'CONFIGURATION_ERROR' },
    
    // 网络错误 (502)
    NETWORK_ERROR: { statusCode: 502, code: 'NETWORK_ERROR' }
};

/**
 * 创建标准化错误
 */
function createError(type, message, details = null) {
    const errorType = ErrorTypes[type];
    if (!errorType) {
        throw new Error(`未知错误类型: ${type}`);
    }
    
    return new AppError(message, errorType.statusCode, errorType.code, details);
}

/**
 * 错误日志记录器
 */
class ErrorLogger {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.errorLogFile = path.join(this.logDir, 'error.log');
        this.operationLogFile = path.join(this.logDir, 'operation.log');
        this.initializeLogDirectory();
    }

    async initializeLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('创建日志目录失败:', error);
        }
    }

    /**
     * 记录错误日志
     */
    async logError(error, req = null, additionalInfo = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'ERROR',
            message: error.message,
            code: error.code || 'UNKNOWN_ERROR',
            statusCode: error.statusCode || 500,
            stack: error.stack,
            request: req ? {
                method: req.method,
                url: req.url,
                headers: this.sanitizeHeaders(req.headers),
                body: this.sanitizeBody(req.body),
                params: req.params,
                query: req.query,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            } : null,
            user: req && req.user ? {
                userId: req.user.userId,
                userType: req.user.userType,
                name: req.user.name
            } : null,
            additionalInfo,
            environment: process.env.NODE_ENV || 'development'
        };

        try {
            await fs.appendFile(
                this.errorLogFile,
                JSON.stringify(logEntry) + '\n',
                'utf8'
            );
        } catch (writeError) {
            console.error('写入错误日志失败:', writeError);
        }

        // 在开发环境下同时输出到控制台
        if (process.env.NODE_ENV === 'development') {
            console.error('错误日志:', logEntry);
        }
    }

    /**
     * 记录操作日志
     */
    async logOperation(operation, req, result = null, additionalInfo = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            operation,
            result: result ? 'SUCCESS' : 'FAILED',
            request: {
                method: req.method,
                url: req.url,
                params: req.params,
                query: req.query,
                ip: req.ip || req.connection.remoteAddress
            },
            user: req.user ? {
                userId: req.user.userId,
                userType: req.user.userType,
                name: req.user.name
            } : null,
            additionalInfo,
            environment: process.env.NODE_ENV || 'development'
        };

        try {
            await fs.appendFile(
                this.operationLogFile,
                JSON.stringify(logEntry) + '\n',
                'utf8'
            );
        } catch (writeError) {
            console.error('写入操作日志失败:', writeError);
        }
    }

    /**
     * 清理敏感的请求头信息
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        delete sanitized.authorization;
        delete sanitized.cookie;
        return sanitized;
    }

    /**
     * 清理敏感的请求体信息
     */
    sanitizeBody(body) {
        if (!body) return null;
        
        const sanitized = { ...body };
        delete sanitized.password;
        delete sanitized.token;
        return sanitized;
    }

    /**
     * 获取错误统计信息
     */
    async getErrorStatistics(hours = 24) {
        try {
            const logContent = await fs.readFile(this.errorLogFile, 'utf8');
            const lines = logContent.trim().split('\n').filter(line => line);
            const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            
            const recentErrors = lines
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(entry => entry && new Date(entry.timestamp) > cutoffTime);

            const statistics = {
                totalErrors: recentErrors.length,
                errorsByCode: {},
                errorsByStatusCode: {},
                errorsByHour: {},
                topErrors: []
            };

            recentErrors.forEach(error => {
                // 按错误码统计
                statistics.errorsByCode[error.code] = (statistics.errorsByCode[error.code] || 0) + 1;
                
                // 按状态码统计
                statistics.errorsByStatusCode[error.statusCode] = (statistics.errorsByStatusCode[error.statusCode] || 0) + 1;
                
                // 按小时统计
                const hour = new Date(error.timestamp).getHours();
                statistics.errorsByHour[hour] = (statistics.errorsByHour[hour] || 0) + 1;
            });

            // 获取最常见的错误
            statistics.topErrors = Object.entries(statistics.errorsByCode)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([code, count]) => ({ code, count }));

            return statistics;
        } catch (error) {
            console.error('获取错误统计失败:', error);
            return null;
        }
    }
}

// 创建全局错误日志记录器实例
const errorLogger = new ErrorLogger();

/**
 * 统一错误处理中间件
 */
function errorHandler(err, req, res, next) {
    // 记录错误日志
    errorLogger.logError(err, req).catch(console.error);

    // 如果是自定义的应用错误
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            code: err.code,
            timestamp: err.timestamp,
            ...(process.env.NODE_ENV === 'development' && err.details && { details: err.details })
        });
    }

    // JWT错误处理
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: '访问令牌无效',
            code: 'TOKEN_INVALID',
            timestamp: new Date().toISOString()
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: '访问令牌已过期',
            code: 'TOKEN_EXPIRED',
            timestamp: new Date().toISOString()
        });
    }

    // 语法错误处理
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: '请求数据格式错误',
            code: 'INVALID_JSON',
            timestamp: new Date().toISOString()
        });
    }

    // 未知错误处理
    console.error('未处理的错误:', err);
    
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { 
            error: err.message,
            stack: err.stack 
        })
    });
}

/**
 * 404错误处理中间件
 */
function notFoundHandler(req, res) {
    const error = createError('RESOURCE_NOT_FOUND', '请求的资源不存在');
    errorLogger.logError(error, req).catch(console.error);
    
    res.status(404).json({
        success: false,
        message: '请求的资源不存在',
        code: 'RESOURCE_NOT_FOUND',
        timestamp: new Date().toISOString(),
        path: req.path
    });
}

/**
 * 异步错误捕获包装器
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * 操作日志记录中间件
 */
function operationLogger(operation) {
    return (req, res, next) => {
        const startTime = Date.now();
        const originalSend = res.send;
        
        res.send = function(data) {
            const duration = Date.now() - startTime;
            
            // 记录操作日志
            const success = res.statusCode < 400;
            errorLogger.logOperation(operation, req, success, {
                statusCode: res.statusCode,
                responseSize: data ? data.length : 0,
                duration: `${duration}ms`
            }).catch(console.error);
            
            originalSend.call(this, data);
        };
        
        next();
    };
}

/**
 * 性能监控中间件
 */
function performanceMonitor() {
    return (req, res, next) => {
        const startTime = Date.now();
        const startCpuUsage = process.cpuUsage();
        
        res.on('finish', async () => {
            const duration = Date.now() - startTime;
            const cpuUsage = process.cpuUsage(startCpuUsage);
            
            // 只记录慢请求或错误请求
            if (duration > 1000 || res.statusCode >= 400) {
                try {
                    const { loggingService } = require('../services/loggingService');
                    await loggingService.logApiPerformance(req, res, duration);
                } catch (error) {
                    console.error('记录API性能失败:', error);
                }
            }
        });
        
        next();
    };
}

/**
 * 请求限流中间件
 */
function rateLimiter(maxRequests = 100, windowMs = 60000) {
    const requests = new Map();
    
    return (req, res, next) => {
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // 清理过期记录
        if (!requests.has(clientId)) {
            requests.set(clientId, []);
        }
        
        const clientRequests = requests.get(clientId);
        const validRequests = clientRequests.filter(time => time > windowStart);
        
        if (validRequests.length >= maxRequests) {
            const error = createError('TOO_MANY_REQUESTS', '请求过于频繁，请稍后再试');
            return next(error);
        }
        
        validRequests.push(now);
        requests.set(clientId, validRequests);
        
        next();
    };
}

/**
 * 错误监控和报警
 */
class ErrorMonitor {
    constructor() {
        this.errorThresholds = {
            errorRate: 0.1, // 10%错误率阈值
            errorCount: 50,  // 1小时内错误数量阈值
            criticalErrors: 5, // 关键错误数量阈值
            consecutiveErrors: 10, // 连续错误阈值
            responseTimeThreshold: 5000 // 响应时间阈值(ms)
        };
        
        this.alertHistory = new Map(); // 报警历史记录
        this.lastAlertTime = new Map(); // 上次报警时间
        this.alertCooldown = 15 * 60 * 1000; // 15分钟报警冷却时间
        this.intervals = []; // 存储定时器引用
        
        // 只在非测试环境启动定时器
        if (process.env.NODE_ENV !== 'test') {
            // 每5分钟检查一次错误情况
            this.intervals.push(setInterval(() => {
                this.checkErrorThresholds().catch(console.error);
            }, 5 * 60 * 1000));
            
            // 每小时清理一次报警历史
            this.intervals.push(setInterval(() => {
                this.cleanupAlertHistory();
            }, 60 * 60 * 1000));
        }
    }

    /**
     * 清理定时器（用于测试环境）
     */
    destroy() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }

    async checkErrorThresholds() {
        try {
            const statistics = await errorLogger.getErrorStatistics(1); // 检查最近1小时
            if (!statistics) return;

            const alerts = [];

            // 检查错误数量阈值
            if (statistics.totalErrors > this.errorThresholds.errorCount) {
                const alertKey = 'HIGH_ERROR_COUNT';
                if (this.shouldSendAlert(alertKey)) {
                    alerts.push({
                        type: alertKey,
                        message: `最近1小时内发生了${statistics.totalErrors}个错误，超过阈值${this.errorThresholds.errorCount}`,
                        severity: 'WARNING',
                        data: statistics
                    });
                }
            }

            // 检查错误率阈值
            const totalRequests = statistics.totalErrors + 1000; // 估算总请求数
            const errorRate = statistics.totalErrors / totalRequests;
            if (errorRate > this.errorThresholds.errorRate) {
                const alertKey = 'HIGH_ERROR_RATE';
                if (this.shouldSendAlert(alertKey)) {
                    alerts.push({
                        type: alertKey,
                        message: `错误率${(errorRate * 100).toFixed(2)}%超过阈值${(this.errorThresholds.errorRate * 100)}%`,
                        severity: 'WARNING',
                        data: { errorRate, statistics }
                    });
                }
            }

            // 检查关键错误
            const criticalErrorCodes = ['INTERNAL_ERROR', 'DATABASE_ERROR', 'FILE_OPERATION_ERROR', 'SERVICE_UNAVAILABLE'];
            const criticalErrorCount = criticalErrorCodes.reduce((count, code) => {
                return count + (statistics.errorsByCode[code] || 0);
            }, 0);

            if (criticalErrorCount > this.errorThresholds.criticalErrors) {
                const alertKey = 'CRITICAL_ERRORS';
                if (this.shouldSendAlert(alertKey)) {
                    alerts.push({
                        type: alertKey,
                        message: `最近1小时内发生了${criticalErrorCount}个关键错误，超过阈值${this.errorThresholds.criticalErrors}`,
                        severity: 'CRITICAL',
                        data: { criticalErrorCount, statistics }
                    });
                }
            }

            // 检查连续错误
            await this.checkConsecutiveErrors(alerts);

            // 检查系统资源状态
            await this.checkSystemResources(alerts);

            // 发送报警
            for (const alert of alerts) {
                await this.sendAlert(alert);
            }

        } catch (error) {
            console.error('错误监控检查失败:', error);
        }
    }

    /**
     * 检查是否应该发送报警（避免报警风暴）
     */
    shouldSendAlert(alertType) {
        const lastAlert = this.lastAlertTime.get(alertType);
        const now = Date.now();
        
        if (!lastAlert || (now - lastAlert) > this.alertCooldown) {
            this.lastAlertTime.set(alertType, now);
            return true;
        }
        
        return false;
    }

    /**
     * 检查连续错误
     */
    async checkConsecutiveErrors(alerts) {
        try {
            const recentStatistics = await errorLogger.getErrorStatistics(0.25); // 最近15分钟
            if (!recentStatistics || recentStatistics.totalErrors < this.errorThresholds.consecutiveErrors) {
                return;
            }

            const alertKey = 'CONSECUTIVE_ERRORS';
            if (this.shouldSendAlert(alertKey)) {
                alerts.push({
                    type: alertKey,
                    message: `最近15分钟内连续发生${recentStatistics.totalErrors}个错误`,
                    severity: 'CRITICAL',
                    data: recentStatistics
                });
            }
        } catch (error) {
            console.error('检查连续错误失败:', error);
        }
    }

    /**
     * 检查系统资源状态
     */
    async checkSystemResources(alerts) {
        try {
            const memoryUsage = process.memoryUsage();
            const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
            
            // 检查内存使用率
            if (memoryUsagePercent > 0.9) { // 90%内存使用率
                const alertKey = 'HIGH_MEMORY_USAGE';
                if (this.shouldSendAlert(alertKey)) {
                    alerts.push({
                        type: alertKey,
                        message: `内存使用率${(memoryUsagePercent * 100).toFixed(2)}%过高`,
                        severity: 'WARNING',
                        data: { memoryUsage, memoryUsagePercent }
                    });
                }
            }

            // 检查进程运行时间（可能表示内存泄漏）
            const uptime = process.uptime();
            if (uptime > 7 * 24 * 60 * 60) { // 7天
                const alertKey = 'LONG_RUNNING_PROCESS';
                if (this.shouldSendAlert(alertKey)) {
                    alerts.push({
                        type: alertKey,
                        message: `进程已运行${Math.floor(uptime / (24 * 60 * 60))}天，建议重启`,
                        severity: 'INFO',
                        data: { uptime }
                    });
                }
            }
        } catch (error) {
            console.error('检查系统资源失败:', error);
        }
    }

    /**
     * 清理报警历史
     */
    cleanupAlertHistory() {
        const now = Date.now();
        const cleanupThreshold = 24 * 60 * 60 * 1000; // 24小时

        for (const [alertType, timestamp] of this.lastAlertTime.entries()) {
            if (now - timestamp > cleanupThreshold) {
                this.lastAlertTime.delete(alertType);
            }
        }

        for (const [alertId, alert] of this.alertHistory.entries()) {
            if (now - new Date(alert.timestamp).getTime() > cleanupThreshold) {
                this.alertHistory.delete(alertId);
            }
        }
    }

    async sendAlert(alert) {
        const alertId = `${alert.type}_${Date.now()}`;
        const alertLogEntry = {
            id: alertId,
            timestamp: new Date().toISOString(),
            level: 'ALERT',
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            data: alert.data,
            environment: process.env.NODE_ENV || 'development',
            hostname: require('os').hostname(),
            pid: process.pid
        };

        // 存储到报警历史
        this.alertHistory.set(alertId, alertLogEntry);

        try {
            const alertLogFile = path.join(process.cwd(), 'logs', 'alerts.log');
            await fs.appendFile(
                alertLogFile,
                JSON.stringify(alertLogEntry) + '\n',
                'utf8'
            );
        } catch (error) {
            console.error('写入报警日志失败:', error);
        }

        // 根据严重程度选择不同的输出方式
        const severityColors = {
            'INFO': '\x1b[36m',      // 青色
            'WARNING': '\x1b[33m',   // 黄色
            'CRITICAL': '\x1b[31m'   // 红色
        };
        
        const color = severityColors[alert.severity] || '\x1b[37m';
        const resetColor = '\x1b[0m';
        
        console.log(`${color}🚨 [${alert.severity}] ${alert.type}: ${alert.message}${resetColor}`);

        // 在生产环境中发送外部通知
        if (process.env.NODE_ENV === 'production') {
            await this.sendExternalNotification(alertLogEntry);
        }

        // 触发内部事件（可供其他模块监听）
        process.emit('systemAlert', alertLogEntry);
    }

    /**
     * 发送外部通知（生产环境）
     */
    async sendExternalNotification(alert) {
        try {
            // 这里可以集成各种外部通知服务
            // 例如：邮件、短信、钉钉、企业微信、Slack等
            
            // 示例：发送到webhook
            if (process.env.ALERT_WEBHOOK_URL) {
                const fetch = require('node-fetch');
                await fetch(process.env.ALERT_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: `系统报警: ${alert.message}`,
                        alert: alert
                    })
                });
            }

            // 示例：发送邮件
            if (process.env.ALERT_EMAIL && alert.severity === 'CRITICAL') {
                // 这里可以集成邮件服务
                console.log(`应发送邮件报警到: ${process.env.ALERT_EMAIL}`);
            }

        } catch (error) {
            console.error('发送外部通知失败:', error);
        }
    }

    /**
     * 获取系统健康状态
     */
    async getSystemHealth() {
        try {
            const statistics = await errorLogger.getErrorStatistics(24);
            if (!statistics) {
                return { status: 'UNKNOWN', message: '无法获取错误统计信息' };
            }

            const errorRate = statistics.totalErrors / Math.max(1, statistics.totalErrors + 100); // 假设正常请求数
            const memoryUsage = process.memoryUsage();
            const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
            
            // 综合评估健康状态
            const healthChecks = {
                errorRate: errorRate <= this.errorThresholds.errorRate,
                errorCount: statistics.totalErrors <= this.errorThresholds.errorCount,
                memoryUsage: memoryUsagePercent <= 0.9,
                uptime: process.uptime() < 7 * 24 * 60 * 60 // 7天
            };

            const healthyChecks = Object.values(healthChecks).filter(Boolean).length;
            const totalChecks = Object.keys(healthChecks).length;
            const healthScore = healthyChecks / totalChecks;

            let status, message;
            if (healthScore >= 0.9) {
                status = 'HEALTHY';
                message = '系统运行正常';
            } else if (healthScore >= 0.7) {
                status = 'WARNING';
                message = '系统存在一些问题，需要关注';
            } else {
                status = 'UNHEALTHY';
                message = '系统存在严重问题，需要立即处理';
            }

            return {
                status,
                message,
                healthScore,
                healthChecks,
                statistics,
                systemInfo: {
                    uptime: process.uptime(),
                    memoryUsage,
                    memoryUsagePercent,
                    nodeVersion: process.version,
                    platform: process.platform
                }
            };

        } catch (error) {
            return {
                status: 'ERROR',
                message: '健康检查失败: ' + error.message
            };
        }
    }

    /**
     * 获取报警历史
     */
    getAlertHistory(hours = 24) {
        const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
        const recentAlerts = [];

        for (const [alertId, alert] of this.alertHistory.entries()) {
            if (new Date(alert.timestamp).getTime() > cutoffTime) {
                recentAlerts.push(alert);
            }
        }

        return recentAlerts.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    /**
     * 更新报警阈值
     */
    updateThresholds(newThresholds) {
        this.errorThresholds = { ...this.errorThresholds, ...newThresholds };
        console.log('报警阈值已更新:', this.errorThresholds);
    }

    /**
     * 手动触发健康检查
     */
    async triggerHealthCheck() {
        console.log('手动触发健康检查...');
        await this.checkErrorThresholds();
        return await this.getSystemHealth();
    }
}

// 创建错误监控实例
const errorMonitor = new ErrorMonitor();

module.exports = {
    AppError,
    ErrorTypes,
    createError,
    errorHandler,
    notFoundHandler,
    asyncHandler,
    operationLogger,
    performanceMonitor,
    rateLimiter,
    errorLogger,
    errorMonitor
};