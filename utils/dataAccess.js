const fs = require('fs').promises;
const path = require('path');
const { sqliteConnection } = require('./sqliteConnection');

/**
 * 数据访问层 - 支持JSON文件和SQLite数据库
 * 提供统一的数据读写接口，包含错误处理和备份机制
 * 支持配置切换存储后端（JSON文件或SQLite数据库）
 */
class DataAccess {
    constructor(dataDir = 'data', useSQLite = false) {
        this.dataDir = dataDir;
        this.backupDir = path.join(dataDir, 'backups');
        this.useSQLite = useSQLite; // 是否使用SQLite
        
        // 文件缓存机制（仅JSON模式使用）
        this.fileCache = new Map();
        this.cacheTimeout = 30000; // 30秒缓存
        
        // 写入队列，避免并发写入冲突（仅JSON模式使用）
        this.writeQueue = new Map();
        
        // 性能监控
        this.metrics = {
            readCount: 0,
            writeCount: 0,
            cacheHits: 0,
            averageReadTime: 0,
            averageWriteTime: 0
        };
    }

    /**
     * 确保数据目录存在
     */
    async ensureDirectories() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch (error) {
            console.error('创建数据目录失败:', error);
            throw error;
        }
    }

    /**
     * 读取数据（支持JSON文件和SQLite）
     * @param {string} filename - 文件名（JSON模式）或表名（SQLite模式）
     * @param {object} defaultData - 默认数据
     * @param {boolean} useCache - 是否使用缓存（仅JSON模式有效）
     * @returns {Promise<object>} 数据内容
     */
    async readFile(filename, defaultData = {}, useCache = true) {
        const startTime = Date.now();
        
        // SQLite模式
        if (this.useSQLite) {
            try {
                const tableName = this._getTableName(filename);
                const data = await this._readFromSQLite(tableName, defaultData);
                this.metrics.readCount++;
                const readTime = Date.now() - startTime;
                this.metrics.averageReadTime = 
                    (this.metrics.averageReadTime + readTime) / 2;
                return data;
            } catch (error) {
                console.error(`SQLite读取失败 ${filename}:`, error);
                return defaultData;
            }
        }
        
        // JSON文件模式（原有逻辑）
        const filePath = path.join(this.dataDir, filename);
        
        try {
            // 检查缓存
            if (useCache) {
                const cached = this._getFileCache(filename);
                if (cached) {
                    this.metrics.cacheHits++;
                    return cached.data;
                }
            }
            
            const data = await fs.readFile(filePath, 'utf8');
            const parsedData = JSON.parse(data);
            
            // 更新缓存
            if (useCache) {
                this._setFileCache(filename, parsedData);
            }
            
            // 更新性能指标
            this.metrics.readCount++;
            const readTime = Date.now() - startTime;
            this.metrics.averageReadTime = 
                (this.metrics.averageReadTime + readTime) / 2;
            
            return parsedData;
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                // 文件不存在，创建默认文件
                console.log(`文件 ${filename} 不存在，创建默认文件`);
                await this.writeFile(filename, defaultData);
                return defaultData;
            } else if (error instanceof SyntaxError) {
                // JSON解析错误，尝试从备份恢复
                console.error(`JSON解析错误 ${filename}:`, error.message);
                return await this.restoreFromBackup(filename, defaultData);
            } else {
                console.error(`读取文件 ${filename} 失败:`, error);
                throw error;
            }
        }
    }

    /**
     * 写入数据（支持JSON文件和SQLite）
     * @param {string} filename - 文件名（JSON模式）或表名（SQLite模式）
     * @param {object} data - 要写入的数据
     * @param {boolean} skipBackup - 是否跳过备份（仅JSON模式有效）
     * @returns {Promise<void>}
     */
    async writeFile(filename, data, skipBackup = false) {
        const startTime = Date.now();
        
        // SQLite模式
        if (this.useSQLite) {
            try {
                const tableName = this._getTableName(filename);
                await this._writeToSQLite(tableName, data);
                
                // 更新性能指标
                this.metrics.writeCount++;
                const writeTime = Date.now() - startTime;
                this.metrics.averageWriteTime = 
                    (this.metrics.averageWriteTime + writeTime) / 2;
                    
                console.log(`SQLite数据写入成功: ${tableName}`);
            } catch (error) {
                console.error(`SQLite写入失败 ${filename}:`, error);
                throw error;
            }
            return;
        }
        
        // JSON文件模式（原有逻辑）
        // 使用写入队列避免并发冲突
        if (this.writeQueue.has(filename)) {
            await this.writeQueue.get(filename);
        }
        
        const writePromise = this._performWrite(filename, data, skipBackup);
        this.writeQueue.set(filename, writePromise);
        
        try {
            await writePromise;
            
            // 更新缓存
            this._setFileCache(filename, data);
            
            // 更新性能指标
            this.metrics.writeCount++;
            const writeTime = Date.now() - startTime;
            this.metrics.averageWriteTime = 
                (this.metrics.averageWriteTime + writeTime) / 2;
            
        } finally {
            this.writeQueue.delete(filename);
        }
    }

    /**
     * 执行实际的文件写入操作
     * @private
     */
    async _performWrite(filename, data, skipBackup) {
        const filePath = path.join(this.dataDir, filename);
        
        try {
            // 先备份现有文件（除非跳过）
            if (!skipBackup) {
                await this.createBackup(filename);
            }
            
            // 优化JSON序列化
            const jsonData = this._optimizedStringify(data);
            await fs.writeFile(filePath, jsonData, 'utf8');
            
            console.log(`文件 ${filename} 写入成功`);
        } catch (error) {
            console.error(`写入文件 ${filename} 失败:`, error);
            throw error;
        }
    }

    /**
     * 优化的JSON序列化
     * @private
     */
    _optimizedStringify(data) {
        // 对于大型数据，使用流式序列化或压缩空格
        if (this._isLargeData(data)) {
            return JSON.stringify(data); // 不格式化，减少文件大小
        } else {
            return JSON.stringify(data, null, 2); // 保持可读性
        }
    }

    /**
     * 检查是否为大型数据
     * @private
     */
    _isLargeData(data) {
        const jsonString = JSON.stringify(data);
        return jsonString.length > 100000; // 100KB
    }

    /**
     * 创建文件备份
     * @param {string} filename - 文件名
     */
    async createBackup(filename) {
        const filePath = path.join(this.dataDir, filename);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `${filename}.${timestamp}.bak`);
        
        try {
            await fs.access(filePath);
            await fs.copyFile(filePath, backupPath);
            console.log(`创建备份: ${backupPath}`);
            
            // 清理旧备份（保留最近10个）
            await this.cleanOldBackups(filename);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`创建备份失败 ${filename}:`, error);
            }
        }
    }

    /**
     * 从备份恢复文件
     * @param {string} filename - 文件名
     * @param {object} defaultData - 默认数据
     * @returns {Promise<object>} 恢复的数据
     */
    async restoreFromBackup(filename, defaultData = {}) {
        try {
            const backupFiles = await fs.readdir(this.backupDir);
            const relevantBackups = backupFiles
                .filter(file => file.startsWith(filename))
                .sort()
                .reverse();
            
            if (relevantBackups.length > 0) {
                const latestBackup = path.join(this.backupDir, relevantBackups[0]);
                const backupData = await fs.readFile(latestBackup, 'utf8');
                const parsedData = JSON.parse(backupData);
                
                // 恢复到主文件
                await this.writeFile(filename, parsedData);
                console.log(`从备份恢复文件 ${filename}: ${relevantBackups[0]}`);
                
                return parsedData;
            }
        } catch (error) {
            console.error(`从备份恢复失败 ${filename}:`, error);
        }
        
        // 如果备份恢复失败，使用默认数据
        console.log(`使用默认数据创建文件 ${filename}`);
        await this.writeFile(filename, defaultData);
        return defaultData;
    }

    /**
     * 清理旧备份文件
     * @param {string} filename - 文件名
     */
    async cleanOldBackups(filename) {
        try {
            const backupFiles = await fs.readdir(this.backupDir);
            const relevantBackups = backupFiles
                .filter(file => file.startsWith(filename))
                .sort()
                .reverse();
            
            // 保留最近10个备份
            const filesToDelete = relevantBackups.slice(10);
            
            for (const file of filesToDelete) {
                await fs.unlink(path.join(this.backupDir, file));
                console.log(`删除旧备份: ${file}`);
            }
        } catch (error) {
            console.error(`清理备份失败 ${filename}:`, error);
        }
    }

    /**
     * 检查文件是否存在
     * @param {string} filename - 文件名
     * @returns {Promise<boolean>}
     */
    async fileExists(filename) {
        const filePath = path.join(this.dataDir, filename);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 获取文件状态信息
     * @param {string} filename - 文件名
     * @returns {Promise<object>}
     */
    async getFileStats(filename) {
        const filePath = path.join(this.dataDir, filename);
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime
            };
        } catch (error) {
            console.error(`获取文件状态失败 ${filename}:`, error);
            throw error;
        }
    }

    // ==================== 缓存和性能优化方法 ====================

    /**
     * 获取文件缓存
     * @private
     */
    _getFileCache(filename) {
        const cached = this.fileCache.get(filename);
        if (cached && this._isCacheValid(cached.timestamp)) {
            return cached;
        }
        return null;
    }

    /**
     * 设置文件缓存
     * @private
     */
    _setFileCache(filename, data) {
        this.fileCache.set(filename, {
            data: data,
            timestamp: Date.now()
        });
        
        // 限制缓存大小
        if (this.fileCache.size > 20) {
            const firstKey = this.fileCache.keys().next().value;
            this.fileCache.delete(firstKey);
        }
    }

    /**
     * 检查缓存是否有效
     * @private
     */
    _isCacheValid(timestamp) {
        return Date.now() - timestamp < this.cacheTimeout;
    }

    /**
     * 清除文件缓存
     */
    clearCache() {
        this.fileCache.clear();
        console.log('数据访问层缓存已清除');
    }

    /**
     * 批量读取文件
     * @param {Array} filenames - 文件名数组
     * @param {object} defaultData - 默认数据
     * @returns {Promise<object>} 文件内容映射
     */
    async batchReadFiles(filenames, defaultData = {}) {
        const promises = filenames.map(filename => 
            this.readFile(filename, defaultData).then(data => ({ [filename]: data }))
        );
        
        const results = await Promise.all(promises);
        return Object.assign({}, ...results);
    }

    /**
     * 获取性能指标
     */
    getPerformanceMetrics() {
        const cacheHitRate = this.metrics.readCount > 0 
            ? (this.metrics.cacheHits / this.metrics.readCount * 100).toFixed(2)
            : 0;
            
        return {
            ...this.metrics,
            cacheHitRate: `${cacheHitRate}%`,
            cacheSize: this.fileCache.size,
            queueSize: this.writeQueue.size
        };
    }

    /**
     * 预热缓存
     */
    async warmupCache(filenames = ['students.json', 'points.json', 'products.json', 'orders.json']) {
        try {
            console.log('开始预热数据访问层缓存...');
            await this.batchReadFiles(filenames);
            console.log('数据访问层缓存预热完成');
        } catch (error) {
            console.error('缓存预热失败:', error);
        }
    }

    /**
     * 压缩备份文件
     */
    async compressOldBackups() {
        try {
            const backupFiles = await fs.readdir(this.backupDir);
            const oldBackups = backupFiles.filter(file => {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                const daysSinceCreation = (Date.now() - stats.birthtime.getTime()) / (1000 * 60 * 60 * 24);
                return daysSinceCreation > 7; // 7天前的备份
            });

            if (oldBackups.length > 0) {
                console.log(`压缩 ${oldBackups.length} 个旧备份文件...`);
                // 这里可以实现压缩逻辑
                // 为了简化，暂时只记录日志
            }
        } catch (error) {
            console.error('压缩备份文件失败:', error);
        }
    }

    // ==================== SQLite支持方法 ====================

    /**
     * 获取表名（从文件名转换）
     * @private
     */
    _getTableName(filename) {
        // 移除.json后缀并转换为复数形式
        const baseName = filename.replace('.json', '');
        const tableMap = {
            'students': 'students',
            'teachers': 'teachers', 
            'points': 'points',
            'products': 'products',
            'orders': 'orders',
            'system_config': 'system_config'
        };
        return tableMap[baseName] || baseName;
    }

    /**
     * 从SQLite读取数据
     * @private
     */
    async _readFromSQLite(tableName, defaultData) {
        try {
            // 检查表是否存在
            const tableExists = await sqliteConnection.tableExists(tableName);
            if (!tableExists) {
                console.log(`SQLite表 ${tableName} 不存在，创建默认数据`);
                await this._writeToSQLite(tableName, defaultData);
                return defaultData;
            }

            // 根据表名读取数据
            let query;
            switch (tableName) {
                case 'students':
                    query = 'SELECT * FROM students ORDER BY id';
                    break;
                case 'teachers':
                    query = 'SELECT * FROM teachers ORDER BY id';
                    break;
                case 'points':
                    query = 'SELECT * FROM points ORDER BY createdAt DESC';
                    break;
                case 'products':
                    query = 'SELECT * FROM products ORDER BY id';
                    break;
                case 'orders':
                    query = 'SELECT * FROM orders ORDER BY createdAt DESC';
                    break;
                case 'system_config':
                case 'systemConfig':
                    query = 'SELECT * FROM system_config';
                    break;
                default:
                    query = `SELECT * FROM ${tableName}`;
            }

            const rows = await sqliteConnection.all(query);
            
            // 转换为JSON格式（保持兼容性）
            return this._convertSQLiteToJSON(tableName, rows);
        } catch (error) {
            console.error(`SQLite读取错误 ${tableName}:`, error);
            return defaultData;
        }
    }

    /**
     * 写入数据到SQLite
     * @private
     */
    async _writeToSQLite(tableName, data) {
        if (!data) return;
        
        try {
            switch (tableName) {
                case 'students':
                    await this._writeStudentsToSQLite(data);
                    break;
                case 'teachers':
                    await this._writeTeachersToSQLite(data);
                    break;
                case 'points':
                    await this._writePointsToSQLite(data);
                    break;
                case 'products':
                    await this._writeProductsToSQLite(data);
                    break;
                case 'orders':
                    await this._writeOrdersToSQLite(data);
                    break;
                case 'system_config':
                    await this._writeSystemConfigToSQLite(data);
                    break;
                default:
                    console.log(`SQLite表 ${tableName} 不存在，跳过写入`);
            }
        } catch (error) {
            console.error(`写入SQLite表 ${tableName} 失败:`, error);
            throw error;
        }
    }

    /**
     * 将SQLite数据转换为JSON格式
     * @private
     */
    _convertSQLiteToJSON(tableName, rows) {
        switch (tableName) {
            case 'students':
            case 'teachers':
            case 'products':
                // 数组格式
                return rows;
            case 'points':
            case 'orders':
                // 数组格式，保持时间戳
                return rows.map(row => ({
                    ...row,
                    created_at: row.created_at,
                    updated_at: row.updated_at
                }));
            case 'system_config':
            case 'systemConfig':
                // 配置格式，转换为对象
                const config = {};
                rows.forEach(row => {
                    config[row.key] = row.value;
                });
                return config;
            default:
                return rows;
        }
    }

    /**
     * 写入学生数据到SQLite
     * @private
     */
    async _writeStudentsToSQLite(data) {
        if (!Array.isArray(data)) return;
        
        // 清空现有数据
        await sqliteConnection.run('DELETE FROM students');
        
        // 插入新数据
        const insertQuery = `
            INSERT INTO students (id, name, class, studentId, totalPoints, currentPoints, avatar, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        for (const student of data) {
            await sqliteConnection.run(insertQuery, [
                student.id,
                student.name,
                student.class || '默认班级',
                student.studentId || student.id,
                student.totalPoints || 0,
                student.currentPoints || 0,
                student.avatar || null
            ]);
        }
    }

    /**
     * 写入教师数据到SQLite
     * @private
     */
    async _writeTeachersToSQLite(data) {
        if (!Array.isArray(data)) return;
        
        // 清空现有数据
        await sqliteConnection.run('DELETE FROM teachers');
        
        // 插入新数据
        const insertQuery = `
            INSERT INTO teachers (id, name, password, role, department, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        for (const teacher of data) {
            await sqliteConnection.run(insertQuery, [
                teacher.id,
                teacher.name,
                teacher.password,
                teacher.role || 'teacher',
                teacher.department || null,
                teacher.hasOwnProperty('isActive') ? teacher.isActive : 1
            ]);
        }
    }

    /**
     * 写入积分数据到SQLite
     * @private
     */
    async _writePointsToSQLite(data) {
        if (!Array.isArray(data)) return;
        
        // 清空现有数据
        await sqliteConnection.run('DELETE FROM points');
        
        // 插入新数据
        const insertQuery = `
            INSERT INTO points (id, studentId, points, reason, type, teacherId, createdBy, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `;
        
        for (const point of data) {
            await sqliteConnection.run(insertQuery, [
                point.id,
                point.studentId,
                point.points,
                point.reason,
                point.type,
                point.teacherId || null,
                point.createdBy || point.teacherId || 'system'
            ]);
        }
    }

    /**
     * 写入商品数据到SQLite
     * @private
     */
    async _writeProductsToSQLite(data) {
        if (!Array.isArray(data)) return;
        
        // 清空现有数据
        await sqliteConnection.run('DELETE FROM products');
        
        // 插入新数据
        const insertQuery = `
            INSERT INTO products (id, name, description, price, stock, image, category, isActive, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        for (const product of data) {
            await sqliteConnection.run(insertQuery, [
                product.id,
                product.name,
                product.description,
                product.price,
                product.stock || 0,
                product.image || null,
                product.category || null,
                product.hasOwnProperty('isActive') ? product.isActive : 1
            ]);
        }
    }

    /**
     * 写入订单数据到SQLite
     * @private
     */
    async _writeOrdersToSQLite(data) {
        if (!Array.isArray(data)) return;
        
        // 清空现有数据
        await sqliteConnection.run('DELETE FROM orders');
        
        // 插入新数据
        const insertQuery = `
            INSERT INTO orders (id, studentId, productId, quantity, totalPrice, status, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        for (const order of data) {
            await sqliteConnection.run(insertQuery, [
                order.id,
                order.studentId,
                order.productId,
                order.quantity,
                order.totalPrice,
                order.status || 'pending'
            ]);
        }
    }

    /**
     * 写入系统配置数据到SQLite
     * @private
     */
    async _writeSystemConfigToSQLite(data) {
        if (!Array.isArray(data)) return;
        
        // 清空现有数据
        await sqliteConnection.run('DELETE FROM system_config');
        
        // 插入新数据
        const insertQuery = `
            INSERT INTO system_config (id, key, value, description, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `;
        
        for (const config of data) {
            await sqliteConnection.run(insertQuery, [
                config.id,
                config.key,
                config.value,
                config.description || null
            ]);
        }
    }
}

module.exports = DataAccess;