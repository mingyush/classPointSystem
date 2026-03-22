const express = require('express');
const InteractionService = require('../services/interactionService');
const sseService = require('../services/sseService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');

const router = express.Router();
const interactionService = new InteractionService();

/**
 * 公共端写操作前置检查：
 * 仅允许在上课模式下进行班级代表确认/上报，避免平时模式误操作。
 */
async function ensureClassModeForPublicWrite() {
    const mode = await interactionService.getSystemMode();
    if (mode !== 'class') {
        throw createError('PERMISSION_DENIED', '当前非上课模式，暂不可进行班级互动提交');
    }
}

function normalizeQueryFilters(query = {}) {
    return {
        type: query.type || undefined,
        status: query.status || undefined,
        createdByRole: query.createdByRole || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
        keyword: query.q || query.keyword || undefined
    };
}

/**
 * 教师发布通知/任务
 * POST /api/interactions/publish
 */
router.post('/publish',
    authenticateToken,
    requireTeacher,
    operationLogger('发布班级互动（通知/任务）'),
    asyncHandler(async (req, res) => {
        const { type, title, content, deadlineAt } = req.body;

        if (!type || !['notice', 'task'].includes(type)) {
            throw createError('VALIDATION_ERROR', 'type 必须为 notice 或 task');
        }
        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            throw createError('VALIDATION_ERROR', '标题不能为空');
        }
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            throw createError('VALIDATION_ERROR', '内容不能为空');
        }

        const interaction = await interactionService.publishByTeacher({
            type,
            title,
            content,
            deadlineAt,
            teacherId: req.user.userId,
            teacherName: req.user.name
        });

        sseService.broadcastInteractionUpdate({
            action: 'published',
            interaction
        });

        res.status(201).json({
            success: true,
            message: '发布成功',
            data: interaction
        });
    })
);

/**
 * 班级代表上报信息
 * POST /api/interactions/report
 */
router.post('/report',
    operationLogger('班级代表提交上报'),
    asyncHandler(async (req, res) => {
        await ensureClassModeForPublicWrite();

        const { studentId, title, content } = req.body;
        if (!studentId || typeof studentId !== 'string') {
            throw createError('INVALID_STUDENT_ID', '学号不能为空');
        }
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            throw createError('VALIDATION_ERROR', '上报内容不能为空');
        }

        const interaction = await interactionService.submitReportByClass({
            studentId,
            title,
            content
        });

        sseService.broadcastInteractionUpdate({
            action: 'reported',
            interaction
        });

        res.status(201).json({
            success: true,
            message: '上报成功',
            data: interaction
        });
    })
);

/**
 * 班级代表确认通知/任务
 * POST /api/interactions/:id/class-confirm
 */
router.post('/:id/class-confirm',
    operationLogger('班级代表确认互动'),
    asyncHandler(async (req, res) => {
        await ensureClassModeForPublicWrite();

        const { id } = req.params;
        const { studentId, note } = req.body;
        if (!studentId || typeof studentId !== 'string') {
            throw createError('INVALID_STUDENT_ID', '学号不能为空');
        }

        const interaction = await interactionService.classConfirm(id, {
            studentId,
            note
        });

        sseService.broadcastInteractionUpdate({
            action: 'class_confirmed',
            interaction
        });

        res.json({
            success: true,
            message: '确认成功',
            data: interaction
        });
    })
);

/**
 * 老师审核上报
 * POST /api/interactions/:id/teacher-review
 */
router.post('/:id/teacher-review',
    authenticateToken,
    requireTeacher,
    operationLogger('教师审核班级上报'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { status, note } = req.body;

        const interaction = await interactionService.teacherReviewReport(id, {
            status,
            note,
            teacherId: req.user.userId
        });

        sseService.broadcastInteractionUpdate({
            action: 'teacher_reviewed',
            interaction
        });

        res.json({
            success: true,
            message: '审核完成',
            data: interaction
        });
    })
);

/**
 * 老师关闭通知/任务
 * POST /api/interactions/:id/close
 */
router.post('/:id/close',
    authenticateToken,
    requireTeacher,
    operationLogger('教师关闭互动'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { note } = req.body;

        const interaction = await interactionService.closeTeacherInteraction(id, {
            note,
            teacherId: req.user.userId
        });

        sseService.broadcastInteractionUpdate({
            action: 'closed',
            interaction
        });

        res.json({
            success: true,
            message: '关闭成功',
            data: interaction
        });
    })
);

/**
 * 大屏：未确认互动（通知/任务）
 * GET /api/interactions/unconfirmed
 */
router.get('/unconfirmed', asyncHandler(async (req, res) => {
    const { limit = 30 } = req.query;
    const list = await interactionService.getUnconfirmed(limit);
    res.json({
        success: true,
        message: '获取未确认互动成功',
        data: list
    });
}));

/**
 * 历史查询（公共）
 * GET /api/interactions/history
 */
router.get('/history', asyncHandler(async (req, res) => {
    const { page = 1, pageSize = 20 } = req.query;
    const filters = normalizeQueryFilters(req.query);
    const result = await interactionService.queryHistory(filters, page, pageSize);
    res.json({
        success: true,
        message: '获取互动历史成功',
        data: {
            interactions: result.list,
            pagination: {
                page: result.page,
                pageSize: result.pageSize,
                total: result.total,
                pages: Math.ceil(result.total / result.pageSize)
            }
        }
    });
}));

/**
 * 教师端列表（带鉴权）
 * GET /api/interactions/list
 */
router.get('/list',
    authenticateToken,
    requireTeacher,
    asyncHandler(async (req, res) => {
        const { page = 1, pageSize = 50 } = req.query;
        const filters = normalizeQueryFilters(req.query);
        const result = await interactionService.queryHistory(filters, page, pageSize);
        res.json({
            success: true,
            message: '获取互动列表成功',
            data: {
                interactions: result.list,
                pagination: {
                    page: result.page,
                    pageSize: result.pageSize,
                    total: result.total,
                    pages: Math.ceil(result.total / result.pageSize)
                }
            }
        });
    })
);

module.exports = router;
