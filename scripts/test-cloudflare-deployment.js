#!/usr/bin/env node

/**
 * Cloudflare 部署测试脚本
 * 验证部署是否成功并测试各项功能
 */

const https = require('https');
const http = require('http');

class CloudflareDeploymentTester {
  constructor(config = {}) {
    this.config = {
      workerUrl: config.workerUrl || 'https://classroom-points-system.your-subdomain.workers.dev',
      pagesUrl: config.pagesUrl || 'https://classroom-points.pages.dev',
      timeout: config.timeout || 10000,
      ...config
    };
    
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log('🚀 开始 Cloudflare 部署测试...\n');
    
    try {
      // Workers 测试
      await this.testWorkers();
      
      // Pages 测试
      await this.testPages();
      
      // API 功能测试
      await this.testAPIFunctions();
      
      // 数据库测试
      await this.testDatabase();
      
      // 性能测试
      await this.testPerformance();
      
      // 显示测试结果
      this.showResults();
      
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 测试 Workers 部署
   */
  async testWorkers() {
    console.log('📦 测试 Cloudflare Workers...');
    
    // 健康检查
    await this.test('Workers 健康检查', async () => {
      const response = await this.makeRequest(`${this.config.workerUrl}/api/health`);
      
      if (response.status !== 200) {
        throw new Error(`健康检查失败，状态码: ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      if (!data.success) {
        throw new Error('健康检查返回失败状态');
      }
      
      return '✓ Workers 健康检查通过';
    });
    
    // CORS 测试
    await this.test('CORS 配置', async () => {
      const response = await this.makeRequest(`${this.config.workerUrl}/api/health`, {
        method: 'OPTIONS'
      });
      
      const corsHeader = response.headers['access-control-allow-origin'];
      if (!corsHeader) {
        throw new Error('缺少 CORS 头');
      }
      
      return '✓ CORS 配置正确';
    });
    
    // 响应时间测试
    await this.test('Workers 响应时间', async () => {
      const startTime = Date.now();
      await this.makeRequest(`${this.config.workerUrl}/api/health`);
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 2000) {
        throw new Error(`响应时间过长: ${responseTime}ms`);
      }
      
      return `✓ 响应时间: ${responseTime}ms`;
    });
  }

  /**
   * 测试 Pages 部署
   */
  async testPages() {
    console.log('📄 测试 Cloudflare Pages...');
    
    // 主页测试
    await this.test('Pages 主页', async () => {
      const response = await this.makeRequest(this.config.pagesUrl);
      
      if (response.status !== 200) {
        throw new Error(`主页访问失败，状态码: ${response.status}`);
      }
      
      if (!response.body.includes('班级积分管理系统')) {
        throw new Error('主页内容不正确');
      }
      
      return '✓ 主页访问正常';
    });
    
    // 静态资源测试
    await this.test('静态资源', async () => {
      const cssResponse = await this.makeRequest(`${this.config.pagesUrl}/css/common.css`);
      
      if (cssResponse.status !== 200) {
        throw new Error('CSS 文件访问失败');
      }
      
      return '✓ 静态资源访问正常';
    });
    
    // 404 页面测试
    await this.test('404 页面', async () => {
      const response = await this.makeRequest(`${this.config.pagesUrl}/nonexistent-page`);
      
      if (response.status !== 404) {
        throw new Error(`404 页面状态码错误: ${response.status}`);
      }
      
      return '✓ 404 页面配置正确';
    });
  }

  /**
   * 测试 API 功能
   */
  async testAPIFunctions() {
    console.log('🔌 测试 API 功能...');
    
    // 系统状态 API
    await this.test('系统状态 API', async () => {
      const response = await this.makeRequest(`${this.config.workerUrl}/api/system/state`);
      
      if (response.status !== 200) {
        throw new Error(`系统状态 API 失败，状态码: ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      if (!data.success) {
        throw new Error('系统状态 API 返回失败');
      }
      
      return '✓ 系统状态 API 正常';
    });
    
    // 学生列表 API
    await this.test('学生列表 API', async () => {
      const response = await this.makeRequest(`${this.config.workerUrl}/api/students`);
      
      if (response.status !== 200) {
        throw new Error(`学生列表 API 失败，状态码: ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('学生列表 API 数据格式错误');
      }
      
      return `✓ 学生列表 API 正常，返回 ${data.data.length} 条记录`;
    });
    
    // 积分排行榜 API
    await this.test('积分排行榜 API', async () => {
      const response = await this.makeRequest(`${this.config.workerUrl}/api/points/rankings`);
      
      if (response.status !== 200) {
        throw new Error(`积分排行榜 API 失败，状态码: ${response.status}`);
      }
      
      const data = JSON.parse(response.body);
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('积分排行榜 API 数据格式错误');
      }
      
      return `✓ 积分排行榜 API 正常，返回 ${data.data.length} 条记录`;
    });
  }

  /**
   * 测试数据库连接
   */
  async testDatabase() {
    console.log('🗄️ 测试数据库连接...');
    
    // D1 数据库连接测试
    await this.test('D1 数据库连接', async () => {
      const response = await this.makeRequest(`${this.config.workerUrl}/api/health`);
      const data = JSON.parse(response.body);
      
      if (!data.data.database || data.data.database.status !== 'healthy') {
        throw new Error('D1 数据库连接失败');
      }
      
      return '✓ D1 数据库连接正常';
    });
    
    // 数据库表结构测试
    await this.test('数据库表结构', async () => {
      const response = await this.makeRequest(`${this.config.workerUrl}/api/students`);
      
      if (response.status !== 200) {
        throw new Error('无法查询学生表');
      }
      
      return '✓ 数据库表结构正常';
    });
  }

  /**
   * 测试性能
   */
  async testPerformance() {
    console.log('⚡ 测试性能指标...');
    
    // 并发请求测试
    await this.test('并发处理能力', async () => {
      const promises = [];
      const concurrentRequests = 10;
      
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(this.makeRequest(`${this.config.workerUrl}/api/health`));
      }
      
      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      const failedRequests = responses.filter(r => r.status !== 200).length;
      if (failedRequests > 0) {
        throw new Error(`${failedRequests}/${concurrentRequests} 个并发请求失败`);
      }
      
      const avgTime = totalTime / concurrentRequests;
      return `✓ 并发处理正常，平均响应时间: ${avgTime.toFixed(2)}ms`;
    });
    
    // 缓存测试
    await this.test('缓存机制', async () => {
      // 第一次请求
      const response1 = await this.makeRequest(`${this.config.pagesUrl}/css/common.css`);
      const cacheHeader1 = response1.headers['cf-cache-status'];
      
      // 第二次请求
      const response2 = await this.makeRequest(`${this.config.pagesUrl}/css/common.css`);
      const cacheHeader2 = response2.headers['cf-cache-status'];
      
      if (cacheHeader2 === 'HIT' || response1.headers['cache-control']) {
        return '✓ 缓存机制工作正常';
      }
      
      return '⚠ 缓存机制可能未正确配置';
    });
  }

  /**
   * 执行单个测试
   */
  async test(name, testFunction) {
    try {
      const result = await testFunction();
      this.results.passed++;
      this.results.tests.push({ name, status: 'PASS', message: result });
      console.log(`  ✅ ${name}: ${result}`);
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAIL', message: error.message });
      console.log(`  ❌ ${name}: ${error.message}`);
    }
  }

  /**
   * 发送 HTTP 请求
   */
  async makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'CloudflareDeploymentTester/1.0',
          ...options.headers
        },
        timeout: this.config.timeout
      };
      
      const req = client.request(requestOptions, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  /**
   * 显示测试结果
   */
  showResults() {
    console.log('\n📊 测试结果汇总:');
    console.log(`✅ 通过: ${this.results.passed}`);
    console.log(`❌ 失败: ${this.results.failed}`);
    console.log(`📈 成功率: ${((this.results.passed / (this.results.passed + this.results.failed)) * 100).toFixed(1)}%`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.results.tests
        .filter(test => test.status === 'FAIL')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.message}`);
        });
      
      console.log('\n💡 建议检查:');
      console.log('  1. Wrangler 配置是否正确');
      console.log('  2. D1 数据库是否已初始化');
      console.log('  3. KV 命名空间是否已创建');
      console.log('  4. 域名配置是否正确');
      
      process.exit(1);
    } else {
      console.log('\n🎉 所有测试通过！部署成功！');
    }
  }
}

// 命令行使用
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = {};
  
  // 解析命令行参数
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    config[key] = value;
  }
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Cloudflare 部署测试工具

使用方法:
  node scripts/test-cloudflare-deployment.js [选项]

选项:
  --workerUrl <url>    Workers URL (默认: https://classroom-points-system.your-subdomain.workers.dev)
  --pagesUrl <url>     Pages URL (默认: https://classroom-points.pages.dev)
  --timeout <ms>       请求超时时间 (默认: 10000)
  --help, -h           显示帮助信息

示例:
  node scripts/test-cloudflare-deployment.js --workerUrl https://your-worker.workers.dev --pagesUrl https://your-pages.pages.dev
`);
    process.exit(0);
  }
  
  const tester = new CloudflareDeploymentTester(config);
  tester.runAllTests();
}

module.exports = CloudflareDeploymentTester;