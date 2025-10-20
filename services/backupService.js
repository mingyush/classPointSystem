const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const DataAccess = require('../utils/dataAccess');

/**
 * 备份服务 - 处理数据备份和恢复功能
 */
class BackupService {
    constructor() {
        this.dataAccess = new DataAccess();
        this.dataDir = 'data';
        this.backupDir = path.join(this.dataDir, 'backups');
        this.exportDir = path.join(this.dataDir, 'exports');
        
        // 数据文件列表
        this.dataFiles = [
            'students.json',
            'points.json',
            'products.json',
            'orders.json',
            'config.json'
        ];
    }

    /**
     * 确保导出目录存在
     */
    async ensureExportDirectory() {
        try {
            await fs.mkdir(this.exportDir, { recursive: true });
        } catch (error) {
            console.error('创建导出目录失败:', error);
            throw error;
        }
    }

    /**
     * 创建完整系统备份
     * @returns {Promise<string>} 备份文件路径
     */
    async createFullBackup() {
        await this.ensureExportDirectory();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `system-backup-${timestamp}.zip`;
        const backupPath = path.join(this.exportDir, backupFileName);
        
        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(backupPath);
            const archive = archiver('zip', { zlib: { level: 9 } });
            
            output.on('close', () => {
                console.log(`系统备份创建成功: ${backupFileName} (${archive.pointer()} bytes)`);
                resolve(backupPath);
            });
            
            archive.on('error', (err) => {
                console.error('创建备份失败:', err);
                reject(err);
            });
            
            archive.pipe(output);
            
            // 添加SQLite数据库文件
            const dbPath = path.join(this.dataDir, 'classroom_points.db');
            if (require('fs').existsSync(dbPath)) {
                archive.file(dbPath, { name: 'classroom_points.db' });
            }
            
            // 添加配置文件
            const configFiles = ['config.json', 'v1.json'];
            configFiles.forEach(file => {
                const configPath = path.join('config', file);
                if (require('fs').existsSync(configPath)) {
                    archive.file(configPath, { name: `config/${file}` });
                }
            });
            
            // 添加所有JSON数据文件（兼容性）
            this.dataFiles.forEach(file => {
                const filePath = path.join(this.dataDir, file);
                if (require('fs').existsSync(filePath)) {
                    archive.file(filePath, { name: file });
                }
            });
            
            // 添加备份目录（最近的备份文件）
            if (require('fs').existsSync(this.backupDir)) {
                archive.directory(this.backupDir, 'backups');
            }
            
            // 添加日志文件（最近7天）
            const logsDir = 'logs';
            if (require('fs').existsSync(logsDir)) {
                const logFiles = require('fs').readdirSync(logsDir);
                const recentLogs = logFiles.filter(file => {
                    const filePath = path.join(logsDir, file);
                    const stats = require('fs').statSync(filePath);
                    const daysDiff = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
                    return daysDiff <= 7;
                });
                
                recentLogs.forEach(file => {
                    archive.file(path.join(logsDir, file), { name: `logs/${file}` });
                });
            }
            
            archive.finalize();
        });
    }

    /**
     * 从备份文件恢复系统
     * @param {string} backupFilePath - 备份文件路径
     * @returns {Promise<boolean>} 恢复是否成功
     */
    async restoreFromBackup(backupFilePath) {
        try {
            // 创建临时恢复目录
            const tempDir = path.join(this.dataDir, 'temp-restore');
            await fs.mkdir(tempDir, { recursive: true });
            
            // 解压备份文件
            await new Promise((resolve, reject) => {
                require('fs').createReadStream(backupFilePath)
                    .pipe(unzipper.Extract({ path: tempDir }))
                    .on('close', resolve)
                    .on('error', reject);
            });
            
            // 验证备份文件完整性
            const isValid = await this.validateBackupFiles(tempDir);
            if (!isValid) {
                throw new Error('备份文件不完整或损坏');
            }
            
            // 备份当前数据（以防恢复失败）
            const currentBackupPath = await this.createFullBackup();
            console.log(`当前数据已备份到: ${currentBackupPath}`);
            
            // 恢复数据文件
            for (const file of this.dataFiles) {
                const tempFilePath = path.join(tempDir, file);
                const targetFilePath = path.join(this.dataDir, file);
                
                if (await this.fileExists(tempFilePath)) {
                    await fs.copyFile(tempFilePath, targetFilePath);
                    console.log(`恢复文件: ${file}`);
                }
            }
            
            // 清理临时目录
            await fs.rmdir(tempDir, { recursive: true });
            
            console.log('系统恢复完成');
            return true;
            
        } catch (error) {
            console.error('系统恢复失败:', error);
            throw error;
        }
    }

    /**
     * 验证备份文件完整性
     * @param {string} backupDir - 备份目录路径
     * @returns {Promise<boolean>} 是否有效
     */
    async validateBackupFiles(backupDir) {
        try {
            // 检查必要的数据文件是否存在
            const requiredFiles = ['students.json', 'points.json', 'config.json'];
            
            for (const file of requiredFiles) {
                const filePath = path.join(backupDir, file);
                if (!(await this.fileExists(filePath))) {
                    console.error(`缺少必要文件: ${file}`);
                    return false;
                }
                
                // 验证JSON格式
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    JSON.parse(content);
                } catch (parseError) {
                    console.error(`文件格式错误 ${file}:`, parseError.message);
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('验证备份文件失败:', error);
            return false;
        }
    }

    /**
     * 获取备份文件列表
     * @returns {Promise<Array>} 备份文件信息列表
     */
    async getBackupList() {
        try {
            await this.ensureExportDirectory();
            const files = await fs.readdir(this.exportDir);
            const backupFiles = files.filter(file => file.endsWith('.zip'));
            
            const backupList = [];
            for (const file of backupFiles) {
                const filePath = path.join(this.exportDir, file);
                const stats = await fs.stat(filePath);
                
                backupList.push({
                    filename: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                });
            }
            
            // 按创建时间倒序排列
            return backupList.sort((a, b) => b.created - a.created);
            
        } catch (error) {
            console.error('获取备份列表失败:', error);
            return [];
        }
    }

    /**
     * 删除备份文件
     * @param {string} filename - 备份文件名
     * @returns {Promise<boolean>} 删除是否成功
     */
    async deleteBackup(filename) {
        try {
            const filePath = path.join(this.exportDir, filename);
            await fs.unlink(filePath);
            console.log(`删除备份文件: ${filename}`);
            return true;
        } catch (error) {
            console.error(`删除备份文件失败 ${filename}:`, error);
            return false;
        }
    }

    /**
     * 导出单个数据文件
     * @param {string} dataType - 数据类型 (students, points, products, orders, config)
     * @returns {Promise<string>} 导出文件路径
     */
    async exportDataFile(dataType) {
        const filename = `${dataType}.json`;
        const sourcePath = path.join(this.dataDir, filename);
        
        if (!(await this.fileExists(sourcePath))) {
            throw new Error(`数据文件不存在: ${filename}`);
        }
        
        await this.ensureExportDirectory();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportFileName = `${dataType}-export-${timestamp}.json`;
        const exportPath = path.join(this.exportDir, exportFileName);
        
        await fs.copyFile(sourcePath, exportPath);
        console.log(`导出数据文件: ${exportFileName}`);
        
        return exportPath;
    }

    /**
     * 导入单个数据文件
     * @param {string} dataType - 数据类型
     * @param {string} importFilePath - 导入文件路径
     * @returns {Promise<boolean>} 导入是否成功
     */
    async importDataFile(dataType, importFilePath) {
        try {
            // 验证文件格式
            const content = await fs.readFile(importFilePath, 'utf8');
            const data = JSON.parse(content);
            
            // 验证数据结构（基本验证）
            if (!Array.isArray(data) && typeof data !== 'object') {
                throw new Error('数据格式不正确');
            }
            
            // 备份当前文件
            const filename = `${dataType}.json`;
            await this.dataAccess.createBackup(filename);
            
            // 导入新数据
            await this.dataAccess.writeFile(filename, data);
            
            console.log(`导入数据文件成功: ${dataType}`);
            return true;
            
        } catch (error) {
            console.error(`导入数据文件失败 ${dataType}:`, error);
            throw error;
        }
    }

    /**
     * 清理旧的导出文件
     * @param {number} keepCount - 保留文件数量
     * @returns {Promise<number>} 清理的文件数量
     */
    async cleanOldExports(keepCount = 10) {
        try {
            const backupList = await this.getBackupList();
            const filesToDelete = backupList.slice(keepCount);
            
            let deletedCount = 0;
            for (const backup of filesToDelete) {
                if (await this.deleteBackup(backup.filename)) {
                    deletedCount++;
                }
            }
            
            console.log(`清理了 ${deletedCount} 个旧的导出文件`);
            return deletedCount;
            
        } catch (error) {
            console.error('清理旧导出文件失败:', error);
            return 0;
        }
    }

    /**
     * 获取系统数据统计信息
     * @returns {Promise<object>} 数据统计
     */
    async getDataStatistics() {
        try {
            const stats = {};
            
            for (const file of this.dataFiles) {
                const filePath = path.join(this.dataDir, file);
                if (await this.fileExists(filePath)) {
                    const fileStats = await fs.stat(filePath);
                    const content = await fs.readFile(filePath, 'utf8');
                    const data = JSON.parse(content);
                    
                    stats[file] = {
                        size: fileStats.size,
                        modified: fileStats.mtime,
                        recordCount: Array.isArray(data) ? data.length : Object.keys(data).length
                    };
                }
            }
            
            return stats;
            
        } catch (error) {
            console.error('获取数据统计失败:', error);
            return {};
        }
    }

    /**
     * 创建SQLite数据库备份
     * @returns {Promise<string>} 备份文件路径
     */
    async createSQLiteBackup() {
        await this.ensureExportDirectory();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `sqlite-backup-${timestamp}.db`;
        const backupPath = path.join(this.exportDir, backupFileName);
        
        const dbPath = path.join(this.dataDir, 'classroom_points.db');
        
        if (!(await this.fileExists(dbPath))) {
            throw new Error('SQLite数据库文件不存在');
        }
        
        try {
            // 使用SQLite的VACUUM INTO命令创建压缩备份
            const sqlite3 = require('sqlite3').verbose();
            const db = new sqlite3.Database(dbPath);
            
            await new Promise((resolve, reject) => {
                db.run(`VACUUM INTO '${backupPath}'`, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
                db.close();
            });
            
            console.log(`SQLite数据库备份创建成功: ${backupFileName}`);
            return backupPath;
            
        } catch (error) {
            // 如果VACUUM INTO不可用，使用文件复制
            console.warn('VACUUM INTO不可用，使用文件复制方式备份');
            await fs.copyFile(dbPath, backupPath);
            console.log(`SQLite数据库备份创建成功: ${backupFileName}`);
            return backupPath;
        }
    }

    /**
     * 恢复SQLite数据库备份
     * @param {string} backupFilePath - 备份文件路径
     * @returns {Promise<boolean>} 恢复是否成功
     */
    async restoreSQLiteBackup(backupFilePath) {
        try {
            const dbPath = path.join(this.dataDir, 'classroom_points.db');
            
            // 验证备份文件
            if (!(await this.fileExists(backupFilePath))) {
                throw new Error('备份文件不存在');
            }
            
            // 创建当前数据库的备份
            const currentBackupPath = await this.createSQLiteBackup();
            console.log(`当前数据库已备份到: ${currentBackupPath}`);
            
            // 恢复数据库
            await fs.copyFile(backupFilePath, dbPath);
            
            // 验证恢复的数据库
            const sqlite3 = require('sqlite3').verbose();
            const db = new sqlite3.Database(dbPath);
            
            await new Promise((resolve, reject) => {
                db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        reject(new Error('恢复的数据库结构不正确'));
                    } else {
                        resolve();
                    }
                });
                db.close();
            });
            
            console.log('SQLite数据库恢复完成');
            return true;
            
        } catch (error) {
            console.error('SQLite数据库恢复失败:', error);
            throw error;
        }
    }

    /**
     * 获取SQLite数据库统计信息
     * @returns {Promise<object>} 数据库统计
     */
    async getSQLiteStats() {
        try {
            const dbPath = path.join(this.dataDir, 'classroom_points.db');
            
            if (!(await this.fileExists(dbPath))) {
                return { error: 'SQLite数据库文件不存在' };
            }
            
            const sqlite3 = require('sqlite3').verbose();
            const db = new sqlite3.Database(dbPath);
            
            const stats = await new Promise((resolve, reject) => {
                const queries = [
                    "SELECT COUNT(*) as count FROM users WHERE role='student'",
                    "SELECT COUNT(*) as count FROM users WHERE role='teacher'",
                    "SELECT COUNT(*) as count FROM point_records",
                    "SELECT COUNT(*) as count FROM products WHERE is_active=1",
                    "SELECT COUNT(*) as count FROM orders",
                    "SELECT COUNT(*) as count FROM reward_penalty_items WHERE is_active=1"
                ];
                
                const results = {};
                let completed = 0;
                
                queries.forEach((query, index) => {
                    db.get(query, (err, row) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        const keys = ['students', 'teachers', 'pointRecords', 'products', 'orders', 'rewardPenaltyItems'];
                        results[keys[index]] = row.count;
                        
                        completed++;
                        if (completed === queries.length) {
                            resolve(results);
                        }
                    });
                });
            });
            
            db.close();
            
            // 获取文件大小
            const fileStats = await fs.stat(dbPath);
            
            return {
                ...stats,
                databaseSize: fileStats.size,
                lastModified: fileStats.mtime,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('获取SQLite统计失败:', error);
            return { error: error.message };
        }
    }

    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>}
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

module.exports = BackupService;