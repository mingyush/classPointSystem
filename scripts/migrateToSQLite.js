#!/usr/bin/env node

/**
 * JSON到SQLite数据迁移脚本
 * 将现有的JSON文件数据迁移到SQLite数据库
 * 使用方法：node scripts/migrateToSQLite.js
 */

const fs = require('fs').promises;
const path = require('path');
const { sqliteConnection } = require('../utils/sqliteConnection');
const { SQLiteInitializer } = require('../utils/sqliteInitializer');
const DataAccess = require('../utils/dataAccess');

class DataMigrator {
    constructor() {
        this.jsonDataAccess = new DataAccess('data', false); // JSON模式
        this.sqliteDataAccess = new DataAccess('data', true); // SQLite模式
        this.initializer = new SQLiteInitializer();
        this.migrationResults = {
            success: true,
            tables: {},
            errors: [],
            warnings: []
        };
    }

    /**
     * 执行完整的数据迁移
     */
    async migrate() {
        console.log('🚀 开始JSON到SQLite数据迁移...');
        
        try {
            // 1. 初始化数据库
            console.log('📊 初始化SQLite数据库...');
            await this.initializer.initializeDatabase();
            
            // 2. 迁移各个数据表
            await this.migrateStudents();
            await this.migrateTeachers();
            await this.migratePoints();
            await this.migrateProducts();
            await this.migrateOrders();
            await this.migrateSystemConfig();
            
            // 3. 验证迁移结果
            await this.verifyMigration();
            
            // 4. 生成迁移报告
            this.generateReport();
            
            console.log('✅ 数据迁移完成！');
            
        } catch (error) {
            console.error('❌ 迁移失败:', error);
            this.migrationResults.success = false;
            this.migrationResults.errors.push(error.message);
            throw error;
        } finally {
            // 关闭数据库连接
            await sqliteConnection.close();
        }
    }

    /**
     * 迁移学生数据
     */
    async migrateStudents() {
        console.log('👥 迁移学生数据...');
        
        try {
            const students = await this.jsonDataAccess.readFile('students.json', []);
            
            if (students.length === 0) {
                console.log('⚠️  未找到学生数据，跳过');
                this.migrationResults.warnings.push('学生数据为空');
                return;
            }

            // 写入SQLite
            await this.sqliteDataAccess.writeFile('students.json', students);
            
            this.migrationResults.tables.students = {
                sourceCount: students.length,
                targetCount: students.length,
                status: 'success'
            };
            
            console.log(`✅ 迁移了 ${students.length} 条学生记录`);
            
        } catch (error) {
            console.error('❌ 学生数据迁移失败:', error);
            this.migrationResults.tables.students = {
                status: 'failed',
                error: error.message
            };
            this.migrationResults.errors.push(`学生数据迁移: ${error.message}`);
        }
    }

    /**
     * 迁移教师数据
     */
    async migrateTeachers() {
        console.log('👨‍🏫 迁移教师数据...');
        
        try {
            const teachers = await this.jsonDataAccess.readFile('teachers.json', []);
            
            if (teachers.length === 0) {
                console.log('⚠️  未找到教师数据，跳过');
                this.migrationResults.warnings.push('教师数据为空');
                return;
            }

            // 写入SQLite
            await this.sqliteDataAccess.writeFile('teachers.json', teachers);
            
            this.migrationResults.tables.teachers = {
                sourceCount: teachers.length,
                targetCount: teachers.length,
                status: 'success'
            };
            
            console.log(`✅ 迁移了 ${teachers.length} 条教师记录`);
            
        } catch (error) {
            console.error('❌ 教师数据迁移失败:', error);
            this.migrationResults.tables.teachers = {
                status: 'failed',
                error: error.message
            };
            this.migrationResults.errors.push(`教师数据迁移: ${error.message}`);
        }
    }

    /**
     * 迁移积分数据
     */
    async migratePoints() {
        console.log('⭐ 迁移积分数据...');
        
        try {
            const points = await this.jsonDataAccess.readFile('points.json', []);
            
            if (points.length === 0) {
                console.log('⚠️  未找到积分数据，跳过');
                this.migrationResults.warnings.push('积分数据为空');
                return;
            }

            // 写入SQLite
            await this.sqliteDataAccess.writeFile('points.json', points);
            
            this.migrationResults.tables.points = {
                sourceCount: points.length,
                targetCount: points.length,
                status: 'success'
            };
            
            console.log(`✅ 迁移了 ${points.length} 条积分记录`);
            
        } catch (error) {
            console.error('❌ 积分数据迁移失败:', error);
            this.migrationResults.tables.points = {
                status: 'failed',
                error: error.message
            };
            this.migrationResults.errors.push(`积分数据迁移: ${error.message}`);
        }
    }

    /**
     * 迁移商品数据
     */
    async migrateProducts() {
        console.log('🛍️  迁移商品数据...');
        
        try {
            const products = await this.jsonDataAccess.readFile('products.json', []);
            
            if (products.length === 0) {
                console.log('⚠️  未找到商品数据，跳过');
                this.migrationResults.warnings.push('商品数据为空');
                return;
            }

            // 写入SQLite
            await this.sqliteDataAccess.writeFile('products.json', products);
            
            this.migrationResults.tables.products = {
                sourceCount: products.length,
                targetCount: products.length,
                status: 'success'
            };
            
            console.log(`✅ 迁移了 ${products.length} 条商品记录`);
            
        } catch (error) {
            console.error('❌ 商品数据迁移失败:', error);
            this.migrationResults.tables.products = {
                status: 'failed',
                error: error.message
            };
            this.migrationResults.errors.push(`商品数据迁移: ${error.message}`);
        }
    }

    /**
     * 迁移订单数据
     */
    async migrateOrders() {
        console.log('📋 迁移订单数据...');
        
        try {
            const orders = await this.jsonDataAccess.readFile('orders.json', []);
            
            if (orders.length === 0) {
                console.log('⚠️  未找到订单数据，跳过');
                this.migrationResults.warnings.push('订单数据为空');
                return;
            }

            // 写入SQLite
            await this.sqliteDataAccess.writeFile('orders.json', orders);
            
            this.migrationResults.tables.orders = {
                sourceCount: orders.length,
                targetCount: orders.length,
                status: 'success'
            };
            
            console.log(`✅ 迁移了 ${orders.length} 条订单记录`);
            
        } catch (error) {
            console.error('❌ 订单数据迁移失败:', error);
            this.migrationResults.tables.orders = {
                status: 'failed',
                error: error.message
            };
            this.migrationResults.errors.push(`订单数据迁移: ${error.message}`);
        }
    }

    /**
     * 迁移系统配置数据
     */
    async migrateSystemConfig() {
        console.log('⚙️  迁移系统配置数据...');
        
        try {
            const config = await this.jsonDataAccess.readFile('system_config.json', {});
            
            if (Object.keys(config).length === 0) {
                console.log('⚠️  未找到系统配置数据，使用默认值');
                // 使用默认配置
                const defaultConfig = {
                    system_name: '班级积分管理系统',
                    point_name: '积分',
                    school_name: '学校名称',
                    current_term: '2024-2025学年第一学期',
                    backup_interval: 24,
                    max_points_per_record: 100,
                    min_points_per_record: -50
                };
                await this.sqliteDataAccess.writeFile('system_config.json', defaultConfig);
                this.migrationResults.tables.system_config = {
                    sourceCount: 0,
                    targetCount: Object.keys(defaultConfig).length,
                    status: 'success',
                    note: '使用默认配置'
                };
                return;
            }

            // 写入SQLite
            await this.sqliteDataAccess.writeFile('system_config.json', config);
            
            this.migrationResults.tables.system_config = {
                sourceCount: Object.keys(config).length,
                targetCount: Object.keys(config).length,
                status: 'success'
            };
            
            console.log(`✅ 迁移了 ${Object.keys(config).length} 条配置项`);
            
        } catch (error) {
            console.error('❌ 系统配置数据迁移失败:', error);
            this.migrationResults.tables.system_config = {
                status: 'failed',
                error: error.message
            };
            this.migrationResults.errors.push(`系统配置迁移: ${error.message}`);
        }
    }

    /**
     * 验证迁移结果
     */
    async verifyMigration() {
        console.log('🔍 验证迁移结果...');
        
        try {
            // 验证各个表的数据
            const tables = ['students', 'teachers', 'points', 'products', 'orders'];
            
            for (const table of tables) {
                const jsonData = await this.jsonDataAccess.readFile(`${table}.json`, []);
                const sqliteData = await this.sqliteDataAccess.readFile(`${table}.json`, []);
                
                if (jsonData.length !== sqliteData.length) {
                    this.migrationResults.warnings.push(
                        `${table}表数据数量不匹配: JSON=${jsonData.length}, SQLite=${sqliteData.length}`
                    );
                }
            }
            
            // 验证配置
            const jsonConfig = await this.jsonDataAccess.readFile('system_config.json', {});
            const sqliteConfig = await this.sqliteDataAccess.readFile('system_config.json', {});
            
            const jsonKeys = Object.keys(jsonConfig);
            const sqliteKeys = Object.keys(sqliteConfig);
            
            if (jsonKeys.length !== sqliteKeys.length) {
                this.migrationResults.warnings.push(
                    `配置项数量不匹配: JSON=${jsonKeys.length}, SQLite=${sqliteKeys.length}`
                );
            }
            
            console.log('✅ 迁移验证完成');
            
        } catch (error) {
            console.error('❌ 迁移验证失败:', error);
            this.migrationResults.warnings.push(`迁移验证: ${error.message}`);
        }
    }

    /**
     * 生成迁移报告
     */
    generateReport() {
        console.log('\n📊 迁移报告:');
        console.log('=' .repeat(50));
        
        if (this.migrationResults.success) {
            console.log('✅ 迁移状态: 成功');
        } else {
            console.log('❌ 迁移状态: 失败');
        }
        
        console.log('\n📋 表迁移详情:');
        Object.entries(this.migrationResults.tables).forEach(([table, result]) => {
            if (result.status === 'success') {
                console.log(`  ✅ ${table}: ${result.sourceCount} → ${result.targetCount} 条记录`);
                if (result.note) {
                    console.log(`     备注: ${result.note}`);
                }
            } else {
                console.log(`  ❌ ${table}: 失败 - ${result.error}`);
            }
        });
        
        if (this.migrationResults.warnings.length > 0) {
            console.log('\n⚠️  警告:');
            this.migrationResults.warnings.forEach(warning => {
                console.log(`  - ${warning}`);
            });
        }
        
        if (this.migrationResults.errors.length > 0) {
            console.log('\n❌ 错误:');
            this.migrationResults.errors.forEach(error => {
                console.log(`  - ${error}`);
            });
        }
        
        console.log('\n' + '=' .repeat(50));
    }

    /**
     * 创建迁移备份
     */
    async createMigrationBackup() {
        console.log('💾 创建迁移前备份...');
        
        try {
            const backupDir = path.join('data', 'migration_backup');
            await fs.mkdir(backupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupSubDir = path.join(backupDir, `backup_${timestamp}`);
            await fs.mkdir(backupSubDir, { recursive: true });
            
            // 复制JSON文件
            const files = ['students.json', 'teachers.json', 'points.json', 'products.json', 'orders.json', 'system_config.json'];
            
            for (const file of files) {
                try {
                    const sourcePath = path.join('data', file);
                    const destPath = path.join(backupSubDir, file);
                    await fs.copyFile(sourcePath, destPath);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.warn(`备份文件 ${file} 失败:`, error.message);
                    }
                }
            }
            
            console.log(`✅ 备份创建完成: ${backupSubDir}`);
            return backupSubDir;
            
        } catch (error) {
            console.error('❌ 备份创建失败:', error);
            throw error;
        }
    }
}

/**
 * 主函数
 */
async function main() {
    const migrator = new DataMigrator();
    
    try {
        // 创建备份
        await migrator.createMigrationBackup();
        
        // 执行迁移
        await migrator.migrate();
        
        console.log('\n🎉 迁移脚本执行完成！');
        console.log('💡 现在可以在应用配置中启用SQLite模式');
        console.log('📁 原始JSON文件已备份到 data/migration_backup/ 目录');
        
    } catch (error) {
        console.error('\n💥 迁移脚本执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DataMigrator;