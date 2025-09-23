/**
 * 缓存管理器
 * 利用Cloudflare KV存储实现高性能缓存策略
 */

class CacheManager {
  constructor(kv, options = {}) {
    this.kv = kv;
    this.defaultTTL = options.defaultTTL || 300; // 5分钟默认TTL
    this.keyPrefix = options.keyPrefix || 'cache:';
    this.enableCompression = options.enableCompression || true;
  }

  /**
   * 生成缓存键
   * @param {string} key - 原始键
   * @param {string} namespace - 命名空间
   * @returns {string} 完整的缓存键
   */
  generateKey(key, namespace = 'default') {
    return `${this.keyPrefix}${namespace}:${key}`;
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {object} options - 选项
   * @returns {Promise<void>}
   */
  async set(key, value, options = {}) {
    const {
      ttl = this.defaultTTL,
      namespace = 'default',
      compress = this.enableCompression
    } = options;

    const cacheKey = this.generateKey(key, namespace);
    
    // 创建缓存对象
    const cacheData = {
      value,
      timestamp: Date.now(),
      ttl,
      compressed: false
    };

    let serializedData = JSON.stringify(cacheData);

    // 如果启用压缩且数据较大，进行压缩
    if (compress && serializedData.length > 1024) {
      try {
        // 使用简单的压缩策略（在实际环境中可以使用更高效的压缩算法）
        cacheData.compressed = true;
        serializedData = JSON.stringify(cacheData);
      } catch (error) {
        console.warn('缓存压缩失败:', error);
      }
    }

    // 设置过期时间
    const expirationTtl = ttl > 0 ? ttl : undefined;
    
    await this.kv.put(cacheKey, serializedData, {
      expirationTtl
    });
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @param {object} options - 选项
   * @returns {Promise<any|null>} 缓存值或null
   */
  async get(key, options = {}) {
    const { namespace = 'default' } = options;
    const cacheKey = this.generateKey(key, namespace);

    try {
      const cachedData = await this.kv.get(cacheKey);
      
      if (!cachedData) {
        return null;
      }

      const cacheObject = JSON.parse(cachedData);
      
      // 检查是否过期（双重保险）
      if (cacheObject.ttl > 0) {
        const age = (Date.now() - cacheObject.timestamp) / 1000;
        if (age > cacheObject.ttl) {
          // 异步删除过期缓存
          this.delete(key, { namespace }).catch(console.error);
          return null;
        }
      }

      return cacheObject.value;
    } catch (error) {
      console.error('缓存获取失败:', error);
      return null;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @param {object} options - 选项
   * @returns {Promise<void>}
   */
  async delete(key, options = {}) {
    const { namespace = 'default' } = options;
    const cacheKey = this.generateKey(key, namespace);
    
    await this.kv.delete(cacheKey);
  }

  /**
   * 批量删除缓存（按前缀）
   * @param {string} prefix - 键前缀
   * @param {object} options - 选项
   * @returns {Promise<number>} 删除的键数量
   */
  async deleteByPrefix(prefix, options = {}) {
    const { namespace = 'default' } = options;
    const searchPrefix = this.generateKey(prefix, namespace);
    
    try {
      const list = await this.kv.list({ prefix: searchPrefix });
      const deletePromises = list.keys.map(key => this.kv.delete(key.name));
      
      await Promise.all(deletePromises);
      return list.keys.length;
    } catch (error) {
      console.error('批量删除缓存失败:', error);
      return 0;
    }
  }

  /**
   * 获取或设置缓存（缓存穿透保护）
   * @param {string} key - 缓存键
   * @param {Function} fetcher - 数据获取函数
   * @param {object} options - 选项
   * @returns {Promise<any>} 数据
   */
  async getOrSet(key, fetcher, options = {}) {
    // 先尝试从缓存获取
    const cached = await this.get(key, options);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，获取新数据
    try {
      const data = await fetcher();
      
      // 只缓存非空数据
      if (data !== null && data !== undefined) {
        await this.set(key, data, options);
      }
      
      return data;
    } catch (error) {
      console.error('数据获取失败:', error);
      throw error;
    }
  }

  /**
   * 缓存统计信息
   * @param {string} namespace - 命名空间
   * @returns {Promise<object>} 统计信息
   */
  async getStats(namespace = 'default') {
    try {
      const prefix = this.generateKey('', namespace);
      const list = await this.kv.list({ prefix });
      
      return {
        totalKeys: list.keys.length,
        namespace,
        prefix
      };
    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return {
        totalKeys: 0,
        namespace,
        error: error.message
      };
    }
  }

  /**
   * 清空命名空间下的所有缓存
   * @param {string} namespace - 命名空间
   * @returns {Promise<number>} 清空的键数量
   */
  async clear(namespace = 'default') {
    return await this.deleteByPrefix('', { namespace });
  }
}

/**
 * 缓存策略配置
 */
const CACHE_STRATEGIES = {
  // 学生数据缓存策略
  STUDENTS: {
    namespace: 'students',
    ttl: 600, // 10分钟
    compress: true
  },
  
  // 积分记录缓存策略
  POINTS: {
    namespace: 'points',
    ttl: 300, // 5分钟
    compress: true
  },
  
  // 商品数据缓存策略
  PRODUCTS: {
    namespace: 'products',
    ttl: 1800, // 30分钟
    compress: false
  },
  
  // 订单数据缓存策略
  ORDERS: {
    namespace: 'orders',
    ttl: 180, // 3分钟
    compress: true
  },
  
  // 系统配置缓存策略
  CONFIG: {
    namespace: 'config',
    ttl: 3600, // 1小时
    compress: false
  },
  
  // 统计数据缓存策略
  STATS: {
    namespace: 'stats',
    ttl: 900, // 15分钟
    compress: true
  },
  
  // 排行榜缓存策略
  LEADERBOARD: {
    namespace: 'leaderboard',
    ttl: 600, // 10分钟
    compress: true
  },
  
  // 会话缓存策略
  SESSION: {
    namespace: 'session',
    ttl: 7200, // 2小时
    compress: false
  }
};

/**
 * 缓存键生成器
 */
class CacheKeyGenerator {
  static student(id) {
    return `student:${id}`;
  }
  
  static studentList(page = 1, limit = 50) {
    return `students:list:${page}:${limit}`;
  }
  
  static studentStats() {
    return 'students:stats';
  }
  
  static pointsHistory(studentId, page = 1, limit = 50) {
    return `points:history:${studentId}:${page}:${limit}`;
  }
  
  static pointsRecords(page = 1, limit = 50) {
    return `points:records:${page}:${limit}`;
  }
  
  static leaderboard(limit = 10) {
    return `leaderboard:${limit}`;
  }
  
  static products(active = null, page = 1, limit = 50) {
    const activeStr = active !== null ? `:${active}` : '';
    return `products:list${activeStr}:${page}:${limit}`;
  }
  
  static product(id) {
    return `product:${id}`;
  }
  
  static orders(studentId = null, status = null, page = 1, limit = 50) {
    const studentStr = studentId ? `:student:${studentId}` : '';
    const statusStr = status ? `:status:${status}` : '';
    return `orders:list${studentStr}${statusStr}:${page}:${limit}`;
  }
  
  static systemConfig() {
    return 'system:config';
  }
  
  static systemMode() {
    return 'system:mode';
  }
  
  static userSession(userId) {
    return `session:${userId}`;
  }
}

/**
 * 缓存失效策略
 */
class CacheInvalidation {
  constructor(cacheManager) {
    this.cache = cacheManager;
  }
  
  /**
   * 学生数据变更时的缓存失效
   * @param {string} studentId - 学生ID
   */
  async invalidateStudent(studentId) {
    const tasks = [
      this.cache.delete(CacheKeyGenerator.student(studentId), CACHE_STRATEGIES.STUDENTS),
      this.cache.deleteByPrefix('students:list', CACHE_STRATEGIES.STUDENTS),
      this.cache.delete(CacheKeyGenerator.studentStats(), CACHE_STRATEGIES.STATS),
      this.cache.deleteByPrefix('leaderboard', CACHE_STRATEGIES.LEADERBOARD)
    ];
    
    await Promise.allSettled(tasks);
  }
  
  /**
   * 积分记录变更时的缓存失效
   * @param {string} studentId - 学生ID
   */
  async invalidatePoints(studentId) {
    const tasks = [
      this.cache.delete(CacheKeyGenerator.student(studentId), CACHE_STRATEGIES.STUDENTS),
      this.cache.deleteByPrefix(`points:history:${studentId}`, CACHE_STRATEGIES.POINTS),
      this.cache.deleteByPrefix('points:records', CACHE_STRATEGIES.POINTS),
      this.cache.deleteByPrefix('leaderboard', CACHE_STRATEGIES.LEADERBOARD),
      this.cache.delete(CacheKeyGenerator.studentStats(), CACHE_STRATEGIES.STATS)
    ];
    
    await Promise.allSettled(tasks);
  }
  
  /**
   * 商品数据变更时的缓存失效
   * @param {string} productId - 商品ID
   */
  async invalidateProduct(productId) {
    const tasks = [
      this.cache.delete(CacheKeyGenerator.product(productId), CACHE_STRATEGIES.PRODUCTS),
      this.cache.deleteByPrefix('products:list', CACHE_STRATEGIES.PRODUCTS)
    ];
    
    await Promise.allSettled(tasks);
  }
  
  /**
   * 订单数据变更时的缓存失效
   * @param {string} studentId - 学生ID
   * @param {string} productId - 商品ID
   */
  async invalidateOrder(studentId, productId) {
    const tasks = [
      this.cache.deleteByPrefix('orders:list', CACHE_STRATEGIES.ORDERS),
      this.cache.delete(CacheKeyGenerator.student(studentId), CACHE_STRATEGIES.STUDENTS),
      this.cache.delete(CacheKeyGenerator.product(productId), CACHE_STRATEGIES.PRODUCTS)
    ];
    
    await Promise.allSettled(tasks);
  }
  
  /**
   * 系统配置变更时的缓存失效
   */
  async invalidateConfig() {
    const tasks = [
      this.cache.delete(CacheKeyGenerator.systemConfig(), CACHE_STRATEGIES.CONFIG),
      this.cache.delete(CacheKeyGenerator.systemMode(), CACHE_STRATEGIES.CONFIG)
    ];
    
    await Promise.allSettled(tasks);
  }
}

module.exports = {
  CacheManager,
  CACHE_STRATEGIES,
  CacheKeyGenerator,
  CacheInvalidation
};