/**
 * Cloudflare Workers API 处理器
 */

import { handlePointsAPI } from './points';
import { handleStudentsAPI } from './students';
import { handleProductsAPI } from './products';
import { handleOrdersAPI } from './orders';
import { handleSystemAPI } from './system';
import { handleAuthAPI } from './auth';
import { handleRewardPenaltyAPI } from './reward-penalty';

/**
 * 处理 API 请求
 */
export async function handleAPIRequest(context) {
  const { pathname, method } = context;
  
  try {
    // 健康检查
    if (pathname === '/api/health') {
      return await handleHealthCheck(context);
    }
    
    // 路由到具体的 API 处理器
    if (pathname.startsWith('/api/points')) {
      return await handlePointsAPI(context);
    }
    
    if (pathname.startsWith('/api/students')) {
      return await handleStudentsAPI(context);
    }
    
    if (pathname.startsWith('/api/products')) {
      return await handleProductsAPI(context);
    }
    
    if (pathname.startsWith('/api/orders')) {
      return await handleOrdersAPI(context);
    }
    
    if (pathname.startsWith('/api/system')) {
      return await handleSystemAPI(context);
    }
    
    if (pathname.startsWith('/api/auth')) {
      return await handleAuthAPI(context);
    }
    
    if (pathname.startsWith('/api/reward-penalty')) {
      return await handleRewardPenaltyAPI(context);
    }
    
    // 未找到的 API 路由
    return createErrorResponse('API 路由未找到', 404);
    
  } catch (error) {
    console.error('API 请求处理错误:', error);
    return createErrorResponse('服务器内部错误', 500);
  }
}

/**
 * 健康检查
 */
async function handleHealthCheck(context) {
  const { dbAdapter } = context;
  
  try {
    const dbHealth = await dbAdapter.healthCheck();
    
    return createSuccessResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      version: '1.0.0',
      deployment: 'cloudflare'
    });
    
  } catch (error) {
    return createErrorResponse('健康检查失败', 500, error.message);
  }
}

/**
 * 创建成功响应
 */
export function createSuccessResponse(data, status = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

/**
 * 创建错误响应
 */
export function createErrorResponse(message, status = 400, details = null) {
  return new Response(
    JSON.stringify({
      success: false,
      message,
      details,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    }
  );
}

/**
 * 解析请求体
 */
export async function parseRequestBody(request) {
  try {
    const contentType = request.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      return await request.json();
    }
    
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
      return data;
    }
    
    return {};
    
  } catch (error) {
    throw new Error('请求体解析失败');
  }
}

/**
 * 验证必需字段
 */
export function validateRequiredFields(data, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (!data[field] && data[field] !== 0) {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`缺少必需字段: ${missing.join(', ')}`);
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}${timestamp}${random}`;
}