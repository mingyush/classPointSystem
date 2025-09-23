/**
 * 性能优化中间件
 * 集成缓存策略、请求优化和边缘计算能力
 */

const { CacheManager, CACHE_STRATEGIES, CacheKeyGenerator, CacheInvalidation } = require('../cache/cache-manager');

/**
 * 性能监控器
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * 开始性能监控
   * @param {string} operation - 操作名称
   * @returns {Function} 结束监控函数
   */
  start(operation) {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  /**
   * 记录性能指标
   * @param {string} operation - 操作名称
   * @param {number} duration - 持续时间（毫秒）
   */
  recordMetric(operation, duration) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        count: 0,
        totalTime: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0
      });
    }

    const metric = this.metrics.get(operation);
    metric.count++;
    metric.totalTime += duration;
    metric.minTime = Math.min(metric.minTime, duration);
    metric.maxTime = Math.max(metric.maxTime, duration);
    metric.avgTime = metric.totalTime / metric.count;
  }

  /**
   * 获取性能指标
   * @param {string} operation - 操作名称
   * @returns {object} 性能指标
   */
  getMetrics(operation) {
    return this.metrics.get(operation) || null;
  }

  /**
   * 获取所有性能指标
   * @returns {object} 所有性能指标
   */
  getAllMetrics() {
    const result = {};
    for (const [operation, metrics] of this.metrics) {
      result[operation] = { ...metrics };
    }
    return result;
  }

  /**
   * 重置性能指标
   */
  reset() {
    this.metrics.clear();
  }
}

/**
 * 请求优化器
 */
class RequestOptimizer {
  constructor() {
    this.requestQueue = new Map();
    this.batchSize = 10;
    this.batchTimeout = 100; // 100ms
  }

  /**
   * 批量处理请求
   * @param {string} key - 批处理键
   * @param {Function} processor - 处理函数
   * @param {any} data - 请求数据
   * @returns {Promise} 处理结果
   */
  async batchProcess(key, processor, data) {
    if (!this.requestQueue.has(key)) {
      this.requestQueue.set(key, {
        requests: [],
        timer: null,
        processor
      });
    }

    const batch = this.requestQueue.get(key);
    
    return new Promise((resolve, reject) => {
      batch.requests.push({ data, resolve, reject });

      // 如果达到批处理大小，立即处理
      if (batch.requests.length >= this.batchSize) {
        this.processBatch(key);
        return;
      }

      // 设置超时处理
      if (!batch.timer) {
        batch.timer = setTimeout(() => {
          this.processBatch(key);
        }, this.batchTimeout);
      }
    });
  }

  /**
   * 处理批次
   * @param {string} key - 批处理键
   */
  async processBatch(key) {
    const batch = this.requestQueue.get(key);
    if (!batch || batch.requests.length === 0) {
      return;
    }

    // 清除定时器
    if (batch.timer) {
      clearTimeout(batch.timer);
      batch.timer = null;
    }

    const requests = batch.requests.splice(0);
    
    try {
      const results = await batch.processor(requests.map(r => r.data));
      
      // 返回结果给各个请求
      requests.forEach((request, index) => {
        request.resolve(results[index]);
      });
    } catch (error) {
      // 所有请求都返回错误
      requests.forEach(request => {
        request.reject(error);
      });
    }

    // 如果还有待处理的请求，继续处理
    if (batch.requests.length > 0) {
      batch.timer = setTimeout(() => {
        this.processBatch(key);
      }, this.batchTimeout);
    }
  }
}

/**
 * 响应压缩器
 */
class ResponseCompressor {
  /**
   * 检查是否应该压缩响应
   * @param {Request} request - 请求对象
   * @param {number} contentLength - 内容长度
   * @returns {boolean} 是否应该压缩
   */
  shouldCompress(request, contentLength) {
    // 检查客户端是否支持压缩
    const acceptEncoding = request.headers.get('accept-encoding') || '';
    const supportsGzip = acceptEncoding.includes('gzip');
    
    // 只压缩较大的响应（>1KB）
    const isLargeEnough = contentLength > 1024;
    
    return supportsGzip && isLargeEnough;
  }

  /**
   * 压缩响应
   * @param {Response} response - 原始响应
   * @param {Request} request - 请求对象
   * @returns {Promise<Response>} 压缩后的响应
   */
  async compress(response, request) {
    const contentType = response.headers.get('content-type') || '';
    
    // 只压缩文本类型的响应
    if (!contentType.includes('application/json') && 
        !contentType.includes('text/')) {
      return response;
    }

    const content = await response.text();
    
    if (!this.shouldCompress(request, content.length)) {
      return new Response(content, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }

    // 在实际环境中，这里会使用真正的gzip压缩
    // 现在我们模拟压缩效果
    const compressedContent = content;
    
    const headers = new Headers(response.headers);
    headers.set('content-encoding', 'gzip');
    headers.set('content-length', compressedContent.length.toString());
    
    return new Response(compressedContent, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}

/**
 * 边缘缓存优化器
 */
class EdgeCacheOptimizer {
  /**
   * 设置边缘缓存头
   * @param {Response} response - 响应对象
   * @param {object} options - 缓存选项
   * @returns {Response} 设置了缓存头的响应
   */
  setCacheHeaders(response, options = {}) {
    const {
      maxAge = 300, // 5分钟默认缓存
      sMaxAge = 600, // 10分钟边缘缓存
      staleWhileRevalidate = 86400, // 24小时过期重新验证
      mustRevalidate = false,
      noCache = false,
      private = false
    } = options;

    const headers = new Headers(response.headers);
    
    if (noCache) {
      headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      headers.set('pragma', 'no-cache');
      headers.set('expires', '0');
    } else {
      const cacheDirectives = [];
      
      if (private) {
        cacheDirectives.push('private');
      } else {
        cacheDirectives.push('public');
      }
      
      cacheDirectives.push(`max-age=${maxAge}`);
      
      if (sMaxAge > 0) {
        cacheDirectives.push(`s-maxage=${sMaxAge}`);
      }
      
      if (staleWhileRevalidate > 0) {
        cacheDirectives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
      }
      
      if (mustRevalidate) {
        cacheDirectives.push('must-revalidate');
      }
      
      headers.set('cache-control', cacheDirectives.join(', '));
    }
    
    // 设置ETag用于条件请求
    if (!headers.has('etag')) {
      const etag = this.generateETag(response);
      headers.set('etag', etag);
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * 生成ETag
   * @param {Response} response - 响应对象
   * @returns {string} ETag值
   */
  generateETag(response) {
    // 简单的ETag生成（在实际环境中应该使用更复杂的算法）
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `"${timestamp}-${random}"`;
  }

  /**
   * 检查条件请求
   * @param {Request} request - 请求对象
   * @param {string} etag - 当前ETag
   * @returns {boolean} 是否返回304
   */
  checkConditionalRequest(request, etag) {
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch && ifNoneMatch === etag) {
      return true;
    }
    
    return false;
  }
}

/**
 * 性能优化中间件
 */
class PerformanceMiddleware {
  constructor(env) {
    this.cache = new CacheManager(env.CACHE_KV, {
      defaultTTL: 300,
      keyPrefix: 'perf:',
      enableCompression: true
    });
    this.invalidation = new CacheInvalidation(this.cache);
    this.monitor = new PerformanceMonitor();
    this.optimizer = new RequestOptimizer();
    this.compressor = new ResponseCompressor();
    this.edgeCache = new EdgeCacheOptimizer();
  }

  /**
   * 缓存中间件
   * @param {string} cacheKey - 缓存键
   * @param {object} strategy - 缓存策略
   * @returns {Function} 中间件函数
   */
  cacheMiddleware(cacheKey, strategy) {
    return async (request, env, ctx, next) => {
      const endMonitor = this.monitor.start(`cache:${cacheKey}`);
      
      try {
        // 尝试从缓存获取
        const cached = await this.cache.get(cacheKey, strategy);
        
        if (cached) {
          endMonitor();
          
          // 设置缓存命中头
          const response = new Response(JSON.stringify(cached), {
            headers: {
              'content-type': 'application/json',
              'x-cache': 'HIT',
              'x-cache-key': cacheKey
            }
          });
          
          return this.edgeCache.setCacheHeaders(response, {
            maxAge: strategy.ttl,
            sMaxAge: strategy.ttl * 2
          });
        }
        
        // 缓存未命中，执行下一个中间件
        const response = await next();
        
        if (response.ok) {
          const data = await response.clone().json();
          
          // 异步缓存数据
          ctx.waitUntil(
            this.cache.set(cacheKey, data, strategy)
          );
          
          // 设置缓存未命中头
          const headers = new Headers(response.headers);
          headers.set('x-cache', 'MISS');
          headers.set('x-cache-key', cacheKey);
          
          const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          });
          
          endMonitor();
          return this.edgeCache.setCacheHeaders(newResponse, {
            maxAge: strategy.ttl,
            sMaxAge: strategy.ttl * 2
          });
        }
        
        endMonitor();
        return response;
      } catch (error) {
        endMonitor();
        console.error('缓存中间件错误:', error);
        return await next();
      }
    };
  }

  /**
   * 压缩中间件
   * @returns {Function} 中间件函数
   */
  compressionMiddleware() {
    return async (request, env, ctx, next) => {
      const response = await next();
      
      // 只压缩成功的响应
      if (!response.ok) {
        return response;
      }
      
      return await this.compressor.compress(response, request);
    };
  }

  /**
   * 性能监控中间件
   * @param {string} operation - 操作名称
   * @returns {Function} 中间件函数
   */
  monitoringMiddleware(operation) {
    return async (request, env, ctx, next) => {
      const endMonitor = this.monitor.start(operation);
      
      try {
        const response = await next();
        const duration = endMonitor();
        
        // 添加性能头
        const headers = new Headers(response.headers);
        headers.set('x-response-time', `${duration}ms`);
        headers.set('x-operation', operation);
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (error) {
        endMonitor();
        throw error;
      }
    };
  }

  /**
   * 条件请求中间件
   * @returns {Function} 中间件函数
   */
  conditionalRequestMiddleware() {
    return async (request, env, ctx, next) => {
      const response = await next();
      
      if (!response.ok) {
        return response;
      }
      
      // 生成ETag
      const etag = this.edgeCache.generateETag(response);
      
      // 检查条件请求
      if (this.edgeCache.checkConditionalRequest(request, etag)) {
        return new Response(null, {
          status: 304,
          headers: {
            'etag': etag,
            'cache-control': 'max-age=300'
          }
        });
      }
      
      // 设置ETag头
      const headers = new Headers(response.headers);
      headers.set('etag', etag);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    };
  }

  /**
   * 获取性能指标
   * @returns {object} 性能指标
   */
  getPerformanceMetrics() {
    return this.monitor.getAllMetrics();
  }

  /**
   * 获取缓存统计
   * @returns {Promise<object>} 缓存统计
   */
  async getCacheStats() {
    const stats = {};
    
    for (const [name, strategy] of Object.entries(CACHE_STRATEGIES)) {
      stats[name] = await this.cache.getStats(strategy.namespace);
    }
    
    return stats;
  }

  /**
   * 清理缓存
   * @param {string} namespace - 命名空间
   * @returns {Promise<number>} 清理的键数量
   */
  async clearCache(namespace) {
    return await this.cache.clear(namespace);
  }
}

module.exports = {
  PerformanceMiddleware,
  PerformanceMonitor,
  RequestOptimizer,
  ResponseCompressor,
  EdgeCacheOptimizer,
  CACHE_STRATEGIES,
  CacheKeyGenerator
};