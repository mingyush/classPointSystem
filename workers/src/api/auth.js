/**
 * 认证API路由 - Cloudflare Workers版本
 * 实现用户登录、登出和令牌验证功能
 */

import { Router } from 'itty-router';
import { 
  generateToken, 
  verifyToken, 
  successResponse, 
  errorResponse, 
  parseRequestBody, 
  validateParams 
} from '../middleware/auth.js';
import { StudentService } from '../services/studentService.js';
import { ConfigService } from '../services/configService.js';

/**
 * 创建认证路由
 * @param {Object} env 环境变量
 * @returns {Router} 路由实例
 */
export function createAuthRouter(env) {
  const router = Router({ base: '/api/auth' });
  
  // 学生登录
  router.post('/student/login', async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        studentId: { required: true, type: 'string', minLength: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { studentId } = body;
      
      // 查找学生
      const studentService = new StudentService(env.DB);
      const student = await studentService.getStudentByStudentId(studentId);
      
      if (!student) {
        return errorResponse('Student not found', 404);
      }
      
      // 生成JWT令牌
      const payload = {
        id: student.id,
        studentId: student.studentId,
        name: student.name,
        role: 'student'
      };
      
      const jwtSecret = env.JWT_SECRET || 'your-secret-key';
      const token = await generateToken(payload, jwtSecret, { expiresIn: '24h' });
      
      return successResponse({
        token,
        user: {
          id: student.id,
          studentId: student.studentId,
          name: student.name,
          points: student.points,
          role: 'student'
        }
      });
    } catch (error) {
      console.error('Student login error:', error);
      return errorResponse('Login failed', 500);
    }
  });
  
  // 教师登录
  router.post('/teacher/login', async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        teacherId: { required: true, type: 'string', minLength: 1 },
        password: { required: true, type: 'string', minLength: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { teacherId, password } = body;
      
      // 查询教师信息
      const sql = 'SELECT * FROM teachers WHERE teacher_id = ?';
      const teacher = await env.DB.prepare(sql).bind(teacherId).first();
      
      if (!teacher) {
        return errorResponse('Teacher not found', 404);
      }
      
      // 验证密码（这里使用简单的明文比较，实际应用中应使用哈希）
      if (teacher.password !== password) {
        return errorResponse('Invalid password', 401);
      }
      
      // 生成JWT令牌
      const payload = {
        id: teacher.id,
        teacherId: teacher.teacher_id,
        name: teacher.name,
        role: 'teacher'
      };
      
      const jwtSecret = env.JWT_SECRET || 'your-secret-key';
      const token = await generateToken(payload, jwtSecret, { expiresIn: '24h' });
      
      return successResponse({
        token,
        user: {
          id: teacher.id,
          teacherId: teacher.teacher_id,
          name: teacher.name,
          role: 'teacher'
        }
      });
    } catch (error) {
      console.error('Teacher login error:', error);
      return errorResponse('Login failed', 500);
    }
  });
  
  // 验证令牌
  router.post('/verify', async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        token: { required: true, type: 'string', minLength: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { token } = body;
      const jwtSecret = env.JWT_SECRET || 'your-secret-key';
      
      // 验证令牌
      const payload = await verifyToken(token, jwtSecret);
      
      if (!payload) {
        return errorResponse('Invalid token', 401);
      }
      
      // 检查用户是否仍然存在
      if (payload.role === 'student') {
        const studentService = new StudentService(env.DB);
        const student = await studentService.getStudentById(payload.id);
        
        if (!student) {
          return errorResponse('Student not found', 404);
        }
        
        return successResponse({
          valid: true,
          user: {
            id: student.id,
            studentId: student.studentId,
            name: student.name,
            points: student.points,
            role: 'student'
          }
        });
      } else if (payload.role === 'teacher') {
        const sql = 'SELECT * FROM teachers WHERE id = ?';
        const teacher = await env.DB.prepare(sql).bind(payload.id).first();
        
        if (!teacher) {
          return errorResponse('Teacher not found', 404);
        }
        
        return successResponse({
          valid: true,
          user: {
            id: teacher.id,
            teacherId: teacher.teacher_id,
            name: teacher.name,
            role: 'teacher'
          }
        });
      }
      
      return errorResponse('Invalid user role', 400);
    } catch (error) {
      console.error('Token verification error:', error);
      return errorResponse('Token verification failed', 500);
    }
  });
  
  // 登出
  router.post('/logout', async (request) => {
    try {
      // 在无状态JWT系统中，登出主要是客户端删除令牌
      // 这里可以实现令牌黑名单功能（使用KV存储）
      
      return successResponse({
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return errorResponse('Logout failed', 500);
    }
  });
  
  // 刷新令牌
  router.post('/refresh', async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        token: { required: true, type: 'string', minLength: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { token } = body;
      const jwtSecret = env.JWT_SECRET || 'your-secret-key';
      
      // 验证旧令牌
      const payload = await verifyToken(token, jwtSecret);
      
      if (!payload) {
        return errorResponse('Invalid token', 401);
      }
      
      // 生成新令牌
      const newPayload = {
        id: payload.id,
        studentId: payload.studentId,
        teacherId: payload.teacherId,
        name: payload.name,
        role: payload.role
      };
      
      const newToken = await generateToken(newPayload, jwtSecret, { expiresIn: '24h' });
      
      return successResponse({
        token: newToken,
        user: {
          id: payload.id,
          studentId: payload.studentId,
          teacherId: payload.teacherId,
          name: payload.name,
          role: payload.role
        }
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      return errorResponse('Token refresh failed', 500);
    }
  });
  
  // 获取当前用户信息
  router.get('/me', async (request) => {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return errorResponse('Authentication required', 401);
      }
      
      const jwtSecret = env.JWT_SECRET || 'your-secret-key';
      const payload = await verifyToken(token, jwtSecret);
      
      if (!payload) {
        return errorResponse('Invalid token', 401);
      }
      
      // 获取最新用户信息
      if (payload.role === 'student') {
        const studentService = new StudentService(env.DB);
        const student = await studentService.getStudentById(payload.id);
        
        if (!student) {
          return errorResponse('Student not found', 404);
        }
        
        return successResponse({
          id: student.id,
          studentId: student.studentId,
          name: student.name,
          points: student.points,
          class: student.class,
          role: 'student'
        });
      } else if (payload.role === 'teacher') {
        const sql = 'SELECT * FROM teachers WHERE id = ?';
        const teacher = await env.DB.prepare(sql).bind(payload.id).first();
        
        if (!teacher) {
          return errorResponse('Teacher not found', 404);
        }
        
        return successResponse({
          id: teacher.id,
          teacherId: teacher.teacher_id,
          name: teacher.name,
          role: 'teacher'
        });
      }
      
      return errorResponse('Invalid user role', 400);
    } catch (error) {
      console.error('Get current user error:', error);
      return errorResponse('Failed to get user info', 500);
    }
  });
  
  // 修改密码（仅教师）
  router.post('/change-password', async (request) => {
    try {
      const authHeader = request.headers.get('Authorization');
      const token = authHeader && authHeader.split(' ')[1];
      
      if (!token) {
        return errorResponse('Authentication required', 401);
      }
      
      const jwtSecret = env.JWT_SECRET || 'your-secret-key';
      const payload = await verifyToken(token, jwtSecret);
      
      if (!payload || payload.role !== 'teacher') {
        return errorResponse('Teacher access required', 403);
      }
      
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        currentPassword: { required: true, type: 'string', minLength: 1 },
        newPassword: { required: true, type: 'string', minLength: 6 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { currentPassword, newPassword } = body;
      
      // 验证当前密码
      const sql = 'SELECT * FROM teachers WHERE id = ?';
      const teacher = await env.DB.prepare(sql).bind(payload.id).first();
      
      if (!teacher || teacher.password !== currentPassword) {
        return errorResponse('Current password is incorrect', 400);
      }
      
      // 更新密码
      const updateSql = 'UPDATE teachers SET password = ?, updated_at = ? WHERE id = ?';
      const result = await env.DB.prepare(updateSql)
        .bind(newPassword, new Date().toISOString(), payload.id)
        .run();
      
      if (!result.success) {
        return errorResponse('Failed to update password', 500);
      }
      
      return successResponse({
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      return errorResponse('Failed to change password', 500);
    }
  });
  
  return router;
}