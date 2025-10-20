/**
 * Cloudflare Workers 请求处理器
 */

import { createRouter } from '../utils/router';
import { createD1Adapter } from '../adapters/d1Adapter';
import { handleCORS, getCORSHeaders, addCORSHeaders } from '../utils/cors';

/**
 * 处理 HTTP 请求
 */
export async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  
  // 处理 CORS 预检请求
  if (method === 'OPTIONS') {
    return handleCORS(request);
  }
  
  // 创建路由器
  const router = createRouter();
  
  // 创建数据库适配器
  const dbAdapter = createD1Adapter(env.DB);
  
  // 创建请求上下文
  const context = {
    request,
    env,
    ctx,
    dbAdapter,
    url,
    method,
    pathname: url.pathname,
    searchParams: url.searchParams
  };
  
  try {
    // 路由匹配和处理
    const response = await router.handle(context);
    
    // 添加 CORS 头
    const corsResponse = addCORSHeaders(response, request);
    
    return corsResponse;
    
  } catch (error) {
    console.error('请求处理错误:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: '请求处理失败',
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCORSHeaders()
        }
      }
    );
  }
}

