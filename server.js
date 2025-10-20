/**
 * 班级积分管理系统  - 主服务器文件
 * 
 * 功能概述:
 * - 提供Web服务器和API接口
 * - 支持两种界面：教室大屏(/display)、班级管理后台(/admin)
 * - 实现实时数据推送和性能监控
 * - 提供完整的错误处理和日志记录
 * - 单班级部署，简化架构
 * 
 * 技术栈:
 * - Express.js: Web框架
 * - SQLite/D1: 数据存储
 * - SSE: 实时数据推送
 * - 自定义中间件: 错误处理和性能监控
 * 
 * @author 班级积分管理系统开发团队
 * @version 1.0.0
 * @since 2025-09-10
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { errorHandler, notFoundHandler, errorLogger, performanceMonitor } = require('./middleware/errorHandler');
const { storageAdapterFactory } = require('./adapters/storageAdapterFactory');
const DatabaseInitializer = require('./utils/databaseInitializer');

// 加载配置
let config;
try {
    const configPath = path.join(__dirname, 'config', 'config.json');
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
    console.warn('无法加载配置文件，使用默认配置:', error.message);
    config = {
        deployment: 'local',
        database: { type: 'sqlite', path: './data/classroom_points.db' },
        server: { port: 3000, host: '0.0.0.0' }
    };
}

// 设置环境变量
process.env.DB_TYPE = config.database.type;
process.env.DB_PATH = config.database.path;

// 创建Express应用实例
const app = express();
const PORT = process.env.PORT || config.server.port;

// ==================== 数据库初始化 ====================
/**
 * 初始化数据库
 * 根据配置选择SQLite或D1数据库适配器
 */
const dbInitializer = new DatabaseInitializer();
dbInitializer.initializeDatabase().catch(console.error);

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

// ==================== API路由配置 ====================
/**
 * 单班级API路由
 * 移除多班级隔离，简化为单班级部署
 */

// SSE服务初始化
const sseService = require('./services/sseService');
const { router: sseRouter, broadcastSSEMessage } = require('./api/sse');

// 设置SSE服务的广播函数
sseService.setBroadcastFunction(broadcastSSEMessage);

// 单班级API路由
app.use('/api/auth', require('./api/auth'));
app.use('/api/points', require('./api/points'));
app.use('/api/students', require('./api/students'));
app.use('/api/products', require('./api/products'));
app.use('/api/orders', require('./api/orders'));
app.use('/api/reward-penalty', require('./api/reward-penalty'));
app.use('/api/config', require('./api/config'));
app.use('/api/backup', require('./api/backup'));
app.use('/api/display', require('./api/display'));
app.use('/api/logs', require('./api/logs'));
app.use('/api/sse', sseRouter);
app.use('/api/system', require('./api/system'));

// ==================== 前端路由配置 ====================
/**
 * 单班级前端路由
 * 简化为两个主要入口：教室大屏和班级管理后台
 */

// 主页路由 - 显示首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 教室大屏路由
app.get('/display', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'display', 'index.html'));
});

// 班级管理后台路由
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher', 'index.html'));
});

// 兼容旧版路由
app.get('/teacher', (req, res) => {
    res.redirect('/admin');
});

app.get('/student', (req, res) => {
    res.redirect('/display');
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
    console.log(`班级积分管理系统  已启动`);
    console.log(`服务器运行在: http://localhost:${PORT}`);
    console.log(`教室大屏: http://localhost:${PORT}/display`);
    console.log(`班级管理后台: http://localhost:${PORT}/admin`);
    console.log(`数据库类型: ${process.env.DB_TYPE || 'sqlite'}`);
});

module.exports = app;