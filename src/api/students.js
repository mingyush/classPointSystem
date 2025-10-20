/**
 * Cloudflare Workers - 学生管理 API
 */

import { createSuccessResponse, createErrorResponse, parseRequestBody, validateRequiredFields, generateId } from './index';
import { authenticateRequest, requireTeacher } from '../utils/auth';

/**
 * 处理学生相关 API 请求
 */
export async function handleStudentsAPI(context) {
  const { pathname, method, dbAdapter } = context;
  
  try {
    // 获取所有学生
    if (pathname === '/api/students' && method === 'GET') {
      return await handleGetAllStudents(context);
    }
    
    // 创建学生
    if (pathname === '/api/students' && method === 'POST') {
      return await handleCreateStudent(context);
    }
    
    // 获取单个学生信息
    if (pathname.match(/^\/api\/students\/([^\/]+)$/) && method === 'GET') {
      const studentId = pathname.split('/').pop();
      return await handleGetStudent(context, studentId);
    }
    
    // 更新学生信息
    if (pathname.match(/^\/api\/students\/([^\/]+)$/) && method === 'PUT') {
      const studentId = pathname.split('/').pop();
      return await handleUpdateStudent(context, studentId);
    }
    
    // 删除学生
    if (pathname.match(/^\/api\/students\/([^\/]+)$/) && method === 'DELETE') {
      const studentId = pathname.split('/').pop();
      return await handleDeleteStudent(context, studentId);
    }
    
    // 获取学生排名信息
    if (pathname.match(/^\/api\/students\/([^\/]+)\/rank$/) && method === 'GET') {
      const studentId = pathname.split('/')[3];
      return await handleGetStudentRank(context, studentId);
    }
    
    // 搜索学生
    if (pathname === '/api/students/search' && method === 'GET') {
      return await handleSearchStudents(context);
    }
    
    // 获取学生统计
    if (pathname === '/api/students/statistics' && method === 'GET') {
      return await handleGetStudentStatistics(context);
    }
    
    // 批量创建学生
    if (pathname === '/api/students/batch' && method === 'POST') {
      return await handleBatchCreateStudents(context);
    }
    
    return createErrorResponse('学生 API 路由未找到', 404);
    
  } catch (error) {
    console.error('学生 API 处理错误:', error);
    return createErrorResponse('学生操作失败', 500, error.message);
  }
}

/**
 * 获取所有学生信息
 */
async function handleGetAllStudents(context) {
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
    const students = await dbAdapter.getUsers('student');
    
    // 为每个学生计算积分余额
    const studentsWithBalance = await Promise.all(
      students.map(async (student) => {
        const balance = await dbAdapter.getStudentPointBalance(student.id);
        return {
          id: student.id,
          name: student.name,
          studentNumber: student.student_number,
          balance,
          isActive: student.is_active,
          createdAt: student.created_at
        };
      })
    );
    
    return createSuccessResponse({
      students: studentsWithBalance,
      total: studentsWithBalance.length
    });
    
  } catch (error) {
    return createErrorResponse('获取学生列表失败', 500, error.message);
  }
}

/**
 * 获取单个学生信息
 */
async function handleGetStudent(context, studentId) {
  const { request, dbAdapter } = context;
  
  // 验证权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  // 学生只能查看自己的信息
  if (authResult.user.userType === 'student' && authResult.user.userId !== studentId) {
    return createErrorResponse('学生只能查看自己的信息', 403);
  }
  
  try {
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 计算积分余额
    const balance = await dbAdapter.getStudentPointBalance(student.id);
    
    return createSuccessResponse({
      id: student.id,
      name: student.name,
      studentNumber: student.student_number,
      balance,
      isActive: student.is_active,
      createdAt: student.created_at
    });
    
  } catch (error) {
    return createErrorResponse('获取学生信息失败', 500, error.message);
  }
}

/**
 * 创建新学生
 */
async function handleCreateStudent(context) {
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
    validateRequiredFields(data, ['id', 'name']);
    
    const { id, name, balance = 0 } = data;
    
    // 参数验证
    if (!id.trim()) {
      return createErrorResponse('学号不能为空', 400);
    }
    
    if (!name.trim()) {
      return createErrorResponse('姓名不能为空', 400);
    }
    
    if (typeof balance !== 'number' || balance < 0) {
      return createErrorResponse('初始积分必须为非负数', 400);
    }
    
    // 检查学号是否已存在
    const existingStudent = await dbAdapter.getUserById(id.trim());
    if (existingStudent) {
      return createErrorResponse('学号已存在', 409);
    }
    
    // 创建学生
    const student = await dbAdapter.createUser({
      id: id.trim(),
      username: id.trim(),
      name: name.trim(),
      role: 'student',
      studentNumber: id.trim(),
      isActive: 1
    });
    
    // 如果有初始积分，创建积分记录
    if (balance > 0) {
      const recordId = generateId('pt_');
      await dbAdapter.createPointRecord({
        id: recordId,
        studentId: student.id,
        teacherId: authResult.user.userId,
        amount: balance,
        reason: '初始积分',
        type: 'manual'
      });
    }
    
    return createSuccessResponse({
      id: student.id,
      name: student.name,
      studentNumber: student.student_number,
      balance,
      isActive: student.is_active,
      createdAt: student.created_at
    }, 201);
    
  } catch (error) {
    return createErrorResponse('创建学生失败', 500, error.message);
  }
}

/**
 * 更新学生信息
 */
async function handleUpdateStudent(context, studentId) {
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
    
    // 不允许更新学号
    if (data.id && data.id !== studentId) {
      return createErrorResponse('不能修改学号', 400);
    }
    
    // 验证学生是否存在
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 准备更新数据
    const updates = {};
    if (data.name && data.name.trim()) {
      updates.name = data.name.trim();
    }
    if (typeof data.isActive === 'boolean') {
      updates.isActive = data.isActive;
    }
    
    if (Object.keys(updates).length === 0) {
      return createErrorResponse('没有需要更新的字段', 400);
    }
    
    // 更新学生信息
    const updatedStudent = await dbAdapter.updateUser(studentId, updates);
    
    // 计算积分余额
    const balance = await dbAdapter.getStudentPointBalance(studentId);
    
    return createSuccessResponse({
      id: updatedStudent.id,
      name: updatedStudent.name,
      studentNumber: updatedStudent.student_number,
      balance,
      isActive: updatedStudent.is_active,
      createdAt: updatedStudent.created_at
    });
    
  } catch (error) {
    return createErrorResponse('更新学生信息失败', 500, error.message);
  }
}

/**
 * 删除学生
 */
async function handleDeleteStudent(context, studentId) {
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
    // 验证学生是否存在
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 软删除学生（设置为不活跃）
    const success = await dbAdapter.deleteUser(studentId);
    
    if (success) {
      return createSuccessResponse({ message: '删除学生成功' });
    } else {
      return createErrorResponse('删除学生失败', 500);
    }
    
  } catch (error) {
    return createErrorResponse('删除学生失败', 500, error.message);
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
    return createErrorResponse('学生只能查看自己的排名信息', 403);
  }
  
  try {
    // 获取学生信息
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 获取积分余额
    const balance = await dbAdapter.getStudentPointBalance(studentId);
    
    // 获取排名
    const totalRankings = await dbAdapter.getPointRankings('total', 1000);
    const dailyRankings = await dbAdapter.getPointRankings('daily', 1000);
    const weeklyRankings = await dbAdapter.getPointRankings('weekly', 1000);
    
    const totalRank = totalRankings.findIndex(r => r.id === studentId) + 1;
    const dailyRank = dailyRankings.findIndex(r => r.id === studentId) + 1;
    const weeklyRank = weeklyRankings.findIndex(r => r.id === studentId) + 1;
    
    return createSuccessResponse({
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.student_number,
        balance
      },
      rankings: {
        total: totalRank || null,
        daily: dailyRank || null,
        weekly: weeklyRank || null
      },
      totalStudents: totalRankings.length
    });
    
  } catch (error) {
    return createErrorResponse('获取排名信息失败', 500, error.message);
  }
}

/**
 * 搜索学生
 */
async function handleSearchStudents(context) {
  const { request, dbAdapter, searchParams } = context;
  
  // 验证教师权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  const teacherCheck = requireTeacher(authResult.user);
  if (!teacherCheck.success) {
    return createErrorResponse(teacherCheck.message, 403);
  }
  
  const keyword = searchParams.get('keyword');
  if (!keyword || !keyword.trim()) {
    return createErrorResponse('搜索关键词不能为空', 400);
  }
  
  try {
    // 简化的搜索实现：获取所有学生然后过滤
    const allStudents = await dbAdapter.getUsers('student');
    const filteredStudents = allStudents.filter(student => 
      student.name.includes(keyword.trim()) || 
      student.student_number.includes(keyword.trim())
    );
    
    // 为搜索结果计算积分余额
    const studentsWithBalance = await Promise.all(
      filteredStudents.map(async (student) => {
        const balance = await dbAdapter.getStudentPointBalance(student.id);
        return {
          id: student.id,
          name: student.name,
          studentNumber: student.student_number,
          balance,
          isActive: student.is_active
        };
      })
    );
    
    return createSuccessResponse({
      keyword: keyword.trim(),
      students: studentsWithBalance,
      total: studentsWithBalance.length
    });
    
  } catch (error) {
    return createErrorResponse('搜索学生失败', 500, error.message);
  }
}

/**
 * 获取学生统计信息
 */
async function handleGetStudentStatistics(context) {
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
    const students = await dbAdapter.getUsers('student');
    const activeStudents = students.filter(s => s.is_active);
    
    // 计算积分统计
    const balances = await Promise.all(
      activeStudents.map(student => dbAdapter.getStudentPointBalance(student.id))
    );
    
    const totalPoints = balances.reduce((sum, balance) => sum + balance, 0);
    const averagePoints = activeStudents.length > 0 ? Math.round(totalPoints / activeStudents.length) : 0;
    const maxPoints = Math.max(...balances, 0);
    const minPoints = Math.min(...balances, 0);
    
    return createSuccessResponse({
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      inactiveStudents: students.length - activeStudents.length,
      totalPoints,
      averagePoints,
      maxPoints,
      minPoints
    });
    
  } catch (error) {
    return createErrorResponse('获取学生统计失败', 500, error.message);
  }
}

/**
 * 批量创建学生
 */
async function handleBatchCreateStudents(context) {
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
    validateRequiredFields(data, ['students']);
    
    const { students } = data;
    
    if (!Array.isArray(students) || students.length === 0) {
      return createErrorResponse('学生列表不能为空', 400);
    }
    
    if (students.length > 100) {
      return createErrorResponse('批量创建不能超过100个学生', 400);
    }
    
    const results = {
      success: [],
      failed: []
    };
    
    // 逐个创建学生
    for (const studentData of students) {
      try {
        validateRequiredFields(studentData, ['id', 'name']);
        
        const { id, name, balance = 0 } = studentData;
        
        // 检查学号是否已存在
        const existingStudent = await dbAdapter.getUserById(id.trim());
        if (existingStudent) {
          results.failed.push({
            id: id.trim(),
            name: name.trim(),
            error: '学号已存在'
          });
          continue;
        }
        
        // 创建学生
        const student = await dbAdapter.createUser({
          id: id.trim(),
          username: id.trim(),
          name: name.trim(),
          role: 'student',
          studentNumber: id.trim(),
          isActive: 1
        });
        
        // 如果有初始积分，创建积分记录
        if (balance > 0) {
          const recordId = generateId('pt_');
          await dbAdapter.createPointRecord({
            id: recordId,
            studentId: student.id,
            teacherId: authResult.user.userId,
            amount: balance,
            reason: '初始积分',
            type: 'manual'
          });
        }
        
        results.success.push({
          id: student.id,
          name: student.name,
          studentNumber: student.student_number,
          balance
        });
        
      } catch (error) {
        results.failed.push({
          id: studentData.id || 'unknown',
          name: studentData.name || 'unknown',
          error: error.message
        });
      }
    }
    
    return createSuccessResponse({
      successful: results.success.length,
      failed: results.failed.length,
      results
    });
    
  } catch (error) {
    return createErrorResponse('批量创建学生失败', 500, error.message);
  }
}