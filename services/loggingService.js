const fs = require('fs').promises;
const path = require('path');
const { createError } = require('../middleware/errorHandler');

/**
 * 日志级别定义
 */
const LogLevel = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

/**
 * 日志类型定义
 */
const LogType = {
    SYSTEM: 'SYSTEM',           // 系统日志
    OPERATION: 'OPERATION',     // 操作日志
    SECURITY: 'SECURITY',       // 安全日志
    PERFORMANCE: 'PERFORMANCE', // 性能日志
    BUSINESS: 'BUSINESS'        // 业务日志
};

/**
 * 综合日志服务
 */
class LoggingService {
    constructor() {
        this.logDir = path.join(process.cwd(), 'logs');
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 10;
        this.logFiles = {
            [LogType.SYSTEM]: path.join(this.logDir, 'system.log'),
            [LogType.OPERATION]: path.join(this.logDir, 'operation.log'),
            [LogType.SECURITY]: path.join(this.logDir, 'security.log'),
            [LogType.PERFORMANCE]: path.join(this.logDir, 'performance.log'),
            [LogType.BUSINESS]: path.join(this.logDir, 'business.log'),
            error: path.join(this.logDir, 'error.log'),
            combined: path.join(this.logDir, 'combined.log')
        };
        
        this.initializeLogDirectory();
    }

    /**
     * 初始化日志目录
     */
    async initializeLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
        } catch (error) {
            console.error('创建日志目录失败:', error);
        }
    }

    /**
     * 写入日志
     */
    async writeLog(level, type, message, metadata = {}, req = null) {
        const logEntry = this.createLogEntry(level, type, message, metadata, req);
        
        try {
            // 写入对应类型的日志文件
            if (this.logFiles[type]) {
                await this.appendToFile(this.logFiles[type], logEntry);
            }

            // 写入综合日志文件
            await this.appendToFile(this.logFiles.combined, logEntry);

            // 错误级别的日志额外写入错误日志文件
            if (level === LogLevel.ERROR) {
                await this.appendToFile(this.logFiles.error, logEntry);
            }

            // 在开发环境下输出到控制台
            if (process.env.NODE_ENV === 'development') {
                this.consoleLog(level, logEntry);
            }

        } catch (error) {
            console.error('写入日志失败:', error);
        }
    }

    /**
     * 创建日志条目
     */
    createLogEntry(level, type, message, metadata, req) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            type,
            message,
            metadata,
            environment: process.env.NODE_ENV || 'development',
            pid: process.pid,
            hostname: require('os').hostname()
        };

        // 添加请求信息
        if (req) {
            entry.request = {
                method: req.method,
                url: req.url,
                headers: this.sanitizeHeaders(req.headers),
                params: req.params,
                query: req.query,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            };

            // 添加用户信息
            if (req.user) {
                entry.user = {
                    userId: req.user.userId,
                    userType: req.user.userType,
                    name: req.user.name
                };
            }
        }

        return entry;
    }

    /**
     * 追加到文件
     */
    async appendToFile(filePath, logEntry) {
        const logLine = JSON.stringify(logEntry) + '\n';
        
        try {
            // 检查文件大小，如果超过限制则轮转
            await this.rotateLogIfNeeded(filePath);
            
            await fs.appendFile(filePath, logLine, 'utf8');
        } catch (error) {
            console.error(`写入日志文件失败 ${filePath}:`, error);
        }
    }

    /**
     * 日志轮转
     */
    async rotateLogIfNeeded(filePath) {
        try {
            const stats = await fs.stat(filePath);
            
            if (stats.size > this.maxLogSize) {
                await this.rotateLog(filePath);
            }
        } catch (error) {
            // 文件不存在，忽略错误
            if (error.code !== 'ENOENT') {
                console.error('检查日志文件大小失败:', error);
            }
        }
    }

    /**
     * 执行日志轮转
     */
    async rotateLog(filePath) {
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const basename = path.basename(filePath, ext);
        
        try {
            // 删除最旧的日志文件
            const oldestFile = path.join(dir, `${basename}.${this.maxLogFiles}${ext}`);
            try {
                await fs.unlink(oldestFile);
            } catch (error) {
                // 文件不存在，忽略错误
            }

            // 重命名现有的日志文件
            for (let i = this.maxLogFiles - 1; i >= 1; i--) {
                const oldFile = path.join(dir, `${basename}.${i}${ext}`);
                const newFile = path.join(dir, `${basename}.${i + 1}${ext}`);
                
                try {
                    await fs.rename(oldFile, newFile);
                } catch (error) {
                    // 文件不存在，忽略错误
                }
            }

            // 重命名当前日志文件
            const rotatedFile = path.join(dir, `${basename}.1${ext}`);
            await fs.rename(filePath, rotatedFile);

        } catch (error) {
            console.error('日志轮转失败:', error);
        }
    }

    /**
     * 控制台输出
     */
    consoleLog(level, logEntry) {
        const colorMap = {
            [LogLevel.ERROR]: '\x1b[31m',   // 红色
            [LogLevel.WARN]: '\x1b[33m',    // 黄色
            [LogLevel.INFO]: '\x1b[36m',    // 青色
            [LogLevel.DEBUG]: '\x1b[37m'    // 白色
        };

        const resetColor = '\x1b[0m';
        const color = colorMap[level] || resetColor;
        
        console.log(
            `${color}[${logEntry.timestamp}] ${level} [${logEntry.type}] ${logEntry.message}${resetColor}`,
            logEntry.metadata && Object.keys(logEntry.metadata).length > 0 ? logEntry.metadata : ''
        );
    }

    /**
     * 清理敏感头信息
     */
    sanitizeHeaders(headers) {
        if (!headers) return {};
        
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        
        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    /**
     * 系统日志
     */
    async system(level, message, metadata = {}, req = null) {
        await this.writeLog(level, LogType.SYSTEM, message, metadata, req);
    }

    /**
     * 操作日志
     */
    async operation(level, message, metadata = {}, req = null) {
        await this.writeLog(level, LogType.OPERATION, message, metadata, req);
    }

    /**
     * 安全日志
     */
    async security(level, message, metadata = {}, req = null) {
        await this.writeLog(level, LogType.SECURITY, message, metadata, req);
    }

    /**
     * 性能日志
     */
    async performance(level, message, metadata = {}, req = null) {
        await this.writeLog(level, LogType.PERFORMANCE, message, metadata, req);
    }

    /**
     * 业务日志
     */
    async business(level, message, metadata = {}, req = null) {
        await this.writeLog(level, LogType.BUSINESS, message, metadata, req);
    }

    /**
     * 错误日志
     */
    async error(message, error = null, metadata = {}, req = null) {
        const errorMetadata = {
            ...metadata,
            ...(error && {
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
                errorCode: error.code
            })
        };

        await this.writeLog(LogLevel.ERROR, LogType.SYSTEM, message, errorMetadata, req);
    }

    /**
     * 警告日志
     */
    async warn(message, metadata = {}, req = null) {
        await this.writeLog(LogLevel.WARN, LogType.SYSTEM, message, metadata, req);
    }

    /**
     * 信息日志
     */
    async info(message, metadata = {}, req = null) {
        await this.writeLog(LogLevel.INFO, LogType.SYSTEM, message, metadata, req);
    }

    /**
     * 调试日志
     */
    async debug(message, metadata = {}, req = null) {
        await this.writeLog(LogLevel.DEBUG, LogType.SYSTEM, message, metadata, req);
    }

    /**
     * 记录用户登录
     */
    async logUserLogin(user, req, success = true) {
        const message = success ? '用户登录成功' : '用户登录失败';
        const metadata = {
            userId: user.userId || user.id,
            userType: user.userType,
            success,
            loginTime: new Date().toISOString()
        };

        await this.security(success ? LogLevel.INFO : LogLevel.WARN, message, metadata, req);
    }

    /**
     * 记录积分操作
     */
    async logPointsOperation(operation, studentId, points, reason, operatorId, req) {
        const message = `积分${operation}操作`;
        const metadata = {
            operation,
            studentId,
            points,
            reason,
            operatorId,
            timestamp: new Date().toISOString()
        };

        await this.business(LogLevel.INFO, message, metadata, req);
    }

    /**
     * 记录商品操作
     */
    async logProductOperation(operation, productId, productData, operatorId, req) {
        const message = `商品${operation}操作`;
        const metadata = {
            operation,
            productId,
            productData,
            operatorId,
            timestamp: new Date().toISOString()
        };

        await this.business(LogLevel.INFO, message, metadata, req);
    }

    /**
     * 记录订单操作
     */
    async logOrderOperation(operation, orderId, orderData, userId, req) {
        const message = `订单${operation}操作`;
        const metadata = {
            operation,
            orderId,
            orderData,
            userId,
            timestamp: new Date().toISOString()
        };

        await this.business(LogLevel.INFO, message, metadata, req);
    }

    /**
     * 记录性能指标
     */
    async logPerformance(operation, duration, metadata = {}, req = null) {
        const message = `性能监控: ${operation}`;
        const performanceMetadata = {
            ...metadata,
            operation,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            slow: duration > 1000 // 标记慢操作
        };

        const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO;
        await this.performance(level, message, performanceMetadata, req);
    }

    /**
     * 记录API请求性能
     */
    async logApiPerformance(req, res, duration) {
        const metadata = {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            slow: duration > 1000,
            error: res.statusCode >= 400
        };

        if (req.user) {
            metadata.userId = req.user.userId;
            metadata.userType = req.user.userType;
        }

        const level = res.statusCode >= 500 ? LogLevel.ERROR :
                     res.statusCode >= 400 ? LogLevel.WARN :
                     duration > 5000 ? LogLevel.WARN : LogLevel.INFO;

        await this.performance(level, 'API请求性能', metadata, req);
    }

    /**
     * 记录系统配置变更
     */
    async logConfigChange(configKey, oldValue, newValue, operatorId, req) {
        const message = '系统配置变更';
        const metadata = {
            configKey,
            oldValue,
            newValue,
            operatorId,
            timestamp: new Date().toISOString()
        };

        await this.system(LogLevel.INFO, message, metadata, req);
    }

    /**
     * 获取日志统计信息
     */
    async getLogStatistics(hours = 24, logType = null) {
        try {
            const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
            const logFile = logType ? this.logFiles[logType] : this.logFiles.combined;
            
            if (!logFile) {
                throw createError('VALIDATION_ERROR', '无效的日志类型');
            }

            const logContent = await fs.readFile(logFile, 'utf8');
            const lines = logContent.trim().split('\n').filter(line => line);
            
            const recentLogs = lines
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(entry => entry && new Date(entry.timestamp) > cutoffTime);

            const statistics = {
                totalLogs: recentLogs.length,
                logsByLevel: {},
                logsByType: {},
                logsByHour: {},
                topMessages: [],
                errorRate: 0
            };

            recentLogs.forEach(log => {
                // 按级别统计
                statistics.logsByLevel[log.level] = (statistics.logsByLevel[log.level] || 0) + 1;
                
                // 按类型统计
                statistics.logsByType[log.type] = (statistics.logsByType[log.type] || 0) + 1;
                
                // 按小时统计
                const hour = new Date(log.timestamp).getHours();
                statistics.logsByHour[hour] = (statistics.logsByHour[hour] || 0) + 1;
            });

            // 计算错误率
            const errorCount = statistics.logsByLevel[LogLevel.ERROR] || 0;
            statistics.errorRate = statistics.totalLogs > 0 ? errorCount / statistics.totalLogs : 0;

            // 获取最常见的消息
            const messageCount = {};
            recentLogs.forEach(log => {
                messageCount[log.message] = (messageCount[log.message] || 0) + 1;
            });

            statistics.topMessages = Object.entries(messageCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .map(([message, count]) => ({ message, count }));

            return statistics;

        } catch (error) {
            console.error('获取日志统计失败:', error);
            return null;
        }
    }

    /**
     * 清理旧日志
     */
    async cleanupOldLogs(daysToKeep = 30) {
        const cutoffTime = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        
        try {
            const files = await fs.readdir(this.logDir);
            
            for (const file of files) {
                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < cutoffTime) {
                    await fs.unlink(filePath);
                    console.log(`删除旧日志文件: ${file}`);
                }
            }
        } catch (error) {
            console.error('清理旧日志失败:', error);
        }
    }

    /**
     * 导出日志
     */
    async exportLogs(startDate, endDate, logType = null, format = 'json') {
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw createError('VALIDATION_ERROR', '日期格式无效');
            }

            const logFile = logType ? this.logFiles[logType] : this.logFiles.combined;
            if (!logFile) {
                throw createError('VALIDATION_ERROR', '无效的日志类型');
            }

            const logContent = await fs.readFile(logFile, 'utf8');
            const lines = logContent.trim().split('\n').filter(line => line);
            
            const filteredLogs = lines
                .map(line => {
                    try {
                        return JSON.parse(line);
                    } catch {
                        return null;
                    }
                })
                .filter(entry => {
                    if (!entry) return false;
                    const logTime = new Date(entry.timestamp);
                    return logTime >= start && logTime <= end;
                });

            if (format === 'csv') {
                return this.convertLogsToCSV(filteredLogs);
            }

            return filteredLogs;

        } catch (error) {
            console.error('导出日志失败:', error);
            throw error;
        }
    }

    /**
     * 转换日志为CSV格式
     */
    convertLogsToCSV(logs) {
        if (logs.length === 0) return '';

        const headers = ['timestamp', 'level', 'type', 'message', 'userId', 'userType', 'method', 'url', 'ip'];
        const csvLines = [headers.join(',')];

        logs.forEach(log => {
            const row = [
                log.timestamp,
                log.level,
                log.type,
                `"${log.message.replace(/"/g, '""')}"`,
                log.user?.userId || '',
                log.user?.userType || '',
                log.request?.method || '',
                log.request?.url || '',
                log.request?.ip || ''
            ];
            csvLines.push(row.join(','));
        });

        return csvLines.join('\n');
    }
}

// 创建全局日志服务实例
const loggingService = new LoggingService();

// 定期清理旧日志（每天执行一次）- 只在非测试环境启动
if (process.env.NODE_ENV !== 'test') {
    setInterval(() => {
        loggingService.cleanupOldLogs().catch(console.error);
    }, 24 * 60 * 60 * 1000);
}

module.exports = {
    LoggingService,
    LogLevel,
    LogType,
    loggingService
};