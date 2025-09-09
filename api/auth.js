const express = require('express');
const jwt = require('jsonwebtoken');
const StudentService = require('../services/studentService');
const router = express.Router();

// JWT密钥 (生产环境应使用环境变量)
const JWT_SECRET = process.env.JWT_SECRET || 'classroom-points-system-secret-key';

// 默认教师密码 (生产环境应使用更安全的方式)
const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || 'admin123';

/**
 * 学生登录接口
 * 仅验证学号是否存在，无需密码
 */
router.post('/student-login', async (req, res) => {
    try {
        const { studentId } = req.body;

        // 参数验证
        if (!studentId || typeof studentId !== 'string') {
            return res.status(400).json({
                success: false,
                message: '学号不能为空',
                code: 'INVALID_STUDENT_ID'
            });
        }

        // 验证学生是否存在
        const studentService = new StudentService();
        const student = await studentService.validateStudentLogin(studentId.trim());

        if (!student) {
            return res.status(401).json({
                success: false,
                message: '学号不存在，请检查后重试',
                code: 'STUDENT_NOT_FOUND'
            });
        }

        // 生成JWT令牌
        const token = jwt.sign(
            {
                userId: student.id,
                userType: 'student',
                name: student.name,
                class: student.class
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: '学生登录成功',
            data: {
                token,
                student: {
                    id: student.id,
                    name: student.name,
                    class: student.class,
                    balance: student.balance
                }
            }
        });

    } catch (error) {
        console.error('学生登录失败:', error);
        res.status(500).json({
            success: false,
            message: '登录失败，请稍后重试',
            code: 'LOGIN_ERROR'
        });
    }
});

// 引入教师服务
const TeacherService = require('../services/teacherService');

/**
 * 教师登录接口
 * 支持多个教师账号验证
 */
router.post('/teacher-login', async (req, res) => {
    try {
        const { teacherId, password } = req.body;

        // 参数验证
        if (!teacherId || typeof teacherId !== 'string') {
            return res.status(400).json({
                success: false,
                message: '教师ID不能为空',
                code: 'INVALID_TEACHER_ID'
            });
        }

        if (!password || typeof password !== 'string') {
            return res.status(400).json({
                success: false,
                message: '密码不能为空',
                code: 'INVALID_PASSWORD'
            });
        }

        const trimmedTeacherId = teacherId.trim();
        
        // 使用教师服务验证登录
        const teacherService = new TeacherService();
        const teacher = await teacherService.validateTeacherLogin(trimmedTeacherId, password);
        
        if (!teacher) {
            return res.status(401).json({
                success: false,
                message: '教师ID不存在或密码错误',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // 生成JWT令牌
        const token = jwt.sign(
            {
                userId: teacher.id,
                userType: 'teacher',
                name: teacher.name,
                role: teacher.role,
                department: teacher.department
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            success: true,
            message: '教师登录成功',
            data: {
                token,
                teacher: {
                    id: teacher.id,
                    name: teacher.name,
                    role: teacher.role,
                    department: teacher.department,
                    userType: 'teacher'
                }
            }
        });

    } catch (error) {
        console.error('教师登录失败:', error);
        res.status(500).json({
            success: false,
            message: '登录失败，请稍后重试',
            code: 'LOGIN_ERROR'
        });
    }
});

/**
 * 验证令牌接口
 * 用于检查当前登录状态
 */
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: '令牌有效',
        data: {
            user: req.user
        }
    });
});

/**
 * 登出接口
 * 客户端删除令牌即可
 */
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: '登出成功'
    });
});

/**
 * JWT认证中间件
 * 验证请求中的JWT令牌
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            message: '访问令牌缺失',
            code: 'TOKEN_MISSING'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: '访问令牌无效或已过期',
                code: 'TOKEN_INVALID'
            });
        }

        req.user = user;
        next();
    });
}

/**
 * 教师权限验证中间件
 * 确保当前用户是教师
 */
function requireTeacher(req, res, next) {
    if (!req.user || req.user.userType !== 'teacher') {
        return res.status(403).json({
            success: false,
            message: '需要教师权限',
            code: 'TEACHER_REQUIRED'
        });
    }
    next();
}

/**
 * 学生权限验证中间件
 * 确保当前用户是学生
 */
function requireStudent(req, res, next) {
    if (!req.user || req.user.userType !== 'student') {
        return res.status(403).json({
            success: false,
            message: '需要学生权限',
            code: 'STUDENT_REQUIRED'
        });
    }
    next();
}

// 导出中间件供其他路由使用
router.authenticateToken = authenticateToken;
router.requireTeacher = requireTeacher;
router.requireStudent = requireStudent;

module.exports = router;