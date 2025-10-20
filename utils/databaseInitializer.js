/**
 * 数据库初始化工具
 * 负责创建数据库表结构和初始化数据
 */

const fs = require('fs').promises;
const path = require('path');
const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');

class DatabaseInitializer {
    constructor() {
        this.sqlDir = path.join(process.cwd(), 'sql');
    }

    /**
     * 根据环境变量自动初始化数据库
     */
    async initializeDatabase() {
        const dbType = process.env.DB_TYPE || 'sqlite';
        
        try {
            if (dbType === 'sqlite') {
                const dbPath = process.env.DB_PATH || './data/classroom_points.db';
                await this.initializeSQLite(dbPath);
            } else if (dbType === 'd1') {
                // D1数据库需要在Cloudflare Workers环境中初始化
                console.log('D1数据库将在Workers环境中初始化');
            } else {
                console.warn(`未知的数据库类型: ${dbType}，跳过初始化`);
            }
        } catch (error) {
            console.error('数据库初始化失败:', error);
            // 在开发环境中不抛出错误，允许系统继续运行
            if (process.env.NODE_ENV !== 'development') {
                throw error;
            }
        }
    }

    /**
     * 初始化SQLite数据库
     */
    async initializeSQLite(dbPath = null) {
        console.log('开始初始化SQLite数据库...');
        
        try {
            const config = dbPath ? { database: dbPath } : {};
            const adapter = await storageAdapterFactory.createAdapter('sqlite', config);
            
            // 读取并执行SQL脚本
            const sqlScript = await fs.readFile(path.join(this.sqlDir, 'sqlite_schema.sql'), 'utf8');
            await this.executeSQLScript(adapter, sqlScript);
            
            await adapter.disconnect();
            console.log('SQLite数据库初始化完成');
            
            return true;
        } catch (error) {
            console.error('SQLite数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化D1数据库
     */
    async initializeD1(db) {
        console.log('开始初始化D1数据库...');
        
        try {
            const adapter = await storageAdapterFactory.createAdapter('d1', { db });
            
            // 读取并执行SQL脚本
            const sqlScript = await fs.readFile(path.join(this.sqlDir, 'd1_schema.sql'), 'utf8');
            await this.executeSQLScript(adapter, sqlScript);
            
            console.log('D1数据库初始化完成');
            
            return true;
        } catch (error) {
            console.error('D1数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 执行SQL脚本
     */
    async executeSQLScript(adapter, sqlScript) {
        // 更智能的SQL语句分割
        const statements = this.parseSQLScript(sqlScript);

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    if (adapter.run) {
                        // SQLite适配器
                        await adapter.run(statement);
                    } else if (adapter.runSQL) {
                        // D1适配器
                        await adapter.runSQL(statement);
                    }
                } catch (error) {
                    // 忽略已存在的表或数据错误
                    if (!error.message.includes('already exists') && 
                        !error.message.includes('UNIQUE constraint failed') &&
                        !error.message.includes('no such table')) {
                        console.warn('SQL执行警告:', error.message);
                    }
                }
            }
        }
    }

    /**
     * 解析SQL脚本，正确处理多行语句
     */
    parseSQLScript(sqlScript) {
        const statements = [];
        let currentStatement = '';
        let inString = false;
        let stringChar = '';
        
        const lines = sqlScript.split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            // 跳过注释行
            if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
                continue;
            }
            
            // 处理字符串
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (!inString && (char === '"' || char === "'")) {
                    inString = true;
                    stringChar = char;
                } else if (inString && char === stringChar) {
                    inString = false;
                    stringChar = '';
                }
            }
            
            currentStatement += line + '\n';
            
            // 如果行以分号结尾且不在字符串中，则认为语句结束
            if (!inString && trimmedLine.endsWith(';')) {
                const statement = currentStatement.trim();
                if (statement.length > 0) {
                    statements.push(statement.slice(0, -1)); // 移除最后的分号
                }
                currentStatement = '';
            }
        }
        
        // 处理最后一个语句（如果没有分号结尾）
        if (currentStatement.trim().length > 0) {
            statements.push(currentStatement.trim());
        }
        
        return statements.filter(stmt => stmt.length > 0);
    }

    /**
     * 从JSON数据迁移到数据库
     */
    async migrateFromJSON(storageType, classId = 'default', config = {}) {
        console.log(`开始从JSON迁移数据到${storageType}数据库...`);
        
        try {
            // 创建目标数据库适配器
            const targetAdapter = await storageAdapterFactory.createAdapter(storageType, config);
            
            // 创建JSON适配器读取现有数据
            const jsonAdapter = await storageAdapterFactory.createAdapter('json');
            
            // 导出JSON数据
            const exportData = await jsonAdapter.exportClassData(classId);
            
            // 导入到目标数据库
            await targetAdapter.importClassData(classId, exportData.data);
            
            await targetAdapter.disconnect();
            await jsonAdapter.disconnect();
            
            console.log(`数据迁移完成: JSON -> ${storageType}`);
            return true;
        } catch (error) {
            console.error('数据迁移失败:', error);
            throw error;
        }
    }

    /**
     * 验证数据库结构
     */
    async validateDatabaseSchema(storageType, config = {}) {
        console.log(`验证${storageType}数据库结构...`);
        
        try {
            const adapter = await storageAdapterFactory.createAdapter(storageType, config);
            
            // 执行健康检查
            const health = await adapter.healthCheck();
            
            if (health.status !== 'healthy') {
                throw new Error(`数据库健康检查失败: ${health.message}`);
            }
            
            // 尝试执行基本查询来验证表结构
            const requiredTables = ['users', 'point_records', 'products', 'orders', 'reward_penalty_items'];
            
            for (const table of requiredTables) {
                try {
                    if (adapter.query) {
                        await adapter.query(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
                    } else if (adapter.querySQL) {
                        await adapter.querySQL(`SELECT COUNT(*) FROM ${table} LIMIT 1`);
                    }
                } catch (error) {
                    throw new Error(`表 ${table} 不存在或结构错误: ${error.message}`);
                }
            }
            
            await adapter.disconnect();
            console.log(`${storageType}数据库结构验证通过`);
            
            return true;
        } catch (error) {
            console.error(`${storageType}数据库结构验证失败:`, error);
            throw error;
        }
    }

    /**
     * 创建数据库备份
     */
    async createDatabaseBackup(storageType, classId = 'default', config = {}) {
        console.log(`创建${storageType}数据库备份...`);
        
        try {
            const adapter = await storageAdapterFactory.createAdapter(storageType, config);
            const exportData = await adapter.exportClassData(classId);
            
            const backupDir = path.join(process.cwd(), 'backups', 'database');
            await fs.mkdir(backupDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `${storageType}_backup_${timestamp}.json`);
            
            await fs.writeFile(backupFile, JSON.stringify(exportData, null, 2));
            
            await adapter.disconnect();
            console.log(`数据库备份已创建: ${backupFile}`);
            
            return backupFile;
        } catch (error) {
            console.error('数据库备份失败:', error);
            throw error;
        }
    }

    /**
     * 从备份恢复数据库
     */
    async restoreFromBackup(backupFile, storageType, classId = 'default', config = {}) {
        console.log(`从备份恢复${storageType}数据库...`);
        
        try {
            const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
            
            const adapter = await storageAdapterFactory.createAdapter(storageType, config);
            await adapter.importClassData(classId, backupData.data);
            
            await adapter.disconnect();
            console.log(`数据库恢复完成: ${backupFile} -> ${storageType}`);
            
            return true;
        } catch (error) {
            console.error('数据库恢复失败:', error);
            throw error;
        }
    }

    /**
     * 获取数据库统计信息
     */
    async getDatabaseStats(storageType, classId = 'default', config = {}) {
        try {
            const adapter = await storageAdapterFactory.createAdapter(storageType, config);
            const stats = await adapter.getClassStatistics(classId);
            
            await adapter.disconnect();
            
            return {
                storageType,
                classId,
                ...stats,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('获取数据库统计失败:', error);
            throw error;
        }
    }

    /**
     * 清理数据库（慎用）
     */
    async cleanDatabase(storageType, classId = 'default', config = {}) {
        console.log(`警告：正在清理${storageType}数据库...`);
        
        try {
            const adapter = await storageAdapterFactory.createAdapter(storageType, config);
            
            // 清空所有数据表（保留结构）
            const tables = ['point_records', 'orders', 'products', 'reward_penalty_items'];
            
            // 删除非管理员用户
            if (adapter.run) {
                await adapter.run('DELETE FROM users WHERE role != "admin"');
                for (const table of tables) {
                    await adapter.run(`DELETE FROM ${table}`);
                }
            } else if (adapter.runSQL) {
                await adapter.runSQL('DELETE FROM users WHERE role != "admin"');
                for (const table of tables) {
                    await adapter.runSQL(`DELETE FROM ${table}`);
                }
            }
            
            await adapter.disconnect();
            console.log(`${storageType}数据库清理完成`);
            
            return true;
        } catch (error) {
            console.error('数据库清理失败:', error);
            throw error;
        }
    }
}

module.exports = DatabaseInitializer;