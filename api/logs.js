const express = require('express');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');
const { Validators, CustomValidators } = require('../middleware/validation');
const { loggingService, LogLevel, LogType } = require('../services/loggingService');
const router = express.Router();

/**
 * 获取日志统计信息
 * GET /api/logs/statistics?hours=24&type=SYSTEM
 * 需要教师权限
 */
router.get('/statistics',
    authenticateToken,
    requireTeacher,
    operationLogger('获取日志统计'),
    asyncHandler(async (req, res) => {
        const { hours = 24, type } = req.query;
        
        // 参数验证
        const hoursNum = parseInt(hours);
        if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) { // 最多7天
            throw createError('VALIDATION_ERROR', '时间范围必须为1-168小时之间');
        }

        if (type && !Object.values(LogType).includes(type)) {
            throw createError('VALIDATION_ERROR', `日志类型必须为: ${Object.values(LogType).join(', ')}`);
        }

        const statistics = await loggingService.getLogStatistics(hoursNum, type);
        
        if (!statistics) {
            throw createError('INTERNAL_ERROR', '获取日志统计失败');
        }

        res.json({
            success: true,
            message: '获取日志统计成功',
            data: {
                timeRange: `${hoursNum}小时`,
                logType: type || '全部',
                statistics
            }
        });
    })
);

/**
 * 导出日志
 * GET /api/logs/export?startDate=2024-01-01&endDate=2024-01-31&type=OPERATION&format=json
 * 需要教师权限
 */
router.get('/export',
    authenticateToken,
    requireTeacher,
    operationLogger('导出日志'),
    asyncHandler(async (req, res) => {
        const { startDate, endDate, type, format = 'json' } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            throw createError('VALIDATION_ERROR', '开始日期和结束日期不能为空');
        }

        // 验证日期范围
        const { start, end } = CustomValidators.validateDateRange(startDate, endDate);

        // 验证日志类型
        if (type && !Object.values(LogType).includes(type)) {
            throw createError('VALIDATION_ERROR', `日志类型必须为: ${Object.values(LogType).join(', ')}`);
        }

        // 验证导出格式
        if (!['json', 'csv'].includes(format)) {
            throw createError('VALIDATION_ERROR', '导出格式必须为json或csv');
        }

        const logs = await loggingService.exportLogs(startDate, endDate, type, format);

        // 设置响应头
        const filename = `logs_${startDate}_${endDate}${type ? `_${type}` : ''}.${format}`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.send(logs);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.json({
                success: true,
                message: '日志导出成功',
                data: {
                    startDate,
                    endDate,
                    logType: type || '全部',
                    format,
                    count: Array.isArray(logs) ? logs.length : 0,
                    logs
                }
            });
        }
    })
);

/**
 * 获取系统健康状态
 * GET /api/logs/health
 * 需要教师权限
 */
router.get('/health',
    authenticateToken,
    requireTeacher,
    operationLogger('获取系统健康状态'),
    asyncHandler(async (req, res) => {
        const { errorMonitor } = require('../middleware/errorHandler');
        const health = await errorMonitor.getSystemHealth();
        
        // 获取最近的日志统计
        const logStats = await loggingService.getLogStatistics(1); // 最近1小时
        
        const healthData = {
            ...health,
            logStatistics: logStats,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        };

        const statusCode = health.status === 'HEALTHY' ? 200 : 
                          health.status === 'WARNING' ? 200 : 503;

        res.status(statusCode).json({
            success: health.status === 'HEALTHY',
            message: health.message,
            data: healthData
        });
    })
);

/**
 * 清理旧日志
 * POST /api/logs/cleanup
 * 需要教师权限
 */
router.post('/cleanup',
    authenticateToken,
    requireTeacher,
    operationLogger('清理旧日志'),
    asyncHandler(async (req, res) => {
        const { daysToKeep = 30 } = req.body;

        // 参数验证
        const days = parseInt(daysToKeep);
        if (isNaN(days) || days < 1 || days > 365) {
            throw createError('VALIDATION_ERROR', '保留天数必须为1-365之间的数字');
        }

        await loggingService.cleanupOldLogs(days);

        // 记录清理操作
        await loggingService.system(
            LogLevel.INFO,
            '执行日志清理操作',
            { daysToKeep: days, operatorId: req.user.userId },
            req
        );

        res.json({
            success: true,
            message: `成功清理${days}天前的旧日志`,
            data: {
                daysToKeep: days,
                cleanupTime: new Date().toISOString()
            }
        });
    })
);

/**
 * 获取日志类型和级别定义
 * GET /api/logs/definitions
 * 需要教师权限
 */
router.get('/definitions',
    authenticateToken,
    requireTeacher,
    asyncHandler(async (req, res) => {
        res.json({
            success: true,
            message: '获取日志定义成功',
            data: {
                logLevels: Object.values(LogLevel),
                logTypes: Object.values(LogType),
                descriptions: {
                    logLevels: {
                        [LogLevel.ERROR]: '错误级别，表示系统发生错误',
                        [LogLevel.WARN]: '警告级别，表示潜在问题',
                        [LogLevel.INFO]: '信息级别，表示正常操作',
                        [LogLevel.DEBUG]: '调试级别，表示详细调试信息'
                    },
                    logTypes: {
                        [LogType.SYSTEM]: '系统日志，记录系统级别的操作和状态',
                        [LogType.OPERATION]: '操作日志，记录用户的操作行为',
                        [LogType.SECURITY]: '安全日志，记录登录、权限等安全相关操作',
                        [LogType.PERFORMANCE]: '性能日志，记录系统性能指标',
                        [LogType.BUSINESS]: '业务日志，记录业务逻辑相关的操作'
                    }
                }
            }
        });
    })
);

/**
 * 搜索日志
 * POST /api/logs/search
 * 需要教师权限
 */
router.post('/search',
    authenticateToken,
    requireTeacher,
    operationLogger('搜索日志'),
    asyncHandler(async (req, res) => {
        const { 
            startDate, 
            endDate, 
            level, 
            type, 
            keyword, 
            userId,
            limit = 100 
        } = req.body;

        // 参数验证
        if (!startDate || !endDate) {
            throw createError('VALIDATION_ERROR', '开始日期和结束日期不能为空');
        }

        const { start, end } = CustomValidators.validateDateRange(startDate, endDate);

        if (level && !Object.values(LogLevel).includes(level)) {
            throw createError('VALIDATION_ERROR', `日志级别必须为: ${Object.values(LogLevel).join(', ')}`);
        }

        if (type && !Object.values(LogType).includes(type)) {
            throw createError('VALIDATION_ERROR', `日志类型必须为: ${Object.values(LogType).join(', ')}`);
        }

        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
            throw createError('VALIDATION_ERROR', '限制数量必须为1-1000之间的数字');
        }

        // 导出所有日志然后过滤
        const allLogs = await loggingService.exportLogs(startDate, endDate, type);
        
        let filteredLogs = allLogs;

        // 按级别过滤
        if (level) {
            filteredLogs = filteredLogs.filter(log => log.level === level);
        }

        // 按关键词过滤
        if (keyword) {
            const keywordLower = keyword.toLowerCase();
            filteredLogs = filteredLogs.filter(log => 
                log.message.toLowerCase().includes(keywordLower) ||
                JSON.stringify(log.metadata).toLowerCase().includes(keywordLower)
            );
        }

        // 按用户ID过滤
        if (userId) {
            filteredLogs = filteredLogs.filter(log => 
                log.user && log.user.userId === userId
            );
        }

        // 限制结果数量
        const limitedLogs = filteredLogs.slice(0, limitNum);

        res.json({
            success: true,
            message: '日志搜索完成',
            data: {
                searchCriteria: {
                    startDate,
                    endDate,
                    level,
                    type,
                    keyword,
                    userId,
                    limit: limitNum
                },
                totalFound: filteredLogs.length,
                returned: limitedLogs.length,
                logs: limitedLogs
            }
        });
    })
);

/**
 * 获取错误趋势分析
 * GET /api/logs/error-trends?days=7
 * 需要教师权限
 */
router.get('/error-trends',
    authenticateToken,
    requireTeacher,
    operationLogger('获取错误趋势分析'),
    asyncHandler(async (req, res) => {
        const { days = 7 } = req.query;
        
        const daysNum = parseInt(days);
        if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
            throw createError('VALIDATION_ERROR', '天数必须为1-30之间的数字');
        }

        const trends = [];
        const now = new Date();

        // 获取每天的错误统计
        for (let i = daysNum - 1; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

            try {
                const dayLogs = await loggingService.exportLogs(
                    startOfDay.toISOString().split('T')[0],
                    endOfDay.toISOString().split('T')[0]
                );

                const errorLogs = dayLogs.filter(log => log.level === LogLevel.ERROR);
                const warnLogs = dayLogs.filter(log => log.level === LogLevel.WARN);

                trends.push({
                    date: startOfDay.toISOString().split('T')[0],
                    totalLogs: dayLogs.length,
                    errorCount: errorLogs.length,
                    warnCount: warnLogs.length,
                    errorRate: dayLogs.length > 0 ? errorLogs.length / dayLogs.length : 0
                });
            } catch (error) {
                // 如果某天没有日志文件，添加空数据
                trends.push({
                    date: startOfDay.toISOString().split('T')[0],
                    totalLogs: 0,
                    errorCount: 0,
                    warnCount: 0,
                    errorRate: 0
                });
            }
        }

        // 计算趋势指标
        const totalErrors = trends.reduce((sum, day) => sum + day.errorCount, 0);
        const avgErrorRate = trends.reduce((sum, day) => sum + day.errorRate, 0) / trends.length;
        const maxErrorDay = trends.reduce((max, day) => 
            day.errorCount > max.errorCount ? day : max, trends[0]);

        res.json({
            success: true,
            message: '获取错误趋势分析成功',
            data: {
                period: `${daysNum}天`,
                trends,
                summary: {
                    totalErrors,
                    averageErrorRate: avgErrorRate,
                    maxErrorDay: maxErrorDay.date,
                    maxErrorCount: maxErrorDay.errorCount
                }
            }
        });
    })
);

module.exports = router;