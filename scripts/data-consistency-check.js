const DataAccess = require('../utils/dataAccess');
const StudentService = require('../services/studentService');
const PointsService = require('../services/pointsService');
const ProductService = require('../services/productService');
const OrderService = require('../services/orderService');

// 初始化服务
const studentService = new StudentService();
const pointsService = new PointsService();
const productService = new ProductService();
const orderService = new OrderService();

console.log('🔍 开始数据一致性检查...\n');

async function checkDataConsistency() {
    try {
        // 1. 检查学生表数据一致性
        console.log('📚 检查学生表数据一致性...');
        const students = await studentService.getAllStudents();
        console.log(`  ✅ 学生总数: ${students.length}`);
        
        // 检查学生ID唯一性
        const studentIds = students.map(s => s.id);
        const uniqueIds = [...new Set(studentIds)];
        if (studentIds.length === uniqueIds.length) {
            console.log('  ✅ 学生ID唯一性检查通过');
        } else {
            console.log('  ❌ 发现重复的学生ID');
        }

        // 2. 检查积分记录数据一致性
        console.log('\n💰 检查积分记录数据一致性...');
        const pointsRecords = await pointsService.getAllPointRecords();
        console.log(`  ✅ 积分记录总数: ${pointsRecords.length}`);
        
        // 检查积分记录的学生ID是否都存在
        const invalidStudentRecords = pointsRecords.filter(record => 
            !studentIds.includes(record.studentId)
        );
        if (invalidStudentRecords.length === 0) {
            console.log('  ✅ 积分记录学生ID引用完整性检查通过');
        } else {
            console.log(`  ❌ 发现${invalidStudentRecords.length}条无效的学生ID引用`);
        }

        // 3. 检查商品表数据一致性
        console.log('\n🛍️ 检查商品表数据一致性...');
        const products = await productService.getAllProducts();
        console.log(`  ✅ 商品总数: ${products.length}`);
        
        // 检查商品ID唯一性
        const productIds = products.map(p => p.id);
        const uniqueProductIds = [...new Set(productIds)];
        if (productIds.length === uniqueProductIds.length) {
            console.log('  ✅ 商品ID唯一性检查通过');
        } else {
            console.log('  ❌ 发现重复的商品ID');
        }

        // 检查商品库存是否为非负数
        const negativeStockProducts = products.filter(p => p.stock < 0);
        if (negativeStockProducts.length === 0) {
            console.log('  ✅ 商品库存非负数检查通过');
        } else {
            console.log(`  ❌ 发现${negativeStockProducts.length}个商品库存为负数`);
        }

        // 4. 检查订单表数据一致性
        console.log('\n📦 检查订单表数据一致性...');
        const orders = await orderService.getAllOrders();
        console.log(`  ✅ 订单总数: ${orders.length}`);
        
        // 检查订单的学生ID和商品ID引用完整性
        const invalidOrderStudents = orders.filter(order => 
            !studentIds.includes(order.studentId)
        );
        const invalidOrderProducts = orders.filter(order => 
            !productIds.includes(order.productId)
        );
        
        if (invalidOrderStudents.length === 0) {
            console.log('  ✅ 订单学生ID引用完整性检查通过');
        } else {
            console.log(`  ❌ 发现${invalidOrderStudents.length}条订单的学生ID无效`);
        }
        
        if (invalidOrderProducts.length === 0) {
            console.log('  ✅ 订单商品ID引用完整性检查通过');
        } else {
            console.log(`  ❌ 发现${invalidOrderProducts.length}条订单的商品ID无效`);
        }

        // 5. 检查库存约束问题
        console.log('\n📊 检查库存约束问题...');
        const lowStockProducts = products.filter(p => p.stock <= 5);
        console.log(`  ℹ️ 低库存商品(≤5): ${lowStockProducts.length}个`);
        
        if (lowStockProducts.length > 0) {
            console.log('  📋 低库存商品列表:');
            lowStockProducts.forEach(p => {
                console.log(`    - ${p.name}: 库存 ${p.stock}`);
            });
        }

        // 6. 检查数据类型一致性
        console.log('\n🔧 检查数据类型一致性...');
        
        // 检查学生表的isActive字段
        const invalidActiveStudents = students.filter(s => 
            typeof s.isActive !== 'boolean' && s.isActive !== 0 && s.isActive !== 1
        );
        if (invalidActiveStudents.length === 0) {
            console.log('  ✅ 学生isActive字段类型检查通过');
        } else {
            console.log(`  ❌ 发现${invalidActiveStudents.length}个学生的isActive字段类型异常`);
        }

        // 检查商品表的isActive字段
        const invalidActiveProducts = products.filter(p => 
            typeof p.isActive !== 'boolean' && p.isActive !== 0 && p.isActive !== 1
        );
        if (invalidActiveProducts.length === 0) {
            console.log('  ✅ 商品isActive字段类型检查通过');
        } else {
            console.log(`  ❌ 发现${invalidActiveProducts.length}个商品的isActive字段类型异常`);
        }

        console.log('\n✅ 数据一致性检查完成');
        
    } catch (error) {
        console.error('❌ 数据一致性检查失败:', error.message);
        process.exit(1);
    }
}

// 运行检查
checkDataConsistency();