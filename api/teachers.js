const express = require('express');
const router = express.Router();
const TeacherService = require('../services/teacherService');
const { authenticateToken, requireTeacher } = require('./auth');

const teacherService = new TeacherService();

/**
 * 权限验证中间件：确保当前用户是 admin 或 director
 * 如果仅为 teacher，则拒绝访问
 */
function requireAdminOrDirector(req, res, next) {
    if (!req.user || !['admin', 'director'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: '需要管理员或班主任权限',
            code: 'ADMIN_OR_DIRECTOR_REQUIRED'
        });
    }
    next();
}

/**
 * 统一应用中间件：
 * 1. 验证 token
 * 2. 验证教师身份
 * 3. 验证是否为管理层 (admin或director)
 */
router.use(authenticateToken);
router.use(requireTeacher);
router.use(requireAdminOrDirector);

/**
 * 获取教师列表
 * GET /api/teachers
 */
router.get('/', async (req, res) => {
    try {
        const teachers = await teacherService.getAllTeachers(false); // 获取所有的
        
        // 返回时不包含密码
        const safeTeachers = teachers.map(t => typeof t.toSafeJSON === 'function' ? t.toSafeJSON() : { ...t, password: undefined });

        res.json({
            success: true,
            data: {
                teachers: safeTeachers
            }
        });
    } catch (error) {
        console.error('获取教师列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取教师列表失败',
            error: error.message
        });
    }
});

/**
 * 创建新教师
 * POST /api/teachers
 */
router.post('/', async (req, res) => {
    try {
        const teacherData = req.body;
        
        // 限制只有 admin 才能创建新的 admin 账号
        if (teacherData.role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足：无法创建最高级管理员账号'
            });
        }

        const newTeacher = await teacherService.createTeacher(teacherData);
        
        res.status(201).json({
            success: true,
            message: '创建教师成功',
            data: {
                teacher: typeof newTeacher.toSafeJSON === 'function' ? newTeacher.toSafeJSON() : { ...newTeacher, password: undefined }
            }
        });
    } catch (error) {
        console.error('创建教师失败:', error);
        res.status(400).json({
            success: false,
            message: error.message || '创建教师失败'
        });
    }
});

/**
 * 更新教师信息
 * PUT /api/teachers/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const teacherId = req.params.id;
        const updateData = req.body;

        // 获取原教师信息验证防越权操作
        const targetTeacher = await teacherService.getTeacherById(teacherId);
        if (!targetTeacher) {
            return res.status(404).json({ success: false, message: '目标教师不存在' });
        }

        // 班主任(director)不能修改管理员(admin)的信息
        if (targetTeacher.role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '权限不足：无法修改高级管理员信息' });
        }

        // 班主任(director)不能将普通老师提升为 admin 或降级 admin
        if (updateData.role && updateData.role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '权限不足：无法赋予或褫夺最高管理员权限' });
        }

        const updatedTeacher = await teacherService.updateTeacher(teacherId, updateData);
        
        res.json({
            success: true,
            message: '更新教师成功',
            data: {
                teacher: typeof updatedTeacher.toSafeJSON === 'function' ? updatedTeacher.toSafeJSON() : { ...updatedTeacher, password: undefined }
            }
        });
    } catch (error) {
        console.error('更新教师失败:', error);
        res.status(400).json({
            success: false,
            message: error.message || '更新教师失败'
        });
    }
});

/**
 * 强行重置密码 (管理层面操作)
 * POST /api/teachers/:id/reset-password
 */
router.post('/:id/reset-password', async (req, res) => {
    try {
        const teacherId = req.params.id;
        const { newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ success: false, message: '必须提供新密码' });
        }

        // 获取目标教师验证防越权
        const targetTeacher = await teacherService.getTeacherById(teacherId);
        if (!targetTeacher) {
            return res.status(404).json({ success: false, message: '目标教师不存在' });
        }

        // 班主任(director)不能强制重置管理员(admin)密码
        if (targetTeacher.role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '无法干涉超级管理员密码' });
        }

        await teacherService.resetPassword(teacherId, newPassword);
        
        res.json({
            success: true,
            message: '重置教师密码成功'
        });
    } catch (error) {
        console.error('重置密码失败:', error);
        res.status(400).json({
            success: false,
            message: error.message || '重置密码失败'
        });
    }
});

/**
 * 软删除教师
 * DELETE /api/teachers/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const teacherId = req.params.id;

        // 这里可根据业务需要增加防止删除自己或删除超级管理员的逻辑
        if (teacherId === req.user.userId) {
            return res.status(400).json({ success: false, message: '不能删除自己' });
        }

        const targetTeacher = await teacherService.getTeacherById(teacherId);
        if (targetTeacher && targetTeacher.role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: '无权删除超级管理员' });
        }

        await teacherService.deleteTeacher(teacherId);
        
        res.json({
            success: true,
            message: '删除教师成功'
        });
    } catch (error) {
        console.error('删除教师失败:', error);
        res.status(400).json({
            success: false,
            message: error.message || '删除教师失败'
        });
    }
});

module.exports = router;
