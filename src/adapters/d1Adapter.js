/**
 * Cloudflare D1 数据库适配器
 */

/**
 * 创建 D1 适配器
 */
export function createD1Adapter(db) {
  return new D1Adapter(db);
}

/**
 * D1 数据库适配器类
 */
class D1Adapter {
  constructor(db) {
    this.db = db;
  }

  /**
   * 执行 SQL 查询
   */
  async querySQL(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        return await stmt.bind(...params).all();
      }
      return await stmt.all();
    } catch (error) {
      console.error('D1 查询错误:', error);
      throw error;
    }
  }

  /**
   * 执行 SQL 语句（INSERT, UPDATE, DELETE）
   */
  async runSQL(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        return await stmt.bind(...params).run();
      }
      return await stmt.run();
    } catch (error) {
      console.error('D1 执行错误:', error);
      throw error;
    }
  }

  /**
   * 获取单条记录
   */
  async getOne(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      if (params.length > 0) {
        return await stmt.bind(...params).first();
      }
      return await stmt.first();
    } catch (error) {
      console.error('D1 获取单条记录错误:', error);
      throw error;
    }
  }

  /**
   * 批量执行 SQL 语句
   */
  async batch(statements) {
    try {
      const preparedStatements = statements.map(({ sql, params = [] }) => {
        const stmt = this.db.prepare(sql);
        return params.length > 0 ? stmt.bind(...params) : stmt;
      });
      
      return await this.db.batch(preparedStatements);
    } catch (error) {
      console.error('D1 批量执行错误:', error);
      throw error;
    }
  }

  /**
   * 开始事务
   */
  async beginTransaction() {
    // D1 目前不支持显式事务，使用 batch 代替
    return {
      statements: [],
      
      add(sql, params = []) {
        this.statements.push({ sql, params });
      },
      
      async commit() {
        if (this.statements.length > 0) {
          return await this.batch(this.statements);
        }
        return [];
      },
      
      async rollback() {
        // D1 不支持显式回滚，清空语句列表
        this.statements = [];
      }
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.querySQL('SELECT 1');
      return { status: 'healthy', message: 'D1 数据库连接正常' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }

  // 用户管理方法
  async getUsers(role = null) {
    let sql = 'SELECT * FROM users WHERE is_active = 1';
    const params = [];
    
    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await this.querySQL(sql, params);
    return result.results || [];
  }

  async getUserById(id) {
    const result = await this.querySQL('SELECT * FROM users WHERE id = ?', [id]);
    return result.results?.[0] || null;
  }

  async getUserByUsername(username) {
    const result = await this.querySQL('SELECT * FROM users WHERE username = ?', [username]);
    return result.results?.[0] || null;
  }

  async getUserByStudentNumber(studentNumber) {
    const result = await this.querySQL('SELECT * FROM users WHERE student_number = ?', [studentNumber]);
    return result.results?.[0] || null;
  }

  async createUser(userData) {
    const { id, username, name, role, studentNumber, isActive = 1 } = userData;
    
    const result = await this.runSQL(
      'INSERT INTO users (id, username, name, role, student_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, username, name, role, studentNumber, isActive, new Date().toISOString()]
    );
    
    if (result.success) {
      return await this.getUserById(id);
    }
    throw new Error('创建用户失败');
  }

  async updateUser(id, updates) {
    const fields = [];
    const params = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'studentNumber') key = 'student_number';
      if (key === 'isActive') key = 'is_active';
      
      fields.push(`${key} = ?`);
      params.push(value);
    });
    
    if (fields.length === 0) return await this.getUserById(id);
    
    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    const result = await this.runSQL(
      `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    
    if (result.success) {
      return await this.getUserById(id);
    }
    throw new Error('更新用户失败');
  }

  async deleteUser(id) {
    const result = await this.runSQL('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    return result.success;
  }

  // 积分管理方法
  async getPointRecords(filters = {}) {
    let sql = `
      SELECT pr.*, u.name as student_name, t.name as teacher_name
      FROM point_records pr
      JOIN users u ON pr.student_id = u.id
      JOIN users t ON pr.teacher_id = t.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.studentId) {
      sql += ' AND pr.student_id = ?';
      params.push(filters.studentId);
    }
    
    if (filters.teacherId) {
      sql += ' AND pr.teacher_id = ?';
      params.push(filters.teacherId);
    }
    
    if (filters.type) {
      sql += ' AND pr.type = ?';
      params.push(filters.type);
    }
    
    if (filters.startDate) {
      sql += ' AND pr.created_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      sql += ' AND pr.created_at <= ?';
      params.push(filters.endDate);
    }
    
    sql += ' ORDER BY pr.created_at DESC';
    
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    const result = await this.querySQL(sql, params);
    return result.results || [];
  }

  async createPointRecord(recordData) {
    const { id, studentId, teacherId, amount, reason, type } = recordData;
    
    const result = await this.runSQL(
      'INSERT INTO point_records (id, student_id, teacher_id, amount, reason, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, studentId, teacherId, amount, reason, type, new Date().toISOString()]
    );
    
    if (result.success) {
      return await this.getPointRecords({ limit: 1 });
    }
    throw new Error('创建积分记录失败');
  }

  async getStudentPointBalance(studentId) {
    const result = await this.querySQL(
      'SELECT COALESCE(SUM(amount), 0) as balance FROM point_records WHERE student_id = ?',
      [studentId]
    );
    
    return result.results?.[0]?.balance || 0;
  }

  async getPointRankings(type = 'total', limit = 50) {
    let sql;
    const params = [limit];
    
    switch (type) {
      case 'daily':
        sql = `
          SELECT u.id, u.name, u.student_number, COALESCE(SUM(pr.amount), 0) as points
          FROM users u
          LEFT JOIN point_records pr ON u.id = pr.student_id AND DATE(pr.created_at) = DATE('now')
          WHERE u.role = 'student' AND u.is_active = 1
          GROUP BY u.id, u.name, u.student_number
          ORDER BY points DESC
          LIMIT ?
        `;
        break;
        
      case 'weekly':
        sql = `
          SELECT u.id, u.name, u.student_number, COALESCE(SUM(pr.amount), 0) as points
          FROM users u
          LEFT JOIN point_records pr ON u.id = pr.student_id AND pr.created_at >= DATE('now', '-7 days')
          WHERE u.role = 'student' AND u.is_active = 1
          GROUP BY u.id, u.name, u.student_number
          ORDER BY points DESC
          LIMIT ?
        `;
        break;
        
      default: // total
        sql = `
          SELECT u.id, u.name, u.student_number, COALESCE(SUM(pr.amount), 0) as points
          FROM users u
          LEFT JOIN point_records pr ON u.id = pr.student_id
          WHERE u.role = 'student' AND u.is_active = 1
          GROUP BY u.id, u.name, u.student_number
          ORDER BY points DESC
          LIMIT ?
        `;
    }
    
    const result = await this.querySQL(sql, params);
    return result.results || [];
  }

  // 商品管理方法
  async getProducts(activeOnly = true) {
    let sql = 'SELECT * FROM products';
    const params = [];
    
    if (activeOnly) {
      sql += ' WHERE is_active = 1';
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await this.querySQL(sql, params);
    return result.results || [];
  }

  async getProductById(id) {
    const result = await this.querySQL('SELECT * FROM products WHERE id = ?', [id]);
    return result.results?.[0] || null;
  }

  async createProduct(productData) {
    const { id, name, description, price, stock, isActive = 1 } = productData;
    
    const result = await this.runSQL(
      'INSERT INTO products (id, name, description, price, stock, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, description, price, stock, isActive, new Date().toISOString()]
    );
    
    if (result.success) {
      return await this.getProductById(id);
    }
    throw new Error('创建商品失败');
  }

  async updateProduct(id, updates) {
    const fields = [];
    const params = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'isActive') key = 'is_active';
      
      fields.push(`${key} = ?`);
      params.push(value);
    });
    
    if (fields.length === 0) return await this.getProductById(id);
    
    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    const result = await this.runSQL(
      `UPDATE products SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    
    if (result.success) {
      return await this.getProductById(id);
    }
    throw new Error('更新商品失败');
  }

  // 订单管理方法
  async getOrders(filters = {}) {
    let sql = `
      SELECT o.*, u.name as student_name, p.name as product_name
      FROM orders o
      JOIN users u ON o.student_id = u.id
      JOIN products p ON o.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.studentId) {
      sql += ' AND o.student_id = ?';
      params.push(filters.studentId);
    }
    
    if (filters.status) {
      sql += ' AND o.status = ?';
      params.push(filters.status);
    }
    
    sql += ' ORDER BY o.created_at DESC';
    
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    const result = await this.querySQL(sql, params);
    return result.results || [];
  }

  async createOrder(orderData) {
    const { id, studentId, productId, quantity, totalPrice } = orderData;
    
    const result = await this.runSQL(
      'INSERT INTO orders (id, student_id, product_id, quantity, total_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, studentId, productId, quantity, totalPrice, 'pending', new Date().toISOString()]
    );
    
    if (result.success) {
      return await this.getOrders({ limit: 1 });
    }
    throw new Error('创建订单失败');
  }

  async updateOrderStatus(id, status, adminId = null) {
    const updates = ['status = ?', 'updated_at = ?'];
    const params = [status, new Date().toISOString()];
    
    if (status === 'confirmed') {
      updates.push('confirmed_at = ?');
      params.push(new Date().toISOString());
    } else if (status === 'completed') {
      updates.push('completed_at = ?');
      params.push(new Date().toISOString());
    }
    
    params.push(id);
    
    const result = await this.runSQL(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    return result.success;
  }

  // 奖惩项管理方法
  async getRewardPenaltyItems(activeOnly = true) {
    let sql = 'SELECT * FROM reward_penalty_items';
    const params = [];
    
    if (activeOnly) {
      sql += ' WHERE is_active = 1';
    }
    
    sql += ' ORDER BY sort_order ASC, created_at DESC';
    
    const result = await this.querySQL(sql, params);
    return result.results || [];
  }

  async createRewardPenaltyItem(itemData) {
    const { id, name, points, type, description, isActive = 1, sortOrder = 0 } = itemData;
    
    const result = await this.runSQL(
      'INSERT INTO reward_penalty_items (id, name, points, type, description, is_active, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, points, type, description, isActive, sortOrder, new Date().toISOString()]
    );
    
    return result.success;
  }

  // 系统状态管理方法
  async getSystemState() {
    const result = await this.querySQL('SELECT * FROM system_state WHERE id = ?', ['default']);
    return result.results?.[0] || null;
  }

  async updateSystemState(updates) {
    const fields = [];
    const params = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      params.push(value);
    });
    
    if (fields.length === 0) return false;
    
    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push('default');
    
    const result = await this.runSQL(
      `UPDATE system_state SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
    
    return result.success;
  }
}