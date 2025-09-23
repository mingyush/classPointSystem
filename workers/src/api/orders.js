/**
 * 订单API路由 - Cloudflare Workers版本
 * 实现订单管理和商品兑换功能
 */

import { Router } from 'itty-router';
import { OrderService } from '../services/order.js';
import { ProductService } from '../services/product.js';
import { StudentService } from '../services/student.js';
import { PointsService } from '../services/points.js';
import { authenticateToken, requireAuth, requireTeacher } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { PerformanceMiddleware } from '../middleware/performance.js';
import { CACHE_STRATEGIES, CacheKeyGenerator } from '../cache/cache-manager.js';

export async function handleOrdersAPI(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  // 初始化服务
  const orderService = new OrderService(env.DB);
  const productService = new ProductService(env.DB);
  const studentService = new StudentService(env.DB);
  const pointsService = new PointsService(env.DB);
  
  // 初始化性能中间件
  const performance = new PerformanceMiddleware(env);
  
  // 创建并处理路由
  const router = createOrdersRouter(env);
  return router.handle(request, env, ctx);
}

/**
 * 创建订单路由
 * @param {Object} env 环境变量
 * @returns {Router} 路由实例
 */
export function createOrdersRouter(env) {
  const router = Router({ base: '/api/orders' });
  
  // 获取所有订单列表
  router.get('/', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('orders:list'),
    performance.cacheMiddleware(
      (request) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const status = url.searchParams.get('status') || '';
        const studentId = url.searchParams.get('studentId') || '';
        const productId = url.searchParams.get('productId') || '';
        // 如果是学生用户，只能查看自己的订单
        const finalStudentId = request.user.role === 'student' ? request.user.id.toString() : studentId;
        return CacheKeyGenerator.orderList(page, limit) +
               (status ? `:status:${status}` : '') +
               (finalStudentId ? `:student:${finalStudentId}` : '') +
               (productId ? `:product:${productId}` : '');
      },
      CACHE_STRATEGIES.ORDERS
    ),
    async (request) => {
      try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const studentId = url.searchParams.get('studentId') || '';
        const productId = url.searchParams.get('productId') || '';
        const status = url.searchParams.get('status') || '';
        const startDate = url.searchParams.get('startDate') || '';
        const endDate = url.searchParams.get('endDate') || '';
        const sortBy = url.searchParams.get('sortBy') || 'created_at';
        const sortOrder = url.searchParams.get('sortOrder') || 'desc';
        
        const orderService = new OrderService(env.DB);
        
        // 如果是学生用户，只能查看自己的订单
        let finalStudentId = studentId;
        if (request.user.role === 'student') {
          finalStudentId = request.user.id.toString();
        }
        
        const result = await orderService.getAllOrders({
          page,
          limit,
          studentId: finalStudentId,
          productId,
          status,
          startDate,
          endDate,
          sortBy,
          sortOrder
        });
        
        return successResponse({
          orders: result.orders,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
          }
        });
      } catch (error) {
        console.error('Get orders error:', error);
        return errorResponse('Failed to get orders', 500);
      }
    }
  );
  
  // 获取单个订单信息
  router.get('/:id', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('orders:get'),
    performance.cacheMiddleware(
      (request) => CacheKeyGenerator.order(request.params.id),
      CACHE_STRATEGIES.ORDERS
    ),
    async (request) => {
      try {
        const { id } = request.params;
        
        if (!id || isNaN(parseInt(id))) {
          return errorResponse('Invalid order ID', 400);
        }
        
        const orderService = new OrderService(env.DB);
        const order = await orderService.getOrderById(parseInt(id));
        
        if (!order) {
          return errorResponse('Order not found', 404);
        }
        
        // 检查权限：学生只能查看自己的订单
        if (request.user.role === 'student' && request.user.id !== order.student_id) {
          return errorResponse('Access denied', 403);
        }
        
        return successResponse(order);
      } catch (error) {
        console.error('Get order error:', error);
        return errorResponse('Failed to get order', 500);
      }
    }
  );
  
  // 创建新订单（学生兑换商品）
  router.post('/', authenticateToken(env), requireAuth, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        productId: { required: true, type: 'number', min: 1 },
        quantity: { required: true, type: 'number', min: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { productId, quantity } = body;
      
      const orderService = new OrderService(env.DB);
      const productService = new ProductService(env.DB);
      const studentService = new StudentService(env.DB);
      
      // 检查商品是否存在且可用
      const product = await productService.getProductById(productId);
      if (!product || product.deleted_at) {
        return errorResponse('Product not found or unavailable', 404);
      }
      
      // 检查库存是否足够
      if (product.stock < quantity) {
        return errorResponse('Insufficient stock', 400);
      }
      
      // 检查学生积分是否足够
      const student = await studentService.getStudentById(request.user.id);
      if (!student) {
        return errorResponse('Student not found', 404);
      }
      
      const totalCost = product.price * quantity;
      if (student.points < totalCost) {
        return errorResponse('Insufficient points', 400);
      }
      
      const orderData = {
        studentId: request.user.id,
        productId,
        quantity,
        unitPrice: product.price,
        totalPrice: totalCost,
        status: 'pending'
      };
      
      const order = await orderService.createOrder(orderData);
      
      return successResponse(order, 201);
    } catch (error) {
      console.error('Create order error:', error);
      return errorResponse('Failed to create order', 500);
    }
  });
  
  // 更新订单状态（仅教师）
  router.patch('/:id/status', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid order ID', 400);
      }
      
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        status: { required: true, type: 'string', enum: ['pending', 'confirmed', 'delivered', 'cancelled'] }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { status } = body;
      
      const orderService = new OrderService(env.DB);
      
      // 检查订单是否存在
      const existingOrder = await orderService.getOrderById(parseInt(id));
      if (!existingOrder) {
        return errorResponse('Order not found', 404);
      }
      
      const order = await orderService.updateOrderStatus(parseInt(id), status);
      
      return successResponse(order);
    } catch (error) {
      console.error('Update order status error:', error);
      return errorResponse('Failed to update order status', 500);
    }
  });
  
  // 取消订单
  router.post('/:id/cancel', authenticateToken(env), requireAuth, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid order ID', 400);
      }
      
      const orderService = new OrderService(env.DB);
      
      // 检查订单是否存在
      const existingOrder = await orderService.getOrderById(parseInt(id));
      if (!existingOrder) {
        return errorResponse('Order not found', 404);
      }
      
      // 检查权限：学生只能取消自己的订单，教师可以取消任何订单
      if (request.user.role === 'student' && request.user.id !== existingOrder.student_id) {
        return errorResponse('Access denied', 403);
      }
      
      // 检查订单状态是否可以取消
      if (existingOrder.status === 'cancelled') {
        return errorResponse('Order is already cancelled', 400);
      }
      
      if (existingOrder.status === 'delivered') {
        return errorResponse('Cannot cancel delivered order', 400);
      }
      
      const order = await orderService.updateOrderStatus(parseInt(id), 'cancelled');
      
      return successResponse({
        message: 'Order cancelled successfully',
        order
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      return errorResponse('Failed to cancel order', 500);
    }
  });
  
  // 获取订单统计信息
  router.get('/stats/overview', authenticateToken(env), requireAuth, async (request) => {
    try {
      const url = new URL(request.url);
      const studentId = url.searchParams.get('studentId') || '';
      const period = url.searchParams.get('period') || 'all'; // 'all', 'today', 'week', 'month'
      
      const orderService = new OrderService(env.DB);
      
      // 如果是学生用户，只能查看自己的统计
      let finalStudentId = studentId;
      if (request.user.role === 'student') {
        finalStudentId = request.user.id.toString();
      }
      
      const stats = await orderService.getOrderStats(finalStudentId, period);
      
      return successResponse(stats);
    } catch (error) {
      console.error('Get order stats error:', error);
      return errorResponse('Failed to get order stats', 500);
    }
  });
  
  // 获取热门商品统计（仅教师）
  router.get('/stats/popular-products', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit')) || 10;
      const period = url.searchParams.get('period') || 'all'; // 'all', 'today', 'week', 'month'
      
      const orderService = new OrderService(env.DB);
      const popularProducts = await orderService.getPopularProducts(limit, period);
      
      return successResponse({ popularProducts });
    } catch (error) {
      console.error('Get popular products error:', error);
      return errorResponse('Failed to get popular products', 500);
    }
  });
  
  // 批量更新订单状态（仅教师）
  router.patch('/batch/status', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        orderIds: { required: true, type: 'array', minLength: 1 },
        status: { required: true, type: 'string', enum: ['pending', 'confirmed', 'delivered', 'cancelled'] }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { orderIds, status } = body;
      const orderService = new OrderService(env.DB);
      
      // 验证所有订单ID
      const validOrderIds = [];
      const errors = [];
      
      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i];
        if (!orderId || isNaN(parseInt(orderId))) {
          errors.push({ index: i, error: 'Invalid order ID' });
          continue;
        }
        
        const order = await orderService.getOrderById(parseInt(orderId));
        if (!order) {
          errors.push({ index: i, error: 'Order not found' });
          continue;
        }
        
        validOrderIds.push(parseInt(orderId));
      }
      
      if (errors.length > 0) {
        return errorResponse('Some orders are invalid', 400, { errors });
      }
      
      // 批量更新订单状态
      const updatedOrders = [];
      for (const orderId of validOrderIds) {
        try {
          const order = await orderService.updateOrderStatus(orderId, status);
          updatedOrders.push(order);
        } catch (error) {
          console.error('Failed to update order status:', orderId, error);
        }
      }
      
      return successResponse({
        message: `Successfully updated ${updatedOrders.length} orders`,
        orders: updatedOrders
      });
    } catch (error) {
      console.error('Batch update order status error:', error);
      return errorResponse('Failed to batch update order status', 500);
    }
  });
  
  // 获取学生的订单历史
  router.get('/student/:studentId/history', authenticateToken(env), requireAuth, async (request) => {
    try {
      const { studentId } = request.params;
      
      if (!studentId || isNaN(parseInt(studentId))) {
        return errorResponse('Invalid student ID', 400);
      }
      
      // 检查权限：学生只能查看自己的订单历史
      if (request.user.role === 'student' && request.user.id !== parseInt(studentId)) {
        return errorResponse('Access denied', 403);
      }
      
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const status = url.searchParams.get('status') || '';
      
      const orderService = new OrderService(env.DB);
      const result = await orderService.getOrdersByStudentId(parseInt(studentId), {
        page,
        limit,
        status
      });
      
      return successResponse({
        orders: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (error) {
      console.error('Get student order history error:', error);
      return errorResponse('Failed to get student order history', 500);
    }
  });
  
  // 获取商品的订单历史（仅教师）
  router.get('/product/:productId/history', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { productId } = request.params;
      
      if (!productId || isNaN(parseInt(productId))) {
        return errorResponse('Invalid product ID', 400);
      }
      
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const status = url.searchParams.get('status') || '';
      
      const orderService = new OrderService(env.DB);
      const result = await orderService.getOrdersByProductId(parseInt(productId), {
        page,
        limit,
        status
      });
      
      return successResponse({
        orders: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit)
        }
      });
    } catch (error) {
      console.error('Get product order history error:', error);
      return errorResponse('Failed to get product order history', 500);
    }
  });
  
  return router;
}