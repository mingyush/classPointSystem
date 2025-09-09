/**
 * 认证API单元测试
 * 测试学生登录、教师登录和权限验证功能
 */

const http = require('http');
const express = require('express');
const StudentService = require('../services/studentService');
const DataInitializer = require('../utils/dataInitializer');

// 创建测试用的Express应用
function createTestApp() {
    const app = express();
    
    // 中间件配置
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // API路由
    app.use('/api/auth', require('../api/auth'));
    
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

// 测试配置
const TEST_PORT = 3001;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// 测试数据
const testStudent = {
    id: 'TEST001',
    name: '测试学生',
    class: '测试班级',
    balance: 100
};

const testTeacher = {
    teacherId: '8001',
    password: '123'
};

let server;
let studentService;

/**
 * HTTP请求工具函数
 */
function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: TEST_PORT,
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
                try {
                    const response = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: JSON.parse(body)
                    };
                    resolve(response);
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                }
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

/**
 * 测试套件：认证API测试
 */
async function runAuthTests() {
    console.log('开始认证API测试...\n');

    try {
        // 初始化数据
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        
        // 启动测试服务器
        const app = createTestApp();
        server = app.listen(TEST_PORT);
        studentService = new StudentService();

        // 准备测试数据
        await setupTestData();

        // 运行测试用例
        await testStudentLogin();
        await testTeacherLogin();
        await testTokenVerification();
        await testAuthenticationMiddleware();
        await testLogout();

        console.log('\n✅ 所有认证API测试通过！');

    } catch (error) {
        console.error('\n❌ 认证API测试失败:', error.message);
        process.exit(1);
    } finally {
        // 清理测试数据和关闭服务器
        await cleanupTestData();
        if (server) {
            server.close();
        }
    }
}

/**
 * 准备测试数据
 */
async function setupTestData() {
    try {
        // 创建测试学生
        await studentService.createStudent(testStudent);
        console.log('测试数据准备完成');
    } catch (error) {
        // 如果学生已存在，忽略错误
        if (!error.message.includes('已存在')) {
            throw error;
        }
    }
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
    try {
        await studentService.deleteStudent(testStudent.id);
        console.log('测试数据清理完成');
    } catch (error) {
        // 忽略清理错误
        console.log('测试数据清理完成（部分失败）');
    }
}

/**
 * 测试学生登录功能
 */
async function testStudentLogin() {
    console.log('测试学生登录功能...');

    // 测试成功登录
    const loginResponse = await makeRequest('POST', '/api/auth/student-login', {
        studentId: testStudent.id
    });

    if (loginResponse.statusCode !== 200) {
        throw new Error(`学生登录失败: ${loginResponse.body.message}`);
    }

    if (!loginResponse.body.success || !loginResponse.body.data.token) {
        throw new Error('学生登录响应格式错误');
    }

    console.log('✓ 学生登录成功测试通过');

    // 测试无效学号
    const invalidResponse = await makeRequest('POST', '/api/auth/student-login', {
        studentId: 'INVALID_ID'
    });

    if (invalidResponse.statusCode !== 401) {
        throw new Error('无效学号应返回401状态码');
    }

    console.log('✓ 无效学号测试通过');

    // 测试空学号
    const emptyResponse = await makeRequest('POST', '/api/auth/student-login', {
        studentId: ''
    });

    if (emptyResponse.statusCode !== 400) {
        throw new Error('空学号应返回400状态码');
    }

    console.log('✓ 空学号测试通过');
}

/**
 * 测试教师登录功能
 */
async function testTeacherLogin() {
    console.log('测试教师登录功能...');

    // 测试成功登录
    const loginResponse = await makeRequest('POST', '/api/auth/teacher-login', testTeacher);

    if (loginResponse.statusCode !== 200) {
        throw new Error(`教师登录失败: ${loginResponse.body.message}`);
    }

    if (!loginResponse.body.success || !loginResponse.body.data.token) {
        throw new Error('教师登录响应格式错误');
    }

    console.log('✓ 教师登录成功测试通过');

    // 测试错误密码
    const wrongPasswordResponse = await makeRequest('POST', '/api/auth/teacher-login', {
        teacherId: testTeacher.teacherId,
        password: 'wrong_password'
    });

    if (wrongPasswordResponse.statusCode !== 401) {
        throw new Error('错误密码应返回401状态码');
    }

    console.log('✓ 错误密码测试通过');

    // 测试空密码
    const emptyPasswordResponse = await makeRequest('POST', '/api/auth/teacher-login', {
        teacherId: testTeacher.teacherId,
        password: ''
    });

    if (emptyPasswordResponse.statusCode !== 400) {
        throw new Error('空密码应返回400状态码');
    }

    console.log('✓ 空密码测试通过');
}

/**
 * 测试令牌验证功能
 */
async function testTokenVerification() {
    console.log('测试令牌验证功能...');

    // 先获取有效令牌
    const loginResponse = await makeRequest('POST', '/api/auth/student-login', {
        studentId: testStudent.id
    });

    const token = loginResponse.body.data.token;

    // 测试有效令牌
    const verifyResponse = await makeRequest('GET', '/api/auth/verify', null, {
        'Authorization': `Bearer ${token}`
    });

    if (verifyResponse.statusCode !== 200) {
        throw new Error('有效令牌验证失败');
    }

    console.log('✓ 有效令牌验证测试通过');

    // 测试无令牌
    const noTokenResponse = await makeRequest('GET', '/api/auth/verify');

    if (noTokenResponse.statusCode !== 401) {
        throw new Error('无令牌应返回401状态码');
    }

    console.log('✓ 无令牌测试通过');

    // 测试无效令牌
    const invalidTokenResponse = await makeRequest('GET', '/api/auth/verify', null, {
        'Authorization': 'Bearer invalid_token'
    });

    if (invalidTokenResponse.statusCode !== 403) {
        throw new Error('无效令牌应返回403状态码');
    }

    console.log('✓ 无效令牌测试通过');
}

/**
 * 测试认证中间件
 */
async function testAuthenticationMiddleware() {
    console.log('测试认证中间件...');

    // 获取学生令牌
    const studentLoginResponse = await makeRequest('POST', '/api/auth/student-login', {
        studentId: testStudent.id
    });
    const studentToken = studentLoginResponse.body.data.token;

    // 获取教师令牌
    const teacherLoginResponse = await makeRequest('POST', '/api/auth/teacher-login', testTeacher);
    const teacherToken = teacherLoginResponse.body.data.token;

    // 测试学生令牌验证
    const studentVerifyResponse = await makeRequest('GET', '/api/auth/verify', null, {
        'Authorization': `Bearer ${studentToken}`
    });

    if (studentVerifyResponse.body.data.user.userType !== 'student') {
        throw new Error('学生令牌用户类型错误');
    }

    console.log('✓ 学生令牌中间件测试通过');

    // 测试教师令牌验证
    const teacherVerifyResponse = await makeRequest('GET', '/api/auth/verify', null, {
        'Authorization': `Bearer ${teacherToken}`
    });

    if (teacherVerifyResponse.body.data.user.userType !== 'teacher') {
        throw new Error('教师令牌用户类型错误');
    }

    console.log('✓ 教师令牌中间件测试通过');
}

/**
 * 测试登出功能
 */
async function testLogout() {
    console.log('测试登出功能...');

    const logoutResponse = await makeRequest('POST', '/api/auth/logout');

    if (logoutResponse.statusCode !== 200) {
        throw new Error('登出失败');
    }

    if (!logoutResponse.body.success) {
        throw new Error('登出响应格式错误');
    }

    console.log('✓ 登出测试通过');
}

// 运行测试
if (require.main === module) {
    runAuthTests().catch(console.error);
}

module.exports = {
    runAuthTests,
    makeRequest
};