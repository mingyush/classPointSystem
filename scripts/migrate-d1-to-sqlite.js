#!/usr/bin/env node

/**
 * D1到SQLite数据迁移脚本
 * 将Cloudflare D1数据库中的数据导出并迁移到SQLite数据库
 */

const sqlite3 = require('sqlite3').verbose();
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class D1ToSQLiteMigrator {
    constructor(options = {}) {
        this.d1DatabaseName = options.d1DatabaseName || 'classroom-points';
        this.sqliteDbPath = options.sqliteDbPath || path.join(process.cwd(), 'data', 'classroom_points.db');
        this.tempDir = path.join(process.cwd(), 'data', 'temp-migration');
        this.batchSize = options.batchSize || 100;
    }

    /**
     * 执行完整迁移流程
     */
    async migrate() {
        console.log('开始D1到SQLite数据迁移...');
        
        try {
            // 1. 验证D1数据库连接
            await this.validateD1Database();
            
            // 2. 创建临时目录
            await this.createTempDirectory();
            
            // 3. 导出D1数据
            const exportData = await this.exportD1Data();
            
            // 4. 初始化SQLite数据库
            await this.initializeSQLiteDatabase();
            
            // 5. 导入数据到SQLite
            await this.importToSQLite(exportData);
            
            // 6. 验证迁移结果
            await this.validateMigration(exportData);
            
            // 7. 清理临时文件
            await this.cleanup();
            
            console.log('✓ D1到SQLite数据迁移完成！');
            
        } catch (error) {
            console.error('迁移失败:', error.message);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * 验证D1数据库连接
     */
    async validateD1Database() {
        try {
            execSync(`wrangler d1 execute ${this.d1DatabaseName} --command="SELECT 1"`, {
                stdio: 'pipe'
            });
            console.log(`✓ D1数据库连接正常: ${this.d1DatabaseName}`);
        } catch (error) {
            throw new Error(`D1数据库连接失败: ${error.message}`);
        }
    }

    /**
     * 创建临时目录
     */
    async createTempDirectory() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
            console.log(`✓ 创建临时目录: ${this.tempDir}`);
        } catch (error) {
            throw new Error(`创建临时目录失败: ${error.message}`);
        }
    }

    /**
     * 导出D1数据
     */
    async exportD1Data() {
        const exportData = {};
        const tables = [
            'users',
            'point_records',
            'products', 
            'orders',
            'reward_penalty_items',
            'system_config',
            'system_state'
        ];
        
        for (const tableName of tables) {
            try {
                console.log(`导出表 ${tableName}...`);
                
                // 使用wrangler导出表数据为JSON
                const output = execSync(
                    `wrangler d1 execute ${this.d1DatabaseName} --command="SELECT * FROM ${tableName}" --json`,
                    { encoding: 'utf8', stdio: 'pipe' }
                );
                
                // 解析JSON输出
                const lines = output.trim().split('\n');
                const jsonData = [];
                
                for (const line of lines) {
                    if (line.trim() && line.startsWith('{')) {
                        try {
                            jsonData.push(JSON.parse(line));
                        } catch (parseError) {
                            console.warn(`解析JSON行失败: ${line}`);
                        }
                    }
                }
                
                exportData[tableName] = jsonData;
                console.log(`✓ 导出表 ${tableName}: ${jsonData.length} 条记录`);
                
                // 保存到临时文件
                const tempFile = path.join(this.tempDir, `${tableName}.json`);
                await fs.writeFile(tempFile, JSON.stringify(jsonData, null, 2));
                
            } catch (error) {
                console.warn(`警告: 导出表 ${tableName} 失败:`, error.message);
                exportData[tableName] = [];
            }
        }
        
        return exportData;
    }

    /**
     * 初始化SQLite数据库
     */
    async initializeSQLiteDatabase() {
        // 确保数据目录存在
        const dbDir = path.dirname(this.sqliteDbPath);
        await fs.mkdir(dbDir, { recursive: true });
        
        // 读取SQLite schema
        const schemaPath = path.join(process.cwd(), 'sql', 'sqlite_schema.sql');
        let schemaSQL;
        
        try {
            schemaSQL = await fs.readFile(schemaPath, 'utf8');
        } catch (error) {
            throw new Error(`读取SQLite schema失败: ${error.message}`);
        }
        
        // 创建数据库并执行schema
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.sqliteDbPath, (err) => {
                if (err) {
                    reject(new Error(`创建SQLite数据库失败: ${err.message}`));
                    return;
                }
                
                // 执行schema
                db.exec(schemaSQL, (execErr) => {
                    if (execErr) {
                        reject(new Error(`执行SQLite schema失败: ${execErr.message}`));
                    } else {
                        console.log(`✓ SQLite数据库初始化完成: ${this.sqliteDbPath}`);
                        db.close();
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * 导入数据到SQLite
     */
    async importToSQLite(exportData) {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.sqliteDbPath);
            
            // 开始事务
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                
                // 清空现有数据
                const tables = Object.keys(exportData);
                for (const table of tables) {
                    db.run(`DELETE FROM ${table}`);
                }
                
                let totalInserted = 0;
                let completedTables = 0;
                
                // 插入数据
                for (const [tableName, rows] of Object.entries(exportData)) {
                    if (rows.length === 0) {
                        completedTables++;
                        if (completedTables === tables.length) {
                            this.finalizeSQLiteImport(db, totalInserted, resolve, reject);
                        }
                        continue;
                    }
                    
                    const columns = Object.keys(rows[0]);
                    const placeholders = columns.map(() => '?').join(', ');
                    const insertSQL = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
                    
                    const stmt = db.prepare(insertSQL);
                    
                    for (const row of rows) {
                        const values = columns.map(col => row[col]);
                        stmt.run(values, (err) => {
                            if (err) {
                                console.warn(`插入数据失败 ${tableName}:`, err.message);
                            } else {
                                totalInserted++;
                            }
                        });
                    }
                    
                    stmt.finalize(() => {
                        console.log(`✓ 导入表 ${tableName}: ${rows.length} 条记录`);
                        completedTables++;
                        
                        if (completedTables === tables.length) {
                            this.finalizeSQLiteImport(db, totalInserted, resolve, reject);
                        }
                    });
                }
            });
        });
    }

    /**
     * 完成SQLite导入
     */
    finalizeSQLiteImport(db, totalInserted, resolve, reject) {
        db.run('COMMIT', (err) => {
            if (err) {
                db.run('ROLLBACK');
                reject(new Error(`提交事务失败: ${err.message}`));
            } else {
                console.log(`✓ SQLite数据导入完成: ${totalInserted} 条记录`);
                db.close();
                resolve();
            }
        });
    }

    /**
     * 验证迁移结果
     */
    async validateMigration(exportData) {
        console.log('验证迁移结果...');
        
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.sqliteDbPath);
            
            const tables = Object.keys(exportData);
            let completedTables = 0;
            
            for (const tableName of tables) {
                db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row) => {
                    if (err) {
                        console.warn(`⚠ 验证表 ${tableName} 失败:`, err.message);
                    } else {
                        const sqliteCount = row.count;
                        const d1Count = exportData[tableName].length;
                        
                        if (sqliteCount === d1Count) {
                            console.log(`✓ 表 ${tableName}: D1(${d1Count}) = SQLite(${sqliteCount})`);
                        } else {
                            console.warn(`⚠ 表 ${tableName}: D1(${d1Count}) ≠ SQLite(${sqliteCount})`);
                        }
                    }
                    
                    completedTables++;
                    if (completedTables === tables.length) {
                        db.close();
                        resolve();
                    }
                });
            }
        });
    }

    /**
     * 清理临时文件
     */
    async cleanup() {
        try {
            await fs.rmdir(this.tempDir, { recursive: true });
            console.log('✓ 清理临时文件完成');
        } catch (error) {
            console.warn('清理临时文件失败:', error.message);
        }
    }

    /**
     * 创建SQLite备份
     */
    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(
            path.dirname(this.sqliteDbPath),
            'backups',
            `sqlite-backup-${timestamp}.db`
        );
        
        // 确保备份目录存在
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        
        try {
            await fs.copyFile(this.sqliteDbPath, backupPath);
            console.log(`✓ SQLite备份创建: ${backupPath}`);
            return backupPath;
        } catch (error) {
            throw new Error(`创建SQLite备份失败: ${error.message}`);
        }
    }

    /**
     * 获取迁移统计信息
     */
    async getMigrationStats() {
        const stats = {
            d1Stats: {},
            sqliteStats: {},
            timestamp: new Date().toISOString()
        };
        
        const tables = ['users', 'point_records', 'products', 'orders', 'reward_penalty_items'];
        
        // D1统计
        for (const table of tables) {
            try {
                const output = execSync(
                    `wrangler d1 execute ${this.d1DatabaseName} --command="SELECT COUNT(*) as count FROM ${table}"`,
                    { encoding: 'utf8', stdio: 'pipe' }
                );
                
                const countMatch = output.match(/count.*?(\d+)/i);
                stats.d1Stats[table] = countMatch ? parseInt(countMatch[1]) : 0;
                
            } catch (error) {
                stats.d1Stats[table] = 0;
            }
        }
        
        // SQLite统计
        if (await this.fileExists(this.sqliteDbPath)) {
            const db = new sqlite3.Database(this.sqliteDbPath);
            
            for (const table of tables) {
                try {
                    const count = await new Promise((resolve, reject) => {
                        db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
                            if (err) reject(err);
                            else resolve(row.count);
                        });
                    });
                    stats.sqliteStats[table] = count;
                } catch (error) {
                    stats.sqliteStats[table] = 0;
                }
            }
            
            db.close();
        }
        
        return stats;
    }

    /**
     * 检查文件是否存在
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * 命令行接口
 */
async function main() {
    const args = process.argv.slice(2);
    
    const options = {
        d1DatabaseName: args[0] || 'classroom-points',
        sqliteDbPath: args[1] || path.join(process.cwd(), 'data', 'classroom_points.db'),
        batchSize: parseInt(args[2]) || 100
    };
    
    const migrator = new D1ToSQLiteMigrator(options);
    
    try {
        if (args.includes('--stats')) {
            const stats = await migrator.getMigrationStats();
            console.log('迁移统计信息:');
            console.log(JSON.stringify(stats, null, 2));
            return;
        }
        
        if (args.includes('--backup')) {
            const backupPath = await migrator.createBackup();
            console.log(`备份创建完成: ${backupPath}`);
            return;
        }
        
        if (args.includes('--help')) {
            console.log(`
D1到SQLite数据迁移工具

用法:
  node scripts/migrate-d1-to-sqlite.js [d1_database_name] [sqlite_db_path] [batch_size]

参数:
  d1_database_name  D1数据库名称 (默认: classroom-points)
  sqlite_db_path    SQLite数据库文件路径 (默认: data/classroom_points.db)
  batch_size        批处理大小 (默认: 100)

选项:
  --stats          显示迁移统计信息
  --backup         创建SQLite数据库备份
  --help           显示此帮助信息

示例:
  node scripts/migrate-d1-to-sqlite.js
  node scripts/migrate-d1-to-sqlite.js my-d1-db data/my_db.db 50
  node scripts/migrate-d1-to-sqlite.js --stats
  node scripts/migrate-d1-to-sqlite.js --backup

注意:
  1. 确保已安装并配置 Wrangler CLI
  2. 确保D1数据库存在且可访问
  3. 此操作会清空SQLite数据库中的现有数据
            `);
            return;
        }
        
        await migrator.migrate();
        
    } catch (error) {
        console.error('迁移失败:', error.message);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = { D1ToSQLiteMigrator };