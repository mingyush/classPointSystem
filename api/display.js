/**
 * 教室大屏管理API
 * 
 * 功能：
 * - 大屏认证和状态管理
 * - 模式切换（平时模式/上课模式）
 * - 任课老师选择和密码验证
 * - 自动切换定时器管理
 */

const express = require('express');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { permissionMiddleware } = require('../middleware/permissions');
const { displayManagerV1: displayManager } = require('../services/displayManager');
const { Validators } = require('../middleware/validation');

const router = express.Router();

// ==================== 大屏状态管理 ====================

/**
 * 获取大屏当前状态
 */
router.get('/status', asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    const status = displayManager.getCurrentMode(classKey);
    const isAuthenticated = await displayManager.checkAuthentication(classKey);
    
    res.json({
        success: true,
        data: {
            ...status,
            isAuthenticated
        },
        message: '获取大屏状态成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 大屏认证
 */
router.post('/authenticate', asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    const { username, password } = req.body;
    
    if (!username || !password) {
        throw createError('VALIDATION_ERROR', '用户名和密码不能为空');
    }
    
    const result = await displayManager.authenticateDisplay(classKey, { username, password });
    
    res.json({
        success: true,
        data: result,
        message: '大屏认证成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 切换到上课模式
 */
router.post('/switch-to-class', asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    const { teacherId, password } = req.body;
    
    if (!teacherId) {
        throw createError('VALIDATION_ERROR', '教师ID不能为空');
    }
    
    const result = await displayManager.switchToClassMode(classKey, teacherId, password);
    
    // 更新活动时间
    await displayManager.updateActivity(classKey);
    
    res.json({
        success: true,
        data: result,
        message: '已切换到上课模式',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 切换到平时模式
 */
router.post('/switch-to-normal', asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    
    const result = await displayManager.switchToNormalMode(classKey);
    
    res.json({
        success: true,
        data: result,
        message: '已切换到平时模式',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 强制切换模式（班主任权限）
 */
router.post('/force-switch', permissionMiddleware.requireAdmin(), asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    const { mode } = req.body;
    const { userId } = req.userSession;
    
    if (!mode) {
        throw createError('VALIDATION_ERROR', '模式不能为空');
    }
    
    const result = await displayManager.forceSwitch(classKey, mode, userId);
    
    res.json({
        success: true,
        data: result,
        message: '强制切换成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 更新活动时间
 */
router.post('/activity', asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    
    await displayManager.updateActivity(classKey);
    
    res.json({
        success: true,
        message: '活动时间已更新',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 教师管理 ====================

/**
 * 获取可选择的教师列表
 */
router.get('/teachers', asyncHandler(async (req, res) => {
    // 移除classKey和classContext依赖，直接使用默认班级
    const classId = 'default'; // 单班级部署使用默认班级ID
    
    // 获取存储适配器
    const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');
    const adapter = await storageAdapterFactory.getDefaultAdapter();
    
    // 获取教师列表
    const teachers = await adapter.getUsers(classId, { 
        role: ['admin', 'teacher'],
        isActive: true 
    });
    
    // 只返回必要信息
    const teacherList = teachers.map(teacher => ({
        id: teacher.id,
        name: teacher.name,
        role: teacher.role
    }));
    
    res.json({
        success: true,
        data: teacherList,
        message: '获取教师列表成功',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 班级设置 ====================

/**
 * 获取班级大屏设置
 */
router.get('/settings', asyncHandler(async (req, res) => {
    const { classContext } = req;
    
    const settings = {
        requireSwitchPassword: classContext.settings.requireSwitchPassword || false,
        autoSwitchHours: classContext.settings.autoSwitchHours || 2,
        displayConfig: classContext.settings.displayConfig || {
            showStudentQuery: true,
            queryPosition: 'bottom',
            theme: 'default'
        }
    };
    
    res.json({
        success: true,
        data: settings,
        message: '获取大屏设置成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 更新班级大屏设置（班主任权限）
 */
router.put('/settings', permissionMiddleware.requireAdmin(), asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    const { requireSwitchPassword, switchPassword, autoSwitchHours, displayConfig } = req.body;
    
    // 构建更新数据
    const updates = {
        settings: {
            requireSwitchPassword: requireSwitchPassword !== undefined ? requireSwitchPassword : false,
            autoSwitchHours: autoSwitchHours || 2,
            displayConfig: displayConfig || {
                showStudentQuery: true,
                queryPosition: 'bottom',
                theme: 'default'
            }
        }
    };
    
    // 如果设置了密码，添加到更新数据中
    if (requireSwitchPassword && switchPassword) {
        updates.settings.switchPassword = switchPassword;
    }
    
    // 更新班级设置
    const { classIsolation } = require('../middleware/classIsolation');
    const updatedClass = await classIsolation.updateClass(classKey, updates);
    
    res.json({
        success: true,
        data: updatedClass.settings,
        message: '大屏设置更新成功',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 统计和监控 ====================

/**
 * 获取大屏使用统计
 */
router.get('/statistics', permissionMiddleware.requireAdmin(), asyncHandler(async (req, res) => {
    const stats = displayManager.getStatistics();
    
    res.json({
        success: true,
        data: stats,
        message: '获取大屏统计成功',
        timestamp: new Date().toISOString()
    });
}));

/**
 * 获取所有大屏状态（系统管理用）
 */
router.get('/all-states', permissionMiddleware.requireAdmin(), asyncHandler(async (req, res) => {
    const states = displayManager.getAllStates();
    
    res.json({
        success: true,
        data: states,
        message: '获取所有大屏状态成功',
        timestamp: new Date().toISOString()
    });
}));

// ==================== 实时通信 ====================

/**
 * SSE连接端点（大屏实时更新）
 */
router.get('/events', asyncHandler(async (req, res) => {
    const { classKey } = req.params;
    
    // 设置SSE响应头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // 发送初始状态
    const currentState = displayManager.getCurrentMode(classKey);
    res.write(`data: ${JSON.stringify({
        type: 'initial_state',
        data: currentState,
        timestamp: new Date().toISOString()
    })}\n\n`);
    
    // 注册SSE客户端
    const sseService = require('../services/sseService');
    const clientId = `display_${classKey}_${Date.now()}`;
    sseService.addClient(clientId, res, { classKey, type: 'display' });
    
    // 处理连接关闭
    req.on('close', () => {
        sseService.removeClient(clientId);
    });
    
    req.on('error', (error) => {
        console.error('大屏SSE连接错误:', error);
        sseService.removeClient(clientId);
    });
}));

module.exports = router;