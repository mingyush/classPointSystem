/**
 * 积分管理API单元测试
 * 测试积分加减操作、排行榜查询和历史记录功能
 */

const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const PointsService = require('../services/pointsService');
const StudentService = require('../services/studentService');
const DataInitializer = require('../utils/dataInitializer');

// 创建测试用的Express应用
function createTestApp() {
    const app = express();
    const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
    
    // 中间件配置
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // API路由
    app.use('/api/auth', require('../api/auth'));
    app.use('/api/points', require('../api/points'));
    
    // 404处理中间件
    app.use(notFoundHandler);
    
    // 统一错误处理中间件
    app.use(errorHandler);
    
    return app;
}

// 测试配置
const TEST_PORT = 3002;
const JWT_SECRET = 'classroom-points-system-secret-key';

// 测试数据
const testStudents = [
    {
        id: 'POINTS001',
        name: '积分测试学生1',
        class: '测试班级',
        balance: 50
    },
    {
        id: 'POINTS002',
        name: '积分测试学生2',
        class: '测试班级',
        balance: 30
    }
];

// 生成测试令牌
function generateToken(userType, userId = 'POINTS001') {
    return jwt.sign(
        {
            userId: userId,
            userType: userType,
            name: userType === 'teacher' ? '教师' : '测试学生'
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

let server;
let studentService;
let pointsService;
let teacherToken;
let studentToken;

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
 * 测试套件：积分管理API测试
 */
async function runPointsTests() {
    console.log('开始积分管理API测试...\n');

    try {
        // 初始化数据
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        
        // 启动测试服务器
        const app = createTestApp();
        server = app.listen(TEST_PORT);
        studentService = new StudentService();
        pointsService = new PointsService();

        // 生成测试令牌
        teacherToken = generateToken('teacher', 'admin');
        studentToken = generateToken('student', 'POINTS001');

        // 准备测试数据
        await setupTestData();

        // 运行测试用例
        await testRankingsAPI();
        await testPointsOperations();
        await testHistoryAPI();
        await testRankAPI();
        await testStatisticsAPI();
        await testBatchOperations();
        await testRecordsAPI();

        console.log('\n✅ 所有积分管理API测试通过！');

    } catch (error) {
        console.error('\n❌ 积分管理API测试失败:', error.message);
        console.error(error.stack);
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
        for (const student of testStudents) {
            await studentService.createStudent(student);
        }
        console.log('积分测试数据准备完成');
    } catch (error) {
        // 学生可能已存在，忽略错误
        console.log('测试学生可能已存在，继续测试');
    }
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
    try {
        // 删除测试学生
        for (const student of testStudents) {
            try {
                await studentService.deleteStudent(student.id);
            } catch (error) {
                // 忽略删除错误
            }
        }
        console.log('积分测试数据清理完成');
    } catch (error) {
        console.log('清理测试数据时出错:', error.message);
    }
}

/**
 * 测试排行榜API
 */
async function testRankingsAPI() {
    console.log('测试排行榜API...');

    // 测试获取总积分排行榜
    let response = await makeRequest('GET', '/api/points/rankings?type=total&limit=10');
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('获取总积分排行榜失败');
    }
    console.log('✓ 获取总积分排行榜测试通过');

    // 测试获取日榜
    response = await makeRequest('GET', '/api/points/rankings?type=daily&limit=5');
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('获取日榜失败');
    }
    console.log('✓ 获取日榜测试通过');

    // 测试获取周榜
    response = await makeRequest('GET', '/api/points/rankings?type=weekly&limit=5');
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('获取周榜失败');
    }
    console.log('✓ 获取周榜测试通过');

    // 测试无效的排行榜类型
    response = await makeRequest('GET', '/api/points/rankings?type=invalid');
    if (response.statusCode !== 400 || response.body.code !== 'INVALID_RANKING_TYPE') {
        throw new Error('无效排行榜类型验证失败');
    }
    console.log('✓ 无效排行榜类型验证测试通过');

    // 测试获取所有排行榜
    response = await makeRequest('GET', '/api/points/rankings/all?limit=5');
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('获取所有排行榜失败');
    }
    if (!response.body.data.total || !response.body.data.daily || !response.body.data.weekly) {
        throw new Error('所有排行榜数据结构不正确');
    }
    console.log('✓ 获取所有排行榜测试通过');
}

/**
 * 测试积分操作API
 */
async function testPointsOperations() {
    console.log('测试积分操作API...');

    // 测试教师加分
    let response = await makeRequest('POST', '/api/points/add', {
        studentId: 'POINTS001',
        points: 10,
        reason: '课堂表现优秀'
    }, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('教师加分操作失败');
    }
    if (response.body.data.record.points !== 10) {
        throw new Error('加分数量不正确');
    }
    console.log('✓ 教师加分操作测试通过');

    // 测试教师减分
    response = await makeRequest('POST', '/api/points/subtract', {
        studentId: 'POINTS001',
        points: 5,
        reason: '违反纪律'
    }, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('教师减分操作失败');
    }
    if (response.body.data.record.points !== -5) {
        throw new Error('减分数量不正确');
    }
    console.log('✓ 教师减分操作测试通过');

    // 测试未认证的加分请求
    response = await makeRequest('POST', '/api/points/add', {
        studentId: 'POINTS001',
        points: 10,
        reason: '测试'
    });
    if (response.statusCode !== 401 || response.body.code !== 'TOKEN_MISSING') {
        throw new Error('未认证请求验证失败');
    }
    console.log('✓ 未认证请求验证测试通过');

    // 测试学生权限验证
    response = await makeRequest('POST', '/api/points/add', {
        studentId: 'POINTS001',
        points: 10,
        reason: '测试'
    }, {
        'Authorization': `Bearer ${studentToken}`
    });
    if (response.statusCode !== 403 || response.body.code !== 'TEACHER_REQUIRED') {
        throw new Error('学生权限验证失败');
    }
    console.log('✓ 学生权限验证测试通过');

    // 测试无效参数验证
    response = await makeRequest('POST', '/api/points/add', {
        studentId: '',
        points: 10,
        reason: '测试'
    }, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 400 || response.body.code !== 'INVALID_STUDENT_ID') {
        throw new Error('无效学号验证失败');
    }
    console.log('✓ 无效参数验证测试通过');
}

/**
 * 测试积分历史API
 */
async function testHistoryAPI() {
    console.log('测试积分历史API...');

    // 测试学生查看自己的历史
    let response = await makeRequest('GET', '/api/points/history/POINTS001?limit=10', null, {
        'Authorization': `Bearer ${studentToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('学生查看自己历史失败');
    }
    console.log('✓ 学生查看自己历史测试通过');

    // 测试教师查看学生历史
    response = await makeRequest('GET', '/api/points/history/POINTS002?limit=10', null, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('教师查看学生历史失败');
    }
    console.log('✓ 教师查看学生历史测试通过');

    // 测试学生查看其他学生历史（应该被拒绝）
    response = await makeRequest('GET', '/api/points/history/POINTS002', null, {
        'Authorization': `Bearer ${studentToken}`
    });
    if (response.statusCode !== 403 || response.body.code !== 'PERMISSION_DENIED') {
        throw new Error('学生权限控制失败');
    }
    console.log('✓ 学生权限控制测试通过');
}

/**
 * 测试排名API
 */
async function testRankAPI() {
    console.log('测试排名API...');

    // 测试学生查看自己的排名
    let response = await makeRequest('GET', '/api/points/rank/POINTS001', null, {
        'Authorization': `Bearer ${studentToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('学生查看自己排名失败');
    }
    console.log('✓ 学生查看自己排名测试通过');

    // 测试教师查看学生排名
    response = await makeRequest('GET', '/api/points/rank/POINTS002', null, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('教师查看学生排名失败');
    }
    console.log('✓ 教师查看学生排名测试通过');
}

/**
 * 测试统计API
 */
async function testStatisticsAPI() {
    console.log('测试统计API...');

    // 测试教师获取统计信息
    let response = await makeRequest('GET', '/api/points/statistics', null, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('教师获取统计信息失败');
    }
    if (!response.body.data.hasOwnProperty('totalRecords')) {
        throw new Error('统计信息数据结构不正确');
    }
    console.log('✓ 教师获取统计信息测试通过');

    // 测试学生获取统计信息（应该被拒绝）
    response = await makeRequest('GET', '/api/points/statistics', null, {
        'Authorization': `Bearer ${studentToken}`
    });
    if (response.statusCode !== 403 || response.body.code !== 'TEACHER_REQUIRED') {
        throw new Error('学生权限控制失败');
    }
    console.log('✓ 学生权限控制测试通过');
}

/**
 * 测试批量操作API
 */
async function testBatchOperations() {
    console.log('测试批量操作API...');

    // 测试批量加分
    const operations = [
        {
            studentId: 'POINTS001',
            points: 5,
            reason: '批量测试1'
        },
        {
            studentId: 'POINTS002',
            points: 3,
            reason: '批量测试2'
        }
    ];

    let response = await makeRequest('POST', '/api/points/batch-add', { operations }, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('批量加分操作失败');
    }
    console.log('✓ 批量加分操作测试通过');

    // 测试空操作列表
    response = await makeRequest('POST', '/api/points/batch-add', { operations: [] }, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 400 || response.body.code !== 'INVALID_OPERATIONS') {
        throw new Error('空操作列表验证失败');
    }
    console.log('✓ 空操作列表验证测试通过');
}

/**
 * 测试记录查询API
 */
async function testRecordsAPI() {
    console.log('测试记录查询API...');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7); // 7天前
    const endDate = new Date();

    // 测试教师获取时间范围记录
    let response = await makeRequest('GET', 
        `/api/points/records?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, 
        null, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 200 || !response.body.success) {
        throw new Error('教师获取时间范围记录失败');
    }
    console.log('✓ 教师获取时间范围记录测试通过');

    // 测试无效时间格式
    response = await makeRequest('GET', '/api/points/records?startDate=invalid&endDate=invalid', null, {
        'Authorization': `Bearer ${teacherToken}`
    });
    if (response.statusCode !== 400 || response.body.code !== 'INVALID_DATE_FORMAT') {
        throw new Error('无效时间格式验证失败');
    }
    console.log('✓ 无效时间格式验证测试通过');

    // 测试学生权限控制
    response = await makeRequest('GET', 
        `/api/points/records?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, 
        null, {
        'Authorization': `Bearer ${studentToken}`
    });
    if (response.statusCode !== 403 || response.body.code !== 'TEACHER_REQUIRED') {
        throw new Error('学生权限控制失败');
    }
    console.log('✓ 学生权限控制测试通过');
}

// 运行测试
if (require.main === module) {
    runPointsTests();
}

module.exports = { runPointsTests };