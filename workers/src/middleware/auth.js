/**
 * 认证中间件 - Cloudflare Workers版本
 * 实现JWT认证和权限验证
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

/**
 * JWT认证中间件
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @returns {Promise<Object|null>} 用户信息或null
 */
export async function authenticateToken(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return null;
    }
    
    const jwtSecret = env.JWT_SECRET || 'your-secret-key';
    
    // 验证JWT令牌
    const isValid = await jwt.verify(token, jwtSecret);
    if (!isValid) {
      return null;
    }
    
    // 解码JWT载荷
    const payload = jwt.decode(token);
    if (!payload || !payload.payload) {
      return null;
    }
    
    return payload.payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * 教师权限验证中间件
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @returns {Promise<Object>} 验证结果
 */
export async function requireTeacher(request, env) {
  try {
    const user = await authenticateToken(request, env);
    
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }
    
    if (user.role !== 'teacher') {
      return {
        success: false,
        error: 'Teacher access required',
        status: 403
      };
    }
    
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Teacher auth error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500
    };
  }
}

/**
 * 学生权限验证中间件
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @returns {Promise<Object>} 验证结果
 */
export async function requireStudent(request, env) {
  try {
    const user = await authenticateToken(request, env);
    
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }
    
    if (user.role !== 'student') {
      return {
        success: false,
        error: 'Student access required',
        status: 403
      };
    }
    
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Student auth error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500
    };
  }
}

/**
 * 任意已认证用户验证中间件
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @returns {Promise<Object>} 验证结果
 */
export async function requireAuth(request, env) {
  try {
    const user = await authenticateToken(request, env);
    
    if (!user) {
      return {
        success: false,
        error: 'Authentication required',
        status: 401
      };
    }
    
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      status: 500
    };
  }
}

/**
 * 生成JWT令牌
 * @param {Object} payload 载荷数据
 * @param {string} secret JWT密钥
 * @param {Object} options 选项
 * @returns {Promise<string>} JWT令牌
 */
export async function generateToken(payload, secret, options = {}) {
  try {
    const { expiresIn = '24h' } = options;
    
    // 计算过期时间
    let exp;
    if (expiresIn.endsWith('h')) {
      const hours = parseInt(expiresIn.slice(0, -1));
      exp = Math.floor(Date.now() / 1000) + (hours * 60 * 60);
    } else if (expiresIn.endsWith('d')) {
      const days = parseInt(expiresIn.slice(0, -1));
      exp = Math.floor(Date.now() / 1000) + (days * 24 * 60 * 60);
    } else {
      // 默认24小时
      exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
    }
    
    const tokenPayload = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp
    };
    
    return await jwt.sign(tokenPayload, secret);
  } catch (error) {
    console.error('Token generation error:', error);
    throw new Error('Failed to generate token');
  }
}

/**
 * 验证令牌并返回载荷
 * @param {string} token JWT令牌
 * @param {string} secret JWT密钥
 * @returns {Promise<Object|null>} 载荷数据或null
 */
export async function verifyToken(token, secret) {
  try {
    const isValid = await jwt.verify(token, secret);
    if (!isValid) {
      return null;
    }
    
    const payload = jwt.decode(token);
    return payload?.payload || null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * CORS中间件
 * @param {Request} request 请求对象
 * @returns {Response|null} CORS响应或null
 */
export function handleCORS(request) {
  // 处理预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  
  return null;
}

/**
 * 添加CORS头部
 * @param {Response} response 响应对象
 * @returns {Response} 添加了CORS头部的响应
 */
export function addCORSHeaders(response) {
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
  
  return newResponse;
}

/**
 * 错误响应助手
 * @param {string} message 错误消息
 * @param {number} status HTTP状态码
 * @param {Object} details 错误详情
 * @returns {Response} 错误响应
 */
export function errorResponse(message, status = 500, details = null) {
  const errorData = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  if (details) {
    errorData.details = details;
  }
  
  const response = new Response(JSON.stringify(errorData), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return addCORSHeaders(response);
}

/**
 * 成功响应助手
 * @param {*} data 响应数据
 * @param {number} status HTTP状态码
 * @returns {Response} 成功响应
 */
export function successResponse(data, status = 200) {
  const responseData = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  
  const response = new Response(JSON.stringify(responseData), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  return addCORSHeaders(response);
}

/**
 * 请求体解析助手
 * @param {Request} request 请求对象
 * @returns {Promise<Object>} 解析后的请求体
 */
export async function parseRequestBody(request) {
  try {
    const contentType = request.headers.get('Content-Type') || '';
    
    if (contentType.includes('application/json')) {
      return await request.json();
    }
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
      return data;
    }
    
    return {};
  } catch (error) {
    console.error('Request body parsing error:', error);
    throw new Error('Invalid request body');
  }
}

/**
 * 参数验证助手
 * @param {Object} data 要验证的数据
 * @param {Object} rules 验证规则
 * @returns {Object} 验证结果
 */
export function validateParams(data, rules) {
  const errors = [];
  
  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    
    // 检查必填字段
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    
    // 如果字段不存在且不是必填，跳过其他验证
    if (value === undefined || value === null) {
      continue;
    }
    
    // 类型验证
    if (rule.type) {
      const actualType = typeof value;
      if (actualType !== rule.type) {
        errors.push(`${field} must be of type ${rule.type}`);
        continue;
      }
    }
    
    // 最小值验证
    if (rule.min !== undefined && value < rule.min) {
      errors.push(`${field} must be at least ${rule.min}`);
    }
    
    // 最大值验证
    if (rule.max !== undefined && value > rule.max) {
      errors.push(`${field} must be at most ${rule.max}`);
    }
    
    // 长度验证
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters`);
    }
    
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push(`${field} must be at most ${rule.maxLength} characters`);
    }
    
    // 正则表达式验证
    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(`${field} format is invalid`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}