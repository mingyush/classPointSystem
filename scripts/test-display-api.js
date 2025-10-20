#!/usr/bin/env node

/**
 * 教室大屏API测试脚本
 * 
 * 功能：
 * - 测试教室大屏相关的API接口
 * - 验证数据是否正常返回
 * - 检查数据库连接状态
 */

const http = require('http');

// 配置
const API_BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 10000;

/**
 * 发送HTTP请求
 */
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(options.url, API_BASE_URL);
        
        const requestOptions = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname + url.search,
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Display-API-Test/1.0',
                ...options.headers
            },
            timeout: TEST_TIMEOUT
        };

        const req = http.request(requestOptions, (res) => {
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
 * 测试用例
 */
const testCases = [
    {
        name: '健康检查',
        test: async () => {
            const response = await makeRequest({ url: '/api/health' });
            
            if (response.statusCode !== 200) {
                throw new Error(`健康检查失败，状态码: ${response.statusCode}`);
            }
            
            return {
                status: response.data?.status,
                message: response.data?.message
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
            
            return {
                mode: response.data?.data?.mode,
                currentTeacher: response.data?.data?.currentTeacher
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
            
            const data = response.data?.data || response.data;
            
            return {
                totalCount: Array.isArray(data?.total) ? data.total.length : 0,
                dailyCount: Array.isArray(data?.daily) ? data.daily.length : 0,
                weeklyCount: Array.isArray(data?.weekly) ? data.weekly.length : 0
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
            
            const products = response.data?.data?.products || response.data?.products || [];
            
            return {
                productCount: products.length,
                products: products.slice(0, 3).map(p => ({ name: p.name, price: p.price }))
            };
        }
    },
    
    {
        name: '获取奖惩项列表',
        test: async () => {
            const response = await makeRequest({ url: '/api/reward-penalty' });
            
            if (response.statusCode !== 200) {
                throw new Error(`获取奖惩项失败，状态码: ${response.statusCode}`);
            }
            
            const items = response.data?.data?.items || response.data?.items || [];
            
            return {
                itemCount: items.length,
                rewardCount: items.filter(i => i.points > 0).length,
                penaltyCount: items.filter(i => i.points < 0).length
            };
        }
    },
    
    {
        name: '测试学生登录（无认证）',
        test: async () => {
            const response = await makeRequest({ 
                url: '/api/auth/student-login',
                method: 'POST'
            }, {
                studentId: '01'
            });
            
            if (response.statusCode === 200 && response.data?.success) {
                return {
                    loginSuccess: true,
                    studentName: response.data?.data?.student?.name,
                    hasToken: !!response.data?.data?.token
                };
            } else {
                return {
                    loginSuccess: false,
                    error: response.data?.message || '登录失败'
                };
            }
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
    console.log('🚀 开始教室大屏API测试...');
    console.log(`📍 测试目标: ${API_BASE_URL}`);
    
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
    
    return failedTests === 0;
}

/**
 * 检查服务器是否运行
 */
async function checkServerRunning() {
    try {
        console.log('🔍 检查服务器状态...');
        const response = await makeRequest({ url: '/api/health' });
        
        if (response.statusCode === 200) {
            console.log('✅ 服务器正在运行');
            return true;
        } else {
            console.log(`⚠️  服务器响应异常，状态码: ${response.statusCode}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ 无法连接到服务器: ${error.message}`);
        console.log('💡 请确保服务器已启动: npm run start:dev');
        return false;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('🎯 教室大屏API测试工具');
    console.log('========================');
    
    // 检查服务器状态
    const serverRunning = await checkServerRunning();
    if (!serverRunning) {
        process.exit(1);
    }
    
    // 运行测试
    const allPassed = await runAllTests();
    
    if (allPassed) {
        console.log('\n🎉 所有测试通过！教室大屏API正常工作');
    } else {
        console.log('\n⚠️  部分测试失败，请检查服务器配置和数据库状态');
    }
    
    process.exit(allPassed ? 0 : 1);
}

// 启动
if (require.main === module) {
    main();
}

module.exports = {
    makeRequest,
    runTest,
    runAllTests,
    checkServerRunning
};