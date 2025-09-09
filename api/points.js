const express = require('express');
const PointsService = require('../services/pointsService');
const sseService = require('../services/sseService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');
const { Validators, CustomValidators } = require('../middleware/validation');
const router = express.Router();

// 创建积分服务实例
const pointsService = new PointsService();

/**
 * 获取积分排行榜
 * GET /api/points/rankings?type=total&limit=50
 */
router.get('/rankings', 
    operationLogger('获取积分排行榜'),
    asyncHandler(async (req, res) => {
        const { type = 'total', limit = 50 } = req.query;
        
        // 参数验证
        const validTypes = ['total', 'daily', 'weekly'];
        if (!validTypes.includes(type)) {
            throw createError('INVALID_RANKING_TYPE', '无效的排行榜类型，支持: ' + validTypes.join(', '));
        }

        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            throw createError('INVALID_LIMIT', '限制数量必须为1-100之间的数字');
        }

        // 获取排行榜数据
        const rankings = await pointsService.getPointsRanking(type, limitNum);

        res.json({
            success: true,
            message: '获取积分排行榜成功',
            data: {
                type,
                rankings,
                total: rankings.length
            }
        });
    })
);

/**
 * 获取所有类型的排行榜
 * GET /api/points/rankings/all?limit=50
 */
router.get('/rankings/all', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const limitNum = parseInt(limit);
        
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                message: '限制数量必须为1-100之间的数字',
                code: 'INVALID_LIMIT'
            });
        }

        // 并行获取所有类型的排行榜
        const [totalRankings, dailyRankings, weeklyRankings] = await Promise.all([
            pointsService.getPointsRanking('total', limitNum),
            pointsService.getPointsRanking('daily', limitNum),
            pointsService.getPointsRanking('weekly', limitNum)
        ]);

        res.json({
            success: true,
            message: '获取所有排行榜成功',
            data: {
                total: totalRankings,
                daily: dailyRankings,
                weekly: weeklyRankings
            }
        });

    } catch (error) {
        console.error('获取所有排行榜失败:', error);
        res.status(500).json({
            success: false,
            message: '获取排行榜失败，请稍后重试',
            code: 'RANKING_ERROR'
        });
    }
});

/**
 * 获取特定类型的排行榜
 * GET /api/points/rankings/total
 * GET /api/points/rankings/daily  
 * GET /api/points/rankings/weekly
 */
router.get('/rankings/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { limit = 50 } = req.query;
        
        const validTypes = ['total', 'daily', 'weekly'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: '无效的排行榜类型，支持: ' + validTypes.join(', '),
                code: 'INVALID_RANKING_TYPE'
            });
        }

        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                message: '限制数量必须为1-100之间的数字',
                code: 'INVALID_LIMIT'
            });
        }

        const rankings = await pointsService.getPointsRanking(type, limitNum);

        res.json({
            success: true,
            message: `获取${type}排行榜成功`,
            data: rankings
        });

    } catch (error) {
        console.error(`获取${req.params.type}排行榜失败:`, error);
        res.status(500).json({
            success: false,
            message: '获取排行榜失败，请稍后重试',
            code: 'RANKING_ERROR'
        });
    }
});

/**
 * 加分操作
 * POST /api/points/add
 * 需要教师权限
 */
router.post('/add', 
    authenticateToken, 
    requireTeacher,
    operationLogger('积分加分操作'),
    asyncHandler(async (req, res) => {
        const { studentId, points, reason } = req.body;

        // 参数验证
        if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
            throw createError('INVALID_STUDENT_ID', '学号不能为空');
        }

        if (typeof points !== 'number' || points <= 0) {
            throw createError('INVALID_POINTS', '加分数量必须为正数');
        }

        if (points > 100) {
            throw createError('INVALID_POINTS', '单次加分不能超过100分');
        }

        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            throw createError('INVALID_REASON', '加分原因不能为空');
        }

        // 添加积分记录
        const record = await pointsService.addPointRecord({
            studentId: studentId.trim(),
            points,
            reason: reason.trim(),
            operatorId: req.user.userId,
            type: 'add'
        });

        // 获取学生更新后的余额
        const updatedBalance = await pointsService.calculateStudentBalance(studentId.trim());

        // 广播积分更新事件
        sseService.broadcastPointsUpdate({
            studentId: studentId.trim(),
            points,
            newBalance: updatedBalance,
            reason: reason.trim(),
            operatorId: req.user.userId,
            recordId: record.id
        });

        // 获取并广播更新后的排行榜
        try {
            const [totalRankings, dailyRankings, weeklyRankings] = await Promise.all([
                pointsService.getPointsRanking('total', 50),
                pointsService.getPointsRanking('daily', 50),
                pointsService.getPointsRanking('weekly', 50)
            ]);

            sseService.broadcastRankingsUpdate({
                total: totalRankings,
                daily: dailyRankings,
                weekly: weeklyRankings
            });
        } catch (rankingError) {
            // 排行榜更新失败不影响主要操作
            console.warn('排行榜更新失败:', rankingError);
        }

        res.json({
            success: true,
            message: '加分操作成功',
            data: {
                record: record.toJSON(),
                newBalance: updatedBalance
            }
        });
    })
);

/**
 * 减分操作
 * POST /api/points/subtract
 * 需要教师权限
 */
router.post('/subtract', 
    authenticateToken, 
    requireTeacher,
    operationLogger('积分减分操作'),
    asyncHandler(async (req, res) => {
        const { studentId, points, reason } = req.body;

        // 参数验证
        if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
            throw createError('INVALID_STUDENT_ID', '学号不能为空');
        }

        if (typeof points !== 'number' || points <= 0) {
            throw createError('INVALID_POINTS', '减分数量必须为正数');
        }

        if (points > 100) {
            throw createError('INVALID_POINTS', '单次减分不能超过100分');
        }

        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            throw createError('INVALID_REASON', '减分原因不能为空');
        }

        // 添加积分记录（负数表示减分）
        const record = await pointsService.addPointRecord({
            studentId: studentId.trim(),
            points: -points, // 负数表示减分
            reason: reason.trim(),
            operatorId: req.user.userId,
            type: 'subtract'
        });

        // 获取学生更新后的余额
        const updatedBalance = await pointsService.calculateStudentBalance(studentId.trim());

        // 广播积分更新事件
        sseService.broadcastPointsUpdate({
            studentId: studentId.trim(),
            points: -points, // 负数表示减分
            newBalance: updatedBalance,
            reason: reason.trim(),
            operatorId: req.user.userId,
            recordId: record.id
        });

        // 获取并广播更新后的排行榜
        try {
            const [totalRankings, dailyRankings, weeklyRankings] = await Promise.all([
                pointsService.getPointsRanking('total', 50),
                pointsService.getPointsRanking('daily', 50),
                pointsService.getPointsRanking('weekly', 50)
            ]);

            sseService.broadcastRankingsUpdate({
                total: totalRankings,
                daily: dailyRankings,
                weekly: weeklyRankings
            });
        } catch (rankingError) {
            // 排行榜更新失败不影响主要操作
            console.warn('排行榜更新失败:', rankingError);
        }

        res.json({
            success: true,
            message: '减分操作成功',
            data: {
                record: record.toJSON(),
                newBalance: updatedBalance
            }
        });
    })
);

/**
 * 获取积分历史记录
 * GET /api/points/history/:studentId?limit=20
 */
router.get('/history/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { limit = 20 } = req.query;

        // 权限验证：学生只能查看自己的记录，教师可以查看所有记录
        if (req.user.userType === 'student' && req.user.userId !== studentId) {
            return res.status(403).json({
                success: false,
                message: '只能查看自己的积分记录',
                code: 'PERMISSION_DENIED'
            });
        }

        // 参数验证
        if (!studentId || typeof studentId !== 'string') {
            return res.status(400).json({
                success: false,
                message: '学号不能为空',
                code: 'INVALID_STUDENT_ID'
            });
        }

        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                message: '限制数量必须为1-100之间的数字',
                code: 'INVALID_LIMIT'
            });
        }

        // 获取积分记录
        const records = await pointsService.getPointRecordsByStudent(studentId, limitNum);

        res.json({
            success: true,
            message: '获取积分历史成功',
            data: {
                studentId,
                records: records.map(record => record.toJSON()),
                total: records.length
            }
        });

    } catch (error) {
        console.error('获取积分历史失败:', error);
        res.status(500).json({
            success: false,
            message: '获取积分历史失败，请稍后重试',
            code: 'HISTORY_ERROR'
        });
    }
});

/**
 * 获取学生排名信息
 * GET /api/points/rank/:studentId
 */
router.get('/rank/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;

        // 权限验证：学生只能查看自己的排名，教师可以查看所有排名
        if (req.user.userType === 'student' && req.user.userId !== studentId) {
            return res.status(403).json({
                success: false,
                message: '只能查看自己的排名信息',
                code: 'PERMISSION_DENIED'
            });
        }

        // 参数验证
        if (!studentId || typeof studentId !== 'string') {
            return res.status(400).json({
                success: false,
                message: '学号不能为空',
                code: 'INVALID_STUDENT_ID'
            });
        }

        // 获取排名信息
        const rankInfo = await pointsService.getStudentRankInfo(studentId);

        res.json({
            success: true,
            message: '获取排名信息成功',
            data: rankInfo
        });

    } catch (error) {
        console.error('获取排名信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取排名信息失败，请稍后重试',
            code: 'RANK_ERROR'
        });
    }
});

/**
 * 获取积分统计信息
 * GET /api/points/statistics
 * 需要教师权限
 */
router.get('/statistics', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const statistics = await pointsService.getPointsStatistics();

        res.json({
            success: true,
            message: '获取积分统计成功',
            data: statistics
        });

    } catch (error) {
        console.error('获取积分统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取积分统计失败，请稍后重试',
            code: 'STATISTICS_ERROR'
        });
    }
});

/**
 * 批量加分操作
 * POST /api/points/batch-add
 * 需要教师权限
 */
router.post('/batch-add', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { operations } = req.body;

        // 参数验证
        if (!Array.isArray(operations) || operations.length === 0) {
            return res.status(400).json({
                success: false,
                message: '操作列表不能为空',
                code: 'INVALID_OPERATIONS'
            });
        }

        if (operations.length > 50) {
            return res.status(400).json({
                success: false,
                message: '批量操作不能超过50个',
                code: 'TOO_MANY_OPERATIONS'
            });
        }

        // 验证每个操作
        for (const op of operations) {
            if (!op.studentId || typeof op.studentId !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: '所有操作必须包含有效的学号',
                    code: 'INVALID_STUDENT_ID'
                });
            }

            if (typeof op.points !== 'number' || op.points === 0) {
                return res.status(400).json({
                    success: false,
                    message: '所有操作必须包含有效的积分数量',
                    code: 'INVALID_POINTS'
                });
            }

            if (!op.reason || typeof op.reason !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: '所有操作必须包含操作原因',
                    code: 'INVALID_REASON'
                });
            }
        }

        // 准备批量操作数据
        const recordsData = operations.map(op => ({
            studentId: op.studentId.trim(),
            points: op.points,
            reason: op.reason.trim(),
            operatorId: req.user.userId,
            type: op.points > 0 ? 'add' : 'subtract'
        }));

        // 执行批量操作
        const results = await pointsService.batchAddPointRecords(recordsData);

        res.json({
            success: true,
            message: '批量操作完成',
            data: {
                successful: results.success.length,
                failed: results.failed.length,
                results: results
            }
        });

    } catch (error) {
        console.error('批量操作失败:', error);
        res.status(500).json({
            success: false,
            message: '批量操作失败，请稍后重试',
            code: 'BATCH_ERROR'
        });
    }
});

/**
 * 获取时间范围内的积分记录
 * GET /api/points/records?startDate=2024-01-01&endDate=2024-01-31&studentId=xxx
 * 需要教师权限
 */
router.get('/records', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { startDate, endDate, studentId } = req.query;

        // 参数验证
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: '开始时间和结束时间不能为空',
                code: 'INVALID_DATE_RANGE'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: '时间格式无效',
                code: 'INVALID_DATE_FORMAT'
            });
        }

        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: '开始时间必须早于结束时间',
                code: 'INVALID_DATE_RANGE'
            });
        }

        // 获取记录
        const records = await pointsService.getPointRecordsByDateRange(start, end, studentId);

        res.json({
            success: true,
            message: '获取积分记录成功',
            data: {
                startDate,
                endDate,
                studentId: studentId || null,
                records: records.map(record => record.toJSON()),
                total: records.length
            }
        });

    } catch (error) {
        console.error('获取积分记录失败:', error);
        res.status(500).json({
            success: false,
            message: '获取积分记录失败，请稍后重试',
            code: 'RECORDS_ERROR'
        });
    }
});

module.exports = router;