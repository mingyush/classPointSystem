#!/usr/bin/env node

/**
 * Cloudflare Workers API验证脚本
 * 
 * 功能：
 * - 验证Cloudflare Workers部署是否正常
 * - 测试所有API端点功能
 * - 检查D1数据库连接
 * 
 * 使用方法：
 * node scripts/verify-cloudflare-workers.js [WORKER_URL]
 */

const https = require('https');
const http = require('http');

// 配置
const WORKER_URL = process.argv[2] || process.env.WORKER_URL || 'https://your-worker.your-subdomain.workers.dev';
const TEST_TIMEOUT = 15000; // 15秒超时

/**
 * 发送HTTP请求
 */
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.url, WORKER_URL);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const requestOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Cloudflare-Workers-Verification/1.0',
                ...options.headers
            },
            timeout: TEST_TIMEOUT
        };

        const req = client.request(requestOptions, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body,
                        data: body ? JSON.parse(body) : null
                    };
                    resolve(response);
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body,
                        data: null,
                        parseError: error.message
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

/**
 * 测试用例定义
 */
const testCases = [
    {
        name: 'Workers健康检查',
        test: async () => {
            const response = await makeRequest({ url: '/api/health' });
            
            if (response.statusCode !== 200) {
                throw new Error(`健康检查失败，状态码: ${response.statusCode}`);
            }
            
            if (!response.data || !response.data.success) {
                throw new Error('健康检查返回数据异常');
            }
            
            return {
                status: response.data.data.status,
                deployment: response.data.data.deployment,
                database: response.data.data.database
            };
        }
    },
    
    {
        name: 'CORS预检请求',
        test: async () => {
            const response = await makeRequest({ 
                url: '/api/points/rankings',
                method: 'OPTIONS',
                headers: {
                    'Origin': 'https://example.com',
                    'Access-Control-Request-Method': 'GET'
                }
            });
            
            if (response.statusCode !== 200) {
                throw new Error(`CORS预检失败，状态码: ${response.statusCode}`);
            }
            
            const corsHeaders = response.headers['access-control-allow-origin'];
            if (!corsHeaders) {
                throw new Error('CORS头缺失');
            }
            
            return {
                allowOrigin: corsHeaders,
                allowMethods: response.headers['access-control-allow-methods']
            };
        }
    },
    
    {
        name: '获取积分排行榜',
        test: async () => {
            const response = await makeRequest({ url: '/api/points/rankings/all' });
            
            if (response.statusCode !== 200) {
                throw new Error(`获取排行榜失败，状态码: ${response.statusCode}`);
            }
            
            if (!response.data || !response.data.success) {
                throw new Error('排行榜数据异常');
            }
            
            const { total, daily, weekly } = response.data.data;
            
            return {
                totalCount: Array.isArray(total) ? total.length : 0,
                dailyCount: Array.isArray(daily) ? daily.length : 0,
                weeklyCount: Array.isArray(weekly) ? weekly.length : 0
            };
        }
    },
    
    {
        name: '获取商品列表',
        test: async () => {
            const response = await makeRequest({ url: '/api/products' });
            
            if (response.statusCode !== 200) {
                throw new Error(`获取商品列表失败，状态码: ${response.statusCode}`);
            }
            
            if (!response.data || !response.data.success) {
                throw new Error('商品列表数据异常');
            }
            
            return {
                productCount: Array.isArray(response.data.data.products) ? response.data.data.products.length : 0
            };
        }
    },
    
    {
        name: '获取奖惩项列表',
        test: async () => {
            const response = await makeRequest({ url: '/api/reward-penalty' });
            
            if (response.statusCode !== 200) {
                throw new Error(`获取奖惩项列表失败，状态码: ${response.statusCode}`);
            }
            
            if (!response.data || !response.data.success) {
                throw new Error('奖惩项列表数据异常');
            }
            
            return {
                itemCount: Array.isArray(response.data.data.items) ? response.data.data.items.length : 0
            };
        }
    },
    
    {
        name: '获取系统状态',
        test: async () => {
            const response = await makeRequest({ url: '/api/system/state' });
            
            if (response.statusCode !== 200) {
                throw new Error(`获取系统状态失败，状态码: ${response.statusCode}`);
            }
            
            if (!response.data || !response.data.success) {
                throw new Error('系统状态数据异常');
            }
            
            return {
                mode: response.data.data.mode,
                currentTeacher: response.data.data.currentTeacher || null
            };
        }
    },
    
    {
        name: '学生登录测试',
        test: async () => {
            const response = await makeRequest({ 
                url: '/api/auth/student-login',
                method: 'POST'
            }, {
                studentId: 'test-student'
            });
            
            // 应该返回401或404（学生不存在）
            if (response.statusCode !== 401 && response.statusCode !== 404) {
                throw new Error(`预期401/404错误，实际状态码: ${response.statusCode}`);
            }
            
            if (!response.data || response.data.success !== false) {
                throw new Error('错误响应格式异常');
            }
            
            return {
                message: '学生登录接口工作正常'
            };
        }
    },
    
    {
        name: '教师登录测试',
        test: async () => {
            const response = await makeRequest({ 
                url: '/api/auth/teacher-login',
                method: 'POST'
            }, {
                teacherId: 'teacher01',
                password: 'admin123'
            });
            
            // 可能成功（如果有默认教师）或失败（教师不存在）
            if (response.statusCode !== 200 && response.statusCode !== 401 && response.statusCode !== 404) {
                throw new Error(`意外的状态码: ${response.statusCode}`);
            }
            
            if (!response.data) {
                throw new Error('响应数据缺失');
            }
            
            return {
                statusCode: response.statusCode,
                success: response.data.success,
                hasToken: response.data.data && response.data.data.token ? true : false
            };
        }
    },
    
    {
        name: '测试404处理',
        test: async () => {
            const response = await makeRequest({ url: '/api/nonexistent-endpoint' });
            
            // 应该返回404错误
            if (response.statusCode !== 404) {
                throw new Error(`预期404错误，实际状态码: ${response.statusCode}`);
            }
            
            if (!response.data || response.data.success !== false) {
                throw new Error('404错误响应格式异常');
            }
            
            return {
                message: '404处理正常'
            };
        }
    },
    
    {
        name: '测试前端路由',
        test: async () => {
            const routes = [
                { path: '/display', name: '教室大屏' },
                { path: '/admin', name: '管理后台' },
                { path: '/', name: '主页' }
            ];
            
            const results = [];
            
            for (const route of routes) {
                try {
                    const response = await makeRequest({ 
                        url: route.path,
                        headers: { 'Accept': 'text/html' }
                    });
                    
                    // 前端路由应该返回200或302（重定向）
                    if (response.statusCode === 200 || response.statusCode === 302) {
                        results.push({
                            path: route.path,
                            name: route.name,
                            status: 'OK',
                            statusCode: response.statusCode
                        });
                    } else {
                        results.push({
                            path: route.path,
                            name: route.name,
                            status: 'ERROR',
                            statusCode: response.statusCode
                        });
                    }
                } catch (error) {
                    results.push({
                        path: route.path,
                        name: route.name,
                        status: 'ERROR',
                        error: error.message
                    });
                }
            }
            
            return { routes: results };
        }
    }
];

/**
 * 运行单个测试
 */
async function runTest(testCase) {
    const startTime = Date.now();
    
    try {
        console.log(`\n🧪 测试: ${testCase.name}`);
        
        const result = await testCase.test();
        const duration = Date.now() - startTime;
        
        console.log(`✅ 通过 (${duration}ms)`);
        if (result && typeof result === 'object') {
            console.log(`   结果: ${JSON.stringify(result, null, 2)}`);
        }
        
        return { success: true, duration, result };
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        console.log(`❌ 失败 (${duration}ms)`);
        console.log(`   错误: ${error.message}`);
        
        return { success: false, duration, error: error.message };
    }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
    console.log('🚀 开始Cloudflare Workers API验证测试...');
    console.log(`📍 测试目标: ${WORKER_URL}`);
    console.log(`⏱️  超时时间: ${TEST_TIMEOUT}ms`);
    
    const startTime = Date.now();
    const results = [];
    
    for (const testCase of testCases) {
        const result = await runTest(testCase);
        results.push({
            name: testCase.name,
            ...result
        });
    }
    
    const totalDuration = Date.now() - startTime;
    const passedTests = results.filter(r => r.success).length;
    const failedTests = results.filter(r => !r.success).length;
    
    console.log('\n📊 测试结果汇总:');
    console.log(`   总测试数: ${results.length}`);
    console.log(`   通过: ${passedTests}`);
    console.log(`   失败: ${failedTests}`);
    console.log(`   总耗时: ${totalDuration}ms`);
    
    if (failedTests > 0) {
        console.log('\n❌ 失败的测试:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`   - ${result.name}: ${result.error}`);
        });
    }
    
    console.log('\n📋 详细结果:');
    results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${result.name} (${result.duration}ms)`);
    });
    
    // 返回退出码
    process.exit(failedTests > 0 ? 1 : 0);
}

/**
 * 检查Workers是否可访问
 */
async function checkWorkerAccessible() {
    try {
        console.log('🔍 检查Cloudflare Workers状态...');
        const response = await makeRequest({ url: '/api/health' });
        
        if (response.statusCode === 200) {
            console.log('✅ Cloudflare Workers正在运行');
            return true;
        } else {
            console.log(`⚠️  Workers响应异常，状态码: ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ 无法连接到Cloudflare Workers: ${error.message}`);
        console.log('💡 请确保Workers已部署并且URL正确');
        return false;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('🎯 班级积分系统V1 - Cloudflare Workers API验证工具');
    console.log('=======================================================');
    
    // 检查Workers状态
    const workerAccessible = await checkWorkerAccessible();
    if (!workerAccessible) {
        process.exit(1);
    }
    
    // 运行测试
    await runAllTests();
}

// 处理未捕获的异常
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    process.exit(1);
});

// 启动
if (require.main === module) {
    main();
}

module.exports = {
    makeRequest,
    runTest,
    runAllTests,
    checkWorkerAccessible
};