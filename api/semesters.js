const express = require('express');
const router = express.Router();
const SemesterService = require('../services/semesterService');
const { asyncHandler } = require('../middleware/errorHandler');

const semesterService = new SemesterService();

/**
 * 获取所有学期
 * GET /api/semesters
 */
router.get('/', asyncHandler(async (req, res) => {
    const semesters = await semesterService.getAllSemesters();
    res.json({
        success: true,
        data: semesters
    });
}));

/**
 * 获取当前激活的学期
 * GET /api/semesters/active
 */
router.get('/active', asyncHandler(async (req, res) => {
    const activeSemester = await semesterService.getActiveSemester();
    res.json({
        success: true,
        data: activeSemester
    });
}));

/**
 * 创建新学期
 * POST /api/semesters
 */
router.post('/', asyncHandler(async (req, res) => {
    const semesterData = req.body;
    
    if (!semesterData.name || !semesterData.startDate || !semesterData.endDate) {
        return res.status(400).json({
            success: false,
            message: '缺少必要的学期信息 (name, startDate, endDate)'
        });
    }

    const newSemester = await semesterService.createSemester(semesterData);
    
    res.status(201).json({
        success: true,
        message: '学期创建成功',
        data: newSemester
    });
}));

/**
 * 更新学期信息
 * PUT /api/semesters/:id
 */
router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    
    // 如果想要激活该学期，禁止通过此接口改 isCurrent，必须通过 /activate 接口执行结算
    if (updateData.isCurrent !== undefined) {
        delete updateData.isCurrent;
    }

    const updatedSemester = await semesterService.updateSemester(id, updateData);
    
    res.json({
        success: true,
        message: '学期信息更新成功',
        data: updatedSemester
    });
}));

/**
 * 激活学期（核心：触发老学期归档清零及新学期排行初始奖励发放）
 * POST /api/semesters/:id/activate
 */
router.post('/:id/activate', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const operatorId = req.user ? req.user.id : 'system';
    
    const activatedSemester = await semesterService.activateSemester(id, operatorId);
    
    res.json({
        success: true,
        message: `成功激活新学期：${activatedSemester.name}`,
        data: activatedSemester
    });
}));

module.exports = router;
