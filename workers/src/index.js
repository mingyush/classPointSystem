/**
 * Cloudflare Workers 入口文件
 * 班级积分管理系统 - Workers版本
 */

import { Router } from 'itty-router';
import { handleCORS, addCORSHeaders, errorResponse, successResponse } from './middleware/auth.js';
import { createAuthRouter } from './api/auth.js';
import { createStudentsRouter } from './api/students.js';
import { createPointsRouter } from './api/points.js';
import { createProductsRouter } from './api/products.js';
import { createOrdersRouter } from './api/orders.js';
import { createConfigRouter } from './api/config.js';
import { createMigrationRouter } from './api/migration.js';

/**
 * 主路由器
 */
const router = Router();

/**
 * 健康检查端点
 */
router.get('/health', () => {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'class-point-system-workers',
    version: '1.0.0'
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

/**
 * API信息端点
 */
router.get('/api', () => {
  return new Response(JSON.stringify({
    name: '班级积分管理系统 API',
    version: '1.0.0',
    description: 'Cloudflare Workers版本的班级积分管理系统API',
    endpoints: {
      auth: '/api/auth',
      students: '/api/students',
      points: '/api/points',
      products: '/api/products',
      orders: '/api/orders',
      config: '/api/config'
    },
    documentation: 'https://github.com/your-repo/class-point-system'
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
});

/**
 * 处理预检请求
 */
router.options('*', handleCORS);

/**
 * 注册API路由
 */
function registerRoutes(env) {
  // 认证路由
  const authRouter = createAuthRouter(env);
  router.all('/api/auth/*', authRouter.handle);
  
  // 学生路由
  const studentsRouter = createStudentsRouter(env);
  router.all('/api/students/*', studentsRouter.handle);
  
  // 积分路由
  const pointsRouter = createPointsRouter(env);
  router.all('/api/points/*', pointsRouter.handle);
  
  // 商品路由
  const productsRouter = createProductsRouter(env);
  router.all('/api/products/*', productsRouter.handle);
  
  // 订单路由
  const ordersRouter = createOrdersRouter(env);
  router.all('/api/orders/*', ordersRouter.handle);
  
  // 配置路由
  const configRouter = createConfigRouter(env);
  router.all('/api/config/*', configRouter.handle);
  
  // 迁移路由
  const migrationRouter = createMigrationRouter(env);
  router.all('/api/migration/*', migrationRouter.handle);
}

/**
 * 全局错误处理
 */
function handleError(error, request) {
  console.error('Global error handler:', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
    timestamp: new Date().toISOString()
  });
  
  // 根据错误类型返回不同的响应
  if (error.name === 'ValidationError') {
    return errorResponse('Validation failed', 400, { details: error.message });
  }
  
  if (error.name === 'AuthenticationError') {
    return errorResponse('Authentication failed', 401);
  }
  
  if (error.name === 'AuthorizationError') {
    return errorResponse('Access denied', 403);
  }
  
  if (error.name === 'NotFoundError') {
    return errorResponse('Resource not found', 404);
  }
  
  if (error.name === 'ConflictError') {
    return errorResponse('Resource conflict', 409, { details: error.message });
  }
  
  // 默认服务器错误
  return errorResponse('Internal server error', 500);
}

/**
 * 请求日志中间件
 */
function logRequest(request, env) {
  const startTime = Date.now();
  
  return {
    log: (response) => {
      const duration = Date.now() - startTime;
      const logData = {
        method: request.method,
        url: request.url,
        status: response.status,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        userAgent: request.headers.get('User-Agent'),
        ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For'),
        country: request.cf?.country,
        colo: request.cf?.colo
      };
      
      // 在开发环境下输出详细日志
      if (env.ENVIRONMENT === 'development') {
        console.log('Request log:', JSON.stringify(logData, null, 2));
      } else {
        console.log('Request:', `${logData.method} ${logData.url} ${logData.status} ${logData.duration}`);
      }
    }
  };
}

/**
 * 速率限制中间件（基于KV存储）
 */
async function rateLimit(request, env) {
  if (!env.CACHE) {
    return null; // 如果没有KV存储，跳过速率限制
  }
  
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  const key = `rate_limit:${ip}`;
  const windowMs = 60 * 1000; // 1分钟窗口
  const maxRequests = 100; // 每分钟最多100个请求
  
  try {
    const current = await env.CACHE.get(key);
    const now = Date.now();
    
    if (!current) {
      // 第一次请求
      await env.CACHE.put(key, JSON.stringify({ count: 1, resetTime: now + windowMs }), {
        expirationTtl: Math.ceil(windowMs / 1000)
      });
      return null;
    }
    
    const data = JSON.parse(current);
    
    if (now > data.resetTime) {
      // 窗口已重置
      await env.CACHE.put(key, JSON.stringify({ count: 1, resetTime: now + windowMs }), {
        expirationTtl: Math.ceil(windowMs / 1000)
      });
      return null;
    }
    
    if (data.count >= maxRequests) {
      // 超过速率限制
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${maxRequests} requests per minute`,
        retryAfter: Math.ceil((data.resetTime - now) / 1000)
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((data.resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(data.resetTime).toISOString()
        }
      });
    }
    
    // 增加计数
    await env.CACHE.put(key, JSON.stringify({ count: data.count + 1, resetTime: data.resetTime }), {
      expirationTtl: Math.ceil((data.resetTime - now) / 1000)
    });
    
    return null;
  } catch (error) {
    console.error('Rate limit error:', error);
    return null; // 出错时不阻止请求
  }
}

/**
 * 数据库连接检查
 */
async function checkDatabaseConnection(env) {
  try {
    const result = await env.DB.prepare('SELECT 1 as test').first();
    return result && result.test === 1;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * 主处理函数
 */
export default {
  async fetch(request, env, ctx) {
    // 创建请求日志
    const logger = logRequest(request, env);
    
    try {
      // 检查数据库连接
      const dbConnected = await checkDatabaseConnection(env);
      if (!dbConnected) {
        console.error('Database connection failed');
        const response = errorResponse('Database connection failed', 503);
        logger.log(response);
        return addCORSHeaders(response);
      }
      
      // 速率限制检查
      const rateLimitResponse = await rateLimit(request, env);
      if (rateLimitResponse) {
        logger.log(rateLimitResponse);
        return addCORSHeaders(rateLimitResponse);
      }
      
      // 注册路由（每次请求时注册，确保使用最新的env）
      registerRoutes(env);
      
      // 处理请求
      const response = await router.handle(request, env, ctx);
      
      // 如果没有匹配的路由，返回404
      if (!response) {
        const notFoundResponse = errorResponse('Endpoint not found', 404, {
          method: request.method,
          url: request.url,
          availableEndpoints: [
            '/health',
            '/api',
            '/api/auth/*',
            '/api/students/*',
            '/api/points/*',
            '/api/products/*',
            '/api/orders/*',
            '/api/config/*'
          ]
        });
        logger.log(notFoundResponse);
        return addCORSHeaders(notFoundResponse);
      }
      
      // 记录请求日志
      logger.log(response);
      
      // 添加CORS头
      return addCORSHeaders(response);
      
    } catch (error) {
      // 全局错误处理
      const errorResponse = handleError(error, request);
      logger.log(errorResponse);
      return addCORSHeaders(errorResponse);
    }
  },
  
  /**
   * 定时任务处理函数
   */
  async scheduled(event, env, ctx) {
    console.log('Scheduled event triggered:', event.scheduledTime);
    
    try {
      // 清理过期的积分记录（如果启用了积分过期）
      const configService = new (await import('./services/configService.js')).ConfigService(env.DB);
      const pointsRules = await configService.getPointsRules();
      
      if (pointsRules.enablePointsExpiry && pointsRules.pointsExpireDays > 0) {
        const pointsService = new (await import('./services/pointsService.js')).PointsService(env.DB, env.CACHE);
        const expiredDate = new Date();
        expiredDate.setDate(expiredDate.getDate() - pointsRules.pointsExpireDays);
        
        // 这里可以添加清理过期积分的逻辑
        console.log('Checking for expired points before:', expiredDate.toISOString());
      }
      
      // 清理过期的缓存（如果需要）
      if (env.CACHE) {
        // KV存储会自动处理过期，这里可以添加其他清理逻辑
        console.log('Cache cleanup completed');
      }
      
      console.log('Scheduled task completed successfully');
    } catch (error) {
      console.error('Scheduled task error:', error);
    }
  }
};

/**
 * 导出路由器用于测试
 */
export { router };