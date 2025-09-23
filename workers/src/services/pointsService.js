/**
 * 积分服务 - D1数据库版本
 * 替换原有的JSON文件操作，保持接口兼容性
 */

import { DatabaseUtil } from '../utils/database.js';

export class PointsService {
  constructor(db, cache = null) {
    this.dbUtil = new DatabaseUtil(db);
    this.cache = cache;
    this.CACHE_TTL = 300; // 5分钟缓存
  }

  /**
   * 获取所有积分记录
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 积分记录列表
   */
  async getAllPointRecords(options = {}) {
    try {
      const { studentId, type, startDate, endDate, page, pageSize, orderBy = 'created_at DESC' } = options;
      
      let sql = `
        SELECT pr.*, s.name as student_name, s.class_name
        FROM point_records pr
        LEFT JOIN students s ON pr.student_id = s.student_id
      `;
      let params = [];
      
      // 构建WHERE条件
      const conditions = [];
      if (studentId) {
        conditions.push('pr.student_id = ?');
        params.push(studentId);
      }
      if (type) {
        conditions.push('pr.type = ?');
        params.push(type);
      }
      if (startDate) {
        conditions.push('pr.created_at >= ?');
        params.push(startDate);
      }
      if (endDate) {
        conditions.push('pr.created_at <= ?');
        params.push(endDate);
      }
      
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      
      // 添加排序
      sql += ` ORDER BY ${orderBy}`;
      
      // 添加分页
      if (page && pageSize) {
        const pagination = this.dbUtil.buildPagination(page, pageSize);
        sql += pagination.sql;
        params.push(...pagination.params);
      }
      
      const records = await this.dbUtil.query(sql, params);
      return records.map(this.formatPointRecord);
    } catch (error) {
      console.error('Get all point records error:', error);
      throw new Error(`Failed to get point records: ${error.message}`);
    }
  }

  /**
   * 根据学生ID获取积分记录
   * @param {string} studentId 学号
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 积分记录列表
   */
  async getPointRecordsByStudentId(studentId, options = {}) {
    try {
      return await this.getAllPointRecords({ ...options, studentId });
    } catch (error) {
      console.error('Get point records by student ID error:', error);
      throw new Error(`Failed to get point records for student: ${error.message}`);
    }
  }

  /**
   * 添加积分记录
   * @param {Object} recordData 积分记录数据
   * @returns {Promise<Object>} 创建的积分记录
   */
  async addPointRecord(recordData) {
    try {
      const { studentId, points, reason, type = 'earn', teacherId, orderId } = recordData;
      
      // 验证必填字段
      if (!studentId || points === undefined || !reason || !type) {
        throw new Error('Student ID, points, reason, and type are required');
      }
      
      // 验证积分值
      if (typeof points !== 'number' || points === 0) {
        throw new Error('Points must be a non-zero number');
      }
      
      // 验证类型
      const validTypes = ['earn', 'spend', 'adjust'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
      
      const sql = `
        INSERT INTO point_records (student_id, points, reason, type, teacher_id, order_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await this.dbUtil.execute(sql, [
        studentId,
        points,
        reason,
        type,
        teacherId || null,
        orderId || null
      ]);
      
      if (!result.success) {
        throw new Error('Failed to add point record');
      }
      
      // 更新学生积分余额
      await this.updateStudentBalance(studentId);
      
      // 清除相关缓存
      await this.clearRankingCache();
      
      // 获取创建的记录
      const createdRecord = await this.dbUtil.queryFirst(
        'SELECT * FROM point_records WHERE id = ?',
        [result.lastRowId]
      );
      
      return this.formatPointRecord(createdRecord);
    } catch (error) {
      console.error('Add point record error:', error);
      throw new Error(`Failed to add point record: ${error.message}`);
    }
  }

  /**
   * 计算学生积分余额
   * @param {string} studentId 学号
   * @returns {Promise<number>} 积分余额
   */
  async calculateStudentBalance(studentId) {
    try {
      const sql = 'SELECT SUM(points) as total FROM point_records WHERE student_id = ?';
      const result = await this.dbUtil.queryFirst(sql, [studentId]);
      return result?.total || 0;
    } catch (error) {
      console.error('Calculate student balance error:', error);
      throw new Error(`Failed to calculate balance: ${error.message}`);
    }
  }

  /**
   * 更新学生积分余额
   * @param {string} studentId 学号
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateStudentBalance(studentId) {
    try {
      const balance = await this.calculateStudentBalance(studentId);
      
      const sql = `
        UPDATE students 
        SET points_balance = ?, updated_at = ? 
        WHERE student_id = ?
      `;
      
      const result = await this.dbUtil.execute(sql, [
        balance,
        this.dbUtil.formatDate(),
        studentId
      ]);
      
      return result.success && result.changes > 0;
    } catch (error) {
      console.error('Update student balance error:', error);
      throw new Error(`Failed to update student balance: ${error.message}`);
    }
  }

  /**
   * 同步所有学生积分余额
   * @returns {Promise<number>} 更新的学生数量
   */
  async syncAllStudentBalances() {
    try {
      const students = await this.dbUtil.query(
        'SELECT student_id FROM students WHERE status = ?',
        ['active']
      );
      
      let updatedCount = 0;
      for (const student of students) {
        const success = await this.updateStudentBalance(student.student_id);
        if (success) updatedCount++;
      }
      
      return updatedCount;
    } catch (error) {
      console.error('Sync all student balances error:', error);
      throw new Error(`Failed to sync student balances: ${error.message}`);
    }
  }

  /**
   * 获取积分排行榜
   * @param {string} type 排行榜类型: 'total', 'daily', 'weekly'
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 排行榜数据
   */
  async getPointsRanking(type = 'total', options = {}) {
    try {
      const { className, limit = 50 } = options;
      
      // 尝试从缓存获取
      const cacheKey = `ranking:${type}:${className || 'all'}:${limit}`;
      if (this.cache) {
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
      
      let sql, params = [];
      
      switch (type) {
        case 'total':
          sql = `
            SELECT s.student_id, s.name, s.class_name, s.points_balance as total_points,
                   ROW_NUMBER() OVER (ORDER BY s.points_balance DESC, s.name) as rank
            FROM students s
            WHERE s.status = 'active'
          `;
          if (className) {
            sql += ' AND s.class_name = ?';
            params.push(className);
          }
          sql += ' ORDER BY s.points_balance DESC, s.name LIMIT ?';
          params.push(limit);
          break;
          
        case 'daily':
          const today = new Date().toISOString().split('T')[0];
          sql = `
            SELECT pr.student_id, s.name, s.class_name, 
                   SUM(pr.points) as daily_points,
                   ROW_NUMBER() OVER (ORDER BY SUM(pr.points) DESC, s.name) as rank
            FROM point_records pr
            JOIN students s ON pr.student_id = s.student_id
            WHERE s.status = 'active' 
              AND DATE(pr.created_at) = ?
          `;
          params.push(today);
          if (className) {
            sql += ' AND s.class_name = ?';
            params.push(className);
          }
          sql += ' GROUP BY pr.student_id, s.name, s.class_name ORDER BY daily_points DESC, s.name LIMIT ?';
          params.push(limit);
          break;
          
        case 'weekly':
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const weekStartStr = weekStart.toISOString().split('T')[0];
          
          sql = `
            SELECT pr.student_id, s.name, s.class_name, 
                   SUM(pr.points) as weekly_points,
                   ROW_NUMBER() OVER (ORDER BY SUM(pr.points) DESC, s.name) as rank
            FROM point_records pr
            JOIN students s ON pr.student_id = s.student_id
            WHERE s.status = 'active' 
              AND DATE(pr.created_at) >= ?
          `;
          params.push(weekStartStr);
          if (className) {
            sql += ' AND s.class_name = ?';
            params.push(className);
          }
          sql += ' GROUP BY pr.student_id, s.name, s.class_name ORDER BY weekly_points DESC, s.name LIMIT ?';
          params.push(limit);
          break;
          
        default:
          throw new Error(`Invalid ranking type: ${type}`);
      }
      
      const rankings = await this.dbUtil.query(sql, params);
      const formattedRankings = rankings.map(this.formatRanking);
      
      // 缓存结果
      if (this.cache) {
        await this.cache.put(cacheKey, JSON.stringify(formattedRankings), {
          expirationTtl: this.CACHE_TTL
        });
      }
      
      return formattedRankings;
    } catch (error) {
      console.error('Get points ranking error:', error);
      throw new Error(`Failed to get points ranking: ${error.message}`);
    }
  }

  /**
   * 获取积分统计信息
   * @param {Object} options 查询选项
   * @returns {Promise<Object>} 统计信息
   */
  async getPointsStats(options = {}) {
    try {
      const { studentId, startDate, endDate } = options;
      
      let whereClause = '';
      let params = [];
      
      if (studentId || startDate || endDate) {
        const conditions = [];
        if (studentId) {
          conditions.push('student_id = ?');
          params.push(studentId);
        }
        if (startDate) {
          conditions.push('created_at >= ?');
          params.push(startDate);
        }
        if (endDate) {
          conditions.push('created_at <= ?');
          params.push(endDate);
        }
        whereClause = ' WHERE ' + conditions.join(' AND ');
      }
      
      const sql = `
        SELECT 
          COUNT(*) as total_records,
          SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_earned,
          SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END) as total_spent,
          SUM(points) as net_points,
          AVG(points) as avg_points
        FROM point_records
        ${whereClause}
      `;
      
      const stats = await this.dbUtil.queryFirst(sql, params);
      
      return {
        totalRecords: stats?.total_records || 0,
        totalEarned: stats?.total_earned || 0,
        totalSpent: stats?.total_spent || 0,
        netPoints: stats?.net_points || 0,
        avgPoints: stats?.avg_points || 0
      };
    } catch (error) {
      console.error('Get points stats error:', error);
      throw new Error(`Failed to get points stats: ${error.message}`);
    }
  }

  /**
   * 清除排行榜缓存
   * @returns {Promise<void>}
   */
  async clearRankingCache() {
    if (!this.cache) return;
    
    try {
      // 清除所有排行榜相关的缓存
      const cacheKeys = [
        'ranking:total:all',
        'ranking:daily:all',
        'ranking:weekly:all'
      ];
      
      for (const key of cacheKeys) {
        await this.cache.delete(key);
      }
    } catch (error) {
      console.error('Clear ranking cache error:', error);
    }
  }

  /**
   * 格式化积分记录数据
   * @param {Object} record 原始积分记录数据
   * @returns {Object} 格式化后的积分记录数据
   */
  formatPointRecord(record) {
    if (!record) return null;
    
    return {
      id: record.id,
      studentId: record.student_id,
      studentName: record.student_name,
      className: record.class_name,
      points: record.points,
      reason: record.reason,
      type: record.type,
      teacherId: record.teacher_id,
      orderId: record.order_id,
      createdAt: this.dbUtil.parseDate(record.created_at)
    };
  }

  /**
   * 格式化排行榜数据
   * @param {Object} ranking 原始排行榜数据
   * @returns {Object} 格式化后的排行榜数据
   */
  formatRanking(ranking) {
    if (!ranking) return null;
    
    return {
      rank: ranking.rank,
      studentId: ranking.student_id,
      name: ranking.name,
      className: ranking.class_name,
      points: ranking.total_points || ranking.daily_points || ranking.weekly_points || 0
    };
  }
}