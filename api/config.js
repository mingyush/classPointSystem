const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const sseService = require('../services/sseService');
const { authenticateToken, requireTeacher } = require('./auth');
const router = express.Router();

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, '../data/config.json');

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
 * 读取配置文件
 */
async function readConfig() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
        if (error.code === 'ENOENT') {
            // 文件不存在，创建默认配置
            await writeConfig(DEFAULT_CONFIG);
            return DEFAULT_CONFIG;
        }
        throw error;
    }
}

/**
 * 写入配置文件
 */
async function writeConfig(config) {
    const configData = { ...DEFAULT_CONFIG, ...config };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(configData, null, 2), 'utf8');
    return configData;
}

/**
 * 获取系统模式
 * GET /api/config/mode
 */
router.get('/mode', async (req, res) => {
    try {
        const config = await readConfig();
        res.json({
            success: true,
            message: '获取系统模式成功',
            data: {
                mode: config.mode,
                modeText: config.mode === 'class' ? '上课模式' : '平时模式'
            }
        });
    } catch (error) {
        console.error('获取系统模式失败:', error);
        res.status(500).json({
            success: false,
            message: '获取系统模式失败',
            code: 'CONFIG_READ_ERROR'
        });
    }
});

/**
 * 设置系统模式
 * POST /api/config/mode
 * 切换到上课模式需要教师权限，切换到平时模式无需权限
 */
router.post('/mode', async (req, res) => {
    try {
        const { mode } = req.body;

        // 参数验证
        if (!mode || !['normal', 'class'].includes(mode)) {
            return res.status(400).json({
                success: false,
                message: '无效的系统模式，支持: normal, class',
                code: 'INVALID_MODE'
            });
        }

        // 如果要切换到上课模式，需要验证教师权限
        if (mode === 'class') {
            // 验证token和教师权限
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({
                    success: false,
                    message: '切换到上课模式需要教师权限',
                    code: 'TEACHER_REQUIRED'
                });
            }

            try {
                const jwt = require('jsonwebtoken');
                const JWT_SECRET = process.env.JWT_SECRET || 'classroom-points-system-secret-key';
                const user = jwt.verify(token, JWT_SECRET);
                
                if (!user || user.userType !== 'teacher') {
                    return res.status(403).json({
                        success: false,
                        message: '切换到上课模式需要教师权限',
                        code: 'TEACHER_REQUIRED'
                    });
                }
            } catch (error) {
                return res.status(403).json({
                    success: false,
                    message: '教师登录已过期，请重新登录',
                    code: 'TOKEN_INVALID'
                });
            }
        }

        // 读取当前配置
        const currentConfig = await readConfig();
        
        // 更新模式
        const updatedConfig = await writeConfig({
            ...currentConfig,
            mode: mode
        });

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

    } catch (error) {
        console.error('设置系统模式失败:', error);
        res.status(500).json({
            success: false,
            message: '设置系统模式失败',
            code: 'CONFIG_WRITE_ERROR'
        });
    }
});

/**
 * 获取完整系统配置
 * GET /api/config
 * 需要教师权限
 */
router.get('/', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const config = await readConfig();
        res.json({
            success: true,
            message: '获取系统配置成功',
            data: config
        });
    } catch (error) {
        console.error('获取系统配置失败:', error);
        res.status(500).json({
            success: false,
            message: '获取系统配置失败',
            code: 'CONFIG_READ_ERROR'
        });
    }
});

/**
 * 更新系统配置
 * PUT /api/config
 * 需要教师权限
 */
router.put('/', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const updates = req.body;

        // 参数验证
        if (updates.mode && !['normal', 'class'].includes(updates.mode)) {
            return res.status(400).json({
                success: false,
                message: '无效的系统模式',
                code: 'INVALID_MODE'
            });
        }

        if (updates.autoRefreshInterval && (updates.autoRefreshInterval < 5 || updates.autoRefreshInterval > 300)) {
            return res.status(400).json({
                success: false,
                message: '自动刷新间隔必须在5-300秒之间',
                code: 'INVALID_REFRESH_INTERVAL'
            });
        }

        if (updates.maxPointsPerOperation && (updates.maxPointsPerOperation < 1 || updates.maxPointsPerOperation > 1000)) {
            return res.status(400).json({
                success: false,
                message: '单次操作最大积分必须在1-1000之间',
                code: 'INVALID_MAX_POINTS'
            });
        }

        if (updates.className && (typeof updates.className !== 'string' || updates.className.trim().length === 0)) {
            return res.status(400).json({
                success: false,
                message: '班级名称不能为空',
                code: 'INVALID_CLASS_NAME'
            });
        }

        if (updates.author && (typeof updates.author !== 'string' || updates.author.trim().length === 0)) {
            return res.status(400).json({
                success: false,
                message: '作者名称不能为空',
                code: 'INVALID_AUTHOR'
            });
        }

        if (updates.copyright && (typeof updates.copyright !== 'string' || updates.copyright.trim().length === 0)) {
            return res.status(400).json({
                success: false,
                message: '版权信息不能为空',
                code: 'INVALID_COPYRIGHT'
            });
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

    } catch (error) {
        console.error('更新系统配置失败:', error);
        res.status(500).json({
            success: false,
            message: '更新系统配置失败',
            code: 'CONFIG_UPDATE_ERROR'
        });
    }
});

/**
 * 重置积分
 * POST /api/config/reset-points
 * 需要教师权限
 */
router.post('/reset-points', authenticateToken, requireTeacher, async (req, res) => {
    try {
        // 检查积分重置功能是否启用
        const config = await readConfig();
        if (!config.pointsResetEnabled) {
            return res.status(403).json({
                success: false,
                message: '积分重置功能未启用',
                code: 'RESET_DISABLED'
            });
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

    } catch (error) {
        console.error('重置积分失败:', error);
        res.status(500).json({
            success: false,
            message: '重置积分失败',
            code: 'RESET_ERROR'
        });
    }
});

/**
 * 启用/禁用积分重置功能
 * POST /api/config/reset-points/toggle
 * 需要教师权限
 */
router.post('/reset-points/toggle', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: '参数错误，enabled必须为布尔值',
                code: 'INVALID_PARAMETER'
            });
        }

        // 读取当前配置
        const currentConfig = await readConfig();
        
        // 更新配置
        const updatedConfig = await writeConfig({
            ...currentConfig,
            pointsResetEnabled: enabled
        });

        // 广播配置更新事件
        sseService.broadcastConfigUpdate(updatedConfig);

        res.json({
            success: true,
            message: `积分重置功能已${enabled ? '启用' : '禁用'}`,
            data: {
                pointsResetEnabled: updatedConfig.pointsResetEnabled
            }
        });

    } catch (error) {
        console.error('切换积分重置功能失败:', error);
        res.status(500).json({
            success: false,
            message: '切换积分重置功能失败',
            code: 'TOGGLE_ERROR'
        });
    }
});

module.exports = router;