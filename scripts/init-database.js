#!/usr/bin/env node

/**
 * 数据库初始化脚本
 * 用于初始化SQLite或D1数据库
 */

const DatabaseInitializer = require('../utils/databaseInitializer');
const path = require('path');

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    
    const initializer = new DatabaseInitializer();
    
    try {
        switch (command) {
            case 'sqlite':
                {
                    const dbPath = args[1] || path.join(process.cwd(), 'data', 'classroom_points.db');
                    console.log(`初始化SQLite数据库: ${dbPath}`);
                    await initializer.initializeSQLite(dbPath);
                }
                break;
                
            case 'd1':
                console.log('D1数据库需要通过Cloudflare Workers环境初始化');
                console.log('请使用以下命令:');
                console.log('wrangler d1 execute <DATABASE_NAME> --file=sql/d1_schema.sql');
                break;
                
            case 'migrate':
                {
                    const targetType = args[1] || 'sqlite';
                    const classId = args[2] || 'default';
                    console.log(`迁移JSON数据到${targetType}数据库...`);
                    await initializer.migrateFromJSON(targetType, classId);
                }
                break;
                
            case 'validate':
                {
                    const storageType = args[1] || 'sqlite';
                    console.log(`验证${storageType}数据库结构...`);
                    await initializer.validateDatabaseSchema(storageType);
                }
                break;
                
            case 'backup':
                {
                    const storageType = args[1] || 'sqlite';
                    const classId = args[2] || 'default';
                    console.log(`备份${storageType}数据库...`);
                    const backupFile = await initializer.createDatabaseBackup(storageType, classId);
                    console.log(`备份文件: ${backupFile}`);
                }
                break;
                
            case 'restore':
                {
                    const backupFile = args[1];
                    const storageType = args[2] || 'sqlite';
                    const classId = args[3] || 'default';
                    
                    if (!backupFile) {
                        console.error('请指定备份文件路径');
                        process.exit(1);
                    }
                    
                    console.log(`从备份恢复${storageType}数据库...`);
                    await initializer.restoreFromBackup(backupFile, storageType, classId);
                }
                break;
                
            case 'stats':
                {
                    const storageType = args[1] || 'sqlite';
                    const classId = args[2] || 'default';
                    console.log(`获取${storageType}数据库统计...`);
                    const stats = await initializer.getDatabaseStats(storageType, classId);
                    console.log(JSON.stringify(stats, null, 2));
                }
                break;
                
            case 'clean':
                {
                    const storageType = args[1] || 'sqlite';
                    const classId = args[2] || 'default';
                    
                    console.log('警告：此操作将清空所有数据！');
                    console.log('请在5秒内按Ctrl+C取消...');
                    
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    console.log(`清理${storageType}数据库...`);
                    await initializer.cleanDatabase(storageType, classId);
                }
                break;
                
            default:
                console.log('数据库初始化工具');
                console.log('');
                console.log('用法:');
                console.log('  node scripts/init-database.js <command> [options]');
                console.log('');
                console.log('命令:');
                console.log('  sqlite [db_path]              初始化SQLite数据库');
                console.log('  d1                             显示D1数据库初始化说明');
                console.log('  migrate <type> [class_id]      从JSON迁移数据到数据库');
                console.log('  validate <type>                验证数据库结构');
                console.log('  backup <type> [class_id]       创建数据库备份');
                console.log('  restore <file> <type> [class]  从备份恢复数据库');
                console.log('  stats <type> [class_id]        获取数据库统计信息');
                console.log('  clean <type> [class_id]        清理数据库（危险操作）');
                console.log('');
                console.log('存储类型:');
                console.log('  sqlite                         SQLite数据库');
                console.log('  d1                             Cloudflare D1数据库');
                console.log('  json                           JSON文件存储');
                console.log('');
                console.log('示例:');
                console.log('  node scripts/init-database.js sqlite');
                console.log('  node scripts/init-database.js migrate sqlite');
                console.log('  node scripts/init-database.js backup sqlite default');
                console.log('  node scripts/init-database.js validate sqlite');
                break;
        }
        
        console.log('操作完成！');
        process.exit(0);
        
    } catch (error) {
        console.error('操作失败:', error.message);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = { main };