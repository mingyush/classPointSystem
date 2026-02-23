/**
 * 测试isActive字段修复
 */

const DataAccess = require('./utils/dataAccess');
const DataInitializer = require('./utils/dataInitializer');

async function testIsActiveFieldFix() {
    console.log('🧪 开始测试isActive字段修复...\n');
    
    try {
        // 初始化数据
        const dataInitializer = new DataInitializer();
        await dataInitializer.initializeAllData();
        
        const dataAccess = new DataAccess();
        
        // 测试学生数据的isActive字段
        console.log('📚 测试学生表isActive字段...');
        const studentsData = await dataAccess.readFile('students.json', { students: [] });
        const students = studentsData.students;
        
        if (students.length === 0) {
            console.log('❌ 没有找到学生数据');
            return false;
        }
        
        const firstStudent = students[0];
        console.log(`学生数据示例: ${JSON.stringify(firstStudent, null, 2)}`);
        
        // 检查isActive字段类型
        if (typeof firstStudent.isActive !== 'boolean') {
            console.log(`❌ isActive字段类型错误: 期望boolean，实际${typeof firstStudent.isActive}`);
            return false;
        }
        
        console.log('✅ 学生表isActive字段类型正确 (boolean)');
        
        // 测试教师数据的isActive字段
        console.log('\n👨‍🏫 测试教师表isActive字段...');
        const teachersData = await dataAccess.readFile('teachers.json', { teachers: [] });
        const teachers = teachersData.teachers;
        
        if (teachers.length === 0) {
            console.log('❌ 没有找到教师数据');
            return false;
        }
        
        const firstTeacher = teachers[0];
        console.log(`教师数据示例: ${JSON.stringify(firstTeacher, null, 2)}`);
        
        // 检查isActive字段类型
        if (typeof firstTeacher.isActive !== 'boolean') {
            console.log(`❌ isActive字段类型错误: 期望boolean，实际${typeof firstTeacher.isActive}`);
            return false;
        }
        
        console.log('✅ 教师表isActive字段类型正确 (boolean)');
        
        // 测试商品数据的isActive字段
        console.log('\n🛍️ 测试商品表isActive字段...');
        const productsData = await dataAccess.readFile('products.json', { products: [] });
        const products = productsData.products;
        
        if (products.length === 0) {
            console.log('❌ 没有找到商品数据');
            return false;
        }
        
        const firstProduct = products[0];
        console.log(`商品数据示例: ${JSON.stringify(firstProduct, null, 2)}`);
        
        // 检查isActive字段类型
        if (typeof firstProduct.isActive !== 'boolean') {
            console.log(`❌ isActive字段类型错误: 期望boolean，实际${typeof firstProduct.isActive}`);
            return false;
        }
        
        console.log('✅ 商品表isActive字段类型正确 (boolean)');
        
        // 测试订单状态字段
        console.log('\n📦 测试订单表状态字段...');
        const ordersData = await dataAccess.readFile('orders.json', { orders: [] });
        const orders = ordersData.orders;
        
        if (orders.length > 0) {
            const firstOrder = orders[0];
            console.log(`订单数据示例: ${JSON.stringify(firstOrder, null, 2)}`);
            
            // 检查status字段类型
            if (typeof firstOrder.status !== 'string') {
                console.log(`❌ status字段类型错误: 期望string，实际${typeof firstOrder.status}`);
                return false;
            }
            
            // 检查status字段值
            const validStatuses = ['pending', 'confirmed', 'cancelled'];
            if (!validStatuses.includes(firstOrder.status)) {
                console.log(`❌ status字段值无效: ${firstOrder.status}`);
                return false;
            }
            
            console.log('✅ 订单表状态字段类型和值正确 (string)');
        } else {
            console.log('ℹ️ 没有订单数据，跳过订单状态测试');
        }
        
        console.log('\n🎉 所有字段类型测试通过！');
        return true;
        
    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        return false;
    }
}

// 运行测试
if (require.main === module) {
    testIsActiveFieldFix()
        .then(success => {
            console.log(`\n测试结果: ${success ? '✅ 成功' : '❌ 失败'}`);
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('测试运行失败:', error);
            process.exit(1);
        });
}

module.exports = testIsActiveFieldFix;