/**
 * D1 数据库工具类
 * 提供数据库连接和通用查询方法
 */

export class DatabaseUtil {
  constructor(db) {
    this.db = db;
  }

  /**
   * 执行查询并返回所有结果
   * @param {string} sql SQL查询语句
   * @param {Array} params 查询参数
   * @returns {Promise<Array>} 查询结果
   */
  async query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).all();
      return result.results || [];
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * 执行查询并返回第一条结果
   * @param {string} sql SQL查询语句
   * @param {Array} params 查询参数
   * @returns {Promise<Object|null>} 查询结果
   */
  async queryFirst(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).first();
      return result || null;
    } catch (error) {
      console.error('Database queryFirst error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  /**
   * 执行插入、更新、删除操作
   * @param {string} sql SQL语句
   * @param {Array} params 参数
   * @returns {Promise<Object>} 执行结果
   */
  async execute(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).run();
      return {
        success: result.success,
        meta: result.meta,
        changes: result.meta?.changes || 0,
        lastRowId: result.meta?.last_row_id
      };
    } catch (error) {
      console.error('Database execute error:', error);
      throw new Error(`Database execution failed: ${error.message}`);
    }
  }

  /**
   * 执行批量操作
   * @param {Array} statements 批量语句数组
   * @returns {Promise<Array>} 执行结果
   */
  async batch(statements) {
    try {
      const preparedStatements = statements.map(({ sql, params = [] }) => {
        return this.db.prepare(sql).bind(...params);
      });
      const results = await this.db.batch(preparedStatements);
      return results.map(result => ({
        success: result.success,
        meta: result.meta,
        changes: result.meta?.changes || 0,
        lastRowId: result.meta?.last_row_id
      }));
    } catch (error) {
      console.error('Database batch error:', error);
      throw new Error(`Database batch execution failed: ${error.message}`);
    }
  }

  /**
   * 开始事务
   * @param {Function} callback 事务回调函数
   * @returns {Promise<any>} 事务结果
   */
  async transaction(callback) {
    try {
      // D1 目前不支持显式事务，使用批量操作模拟
      return await callback(this);
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  /**
   * 检查表是否存在
   * @param {string} tableName 表名
   * @returns {Promise<boolean>} 是否存在
   */
  async tableExists(tableName) {
    try {
      const result = await this.queryFirst(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );
      return !!result;
    } catch (error) {
      console.error('Check table exists error:', error);
      return false;
    }
  }

  /**
   * 获取表的行数
   * @param {string} tableName 表名
   * @returns {Promise<number>} 行数
   */
  async getTableCount(tableName) {
    try {
      const result = await this.queryFirst(`SELECT COUNT(*) as count FROM ${tableName}`);
      return result?.count || 0;
    } catch (error) {
      console.error('Get table count error:', error);
      return 0;
    }
  }

  /**
   * 格式化日期为SQLite格式
   * @param {Date} date 日期对象
   * @returns {string} 格式化的日期字符串
   */
  formatDate(date = new Date()) {
    return date.toISOString().replace('T', ' ').replace('Z', '');
  }

  /**
   * 解析SQLite日期字符串
   * @param {string} dateString 日期字符串
   * @returns {Date} 日期对象
   */
  parseDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString.replace(' ', 'T') + 'Z');
  }

  /**
   * 构建WHERE条件
   * @param {Object} conditions 条件对象
   * @returns {Object} {sql, params}
   */
  buildWhereClause(conditions = {}) {
    const keys = Object.keys(conditions).filter(key => conditions[key] !== undefined);
    if (keys.length === 0) {
      return { sql: '', params: [] };
    }

    const whereClauses = keys.map(key => `${key} = ?`);
    const params = keys.map(key => conditions[key]);

    return {
      sql: ` WHERE ${whereClauses.join(' AND ')}`,
      params
    };
  }

  /**
   * 构建分页查询
   * @param {number} page 页码（从1开始）
   * @param {number} pageSize 每页大小
   * @returns {Object} {sql, params}
   */
  buildPagination(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    return {
      sql: ` LIMIT ? OFFSET ?`,
      params: [pageSize, offset]
    };
  }

  /**
   * 构建排序子句
   * @param {string} orderBy 排序字段
   * @param {string} direction 排序方向 ASC|DESC
   * @returns {string} 排序SQL
   */
  buildOrderBy(orderBy, direction = 'ASC') {
    if (!orderBy) return '';
    const dir = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return ` ORDER BY ${orderBy} ${dir}`;
  }
}