const DataAccess = require('../utils/dataAccess');
const { PointRecord } = require('../models/dataModels');
const StudentService = require('./studentService');

/**
 * 积分服务层
 * 提供积分记录的CRUD操作、余额计算和排名统计
 */
class PointsService {
    constructor() {
        this.dataAccess = new DataAccess();
        this.filename = 'points.json';
        this.studentService = new StudentService();
        
        // 缓存机制
        this.rankingCache = new Map();
        this.cacheTimeout = 60000; // 1分钟缓存
        
        // 性能监控
        this.performanceMetrics = {
            queryCount: 0,
            cacheHits: 0,
            averageQueryTime: 0
        };
    }

    /**
     * 获取所有积分记录
     * @returns {Promise<PointRecord[]>}
     */
    async getAllPointRecords() {
        try {
            const data = await this.dataAccess.readFile(this.filename, { records: [] });
            return data.records.map(record => new PointRecord(record));
        } catch (error) {
            console.error('获取积分记录失败:', error);
            throw new Error('获取积分记录失败');
        }
    }

    /**
     * 根据学生ID获取积分记录
     * @param {string} studentId - 学号
     * @param {number} limit - 限制返回数量
     * @returns {Promise<PointRecord[]>}
     */
    async getPointRecordsByStudent(studentId, limit = null) {
        try {
            if (!studentId || typeof studentId !== 'string') {
                throw new Error('学号不能为空且必须为字符串');
            }

            const records = await this.getAllPointRecords();
            let studentRecords = records
                .filter(record => record.studentId === studentId)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (limit && typeof limit === 'number' && limit > 0) {
                studentRecords = studentRecords.slice(0, limit);
            }

            return studentRecords;
        } catch (error) {
            console.error(`获取学生积分记录失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 添加积分记录
     * @param {object} recordData - 积分记录数据
     * @returns {Promise<PointRecord>}
     */
    async addPointRecord(recordData) {
        try {
            const record = new PointRecord(recordData);
            const validation = record.validate();
            
            if (!validation.isValid) {
                throw new Error('积分记录验证失败: ' + validation.errors.join(', '));
            }

            // 验证学生是否存在
            const student = await this.studentService.getStudentById(record.studentId);
            if (!student) {
                throw new Error(`学生不存在: ${record.studentId}`);
            }

            // 添加记录
            const data = await this.dataAccess.readFile(this.filename, { records: [] });
            data.records.push(record.toJSON());
            await this.dataAccess.writeFile(this.filename, data);

            // 更新学生余额
            const newBalance = student.balance + record.points;
            await this.studentService.updateStudentBalance(record.studentId, newBalance);

            console.log(`添加积分记录成功: ${record.studentId} ${record.points > 0 ? '+' : ''}${record.points} (${record.reason})`);
            return record;
        } catch (error) {
            console.error('添加积分记录失败:', error);
            throw error;
        }
    }

    /**
     * 计算学生当前积分余额
     * @param {string} studentId - 学号
     * @returns {Promise<number>}
     */
    async calculateStudentBalance(studentId) {
        try {
            const records = await this.getPointRecordsByStudent(studentId);
            const balance = records.reduce((sum, record) => sum + record.points, 0);
            return balance;
        } catch (error) {
            console.error(`计算学生积分余额失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 同步所有学生的积分余额
     * @returns {Promise<void>}
     */
    async syncAllStudentBalances() {
        try {
            const students = await this.studentService.getAllStudents();
            
            for (const student of students) {
                const calculatedBalance = await this.calculateStudentBalance(student.id);
                if (student.balance !== calculatedBalance) {
                    await this.studentService.updateStudentBalance(student.id, calculatedBalance);
                    console.log(`同步学生积分余额: ${student.name} (${student.id}) ${student.balance} -> ${calculatedBalance}`);
                }
            }
            
            console.log('所有学生积分余额同步完成');
        } catch (error) {
            console.error('同步学生积分余额失败:', error);
            throw error;
        }
    }

    /**
     * 获取积分排行榜（优化版本）
     * @param {string} type - 排行榜类型: 'total', 'daily', 'weekly'
     * @param {number} limit - 限制返回数量
     * @returns {Promise<object[]>}
     */
    async getPointsRanking(type = 'total', limit = 50) {
        try {
            // 使用缓存机制避免重复计算
            const cacheKey = `ranking_${type}_${limit}`;
            const cached = this._getRankingCache(cacheKey);
            if (cached && this._isCacheValid(cached.timestamp)) {
                return cached.data;
            }

            const students = await this.studentService.getAllStudents();
            let rankings = [];

            switch (type) {
                case 'total':
                    rankings = await this.getTotalRanking(students);
                    break;
                case 'daily':
                    rankings = await this.getDailyRanking(students);
                    break;
                case 'weekly':
                    rankings = await this.getWeeklyRanking(students);
                    break;
                default:
                    throw new Error('无效的排行榜类型: ' + type);
            }

            // 使用优化的排序算法
            rankings = this._optimizedSort(rankings, limit);
            
            // 添加排名
            rankings.forEach((item, index) => {
                item.rank = index + 1;
            });

            // 缓存结果
            this._setRankingCache(cacheKey, rankings);

            return rankings;
        } catch (error) {
            console.error(`获取积分排行榜失败 (${type}):`, error);
            throw error;
        }
    }

    /**
     * 获取总积分排行榜
     * @param {object[]} students - 学生列表
     * @returns {Promise<object[]>}
     */
    async getTotalRanking(students) {
        return students.map(student => ({
            id: student.id,
            studentId: student.id,
            name: student.name,
            studentName: student.name,
            class: student.class,
            points: student.balance,
            balance: student.balance,
            type: 'total'
        }));
    }

    /**
     * 获取日榜排行榜（当日积分变化）- 优化版本
     * @param {object[]} students - 学生列表
     * @returns {Promise<object[]>}
     */
    async getDailyRanking(students) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        // 一次性获取所有记录，避免多次文件读取
        const allRecords = await this.getAllPointRecords();
        
        // 预过滤当日记录
        const todayRecords = allRecords.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= startOfDay && recordDate < endOfDay;
        });

        // 使用Map进行高效分组统计
        const studentPointsMap = new Map();
        
        // 初始化所有学生
        students.forEach(student => {
            studentPointsMap.set(student.id, {
                id: student.id,
                studentId: student.id,
                name: student.name,
                studentName: student.name,
                class: student.class,
                points: 0,
                balance: 0,
                type: 'daily'
            });
        });

        // 累计当日积分
        todayRecords.forEach(record => {
            const studentData = studentPointsMap.get(record.studentId);
            if (studentData) {
                studentData.points += record.points;
            }
        });

        return Array.from(studentPointsMap.values());
    }

    /**
     * 获取周榜排行榜（本周积分变化）- 优化版本
     * @param {object[]} students - 学生列表
     * @returns {Promise<object[]>}
     */
    async getWeeklyRanking(students) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const startOfWeek = new Date(today.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

        // 一次性获取所有记录，避免多次文件读取
        const allRecords = await this.getAllPointRecords();
        
        // 预过滤本周记录
        const weekRecords = allRecords.filter(record => {
            const recordDate = new Date(record.timestamp);
            return recordDate >= startOfWeek && recordDate < endOfWeek;
        });

        // 使用Map进行高效分组统计
        const studentPointsMap = new Map();
        
        // 初始化所有学生
        students.forEach(student => {
            studentPointsMap.set(student.id, {
                id: student.id,
                studentId: student.id,
                name: student.name,
                studentName: student.name,
                class: student.class,
                points: 0,
                balance: 0,
                type: 'weekly'
            });
        });

        // 累计本周积分
        weekRecords.forEach(record => {
            const studentData = studentPointsMap.get(record.studentId);
            if (studentData) {
                studentData.points += record.points;
            }
        });

        return Array.from(studentPointsMap.values());
    }

    /**
     * 获取学生排名信息
     * @param {string} studentId - 学号
     * @returns {Promise<object>}
     */
    async getStudentRankInfo(studentId) {
        try {
            const [totalRanking, dailyRanking, weeklyRanking] = await Promise.all([
                this.getPointsRanking('total'),
                this.getPointsRanking('daily'),
                this.getPointsRanking('weekly')
            ]);

            const totalRank = totalRanking.findIndex(item => item.studentId === studentId) + 1;
            const dailyRank = dailyRanking.findIndex(item => item.studentId === studentId) + 1;
            const weeklyRank = weeklyRanking.findIndex(item => item.studentId === studentId) + 1;

            return {
                studentId,
                totalRank: totalRank || null,
                dailyRank: dailyRank || null,
                weeklyRank: weeklyRank || null,
                totalStudents: totalRanking.length
            };
        } catch (error) {
            console.error(`获取学生排名信息失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 获取积分统计信息
     * @returns {Promise<object>}
     */
    async getPointsStatistics() {
        try {
            const records = await this.getAllPointRecords();
            const students = await this.studentService.getAllStudents();

            const stats = {
                totalRecords: records.length,
                totalPointsAwarded: records.filter(r => r.points > 0).reduce((sum, r) => sum + r.points, 0),
                totalPointsDeducted: Math.abs(records.filter(r => r.points < 0).reduce((sum, r) => sum + r.points, 0)),
                averageBalance: 0,
                activeStudents: 0,
                recentActivity: []
            };

            if (students.length > 0) {
                stats.averageBalance = Math.round(students.reduce((sum, s) => sum + s.balance, 0) / students.length * 100) / 100;
                stats.activeStudents = students.filter(s => s.balance > 0).length;
            }

            // 获取最近的活动记录
            stats.recentActivity = records
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
                .map(record => ({
                    studentId: record.studentId,
                    points: record.points,
                    reason: record.reason,
                    timestamp: record.timestamp,
                    type: record.type
                }));

            return stats;
        } catch (error) {
            console.error('获取积分统计信息失败:', error);
            throw error;
        }
    }

    /**
     * 批量添加积分记录
     * @param {object[]} recordsData - 积分记录数据数组
     * @returns {Promise<{success: PointRecord[], failed: object[]}>}
     */
    async batchAddPointRecords(recordsData) {
        const results = {
            success: [],
            failed: []
        };

        for (const recordData of recordsData) {
            try {
                const record = await this.addPointRecord(recordData);
                results.success.push(record);
            } catch (error) {
                results.failed.push({
                    data: recordData,
                    error: error.message
                });
            }
        }

        console.log(`批量添加积分记录完成: 成功 ${results.success.length}, 失败 ${results.failed.length}`);
        return results;
    }

    /**
     * 获取时间范围内的积分记录
     * @param {Date} startDate - 开始时间
     * @param {Date} endDate - 结束时间
     * @param {string} studentId - 学号（可选）
     * @returns {Promise<PointRecord[]>}
     */
    async getPointRecordsByDateRange(startDate, endDate, studentId = null) {
        try {
            let records = await this.getAllPointRecords();

            // 按时间范围过滤
            records = records.filter(record => {
                const recordDate = new Date(record.timestamp);
                return recordDate >= startDate && recordDate <= endDate;
            });

            // 按学生过滤（如果指定）
            if (studentId) {
                records = records.filter(record => record.studentId === studentId);
            }

            return records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (error) {
            console.error('获取时间范围积分记录失败:', error);
            throw error;
        }
    }

    /**
     * 清零所有学生积分（慎用）
     * @param {string} operatorId - 操作者ID
     * @param {string} reason - 清零原因
     * @returns {Promise<void>}
     */
    async resetAllPoints(operatorId, reason = '积分清零') {
        try {
            const students = await this.studentService.getAllStudents();
            
            for (const student of students) {
                if (student.balance !== 0) {
                    // 添加清零记录
                    await this.addPointRecord({
                        studentId: student.id,
                        points: -student.balance,
                        reason: reason,
                        operatorId: operatorId,
                        type: 'subtract'
                    });
                }
            }
            
            console.log(`积分清零完成，影响 ${students.length} 名学生`);
        } catch (error) {
            console.error('积分清零失败:', error);
            throw error;
        }
    }

    // ==================== 性能优化方法 ====================

    /**
     * 优化的排序算法 - 使用部分排序提高性能
     * @param {Array} data - 要排序的数据
     * @param {number} limit - 只需要前N个结果
     * @returns {Array} 排序后的数据
     */
    _optimizedSort(data, limit) {
        if (!limit || limit >= data.length) {
            // 如果不需要限制或限制大于数据长度，使用标准排序
            return data.sort((a, b) => b.points - a.points);
        }
        
        // 使用部分排序算法，只排序前limit个元素
        const result = [...data];
        
        // 使用快速选择算法的变种
        for (let i = 0; i < Math.min(limit, result.length); i++) {
            let maxIndex = i;
            for (let j = i + 1; j < result.length; j++) {
                if (result[j].points > result[maxIndex].points) {
                    maxIndex = j;
                }
            }
            if (maxIndex !== i) {
                [result[i], result[maxIndex]] = [result[maxIndex], result[i]];
            }
        }
        
        return result.slice(0, limit);
    }

    /**
     * 获取排行榜缓存
     * @param {string} key - 缓存键
     * @returns {object|null} 缓存数据
     */
    _getRankingCache(key) {
        const cached = this.rankingCache.get(key);
        if (cached && this._isCacheValid(cached.timestamp)) {
            this.performanceMetrics.cacheHits++;
            return cached;
        }
        return null;
    }

    /**
     * 设置排行榜缓存
     * @param {string} key - 缓存键
     * @param {Array} data - 缓存数据
     */
    _setRankingCache(key, data) {
        this.rankingCache.set(key, {
            data: data,
            timestamp: Date.now()
        });
        
        // 限制缓存大小，防止内存泄漏
        if (this.rankingCache.size > 50) {
            const firstKey = this.rankingCache.keys().next().value;
            this.rankingCache.delete(firstKey);
        }
    }

    /**
     * 检查缓存是否有效
     * @param {number} timestamp - 缓存时间戳
     * @returns {boolean} 是否有效
     */
    _isCacheValid(timestamp) {
        return Date.now() - timestamp < this.cacheTimeout;
    }

    /**
     * 清除所有缓存
     */
    clearCache() {
        this.rankingCache.clear();
        console.log('积分服务缓存已清除');
    }

    /**
     * 获取性能指标
     * @returns {object} 性能指标
     */
    getPerformanceMetrics() {
        const cacheHitRate = this.performanceMetrics.queryCount > 0 
            ? (this.performanceMetrics.cacheHits / this.performanceMetrics.queryCount * 100).toFixed(2)
            : 0;
            
        return {
            ...this.performanceMetrics,
            cacheHitRate: `${cacheHitRate}%`,
            cacheSize: this.rankingCache.size
        };
    }

    /**
     * 批量获取多种排行榜（优化版本）
     * @param {Array} types - 排行榜类型数组
     * @param {number} limit - 限制返回数量
     * @returns {Promise<object>} 包含所有排行榜的对象
     */
    async getBatchRankings(types = ['total', 'daily', 'weekly'], limit = 50) {
        const startTime = Date.now();
        
        try {
            // 并行获取所有排行榜
            const promises = types.map(type => 
                this.getPointsRanking(type, limit).then(data => ({ [type]: data }))
            );
            
            const results = await Promise.all(promises);
            const rankings = Object.assign({}, ...results);
            
            // 更新性能指标
            this.performanceMetrics.queryCount++;
            const queryTime = Date.now() - startTime;
            this.performanceMetrics.averageQueryTime = 
                (this.performanceMetrics.averageQueryTime + queryTime) / 2;
            
            console.log(`批量获取排行榜完成，耗时: ${queryTime}ms`);
            return rankings;
            
        } catch (error) {
            console.error('批量获取排行榜失败:', error);
            throw error;
        }
    }

    /**
     * 预热缓存 - 在系统启动时调用
     */
    async warmupCache() {
        try {
            console.log('开始预热积分服务缓存...');
            
            // 预加载常用的排行榜数据
            await Promise.all([
                this.getPointsRanking('total', 50),
                this.getPointsRanking('daily', 20),
                this.getPointsRanking('weekly', 20)
            ]);
            
            console.log('积分服务缓存预热完成');
        } catch (error) {
            console.error('缓存预热失败:', error);
        }
    }
}

module.exports = PointsService;