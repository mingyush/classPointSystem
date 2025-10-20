/**
 * Cloudflare Workers - 系统管理 API
 */

import { createSuccessResponse, createErrorResponse, parseRequestBody, validateRequiredFields } from './index';
import { authenticateRequest, requireTeacher } from '../utils/auth';

/**
 * 处理系统相关 API 请求
 */
export async function handleSystemAPI(context) {
  const { pathname, method, dbAdapter } = context;
  
  try {
    // 获取系统状态
    if (pathname === '/api/system/state' && method === 'GET') {
      return await handleGetSystemState(context);
    }
    
    // 切换系统模式
    if (pathname === '/api/system/switch-mode' && method === 'POST') {
      return await handleSwitchMode(context);
    }
    
    // 获取系统信息
    if (pathname === '/api/system/info' && method === 'GET') {
      return await handleGetSystemInfo(context);
    }
    
    return createErrorResponse('系统 API 路由未找到', 404);
    
  } catch (error) {
    console.error('系统 API 处理错误:', error);
    return createErrorResponse('系统操作失败', 500, error.message);
  }
}

/**
 * 获取系统状态
 */
async function handleGetSystemState(context) {
  const { dbAdapter } = context;
  
  try {
    let systemState = await dbAdapter.getSystemState();
    
    // 如果没有系统状态记录，创建默认状态
    if (!systemState) {
      await dbAdapter.updateSystemState({
        mode: 'normal',
        current_teacher: null,
        session_start_time: null
      });
      
      systemState = {
        mode: 'normal',
        current_teacher: null,
        session_start_time: null,
        updated_at: new Date().toISOString()
      };
    }
    
    return createSuccessResponse({
      mode: systemState.mode || 'normal',
      currentTeacher: systemState.current_teacher,
      sessionStartTime: systemState.session_start_time,
      updatedAt: systemState.updated_at
    });
    
  } catch (error) {
    return createErrorResponse('获取系统状态失败', 500, error.message);
  }
}

/**
 * 切换系统模式
 */
async function handleSwitchMode(context) {
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
    validateRequiredFields(data, ['mode']);
    
    const { mode, teacherId } = data;
    
    // 验证模式值
    const validModes = ['normal', 'class'];
    if (!validModes.includes(mode)) {
      return createErrorResponse('无效的系统模式', 400);
    }
    
    // 准备更新数据
    const updates = {
      mode
    };
    
    if (mode === 'class') {
      // 切换到上课模式
      if (!teacherId) {
        return createErrorResponse('切换到上课模式时必须指定教师ID', 400);
      }
      
      // 验证教师是否存在
      const teacher = await dbAdapter.getUserById(teacherId);
      if (!teacher || teacher.role !== 'teacher') {
        return createErrorResponse('指定的教师不存在', 404);
      }
      
      updates.current_teacher = teacherId;
      updates.session_start_time = new Date().toISOString();
      
    } else {
      // 切换到平时模式
      updates.current_teacher = null;
      updates.session_start_time = null;
    }
    
    // 更新系统状态
    const success = await dbAdapter.updateSystemState(updates);
    
    if (success) {
      return createSuccessResponse({
        mode,
        currentTeacher: updates.current_teacher,
        sessionStartTime: updates.session_start_time,
        message: `系统已切换到${mode === 'class' ? '上课' : '平时'}模式`
      });
    } else {
      return createErrorResponse('切换系统模式失败', 500);
    }
    
  } catch (error) {
    return createErrorResponse('切换系统模式失败', 500, error.message);
  }
}

/**
 * 获取系统信息
 */
async function handleGetSystemInfo(context) {
  const { dbAdapter } = context;
  
  try {
    // 获取基本统计信息
    const [students, teachers, products, orders, pointRecords] = await Promise.all([
      dbAdapter.getUsers('student'),
      dbAdapter.getUsers('teacher'),
      dbAdapter.getProducts(false), // 包括不活跃的商品
      dbAdapter.getOrders({}),
      dbAdapter.getPointRecords({})
    ]);
    
    // 计算统计数据
    const activeStudents = students.filter(s => s.is_active).length;
    const activeProducts = products.filter(p => p.is_active).length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    
    // 计算积分统计
    const totalPoints = pointRecords.reduce((sum, record) => sum + record.amount, 0);
    const rewardPoints = pointRecords.filter(r => r.amount > 0).reduce((sum, r) => sum + r.amount, 0);
    const penaltyPoints = Math.abs(pointRecords.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0));
    
    // 获取系统状态
    const systemState = await dbAdapter.getSystemState();
    
    return createSuccessResponse({
      version: '1.0.0',
      deployment: 'cloudflare',
      statistics: {
        students: {
          total: students.length,
          active: activeStudents,
          inactive: students.length - activeStudents
        },
        teachers: {
          total: teachers.length
        },
        products: {
          total: products.length,
          active: activeProducts,
          inactive: products.length - activeProducts
        },
        orders: {
          total: orders.length,
          pending: pendingOrders,
          completed: completedOrders,
          cancelled: orders.filter(o => o.status === 'cancelled').length
        },
        points: {
          total: totalPoints,
          rewards: rewardPoints,
          penalties: penaltyPoints,
          records: pointRecords.length
        }
      },
      systemState: {
        mode: systemState?.mode || 'normal',
        currentTeacher: systemState?.current_teacher,
        sessionStartTime: systemState?.session_start_time,
        updatedAt: systemState?.updated_at
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return createErrorResponse('获取系统信息失败', 500, error.message);
  }
}