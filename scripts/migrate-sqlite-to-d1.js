#!/usr/bin/env node

/**
 * SQLite到D1数据迁移脚本
 * 将SQLite数据库中的数据导出并迁移到Cloudflare D1数据库
 */

const sqlite3 = require('sqlite3').verbose();
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class SQLiteToD1Migrator {
    constructor(options = {}) {
        this.sqliteDbPath = options.sqliteDbPath || path.join(process.cwd(), 'data', 'classroom_points.db');
        this.d1DatabaseName = options.d1DatabaseName || 'classroom-points';
        this.tempDir = path.join(process.cwd(), 'data', 'temp-migration');
        this.batchSize = options.batchSize || 100;
    }

    /**
     * 执行完整迁移流程
     */
    async migrate() {
        console.log('开始SQLite到D1数据迁移...');
        
        try {
            // 1. 验证源数据库
            await this.validateSQLiteDatabase();
            
            // 2. 创建临时目录
            await this.createTempDirectory();
            
            // 3. 导出SQLite数据
            const exportData = await this.exportSQLiteData();
            
            // 4. 生成D1迁移SQL
            await this.generateD1MigrationSQL(exportData);
            
            // 5. 执行D1迁移
            await this.executeD1Migration();
            
            // 6. 验证迁移结果
            await this.validateMigration(exportData);
            
            // 7. 清理临时文件
            await this.cleanup();
            
            console.log('✓ SQLite到D1数据迁移完成！');
            
        } catch (error) {
            console.error('迁移失败:', error.message);
            await this.cleanup();
            throw error;
        }
    }

    /**
     * 验证SQLite数据库
     */
    async validateSQLiteDatabase() {
        try {
            await fs.access(this.sqliteDbPath);
            console.log(`✓ SQLite数据库文件存在: ${this.sqliteDbPath}`);
        } catch (error) {
            throw new Error(`SQLite数据库文件不存在: ${this.sqliteDbPath}`);
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
     * 导出SQLite数据
     */
    async exportSQLiteData() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.sqliteDbPath);
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
            
            let completedTables = 0;
            
            tables.forEach(tableName => {
                db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
                    if (err) {
                        console.warn(`警告: 导出表 ${tableName} 失败:`, err.message);
                        exportData[tableName] = [];
                    } else {
                        exportData[tableName] = rows;
                        console.log(`✓ 导出表 ${tableName}: ${rows.length} 条记录`);
                    }
                    
                    completedTables++;
                    if (completedTables === tables.length) {
                        db.close();
                        resolve(exportData);
                    }
                });
            });
        });
    }

    /**
     * 生成D1迁移SQL
     */
    async generateD1MigrationSQL(exportData) {
        const sqlStatements = [];
        
        // 清空现有数据（可选）
        const tables = Object.keys(exportData);
        for (const table of tables) {
            sqlStatements.push(`DELETE FROM ${table};`);
        }
        
        // 生成插入语句
        for (const [tableName, rows] of Object.entries(exportData)) {
            if (rows.length === 0) continue;
            
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(', ');
            
            // 分批处理大量数据
            for (let i = 0; i < rows.length; i += this.batchSize) {
                const batch = rows.slice(i, i + this.batchSize);
                
                for (const row of batch) {
                    const values = columns.map(col => {
                        const value = row[col];
                        if (value === null || value === undefined) {
                            return 'NULL';
                        } else if (typeof value === 'string') {
                            return `'${value.replace(/'/g, "''")}'`;
                        } else {
                            return value;
                        }
                    }).join(', ');
                    
                    sqlStatements.push(
                        `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});`
                    );
                }
            }
        }
        
        // 写入SQL文件
        const sqlContent = sqlStatements.join('\n');
        const sqlFilePath = path.join(this.tempDir, 'migration.sql');
        await fs.writeFile(sqlFilePath, sqlContent, 'utf8');
        
        console.log(`✓ 生成D1迁移SQL: ${sqlFilePath} (${sqlStatements.length} 条语句)`);
        return sqlFilePath;
    }

    /**
     * 执行D1迁移
     */
    async executeD1Migration() {
        const sqlFilePath = path.join(this.tempDir, 'migration.sql');
        
        try {
            console.log('执行D1数据迁移...');
            
            execSync(`wrangler d1 execute ${this.d1DatabaseName} --file=${sqlFilePath}`, {
                stdio: 'inherit'
            });
            
            console.log('✓ D1数据迁移执行完成');
            
        } catch (error) {
            throw new Error(`D1迁移执行失败: ${error.message}`);
        }
    }

    /**
     * 验证迁移结果
     */
    async validateMigration(exportData) {
        console.log('验证迁移结果...');
        
        for (const [tableName, rows] of Object.entries(exportData)) {
            try {
                const output = execSync(
                    `wrangler d1 execute ${this.d1DatabaseName} --command="SELECT COUNT(*) as count FROM ${tableName}"`,
                    { encoding: 'utf8', stdio: 'pipe' }
                );
                
                // 解析输出中的计数
                const countMatch = output.match(/count.*?(\d+)/i);
                const d1Count = countMatch ? parseInt(countMatch[1]) : 0;
                const sqliteCount = rows.length;
                
                if (d1Count === sqliteCount) {
                    console.log(`✓ 表 ${tableName}: SQLite(${sqliteCount}) = D1(${d1Count})`);
                } else {
                    console.warn(`⚠ 表 ${tableName}: SQLite(${sqliteCount}) ≠ D1(${d1Count})`);
                }
                
            } catch (error) {
                console.warn(`⚠ 验证表 ${tableName} 失败:`, error.message);
            }
        }
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
     * 获取迁移统计信息
     */
    async getMigrationStats() {
        const stats = {
            sqliteStats: {},
            d1Stats: {},
            timestamp: new Date().toISOString()
        };
        
        // SQLite统计
        const db = new sqlite3.Database(this.sqliteDbPath);
        const tables = ['users', 'point_records', 'products', 'orders', 'reward_penalty_items'];
        
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
        
        return stats;
    }
}

/**
 * 命令行接口
 */
async function main() {
    const args = process.argv.slice(2);
    
    const options = {
        sqliteDbPath: args[0] || path.join(process.cwd(), 'data', 'classroom_points.db'),
        d1DatabaseName: args[1] || 'classroom-points',
        batchSize: parseInt(args[2]) || 100
    };
    
    const migrator = new SQLiteToD1Migrator(options);
    
    try {
        if (args.includes('--stats')) {
            const stats = await migrator.getMigrationStats();
            console.log('迁移统计信息:');
            console.log(JSON.stringify(stats, null, 2));
            return;
        }
        
        if (args.includes('--help')) {
            console.log(`
SQLite到D1数据迁移工具

用法:
  node scripts/migrate-sqlite-to-d1.js [sqlite_db_path] [d1_database_name] [batch_size]

参数:
  sqlite_db_path    SQLite数据库文件路径 (默认: data/classroom_points.db)
  d1_database_name  D1数据库名称 (默认: classroom-points)
  batch_size        批处理大小 (默认: 100)

选项:
  --stats          显示迁移统计信息
  --help           显示此帮助信息

示例:
  node scripts/migrate-sqlite-to-d1.js
  node scripts/migrate-sqlite-to-d1.js data/my_db.db my-d1-db 50
  node scripts/migrate-sqlite-to-d1.js --stats

注意:
  1. 确保已安装并配置 Wrangler CLI
  2. 确保D1数据库已创建并配置正确
  3. 此操作会清空D1数据库中的现有数据
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

module.exports = { SQLiteToD1Migrator };