/**
 * Cloudflare Workers - 静态文件处理工具
 */

/**
 * 处理静态文件请求
 */
export async function handleStaticFile(context) {
  const { pathname } = context;
  
  try {
    // 获取文件类型
    const mimeType = getMimeType(pathname);
    
    // 在 Cloudflare Pages 环境中，静态文件由 Pages 自动处理
    // 这里返回一个重定向或者404
    return new Response('静态文件由 Cloudflare Pages 处理', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
    
  } catch (error) {
    console.error('静态文件处理错误:', error);
    return new Response('文件不存在', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}

/**
 * 获取文件的 MIME 类型
 */
function getMimeType(pathname) {
  const ext = pathname.split('.').pop()?.toLowerCase();
  
  const mimeTypes = {
    'html': 'text/html; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}