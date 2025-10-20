/**
 * Cloudflare Workers - 认证工具
 */

// JWT密钥 (生产环境应使用环境变量)
const JWT_SECRET = 'classroom-points-system-secret-key';

/**
 * 生成JWT令牌
 */
export async function generateJWT(payload) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + (payload.userType === 'student' ? 24 * 60 * 60 : 8 * 60 * 60) // 学生24小时，教师8小时
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
  
  const signature = await sign(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * 验证JWT令牌
 */
export async function verifyJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // 验证签名
    const expectedSignature = await sign(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);
    if (signature !== expectedSignature) {
      return null;
    }
    
    // 解码载荷
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    
    // 检查过期时间
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    
    return payload;
    
  } catch (error) {
    console.error('JWT验证错误:', error);
    return null;
  }
}

/**
 * 认证请求
 */
export async function authenticateRequest(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, message: '访问令牌缺失' };
    }
    
    const token = authHeader.substring(7);
    const user = await verifyJWT(token);
    
    if (!user) {
      return { success: false, message: '访问令牌无效或已过期' };
    }
    
    return { success: true, user };
    
  } catch (error) {
    return { success: false, message: '认证失败' };
  }
}

/**
 * 要求教师权限
 */
export function requireTeacher(user) {
  if (!user || user.userType !== 'teacher') {
    return { success: false, message: '需要教师权限' };
  }
  return { success: true };
}

/**
 * 要求学生权限
 */
export function requireStudent(user) {
  if (!user || user.userType !== 'student') {
    return { success: false, message: '需要学生权限' };
  }
  return { success: true };
}

/**
 * Base64 URL 编码
 */
function base64UrlEncode(str) {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64 URL 解码
 */
function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return decodeURIComponent(escape(atob(str)));
}

/**
 * HMAC SHA256 签名
 */
async function sign(data, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureArray = new Uint8Array(signature);
  
  return base64UrlEncode(String.fromCharCode(...signatureArray));
}