/**
 * Cloudflare Workers - 订单管理 API
 */

import { createSuccessResponse, createErrorResponse, parseRequestBody, validateRequiredFields, generateId } from './index';
import { authenticateRequest, requireTeacher } from '../utils/auth';

/**
 * 处理订单相关 API 请求
 */
export async function handleOrdersAPI(context) {
  const { pathname, method, dbAdapter } = context;
  
  try {
    // 获取所有订单
    if (pathname === '/api/orders' && method === 'GET') {
      return await handleGetAllOrders(context);
    }
    
    // 创建订单
    if (pathname === '/api/orders' && method === 'POST') {
      return await handleCreateOrder(context);
    }
    
    // 获取单个订单信息
    if (pathname.match(/^\/api\/orders\/([^\/]+)$/) && method === 'GET') {
      const orderId = pathname.split('/').pop();
      return await handleGetOrder(context, orderId);
    }
    
    // 更新订单状态
    if (pathname.match(/^\/api\/orders\/([^\/]+)\/status$/) && method === 'PUT') {
      const orderId = pathname.split('/')[3];
      return await handleUpdateOrderStatus(context, orderId);
    }
    
    // 取消订单
    if (pathname.match(/^\/api\/orders\/([^\/]+)\/cancel$/) && method === 'POST') {
      const orderId = pathname.split('/')[3];
      return await handleCancelOrder(context, orderId);
    }
    
    return createErrorResponse('订单 API 路由未找到', 404);
    
  } catch (error) {
    console.error('订单 API 处理错误:', error);
    return createErrorResponse('订单操作失败', 500, error.message);
  }
}

/**
 * 获取所有订单信息
 */
async function handleGetAllOrders(context) {
  const { request, dbAdapter, searchParams } = context;
  
  // 验证权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  try {
    const filters = {};
    
    // 学生只能查看自己的订单
    if (authResult.user.userType === 'student') {
      filters.studentId = authResult.user.userId;
    }
    
    // 根据查询参数过滤
    const status = searchParams.get('status');
    if (status) {
      filters.status = status;
    }
    
    const studentId = searchParams.get('studentId');
    if (studentId && authResult.user.userType === 'teacher') {
      filters.studentId = studentId;
    }
    
    const limit = parseInt(searchParams.get('limit')) || 100;
    if (limit > 0 && limit <= 1000) {
      filters.limit = limit;
    }
    
    const orders = await dbAdapter.getOrders(filters);
    
    return createSuccessResponse({
      orders: orders.map(order => ({
        id: order.id,
        studentId: order.student_id,
        studentName: order.student_name,
        productId: order.product_id,
        productName: order.product_name,
        quantity: order.quantity,
        totalPrice: order.total_price,
        status: order.status,
        createdAt: order.created_at,
        confirmedAt: order.confirmed_at,
        completedAt: order.completed_at
      })),
      total: orders.length
    });
    
  } catch (error) {
    return createErrorResponse('获取订单列表失败', 500, error.message);
  }
}

/**
 * 获取单个订单信息
 */
async function handleGetOrder(context, orderId) {
  const { request, dbAdapter } = context;
  
  // 验证权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  try {
    const orders = await dbAdapter.getOrders({ limit: 1 });
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return createErrorResponse('订单不存在', 404);
    }
    
    // 学生只能查看自己的订单
    if (authResult.user.userType === 'student' && order.student_id !== authResult.user.userId) {
      return createErrorResponse('只能查看自己的订单', 403);
    }
    
    return createSuccessResponse({
      id: order.id,
      studentId: order.student_id,
      studentName: order.student_name,
      productId: order.product_id,
      productName: order.product_name,
      quantity: order.quantity,
      totalPrice: order.total_price,
      status: order.status,
      createdAt: order.created_at,
      confirmedAt: order.confirmed_at,
      completedAt: order.completed_at
    });
    
  } catch (error) {
    return createErrorResponse('获取订单信息失败', 500, error.message);
  }
}

/**
 * 创建新订单
 */
async function handleCreateOrder(context) {
  const { request, dbAdapter } = context;
  
  // 验证权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  try {
    const data = await parseRequestBody(request);
    validateRequiredFields(data, ['productId', 'quantity']);
    
    const { productId, quantity } = data;
    let { studentId } = data;
    
    // 学生只能为自己创建订单
    if (authResult.user.userType === 'student') {
      studentId = authResult.user.userId;
    } else if (!studentId) {
      return createErrorResponse('教师创建订单时必须指定学生ID', 400);
    }
    
    // 参数验证
    if (typeof quantity !== 'number' || quantity <= 0 || quantity > 100) {
      return createErrorResponse('订单数量必须为1-100之间的正整数', 400);
    }
    
    // 验证学生是否存在
    const student = await dbAdapter.getUserById(studentId);
    if (!student || student.role !== 'student') {
      return createErrorResponse('学生不存在', 404);
    }
    
    // 验证商品是否存在且可用
    const product = await dbAdapter.getProductById(productId);
    if (!product || !product.is_active) {
      return createErrorResponse('商品不存在或已下架', 404);
    }
    
    // 检查库存
    if (product.stock < quantity) {
      return createErrorResponse('商品库存不足', 409);
    }
    
    // 计算总价
    const totalPrice = product.price * quantity;
    
    // 检查学生积分是否足够
    const studentBalance = await dbAdapter.getStudentPointBalance(studentId);
    if (studentBalance < totalPrice) {
      return createErrorResponse('积分不足，无法预约', 409);
    }
    
    // 检查是否已有相同商品的待处理订单
    const existingOrders = await dbAdapter.getOrders({
      studentId,
      status: 'pending'
    });
    
    const duplicateOrder = existingOrders.find(order => order.product_id === productId);
    if (duplicateOrder) {
      return createErrorResponse('该商品已有待处理的预约订单', 409);
    }
    
    // 创建订单
    const orderId = generateId('ord_');
    const order = await dbAdapter.createOrder({
      id: orderId,
      studentId,
      productId,
      quantity,
      totalPrice
    });
    
    // 减少商品库存（预约时就减少库存）
    await dbAdapter.updateProduct(productId, {
      stock: product.stock - quantity
    });
    
    return createSuccessResponse({
      id: orderId,
      studentId,
      productId,
      quantity,
      totalPrice,
      status: 'pending',
      message: '预约订单创建成功'
    }, 201);
    
  } catch (error) {
    return createErrorResponse('创建订单失败', 500, error.message);
  }
}

/**
 * 更新订单状态
 */
async function handleUpdateOrderStatus(context, orderId) {
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
    validateRequiredFields(data, ['status']);
    
    const { status } = data;
    
    // 验证状态值
    const validStatuses = ['confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return createErrorResponse('无效的订单状态', 400);
    }
    
    // 获取订单信息
    const orders = await dbAdapter.getOrders({ limit: 1000 });
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return createErrorResponse('订单不存在', 404);
    }
    
    // 检查状态转换是否合法
    if (order.status === 'completed' || order.status === 'cancelled') {
      return createErrorResponse('订单已完成或已取消，无法修改状态', 409);
    }
    
    // 如果是完成订单，需要扣除学生积分
    if (status === 'completed') {
      // 创建积分扣除记录
      const recordId = generateId('pt_');
      await dbAdapter.createPointRecord({
        id: recordId,
        studentId: order.student_id,
        teacherId: authResult.user.userId,
        amount: -order.total_price,
        reason: `兑换商品: ${order.product_name}`,
        type: 'purchase'
      });
    }
    
    // 如果是取消订单，需要恢复商品库存
    if (status === 'cancelled') {
      const product = await dbAdapter.getProductById(order.product_id);
      if (product) {
        await dbAdapter.updateProduct(order.product_id, {
          stock: product.stock + order.quantity
        });
      }
    }
    
    // 更新订单状态
    const success = await dbAdapter.updateOrderStatus(orderId, status, authResult.user.userId);
    
    if (success) {
      return createSuccessResponse({
        orderId,
        status,
        message: `订单状态已更新为: ${status}`
      });
    } else {
      return createErrorResponse('更新订单状态失败', 500);
    }
    
  } catch (error) {
    return createErrorResponse('更新订单状态失败', 500, error.message);
  }
}

/**
 * 取消订单
 */
async function handleCancelOrder(context, orderId) {
  const { request, dbAdapter } = context;
  
  // 验证权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  try {
    // 获取订单信息
    const orders = await dbAdapter.getOrders({ limit: 1000 });
    const order = orders.find(o => o.id === orderId);
    
    if (!order) {
      return createErrorResponse('订单不存在', 404);
    }
    
    // 学生只能取消自己的订单
    if (authResult.user.userType === 'student' && order.student_id !== authResult.user.userId) {
      return createErrorResponse('只能取消自己的订单', 403);
    }
    
    // 检查订单状态
    if (order.status !== 'pending') {
      return createErrorResponse('只能取消待处理的订单', 409);
    }
    
    // 恢复商品库存
    const product = await dbAdapter.getProductById(order.product_id);
    if (product) {
      await dbAdapter.updateProduct(order.product_id, {
        stock: product.stock + order.quantity
      });
    }
    
    // 更新订单状态为已取消
    const success = await dbAdapter.updateOrderStatus(orderId, 'cancelled');
    
    if (success) {
      return createSuccessResponse({
        orderId,
        message: '订单已取消'
      });
    } else {
      return createErrorResponse('取消订单失败', 500);
    }
    
  } catch (error) {
    return createErrorResponse('取消订单失败', 500, error.message);
  }
}