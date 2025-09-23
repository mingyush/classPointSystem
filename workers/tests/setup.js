// 测试环境设置文件
// 配置全局测试函数和模拟环境

// 导入vitest的全局函数
import { vi } from 'vitest';

// 模拟Cloudflare Workers环境
global.Request = class MockRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
  }
  
  async json() {
    return JSON.parse(this.body || '{}');
  }
  
  async text() {
    return this.body || '';
  }
};

global.Response = class MockResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
  }
  
  async json() {
    return JSON.parse(this.body || '{}');
  }
  
  async text() {
    return this.body || '';
  }
  
  static json(data, init = {}) {
    return new MockResponse(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers
      }
    });
  }
};

// 模拟环境变量
global.env = {
  ENVIRONMENT: 'test',
  JWT_SECRET: 'test-secret-key',
  CORS_ORIGIN: '*',
  RATE_LIMIT_REQUESTS: '100',
  RATE_LIMIT_WINDOW: '60'
};

// 模拟控制台输出（可选，用于测试时减少日志输出）
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: console.error // 保留错误输出用于调试
  };
}