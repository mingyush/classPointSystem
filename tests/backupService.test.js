const fs = require('fs').promises;
const path = require('path');
const BackupService = require('../services/backupService');

// 测试备份服务
async function testBackupService() {
    console.log('开始测试备份服务...');
    
    const backupService = new BackupService();
    let testsPassed = 0;
    let totalTests = 0;
    
    // 测试1: 创建完整系统备份
    totalTests++;
    try {
        console.log('测试1: 创建完整系统备份');
        const backupPath = await backupService.createFullBackup();
        
        // 检查备份文件是否存在
        const exists = await backupService.fileExists(backupPath);
        if (exists) {
            console.log('✓ 备份文件创建成功:', path.basename(backupPath));
            testsPassed++;
        } else {
            console.log('✗ 备份文件创建失败');
        }
    } catch (error) {
        console.log('✗ 创建备份失败:', error.message);
    }
    
    // 测试2: 获取备份列表
    totalTests++;
    try {
        console.log('测试2: 获取备份列表');
        const backupList = await backupService.getBackupList();
        
        if (Array.isArray(backupList)) {
            console.log(`✓ 获取备份列表成功，共${backupList.length}个备份文件`);
            testsPassed++;
            
            // 显示备份文件信息
            backupList.forEach((backup, index) => {
                console.log(`  ${index + 1}. ${backup.filename} (${formatFileSize(backup.size)})`);
            });
        } else {
            console.log('✗ 备份列表格式错误');
        }
    } catch (error) {
        console.log('✗ 获取备份列表失败:', error.message);
    }
    
    // 测试3: 导出单个数据文件
    totalTests++;
    try {
        console.log('测试3: 导出单个数据文件');
        const exportPath = await backupService.exportDataFile('config');
        
        const exists = await backupService.fileExists(exportPath);
        if (exists) {
            console.log('✓ 配置文件导出成功:', path.basename(exportPath));
            testsPassed++;
        } else {
            console.log('✗ 配置文件导出失败');
        }
    } catch (error) {
        console.log('✗ 导出配置文件失败:', error.message);
    }
    
    // 测试4: 获取数据统计信息
    totalTests++;
    try {
        console.log('测试4: 获取数据统计信息');
        const stats = await backupService.getDataStatistics();
        
        if (typeof stats === 'object' && stats !== null) {
            console.log('✓ 获取数据统计成功');
            testsPassed++;
            
            // 显示统计信息
            Object.entries(stats).forEach(([filename, stat]) => {
                console.log(`  ${filename}: ${stat.recordCount}条记录, ${formatFileSize(stat.size)}`);
            });
        } else {
            console.log('✗ 数据统计格式错误');
        }
    } catch (error) {
        console.log('✗ 获取数据统计失败:', error.message);
    }
    
    // 测试5: 验证备份文件完整性
    totalTests++;
    try {
        console.log('测试5: 验证备份文件完整性');
        
        // 创建临时测试目录
        const testDir = path.join('data', 'test-backup');
        await fs.mkdir(testDir, { recursive: true });
        
        // 创建测试文件
        const testFiles = ['students.json', 'points.json', 'config.json'];
        for (const file of testFiles) {
            const filePath = path.join(testDir, file);
            await fs.writeFile(filePath, JSON.stringify({ test: true }));
        }
        
        // 验证备份文件
        const isValid = await backupService.validateBackupFiles(testDir);
        
        // 清理测试目录
        await fs.rmdir(testDir, { recursive: true });
        
        if (isValid) {
            console.log('✓ 备份文件验证通过');
            testsPassed++;
        } else {
            console.log('✗ 备份文件验证失败');
        }
    } catch (error) {
        console.log('✗ 验证备份文件失败:', error.message);
    }
    
    // 测试6: 清理旧备份文件
    totalTests++;
    try {
        console.log('测试6: 清理旧备份文件');
        const deletedCount = await backupService.cleanOldExports(5);
        
        console.log(`✓ 清理完成，删除了${deletedCount}个旧备份文件`);
        testsPassed++;
    } catch (error) {
        console.log('✗ 清理备份文件失败:', error.message);
    }
    
    // 输出测试结果
    console.log('\n=== 备份服务测试结果 ===');
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

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testBackupService().catch(console.error);
}

module.exports = testBackupService;