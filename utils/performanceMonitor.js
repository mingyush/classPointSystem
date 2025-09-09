/**
 * 性能监控工具
 * 用于监控系统性能、API响应时间、内存使用等指标
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            apiCalls: new Map(),
            memoryUsage: [],
            cpuUsage: [],
            responseTime: [],
            errorRate: [],
            cacheHitRate: []
        };
        
        this.startTime = Date.now();
        this.isMonitoring = false;
        this.monitoringInterval = null;
        
        // 性能阈值配置
        this.thresholds = {
            responseTime: 1000,    // 1秒
            memoryUsage: 80,       // 80%
            cpuUsage: 80,          // 80%
            errorRate: 5,          // 5%
            cacheHitRate: 70       // 70%
        };
    }

    /**
     * 开始性能监控
     * @param {number} interval - 监控间隔（毫秒）
     */
    startMonitoring(interval = 30000) {
        if (this.isMonitoring) {
            console.log('性能监控已在运行');
            return;
        }

        console.log('开始性能监控...');
        this.isMonitoring = true;
        
        // 立即收集一次基线数据
        this.collectMetrics();
        
        // 定期收集性能数据
        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, interval);
        
        // 定期分析和报告
        setInterval(() => {
            this.analyzePerformance();
        }, 300000); // 每5分钟分析一次
    }

    /**
     * 停止性能监控
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        console.log('停止性能监控');
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    /**
     * 收集性能指标
     * @private
     */
    collectMetrics() {
        const timestamp = Date.now();
        
        // 收集内存使用情况
        const memoryUsage = process.memoryUsage();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        
        this.metrics.memoryUsage.push({
            timestamp,
            heap: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            system: {
                used: usedMemory,
                total: totalMemory,
                percentage: (usedMemory / totalMemory) * 100
            },
            rss: memoryUsage.rss,
            external: memoryUsage.external
        });
        
        // 收集CPU使用情况
        const cpuUsage = process.cpuUsage();
        this.metrics.cpuUsage.push({
            timestamp,
            user: cpuUsage.user,
            system: cpuUsage.system,
            percentage: this.calculateCpuPercentage(cpuUsage)
        });
        
        // 限制历史数据大小
        this.limitMetricsSize();
    }

    /**
     * 计算CPU使用百分比
     * @private
     */
    calculateCpuPercentage(cpuUsage) {
        const totalUsage = cpuUsage.user + cpuUsage.system;
        const totalTime = Date.now() - this.startTime;
        return (totalUsage / (totalTime * 1000)) * 100;
    }

    /**
     * 限制指标数据大小
     * @private
     */
    limitMetricsSize() {
        const maxSize = 1000; // 保留最近1000条记录
        
        Object.keys(this.metrics).forEach(key => {
            if (Array.isArray(this.metrics[key]) && this.metrics[key].length > maxSize) {
                this.metrics[key] = this.metrics[key].slice(-maxSize);
            }
        });
    }

    /**
     * 记录API调用性能
     * @param {string} endpoint - API端点
     * @param {number} responseTime - 响应时间
     * @param {number} statusCode - 状态码
     */
    recordApiCall(endpoint, responseTime, statusCode) {
        const timestamp = Date.now();
        
        if (!this.metrics.apiCalls.has(endpoint)) {
            this.metrics.apiCalls.set(endpoint, {
                totalCalls: 0,
                totalTime: 0,
                errors: 0,
                responseTimes: [],
                statusCodes: new Map()
            });
        }
        
        const apiMetrics = this.metrics.apiCalls.get(endpoint);
        apiMetrics.totalCalls++;
        apiMetrics.totalTime += responseTime;
        apiMetrics.responseTimes.push({ timestamp, responseTime });
        
        // 记录状态码
        const statusCount = apiMetrics.statusCodes.get(statusCode) || 0;
        apiMetrics.statusCodes.set(statusCode, statusCount + 1);
        
        // 记录错误
        if (statusCode >= 400) {
            apiMetrics.errors++;
        }
        
        // 限制响应时间历史记录大小
        if (apiMetrics.responseTimes.length > 100) {
            apiMetrics.responseTimes = apiMetrics.responseTimes.slice(-100);
        }
        
        // 记录到全局响应时间指标
        this.metrics.responseTime.push({
            timestamp,
            endpoint,
            responseTime,
            statusCode
        });
        
        // 检查性能阈值
        this.checkPerformanceThresholds(endpoint, responseTime, statusCode);
    }

    /**
     * 检查性能阈值
     * @private
     */
    checkPerformanceThresholds(endpoint, responseTime, statusCode) {
        // 检查响应时间阈值
        if (responseTime > this.thresholds.responseTime) {
            console.warn(`⚠️  API响应时间过长: ${endpoint} - ${responseTime}ms`);
        }
        
        // 检查错误率
        const apiMetrics = this.metrics.apiCalls.get(endpoint);
        const errorRate = (apiMetrics.errors / apiMetrics.totalCalls) * 100;
        if (errorRate > this.thresholds.errorRate) {
            console.warn(`⚠️  API错误率过高: ${endpoint} - ${errorRate.toFixed(2)}%`);
        }
    }

    /**
     * 记录缓存命中率
     * @param {string} cacheKey - 缓存键
     * @param {boolean} isHit - 是否命中
     */
    recordCacheHit(cacheKey, isHit) {
        this.metrics.cacheHitRate.push({
            timestamp: Date.now(),
            cacheKey,
            isHit
        });
    }

    /**
     * 分析性能数据
     */
    analyzePerformance() {
        const analysis = {
            timestamp: new Date().toISOString(),
            summary: this.generateSummary(),
            alerts: this.generateAlerts(),
            recommendations: this.generateRecommendations()
        };
        
        console.log('📊 性能分析报告:');
        console.log(`内存使用: ${analysis.summary.memoryUsage.toFixed(2)}%`);
        console.log(`平均响应时间: ${analysis.summary.averageResponseTime.toFixed(2)}ms`);
        console.log(`缓存命中率: ${analysis.summary.cacheHitRate.toFixed(2)}%`);
        
        if (analysis.alerts.length > 0) {
            console.log('🚨 性能警告:');
            analysis.alerts.forEach(alert => console.log(`  - ${alert}`));
        }
        
        return analysis;
    }

    /**
     * 生成性能摘要
     * @private
     */
    generateSummary() {
        const now = Date.now();
        const oneHourAgo = now - 3600000; // 1小时前
        
        // 计算平均内存使用
        const recentMemory = this.metrics.memoryUsage.filter(m => m.timestamp > oneHourAgo);
        const avgMemoryUsage = recentMemory.length > 0 
            ? recentMemory.reduce((sum, m) => sum + m.system.percentage, 0) / recentMemory.length
            : 0;
        
        // 计算平均响应时间
        const recentResponses = this.metrics.responseTime.filter(r => r.timestamp > oneHourAgo);
        const avgResponseTime = recentResponses.length > 0
            ? recentResponses.reduce((sum, r) => sum + r.responseTime, 0) / recentResponses.length
            : 0;
        
        // 计算缓存命中率
        const recentCacheHits = this.metrics.cacheHitRate.filter(c => c.timestamp > oneHourAgo);
        const cacheHitRate = recentCacheHits.length > 0
            ? (recentCacheHits.filter(c => c.isHit).length / recentCacheHits.length) * 100
            : 0;
        
        // 计算错误率
        const totalErrors = recentResponses.filter(r => r.statusCode >= 400).length;
        const errorRate = recentResponses.length > 0
            ? (totalErrors / recentResponses.length) * 100
            : 0;
        
        return {
            memoryUsage: avgMemoryUsage,
            averageResponseTime: avgResponseTime,
            cacheHitRate,
            errorRate,
            totalRequests: recentResponses.length,
            uptime: now - this.startTime
        };
    }

    /**
     * 生成性能警告
     * @private
     */
    generateAlerts() {
        const alerts = [];
        const summary = this.generateSummary();
        
        if (summary.memoryUsage > this.thresholds.memoryUsage) {
            alerts.push(`内存使用率过高: ${summary.memoryUsage.toFixed(2)}%`);
        }
        
        if (summary.averageResponseTime > this.thresholds.responseTime) {
            alerts.push(`平均响应时间过长: ${summary.averageResponseTime.toFixed(2)}ms`);
        }
        
        if (summary.cacheHitRate < this.thresholds.cacheHitRate) {
            alerts.push(`缓存命中率过低: ${summary.cacheHitRate.toFixed(2)}%`);
        }
        
        if (summary.errorRate > this.thresholds.errorRate) {
            alerts.push(`错误率过高: ${summary.errorRate.toFixed(2)}%`);
        }
        
        return alerts;
    }

    /**
     * 生成优化建议
     * @private
     */
    generateRecommendations() {
        const recommendations = [];
        const summary = this.generateSummary();
        
        if (summary.memoryUsage > 70) {
            recommendations.push('考虑增加内存或优化内存使用');
        }
        
        if (summary.averageResponseTime > 500) {
            recommendations.push('优化数据库查询或增加缓存');
        }
        
        if (summary.cacheHitRate < 80) {
            recommendations.push('调整缓存策略，提高命中率');
        }
        
        // 分析最慢的API端点
        const slowestEndpoints = this.getSlowApiEndpoints();
        if (slowestEndpoints.length > 0) {
            recommendations.push(`优化慢速API: ${slowestEndpoints.join(', ')}`);
        }
        
        return recommendations;
    }

    /**
     * 获取最慢的API端点
     * @private
     */
    getSlowApiEndpoints() {
        const endpointStats = [];
        
        for (const [endpoint, metrics] of this.metrics.apiCalls.entries()) {
            const avgResponseTime = metrics.totalTime / metrics.totalCalls;
            endpointStats.push({ endpoint, avgResponseTime });
        }
        
        return endpointStats
            .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
            .slice(0, 3)
            .filter(stat => stat.avgResponseTime > 500)
            .map(stat => stat.endpoint);
    }

    /**
     * 获取详细的性能报告
     */
    getDetailedReport() {
        const report = {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            summary: this.generateSummary(),
            apiMetrics: this.getApiMetricsReport(),
            systemMetrics: this.getSystemMetricsReport(),
            alerts: this.generateAlerts(),
            recommendations: this.generateRecommendations()
        };
        
        return report;
    }

    /**
     * 获取API指标报告
     * @private
     */
    getApiMetricsReport() {
        const report = {};
        
        for (const [endpoint, metrics] of this.metrics.apiCalls.entries()) {
            const avgResponseTime = metrics.totalTime / metrics.totalCalls;
            const errorRate = (metrics.errors / metrics.totalCalls) * 100;
            
            report[endpoint] = {
                totalCalls: metrics.totalCalls,
                averageResponseTime: Math.round(avgResponseTime),
                errorRate: Math.round(errorRate * 100) / 100,
                statusCodes: Object.fromEntries(metrics.statusCodes)
            };
        }
        
        return report;
    }

    /**
     * 获取系统指标报告
     * @private
     */
    getSystemMetricsReport() {
        const recentMemory = this.metrics.memoryUsage.slice(-10);
        const recentCpu = this.metrics.cpuUsage.slice(-10);
        
        return {
            memory: {
                current: recentMemory.length > 0 ? recentMemory[recentMemory.length - 1] : null,
                average: recentMemory.length > 0 
                    ? recentMemory.reduce((sum, m) => sum + m.system.percentage, 0) / recentMemory.length
                    : 0
            },
            cpu: {
                current: recentCpu.length > 0 ? recentCpu[recentCpu.length - 1] : null,
                average: recentCpu.length > 0
                    ? recentCpu.reduce((sum, c) => sum + c.percentage, 0) / recentCpu.length
                    : 0
            }
        };
    }

    /**
     * 导出性能数据
     * @param {string} filePath - 导出文件路径
     */
    async exportMetrics(filePath = 'performance-metrics.json') {
        const report = this.getDetailedReport();
        
        try {
            await fs.writeFile(filePath, JSON.stringify(report, null, 2));
            console.log(`性能数据已导出到: ${filePath}`);
        } catch (error) {
            console.error('导出性能数据失败:', error);
        }
    }

    /**
     * 清理旧的性能数据
     */
    cleanup() {
        const cutoffTime = Date.now() - 86400000; // 24小时前
        
        // 清理旧的响应时间数据
        this.metrics.responseTime = this.metrics.responseTime.filter(
            r => r.timestamp > cutoffTime
        );
        
        // 清理旧的缓存命中率数据
        this.metrics.cacheHitRate = this.metrics.cacheHitRate.filter(
            c => c.timestamp > cutoffTime
        );
        
        // 清理旧的系统指标数据
        this.metrics.memoryUsage = this.metrics.memoryUsage.filter(
            m => m.timestamp > cutoffTime
        );
        
        this.metrics.cpuUsage = this.metrics.cpuUsage.filter(
            c => c.timestamp > cutoffTime
        );
        
        console.log('性能数据清理完成');
    }
}

module.exports = PerformanceMonitor;