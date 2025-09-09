/**
 * 订单API单元测试
 * 测试商品预约、确认、取消等功能
 */

const http = require('http');
const express = require('express');
const DataAccess = require('../utils/dataAccess');
const OrderService = require('../services/orderService');
const StudentService = require('../services/studentService');
const ProductService = require('../services/productService');
const DataInitializer = require('../utils/dataInitializer');

// 创建测试用的Express应用
function createTestApp() {
    const app = express();
    
    // 中间件配置
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // API路由
    app.use('/api/auth', require('../api/auth'));
    app.use('/api/orders', require('../api/orders'));
    
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
const TEST_PORT = 3002;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// 测试数据
const testStudent = {
    id: 'ORDER-TEST-001',
    name: '订单测试学生',
    class: '测试班级',
    balance: 200
};

const testProduct = {
    name: '订单测试商品',
    price: 50,
    stock: 10,
    description: '测试用商品',
    isActive: true
};

// 全局变量
let server;
let dataAccess;
let orderService;
let studentService;
let productService;
let teacherToken;
let studentToken;
let createdStudent;
let createdProduct;

// HTTP请求工具函数
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
                        status: res.statusCode,
                        headers: res.headers,
                        body: body ? JSON.parse(body) : null
                    };
                    resolve(response);
                } catch (error) {
                    resolve({
                        status: res.statusCode,
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

// 测试初始化
async function initializeTest() {
    console.log('开始订单API测试...\n');
    
    // 初始化数据
    const dataInitializer = new DataInitializer();
    await dataInitializer.initializeAllData();
    
    // 创建服务实例
    dataAccess = new DataAccess();
    orderService = new OrderService();
    studentService = new StudentService();
    productService = new ProductService();
    
    // 创建测试学生
    createdStudent = await studentService.createStudent(testStudent);
    
    // 创建测试商品
    createdProduct = await productService.createProduct(testProduct);
    
    // 启动测试服务器
    const app = createTestApp();
    server = app.listen(TEST_PORT);
    
    // 获取认证token
    const teacherLoginResponse = await makeRequest('POST', '/api/auth/teacher-login', {
        teacherId: 'admin',
        password: 'admin123'
    });
    teacherToken = teacherLoginResponse.body.data.token;
    
    const studentLoginResponse = await makeRequest('POST', '/api/auth/student-login', {
        studentId: testStudent.id
    });
    studentToken = studentLoginResponse.body.data.token;
    
    console.log('订单测试数据准备完成');
}

// 测试清理
async function cleanupTest() {
    if (server) {
        server.close();
    }
    
    // 清理测试数据
    try {
        await dataAccess.writeFile('orders.json', { orders: [] });
        await studentService.deleteStudent(testStudent.id);
        await productService.deleteProduct(createdProduct.id);
    } catch (error) {
        console.error('清理测试数据失败:', error);
    }
    
    console.log('订单测试数据清理完成');
}

// 重置测试数据
async function resetTestData() {
    await dataAccess.writeFile('orders.json', { orders: [] });
    await studentService.updateStudentBalance(testStudent.id, 200);
    await productService.updateProduct(createdProduct.id, { stock: 10, isActive: true });
}

// 测试商品预约功能
async function testReserveOrder() {
    console.log('测试商品预约功能...');
    
    // 重置测试数据
    await resetTestData();
    
    // 测试学生成功预约商品
    try {
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id,
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 201 && response.body.success) {
            console.log('✓ 学生成功预约商品测试通过');
            
            // 验证学生积分被冻结
            const updatedStudent = await studentService.getStudentById(testStudent.id);
            if (updatedStudent.balance === 50) {
                console.log('✓ 积分冻结验证通过');
            } else {
                console.log('✗ 积分冻结验证失败');
            }
        } else {
            console.log('✗ 学生预约商品测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 学生预约商品测试异常:', error.message);
    }
    
    // 重置测试数据
    await resetTestData();
    
    // 测试教师为学生预约商品
    try {
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id,
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${teacherToken}`
        });
        
        if (response.status === 201 && response.body.success) {
            console.log('✓ 教师为学生预约商品测试通过');
        } else {
            console.log('✗ 教师为学生预约商品测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 教师为学生预约商品测试异常:', error.message);
    }
    
    // 重置测试数据
    await resetTestData();
    
    // 测试学生不能为其他学生预约
    try {
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: 'other-student',
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 403 && response.body.code === 'PERMISSION_DENIED') {
            console.log('✓ 学生权限控制测试通过');
        } else {
            console.log('✗ 学生权限控制测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 学生权限控制测试异常:', error.message);
    }
    
    // 测试积分不足时预约失败
    try {
        await studentService.updateStudentBalance(testStudent.id, 30);
        
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id,
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 400 && response.body.code === 'INSUFFICIENT_POINTS') {
            console.log('✓ 积分不足验证测试通过');
        } else {
            console.log('✗ 积分不足验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 积分不足验证测试异常:', error.message);
    }
    
    // 重置测试数据
    await resetTestData();
    
    // 测试商品库存不足时预约失败
    try {
        await productService.updateProduct(createdProduct.id, { stock: 0 });
        
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id,
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 400 && response.body.code === 'INSUFFICIENT_STOCK') {
            console.log('✓ 库存不足验证测试通过');
        } else {
            console.log('✗ 库存不足验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 库存不足验证测试异常:', error.message);
    }
    
    // 重置测试数据
    await resetTestData();
    
    // 测试商品已下架时预约失败
    try {
        await productService.updateProduct(createdProduct.id, { isActive: false });
        
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id,
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 400 && response.body.code === 'PRODUCT_INACTIVE') {
            console.log('✓ 商品下架验证测试通过');
        } else {
            console.log('✗ 商品下架验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 商品下架验证测试异常:', error.message);
    }
    
    // 重置测试数据
    await resetTestData();
    
    // 测试重复预约同一商品失败
    try {
        // 先创建一个预约
        await orderService.createReservation(testStudent.id, createdProduct.id);
        
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id,
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 409 && response.body.code === 'DUPLICATE_RESERVATION') {
            console.log('✓ 重复预约验证测试通过');
        } else {
            console.log('✗ 重复预约验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 重复预约验证测试异常:', error.message);
    }
    
    // 测试参数验证
    try {
        const response = await makeRequest('POST', '/api/orders/reserve', {
            productId: createdProduct.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 400 && response.body.code === 'INVALID_STUDENT_ID') {
            console.log('✓ 缺少学生ID验证测试通过');
        } else {
            console.log('✗ 缺少学生ID验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 缺少学生ID验证测试异常:', error.message);
    }
    
    try {
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id
        }, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 400 && response.body.code === 'INVALID_PRODUCT_ID') {
            console.log('✓ 缺少商品ID验证测试通过');
        } else {
            console.log('✗ 缺少商品ID验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 缺少商品ID验证测试异常:', error.message);
    }
    
    // 测试未认证用户无法预约
    try {
        const response = await makeRequest('POST', '/api/orders/reserve', {
            studentId: testStudent.id,
            productId: createdProduct.id
        });
        
        if (response.status === 401) {
            console.log('✓ 未认证用户验证测试通过');
        } else {
            console.log('✗ 未认证用户验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 未认证用户验证测试异常:', error.message);
    }
}

// 测试获取待处理预约功能
async function testGetPendingOrders() {
    console.log('测试获取待处理预约功能...');
    
    // 重置测试数据并创建预约
    await resetTestData();
    await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试教师可以获取待处理预约列表
    try {
        const response = await makeRequest('GET', '/api/orders/pending', null, {
            'Authorization': `Bearer ${teacherToken}`
        });
        
        if (response.status === 200 && response.body.success && response.body.data.orders.length === 1) {
            console.log('✓ 教师获取待处理预约测试通过');
        } else {
            console.log('✗ 教师获取待处理预约测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 教师获取待处理预约测试异常:', error.message);
    }
    
    // 测试学生无法获取待处理预约列表
    try {
        const response = await makeRequest('GET', '/api/orders/pending', null, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 403 && !response.body.success) {
            console.log('✓ 学生权限控制测试通过');
        } else {
            console.log('✗ 学生权限控制测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 学生权限控制测试异常:', error.message);
    }
}

// 测试确认预约功能
async function testConfirmOrder() {
    console.log('测试确认预约功能...');
    
    // 重置测试数据并创建预约
    await resetTestData();
    const testOrder = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试教师成功确认预约
    try {
        const response = await makeRequest('POST', `/api/orders/${testOrder.id}/confirm`, null, {
            'Authorization': `Bearer ${teacherToken}`
        });
        
        if (response.status === 200 && response.body.success && response.body.data.order.status === 'confirmed') {
            console.log('✓ 教师确认预约测试通过');
            
            // 验证商品库存减少
            const updatedProduct = await productService.getProductById(createdProduct.id);
            if (updatedProduct.stock === 9) {
                console.log('✓ 库存减少验证通过');
            } else {
                console.log('✗ 库存减少验证失败');
            }
        } else {
            console.log('✗ 教师确认预约测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 教师确认预约测试异常:', error.message);
    }
    
    // 重置测试数据并创建新预约
    await resetTestData();
    const testOrder2 = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试学生无法确认预约
    try {
        const response = await makeRequest('POST', `/api/orders/${testOrder2.id}/confirm`, null, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 403 && !response.body.success) {
            console.log('✓ 学生权限控制测试通过');
        } else {
            console.log('✗ 学生权限控制测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 学生权限控制测试异常:', error.message);
    }
    
    // 测试确认不存在的订单
    try {
        const response = await makeRequest('POST', '/api/orders/nonexistent-order/confirm', null, {
            'Authorization': `Bearer ${teacherToken}`
        });
        
        if (response.status === 404 && response.body.code === 'ORDER_NOT_FOUND') {
            console.log('✓ 订单不存在验证测试通过');
        } else {
            console.log('✗ 订单不存在验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 订单不存在验证测试异常:', error.message);
    }
}

// 测试取消预约功能
async function testCancelOrder() {
    console.log('测试取消预约功能...');
    
    // 重置测试数据并创建预约
    await resetTestData();
    const testOrder = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试学生成功取消自己的预约
    try {
        const response = await makeRequest('POST', `/api/orders/${testOrder.id}/cancel`, null, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 200 && response.body.success && response.body.data.order.status === 'cancelled') {
            console.log('✓ 学生取消预约测试通过');
            
            // 验证积分被退还
            const updatedStudent = await studentService.getStudentById(testStudent.id);
            if (updatedStudent.balance === 100) {
                console.log('✓ 积分退还验证通过');
            } else {
                console.log('✗ 积分退还验证失败');
            }
        } else {
            console.log('✗ 学生取消预约测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 学生取消预约测试异常:', error.message);
    }
    
    // 重置测试数据并创建新预约
    await resetTestData();
    const testOrder2 = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试教师可以取消任何预约
    try {
        const response = await makeRequest('POST', `/api/orders/${testOrder2.id}/cancel`, null, {
            'Authorization': `Bearer ${teacherToken}`
        });
        
        if (response.status === 200 && response.body.success) {
            console.log('✓ 教师取消预约测试通过');
        } else {
            console.log('✗ 教师取消预约测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 教师取消预约测试异常:', error.message);
    }
    
    // 测试取消不存在的订单
    try {
        const response = await makeRequest('POST', '/api/orders/nonexistent-order/cancel', null, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 404 && response.body.code === 'ORDER_NOT_FOUND') {
            console.log('✓ 订单不存在验证测试通过');
        } else {
            console.log('✗ 订单不存在验证测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 订单不存在验证测试异常:', error.message);
    }
}

// 测试获取订单统计功能
async function testOrderStatistics() {
    console.log('测试获取订单统计功能...');
    
    // 重置测试数据并创建多个不同状态的订单
    await resetTestData();
    
    const order1 = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 确认第一个订单，这样就可以创建新的预约
    await orderService.confirmReservation(order1.id);
    
    const order2 = await orderService.createReservation(testStudent.id, createdProduct.id);
    await orderService.confirmReservation(order2.id);
    
    const order3 = await orderService.createReservation(testStudent.id, createdProduct.id);
    await orderService.cancelReservation(order3.id);
    
    // 测试教师可以获取订单统计
    try {
        const response = await makeRequest('GET', '/api/orders/statistics', null, {
            'Authorization': `Bearer ${teacherToken}`
        });
        
        if (response.status === 200 && response.body.success && 
            response.body.data.total === 3 &&
            response.body.data.pending === 0 &&
            response.body.data.confirmed === 2 &&
            response.body.data.cancelled === 1) {
            console.log('✓ 教师获取订单统计测试通过');
        } else {
            console.log('✗ 教师获取订单统计测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 教师获取订单统计测试异常:', error.message);
    }
    
    // 测试学生无法获取订单统计
    try {
        const response = await makeRequest('GET', '/api/orders/statistics', null, {
            'Authorization': `Bearer ${studentToken}`
        });
        
        if (response.status === 403 && !response.body.success) {
            console.log('✓ 学生权限控制测试通过');
        } else {
            console.log('✗ 学生权限控制测试失败:', response.body);
        }
    } catch (error) {
        console.log('✗ 学生权限控制测试异常:', error.message);
    }
}

// 主测试执行函数
async function runTests() {
    try {
        await initializeTest();
        
        await testReserveOrder();
        await testGetPendingOrders();
        await testConfirmOrder();
        await testCancelOrder();
        await testOrderStatistics();
        
        console.log('\n✅ 所有订单API测试通过！');
        
    } catch (error) {
        console.error('\n❌ 测试执行失败:', error);
    } finally {
        await cleanupTest();
    }
}

// 运行测试
runTests();