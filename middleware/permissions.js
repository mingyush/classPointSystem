/**
 * 权限验证中间件
 * 
 * 功能：
 * - 验证用户身份和权限
 * - 支持班主任、任课老师、学生三种角色
 * - 基于班级的权限控制
 * - 教室大屏访问控制
 */

const { createError } = require('./errorHandler');
const path = require('path');
const fs = require('fs').promises;

/**
 * 用户权限接口
 */
class UserPermission {
    constructor(userId, classId, role, permissions = []) {
        this.userId = userId;
        this.classId = classId;
        this.role = role; // 'admin' | 'teacher' | 'student'
        this.permissions = permissions;
        this.loginTime = new Date();
    }

    hasPermission(permission) {
        return this.permissions.includes(permission) || this.permissions.includes('*');
    }

    isAdmin() {
        return this.role === 'admin';
    }

    isTeacher() {
        return this.role === 'teacher' || this.role === 'admin';
    }

    isStudent() {
        return this.role === 'student';
    }
}

/**
 * 权限验证器类
 */
class PermissionValidator {
    constructor() {
        this.usersFile = path.join(process.cwd(), 'data', 'users.json');
        this.sessionsFile = path.join(process.cwd(), 'data', 'sessions.json');
        this.displaySessionsFile = path.join(process.cwd(), 'data', 'display_sessions.json');
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24小时
        this.displaySessionTimeout = 7 * 24 * 60 * 60 * 1000; // 7天（大屏长期登录）
        
        this.initializeFiles();
    }

    /**
     * 初始化数据文件
     */
    async initializeFiles() {
        try {
            // 初始化用户文件
            try {
                await fs.access(this.usersFile);
            } catch {
                const defaultUsers = [
                    {
                        id: 'admin_default',
                        classId: 'default',
                        username: 'admin',
                        name: '班主任',
                        role: 'admin',
                        password: 'admin123', // 实际应用中应该加密
                        classStudentNumber: null,
                        fullStudentNumber: null,
                        isActive: true,
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'teacher_default',
                        classId: 'default',
                        username: 'teacher',
                        name: '任课老师',
                        role: 'teacher',
                        password: 'teacher123',
                        classStudentNumber: null,
                        fullStudentNumber: null,
                        isActive: true,
                        createdAt: new Date().toISOString()
                    }
                ];
                await fs.writeFile(this.usersFile, JSON.stringify(defaultUsers, null, 2));
            }

            // 初始化会话文件
            try {
                await fs.access(this.sessionsFile);
            } catch {
                await fs.writeFile(this.sessionsFile, JSON.stringify([], null, 2));
            }

            // 初始化大屏会话文件
            try {
                await fs.access(this.displaySessionsFile);
            } catch {
                await fs.writeFile(this.displaySessionsFile, JSON.stringify([], null, 2));
            }
        } catch (error) {
            console.error('初始化权限文件失败:', error);
        }
    }

    /**
     * 验证教师访问权限
     */
    async validateTeacherAccess(classKey, teacherId) {
        try {
            const users = await this.loadUsers();
            const user = users.find(u => 
                u.id === teacherId && 
                u.isActive && 
                (u.role === 'admin' || u.role === 'teacher')
            );

            if (!user) {
                return false;
            }

            // 检查是否属于该班级
            const { classIsolation } = require('./classIsolation');
            const classInfo = await classIsolation.getClassByKey(classKey);
            
            return classInfo && user.classId === classInfo.id;
        } catch (error) {
            console.error('验证教师访问权限失败:', error);
            return false;
        }
    }

    /**
     * 验证班主任访问权限
     */
    async validateAdminAccess(classKey, userId) {
        try {
            const users = await this.loadUsers();
            const user = users.find(u => 
                u.id === userId && 
                u.isActive && 
                u.role === 'admin'
            );

            if (!user) {
                return false;
            }

            // 检查是否属于该班级
            const { classIsolation } = require('./classIsolation');
            const classInfo = await classIsolation.getClassByKey(classKey);
            
            return classInfo && user.classId === classInfo.id;
        } catch (error) {
            console.error('验证班主任访问权限失败:', error);
            return false;
        }
    }

    /**
     * 验证大屏访问权限
     */
    async validateDisplayAccess(classKey) {
        try {
            const sessions = await this.loadDisplaySessions();
            const now = Date.now();
            
            // 查找有效的大屏会话
            const validSession = sessions.find(session => 
                session.classKey === classKey && 
                session.isActive &&
                (now - new Date(session.loginTime).getTime()) < this.displaySessionTimeout
            );

            return !!validSession;
        } catch (error) {
            console.error('验证大屏访问权限失败:', error);
            return false;
        }
    }

    /**
     * 创建用户会话
     */
    async createSession(classKey, userId, userType) {
        try {
            const sessions = await this.loadSessions();
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const newSession = {
                sessionId,
                classKey,
                userId,
                userType,
                loginTime: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                isActive: true
            };

            sessions.push(newSession);
            await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
            
            return sessionId;
        } catch (error) {
            console.error('创建会话失败:', error);
            throw error;
        }
    }

    /**
     * 创建大屏会话
     */
    async createDisplaySession(classKey, adminUserId) {
        try {
            const sessions = await this.loadDisplaySessions();
            
            // 先清除该班级的旧会话
            const filteredSessions = sessions.filter(s => s.classKey !== classKey);
            
            const sessionId = `display_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const newSession = {
                sessionId,
                classKey,
                adminUserId,
                loginTime: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                isActive: true
            };

            filteredSessions.push(newSession);
            await fs.writeFile(this.displaySessionsFile, JSON.stringify(filteredSessions, null, 2));
            
            return sessionId;
        } catch (error) {
            console.error('创建大屏会话失败:', error);
            throw error;
        }
    }

    /**
     * 验证会话
     */
    async validateSession(sessionId) {
        try {
            const sessions = await this.loadSessions();
            const session = sessions.find(s => s.sessionId === sessionId && s.isActive);
            
            if (!session) {
                return null;
            }

            const now = Date.now();
            const lastActivity = new Date(session.lastActivity).getTime();
            
            // 检查会话是否过期
            if (now - lastActivity > this.sessionTimeout) {
                await this.invalidateSession(sessionId);
                return null;
            }

            // 更新最后活动时间
            session.lastActivity = new Date().toISOString();
            await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
            
            return session;
        } catch (error) {
            console.error('验证会话失败:', error);
            return null;
        }
    }

    /**
     * 使会话失效
     */
    async invalidateSession(sessionId) {
        try {
            const sessions = await this.loadSessions();
            const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
            
            if (sessionIndex !== -1) {
                sessions[sessionIndex].isActive = false;
                await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
            }
        } catch (error) {
            console.error('使会话失效失败:', error);
        }
    }

    /**
     * 加载用户数据
     */
    async loadUsers() {
        try {
            const data = await fs.readFile(this.usersFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('加载用户数据失败:', error);
            return [];
        }
    }

    /**
     * 加载会话数据
     */
    async loadSessions() {
        try {
            const data = await fs.readFile(this.sessionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('加载会话数据失败:', error);
            return [];
        }
    }

    /**
     * 加载大屏会话数据
     */
    async loadDisplaySessions() {
        try {
            const data = await fs.readFile(this.displaySessionsFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('加载大屏会话数据失败:', error);
            return [];
        }
    }

    /**
     * 用户认证
     */
    async authenticateUser(classKey, username, password) {
        try {
            const users = await this.loadUsers();
            const { classIsolation } = require('./classIsolation');
            const classInfo = await classIsolation.getClassByKey(classKey);
            
            if (!classInfo) {
                throw createError('RESOURCE_NOT_FOUND', '班级不存在');
            }

            const user = users.find(u => 
                u.username === username && 
                u.password === password && 
                u.classId === classInfo.id &&
                u.isActive
            );

            if (!user) {
                throw createError('INVALID_CREDENTIALS', '用户名或密码错误');
            }

            return user;
        } catch (error) {
            console.error('用户认证失败:', error);
            throw error;
        }
    }

    /**
     * 学生认证（仅需学号）
     */
    async authenticateStudent(classKey, studentNumber) {
        try {
            const users = await this.loadUsers();
            const { classIsolation } = require('./classIsolation');
            const classInfo = await classIsolation.getClassByKey(classKey);
            
            if (!classInfo) {
                throw createError('RESOURCE_NOT_FOUND', '班级不存在');
            }

            const student = users.find(u => 
                (u.classStudentNumber === studentNumber || u.fullStudentNumber === studentNumber) &&
                u.classId === classInfo.id &&
                u.role === 'student' &&
                u.isActive
            );

            if (!student) {
                throw createError('STUDENT_NOT_FOUND', '学号不存在');
            }

            return student;
        } catch (error) {
            console.error('学生认证失败:', error);
            throw error;
        }
    }
}

/**
 * 权限中间件工厂
 */
class PermissionMiddleware {
    constructor() {
        this.validator = new PermissionValidator();
    }

    /**
     * 要求教师权限
     */
    requireTeacher() {
        return async (req, res, next) => {
            try {
                const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.session?.sessionId;
                
                if (!sessionId) {
                    const error = createError('TOKEN_MISSING', '缺少访问令牌');
                    return next(error);
                }

                const session = await this.validator.validateSession(sessionId);
                if (!session) {
                    const error = createError('TOKEN_INVALID', '访问令牌无效或已过期');
                    return next(error);
                }

                if (session.userType !== 'admin' && session.userType !== 'teacher') {
                    const error = createError('TEACHER_REQUIRED', '需要教师权限');
                    return next(error);
                }

                req.userSession = session;
                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * 要求班主任权限
     */
    requireAdmin() {
        return async (req, res, next) => {
            try {
                const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.session?.sessionId;
                
                if (!sessionId) {
                    const error = createError('TOKEN_MISSING', '缺少访问令牌');
                    return next(error);
                }

                const session = await this.validator.validateSession(sessionId);
                if (!session) {
                    const error = createError('TOKEN_INVALID', '访问令牌无效或已过期');
                    return next(error);
                }

                if (session.userType !== 'admin') {
                    const error = createError('PERMISSION_DENIED', '需要班主任权限');
                    return next(error);
                }

                req.userSession = session;
                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * 要求学生权限
     */
    requireStudent() {
        return async (req, res, next) => {
            try {
                const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.session?.sessionId;
                
                if (!sessionId) {
                    const error = createError('TOKEN_MISSING', '缺少访问令牌');
                    return next(error);
                }

                const session = await this.validator.validateSession(sessionId);
                if (!session) {
                    const error = createError('TOKEN_INVALID', '访问令牌无效或已过期');
                    return next(error);
                }

                if (session.userType !== 'student') {
                    const error = createError('STUDENT_REQUIRED', '需要学生权限');
                    return next(error);
                }

                req.userSession = session;
                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * 验证大屏访问
     */
    requireDisplayAccess() {
        return async (req, res, next) => {
            try {
                const classKey = req.params.classKey;
                
                if (!classKey) {
                    const error = createError('VALIDATION_ERROR', '缺少班级标识');
                    return next(error);
                }

                const hasAccess = await this.validator.validateDisplayAccess(classKey);
                if (!hasAccess) {
                    const error = createError('PERMISSION_DENIED', '大屏未认证，请联系班主任');
                    return next(error);
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    /**
     * 可选认证（不强制要求登录）
     */
    optionalAuth() {
        return async (req, res, next) => {
            try {
                const sessionId = req.headers.authorization?.replace('Bearer ', '') || req.session?.sessionId;
                
                if (sessionId) {
                    const session = await this.validator.validateSession(sessionId);
                    if (session) {
                        req.userSession = session;
                    }
                }

                next();
            } catch (error) {
                // 可选认证失败不阻止请求
                next();
            }
        };
    }
}

// 创建全局实例
const permissionValidator = new PermissionValidator();
const permissionMiddleware = new PermissionMiddleware();

module.exports = {
    UserPermission,
    PermissionValidator,
    PermissionMiddleware,
    permissionValidator,
    permissionMiddleware
};