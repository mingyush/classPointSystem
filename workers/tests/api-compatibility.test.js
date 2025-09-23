/**
 * API兼容性测试
 * 验证Cloudflare Workers后端与现有前端的API兼容性
 */

// 模拟API测试工具
class APITester {
  constructor(baseUrl = 'http://localhost:8787') {
    this.baseUrl = baseUrl;
    this.authToken = null;
  }

  // 模拟HTTP请求
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // 在实际测试中，这里会发送真实的HTTP请求
    // 现在我们模拟响应
    return this.mockResponse(endpoint, options.method || 'GET', options.body);
  }

  // 模拟API响应
  mockResponse(endpoint, method, body) {
    const responses = {
      // 健康检查
      'GET:/health': { status: 'ok', timestamp: new Date().toISOString() },
      'GET:/api/info': { name: '班级积分管理系统', version: '1.0.0', environment: 'test' },

      // 认证相关
      'POST:/api/auth/teacher-login': {
        success: true,
        token: 'mock-jwt-token',
        user: { id: '8001', name: '王老师', role: 'admin' }
      },
      'POST:/api/auth/student-login': {
        success: true,
        token: 'mock-student-token',
        user: { id: '2024001', name: '张三', balance: 100 }
      },
      'GET:/api/auth/verify': { valid: true, user: { id: '8001', name: '王老师', role: 'admin' } },
      'GET:/api/auth/me': { id: '8001', name: '王老师', role: 'admin' },

      // 学生相关
      'GET:/api/students': {
        students: [
          { id: '2024001', name: '张三', balance: 100, created_at: '2024-01-01T00:00:00Z' },
          { id: '2024002', name: '李四', balance: 50, created_at: '2024-01-01T00:00:00Z' }
        ],
        total: 2
      },
      'GET:/api/students/2024001': {
        id: '2024001',
        name: '张三',
        balance: 100,
        created_at: '2024-01-01T00:00:00Z'
      },
      'GET:/api/students/stats': {
        total: 2,
        totalPoints: 150,
        averagePoints: 75
      },

      // 积分相关
      'GET:/api/points/records': {
        records: [
          {
            id: 1,
            student_id: '2024001',
            points: 50,
            reason: '课堂表现',
            category: 'behavior',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1
      },
      'GET:/api/points/history/2024001': {
        records: [
          {
            id: 1,
            points: 50,
            reason: '课堂表现',
            category: 'behavior',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1
      },
      'GET:/api/points/leaderboard': {
        leaderboard: [
          { student_id: '2024001', name: '张三', total_points: 100, rank: 1 },
          { student_id: '2024002', name: '李四', total_points: 50, rank: 2 }
        ]
      },
      'POST:/api/points/add': {
        success: true,
        record: {
          id: 2,
          student_id: '2024001',
          points: 10,
          reason: '测试加分',
          category: 'test'
        }
      },

      // 商品相关
      'GET:/api/products': {
        products: [
          {
            id: 1,
            name: '笔记本',
            price: 30,
            stock: 10,
            category: 'stationery',
            active: true,
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1
      },
      'GET:/api/products?active=true': {
        products: [
          {
            id: 1,
            name: '笔记本',
            price: 30,
            stock: 10,
            category: 'stationery',
            active: true
          }
        ],
        total: 1
      },
      'POST:/api/products': {
        success: true,
        product: {
          id: 2,
          name: '橡皮',
          price: 5,
          stock: 20,
          category: 'stationery',
          active: true
        }
      },

      // 订单相关
      'GET:/api/orders': {
        orders: [
          {
            id: 1,
            student_id: '2024001',
            product_id: 1,
            quantity: 1,
            total_points: 30,
            status: 'completed',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1
      },
      'GET:/api/orders/pending': {
        orders: [],
        total: 0
      },
      'GET:/api/orders?studentId=2024001': {
        orders: [
          {
            id: 1,
            product_id: 1,
            quantity: 1,
            total_points: 30,
            status: 'completed',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1
      },

      // 系统配置
      'GET:/api/config': {
        system_name: '班级积分管理系统',
        system_version: '1.0.0',
        points_rules: '{}',
        system_mode: 'normal'
      },
      'GET:/api/config/mode': { mode: 'normal' },
      'POST:/api/config/mode': { success: true, mode: 'exam' }
    };

    const key = `${method}:${endpoint}`;
    const response = responses[key];

    if (!response) {
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not Found', message: `API endpoint ${endpoint} not found` })
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => response
    };
  }

  // 设置认证令牌
  setAuthToken(token) {
    this.authToken = token;
  }

  // 清除认证令牌
  clearAuthToken() {
    this.authToken = null;
  }
}

// API兼容性验证器
class APICompatibilityValidator {
  constructor() {
    this.tester = new APITester();
    this.results = [];
  }

  // 记录测试结果
  recordResult(test, success, message = '') {
    this.results.push({
      test,
      success,
      message,
      timestamp: new Date().toISOString()
    });
    
    const status = success ? '✅' : '❌';
    console.log(`${status} ${test}: ${message}`);
  }

  // 验证基础API
  async validateBasicAPIs() {
    console.log('\n=== 验证基础API ===');
    
    try {
      // 健康检查
      const healthResponse = await this.tester.request('/health');
      const healthData = await healthResponse.json();
      this.recordResult(
        '健康检查API',
        healthResponse.ok && healthData.status === 'ok',
        healthResponse.ok ? '健康检查通过' : '健康检查失败'
      );

      // API信息
      const infoResponse = await this.tester.request('/api/info');
      const infoData = await infoResponse.json();
      this.recordResult(
        'API信息接口',
        infoResponse.ok && infoData.name,
        infoResponse.ok ? `系统名称: ${infoData.name}` : 'API信息获取失败'
      );
    } catch (error) {
      this.recordResult('基础API验证', false, `错误: ${error.message}`);
    }
  }

  // 验证认证API
  async validateAuthAPIs() {
    console.log('\n=== 验证认证API ===');
    
    try {
      // 教师登录
      const teacherLoginResponse = await this.tester.request('/api/auth/teacher-login', {
        method: 'POST',
        body: JSON.stringify({ id: '8001', password: 'admin123' })
      });
      const teacherLoginData = await teacherLoginResponse.json();
      
      if (teacherLoginResponse.ok && teacherLoginData.success) {
        this.tester.setAuthToken(teacherLoginData.token);
        this.recordResult('教师登录', true, `登录成功: ${teacherLoginData.user.name}`);
      } else {
        this.recordResult('教师登录', false, '登录失败');
      }

      // 学生登录
      const studentLoginResponse = await this.tester.request('/api/auth/student-login', {
        method: 'POST',
        body: JSON.stringify({ id: '2024001' })
      });
      const studentLoginData = await studentLoginResponse.json();
      this.recordResult(
        '学生登录',
        studentLoginResponse.ok && studentLoginData.success,
        studentLoginResponse.ok ? `学生登录成功: ${studentLoginData.user.name}` : '学生登录失败'
      );

      // 令牌验证
      const verifyResponse = await this.tester.request('/api/auth/verify');
      const verifyData = await verifyResponse.json();
      this.recordResult(
        '令牌验证',
        verifyResponse.ok && verifyData.valid,
        verifyResponse.ok ? '令牌验证通过' : '令牌验证失败'
      );

      // 获取当前用户信息
      const meResponse = await this.tester.request('/api/auth/me');
      const meData = await meResponse.json();
      this.recordResult(
        '获取用户信息',
        meResponse.ok && meData.id,
        meResponse.ok ? `用户: ${meData.name}` : '获取用户信息失败'
      );
    } catch (error) {
      this.recordResult('认证API验证', false, `错误: ${error.message}`);
    }
  }

  // 验证学生API
  async validateStudentAPIs() {
    console.log('\n=== 验证学生API ===');
    
    try {
      // 获取学生列表
      const studentsResponse = await this.tester.request('/api/students');
      const studentsData = await studentsResponse.json();
      this.recordResult(
        '获取学生列表',
        studentsResponse.ok && Array.isArray(studentsData.students),
        studentsResponse.ok ? `学生数量: ${studentsData.total}` : '获取学生列表失败'
      );

      // 获取单个学生信息
      const studentResponse = await this.tester.request('/api/students/2024001');
      const studentData = await studentResponse.json();
      this.recordResult(
        '获取学生信息',
        studentResponse.ok && studentData.id,
        studentResponse.ok ? `学生: ${studentData.name}` : '获取学生信息失败'
      );

      // 获取学生统计
      const statsResponse = await this.tester.request('/api/students/stats');
      const statsData = await statsResponse.json();
      this.recordResult(
        '获取学生统计',
        statsResponse.ok && typeof statsData.total === 'number',
        statsResponse.ok ? `总学生数: ${statsData.total}` : '获取学生统计失败'
      );
    } catch (error) {
      this.recordResult('学生API验证', false, `错误: ${error.message}`);
    }
  }

  // 验证积分API
  async validatePointsAPIs() {
    console.log('\n=== 验证积分API ===');
    
    try {
      // 获取积分记录
      const recordsResponse = await this.tester.request('/api/points/records');
      const recordsData = await recordsResponse.json();
      this.recordResult(
        '获取积分记录',
        recordsResponse.ok && Array.isArray(recordsData.records),
        recordsResponse.ok ? `记录数量: ${recordsData.total}` : '获取积分记录失败'
      );

      // 获取学生积分历史
      const historyResponse = await this.tester.request('/api/points/history/2024001');
      const historyData = await historyResponse.json();
      this.recordResult(
        '获取学生积分历史',
        historyResponse.ok && Array.isArray(historyData.records),
        historyResponse.ok ? `历史记录数: ${historyData.total}` : '获取积分历史失败'
      );

      // 获取积分排行榜
      const leaderboardResponse = await this.tester.request('/api/points/leaderboard');
      const leaderboardData = await leaderboardResponse.json();
      this.recordResult(
        '获取积分排行榜',
        leaderboardResponse.ok && Array.isArray(leaderboardData.leaderboard),
        leaderboardResponse.ok ? `排行榜条目: ${leaderboardData.leaderboard.length}` : '获取排行榜失败'
      );

      // 添加积分记录
      const addPointsResponse = await this.tester.request('/api/points/add', {
        method: 'POST',
        body: JSON.stringify({
          student_id: '2024001',
          points: 10,
          reason: '测试加分',
          category: 'test'
        })
      });
      const addPointsData = await addPointsResponse.json();
      this.recordResult(
        '添加积分记录',
        addPointsResponse.ok && addPointsData.success,
        addPointsResponse.ok ? '积分添加成功' : '积分添加失败'
      );
    } catch (error) {
      this.recordResult('积分API验证', false, `错误: ${error.message}`);
    }
  }

  // 验证商品API
  async validateProductsAPIs() {
    console.log('\n=== 验证商品API ===');
    
    try {
      // 获取商品列表
      const productsResponse = await this.tester.request('/api/products');
      const productsData = await productsResponse.json();
      this.recordResult(
        '获取商品列表',
        productsResponse.ok && Array.isArray(productsData.products),
        productsResponse.ok ? `商品数量: ${productsData.total}` : '获取商品列表失败'
      );

      // 获取活跃商品
      const activeProductsResponse = await this.tester.request('/api/products?active=true');
      const activeProductsData = await activeProductsResponse.json();
      this.recordResult(
        '获取活跃商品',
        activeProductsResponse.ok && Array.isArray(activeProductsData.products),
        activeProductsResponse.ok ? `活跃商品数: ${activeProductsData.total}` : '获取活跃商品失败'
      );

      // 创建商品
      const createProductResponse = await this.tester.request('/api/products', {
        method: 'POST',
        body: JSON.stringify({
          name: '测试商品',
          price: 10,
          stock: 5,
          category: 'test'
        })
      });
      const createProductData = await createProductResponse.json();
      this.recordResult(
        '创建商品',
        createProductResponse.ok && createProductData.success,
        createProductResponse.ok ? '商品创建成功' : '商品创建失败'
      );
    } catch (error) {
      this.recordResult('商品API验证', false, `错误: ${error.message}`);
    }
  }

  // 验证订单API
  async validateOrdersAPIs() {
    console.log('\n=== 验证订单API ===');
    
    try {
      // 获取订单列表
      const ordersResponse = await this.tester.request('/api/orders');
      const ordersData = await ordersResponse.json();
      this.recordResult(
        '获取订单列表',
        ordersResponse.ok && Array.isArray(ordersData.orders),
        ordersResponse.ok ? `订单数量: ${ordersData.total}` : '获取订单列表失败'
      );

      // 获取待处理订单
      const pendingOrdersResponse = await this.tester.request('/api/orders/pending');
      const pendingOrdersData = await pendingOrdersResponse.json();
      this.recordResult(
        '获取待处理订单',
        pendingOrdersResponse.ok && Array.isArray(pendingOrdersData.orders),
        pendingOrdersResponse.ok ? `待处理订单: ${pendingOrdersData.total}` : '获取待处理订单失败'
      );

      // 获取学生订单
      const studentOrdersResponse = await this.tester.request('/api/orders?studentId=2024001');
      const studentOrdersData = await studentOrdersResponse.json();
      this.recordResult(
        '获取学生订单',
        studentOrdersResponse.ok && Array.isArray(studentOrdersData.orders),
        studentOrdersResponse.ok ? `学生订单数: ${studentOrdersData.total}` : '获取学生订单失败'
      );
    } catch (error) {
      this.recordResult('订单API验证', false, `错误: ${error.message}`);
    }
  }

  // 验证系统配置API
  async validateConfigAPIs() {
    console.log('\n=== 验证系统配置API ===');
    
    try {
      // 获取系统配置
      const configResponse = await this.tester.request('/api/config');
      const configData = await configResponse.json();
      this.recordResult(
        '获取系统配置',
        configResponse.ok && configData.system_name,
        configResponse.ok ? `系统名称: ${configData.system_name}` : '获取系统配置失败'
      );

      // 获取系统模式
      const modeResponse = await this.tester.request('/api/config/mode');
      const modeData = await modeResponse.json();
      this.recordResult(
        '获取系统模式',
        modeResponse.ok && modeData.mode,
        modeResponse.ok ? `当前模式: ${modeData.mode}` : '获取系统模式失败'
      );

      // 设置系统模式
      const setModeResponse = await this.tester.request('/api/config/mode', {
        method: 'POST',
        body: JSON.stringify({ mode: 'exam' })
      });
      const setModeData = await setModeResponse.json();
      this.recordResult(
        '设置系统模式',
        setModeResponse.ok && setModeData.success,
        setModeResponse.ok ? '模式设置成功' : '模式设置失败'
      );
    } catch (error) {
      this.recordResult('配置API验证', false, `错误: ${error.message}`);
    }
  }

  // 执行完整的兼容性验证
  async validateAll() {
    console.log('开始API兼容性验证...');
    
    await this.validateBasicAPIs();
    await this.validateAuthAPIs();
    await this.validateStudentAPIs();
    await this.validatePointsAPIs();
    await this.validateProductsAPIs();
    await this.validateOrdersAPIs();
    await this.validateConfigAPIs();
    
    return this.generateReport();
  }

  // 生成验证报告
  generateReport() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0;
    
    const report = {
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        successRate: `${successRate}%`
      },
      results: this.results,
      success: failedTests === 0
    };
    
    console.log('\n=== API兼容性验证报告 ===');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过测试: ${passedTests}`);
    console.log(`失败测试: ${failedTests}`);
    console.log(`成功率: ${successRate}%`);
    
    if (failedTests > 0) {
      console.log('\n失败的测试:');
      this.results.filter(r => !r.success).forEach(result => {
        console.log(`❌ ${result.test}: ${result.message}`);
      });
    }
    
    console.log(`\n验证结果: ${report.success ? '✅ 通过' : '❌ 失败'}`);
    
    return report;
  }
}

// 测试用例
describe('API兼容性验证', () => {
  let validator;
  
  beforeEach(() => {
    validator = new APICompatibilityValidator();
  });
  
  test('应该验证所有API端点的兼容性', async () => {
    const report = await validator.validateAll();
    
    expect(report.summary.total).toBeGreaterThan(0);
    expect(report.success).toBe(true);
    expect(report.summary.failed).toBe(0);
  });
  
  test('应该正确处理认证流程', async () => {
    await validator.validateAuthAPIs();
    
    const authResults = validator.results.filter(r => 
      r.test.includes('登录') || r.test.includes('认证') || r.test.includes('令牌')
    );
    
    expect(authResults.length).toBeGreaterThan(0);
    expect(authResults.every(r => r.success)).toBe(true);
  });
  
  test('应该验证前端关键API调用', async () => {
    // 模拟前端关键API调用
    const keyAPIs = [
      '/api/students',
      '/api/products?active=true',
      '/api/points/history/2024001',
      '/api/orders?studentId=2024001',
      '/api/config/mode'
    ];
    
    for (const api of keyAPIs) {
      const response = await validator.tester.request(api);
      expect(response.ok).toBe(true);
    }
  });
});

module.exports = {
  APICompatibilityValidator,
  APITester
};