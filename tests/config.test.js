/**
 * 系统配置管理API单元测试
 * 测试系统配置的读取、更新和积分重置功能
 */

const http = require('http');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const DataInitializer = require('../utils/dataInitializer');

// 创建测试用的Express应用
function createTestApp() {
    const app = express();
    
    // 中间件配置
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // API路由
    app.use('/api/auth', require('../api/auth'));
    app.use('/api/config', require('../api/config'));
    
    // 错误处理中间件
    app.use((err, req, res, next) => {
        console.error('测试服务器错误:', err.stack);
        res.status(500).json({
            success: false,
            message: '服务器内部错误',
            error: err.message
        });
    });
    
    return app;
}

// HTTP请求工具函数
function makeRequest(app, method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            
            const options = {
                hostname: 'localhost',
                port: port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            };
            
            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    server.close();
                    try {
                        const jsonBody = body ? JSON.parse(body) : {};
                        resolve({
                            status: res.statusCode,
                            body: jsonBody,
                            headers: res.headers
                        });
                    } catch (error) {
                        resolve({
                            status: res.statusCode,
                            body: body,
                            headers: res.headers
                        });
                    }
                });
            });
            
            req.on('error', (error) => {
                server.close();
                reject(error);
            });
            
            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    });
}

// 测试主函数
async function runConfigTests() {
    console.log('开始系统配置管理API测试...\n');
    
    let passedTests = 0;
    let failedTests = 0;
    
    // 测试辅助函数
    function assert(condition, message) {
        if (condition) {
            console.log(`✓ ${message}`);
            passedTests++;
        } else {
            console.log(`✗ ${message}`);
            failedTests++;
        }
    }
    
    try {
        // 初始化数据
        console.log('开始初始化数据文件...');
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        console.log('配置测试数据准备完成\n');
        
        const app = createTestApp();
        const configFile = path.join(__dirname, '../data/config.json');
        
        // 确保配置文件存在
        const originalConfig = {
            mode: 'normal',
            autoRefreshInterval: 30,
            pointsResetEnabled: false,
            maxPointsPerOperation: 100,
            semesterStartDate: '2024-09-01T00:00:00.000Z'
        };
        await fs.writeFile(configFile, JSON.stringify(originalConfig, null, 2));
        
        // 获取教师token
        const loginResponse = await makeRequest(app, 'POST', '/api/auth/teacher-login', {
            teacherId: 'admin',
            password: 'admin123'
        });
        
        const teacherToken = loginResponse.body.data.token;
        assert(teacherToken, '教师登录获取token');
        
        // 测试获取系统模式
        console.log('测试获取系统模式...');
        const getModeResponse = await makeRequest(app, 'GET', '/api/config/mode');
        assert(getModeResponse.status === 200, '获取系统模式状态码正确');
        assert(getModeResponse.body.success === true, '获取系统模式成功');
        assert(getModeResponse.body.data && getModeResponse.body.data.mode, '返回模式数据');
        
        // 测试切换系统模式
        console.log('测试切换系统模式...');
        const setModeResponse = await makeRequest(app, 'POST', '/api/config/mode', 
            { mode: 'class' }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(setModeResponse.status === 200, '切换系统模式状态码正确');
        assert(setModeResponse.body.success === true, '切换系统模式成功');
        assert(setModeResponse.body.data.mode === 'class', '模式切换到上课模式');
        
        // 测试无效模式
        const invalidModeResponse = await makeRequest(app, 'POST', '/api/config/mode', 
            { mode: 'invalid' }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(invalidModeResponse.status === 400, '无效模式返回400状态码');
        assert(invalidModeResponse.body.code === 'INVALID_MODE', '无效模式错误码正确');
        
        // 测试未认证访问
        const unauthorizedResponse = await makeRequest(app, 'POST', '/api/config/mode', 
            { mode: 'normal' }
        );
        assert(unauthorizedResponse.status === 401, '未认证访问返回401状态码');
        
        // 测试获取完整配置
        console.log('测试获取完整配置...');
        const getConfigResponse = await makeRequest(app, 'GET', '/api/config', null,
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(getConfigResponse.status === 200, '获取完整配置状态码正确');
        assert(getConfigResponse.body.success === true, '获取完整配置成功');
        assert(getConfigResponse.body.data.autoRefreshInterval !== undefined, '配置包含自动刷新间隔');
        assert(getConfigResponse.body.data.maxPointsPerOperation !== undefined, '配置包含最大积分操作');
        
        // 测试更新配置
        console.log('测试更新配置...');
        const updateConfigResponse = await makeRequest(app, 'PUT', '/api/config', 
            {
                autoRefreshInterval: 60,
                maxPointsPerOperation: 200,
                pointsResetEnabled: true
            }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(updateConfigResponse.status === 200, '更新配置状态码正确');
        assert(updateConfigResponse.body.success === true, '更新配置成功');
        assert(updateConfigResponse.body.data.autoRefreshInterval === 60, '自动刷新间隔更新正确');
        assert(updateConfigResponse.body.data.maxPointsPerOperation === 200, '最大积分操作更新正确');
        
        // 测试配置验证
        console.log('测试配置验证...');
        const invalidIntervalResponse = await makeRequest(app, 'PUT', '/api/config', 
            { autoRefreshInterval: 3 }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(invalidIntervalResponse.status === 400, '无效刷新间隔返回400状态码');
        assert(invalidIntervalResponse.body.code === 'INVALID_REFRESH_INTERVAL', '无效刷新间隔错误码正确');
        
        const invalidPointsResponse = await makeRequest(app, 'PUT', '/api/config', 
            { maxPointsPerOperation: 2000 }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(invalidPointsResponse.status === 400, '无效最大积分返回400状态码');
        assert(invalidPointsResponse.body.code === 'INVALID_MAX_POINTS', '无效最大积分错误码正确');
        
        // 测试积分重置功能切换
        console.log('测试积分重置功能切换...');
        const enableResetResponse = await makeRequest(app, 'POST', '/api/config/reset-points/toggle', 
            { enabled: true }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(enableResetResponse.status === 200, '启用积分重置状态码正确');
        assert(enableResetResponse.body.success === true, '启用积分重置成功');
        assert(enableResetResponse.body.data.pointsResetEnabled === true, '积分重置功能已启用');
        
        const disableResetResponse = await makeRequest(app, 'POST', '/api/config/reset-points/toggle', 
            { enabled: false }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(disableResetResponse.status === 200, '禁用积分重置状态码正确');
        assert(disableResetResponse.body.data.pointsResetEnabled === false, '积分重置功能已禁用');
        
        // 测试积分重置
        console.log('测试积分重置...');
        // 先启用功能
        await makeRequest(app, 'POST', '/api/config/reset-points/toggle', 
            { enabled: true }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        
        const resetPointsResponse = await makeRequest(app, 'POST', '/api/config/reset-points', null,
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(resetPointsResponse.status === 200, '积分重置状态码正确');
        assert(resetPointsResponse.body.success === true, '积分重置成功');
        assert(resetPointsResponse.body.data.resetTime !== undefined, '返回重置时间');
        
        // 测试功能禁用时的重置
        await makeRequest(app, 'POST', '/api/config/reset-points/toggle', 
            { enabled: false }, 
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        
        const disabledResetResponse = await makeRequest(app, 'POST', '/api/config/reset-points', null,
            { 'Authorization': `Bearer ${teacherToken}` }
        );
        assert(disabledResetResponse.status === 403, '功能禁用时重置返回403状态码');
        assert(disabledResetResponse.body.code === 'RESET_DISABLED', '功能禁用错误码正确');
        
        // 恢复原始配置
        await fs.writeFile(configFile, JSON.stringify(originalConfig, null, 2));
        
    } catch (error) {
        console.error('配置测试过程中发生错误:', error);
        failedTests++;
    }
    
    console.log(`\n✅ 系统配置管理API测试完成！`);
    console.log(`通过: ${passedTests}, 失败: ${failedTests}\n`);
    
    if (failedTests > 0) {
        process.exit(1);
    }
}

// 运行测试
if (require.main === module) {
    runConfigTests().catch(console.error);
}

module.exports = { runConfigTests };