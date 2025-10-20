/**
 * Cloudflare Workers - CORS 处理工具
 */

/**
 * 处理 CORS 预检请求
 */
export function handleCORS(request) {
  const corsHeaders = getCORSHeaders(request);
  
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  });
}

/**
 * 获取 CORS 头
 */
export function getCORSHeaders(request = null) {
  const origin = request?.headers.get('Origin') || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

/**
 * 添加 CORS 头到响应
 */
export function addCORSHeaders(response, request = null) {
  const corsHeaders = getCORSHeaders(request);
  
  // 创建新的响应对象，保持原有内容
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
  
  // 添加 CORS 头
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newResponse.headers.set(key, value);
  });
  
  return newResponse;
}