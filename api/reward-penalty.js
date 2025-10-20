const express = require('express');
const RewardPenaltyService = require('../services/rewardPenaltyService');
const sseService = require('../services/sseService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');
const router = express.Router();

// 创建奖惩项服务实例
const rewardPenaltyService = new RewardPenaltyService();

/**
 * 获取所有奖惩项
 * GET /api/reward-penalty
 */
router.get('/', 
    operationLogger('获取奖惩项列表'),
    asyncHandler(async (req, res) => {
        const items = await rewardPenaltyService.getAllRewardPenaltyItems();
        
        res.json({
            success: true,
            message: '获取奖惩项列表成功',
            data: items.map(item => item.toJSON())
        });
    })
);

/**
 * 获取启用的奖惩项（用于大屏显示）
 * GET /api/reward-penalty/active
 */
router.get('/active', 
    operationLogger('获取启用奖惩项'),
    asyncHandler(async (req, res) => {
        const items = await rewardPenaltyService.getActiveItems();
        
        res.json({
            success: true,
            message: '获取启用奖惩项成功',
            data: items.map(item => item.toJSON())
        });
    })
);

/**
 * 创建奖惩项
 * POST /api/reward-penalty
 * 需要教师权限
 */
router.post('/', 
    authenticateToken, 
    requireTeacher,
    operationLogger('创建奖惩项'),
    asyncHandler(async (req, res) => {
        const { name, points, type, isActive = true, sortOrder = 0 } = req.body;

        // 参数验证
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw createError('INVALID_NAME', '奖惩项名称不能为空');
        }

        if (typeof points !== 'number' || points === 0) {
            throw createError('INVALID_POINTS', '积分数量不能为0');
        }

        if (!type || !['reward', 'penalty'].includes(type)) {
            throw createError('INVALID_TYPE', '类型必须为reward或penalty');
        }

        // 验证积分数量与类型的一致性
        if (type === 'reward' && points < 0) {
            throw createError('INVALID_POINTS', '奖励项积分必须为正数');
        }

        if (type === 'penalty' && points > 0) {
            throw createError('INVALID_POINTS', '惩罚项积分必须为负数');
        }

        // 创建奖惩项
        const item = await rewardPenaltyService.createItem({
            name: name.trim(),
            points,
            type,
            isActive,
            sortOrder
        });

        // 广播奖惩项更新事件
        sseService.broadcastRewardPenaltyUpdate({
            action: 'create',
            item: item.toJSON()
        });

        res.status(201).json({
            success: true,
            message: '创建奖惩项成功',
            data: item.toJSON()
        });
    })
);

/**
 * 更新奖惩项
 * PUT /api/reward-penalty/:id
 * 需要教师权限
 */
router.put('/:id', 
    authenticateToken, 
    requireTeacher,
    operationLogger('更新奖惩项'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;

        // 验证更新数据
        if (updateData.name !== undefined) {
            if (!updateData.name || typeof updateData.name !== 'string' || updateData.name.trim().length === 0) {
                throw createError('INVALID_NAME', '奖惩项名称不能为空');
            }
            updateData.name = updateData.name.trim();
        }

        if (updateData.points !== undefined) {
            if (typeof updateData.points !== 'number' || updateData.points === 0) {
                throw createError('INVALID_POINTS', '积分数量不能为0');
            }
        }

        if (updateData.type !== undefined) {
            if (!['reward', 'penalty'].includes(updateData.type)) {
                throw createError('INVALID_TYPE', '类型必须为reward或penalty');
            }
        }

        // 更新奖惩项
        const item = await rewardPenaltyService.updateItem(id, updateData);

        // 广播奖惩项更新事件
        sseService.broadcastRewardPenaltyUpdate({
            action: 'update',
            item: item.toJSON()
        });

        res.json({
            success: true,
            message: '更新奖惩项成功',
            data: item.toJSON()
        });
    })
);

/**
 * 删除奖惩项
 * DELETE /api/reward-penalty/:id
 * 需要教师权限
 */
router.delete('/:id', 
    authenticateToken, 
    requireTeacher,
    operationLogger('删除奖惩项'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const success = await rewardPenaltyService.deleteItem(id);

        // 广播奖惩项更新事件
        sseService.broadcastRewardPenaltyUpdate({
            action: 'delete',
            itemId: id
        });

        res.json({
            success: true,
            message: '删除奖惩项成功'
        });
    })
);

/**
 * 使用奖惩项进行积分操作
 * POST /api/reward-penalty/:id/apply
 * 需要教师权限
 */
router.post('/:id/apply', 
    authenticateToken, 
    requireTeacher,
    operationLogger('应用奖惩项'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { studentId } = req.body;

        // 参数验证
        if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
            throw createError('INVALID_STUDENT_ID', '学号不能为空');
        }

        // 应用奖惩项
        const result = await rewardPenaltyService.applyItem(id, studentId.trim(), req.user.userId);

        // 广播积分更新事件
        sseService.broadcastPointsUpdate({
            studentId: studentId.trim(),
            points: result.points,
            newBalance: result.newBalance,
            reason: result.reason,
            operatorId: req.user.userId,
            recordId: result.recordId
        });

        res.json({
            success: true,
            message: '应用奖惩项成功',
            data: result
        });
    })
);

/**
 * 批量应用奖惩项
 * POST /api/reward-penalty/:id/batch-apply
 * 需要教师权限
 */
router.post('/:id/batch-apply', 
    authenticateToken, 
    requireTeacher,
    operationLogger('批量应用奖惩项'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { studentIds } = req.body;

        // 参数验证
        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            throw createError('INVALID_STUDENT_IDS', '学生ID列表不能为空');
        }

        if (studentIds.length > 50) {
            throw createError('TOO_MANY_STUDENTS', '批量操作不能超过50个学生');
        }

        // 验证每个学生ID
        for (const studentId of studentIds) {
            if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
                throw createError('INVALID_STUDENT_ID', '所有学生ID必须为有效字符串');
            }
        }

        // 批量应用奖惩项
        const results = await rewardPenaltyService.batchApplyItem(id, studentIds, req.user.userId);

        // 广播批量更新事件
        for (const result of results.success) {
            sseService.broadcastPointsUpdate({
                studentId: result.studentId,
                points: result.points,
                newBalance: result.newBalance,
                reason: result.reason,
                operatorId: req.user.userId,
                recordId: result.recordId
            });
        }

        res.json({
            success: true,
            message: '批量应用奖惩项完成',
            data: {
                successful: results.success.length,
                failed: results.failed.length,
                results: results
            }
        });
    })
);

module.exports = router;