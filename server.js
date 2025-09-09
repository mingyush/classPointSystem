/**
 * 班级积分管理系统 - 主服务器文件
 * 
 * 功能概述:
 * - 提供Web服务器和API接口
 * - 支持三种界面：大屏展示、教师管理、学生查询
 * - 实现实时数据推送和性能监控
 * - 提供完整的错误处理和日志记录
 * 
 * 技术栈:
 * - Express.js: Web框架
 * - JSON文件: 数据存储
 * - SSE: 实时数据推送
 * - 自定义中间件: 错误处理和性能监控
 * 
 * @author 班级积分管理系统开发团队
 * @version 1.0.0
 * @since 2025-09-09
 */

const express = require('express');
const path = require('path');
const DataInitializer = require('./utils/dataInitializer');
const { errorHandler, notFoundHandler, errorLogger, performanceMonitor } = require('./middleware/errorHandler');

// 创建Express应用实例
const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 数据初始化 ====================
/**
 * 初始化系统数据文件
 * 确保所有必要的JSON数据文件存在并包含默认数据
 */
const dataInitializer = new DataInitializer();
dataInitializer.initializeAllData().catch(console.error);

// ==================== 中间件配置 ====================
/**
 * 配置请求体解析中间件
 * - 支持JSON格式数据，最大10MB
 * - 支持URL编码数据，最大10MB
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * 性能监控中间件
 * 监控API响应时间、内存使用等性能指标
 */
app.use(performanceMonitor());

/**
 * 请求日志中间件
 * 记录所有HTTP请求的详细信息，包括：
 * - 请求方法和URL
 * - 响应状态码和处理时间
 * - 客户端IP和User-Agent
 * 
 * 优化策略：
 * - 只记录错误请求和非GET请求，减少日志量
 * - 使用异步日志记录，避免阻塞请求处理
 */
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logEntry = {
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };
        
        // 只记录错误请求和重要操作，减少日志噪音
        if (res.statusCode >= 400 || req.method !== 'GET') {
            console.log('请求日志:', JSON.stringify(logEntry));
        }
    });
    
    next();
});

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// SSE服务初始化
const sseService = require('./services/sseService');
const { router: sseRouter, broadcastSSEMessage } = require('./api/sse');

// 设置SSE服务的广播函数
sseService.setBroadcastFunction(broadcastSSEMessage);

// API路由
app.use('/api/auth', require('./api/auth'));
app.use('/api/points', require('./api/points'));
app.use('/api/students', require('./api/students'));
app.use('/api/products', require('./api/products'));
app.use('/api/orders', require('./api/orders'));
app.use('/api/config', require('./api/config'));
app.use('/api/backup', require('./api/backup'));
app.use('/api/logs', require('./api/logs'));
app.use('/api/sse', sseRouter);

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 大屏展示路由
app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display', 'index.html'));
});

// 教师管理路由
app.get('/teacher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher', 'index.html'));
});

// 学生查询路由
app.get('/student', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student', 'index.html'));
});

// 健康检查接口
app.get('/api/health', async (req, res) => {
    try {
        const { errorMonitor } = require('./middleware/errorHandler');
        const health = await errorMonitor.getSystemHealth();
        
        res.status(health.status === 'HEALTHY' ? 200 : 503).json({
            success: health.status === 'HEALTHY',
            status: health.status,
            message: health.message,
            timestamp: new Date().toISOString(),
            ...(health.statistics && { statistics: health.statistics })
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            status: 'ERROR',
            message: '健康检查失败',
            timestamp: new Date().toISOString()
        });
    }
});

// 错误统计接口（仅开发环境）
if (process.env.NODE_ENV === 'development') {
    app.get('/api/debug/errors', async (req, res) => {
        try {
            const hours = parseInt(req.query.hours) || 24;
            const statistics = await errorLogger.getErrorStatistics(hours);
            
            res.json({
                success: true,
                data: statistics,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '获取错误统计失败',
                timestamp: new Date().toISOString()
            });
        }
    });
}

// 404处理中间件
app.use(notFoundHandler);

// 统一错误处理中间件（必须放在最后）
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
    console.log(`班级积分管理系统已启动`);
    console.log(`服务器运行在: http://localhost:${PORT}`);
    console.log(`大屏展示: http://localhost:${PORT}/display`);
    console.log(`教师管理: http://localhost:${PORT}/teacher`);
    console.log(`学生查询: http://localhost:${PORT}/student`);
});

module.exports = app;