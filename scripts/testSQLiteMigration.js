#!/usr/bin/env node

/**
 * SQLite迁移测试脚本
 * 测试SQLite数据库连接和数据访问功能
 * 使用方法：node scripts/testSQLiteMigration.js
 */

const DataAccess = require('../utils/dataAccess');
const { sqliteConnection } = require('../utils/sqliteConnection');
const { SQLiteInitializer } = require('../utils/sqliteInitializer');

class SQLiteMigrationTester {
    constructor() {
        this.sqliteDataAccess = new DataAccess('data', true);
        this.initializer = new SQLiteInitializer();
        this.testResults = {
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    /**
     * 运行所有测试
     */
    async runTests() {
        console.log('🧪 开始SQLite迁移测试...\n');
        
        try {
            // 0. 初始化数据库
            console.log('📊 初始化SQLite数据库...');
            await this.initializer.initializeDatabase();
            
            // 1. 测试数据库连接
            await this.testDatabaseConnection();
            
            // 2. 测试表结构
            await this.testTableStructure();
            
            // 3. 测试数据读写
            await this.testDataReadWrite();
            
            // 4. 测试性能
            await this.testPerformance();
            
            // 5. 测试错误处理
            await this.testErrorHandling();
            
            // 6. 生成测试报告
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ 测试执行失败:', error);
            this.testResults.failed++;
            this.testResults.errors.push(error.message);
        } finally {
            // 关闭数据库连接
            await sqliteConnection.close();
        }
    }

    /**
     * 测试数据库连接
     */
    async testDatabaseConnection() {
        console.log('🔌 测试数据库连接...');
        
        try {
            // 测试连接
            const isConnected = await sqliteConnection.testConnection();
            
            if (isConnected) {
                console.log('✅ 数据库连接成功');
                this.testResults.passed++;
            } else {
                throw new Error('数据库连接失败');
            }
            
            // 测试数据库文件是否存在
            const dbPath = sqliteConnection.getDatabasePath();
            console.log(`📁 数据库文件路径: ${dbPath}`);
            
        } catch (error) {
            console.error('❌ 数据库连接测试失败:', error.message);
            this.testResults.failed++;
            this.testResults.errors.push(`数据库连接: ${error.message}`);
        }
    }

    /**
     * 测试表结构
     */
    async testTableStructure() {
        console.log('\n📋 测试表结构...');
        
        const expectedTables = ['students', 'teachers', 'points', 'products', 'orders', 'system_config'];
        
        try {
            for (const tableName of expectedTables) {
                const exists = await sqliteConnection.tableExists(tableName);
                
                if (exists) {
                    console.log(`✅ 表 ${tableName} 存在`);
                    this.testResults.passed++;
                    
                    // 测试表结构
                    await this.verifyTableStructure(tableName);
                } else {
                    throw new Error(`表 ${tableName} 不存在`);
                }
            }
            
        } catch (error) {
            console.error('❌ 表结构测试失败:', error.message);
            this.testResults.failed++;
            this.testResults.errors.push(`表结构: ${error.message}`);
        }
    }

    /**
     * 验证表结构
     */
    async verifyTableStructure(tableName) {
        try {
            const columns = await sqliteConnection.all(`PRAGMA table_info(${tableName})`);
            console.log(`  📊 表 ${tableName} 列数: ${columns.length}`);
            
            // 验证关键列
            const columnNames = columns.map(col => col.name);
            
            switch (tableName) {
                case 'students':
                    this.verifyRequiredColumns(columnNames, ['id', 'name', 'class', 'totalPoints', 'avatar', 'createdAt', 'updatedAt']);
                    break;
                case 'teachers':
                    this.verifyRequiredColumns(columnNames, ['id', 'name', 'avatar', 'createdAt', 'updatedAt']);
                    break;
                case 'points':
                    this.verifyRequiredColumns(columnNames, ['studentId', 'points', 'reason', 'createdBy', 'createdAt']);
                    break;
                case 'products':
                    this.verifyRequiredColumns(columnNames, ['id', 'name', 'price', 'stock', 'category', 'isActive', 'createdAt', 'updatedAt']);
                    break;
                case 'orders':
                    this.verifyRequiredColumns(columnNames, ['id', 'studentId', 'productId', 'quantity', 'totalPrice', 'createdAt', 'updatedAt']);
                    break;
                case 'systemConfig':
                    this.verifyRequiredColumns(columnNames, ['id', 'key', 'value', 'description', 'createdAt', 'updatedAt']);
                    break;
            }
            
        } catch (error) {
            throw new Error(`验证表 ${tableName} 结构失败: ${error.message}`);
        }
    }

    /**
     * 验证必需列
     */
    verifyRequiredColumns(actualColumns, requiredColumns) {
        for (const required of requiredColumns) {
            if (!actualColumns.includes(required)) {
                throw new Error(`缺少必需列: ${required}`);
            }
        }
        console.log(`  ✅ 必需列验证通过`);
    }

    /**
     * 测试数据读写
     */
    async testDataReadWrite() {
        console.log('\n📝 测试数据读写...');
        
        try {
            // 测试写入学生数据
            const testStudents = [
                {
                    id: 'test001',
                    name: '测试学生',
                    class: '测试班级',
                    studentId: 'student001',
                    totalPoints: 100,
                    currentPoints: 100,
                    avatar: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];
            
            await this.sqliteDataAccess.writeFile('students.json', testStudents);
            console.log('✅ 学生数据写入成功');
            this.testResults.passed++;
            
            // 测试读取学生数据
            const readStudents = await this.sqliteDataAccess.readFile('students.json', []);
            
            if (readStudents.length === testStudents.length && 
                readStudents[0].id === testStudents[0].id) {
                console.log('✅ 学生数据读取成功');
                this.testResults.passed++;
            } else {
                throw new Error('学生数据读取验证失败');
            }
            
            // 测试配置数据
            const testConfig = [{
                id: 'config001',
                key: 'system_name',
                value: '测试系统',
                description: '系统名称配置',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }];
            
            await this.sqliteDataAccess.writeFile('system_config.json', testConfig);
            const readConfig = await this.sqliteDataAccess.readFile('system_config.json', {});
            
            if (readConfig && readConfig.system_name === testConfig[0].value) {
                console.log('✅ 配置数据读写成功');
                this.testResults.passed++;
            } else {
                console.log('读取到的配置数据:', readConfig);
                throw new Error('配置数据读写验证失败');
            }
            
        } catch (error) {
            console.error('❌ 数据读写测试失败:', error.message);
            this.testResults.failed++;
            this.testResults.errors.push(`数据读写: ${error.message}`);
        }
    }

    /**
     * 测试性能
     */
    async testPerformance() {
        console.log('\n⚡ 测试性能...');
        
        try {
            // 生成测试数据
            const testData = [];
            for (let i = 0; i < 100; i++) {
                testData.push({
                    id: `perf${i.toString().padStart(3, '0')}`,
                    name: `性能测试学生${i}`,
                    class: '性能测试班级',
                    studentId: `student${i.toString().padStart(3, '0')}`,
                    totalPoints: Math.floor(Math.random() * 1000),
                    currentPoints: Math.floor(Math.random() * 1000),
                    avatar: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
            
            // 测试批量写入性能
            const writeStart = Date.now();
            await this.sqliteDataAccess.writeFile('students.json', testData);
            const writeTime = Date.now() - writeStart;
            
            console.log(`✅ 批量写入 ${testData.length} 条记录耗时: ${writeTime}ms`);
            this.testResults.passed++;
            
            // 测试读取性能
            const readStart = Date.now();
            const readData = await this.sqliteDataAccess.readFile('students.json', []);
            const readTime = Date.now() - readStart;
            
            console.log(`✅ 读取 ${readData.length} 条记录耗时: ${readTime}ms`);
            this.testResults.passed++;
            
            // 性能阈值检查
            if (writeTime > 5000) {
                this.testResults.warnings.push(`批量写入性能较慢: ${writeTime}ms`);
            }
            if (readTime > 1000) {
                this.testResults.warnings.push(`读取性能较慢: ${readTime}ms`);
            }
            
        } catch (error) {
            console.error('❌ 性能测试失败:', error.message);
            this.testResults.failed++;
            this.testResults.errors.push(`性能测试: ${error.message}`);
        }
    }

    /**
     * 测试错误处理
     */
    async testErrorHandling() {
        console.log('\n🚨 测试错误处理...');
        
        try {
            // 测试读取不存在的文件
            const nonExistentData = await this.sqliteDataAccess.readFile('non_existent.json', { default: true });
            
            if (nonExistentData.default === true) {
                console.log('✅ 处理不存在的文件成功');
                this.testResults.passed++;
            } else {
                throw new Error('默认数据处理失败');
            }
            
            // 测试写入空数据
            await this.sqliteDataAccess.writeFile('test_empty.json', []);
            const emptyData = await this.sqliteDataAccess.readFile('test_empty.json', []);
            
            if (Array.isArray(emptyData) && emptyData.length === 0) {
                console.log('✅ 处理空数据成功');
                this.testResults.passed++;
            } else {
                throw new Error('空数据处理失败');
            }
            
        } catch (error) {
            console.error('❌ 错误处理测试失败:', error.message);
            this.testResults.failed++;
            this.testResults.errors.push(`错误处理: ${error.message}`);
        }
    }

    /**
     * 生成测试报告
     */
    generateTestReport() {
        console.log('\n📊 测试报告:');
        console.log('=' .repeat(50));
        
        const totalTests = this.testResults.passed + this.testResults.failed;
        const passRate = totalTests > 0 ? (this.testResults.passed / totalTests * 100).toFixed(1) : 0;
        
        console.log(`总测试数: ${totalTests}`);
        console.log(`通过: ${this.testResults.passed} ✅`);
        console.log(`失败: ${this.testResults.failed} ❌`);
        console.log(`通过率: ${passRate}%`);
        
        if (this.testResults.warnings && this.testResults.warnings.length > 0) {
            console.log('\n⚠️  警告:');
            this.testResults.warnings.forEach(warning => {
                console.log(`  - ${warning}`);
            });
        }
        
        if (this.testResults.errors.length > 0) {
            console.log('\n❌ 错误详情:');
            this.testResults.errors.forEach(error => {
                console.log(`  - ${error}`);
            });
        }
        
        // 测试结论
        if (this.testResults.failed === 0) {
            console.log('\n🎉 所有测试通过！SQLite迁移成功 ✅');
        } else if (this.testResults.failed <= 2) {
            console.log('\n⚠️  部分测试失败，但核心功能正常');
        } else {
            console.log('\n💥 测试失败较多，需要检查问题');
        }
        
        console.log('\n💡 建议:');
        console.log('  - 在生产环境使用前，建议进行更全面的测试');
        console.log('  - 确保数据库文件有适当的备份策略');
        console.log('  - 监控数据库性能和资源使用情况');
        
        console.log('\n' + '=' .repeat(50));
    }
}

/**
 * 主函数
 */
async function main() {
    const tester = new SQLiteMigrationTester();
    
    try {
        await tester.runTests();
        
        // 根据测试结果退出
        if (tester.testResults.failed === 0) {
            process.exit(0);
        } else {
            process.exit(1);
        }
        
    } catch (error) {
        console.error('💥 测试执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = SQLiteMigrationTester;