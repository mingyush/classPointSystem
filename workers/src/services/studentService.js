/**
 * 学生服务 - D1数据库版本
 * 替换原有的JSON文件操作，保持接口兼容性
 */

import { DatabaseUtil } from '../utils/database.js';

export class StudentService {
  constructor(db) {
    this.dbUtil = new DatabaseUtil(db);
  }

  /**
   * 获取所有学生信息
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 学生列表
   */
  async getAllStudents(options = {}) {
    try {
      const { className, status = 'active', page, pageSize, orderBy = 'name' } = options;
      
      let sql = 'SELECT * FROM students';
      let params = [];
      
      // 构建WHERE条件
      const conditions = {};
      if (className) conditions.class_name = className;
      if (status) conditions.status = status;
      
      const whereClause = this.dbUtil.buildWhereClause(conditions);
      sql += whereClause.sql;
      params.push(...whereClause.params);
      
      // 添加排序
      sql += this.dbUtil.buildOrderBy(orderBy);
      
      // 添加分页
      if (page && pageSize) {
        const pagination = this.dbUtil.buildPagination(page, pageSize);
        sql += pagination.sql;
        params.push(...pagination.params);
      }
      
      const students = await this.dbUtil.query(sql, params);
      return students.map(this.formatStudent);
    } catch (error) {
      console.error('Get all students error:', error);
      throw new Error(`Failed to get students: ${error.message}`);
    }
  }

  /**
   * 根据学号获取学生信息
   * @param {string} studentId 学号
   * @returns {Promise<Object|null>} 学生信息
   */
  async getStudentById(studentId) {
    try {
      const sql = 'SELECT * FROM students WHERE student_id = ?';
      const student = await this.dbUtil.queryFirst(sql, [studentId]);
      return student ? this.formatStudent(student) : null;
    } catch (error) {
      console.error('Get student by ID error:', error);
      throw new Error(`Failed to get student: ${error.message}`);
    }
  }

  /**
   * 创建新学生
   * @param {Object} studentData 学生数据
   * @returns {Promise<Object>} 创建的学生信息
   */
  async createStudent(studentData) {
    try {
      const { studentId, name, className, avatarUrl } = studentData;
      
      // 验证必填字段
      if (!studentId || !name || !className) {
        throw new Error('Student ID, name, and class name are required');
      }
      
      // 检查学号是否已存在
      const existing = await this.getStudentById(studentId);
      if (existing) {
        throw new Error(`Student with ID ${studentId} already exists`);
      }
      
      const sql = `
        INSERT INTO students (student_id, name, class_name, avatar_url, points_balance)
        VALUES (?, ?, ?, ?, 0)
      `;
      
      const result = await this.dbUtil.execute(sql, [
        studentId,
        name,
        className,
        avatarUrl || null
      ]);
      
      if (!result.success) {
        throw new Error('Failed to create student');
      }
      
      return await this.getStudentById(studentId);
    } catch (error) {
      console.error('Create student error:', error);
      throw new Error(`Failed to create student: ${error.message}`);
    }
  }

  /**
   * 更新学生信息
   * @param {string} studentId 学号
   * @param {Object} updateData 更新数据
   * @returns {Promise<Object>} 更新后的学生信息
   */
  async updateStudent(studentId, updateData) {
    try {
      const existing = await this.getStudentById(studentId);
      if (!existing) {
        throw new Error(`Student with ID ${studentId} not found`);
      }
      
      const allowedFields = ['name', 'class_name', 'avatar_url', 'status'];
      const updates = {};
      
      // 过滤允许更新的字段
      Object.keys(updateData).forEach(key => {
        const dbKey = key === 'className' ? 'class_name' : 
                     key === 'avatarUrl' ? 'avatar_url' : key;
        if (allowedFields.includes(dbKey)) {
          updates[dbKey] = updateData[key];
        }
      });
      
      if (Object.keys(updates).length === 0) {
        return existing;
      }
      
      // 添加更新时间
      updates.updated_at = this.dbUtil.formatDate();
      
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const sql = `UPDATE students SET ${setClause} WHERE student_id = ?`;
      const params = [...Object.values(updates), studentId];
      
      const result = await this.dbUtil.execute(sql, params);
      
      if (!result.success) {
        throw new Error('Failed to update student');
      }
      
      return await this.getStudentById(studentId);
    } catch (error) {
      console.error('Update student error:', error);
      throw new Error(`Failed to update student: ${error.message}`);
    }
  }

  /**
   * 删除学生
   * @param {string} studentId 学号
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteStudent(studentId) {
    try {
      const existing = await this.getStudentById(studentId);
      if (!existing) {
        throw new Error(`Student with ID ${studentId} not found`);
      }
      
      // 软删除：更新状态为inactive
      const sql = 'UPDATE students SET status = ?, updated_at = ? WHERE student_id = ?';
      const result = await this.dbUtil.execute(sql, [
        'inactive',
        this.dbUtil.formatDate(),
        studentId
      ]);
      
      return result.success && result.changes > 0;
    } catch (error) {
      console.error('Delete student error:', error);
      throw new Error(`Failed to delete student: ${error.message}`);
    }
  }

  /**
   * 更新学生积分余额
   * @param {string} studentId 学号
   * @param {number} newBalance 新余额
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateStudentBalance(studentId, newBalance) {
    try {
      const sql = `
        UPDATE students 
        SET points_balance = ?, updated_at = ? 
        WHERE student_id = ?
      `;
      
      const result = await this.dbUtil.execute(sql, [
        newBalance,
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
   * 根据班级获取学生列表
   * @param {string} className 班级名称
   * @returns {Promise<Array>} 学生列表
   */
  async getStudentsByClass(className) {
    try {
      return await this.getAllStudents({ className });
    } catch (error) {
      console.error('Get students by class error:', error);
      throw new Error(`Failed to get students by class: ${error.message}`);
    }
  }

  /**
   * 搜索学生
   * @param {string} keyword 搜索关键词
   * @param {Object} options 搜索选项
   * @returns {Promise<Array>} 搜索结果
   */
  async searchStudents(keyword, options = {}) {
    try {
      const { className, status = 'active' } = options;
      
      let sql = `
        SELECT * FROM students 
        WHERE (name LIKE ? OR student_id LIKE ?)
      `;
      let params = [`%${keyword}%`, `%${keyword}%`];
      
      if (className) {
        sql += ' AND class_name = ?';
        params.push(className);
      }
      
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      
      sql += ' ORDER BY name';
      
      const students = await this.dbUtil.query(sql, params);
      return students.map(this.formatStudent);
    } catch (error) {
      console.error('Search students error:', error);
      throw new Error(`Failed to search students: ${error.message}`);
    }
  }

  /**
   * 获取学生统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStudentStats() {
    try {
      const totalSql = 'SELECT COUNT(*) as total FROM students WHERE status = ?';
      const classSql = `
        SELECT class_name, COUNT(*) as count 
        FROM students 
        WHERE status = ? 
        GROUP BY class_name
      `;
      
      const [totalResult, classResults] = await Promise.all([
        this.dbUtil.queryFirst(totalSql, ['active']),
        this.dbUtil.query(classSql, ['active'])
      ]);
      
      return {
        total: totalResult?.total || 0,
        byClass: classResults.reduce((acc, row) => {
          acc[row.class_name] = row.count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Get student stats error:', error);
      throw new Error(`Failed to get student stats: ${error.message}`);
    }
  }

  /**
   * 格式化学生数据
   * @param {Object} student 原始学生数据
   * @returns {Object} 格式化后的学生数据
   */
  formatStudent(student) {
    if (!student) return null;
    
    return {
      id: student.id,
      studentId: student.student_id,
      name: student.name,
      className: student.class_name,
      pointsBalance: student.points_balance || 0,
      avatarUrl: student.avatar_url,
      status: student.status,
      createdAt: this.dbUtil.parseDate(student.created_at),
      updatedAt: this.dbUtil.parseDate(student.updated_at)
    };
  }
}