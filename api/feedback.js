/**
 * 问题反馈API接口
 * 提供反馈收集、管理和查看功能
 */

const express = require('express');
const FeedbackService = require('../services/feedbackService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');

const router = express.Router();

// 创建反馈服务实例
const feedbackService = new FeedbackService();

/**
 * 提交新的反馈
 * POST /api/feedback
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    const { title, content, category = 'general', priority = 'medium', contactInfo = '', tags = [] } = req.body;
    const { userId, userType, name } = req.user;

    // 参数验证
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw createError('INVALID_TITLE', '反馈标题不能为空');
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw createError('INVALID_CONTENT', '反馈内容不能为空');
    }

    if (title.length > 200) {
        throw createError('TITLE_TOO_LONG', '反馈标题长度不能超过200字符');
    }

    if (content.length > 5000) {
        throw createError('CONTENT_TOO_LONG', '反馈内容长度不能超过5000字符');
    }

    const validCategories = ['bug', 'feature', 'suggestion', 'question', 'general'];
    if (!validCategories.includes(category)) {
        throw createError('INVALID_CATEGORY', `反馈类别必须为: ${validCategories.join(', ')}`);
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
        throw createError('INVALID_PRIORITY', `优先级必须为: ${validPriorities.join(', ')}`);
    }

    if (tags && !Array.isArray(tags)) {
        throw createError('INVALID_TAGS', '标签必须为数组');
    }

    // 创建反馈
    const feedbackData = {
        title: title.trim(),
        content: content.trim(),
        category,
        priority,
        submitterType: userType,
        submitterId: userId,
        submitterName: name,
        contactInfo: contactInfo.trim(),
        tags: tags || []
    };

    const feedback = await feedbackService.createFeedback(feedbackData);

    res.json({
        success: true,
        message: '反馈提交成功',
        data: feedback.toSafeJSON()
    });
}));

/**
 * 获取反馈列表
 * GET /api/feedback
 * 支持分页和过滤参数
 */
router.get('/', authenticateToken, requireTeacher, asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        category,
        status,
        priority,
        submitterType,
        search
    } = req.query;

    // 参数验证
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    if (pageNum < 1) {
        throw createError('INVALID_PAGE', '页码必须大于0');
    }

    if (limitNum < 1 || limitNum > 100) {
        throw createError('INVALID_LIMIT', '每页数量必须在1-100之间');
    }

    // 构建过滤条件
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (submitterType) filters.submitterType = submitterType;
    if (search) filters.search = search;

    // 获取反馈列表和总数
    const feedbackList = await feedbackService.getFeedbackList(filters, pageNum, limitNum);
    const totalCount = await feedbackService.getFeedbackCount(filters);

    res.json({
        success: true,
        message: '获取反馈列表成功',
        data: {
            feedbacks: feedbackList.map(fb => fb.toSafeJSON()),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                pages: Math.ceil(totalCount / limitNum)
            }
        }
    });
}));

/**
 * 获取单个反馈详情
 * GET /api/feedback/:id
 */
router.get('/:id', authenticateToken, requireTeacher, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const feedback = await feedbackService.getFeedbackById(id);
    if (!feedback) {
        throw createError('FEEDBACK_NOT_FOUND', '反馈不存在');
    }

    res.json({
        success: true,
        message: '获取反馈详情成功',
        data: feedback.toSafeJSON()
    });
}));

/**
 * 更新反馈状态
 * PUT /api/feedback/:id
 */
router.put('/:id', authenticateToken, requireTeacher, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, priority, tags } = req.body;

    // 参数验证
    if (status) {
        const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
        if (!validStatuses.includes(status)) {
            throw createError('INVALID_STATUS', `状态必须为: ${validStatuses.join(', ')}`);
        }
    }

    if (priority) {
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        if (!validPriorities.includes(priority)) {
            throw createError('INVALID_PRIORITY', `优先级必须为: ${validPriorities.join(', ')}`);
        }
    }

    if (tags && !Array.isArray(tags)) {
        throw createError('INVALID_TAGS', '标签必须为数组');
    }

    // 构建更新数据
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (tags !== undefined) updateData.tags = tags;

    const feedback = await feedbackService.updateFeedback(id, updateData);

    res.json({
        success: true,
        message: '反馈更新成功',
        data: feedback.toSafeJSON()
    });
}));

/**
 * 删除反馈
 * DELETE /api/feedback/:id
 */
router.delete('/:id', authenticateToken, requireTeacher, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const deleted = await feedbackService.deleteFeedback(id);
    if (!deleted) {
        throw createError('FEEDBACK_NOT_FOUND', '反馈不存在');
    }

    res.json({
        success: true,
        message: '反馈删除成功'
    });
}));

/**
 * 获取反馈统计信息
 * GET /api/feedback/stats
 */
router.get('/stats', authenticateToken, requireTeacher, asyncHandler(async (req, res) => {
    const stats = await feedbackService.getFeedbackStats();

    res.json({
        success: true,
        message: '获取反馈统计信息成功',
        data: stats
    });
}));

module.exports = router;