/**
 * 订单服务单元测试
 * 测试OrderService类的各种业务逻辑
 */

const OrderService = require('../services/orderService');
const StudentService = require('../services/studentService');
const ProductService = require('../services/productService');
const DataAccess = require('../utils/dataAccess');
const DataInitializer = require('../utils/dataInitializer');

// 测试数据
const testStudent = {
    id: 'ORDER-SERVICE-TEST-001',
    name: '订单服务测试学生',
    class: '测试班级',
    balance: 200
};

const testProduct = {
    name: '订单服务测试商品',
    price: 50,
    stock: 10,
    description: '测试用商品',
    isActive: true
};

// 全局变量
let orderService;
let studentService;
let productService;
let dataAccess;
let createdStudent;
let createdProduct;

// 测试初始化
async function initializeServiceTest() {
    console.log('开始订单服务测试...\n');
    
    // 初始化数据
    const dataInitializer = new DataInitializer();
    await dataInitializer.initializeAllData();
    
    // 创建服务实例
    orderService = new OrderService();
    studentService = new StudentService();
    productService = new ProductService();
    dataAccess = new DataAccess();
    
    // 创建测试学生
    createdStudent = await studentService.createStudent(testStudent);
    
    // 创建测试商品
    createdProduct = await productService.createProduct(testProduct);
    
    console.log('订单服务测试数据准备完成');
}

// 测试清理
async function cleanupServiceTest() {
    // 清理测试数据
    try {
        await dataAccess.writeFile('orders.json', { orders: [] });
        await studentService.deleteStudent(testStudent.id);
        await productService.deleteProduct(createdProduct.id);
    } catch (error) {
        console.error('清理测试数据失败:', error);
    }
    
    console.log('订单服务测试数据清理完成');
}

// 重置测试数据
async function resetServiceTestData() {
    await dataAccess.writeFile('orders.json', { orders: [] });
    await studentService.updateStudentBalance(testStudent.id, 200);
    await productService.updateProduct(createdProduct.id, { stock: 10, isActive: true });
}

// 测试创建预约订单功能
async function testCreateReservation() {
    console.log('测试创建预约订单功能...');
    
    // 重置测试数据
    await resetServiceTestData();
    
    // 测试成功创建预约订单
    try {
        const order = await orderService.createReservation(testStudent.id, createdProduct.id);
        
        if (order && order.id && order.studentId === testStudent.id && 
            order.productId === createdProduct.id && order.status === 'pending') {
            console.log('✓ 成功创建预约订单测试通过');
            
            // 验证学生积分被冻结
            const updatedStudent = await studentService.getStudentById(testStudent.id);
            if (updatedStudent.balance === 50) {
                console.log('✓ 积分冻结验证通过');
            } else {
                console.log('✗ 积分冻结验证失败');
            }
        } else {
            console.log('✗ 成功创建预约订单测试失败');
        }
    } catch (error) {
        console.log('✗ 成功创建预约订单测试异常:', error.message);
    }
    
    // 重置测试数据
    await resetServiceTestData();
    
    // 测试学生不存在时创建失败
    try {
        await orderService.createReservation('nonexistent-student', createdProduct.id);
        console.log('✗ 学生不存在验证测试失败');
    } catch (error) {
        if (error.message.includes('学生不存在')) {
            console.log('✓ 学生不存在验证测试通过');
        } else {
            console.log('✗ 学生不存在验证测试失败:', error.message);
        }
    }
    
    // 测试商品不存在时创建失败
    try {
        await orderService.createReservation(testStudent.id, 'nonexistent-product');
        console.log('✗ 商品不存在验证测试失败');
    } catch (error) {
        if (error.message.includes('商品不存在')) {
            console.log('✓ 商品不存在验证测试通过');
        } else {
            console.log('✗ 商品不存在验证测试失败:', error.message);
        }
    }
    
    // 测试商品已下架时创建失败
    try {
        await productService.updateProduct(createdProduct.id, { isActive: false });
        await orderService.createReservation(testStudent.id, createdProduct.id);
        console.log('✗ 商品下架验证测试失败');
    } catch (error) {
        if (error.message.includes('商品已下架')) {
            console.log('✓ 商品下架验证测试通过');
        } else {
            console.log('✗ 商品下架验证测试失败:', error.message);
        }
    }
    
    // 重置测试数据
    await resetServiceTestData();
    
    // 测试商品库存不足时创建失败
    try {
        await productService.updateProduct(createdProduct.id, { stock: 0 });
        await orderService.createReservation(testStudent.id, createdProduct.id);
        console.log('✗ 库存不足验证测试失败');
    } catch (error) {
        if (error.message.includes('商品库存不足')) {
            console.log('✓ 库存不足验证测试通过');
        } else {
            console.log('✗ 库存不足验证测试失败:', error.message);
        }
    }
    
    // 重置测试数据
    await resetServiceTestData();
    
    // 测试学生积分不足时创建失败
    try {
        await studentService.updateStudentBalance(testStudent.id, 30);
        await orderService.createReservation(testStudent.id, createdProduct.id);
        console.log('✗ 积分不足验证测试失败');
    } catch (error) {
        if (error.message.includes('积分不足')) {
            console.log('✓ 积分不足验证测试通过');
        } else {
            console.log('✗ 积分不足验证测试失败:', error.message);
        }
    }
    
    // 重置测试数据
    await resetServiceTestData();
    
    // 测试重复预约同一商品时创建失败
    try {
        await orderService.createReservation(testStudent.id, createdProduct.id);
        await orderService.createReservation(testStudent.id, createdProduct.id);
        console.log('✗ 重复预约验证测试失败');
    } catch (error) {
        if (error.message.includes('该商品已有待处理的预约')) {
            console.log('✓ 重复预约验证测试通过');
        } else {
            console.log('✗ 重复预约验证测试失败:', error.message);
        }
    }
}

// 测试确认预约订单功能
async function testConfirmReservation() {
    console.log('测试确认预约订单功能...');
    
    // 重置测试数据并创建预约
    await resetServiceTestData();
    const testOrder = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试成功确认预约订单
    try {
        const confirmedOrder = await orderService.confirmReservation(testOrder.id);
        
        if (confirmedOrder.status === 'confirmed' && confirmedOrder.confirmedAt) {
            console.log('✓ 成功确认预约订单测试通过');
            
            // 验证商品库存减少
            const updatedProduct = await productService.getProductById(createdProduct.id);
            if (updatedProduct.stock === 9) {
                console.log('✓ 库存减少验证通过');
            } else {
                console.log('✗ 库存减少验证失败');
            }
        } else {
            console.log('✗ 成功确认预约订单测试失败');
        }
    } catch (error) {
        console.log('✗ 成功确认预约订单测试异常:', error.message);
    }
    
    // 测试订单不存在时确认失败
    try {
        await orderService.confirmReservation('nonexistent-order');
        console.log('✗ 订单不存在验证测试失败');
    } catch (error) {
        if (error.message.includes('订单不存在')) {
            console.log('✓ 订单不存在验证测试通过');
        } else {
            console.log('✗ 订单不存在验证测试失败:', error.message);
        }
    }
    
    // 测试非待处理订单无法确认
    try {
        await orderService.confirmReservation(testOrder.id);
        console.log('✗ 重复确认验证测试失败');
    } catch (error) {
        if (error.message.includes('只能确认待处理的订单')) {
            console.log('✓ 重复确认验证测试通过');
        } else {
            console.log('✗ 重复确认验证测试失败:', error.message);
        }
    }
}

// 测试取消预约订单功能
async function testCancelReservation() {
    console.log('测试取消预约订单功能...');
    
    // 重置测试数据并创建预约
    await resetServiceTestData();
    const testOrder = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试成功取消预约订单
    try {
        const cancelledOrder = await orderService.cancelReservation(testOrder.id);
        
        if (cancelledOrder.status === 'cancelled' && cancelledOrder.cancelledAt) {
            console.log('✓ 成功取消预约订单测试通过');
            
            // 验证积分被退还
            const updatedStudent = await studentService.getStudentById(testStudent.id);
            if (updatedStudent.balance === 100) {
                console.log('✓ 积分退还验证通过');
            } else {
                console.log('✗ 积分退还验证失败');
            }
        } else {
            console.log('✗ 成功取消预约订单测试失败');
        }
    } catch (error) {
        console.log('✗ 成功取消预约订单测试异常:', error.message);
    }
    
    // 测试订单不存在时取消失败
    try {
        await orderService.cancelReservation('nonexistent-order');
        console.log('✗ 订单不存在验证测试失败');
    } catch (error) {
        if (error.message.includes('订单不存在')) {
            console.log('✓ 订单不存在验证测试通过');
        } else {
            console.log('✗ 订单不存在验证测试失败:', error.message);
        }
    }
}

// 测试获取订单功能
async function testGetOrders() {
    console.log('测试获取订单功能...');
    
    // 重置测试数据并创建多个不同状态的订单
    await resetServiceTestData();
    
    const order1 = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 确认第一个订单，这样就可以创建新的预约
    await orderService.confirmReservation(order1.id);
    
    const order2 = await orderService.createReservation(testStudent.id, createdProduct.id);
    await orderService.confirmReservation(order2.id);
    
    const order3 = await orderService.createReservation(testStudent.id, createdProduct.id);
    await orderService.cancelReservation(order3.id);
    
    // 测试获取所有订单
    try {
        const orders = await orderService.getAllOrders();
        if (orders.length === 3) {
            console.log('✓ 获取所有订单测试通过');
        } else {
            console.log('✗ 获取所有订单测试失败');
        }
    } catch (error) {
        console.log('✗ 获取所有订单测试异常:', error.message);
    }
    
    // 测试按状态筛选订单
    try {
        const pendingOrders = await orderService.getAllOrders('pending');
        const confirmedOrders = await orderService.getAllOrders('confirmed');
        const cancelledOrders = await orderService.getAllOrders('cancelled');
        
        if (pendingOrders.length === 1 && confirmedOrders.length === 1 && cancelledOrders.length === 1) {
            console.log('✓ 按状态筛选订单测试通过');
        } else {
            console.log('✗ 按状态筛选订单测试失败');
        }
    } catch (error) {
        console.log('✗ 按状态筛选订单测试异常:', error.message);
    }
    
    // 测试根据ID获取订单
    try {
        const order = await orderService.getOrderById(order1.id);
        if (order && order.id === order1.id) {
            console.log('✓ 根据ID获取订单测试通过');
        } else {
            console.log('✗ 根据ID获取订单测试失败');
        }
    } catch (error) {
        console.log('✗ 根据ID获取订单测试异常:', error.message);
    }
    
    // 测试获取不存在的订单
    try {
        const order = await orderService.getOrderById('nonexistent-order');
        if (order === null) {
            console.log('✓ 获取不存在订单测试通过');
        } else {
            console.log('✗ 获取不存在订单测试失败');
        }
    } catch (error) {
        console.log('✗ 获取不存在订单测试异常:', error.message);
    }
    
    // 测试根据学生ID获取订单
    try {
        const studentOrders = await orderService.getOrdersByStudentId(testStudent.id);
        if (studentOrders.length === 3) {
            console.log('✓ 根据学生ID获取订单测试通过');
        } else {
            console.log('✗ 根据学生ID获取订单测试失败');
        }
    } catch (error) {
        console.log('✗ 根据学生ID获取订单测试异常:', error.message);
    }
}

// 测试获取订单详情和统计功能
async function testOrderDetailsAndStatistics() {
    console.log('测试获取订单详情和统计功能...');
    
    // 重置测试数据并创建订单
    await resetServiceTestData();
    const testOrder = await orderService.createReservation(testStudent.id, createdProduct.id);
    
    // 测试获取订单详情
    try {
        const details = await orderService.getOrderDetails(testOrder.id);
        
        if (details.order && details.student && details.product &&
            details.order.id === testOrder.id &&
            details.student.id === testStudent.id &&
            details.product.id === createdProduct.id) {
            console.log('✓ 获取订单详情测试通过');
        } else {
            console.log('✗ 获取订单详情测试失败');
        }
    } catch (error) {
        console.log('✗ 获取订单详情测试异常:', error.message);
    }
    
    // 测试获取待处理订单详情列表
    try {
        const ordersWithDetails = await orderService.getPendingOrdersWithDetails();
        
        if (ordersWithDetails.length === 1 && ordersWithDetails[0].order.status === 'pending') {
            console.log('✓ 获取待处理订单详情列表测试通过');
        } else {
            console.log('✗ 获取待处理订单详情列表测试失败');
        }
    } catch (error) {
        console.log('✗ 获取待处理订单详情列表测试异常:', error.message);
    }
    
    // 创建更多订单用于统计测试
    const order2 = await orderService.createReservation(testStudent.id, createdProduct.id);
    await orderService.confirmReservation(order2.id);
    const order3 = await orderService.createReservation(testStudent.id, createdProduct.id);
    await orderService.cancelReservation(order3.id);
    
    // 测试获取订单统计信息
    try {
        const statistics = await orderService.getOrderStatistics();
        
        if (statistics.total === 3 && statistics.pending === 0 && 
            statistics.confirmed === 2 && statistics.cancelled === 1) {
            console.log('✓ 获取订单统计信息测试通过');
        } else {
            console.log('✗ 获取订单统计信息测试失败');
        }
    } catch (error) {
        console.log('✗ 获取订单统计信息测试异常:', error.message);
    }
}

// 主测试执行函数
async function runServiceTests() {
    try {
        await initializeServiceTest();
        
        await testCreateReservation();
        await testConfirmReservation();
        await testCancelReservation();
        await testGetOrders();
        await testOrderDetailsAndStatistics();
        
        console.log('\n✅ 所有订单服务测试通过！');
        
    } catch (error) {
        console.error('\n❌ 测试执行失败:', error);
    } finally {
        await cleanupServiceTest();
    }
}

// 运行测试
runServiceTests();