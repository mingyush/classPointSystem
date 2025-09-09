const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const app = require('../server');

// 测试备份API
async function testBackupAPI() {
    console.log('开始测试备份API...');
    
    let testsPassed = 0;
    let totalTests = 0;
    
    // 测试1: 创建系统备份
    totalTests++;
    try {
        console.log('测试1: 创建系统备份');
        const response = await request(app)
            .post('/api/backup/create')
            .expect(200);
        
        if (response.body.success && response.body.backupPath) {
            console.log('✓ 系统备份创建成功:', response.body.backupPath);
            testsPassed++;
        } else {
            console.log('✗ 系统备份创建失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 创建系统备份请求失败:', error.message);
    }
    
    // 测试2: 获取备份列表
    totalTests++;
    try {
        console.log('测试2: 获取备份列表');
        const response = await request(app)
            .get('/api/backup/list')
            .expect(200);
        
        if (response.body.success && Array.isArray(response.body.backups)) {
            console.log(`✓ 获取备份列表成功，共${response.body.backups.length}个备份`);
            testsPassed++;
        } else {
            console.log('✗ 获取备份列表失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 获取备份列表请求失败:', error.message);
    }
    
    // 测试3: 导出学生数据
    totalTests++;
    try {
        console.log('测试3: 导出学生数据');
        const response = await request(app)
            .post('/api/backup/export/students')
            .expect(200);
        
        if (response.body.success && response.body.filename) {
            console.log('✓ 学生数据导出成功:', response.body.filename);
            testsPassed++;
        } else {
            console.log('✗ 学生数据导出失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 导出学生数据请求失败:', error.message);
    }
    
    // 测试4: 导出积分数据
    totalTests++;
    try {
        console.log('测试4: 导出积分数据');
        const response = await request(app)
            .post('/api/backup/export/points')
            .expect(200);
        
        if (response.body.success && response.body.filename) {
            console.log('✓ 积分数据导出成功:', response.body.filename);
            testsPassed++;
        } else {
            console.log('✗ 积分数据导出失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 导出积分数据请求失败:', error.message);
    }
    
    // 测试5: 导出商品数据
    totalTests++;
    try {
        console.log('测试5: 导出商品数据');
        const response = await request(app)
            .post('/api/backup/export/products')
            .expect(200);
        
        if (response.body.success && response.body.filename) {
            console.log('✓ 商品数据导出成功:', response.body.filename);
            testsPassed++;
        } else {
            console.log('✗ 商品数据导出失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 导出商品数据请求失败:', error.message);
    }
    
    // 测试6: 导出预约数据
    totalTests++;
    try {
        console.log('测试6: 导出预约数据');
        const response = await request(app)
            .post('/api/backup/export/orders')
            .expect(200);
        
        if (response.body.success && response.body.filename) {
            console.log('✓ 预约数据导出成功:', response.body.filename);
            testsPassed++;
        } else {
            console.log('✗ 预约数据导出失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 导出预约数据请求失败:', error.message);
    }
    
    // 测试7: 导出系统配置
    totalTests++;
    try {
        console.log('测试7: 导出系统配置');
        const response = await request(app)
            .post('/api/backup/export/config')
            .expect(200);
        
        if (response.body.success && response.body.filename) {
            console.log('✓ 系统配置导出成功:', response.body.filename);
            testsPassed++;
        } else {
            console.log('✗ 系统配置导出失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 导出系统配置请求失败:', error.message);
    }
    
    // 测试8: 获取数据统计
    totalTests++;
    try {
        console.log('测试8: 获取数据统计');
        const response = await request(app)
            .get('/api/backup/statistics')
            .expect(200);
        
        if (response.body.success && response.body.statistics) {
            console.log('✓ 获取数据统计成功');
            testsPassed++;
            
            // 显示统计信息
            Object.entries(response.body.statistics).forEach(([filename, stat]) => {
                console.log(`  ${filename}: ${stat.recordCount}条记录`);
            });
        } else {
            console.log('✗ 获取数据统计失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 获取数据统计请求失败:', error.message);
    }
    
    // 测试9: 清理旧备份
    totalTests++;
    try {
        console.log('测试9: 清理旧备份');
        const response = await request(app)
            .post('/api/backup/cleanup')
            .send({ keepCount: 5 })
            .expect(200);
        
        if (response.body.success) {
            console.log(`✓ 清理完成，删除了${response.body.deletedCount}个文件`);
            testsPassed++;
        } else {
            console.log('✗ 清理备份失败:', response.body.message);
        }
    } catch (error) {
        console.log('✗ 清理备份请求失败:', error.message);
    }
    
    // 测试10: 无效数据类型导出
    totalTests++;
    try {
        console.log('测试10: 无效数据类型导出');
        const response = await request(app)
            .post('/api/backup/export/invalid')
            .expect(400);
        
        if (!response.body.success) {
            console.log('✓ 正确拒绝无效数据类型');
            testsPassed++;
        } else {
            console.log('✗ 应该拒绝无效数据类型');
        }
    } catch (error) {
        console.log('✗ 无效数据类型测试失败:', error.message);
    }
    
    // 输出测试结果
    console.log('\n=== 备份API测试结果 ===');
    console.log(`通过: ${testsPassed}/${totalTests}`);
    console.log(`成功率: ${((testsPassed / totalTests) * 100).toFixed(1)}%`);
    
    if (testsPassed === totalTests) {
        console.log('✓ 所有测试通过！');
        return true;
    } else {
        console.log('✗ 部分测试失败');
        return false;
    }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testBackupAPI()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('测试执行失败:', error);
            process.exit(1);
        });
}

module.exports = testBackupAPI;