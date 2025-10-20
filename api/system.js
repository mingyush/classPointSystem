/**
 * 系统管理API - V1单班级版本
 * 
 * 功能：
 * - 系统状态管理（平时模式/上课模式切换）
 * - 存储适配器管理
 * - 系统配置管理
 * - 数据迁移和备份
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');
const { DisplayManagerV1 } = require('../services/displayManager');
const sseService = require('../services/sseService');

const router = express.Router();

// 创建显示管理器实例
const displayManager = new DisplayManagerV1();

// ==================== 系统状态管理 ====================

/**
 * 获取系统状态
 */
router.get('/state', asyncHandler(async (req, res) => {
    const state = await displayManager.getCurrentState();

    res.json({
        success: true,
        data: state,
        message: '获取系统状态成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 切换到上课模式
 */
router.post('/state/class-mode', asyncHandler(async (req, res) => {
    const { teacherId } = req.body;

    if (!teacherId || typeof teacherId !== 'string') {
        throw createError('VALIDATION_ERROR', '教师ID不能为空');
    }

    const success = await displayManager.switchToClassMode(teacherId.trim());

    if (!success) {
        throw createError('OPERATION_FAILED', '切换到上课模式失败');
    }

    // 广播模式变更事件
    sseService.broadcastModeChange('class');

    res.json({
        success: true,
        message: '已切换到上课模式',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 切换到平时模式
 */
router.post('/state/normal-mode', asyncHandler(async (req, res) => {
    const success = await displayManager.switchToNormalMode();

    if (!success) {
        throw createError('OPERATION_FAILED', '切换到平时模式失败');
    }

    // 广播模式变更事件
    sseService.broadcastModeChange('normal');

    res.json({
        success: true,
        message: '已切换到平时模式',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 重置自动切换定时器
 */
router.post('/state/reset-timer', asyncHandler(async (req, res) => {
    displayManager.resetAutoSwitchTimer();

    res.json({
        success: true,
        message: '自动切换定时器已重置',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 存储适配器管理 ====================

/**
 * 获取支持的存储类型
 */
router.get('/storage/types', asyncHandler(async (req, res) => {
    const types = storageAdapterFactory.getSupportedTypes();

    res.json({
        success: true,
        data: types,
        message: '获取存储类型成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 测试存储连接
 */
router.post('/storage/test', asyncHandler(async (req, res) => {
    const { type, config } = req.body;

    if (!type) {
        throw createError('VALIDATION_ERROR', '存储类型不能为空');
    }

    const result = await storageAdapterFactory.testConnection(type, config);

    res.json({
        success: result.success,
        data: result,
        message: result.success ? '连接测试成功' : '连接测试失败',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 获取适配器统计信息
 */
router.get('/storage/stats', asyncHandler(async (req, res) => {
    const stats = storageAdapterFactory.getAdapterStats();
    const healthCheck = await storageAdapterFactory.healthCheckAll();

    res.json({
        success: true,
        data: {
            stats,
            healthCheck
        },
        message: '获取适配器统计成功',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 数据迁移 ====================

/**
 * 数据迁移（单班级）
 */
router.post('/migrate', asyncHandler(async (req, res) => {
    const { sourceType, targetType, sourceConfig, targetConfig } = req.body;

    if (!sourceType || !targetType) {
        throw createError('VALIDATION_ERROR', '源类型和目标类型不能为空');
    }

    const result = await storageAdapterFactory.migrateData(
        sourceType,
        targetType,
        'default', // 单班级固定使用default
        sourceConfig,
        targetConfig
    );

    res.json({
        success: true,
        data: result,
        message: '数据迁移成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 导出班级数据
 */
router.post('/export', asyncHandler(async (req, res) => {
    const { storageType, config } = req.body;

    const adapter = await storageAdapterFactory.getAdapter(storageType, config);
    const exportData = await adapter.exportClassData('default');

    res.json({
        success: true,
        data: exportData,
        message: '数据导出成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 导入班级数据
 */
router.post('/import', asyncHandler(async (req, res) => {
    const { importData, storageType, config } = req.body;

    if (!importData || typeof importData !== 'object') {
        throw createError('VALIDATION_ERROR', '导入数据不能为空');
    }

    const adapter = await storageAdapterFactory.getAdapter(storageType, config);
    await adapter.importClassData('default', importData);

    res.json({
        success: true,
        message: '数据导入成功',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 系统配置 ====================

/**
 * 获取系统配置
 */
router.get('/config', asyncHandler(async (req, res) => {
    const config = {
        storageType: process.env.STORAGE_TYPE || 'json',
        nodeEnv: process.env.NODE_ENV || 'development',
        version: require('../package.json').version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version
    };

    res.json({
        success: true,
        data: config,
        message: '获取系统配置成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 更新系统配置
 */
router.put('/config', asyncHandler(async (req, res) => {
    const { storageType } = req.body;

    if (storageType) {
        process.env.STORAGE_TYPE = storageType;
        // 清除适配器缓存以使用新配置
        storageAdapterFactory.clearCache();
    }

    res.json({
        success: true,
        message: '系统配置更新成功',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 系统监控 ====================

/**
 * 系统健康检查
 */
router.get('/health', asyncHandler(async (req, res) => {
    const { errorMonitor } = require('../middleware/errorHandler');
    const health = await errorMonitor.getSystemHealth();
    const storageHealth = await storageAdapterFactory.healthCheckAll();

    const overallStatus = health.status === 'HEALTHY' &&
        Object.values(storageHealth).every(h => h.status === 'healthy')
        ? 'HEALTHY' : 'UNHEALTHY';

    res.status(overallStatus === 'HEALTHY' ? 200 : 503).json({
        success: overallStatus === 'HEALTHY',
        data: {
            system: health,
            storage: storageHealth,
            overallStatus
        },
        message: overallStatus === 'HEALTHY' ? '系统运行正常' : '系统存在问题',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 获取系统统计信息
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = {
        storageStats: storageAdapterFactory.getAdapterStats(),
        systemState: await displayManager.getCurrentState(),
        systemInfo: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            platform: process.platform,
            nodeVersion: process.version,
            pid: process.pid
        }
    };

    res.json({
        success: true,
        data: stats,
        message: '获取系统统计成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 清理系统缓存
 */
router.post('/cache/clear', asyncHandler(async (req, res) => {
    // 清除存储适配器缓存
    storageAdapterFactory.clearCache();

    res.json({
        success: true,
        message: '系统缓存清理成功',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 日志管理 ====================

/**
 * 获取错误统计
 */
router.get('/logs/errors', asyncHandler(async (req, res) => {
    const hours = parseInt(req.query.hours) || 24;
    const { errorLogger } = require('../middleware/errorHandler');
    const statistics = await errorLogger.getErrorStatistics(hours);

    res.json({
        success: true,
        data: statistics,
        message: '获取错误统计成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 获取报警历史
 */
router.get('/logs/alerts', asyncHandler(async (req, res) => {
    const hours = parseInt(req.query.hours) || 24;
    const { errorMonitor } = require('../middleware/errorHandler');
    const alerts = errorMonitor.getAlertHistory(hours);

    res.json({
        success: true,
        data: alerts,
        message: '获取报警历史成功',
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;