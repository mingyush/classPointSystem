const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs').promises;

/**
 * SQLite数据库连接管理器
 * 提供数据库连接池和基础操作方法
 */
class SQLiteConnection {
    constructor(dbPath = 'data/database.sqlite') {
        this.dbPath = dbPath;
        this.db = null;
        this.isConnected = false;
    }

    /**
     * 连接到SQLite数据库
     */
    async connect() {
        try {
            // 确保数据库目录存在
            const dbDir = path.dirname(this.dbPath);
            try {
                await fs.access(dbDir);
            } catch {
                await fs.mkdir(dbDir, { recursive: true });
            }

            // 连接数据库
            this.db = new Database(this.dbPath, {
                verbose: process.env.NODE_ENV === 'development' ? console.log : null,
                fileMustExist: false
            });

            // 暂时禁用外键约束进行调试
            this.db.pragma('foreign_keys = OFF');
            
            this.isConnected = true;
            console.log('SQLite数据库连接成功');
            return true;
        } catch (error) {
            console.error('SQLite数据库连接失败:', error);
            throw error;
        }
    }

    /**
     * 关闭数据库连接
     */
    close() {
        if (this.db) {
            try {
                this.db.close();
                this.db = null;
                this.isConnected = false;
                console.log('SQLite数据库连接已关闭');
            } catch (error) {
                console.error('关闭数据库连接失败:', error);
                throw error;
            }
        }
    }

    /**
     * 测试数据库连接
     */
    testConnection() {
        if (!this.db) {
            throw new Error('数据库未连接');
        }
        try {
            this.get('SELECT 1 as test');
            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 获取数据库路径
     */
    getDatabasePath() {
        return this.dbPath;
    }



    /**
     * 执行SQL查询（返回结果集）
     * @param {string} sql - SQL语句
     * @param {Array} params - 参数数组
     * @returns {Array} 查询结果
     */
    all(sql, params = []) {
        if (!this.db) {
            throw new Error('数据库未连接');
        }

        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.all(params);
            return result;
        } catch (error) {
            console.error('SQL查询失败:', error.message, 'SQL:', sql, '参数:', params);
            throw error;
        }
    }

    /**
     * 执行SQL命令（INSERT, UPDATE, DELETE）
     * @param {string} sql - SQL语句
     * @param {Array} params - 参数数组
     * @returns {Object} 执行结果信息
     */
    run(sql, params = []) {
        if (!this.db) {
            throw new Error('数据库未连接');
        }

        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.run(params);
            
            return {
                lastInsertRowid: result.lastInsertRowid,
                changes: result.changes
            };
        } catch (error) {
            console.error('SQL执行失败:', error.message, 'SQL:', sql, '参数:', params);
            throw error;
        }
    }

    /**
     * 执行单个查询（返回第一行）
     * @param {string} sql - SQL语句
     * @param {Array} params - 参数数组
     * @returns {Object|null} 第一行结果
     */
    get(sql, params = []) {
        if (!this.db) {
            throw new Error('数据库未连接');
        }

        try {
            const stmt = this.db.prepare(sql);
            const result = stmt.get(params);
            return result || null;
        } catch (error) {
            console.error('SQL查询失败:', error.message, 'SQL:', sql, '参数:', params);
            throw error;
        }
    }

    /**
     * 执行事务
     * @param {Function} callback - 事务回调函数
     * @returns {Promise} 事务结果
     */
    transaction(callback) {
        if (!this.db) {
            throw new Error('数据库未连接');
        }

        try {
            return this.db.transaction(callback)();
        } catch (error) {
            console.error('事务执行失败:', error);
            throw error;
        }
    }

    /**
     * 检查表是否存在
     * @param {string} tableName - 表名
     * @returns {boolean} 是否存在
     */
    tableExists(tableName) {
        if (!this.db) {
            throw new Error('数据库未连接');
        }
        
        try {
            const row = this.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                [tableName]
            );
            return !!row;
        } catch (error) {
            console.error(`检查表存在失败 ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * 获取数据库状态信息
     */
    async getStatus() {
        if (!this.db) {
            return { connected: false };
        }

        try {
            const result = await this.get('SELECT sqlite_version() as version');
            return {
                connected: true,
                version: result?.version,
                path: this.dbPath
            };
        } catch (error) {
            return { connected: false, error: error.message };
        }
    }
}

// 创建全局单例实例
const sqliteConnection = new SQLiteConnection();

module.exports = {
    SQLiteConnection,
    sqliteConnection
};