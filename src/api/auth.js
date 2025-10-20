/**
 * Cloudflare Workers - 认证管理 API
 */

import { createSuccessResponse, createErrorResponse, parseRequestBody, validateRequiredFields } from './index';
import { generateJWT, verifyJWT } from '../utils/auth';

/**
 * 处理认证相关 API 请求
 */
export async function handleAuthAPI(context) {
  const { pathname, method, dbAdapter } = context;
  
  try {
    // 学生登录
    if (pathname === '/api/auth/student-login' && method === 'POST') {
      return await handleStudentLogin(context);
    }
    
    // 教师登录
    if (pathname === '/api/auth/teacher-login' && method === 'POST') {
      return await handleTeacherLogin(context);
    }
    
    // 验证令牌
    if (pathname === '/api/auth/verify' && method === 'GET') {
      return await handleVerifyToken(context);
    }
    
    // 登出
    if (pathname === '/api/auth/logout' && method === 'POST') {
      return await handleLogout(context);
    }
    
    return createErrorResponse('认证 API 路由未找到', 404);
    
  } catch (error) {
    console.error('认证 API 处理错误:', error);
    return createErrorResponse('认证操作失败', 500, error.message);
  }
}

/**
 * 学生登录
 */
async function handleStudentLogin(context) {
  const { request, dbAdapter } = context;
  
  try {
    const data = await parseRequestBody(request);
    validateRequiredFields(data, ['studentId']);
    
    const { studentId } = data;
    
    // 参数验证
    if (!studentId.trim()) {
      return createErrorResponse('学号不能为空', 400);
    }
    
    // 验证学生是否存在
    const student = await dbAdapter.getUserById(studentId.trim());
    if (!student || student.role !== 'student' || !student.is_active) {
      return createErrorResponse('学号不存在或已被禁用', 401);
    }
    
    // 生成JWT令牌
    const token = await generateJWT({
      userId: student.id,
      userType: 'student',
      name: student.name,
      studentNumber: student.student_number
    });
    
    return createSuccessResponse({
      token,
      user: {
        id: student.id,
        name: student.name,
        userType: 'student',
        studentNumber: student.student_number
      },
      message: '学生登录成功'
    });
    
  } catch (error) {
    return createErrorResponse('学生登录失败', 500, error.message);
  }
}

/**
 * 教师登录
 */
async function handleTeacherLogin(context) {
  const { request, dbAdapter } = context;
  
  try {
    const data = await parseRequestBody(request);
    validateRequiredFields(data, ['teacherId', 'password']);
    
    const { teacherId, password } = data;
    
    // 参数验证
    if (!teacherId.trim()) {
      return createErrorResponse('教师ID不能为空', 400);
    }
    
    if (!password.trim()) {
      return createErrorResponse('密码不能为空', 400);
    }
    
    // 验证教师是否存在
    const teacher = await dbAdapter.getUserById(teacherId.trim());
    if (!teacher || teacher.role !== 'teacher' || !teacher.is_active) {
      return createErrorResponse('教师ID不存在或已被禁用', 401);
    }
    
    // 简化的密码验证（生产环境应使用更安全的方式）
    const defaultPassword = 'admin123';
    if (password !== defaultPassword) {
      return createErrorResponse('密码错误', 401);
    }
    
    // 生成JWT令牌
    const token = await generateJWT({
      userId: teacher.id,
      userType: 'teacher',
      name: teacher.name,
      role: teacher.role
    });
    
    return createSuccessResponse({
      token,
      user: {
        id: teacher.id,
        name: teacher.name,
        userType: 'teacher',
        role: teacher.role
      },
      message: '教师登录成功'
    });
    
  } catch (error) {
    return createErrorResponse('教师登录失败', 500, error.message);
  }
}

/**
 * 验证令牌
 */
async function handleVerifyToken(context) {
  const { request } = context;
  
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createErrorResponse('访问令牌缺失', 401);
    }
    
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token);
    
    if (!payload) {
      return createErrorResponse('访问令牌无效或已过期', 403);
    }
    
    return createSuccessResponse({
      user: payload,
      message: '令牌验证成功'
    });
    
  } catch (error) {
    return createErrorResponse('令牌验证失败', 403, error.message);
  }
}

/**
 * 登出
 */
async function handleLogout(context) {
  // 客户端删除令牌即可，服务端无需特殊处理
  return createSuccessResponse({
    message: '登出成功'
  });
}