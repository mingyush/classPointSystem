/**
 * 商品管理API单元测试
 * 测试商品CRUD操作、库存管理和权限验证功能
 */

const http = require('http');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const ProductService = require('../services/productService');
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
    app.use('/api/products', require('../api/products'));
    
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
    id: 'PROD_TEST001',
    name: '商品测试学生',
    class: '测试班级',
    balance: 100
};

const testTeacher = {
    teacherId: 'prod_admin',
    password: 'admin123'
};

const testProducts = [
    {
        id: 'test-prod-001',
        name: '测试笔记本',
        price: 50,
        stock: 10,
        description: '测试用笔记本',
        imageUrl: '',
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'test-prod-002',
        name: '测试钢笔',
        price: 30,
        stock: 0,
        description: '测试用钢笔',
        imageUrl: '',
        isActive: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'test-prod-003',
        name: '已下架商品',
        price: 20,
        stock: 5,
        description: '已下架的测试商品',
        imageUrl: '',
        isActive: false,
        createdAt: new Date().toISOString()
    }
];

// HTTP请求工具函数
function makeRequest(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: TEST_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const response = {
                        statusCode: res.statusCode,
                        body: JSON.parse(body)
                    };
                    resolve(response);
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        body: { error: 'Invalid JSON response', raw: body }
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

// 测试主函数
async function runProductTests() {
    console.log('开始商品管理API测试...\n');
    
    let server;
    let teacherToken;
    let studentToken;
    let productService;
    let studentService;
    
    try {
        // 初始化数据
        console.log('开始初始化数据文件...');
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        console.log('数据文件初始化完成');
        
        // 创建服务实例
        productService = new ProductService();
        studentService = new StudentService();
        
        // 准备测试数据
        console.log('准备商品测试数据...');
        try {
            await studentService.createStudent(testStudent);
        } catch (error) {
            if (!error.message.includes('已存在')) {
                throw error;
            }
            console.log('测试学生已存在，跳过创建');
        }
        
        // 初始化测试商品数据
        const productsData = { products: testProducts };
        await productService.dataAccess.writeFile('products.json', productsData);
        
        console.log('商品测试数据准备完成');
        
        // 启动测试服务器
        const app = createTestApp();
        server = app.listen(TEST_PORT);
        console.log(`测试服务器启动在端口 ${TEST_PORT}`);
        
        // 等待服务器启动
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 获取认证令牌
        console.log('获取认证令牌...');
        const teacherLoginResponse = await makeRequest('POST', '/api/auth/teacher-login', testTeacher);
        if (teacherLoginResponse.statusCode !== 200) {
            throw new Error('教师登录失败: ' + JSON.stringify(teacherLoginResponse.body));
        }
        teacherToken = teacherLoginResponse.body.data.token;
        
        const studentLoginResponse = await makeRequest('POST', '/api/auth/student-login', { studentId: testStudent.id });
        if (studentLoginResponse.statusCode !== 200) {
            throw new Error('学生登录失败: ' + JSON.stringify(studentLoginResponse.body));
        }
        studentToken = studentLoginResponse.body.data.token;
        
        console.log('认证令牌获取成功\n');
        
        // 运行测试用例
        await testGetProducts();
        await testGetProductById();
        await testCreateProduct();
        await testUpdateProduct();
        await testDeleteProduct();
        await testCheckStock();
        await testBatchUpdateStatus();
        await testProductService();
        
        console.log('\n✅ 所有商品管理API测试通过！');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        process.exit(1);
    } finally {
        // 清理资源
        if (server) {
            server.close();
        }
        
        // 清理测试数据
        console.log('清理商品测试数据...');
        try {
            await studentService.deleteStudent(testStudent.id);
            console.log('商品测试数据清理完成');
        } catch (error) {
            console.log('清理测试数据失败:', error.message);
        }
    }

    // 测试函数定义
    async function testGetProducts() {
        console.log('测试获取商品列表API...');
        
        // 测试获取所有商品
        const allProductsResponse = await makeRequest('GET', '/api/products');
        if (allProductsResponse.statusCode !== 200) {
            throw new Error('获取所有商品失败');
        }
        if (allProductsResponse.body.data.products.length !== 3) {
            throw new Error('商品数量不正确');
        }
        console.log('✓ 获取所有商品测试通过');
        
        // 测试只获取活跃商品
        const activeProductsResponse = await makeRequest('GET', '/api/products?active=true');
        if (activeProductsResponse.statusCode !== 200) {
            throw new Error('获取活跃商品失败');
        }
        if (activeProductsResponse.body.data.products.length !== 2) {
            throw new Error('活跃商品数量不正确');
        }
        console.log('✓ 获取活跃商品测试通过');
        
        // 测试商品搜索
        const searchResponse = await makeRequest('GET', '/api/products?search=' + encodeURIComponent('笔记本'));
        if (searchResponse.statusCode !== 200) {
            throw new Error('商品搜索失败');
        }
        if (searchResponse.body.data.products.length !== 1) {
            throw new Error('搜索结果数量不正确');
        }
        if (!searchResponse.body.data.products[0].name.includes('笔记本')) {
            throw new Error('搜索结果不正确');
        }
        console.log('✓ 商品搜索测试通过');
    }

    async function testGetProductById() {
        console.log('测试获取单个商品API...');
        
        // 测试获取存在的商品
        const existingProductResponse = await makeRequest('GET', '/api/products/test-prod-001');
        if (existingProductResponse.statusCode !== 200) {
            throw new Error('获取存在商品失败');
        }
        if (existingProductResponse.body.data.product.id !== 'test-prod-001') {
            throw new Error('商品ID不匹配');
        }
        console.log('✓ 获取存在商品测试通过');
        
        // 测试获取不存在的商品
        const nonExistentResponse = await makeRequest('GET', '/api/products/non-existent');
        if (nonExistentResponse.statusCode !== 404) {
            throw new Error('应该返回404');
        }
        if (nonExistentResponse.body.code !== 'PRODUCT_NOT_FOUND') {
            throw new Error('错误码不正确');
        }
        console.log('✓ 获取不存在商品测试通过');
    }

    async function testCreateProduct() {
        console.log('测试创建商品API...');
        
        const newProduct = {
            name: '新测试商品',
            price: 25,
            stock: 15,
            description: '这是一个新的测试商品',
            imageUrl: 'http://example.com/image.jpg'
        };
        
        // 测试教师创建商品
        const createResponse = await makeRequest('POST', '/api/products', newProduct, teacherToken);
        if (createResponse.statusCode !== 201) {
            throw new Error('教师创建商品失败: ' + JSON.stringify(createResponse.body));
        }
        if (createResponse.body.data.product.name !== newProduct.name) {
            throw new Error('创建的商品名称不正确');
        }
        console.log('✓ 教师创建商品测试通过');
        
        // 测试未认证请求
        const unauthResponse = await makeRequest('POST', '/api/products', newProduct);
        if (unauthResponse.statusCode !== 401) {
            throw new Error('应该拒绝未认证请求');
        }
        console.log('✓ 未认证请求验证测试通过');
        
        // 测试学生权限
        const studentResponse = await makeRequest('POST', '/api/products', newProduct, studentToken);
        if (studentResponse.statusCode !== 403) {
            throw new Error('应该拒绝学生请求');
        }
        console.log('✓ 学生权限验证测试通过');
        
        // 测试无效参数
        const invalidProduct = { price: 10, stock: 5 }; // 缺少name
        const invalidResponse = await makeRequest('POST', '/api/products', invalidProduct, teacherToken);
        if (invalidResponse.statusCode !== 400) {
            throw new Error('应该验证必需字段');
        }
        console.log('✓ 参数验证测试通过');
    }

    async function testUpdateProduct() {
        console.log('测试更新商品API...');
        
        const updateData = {
            name: '更新后的笔记本',
            price: 60,
            stock: 8
        };
        
        // 测试教师更新商品
        const updateResponse = await makeRequest('PUT', '/api/products/test-prod-001', updateData, teacherToken);
        if (updateResponse.statusCode !== 200) {
            throw new Error('教师更新商品失败');
        }
        if (updateResponse.body.data.product.name !== updateData.name) {
            throw new Error('更新的商品名称不正确');
        }
        console.log('✓ 教师更新商品测试通过');
        
        // 测试部分更新
        const partialUpdate = { price: 55 };
        const partialResponse = await makeRequest('PUT', '/api/products/test-prod-001', partialUpdate, teacherToken);
        if (partialResponse.statusCode !== 200) {
            throw new Error('部分更新失败');
        }
        if (partialResponse.body.data.product.price !== partialUpdate.price) {
            throw new Error('部分更新价格不正确');
        }
        console.log('✓ 部分更新测试通过');
        
        // 测试更新不存在的商品
        const notFoundResponse = await makeRequest('PUT', '/api/products/non-existent', updateData, teacherToken);
        if (notFoundResponse.statusCode !== 404) {
            throw new Error('应该返回404');
        }
        console.log('✓ 更新不存在商品测试通过');
        
        // 测试空更新数据
        const emptyResponse = await makeRequest('PUT', '/api/products/test-prod-001', {}, teacherToken);
        if (emptyResponse.statusCode !== 400) {
            throw new Error('应该拒绝空更新数据');
        }
        console.log('✓ 空更新数据验证测试通过');
    }

    async function testDeleteProduct() {
        console.log('测试删除商品API...');
        
        // 测试教师删除商品
        const deleteResponse = await makeRequest('DELETE', '/api/products/test-prod-001', null, teacherToken);
        if (deleteResponse.statusCode !== 200) {
            throw new Error('教师删除商品失败');
        }
        console.log('✓ 教师删除商品测试通过');
        
        // 验证商品已被软删除
        const getResponse = await makeRequest('GET', '/api/products/test-prod-001');
        if (getResponse.statusCode !== 200 || getResponse.body.data.product.isActive !== false) {
            throw new Error('商品应该被软删除');
        }
        console.log('✓ 软删除验证测试通过');
        
        // 测试删除不存在的商品
        const notFoundResponse = await makeRequest('DELETE', '/api/products/non-existent', null, teacherToken);
        if (notFoundResponse.statusCode !== 404) {
            throw new Error('应该返回404');
        }
        console.log('✓ 删除不存在商品测试通过');
        
        // 测试未认证请求
        const unauthResponse = await makeRequest('DELETE', '/api/products/test-prod-002');
        if (unauthResponse.statusCode !== 401) {
            throw new Error('应该拒绝未认证请求');
        }
        console.log('✓ 未认证删除请求验证测试通过');
    }

    async function testCheckStock() {
        console.log('测试检查库存API...');
        
        // 测试检查库存
        const stockResponse = await makeRequest('GET', '/api/products/test-prod-002/stock?quantity=1');
        if (stockResponse.statusCode !== 200) {
            throw new Error('检查库存失败');
        }
        if (stockResponse.body.data.currentStock !== 0 || stockResponse.body.data.hasStock !== false) {
            throw new Error('库存检查结果不正确');
        }
        console.log('✓ 检查库存测试通过');
        
        // 测试检查不存在商品的库存
        const notFoundResponse = await makeRequest('GET', '/api/products/non-existent/stock');
        if (notFoundResponse.statusCode !== 404) {
            throw new Error('应该返回404');
        }
        console.log('✓ 检查不存在商品库存测试通过');
        
        // 测试无效数量参数
        const invalidResponse = await makeRequest('GET', '/api/products/test-prod-002/stock?quantity=0');
        if (invalidResponse.statusCode !== 400) {
            throw new Error('应该验证数量参数');
        }
        console.log('✓ 无效数量参数验证测试通过');
    }

    async function testBatchUpdateStatus() {
        console.log('测试批量更新状态API...');
        
        const batchData = {
            productIds: ['test-prod-002', 'test-prod-003'],
            isActive: true
        };
        
        // 测试教师批量更新状态
        const batchResponse = await makeRequest('PATCH', '/api/products/batch-status', batchData, teacherToken);
        if (batchResponse.statusCode !== 200) {
            throw new Error('批量更新状态失败');
        }
        if (batchResponse.body.data.updatedCount !== 2) {
            throw new Error('更新数量不正确');
        }
        console.log('✓ 批量更新状态测试通过');
        
        // 测试空商品ID列表
        const emptyData = { productIds: [], isActive: true };
        const emptyResponse = await makeRequest('PATCH', '/api/products/batch-status', emptyData, teacherToken);
        if (emptyResponse.statusCode !== 400) {
            throw new Error('应该验证商品ID列表');
        }
        console.log('✓ 空商品ID列表验证测试通过');
        
        // 测试过多商品ID
        const tooManyIds = Array.from({ length: 51 }, (_, i) => `prod-${i}`);
        const tooManyData = { productIds: tooManyIds, isActive: true };
        const tooManyResponse = await makeRequest('PATCH', '/api/products/batch-status', tooManyData, teacherToken);
        if (tooManyResponse.statusCode !== 400) {
            throw new Error('应该限制批量操作数量');
        }
        console.log('✓ 批量操作数量限制测试通过');
    }

    async function testProductService() {
        console.log('测试ProductService...');
        
        // 测试创建商品
        const productData = {
            name: '服务测试商品',
            price: 100,
            stock: 20,
            description: '服务层测试商品'
        };
        
        const product = await productService.createProduct(productData);
        if (product.name !== productData.name || product.price !== productData.price) {
            throw new Error('创建商品失败');
        }
        console.log('✓ 创建商品测试通过');
        
        // 测试获取所有商品
        const products = await productService.getAllProducts();
        if (products.length === 0) {
            throw new Error('获取商品列表失败');
        }
        console.log('✓ 获取商品列表测试通过');
        
        // 测试根据ID获取商品
        const foundProduct = await productService.getProductById(product.id);
        if (!foundProduct || foundProduct.id !== product.id) {
            throw new Error('根据ID获取商品失败');
        }
        console.log('✓ 根据ID获取商品测试通过');
        
        // 测试更新商品
        const updateData = { name: '更新后的服务测试商品', price: 150 };
        const updatedProduct = await productService.updateProduct(product.id, updateData);
        if (updatedProduct.name !== updateData.name || updatedProduct.price !== updateData.price) {
            throw new Error('更新商品失败');
        }
        console.log('✓ 更新商品测试通过');
        
        // 测试检查库存
        const hasStock = await productService.checkStock(product.id, 5);
        const noStock = await productService.checkStock(product.id, 100);
        if (!hasStock || noStock) {
            throw new Error('检查库存失败');
        }
        console.log('✓ 检查库存测试通过');
        
        // 测试减少库存
        const originalStock = updatedProduct.stock;
        const reducedProduct = await productService.reduceStock(product.id, 5);
        if (reducedProduct.stock !== originalStock - 5) {
            throw new Error('减少库存失败');
        }
        console.log('✓ 减少库存测试通过');
        
        // 测试增加库存
        const currentStock = reducedProduct.stock;
        const increasedProduct = await productService.increaseStock(product.id, 10);
        if (increasedProduct.stock !== currentStock + 10) {
            throw new Error('增加库存失败');
        }
        console.log('✓ 增加库存测试通过');
        
        // 测试搜索商品
        const searchResults = await productService.searchProducts('服务测试');
        if (searchResults.length === 0 || !searchResults[0].name.includes('服务测试')) {
            throw new Error('搜索商品失败');
        }
        console.log('✓ 搜索商品测试通过');
        
        // 测试获取统计信息
        const statistics = await productService.getProductStatistics();
        if (typeof statistics.total !== 'number' || typeof statistics.totalValue !== 'number') {
            throw new Error('获取统计信息失败');
        }
        console.log('✓ 获取统计信息测试通过');
    }

}

// 运行测试
if (require.main === module) {
    runProductTests();
}