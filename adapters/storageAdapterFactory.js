/**
 * 存储适配器工厂
 * 
 * 功能：
 * - 根据配置创建相应的存储适配器实例
 * - 支持MySQL8和SQLite数据库适配器
 * - 支持JSON文件存储适配器（兼容现有系统）
 * - 提供统一的适配器管理接口
 */

const { createError } = require('../middleware/errorHandler');

class StorageAdapterFactory {
    constructor() {
        this.adapters = new Map(); // 缓存适配器实例
        this.defaultConfig = {
            type: 'sqlite', // 默认使用SQLite存储
            json: {
                dataDir: './data'
            },
            mysql: {
                host: 'localhost',
                port: 3306,
                database: 'classroom_points',
                user: 'root',
                password: '',
                connectionLimit: 10,
                acquireTimeout: 60000,
                timeout: 60000
            },
            sqlite: {
                database: './data/classroom_points.db',
                enableWAL: true
            },
            d1: {
                db: null // Will be set from environment binding
            }
        };
    }

    /**
     * 创建存储适配器
     */
    async createAdapter(type = null, config = {}) {
        const adapterType = type || process.env.STORAGE_TYPE || this.defaultConfig.type;
        const adapterConfig = { ...this.defaultConfig[adapterType], ...config };

        // 检查缓存
        const cacheKey = `${adapterType}_${JSON.stringify(adapterConfig)}`;
        if (this.adapters.has(cacheKey)) {
            return this.adapters.get(cacheKey);
        }

        let adapter;

        try {
            switch (adapterType.toLowerCase()) {
                case 'json':
                    adapter = await this.createJsonAdapter(adapterConfig);
                    break;
                case 'mysql':
                    adapter = await this.createMySQLAdapter(adapterConfig);
                    break;
                case 'sqlite':
                    adapter = await this.createSQLiteAdapter(adapterConfig);
                    break;
                case 'd1':
                    adapter = await this.createD1Adapter(adapterConfig);
                    break;
                default:
                    throw createError('CONFIGURATION_ERROR', `不支持的存储类型: ${adapterType}`);
            }

            // 连接数据库
            await adapter.connect();

            // 缓存适配器实例
            this.adapters.set(cacheKey, adapter);

            console.log(`已创建${adapterType.toUpperCase()}存储适配器`);
            return adapter;

        } catch (error) {
            console.error(`创建${adapterType}存储适配器失败:`, error);
            throw createError('DATABASE_ERROR', `存储适配器初始化失败: ${error.message}`);
        }
    }

    /**
     * 创建JSON存储适配器
     */
    async createJsonAdapter(config) {
        const JsonStorageAdapter = require('./jsonStorageAdapter');
        return new JsonStorageAdapter(config);
    }

    /**
     * 创建MySQL存储适配器
     */
    async createMySQLAdapter(config) {
        try {
            const MySQLStorageAdapter = require('./mysqlStorageAdapter');
            return new MySQLStorageAdapter(config);
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw createError('CONFIGURATION_ERROR', 'MySQL适配器未安装，请先安装mysql2依赖包');
            }
            throw error;
        }
    }

    /**
     * 创建SQLite存储适配器
     */
    async createSQLiteAdapter(config) {
        try {
            const SQLiteStorageAdapter = require('./sqliteStorageAdapter');
            return new SQLiteStorageAdapter(config);
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw createError('CONFIGURATION_ERROR', 'SQLite适配器未安装，请先安装sqlite3依赖包');
            }
            throw error;
        }
    }

    /**
     * 创建Cloudflare D1存储适配器
     */
    async createD1Adapter(config) {
        try {
            const D1StorageAdapter = require('./d1StorageAdapter');
            return new D1StorageAdapter(config);
        } catch (error) {
            throw createError('CONFIGURATION_ERROR', `D1适配器创建失败: ${error.message}`);
        }
    }

    /**
     * 获取默认适配器
     */
    async getDefaultAdapter() {
        return await this.createAdapter();
    }

    /**
     * 获取适配器（带缓存）
     */
    async getAdapter(type = null, config = {}) {
        return await this.createAdapter(type, config);
    }

    /**
     * 清除适配器缓存
     */
    clearCache() {
        this.adapters.clear();
    }

    /**
     * 关闭所有适配器连接
     */
    async closeAllConnections() {
        const closePromises = [];

        for (const adapter of this.adapters.values()) {
            if (adapter.disconnect) {
                closePromises.push(adapter.disconnect());
            }
        }

        await Promise.all(closePromises);
        this.clearCache();
    }

    /**
     * 健康检查所有适配器
     */
    async healthCheckAll() {
        const results = {};

        for (const [key, adapter] of this.adapters.entries()) {
            try {
                results[key] = await adapter.healthCheck();
            } catch (error) {
                results[key] = {
                    status: 'error',
                    message: error.message
                };
            }
        }

        return results;
    }

    /**
     * 获取适配器统计信息
     */
    getAdapterStats() {
        return {
            totalAdapters: this.adapters.size,
            adapterTypes: Array.from(this.adapters.keys()).map(key => key.split('_')[0]),
            cacheKeys: Array.from(this.adapters.keys())
        };
    }

    /**
     * 测试适配器连接
     */
    async testConnection(type, config = {}) {
        try {
            const adapter = await this.createAdapter(type, config);
            const healthCheck = await adapter.healthCheck();
            await adapter.disconnect();

            return {
                success: true,
                type,
                status: healthCheck.status,
                message: healthCheck.message
            };
        } catch (error) {
            return {
                success: false,
                type,
                error: error.message
            };
        }
    }

    /**
     * 迁移数据（从一个适配器到另一个适配器）
     */
    async migrateData(sourceType, targetType, classId, sourceConfig = {}, targetConfig = {}) {
        let sourceAdapter, targetAdapter;

        try {
            // 创建源和目标适配器
            sourceAdapter = await this.createAdapter(sourceType, sourceConfig);
            targetAdapter = await this.createAdapter(targetType, targetConfig);

            console.log(`开始数据迁移: ${sourceType} -> ${targetType}, 班级: ${classId}`);

            // 导出源数据
            const exportData = await sourceAdapter.exportClassData(classId);
            console.log(`已导出数据，记录数: ${Object.keys(exportData.data).length}`);

            // 导入到目标适配器
            await targetAdapter.importClassData(classId, exportData.data);
            console.log('数据迁移完成');

            return {
                success: true,
                message: '数据迁移成功',
                recordCount: Object.keys(exportData.data).length,
                exportTime: exportData.exportTime
            };

        } catch (error) {
            console.error('数据迁移失败:', error);
            throw createError('DATABASE_ERROR', `数据迁移失败: ${error.message}`);
        }
    }

    /**
     * 批量创建适配器（用于多班级部署）
     */
    async createMultipleAdapters(configs) {
        const adapters = {};
        const errors = [];

        for (const [key, config] of Object.entries(configs)) {
            try {
                adapters[key] = await this.createAdapter(config.type, config);
            } catch (error) {
                errors.push({ key, error: error.message });
            }
        }

        return { adapters, errors };
    }

    /**
     * 获取支持的存储类型
     */
    getSupportedTypes() {
        return [
            {
                type: 'json',
                name: 'JSON文件存储',
                description: '基于JSON文件的轻量级存储，适合单班级部署',
                requirements: '无额外依赖',
                features: ['轻量级', '易部署', '文件备份']
            },
            {
                type: 'mysql',
                name: 'MySQL数据库',
                description: '基于MySQL8的关系型数据库存储，适合多班级部署',
                requirements: 'mysql2 npm包',
                features: ['高性能', '事务支持', '多班级', '数据一致性']
            },
            {
                type: 'sqlite',
                name: 'SQLite数据库',
                description: '基于SQLite的嵌入式数据库存储，适合本地部署',
                requirements: 'sqlite3 npm包',
                features: ['嵌入式', '无服务器', '事务支持', '便携性']
            },
            {
                type: 'd1',
                name: 'Cloudflare D1数据库',
                description: '基于Cloudflare D1的云端数据库存储，适合Cloudflare部署',
                requirements: 'Cloudflare Workers环境',
                features: ['云端托管', '全球分布', '自动扩展', '零运维']
            }
        ];
    }

    /**
     * 验证配置
     */
    validateConfig(type, config) {
        const errors = [];

        switch (type.toLowerCase()) {
            case 'json':
                if (!config.dataDir) {
                    errors.push('JSON存储需要指定dataDir');
                }
                break;

            case 'mysql':
                const requiredFields = ['host', 'database', 'user'];
                for (const field of requiredFields) {
                    if (!config[field]) {
                        errors.push(`MySQL配置缺少必需字段: ${field}`);
                    }
                }
                break;

            case 'sqlite':
                if (!config.database) {
                    errors.push('SQLite存储需要指定database路径');
                }
                break;

            case 'd1':
                if (!config.db && !config.binding) {
                    errors.push('D1存储需要指定数据库绑定');
                }
                break;

            default:
                errors.push(`不支持的存储类型: ${type}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// 创建全局工厂实例
const storageAdapterFactory = new StorageAdapterFactory();

// 优雅关闭处理
process.on('SIGINT', async () => {
    console.log('正在关闭存储适配器连接...');
    await storageAdapterFactory.closeAllConnections();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('正在关闭存储适配器连接...');
    await storageAdapterFactory.closeAllConnections();
    process.exit(0);
});

module.exports = {
    StorageAdapterFactory,
    storageAdapterFactory
};