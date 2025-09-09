/**
 * 认证中间件集成测试
 * 测试认证中间件在其他API路由中的使用
 */

const http = require('http');
const express = require('express');
const StudentService = require('../services/studentService');
const DataInitializer = require('../utils/dataInitializer');

// 测试配置
const TEST_PORT = 3002;

// 测试数据
const testStudent = {
    id: 'TEST002',
    name: '中间件测试学生',
    class: '测试班级',
    balance: 50
};

const testTeacher = {
    teacherId: 'teacher002',
    password: 'admin123'
};

let server;
let studentService;

/**
 * 创建测试用的Express应用
 */
function createTestApp() {
    const app = express();
    
    // 中间件配置
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // API路由
    app.use('/api/auth', require('../api/auth'));
    app.use('/api/students', require('../api/students'));
    
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
 * 测试套件：认证中间件集成测试
 */
async function runMiddlewareIntegrationTests() {
    console.log('开始认证中间件集成测试...\n');

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
        await testUnauthenticatedAccess();
        await testStudentAccess();
        await testTeacherAccess();
        await testCrossUserAccess();

        console.log('\n✅ 所有认证中间件集成测试通过！');

    } catch (error) {
        console.error('\n❌ 认证中间件集成测试失败:', error.message);
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
        console.log('中间件测试数据准备完成');
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
        console.log('中间件测试数据清理完成');
    } catch (error) {
        // 忽略清理错误
        console.log('中间件测试数据清理完成（部分失败）');
    }
}

/**
 * 测试未认证访问
 */
async function testUnauthenticatedAccess() {
    console.log('测试未认证访问...');

    // 测试访问需要认证的学生列表接口
    const studentsResponse = await makeRequest('GET', '/api/students');
    
    if (studentsResponse.statusCode !== 401) {
        throw new Error('未认证访问应返回401状态码');
    }

    if (studentsResponse.body.code !== 'TOKEN_MISSING') {
        throw new Error('未认证访问应返回TOKEN_MISSING错误码');
    }

    console.log('✓ 未认证访问测试通过');

    // 测试访问需要认证的单个学生信息接口
    const studentResponse = await makeRequest('GET', `/api/students/${testStudent.id}`);
    
    if (studentResponse.statusCode !== 401) {
        throw new Error('未认证访问单个学生信息应返回401状态码');
    }

    console.log('✓ 未认证访问单个学生信息测试通过');
}

/**
 * 测试学生访问权限
 */
async function testStudentAccess() {
    console.log('测试学生访问权限...');

    // 获取学生令牌
    const loginResponse = await makeRequest('POST', '/api/auth/student-login', {
        studentId: testStudent.id
    });
    const studentToken = loginResponse.body.data.token;

    // 测试学生访问学生列表（应该被拒绝，需要教师权限）
    const studentsResponse = await makeRequest('GET', '/api/students', null, {
        'Authorization': `Bearer ${studentToken}`
    });

    if (studentsResponse.statusCode !== 403) {
        throw new Error('学生访问学生列表应返回403状态码');
    }

    if (studentsResponse.body.code !== 'TEACHER_REQUIRED') {
        throw new Error('学生访问学生列表应返回TEACHER_REQUIRED错误码');
    }

    console.log('✓ 学生访问学生列表权限控制测试通过');

    // 测试学生访问自己的信息（应该成功）
    const ownInfoResponse = await makeRequest('GET', `/api/students/${testStudent.id}`, null, {
        'Authorization': `Bearer ${studentToken}`
    });

    if (ownInfoResponse.statusCode !== 200) {
        throw new Error('学生访问自己信息应该成功');
    }

    if (ownInfoResponse.body.user.userType !== 'student') {
        throw new Error('学生访问自己信息时用户类型应为student');
    }

    console.log('✓ 学生访问自己信息测试通过');

    // 测试学生访问其他学生信息（应该被拒绝）
    const otherStudentResponse = await makeRequest('GET', '/api/students/OTHER_ID', null, {
        'Authorization': `Bearer ${studentToken}`
    });

    if (otherStudentResponse.statusCode !== 403) {
        throw new Error('学生访问其他学生信息应返回403状态码');
    }

    if (otherStudentResponse.body.code !== 'ACCESS_DENIED') {
        throw new Error('学生访问其他学生信息应返回ACCESS_DENIED错误码');
    }

    console.log('✓ 学生访问其他学生信息权限控制测试通过');
}

/**
 * 测试教师访问权限
 */
async function testTeacherAccess() {
    console.log('测试教师访问权限...');

    // 获取教师令牌
    const loginResponse = await makeRequest('POST', '/api/auth/teacher-login', testTeacher);
    const teacherToken = loginResponse.body.data.token;

    // 测试教师访问学生列表（应该成功）
    const studentsResponse = await makeRequest('GET', '/api/students', null, {
        'Authorization': `Bearer ${teacherToken}`
    });

    if (studentsResponse.statusCode !== 200) {
        throw new Error('教师访问学生列表应该成功');
    }

    if (studentsResponse.body.user.userType !== 'teacher') {
        throw new Error('教师访问学生列表时用户类型应为teacher');
    }

    console.log('✓ 教师访问学生列表测试通过');

    // 测试教师访问任意学生信息（应该成功）
    const studentInfoResponse = await makeRequest('GET', `/api/students/${testStudent.id}`, null, {
        'Authorization': `Bearer ${teacherToken}`
    });

    if (studentInfoResponse.statusCode !== 200) {
        throw new Error('教师访问学生信息应该成功');
    }

    if (studentInfoResponse.body.user.userType !== 'teacher') {
        throw new Error('教师访问学生信息时用户类型应为teacher');
    }

    console.log('✓ 教师访问学生信息测试通过');
}

/**
 * 测试跨用户访问控制
 */
async function testCrossUserAccess() {
    console.log('测试跨用户访问控制...');

    // 测试无效令牌
    const invalidTokenResponse = await makeRequest('GET', '/api/students', null, {
        'Authorization': 'Bearer invalid_token_here'
    });

    if (invalidTokenResponse.statusCode !== 403) {
        throw new Error('无效令牌应返回403状态码');
    }

    if (invalidTokenResponse.body.code !== 'TOKEN_INVALID') {
        throw new Error('无效令牌应返回TOKEN_INVALID错误码');
    }

    console.log('✓ 无效令牌测试通过');

    // 测试格式错误的Authorization头
    const malformedAuthResponse = await makeRequest('GET', '/api/students', null, {
        'Authorization': 'InvalidFormat'
    });

    if (malformedAuthResponse.statusCode !== 401) {
        throw new Error('格式错误的Authorization头应返回401状态码');
    }

    console.log('✓ 格式错误的Authorization头测试通过');
}

// 运行测试
if (require.main === module) {
    runMiddlewareIntegrationTests().catch(console.error);
}

module.exports = {
    runMiddlewareIntegrationTests
};