#!/usr/bin/env node

/**
 * 教室大屏最终测试脚本
 */

const http = require('http');

const API_BASE_URL = 'http://localhost:3000';

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
                'User-Agent': 'Final-Display-Test/1.0',
                ...options.headers
            },
            timeout: 10000
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

async function testDisplayFunctionality() {
    console.log('🎯 教室大屏功能最终测试');
    console.log('========================');
    
    let allPassed = true;
    
    // 1. 测试健康检查
    console.log('\n📋 1. 健康检查');
    try {
        const response = await makeRequest({ url: '/api/health' });
        if (response.statusCode === 200 && (response.data?.success || response.data?.status === 'HEALTHY' || response.data?.status === 'WARNING')) {
            console.log(`✅ 系统健康状态: ${response.data?.status || 'HEALTHY'}`);
        } else {
            console.log('❌ 系统健康检查失败');
            allPassed = false;
        }
    } catch (error) {
        console.log('❌ 健康检查请求失败:', error.message);
        allPassed = false;
    }
    
    // 2. 测试积分排行榜
    console.log('\n📋 2. 积分排行榜测试');
    try {
        const response = await makeRequest({ url: '/api/points/rankings/all' });
        if (response.statusCode === 200 && response.data?.success) {
            const data = response.data.data;
            console.log(`✅ 总积分排行榜: ${data.total.length} 名学生`);
            console.log(`✅ 日榜排行榜: ${data.daily.length} 名学生`);
            console.log(`✅ 周榜排行榜: ${data.weekly.length} 名学生`);
            
            if (data.total.length > 0) {
                const top3 = data.total.slice(0, 3);
                console.log('   前三名:');
                top3.forEach((student, index) => {
                    console.log(`     ${index + 1}. ${student.student.name}: ${student.points}分`);
                });
            }
        } else {
            console.log('❌ 积分排行榜获取失败');
            allPassed = false;
        }
    } catch (error) {
        console.log('❌ 积分排行榜请求失败:', error.message);
        allPassed = false;
    }
    
    // 3. 测试商品列表
    console.log('\n📋 3. 商品列表测试');
    try {
        const response = await makeRequest({ url: '/api/products' });
        if (response.statusCode === 200 && response.data?.success) {
            const products = response.data.data?.products || response.data.products || [];
            console.log(`✅ 商品列表: ${products.length} 个商品`);
            if (products.length > 0) {
                console.log('   商品示例:');
                products.slice(0, 3).forEach(product => {
                    console.log(`     - ${product.name}: ${product.price}积分`);
                });
            }
        } else {
            console.log('❌ 商品列表获取失败');
            allPassed = false;
        }
    } catch (error) {
        console.log('❌ 商品列表请求失败:', error.message);
        allPassed = false;
    }
    
    // 4. 测试奖惩项列表
    console.log('\n📋 4. 奖惩项列表测试');
    try {
        const response = await makeRequest({ url: '/api/reward-penalty' });
        if (response.statusCode === 200 && response.data?.success) {
            const items = response.data.data || [];
            console.log(`✅ 奖惩项列表: ${items.length} 个项目`);
            const rewards = items.filter(item => item.points > 0);
            const penalties = items.filter(item => item.points < 0);
            console.log(`   奖励项: ${rewards.length} 个`);
            console.log(`   惩罚项: ${penalties.length} 个`);
        } else {
            console.log('❌ 奖惩项列表获取失败');
            allPassed = false;
        }
    } catch (error) {
        console.log('❌ 奖惩项列表请求失败:', error.message);
        allPassed = false;
    }
    
    // 5. 测试系统状态
    console.log('\n📋 5. 系统状态测试');
    try {
        const response = await makeRequest({ url: '/api/system/state' });
        if (response.statusCode === 200 && response.data?.success) {
            const state = response.data.data;
            console.log(`✅ 系统模式: ${state.mode}`);
            console.log(`   当前教师: ${state.currentTeacher || '无'}`);
        } else {
            console.log('❌ 系统状态获取失败');
            allPassed = false;
        }
    } catch (error) {
        console.log('❌ 系统状态请求失败:', error.message);
        allPassed = false;
    }
    
    // 6. 测试学生登录
    console.log('\n📋 6. 学生登录测试');
    try {
        const response = await makeRequest({ 
            url: '/api/auth/student-login',
            method: 'POST'
        }, {
            studentId: 'class75_01'
        });
        
        if (response.statusCode === 200 && response.data?.success) {
            console.log('✅ 学生登录功能正常');
            console.log(`   学生姓名: ${response.data.data.student.name}`);
        } else {
            console.log('❌ 学生登录失败');
            allPassed = false;
        }
    } catch (error) {
        console.log('❌ 学生登录请求失败:', error.message);
        allPassed = false;
    }
    
    // 7. 测试页面访问
    console.log('\n📋 7. 页面访问测试');
    try {
        const response = await makeRequest({ 
            url: '/display/',
            headers: { 'Accept': 'text/html' }
        });
        
        if (response.statusCode === 200 && response.body.includes('教室大屏')) {
            console.log('✅ 教室大屏页面可正常访问');
        } else {
            console.log('❌ 教室大屏页面访问失败');
            allPassed = false;
        }
    } catch (error) {
        console.log('❌ 页面访问请求失败:', error.message);
        allPassed = false;
    }
    
    // 总结
    console.log('\n📊 测试结果总结');
    if (allPassed) {
        console.log('🎉 所有测试通过！教室大屏功能正常');
        console.log('\n💡 现在可以正常使用教室大屏了:');
        console.log('   • 访问: http://localhost:3000/display');
        console.log('   • 查看积分排行榜');
        console.log('   • 点击"学生查询"按钮进行积分查询');
        console.log('   • 教师可以切换上课模式进行积分操作');
    } else {
        console.log('⚠️  部分测试失败，请检查上述错误');
    }
    
    return allPassed;
}

testDisplayFunctionality().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('测试执行失败:', error);
    process.exit(1);
});