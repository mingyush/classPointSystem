/**
 * 数据缓存和自动刷新服务
 * 处理前端数据缓存、状态管理和自动刷新逻辑
 */
class DataCacheService {
    constructor(options = {}) {
        this.cache = new Map();
        this.loadingStates = new Map();
        this.errorStates = new Map();
        this.refreshIntervals = new Map();
        this.eventHandlers = new Map();
        
        // 配置选项
        this.options = {
            defaultTTL: options.defaultTTL || 300000, // 5分钟默认缓存时间
            maxRetries: options.maxRetries || 3,
            retryDelay: options.retryDelay || 1000,
            enableAutoRefresh: options.enableAutoRefresh !== false,
            refreshInterval: options.refreshInterval || 30000, // 30秒默认刷新间隔
            enableOfflineMode: options.enableOfflineMode !== false
        };
        
        // 初始化
        this.init();
    }

    /**
     * 初始化服务
     */
    init() {
        // 监听网络状态变化
        if (navigator.onLine !== undefined) {
            window.addEventListener('online', () => {
                console.log('网络连接恢复');
                this.handleNetworkReconnect();
            });
            
            window.addEventListener('offline', () => {
                console.log('网络连接断开');
                this.handleNetworkDisconnect();
            });
        }
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseAutoRefresh();
            } else {
                this.resumeAutoRefresh();
            }
        });
        
        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }

    /**
     * 获取数据（带缓存）
     */
    async getData(key, fetchFunction, options = {}) {
        const cacheOptions = { ...this.options, ...options };
        
        // 检查缓存
        const cachedData = this.getCachedData(key);
        if (cachedData && !this.isCacheExpired(key)) {
            console.log(`从缓存获取数据: ${key}`);
            return cachedData;
        }
        
        // 检查是否正在加载
        if (this.loadingStates.get(key)) {
            console.log(`数据正在加载中: ${key}`);
            return this.waitForLoading(key);
        }
        
        // 开始加载数据
        return this.fetchAndCacheData(key, fetchFunction, cacheOptions);
    }

    /**
     * 获取缓存数据
     */
    getCachedData(key) {
        const cacheEntry = this.cache.get(key);
        return cacheEntry ? cacheEntry.data : null;
    }

    /**
     * 检查缓存是否过期
     */
    isCacheExpired(key) {
        const cacheEntry = this.cache.get(key);
        if (!cacheEntry) return true;
        
        return Date.now() > cacheEntry.expireTime;
    }

    /**
     * 获取并缓存数据
     */
    async fetchAndCacheData(key, fetchFunction, options) {
        this.setLoadingState(key, true);
        this.clearErrorState(key);
        
        let retries = 0;
        
        while (retries <= options.maxRetries) {
            try {
                console.log(`获取数据: ${key} (尝试 ${retries + 1}/${options.maxRetries + 1})`);
                
                const data = await fetchFunction();
                
                // 缓存数据
                this.setCacheData(key, data, options.defaultTTL);
                this.setLoadingState(key, false);
                
                // 触发数据更新事件
                this.emit('dataUpdated', { key, data });
                
                return data;
                
            } catch (error) {
                console.error(`获取数据失败: ${key}`, error);
                retries++;
                
                if (retries <= options.maxRetries) {
                    // 等待后重试
                    await this.delay(options.retryDelay * retries);
                } else {
                    // 最大重试次数后，设置错误状态
                    this.setErrorState(key, error);
                    this.setLoadingState(key, false);
                    
                    // 如果有缓存数据且启用离线模式，返回缓存数据
                    if (options.enableOfflineMode) {
                        const cachedData = this.getCachedData(key);
                        if (cachedData) {
                            console.log(`使用离线缓存数据: ${key}`);
                            this.emit('offlineDataUsed', { key, data: cachedData });
                            return cachedData;
                        }
                    }
                    
                    throw error;
                }
            }
        }
    }

    /**
     * 设置缓存数据
     */
    setCacheData(key, data, ttl = this.options.defaultTTL) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
            expireTime: Date.now() + ttl
        });
        
        // 保存到本地存储作为离线备份
        if (this.options.enableOfflineMode) {
            try {
                localStorage.setItem(`cache_${key}`, JSON.stringify({
                    data: data,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.warn('保存到本地存储失败:', error);
            }
        }
    }

    /**
     * 从本地存储恢复缓存
     */
    restoreFromLocalStorage(key) {
        try {
            const stored = localStorage.getItem(`cache_${key}`);
            if (stored) {
                const parsed = JSON.parse(stored);
                // 检查数据是否太旧（超过1小时）
                if (Date.now() - parsed.timestamp < 3600000) {
                    this.setCacheData(key, parsed.data);
                    return parsed.data;
                }
            }
        } catch (error) {
            console.warn('从本地存储恢复缓存失败:', error);
        }
        return null;
    }

    /**
     * 清除缓存
     */
    clearCache(key) {
        if (key) {
            this.cache.delete(key);
            localStorage.removeItem(`cache_${key}`);
        } else {
            // 清除所有缓存
            this.cache.clear();
            Object.keys(localStorage).forEach(storageKey => {
                if (storageKey.startsWith('cache_')) {
                    localStorage.removeItem(storageKey);
                }
            });
        }
    }

    /**
     * 设置加载状态
     */
    setLoadingState(key, isLoading) {
        this.loadingStates.set(key, isLoading);
        this.emit('loadingStateChanged', { key, isLoading });
    }

    /**
     * 获取加载状态
     */
    getLoadingState(key) {
        return this.loadingStates.get(key) || false;
    }

    /**
     * 设置错误状态
     */
    setErrorState(key, error) {
        this.errorStates.set(key, {
            error: error,
            timestamp: Date.now()
        });
        this.emit('errorStateChanged', { key, error });
    }

    /**
     * 清除错误状态
     */
    clearErrorState(key) {
        this.errorStates.delete(key);
        this.emit('errorStateChanged', { key, error: null });
    }

    /**
     * 获取错误状态
     */
    getErrorState(key) {
        const errorState = this.errorStates.get(key);
        return errorState ? errorState.error : null;
    }

    /**
     * 启动自动刷新
     */
    startAutoRefresh(key, fetchFunction, options = {}) {
        if (!this.options.enableAutoRefresh) {
            return;
        }
        
        const refreshOptions = { ...this.options, ...options };
        
        // 清除现有的刷新定时器
        this.stopAutoRefresh(key);
        
        const intervalId = setInterval(async () => {
            try {
                // 只有在页面可见且网络连接正常时才刷新
                if (!document.hidden && navigator.onLine !== false) {
                    await this.refreshData(key, fetchFunction, refreshOptions);
                }
            } catch (error) {
                console.error(`自动刷新失败: ${key}`, error);
            }
        }, refreshOptions.refreshInterval);
        
        this.refreshIntervals.set(key, intervalId);
        console.log(`启动自动刷新: ${key} (间隔: ${refreshOptions.refreshInterval}ms)`);
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh(key) {
        const intervalId = this.refreshIntervals.get(key);
        if (intervalId) {
            clearInterval(intervalId);
            this.refreshIntervals.delete(key);
            console.log(`停止自动刷新: ${key}`);
        }
    }

    /**
     * 暂停所有自动刷新
     */
    pauseAutoRefresh() {
        console.log('暂停所有自动刷新');
        this.refreshIntervals.forEach((intervalId, key) => {
            clearInterval(intervalId);
        });
    }

    /**
     * 恢复所有自动刷新
     */
    resumeAutoRefresh() {
        console.log('恢复所有自动刷新');
        // 这里需要重新启动所有的自动刷新
        // 实际实现中需要保存刷新配置
    }

    /**
     * 手动刷新数据
     */
    async refreshData(key, fetchFunction, options = {}) {
        // 强制刷新，忽略缓存
        this.clearCache(key);
        return this.fetchAndCacheData(key, fetchFunction, options);
    }

    /**
     * 等待加载完成
     */
    async waitForLoading(key, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkLoading = () => {
                if (!this.loadingStates.get(key)) {
                    const data = this.getCachedData(key);
                    if (data) {
                        resolve(data);
                    } else {
                        reject(new Error('数据加载失败'));
                    }
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('等待加载超时'));
                } else {
                    setTimeout(checkLoading, 100);
                }
            };
            
            checkLoading();
        });
    }

    /**
     * 处理网络重连
     */
    handleNetworkReconnect() {
        // 网络恢复后，刷新所有有错误状态的数据
        this.errorStates.forEach((errorState, key) => {
            console.log(`网络恢复，重新获取数据: ${key}`);
            // 这里需要重新获取数据的逻辑
        });
        
        this.emit('networkReconnected');
    }

    /**
     * 处理网络断开
     */
    handleNetworkDisconnect() {
        this.emit('networkDisconnected');
    }

    /**
     * 延迟函数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 事件处理
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (!this.eventHandlers.has(event)) {
            return;
        }
        
        const handlers = this.eventHandlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    emit(event, data) {
        if (!this.eventHandlers.has(event)) {
            return;
        }
        
        const handlers = this.eventHandlers.get(event);
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`事件处理器执行失败 (${event}):`, error);
            }
        });
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 停止所有自动刷新
        this.refreshIntervals.forEach((intervalId) => {
            clearInterval(intervalId);
        });
        this.refreshIntervals.clear();
        
        // 清除事件处理器
        this.eventHandlers.clear();
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStats() {
        return {
            cacheSize: this.cache.size,
            loadingCount: Array.from(this.loadingStates.values()).filter(Boolean).length,
            errorCount: this.errorStates.size,
            autoRefreshCount: this.refreshIntervals.size
        };
    }
}

// 创建全局数据缓存服务实例
window.dataCacheService = new DataCacheService({
    defaultTTL: 300000, // 5分钟
    maxRetries: 3,
    retryDelay: 1000,
    enableAutoRefresh: true,
    refreshInterval: 30000, // 30秒
    enableOfflineMode: true
});

// 导出服务类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataCacheService;
}