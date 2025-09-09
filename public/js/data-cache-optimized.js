/**
 * 优化的数据缓存服务
 * 提供高效的数据缓存、离线支持和性能监控
 */
class OptimizedDataCacheService {
    constructor() {
        this.cache = new Map();
        this.loadingStates = new Map();
        this.errorStates = new Map();
        this.refreshTimers = new Map();
        this.eventListeners = new Map();
        
        // 配置选项
        this.config = {
            defaultTTL: 300000, // 5分钟默认缓存时间
            maxCacheSize: 100,  // 最大缓存条目数
            maxRetries: 3,      // 最大重试次数
            retryDelay: 1000,   // 重试延迟
            enableOfflineMode: true,
            compressionThreshold: 10000 // 10KB以上数据启用压缩
        };
        
        // 性能监控
        this.metrics = {
            requests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            averageResponseTime: 0,
            compressionSavings: 0
        };
        
        // 网络状态监控
        this.isOnline = navigator.onLine;
        this.setupNetworkMonitoring();
        
        // 定期清理过期缓存
        this.startCacheCleanup();
    }

    /**
     * 获取数据（主要方法）
     * @param {string} key - 缓存键
     * @param {Function} fetchFunction - 数据获取函数
     * @param {Object} options - 选项
     * @returns {Promise} 数据
     */
    async getData(key, fetchFunction, options = {}) {
        const startTime = performance.now();
        const opts = { ...this.config, ...options };
        
        try {
            this.metrics.requests++;
            
            // 检查缓存
            const cached = this.getCachedData(key);
            if (cached && this.isCacheValid(cached, opts.defaultTTL)) {
                this.metrics.cacheHits++;
                this.emit('cacheHit', { key, data: cached.data });
                return cached.data;
            }
            
            this.metrics.cacheMisses++;
            
            // 检查是否正在加载
            if (this.loadingStates.get(key)) {
                return await this.loadingStates.get(key);
            }
            
            // 开始加载
            const loadingPromise = this.fetchWithRetry(key, fetchFunction, opts);
            this.loadingStates.set(key, loadingPromise);
            this.emit('loadingStateChanged', { key, isLoading: true });
            
            try {
                const data = await loadingPromise;
                
                // 缓存数据
                this.setCachedData(key, data, opts);
                
                // 清除错误状态
                this.errorStates.delete(key);
                this.emit('errorStateChanged', { key, error: null });
                
                // 更新性能指标
                const responseTime = performance.now() - startTime;
                this.updateResponseTimeMetrics(responseTime);
                
                this.emit('dataUpdated', { key, data });
                return data;
                
            } catch (error) {
                this.metrics.errors++;
                this.errorStates.set(key, error);
                this.emit('errorStateChanged', { key, error });
                
                // 尝试使用离线数据
                if (opts.enableOfflineMode) {
                    const offlineData = this.getOfflineData(key);
                    if (offlineData) {
                        this.emit('offlineDataUsed', { key, data: offlineData });
                        return offlineData;
                    }
                }
                
                throw error;
            } finally {
                this.loadingStates.delete(key);
                this.emit('loadingStateChanged', { key, isLoading: false });
            }
            
        } catch (error) {
            console.error(`数据获取失败 (${key}):`, error);
            throw error;
        }
    }

    /**
     * 带重试的数据获取
     * @private
     */
    async fetchWithRetry(key, fetchFunction, options) {
        let lastError;
        
        for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
            try {
                const data = await fetchFunction();
                return data;
            } catch (error) {
                lastError = error;
                
                if (attempt < options.maxRetries) {
                    const delay = options.retryDelay * Math.pow(2, attempt - 1); // 指数退避
                    console.warn(`数据获取失败 (${key})，${delay}ms后重试 (${attempt}/${options.maxRetries}):`, error.message);
                    await this.sleep(delay);
                } else {
                    console.error(`数据获取最终失败 (${key}):`, error);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * 获取缓存数据
     */
    getCachedData(key) {
        return this.cache.get(key);
    }

    /**
     * 设置缓存数据
     */
    setCachedData(key, data, options = {}) {
        const cacheEntry = {
            data: this.compressData(data),
            timestamp: Date.now(),
            ttl: options.defaultTTL || this.config.defaultTTL,
            compressed: this.shouldCompress(data)
        };
        
        this.cache.set(key, cacheEntry);
        
        // 同时保存到localStorage作为离线备份
        if (options.enableOfflineMode) {
            this.saveToLocalStorage(key, cacheEntry);
        }
        
        // 限制缓存大小
        this.limitCacheSize();
    }

    /**
     * 检查缓存是否有效
     */
    isCacheValid(cached, ttl) {
        if (!cached) return false;
        const age = Date.now() - cached.timestamp;
        return age < (cached.ttl || ttl);
    }

    /**
     * 数据压缩
     */
    compressData(data) {
        if (!this.shouldCompress(data)) {
            return data;
        }
        
        try {
            const jsonString = JSON.stringify(data);
            const originalSize = new Blob([jsonString]).size;
            
            // 简单的压缩：移除不必要的空格和换行
            const compressed = JSON.stringify(data);
            const compressedSize = new Blob([compressed]).size;
            
            this.metrics.compressionSavings += (originalSize - compressedSize);
            
            return {
                __compressed: true,
                data: compressed
            };
        } catch (error) {
            console.warn('数据压缩失败:', error);
            return data;
        }
    }

    /**
     * 数据解压缩
     */
    decompressData(data) {
        if (data && data.__compressed) {
            try {
                return JSON.parse(data.data);
            } catch (error) {
                console.warn('数据解压缩失败:', error);
                return data;
            }
        }
        return data;
    }

    /**
     * 判断是否需要压缩
     */
    shouldCompress(data) {
        try {
            const size = new Blob([JSON.stringify(data)]).size;
            return size > this.config.compressionThreshold;
        } catch {
            return false;
        }
    }

    /**
     * 限制缓存大小
     */
    limitCacheSize() {
        if (this.cache.size > this.config.maxCacheSize) {
            // 删除最旧的缓存条目
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    /**
     * 保存到localStorage
     */
    saveToLocalStorage(key, data) {
        try {
            const storageKey = `cache_${key}`;
            localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (error) {
            console.warn('保存到localStorage失败:', error);
        }
    }

    /**
     * 从localStorage恢复
     */
    restoreFromLocalStorage(key) {
        try {
            const storageKey = `cache_${key}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return this.decompressData(parsed.data);
            }
        } catch (error) {
            console.warn('从localStorage恢复失败:', error);
        }
        return null;
    }

    /**
     * 获取离线数据
     */
    getOfflineData(key) {
        // 首先尝试内存缓存
        const cached = this.getCachedData(key);
        if (cached) {
            return this.decompressData(cached.data);
        }
        
        // 然后尝试localStorage
        return this.restoreFromLocalStorage(key);
    }

    /**
     * 开始自动刷新
     */
    startAutoRefresh(key, fetchFunction, options = {}) {
        const interval = options.refreshInterval || 60000; // 默认1分钟
        
        // 清除现有定时器
        this.stopAutoRefresh(key);
        
        const timer = setInterval(async () => {
            try {
                if (this.isOnline && !this.loadingStates.get(key)) {
                    await this.getData(key, fetchFunction, { ...options, silent: true });
                }
            } catch (error) {
                console.warn(`自动刷新失败 (${key}):`, error.message);
            }
        }, interval);
        
        this.refreshTimers.set(key, timer);
    }

    /**
     * 停止自动刷新
     */
    stopAutoRefresh(key) {
        const timer = this.refreshTimers.get(key);
        if (timer) {
            clearInterval(timer);
            this.refreshTimers.delete(key);
        }
    }

    /**
     * 清除缓存
     */
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
            this.errorStates.delete(key);
            this.stopAutoRefresh(key);
        } else {
            this.cache.clear();
            this.errorStates.clear();
            this.refreshTimers.forEach(timer => clearInterval(timer));
            this.refreshTimers.clear();
        }
    }

    /**
     * 获取错误状态
     */
    getErrorState(key) {
        return this.errorStates.get(key) || null;
    }

    /**
     * 网络状态监控
     */
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.emit('networkReconnected');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.emit('networkDisconnected');
        });
    }

    /**
     * 定期清理过期缓存
     */
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, cached] of this.cache.entries()) {
                if (!this.isCacheValid(cached, cached.ttl)) {
                    this.cache.delete(key);
                }
            }
        }, 300000); // 每5分钟清理一次
    }

    /**
     * 更新响应时间指标
     */
    updateResponseTimeMetrics(responseTime) {
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime + responseTime) / 2;
    }

    /**
     * 获取性能指标
     */
    getPerformanceMetrics() {
        const cacheHitRate = this.metrics.requests > 0 
            ? (this.metrics.cacheHits / this.metrics.requests * 100).toFixed(2)
            : 0;
            
        return {
            ...this.metrics,
            cacheHitRate: `${cacheHitRate}%`,
            cacheSize: this.cache.size,
            isOnline: this.isOnline,
            compressionSavings: `${(this.metrics.compressionSavings / 1024).toFixed(2)} KB`
        };
    }

    /**
     * 事件系统
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`事件监听器错误 (${event}):`, error);
                }
            });
        }
    }

    /**
     * 预加载数据
     */
    async preloadData(preloadConfig) {
        const promises = preloadConfig.map(({ key, fetchFunction, options }) => 
            this.getData(key, fetchFunction, { ...options, silent: true })
                .catch(error => console.warn(`预加载失败 (${key}):`, error))
        );
        
        await Promise.allSettled(promises);
        console.log('数据预加载完成');
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 停止所有定时器
        this.refreshTimers.forEach(timer => clearInterval(timer));
        this.refreshTimers.clear();
        
        // 清除事件监听器
        this.eventListeners.clear();
        
        // 清除缓存
        this.cache.clear();
    }

    /**
     * 工具方法：延迟
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 创建全局实例
window.optimizedDataCacheService = new OptimizedDataCacheService();

// 向后兼容
if (!window.dataCacheService) {
    window.dataCacheService = window.optimizedDataCacheService;
}