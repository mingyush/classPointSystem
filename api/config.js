const express = require('express');
const DataAccess = require('../utils/dataAccess');
const sseService = require('../services/sseService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');
const SystemService = require('../services/systemService');
const router = express.Router();

const dataAccess = new DataAccess();

// 默认配置
const DEFAULT_CONFIG = {
    mode: 'normal', // 'normal' 或 'class'
    autoRefreshInterval: 30,
    pointsResetEnabled: false,
    maxPointsPerOperation: 100,
    semesterStartDate: new Date().toISOString(),
    className: '花儿起舞',
    author: '茗雨',
    copyright: '© 2025 花儿起舞班级积分管理系统 | 作者：茗雨'
};

/**
 * 读取配置
 */
async function readConfig() {
    try {
        await dataAccess.ensureDirectories();
        const config = await dataAccess.getAllConfig();
        return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
        console.error('读取配置失败:', error);
        return DEFAULT_CONFIG;
    }
}

/**
 * 写入配置
 */
async function writeConfig(config) {
    await dataAccess.ensureDirectories();
    const configData = { ...DEFAULT_CONFIG, ...config };

    // 保存每个配置项
    for (const [key, value] of Object.entries(configData)) {
        await dataAccess.setConfig(key, value);
    }

    return configData;
}

/**
 * 获取系统模式
 * GET /api/config/mode
 */
router.get('/mode', asyncHandler(async (req, res) => {
    const config = await readConfig();
    res.json({
        success: true,
        message: '获取系统模式成功',
        data: {
            mode: config.mode,
            modeText: config.mode === 'class' ? '上课模式' : '平时模式'
        }
    });
}));

/**
 * 设置系统模式
 * POST /api/config/mode
 * 切换到上课模式需要教师权限，切换到平时模式无需权限
 */
router.post('/mode', asyncHandler(async (req, res) => {
    const { mode } = req.body;

    // 参数验证
    if (!mode || !['normal', 'class'].includes(mode)) {
        throw createError('VALIDATION_ERROR', '无效的系统模式，支持: normal, class');
    }

    // 如果要切换到上课模式，需要验证教师权限
    if (mode === 'class') {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            throw createError('TOKEN_MISSING', '切换到上课模式需要教师权限');
        }

        try {
            const jwt = require('jsonwebtoken');
            const JWT_SECRET = process.env.JWT_SECRET || 'classroom-points-system-secret-key';
            const user = jwt.verify(token, JWT_SECRET);

            if (!user || user.userType !== 'teacher') {
                throw createError('TEACHER_REQUIRED', '切换到上课模式需要教师权限');
            }
        } catch (error) {
            if (error.isOperational) throw error;
            throw createError('TOKEN_INVALID', '教师登录已过期，请重新登录');
        }
    }

    // 更新模式
    await dataAccess.setConfig('mode', mode);
    const updatedConfig = await readConfig();

    // 广播模式变更事件
    sseService.broadcastModeChange(mode);

    res.json({
        success: true,
        message: '系统模式设置成功',
        data: {
            mode: updatedConfig.mode,
            modeText: updatedConfig.mode === 'class' ? '上课模式' : '平时模式'
        }
    });
}));

/**
 * 获取完整系统配置
 * GET /api/config
 * 需要教师权限
 */
router.get('/', authenticateToken, requireTeacher, asyncHandler(async (req, res) => {
    const config = await readConfig();
    res.json({
        success: true,
        message: '获取系统配置成功',
        data: config
    });
}));

/**
 * 更新系统配置
 * PUT /api/config
 * 需要教师权限
 */
router.put('/', authenticateToken, requireTeacher,
    operationLogger('更新系统配置'),
    asyncHandler(async (req, res) => {
        const updates = req.body;

        // 参数验证
        if (updates.mode && !['normal', 'class'].includes(updates.mode)) {
            throw createError('VALIDATION_ERROR', '无效的系统模式');
        }

        if (updates.autoRefreshInterval && (updates.autoRefreshInterval < 5 || updates.autoRefreshInterval > 300)) {
            throw createError('VALIDATION_ERROR', '自动刷新间隔必须在5-300秒之间');
        }

        if (updates.maxPointsPerOperation && (updates.maxPointsPerOperation < 1 || updates.maxPointsPerOperation > 1000)) {
            throw createError('VALIDATION_ERROR', '单次操作最大积分必须在1-1000之间');
        }

        if (updates.className && (typeof updates.className !== 'string' || updates.className.trim().length === 0)) {
            throw createError('VALIDATION_ERROR', '班级名称不能为空');
        }

        if (updates.author && (typeof updates.author !== 'string' || updates.author.trim().length === 0)) {
            throw createError('VALIDATION_ERROR', '作者名称不能为空');
        }

        if (updates.copyright && (typeof updates.copyright !== 'string' || updates.copyright.trim().length === 0)) {
            throw createError('VALIDATION_ERROR', '版权信息不能为空');
        }

        // 读取当前配置
        const currentConfig = await readConfig();

        // 合并更新
        const updatedConfig = await writeConfig({
            ...currentConfig,
            ...updates
        });

        // 广播配置更新事件
        sseService.broadcastConfigUpdate(updatedConfig);

        // 如果模式发生变化，单独广播模式变更事件
        if (updates.mode && updates.mode !== currentConfig.mode) {
            sseService.broadcastModeChange(updates.mode);
        }

        res.json({
            success: true,
            message: '系统配置更新成功',
            data: updatedConfig
        });
    })
);

/**
 * 重置积分
 * POST /api/config/reset-points
 * 需要教师权限
 */
router.post('/reset-points', authenticateToken, requireTeacher,
    operationLogger('重置积分'),
    asyncHandler(async (req, res) => {
        // 检查积分重置功能是否启用
        const config = await readConfig();
        if (!config.pointsResetEnabled) {
            throw createError('PERMISSION_DENIED', '积分重置功能未启用');
        }

        // 调用积分服务的重置方法
        const PointsService = require('../services/pointsService');
        const pointsService = new PointsService();

        await pointsService.resetAllPoints(req.user.userId, '管理员手动重置积分');

        // 广播数据重置事件
        sseService.broadcastDataReset('points');

        res.json({
            success: true,
            message: '积分重置成功',
            data: {
                resetTime: new Date().toISOString(),
                resetBy: req.user.userId
            }
        });
    })
);

/**
 * 启用/禁用积分重置功能
 * POST /api/config/reset-points/toggle
 * 需要教师权限
 */
router.post('/reset-points/toggle', authenticateToken, requireTeacher,
    operationLogger('切换积分重置功能'),
    asyncHandler(async (req, res) => {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            throw createError('VALIDATION_ERROR', '参数错误，enabled必须为布尔值');
        }

        // 更新配置
        await dataAccess.setConfig('pointsResetEnabled', enabled);
        const updatedConfig = await readConfig();

        // 广播配置更新事件
        sseService.broadcastConfigUpdate(updatedConfig);

        res.json({
            success: true,
            message: `积分重置功能已${enabled ? '启用' : '禁用'}`,
            data: {
                pointsResetEnabled: updatedConfig.pointsResetEnabled
            }
        });
    })
);

/**
 * 修复数据一致性
 * POST /api/config/fix-data
 * 需要教师权限 (admin/director)
 */
router.post('/fix-data', authenticateToken, requireTeacher,
    operationLogger('修复数据一致性'),
    asyncHandler(async (req, res) => {
        try {
            // 【修复】3. 复用模块全局的 dataAccess 实例进行数据连接，而不新开隐含 SQLite 连接
            const systemService = new SystemService(dataAccess);

            const results = await systemService.repairDataConsistency();

            res.json({
                success: true,
                message: '数据一致性修复完成',
                data: results
            });
        } catch (error) {
            console.error('[FixData API] Error:', error);
            res.status(500).json({
                success: false,
                message: '数据一致性修复失败: ' + error.message,
                stack: error.stack
            });
        }
    })
);

module.exports = router;
