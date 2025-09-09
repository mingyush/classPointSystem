const express = require('express');
const StudentService = require('../services/studentService');
const PointsService = require('../services/pointsService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');
const router = express.Router();

// 创建服务实例
const studentService = new StudentService();
const pointsService = new PointsService();

/**
 * 获取所有学生信息
 * GET /api/students
 */
router.get('/', authenticateToken, requireTeacher, 
    operationLogger('获取学生列表'),
    asyncHandler(async (req, res) => {
        const students = await studentService.getAllStudents();
        
        // 为每个学生计算实时积分余额
        const studentsWithBalance = await Promise.all(
            students.map(async (student) => {
                const balance = await pointsService.calculateStudentBalance(student.id);
                const studentData = student.toJSON();
                studentData.balance = balance;
                return studentData;
            })
        );
        
        res.json({
            success: true,
            message: '获取学生列表成功',
            students: studentsWithBalance
        });
    })
);

/**
 * 获取单个学生信息
 * GET /api/students/:id
 */
router.get('/:id', authenticateToken, 
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 学生只能查看自己的信息，教师可以查看所有学生信息
        if (req.user.userType === 'student' && req.user.userId !== id) {
            throw createError('ACCESS_DENIED', '学生只能查看自己的信息');
        }
        
        // 获取学生信息
        const student = await studentService.getStudentById(id);
        if (!student) {
            throw createError('STUDENT_NOT_FOUND', '学生不存在');
        }
        
        res.json({
            success: true,
            message: '获取学生信息成功',
            data: student.toJSON()
        });
    })
);

/**
 * 创建新学生
 * POST /api/students
 */
router.post('/', authenticateToken, requireTeacher,
    operationLogger('创建学生'),
    asyncHandler(async (req, res) => {
        const { id, name, class: className, balance = 0 } = req.body;
        
        // 参数验证
        if (!id || typeof id !== 'string' || id.trim().length === 0) {
            throw createError('INVALID_STUDENT_ID', '学号不能为空');
        }
        
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw createError('INVALID_STUDENT_NAME', '姓名不能为空');
        }
        
        if (!className || typeof className !== 'string' || className.trim().length === 0) {
            throw createError('INVALID_CLASS_NAME', '班级不能为空');
        }
        
        if (typeof balance !== 'number' || balance < 0) {
            throw createError('INVALID_BALANCE', '初始积分必须为非负数');
        }
        
        // 创建学生
        const student = await studentService.createStudent({
            id: id.trim(),
            name: name.trim(),
            class: className.trim(),
            balance
        });
        
        res.status(201).json({
            success: true,
            message: '创建学生成功',
            student: student.toJSON()
        });
    })
);

/**
 * 更新学生信息
 * PUT /api/students/:id
 */
router.put('/:id', authenticateToken, requireTeacher,
    operationLogger('更新学生信息'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const updateData = req.body;
        
        // 不允许更新学号
        if (updateData.id && updateData.id !== id) {
            throw createError('INVALID_UPDATE', '不能修改学号');
        }
        
        // 更新学生信息
        const student = await studentService.updateStudent(id, updateData);
        
        res.json({
            success: true,
            message: '更新学生信息成功',
            student: student.toJSON()
        });
    })
);

/**
 * 删除学生
 * DELETE /api/students/:id
 */
router.delete('/:id', authenticateToken, requireTeacher,
    operationLogger('删除学生'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        const success = await studentService.deleteStudent(id);
        
        res.json({
            success: true,
            message: '删除学生成功'
        });
    })
);

/**
 * 获取学生排名信息
 * GET /api/students/:id/rank
 */
router.get('/:id/rank', authenticateToken,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        
        // 学生只能查看自己的排名，教师可以查看所有排名
        if (req.user.userType === 'student' && req.user.userId !== id) {
            throw createError('ACCESS_DENIED', '学生只能查看自己的排名信息');
        }
        
        // 获取排名信息
        const rankInfo = await pointsService.getStudentRankInfo(id);
        
        res.json({
            success: true,
            message: '获取排名信息成功',
            data: rankInfo
        });
    })
);

/**
 * 搜索学生
 * GET /api/students/search?keyword=xxx
 */
router.get('/search', authenticateToken, requireTeacher,
    asyncHandler(async (req, res) => {
        const { keyword } = req.query;
        
        if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
            throw createError('INVALID_KEYWORD', '搜索关键词不能为空');
        }
        
        const students = await studentService.searchStudents(keyword.trim());
        
        res.json({
            success: true,
            message: '搜索学生成功',
            data: {
                keyword: keyword.trim(),
                students: students.map(student => student.toJSON()),
                total: students.length
            }
        });
    })
);

/**
 * 获取学生统计信息
 * GET /api/students/statistics
 */
router.get('/statistics', authenticateToken, requireTeacher,
    asyncHandler(async (req, res) => {
        const statistics = await studentService.getStudentStatistics();
        
        res.json({
            success: true,
            message: '获取学生统计成功',
            data: statistics
        });
    })
);

/**
 * 批量创建学生
 * POST /api/students/batch
 */
router.post('/batch', authenticateToken, requireTeacher,
    operationLogger('批量创建学生'),
    asyncHandler(async (req, res) => {
        const { students } = req.body;
        
        if (!Array.isArray(students) || students.length === 0) {
            throw createError('INVALID_STUDENTS', '学生列表不能为空');
        }
        
        if (students.length > 100) {
            throw createError('TOO_MANY_STUDENTS', '批量创建不能超过100个学生');
        }
        
        const results = await studentService.batchCreateStudents(students);
        
        res.json({
            success: true,
            message: '批量创建学生完成',
            data: {
                successful: results.success.length,
                failed: results.failed.length,
                results: results
            }
        });
    })
);

module.exports = router;