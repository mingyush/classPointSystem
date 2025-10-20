/**
 * Cloudflare Workers - 积分管理 API
 */

import { createSuccessResponse, createErrorResponse, parseRequestBody, validateRequiredFields, generateId } from './index';
import { authenticateRequest, requireTeacher } from '../utils/auth';

/**
 * 处理积分相关 API 请求
 */
export async function handlePointsAPI(context) {
  const { pathname, method, dbAdapter } = context;
  
  try {
    // 获取积分排行榜
    if (pathname === '/api/points/rankings/all' && method === 'GET') {
      return await handleGetAllRankings(context);
    }
    
    if (pathname.match(/^\/api\/points\/rankings\/(\w+)$/) && method === 'GET') {
      const type = pathname.split('/').pop();
      return await handleGetRanking(context, type);
    }
    
    // 添加积分
    if (pathname === '/api/points/add' && method === 'POST') {
      return await handleAddPoints(context);
    }
    
    // 减分
    if (pathname === '/api/points/subtract' && method === 'POST') {
      return await handleSubtractPoints(context);
    }
    
    // 获取学生积分历史
    if (pathname.match(/^\/api\/points\/history\/(.+)$/) && method === 'GET') {
      const studentId = pathname.split('/').pop();
      return await handleGetPointHistory(context, studentId);
    }
    
    // 获取学生排名
    if (pathname.match(/^\/api\/points\/rank\/(.+)$/) && method === 'GET') {
      const studentId = pathname.split('/').pop();
      return await handleGetStudentRank(context, studentId);
    }
    
    // 获取积分统计
    if (pathname === '/api/points/statistics' && method === 'GET') {
      return await handleGetStatistics(context);
    }
    
    return createErrorResponse('积分 API 路由未找到', 404);
    
  } catch (error) {
    console.error('积分 API 处理错误:', error);
    return createErrorResponse('积分操作失败', 500, error.message);
  }
}

/**
 * 获取所有类型的排行榜
 */
async function handleGetAllRankings(context) {
  const { dbAdapter, searchParams } = context;
  const limit = parseInt(searchParams.get('limit')) || 50;
  
  if (limit < 1 || limit > 100) {
    return createErrorResponse('限制数量必须为1-100之间的数字', 400);
  }
  
  try {
    const [totalRankings, dailyRankings, weeklyRankings] = await Promise.all([
      dbAdapter.getPointRankings('total', limit),
      dbAdapter.getPointRankings('daily', limit),
      dbAdapter.getPointRankings('weekly', limit)
    ]);
    
    return createSuccessResponse({
      total: totalRankings,
      daily: dailyRankings,
      weekly: weeklyRankings
    });
    
  } catch (error) {
    return createErrorResponse('获取排行榜失败', 500, error.message);
  }
}

/**
 * 获取特定类型的排行榜
 */
async function handleGetRanking(context, type) {
  const { dbAdapter, searchParams } = context;
  const limit = parseInt(searchParams.get('limit')) || 50;
  
  const validTypes = ['total', 'daily', 'weekly'];
  if (!validTypes.includes(type)) {
    return createErrorResponse('无效的排行榜类型', 400);
  }
  
  if (limit < 1 || limit > 100) {
    return createErrorResponse('限制数量必须为1-100之间的数字', 400);
  }
  
  try {
    const rankings = await dbAdapter.getPointRankings(type, limit);
    return createSuccessResponse(rankings);
    
  } catch (error) {
    return createErrorResponse('获取排行榜失败', 500, error.message);
  }
}

/**
 * 添加积分
 */
async function handleAddPoints(context) {
  const { request, dbAdapter } = context;
  
  // 验证教师权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  const teacherCheck = requireTeacher(authResult.user);
  if (!teacherCheck.success) {
    return createErrorResponse(teacherCheck.message, 403);
  }
  
  try {
    const data = await parseRequestBody(request);
    validateRequiredFields(data, ['studentId', 'points', 'reason']);
    
    const { studentId, points, reason } = data;
    
    // 参数验证
    if (typeof points !== 'number' || points <= 0) {
      return createErrorResponse('加分数量必须为正数', 400);
    }
    
    if (points > 100) {
      return createErrorResponse('单次加分不能超过100分', 400);
    }
    
    if (!reason.trim()) {
      return createErrorResponse('加分原因不能为空', 400);
    }
    
    // 验证学生是否存在
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 创建积分记录
    const recordId = generateId('pt_');
    await dbAdapter.createPointRecord({
      id: recordId,
      studentId: studentId,
      teacherId: authResult.user.userId,
      amount: points,
      reason: reason.trim(),
      type: 'reward'
    });
    
    // 获取更新后的余额
    const newBalance = await dbAdapter.getStudentPointBalance(studentId);
    
    return createSuccessResponse({
      recordId,
      studentId,
      points,
      reason: reason.trim(),
      newBalance,
      operatorId: authResult.user.userId
    });
    
  } catch (error) {
    return createErrorResponse('加分操作失败', 500, error.message);
  }
}

/**
 * 减分
 */
async function handleSubtractPoints(context) {
  const { request, dbAdapter } = context;
  
  // 验证教师权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  const teacherCheck = requireTeacher(authResult.user);
  if (!teacherCheck.success) {
    return createErrorResponse(teacherCheck.message, 403);
  }
  
  try {
    const data = await parseRequestBody(request);
    validateRequiredFields(data, ['studentId', 'points', 'reason']);
    
    const { studentId, points, reason } = data;
    
    // 参数验证
    if (typeof points !== 'number' || points <= 0) {
      return createErrorResponse('减分数量必须为正数', 400);
    }
    
    if (points > 100) {
      return createErrorResponse('单次减分不能超过100分', 400);
    }
    
    if (!reason.trim()) {
      return createErrorResponse('减分原因不能为空', 400);
    }
    
    // 验证学生是否存在
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 创建积分记录（负数表示减分）
    const recordId = generateId('pt_');
    await dbAdapter.createPointRecord({
      id: recordId,
      studentId: studentId,
      teacherId: authResult.user.userId,
      amount: -points,
      reason: reason.trim(),
      type: 'penalty'
    });
    
    // 获取更新后的余额
    const newBalance = await dbAdapter.getStudentPointBalance(studentId);
    
    return createSuccessResponse({
      recordId,
      studentId,
      points: -points,
      reason: reason.trim(),
      newBalance,
      operatorId: authResult.user.userId
    });
    
  } catch (error) {
    return createErrorResponse('减分操作失败', 500, error.message);
  }
}

/**
 * 获取学生积分历史
 */
async function handleGetPointHistory(context, studentId) {
  const { request, dbAdapter, searchParams } = context;
  const limit = parseInt(searchParams.get('limit')) || 20;
  
  // 验证权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  // 学生只能查看自己的记录
  if (authResult.user.userType === 'student' && authResult.user.userId !== studentId) {
    return createErrorResponse('只能查看自己的积分记录', 403);
  }
  
  if (limit < 1 || limit > 100) {
    return createErrorResponse('限制数量必须为1-100之间的数字', 400);
  }
  
  try {
    const records = await dbAdapter.getPointRecords({
      studentId,
      limit
    });
    
    return createSuccessResponse({
      studentId,
      records,
      total: records.length
    });
    
  } catch (error) {
    return createErrorResponse('获取积分历史失败', 500, error.message);
  }
}

/**
 * 获取学生排名信息
 */
async function handleGetStudentRank(context, studentId) {
  const { request, dbAdapter } = context;
  
  // 验证权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  // 学生只能查看自己的排名
  if (authResult.user.userType === 'student' && authResult.user.userId !== studentId) {
    return createErrorResponse('只能查看自己的排名信息', 403);
  }
  
  try {
    // 获取学生信息
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 获取积分余额
    const balance = await dbAdapter.getStudentPointBalance(studentId);
    
    // 获取排名（简化版本，实际应该计算准确排名）
    const totalRankings = await dbAdapter.getPointRankings('total', 1000);
    const rank = totalRankings.findIndex(r => r.id === studentId) + 1;
    
    return createSuccessResponse({
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.student_number,
        balance
      },
      rank: rank || null,
      totalStudents: totalRankings.length
    });
    
  } catch (error) {
    return createErrorResponse('获取排名信息失败', 500, error.message);
  }
}

/**
 * 获取积分统计信息
 */
async function handleGetStatistics(context) {
  const { request, dbAdapter } = context;
  
  // 验证教师权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  const teacherCheck = requireTeacher(authResult.user);
  if (!teacherCheck.success) {
    return createErrorResponse(teacherCheck.message, 403);
  }
  
  try {
    // 获取基本统计信息
    const students = await dbAdapter.getUsers('student');
    const totalStudents = students.length;
    
    // 获取积分记录统计
    const allRecords = await dbAdapter.getPointRecords();
    const totalRecords = allRecords.length;
    
    // 计算总积分
    const totalPoints = allRecords.reduce((sum, record) => sum + record.amount, 0);
    
    // 按类型统计
    const recordsByType = allRecords.reduce((acc, record) => {
      acc[record.type] = (acc[record.type] || 0) + 1;
      return acc;
    }, {});
    
    return createSuccessResponse({
      totalStudents,
      totalRecords,
      totalPoints,
      recordsByType,
      averagePointsPerStudent: totalStudents > 0 ? Math.round(totalPoints / totalStudents) : 0
    });
    
  } catch (error) {
    return createErrorResponse('获取积分统计失败', 500, error.message);
  }
}