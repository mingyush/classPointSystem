/**
 * Cloudflare Workers API 集成测试
 */

const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');

// 模拟 Cloudflare Workers 环境
global.crypto = require('crypto').webcrypto;
global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
  }
  
  async json() {
    return JSON.parse(this.body);
  }
  
  async text() {
    return this.body;
  }
};

global.Request = class Request {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }
  
  async json() {
    return JSON.parse(this.body);
  }
};

// 模拟 D1 数据库
const mockD1Database = {
  prepare: jest.fn().mockReturnValue({
    bind: jest.fn().mockReturnThis(),
    all: jest.fn().mockResolvedValue({ results: [] }),
    first: jest.fn().mockResolvedValue(null),
    run: jest.fn().mockResolvedValue({ success: true })
  }),
  batch: jest.fn().mockResolvedValue([])
};

describe('Cloudflare Workers API 测试', () => {
  let handleRequest;
  let mockEnv;
  
  beforeAll(async () => {
    // 动态导入 ES 模块
    const requestHandlerModule = await import('../src/handlers/requestHandler.js');
    handleRequest = requestHandlerModule.handleRequest;
    
    mockEnv = {
      DB: mockD1Database
    };
  });
  
  test('健康检查接口', async () => {
    const request = new Request('https://example.com/api/health', {
      method: 'GET'
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('healthy');
  });
  
  test('CORS 预检请求', async () => {
    const request = new Request('https://example.com/api/points/rankings', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    const response = await handleRequest(request, mockEnv, {});
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
    expect(response.headers.get('Access-Control-Allow-Methods')).toBeTruthy();
  });
  
  test('获取积分排行榜', async () => {
    // 模拟数据库返回数据
    mockD1Database.prepare.mockReturnValue({
      bind: jest.fn().mockReturnThis(),
      all: jest.fn().mockResolvedValue({
        results: [
          { id: 'student1', name: '学生1', student_number: '001', points: 100 },
          { id: 'student2', name: '学生2', student_number: '002', points: 90 }
        ]
      }),
      first: jest.fn().mockResolvedValue(null),
      run: jest.fn().mockResolvedValue({ success: true })
    });
    
    const request = new Request('https://example.com/api/points/rankings/all', {
      method: 'GET'
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('total');
    expect(data.data).toHaveProperty('daily');
    expect(data.data).toHaveProperty('weekly');
  });
  
  test('未认证的请求应返回401', async () => {
    const request = new Request('https://example.com/api/students', {
      method: 'GET'
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toContain('访问令牌缺失');
  });
  
  test('不存在的API路由应返回404', async () => {
    const request = new Request('https://example.com/api/nonexistent', {
      method: 'GET'
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.message).toContain('API 路由未找到');
  });
  
  test('页面路由应返回HTML', async () => {
    const request = new Request('https://example.com/display', {
      method: 'GET',
      headers: {
        'Accept': 'text/html'
      }
    });
    
    const response = await handleRequest(request, mockEnv, {});
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });
  
  test('学生登录接口', async () => {
    // 模拟学生存在
    mockD1Database.prepare.mockReturnValue({
      bind: jest.fn().mockReturnThis(),
      all: jest.fn().mockResolvedValue({ results: [] }),
      first: jest.fn().mockResolvedValue({
        id: 'student1',
        name: '学生1',
        role: 'student',
        student_number: '001',
        is_active: 1
      }),
      run: jest.fn().mockResolvedValue({ success: true })
    });
    
    const request = new Request('https://example.com/api/auth/student-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        studentId: 'student1'
      })
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('token');
    expect(data.data.user.userType).toBe('student');
  });
  
  test('教师登录接口', async () => {
    // 模拟教师存在
    mockD1Database.prepare.mockReturnValue({
      bind: jest.fn().mockReturnThis(),
      all: jest.fn().mockResolvedValue({ results: [] }),
      first: jest.fn().mockResolvedValue({
        id: 'teacher1',
        name: '教师1',
        role: 'teacher',
        is_active: 1
      }),
      run: jest.fn().mockResolvedValue({ success: true })
    });
    
    const request = new Request('https://example.com/api/auth/teacher-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teacherId: 'teacher1',
        password: 'admin123'
      })
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('token');
    expect(data.data.user.userType).toBe('teacher');
  });
  
  test('获取商品列表', async () => {
    // 模拟商品数据
    mockD1Database.prepare.mockReturnValue({
      bind: jest.fn().mockReturnThis(),
      all: jest.fn().mockResolvedValue({
        results: [
          {
            id: 'prod1',
            name: '笔记本',
            description: '精美笔记本',
            price: 10,
            stock: 20,
            is_active: 1,
            created_at: new Date().toISOString()
          }
        ]
      }),
      first: jest.fn().mockResolvedValue(null),
      run: jest.fn().mockResolvedValue({ success: true })
    });
    
    const request = new Request('https://example.com/api/products', {
      method: 'GET'
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.products).toHaveLength(1);
    expect(data.data.products[0].name).toBe('笔记本');
  });
  
  test('获取系统状态', async () => {
    // 模拟系统状态
    mockD1Database.prepare.mockReturnValue({
      bind: jest.fn().mockReturnThis(),
      all: jest.fn().mockResolvedValue({ results: [] }),
      first: jest.fn().mockResolvedValue({
        mode: 'normal',
        current_teacher: null,
        session_start_time: null,
        updated_at: new Date().toISOString()
      }),
      run: jest.fn().mockResolvedValue({ success: true })
    });
    
    const request = new Request('https://example.com/api/system/state', {
      method: 'GET'
    });
    
    const response = await handleRequest(request, mockEnv, {});
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.mode).toBe('normal');
  });
  
  afterAll(() => {
    // 清理模拟
    jest.clearAllMocks();
  });
});

module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ]
};