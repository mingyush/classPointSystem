/**
 * 订单服务 - D1数据库版本
 * 实现订单管理功能
 */

import { DatabaseUtil } from '../utils/database.js';

export class OrderService {
  constructor(db) {
    this.dbUtil = new DatabaseUtil(db);
  }

  /**
   * 获取所有订单
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 订单列表
   */
  async getAllOrders(options = {}) {
    try {
      const { studentId, status, startDate, endDate, page, pageSize, orderBy = 'created_at DESC' } = options;
      
      let sql = `
        SELECT o.*, s.name as student_name, s.student_id as student_number,
               p.name as product_name, p.price as product_price
        FROM orders o
        LEFT JOIN students s ON o.student_id = s.id
        LEFT JOIN products p ON o.product_id = p.id
      `;
      let params = [];
      
      // 构建WHERE条件
      const conditions = {};
      if (studentId) conditions['o.student_id'] = studentId;
      if (status) conditions['o.status'] = status;
      
      const whereClause = this.dbUtil.buildWhereClause(conditions);
      sql += whereClause.sql;
      params.push(...whereClause.params);
      
      // 添加日期范围条件
      if (startDate) {
        sql += params.length > 0 ? ' AND ' : ' WHERE ';
        sql += 'o.created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        sql += params.length > 0 ? ' AND ' : ' WHERE ';
        sql += 'o.created_at <= ?';
        params.push(endDate);
      }
      
      // 添加排序
      sql += this.dbUtil.buildOrderBy(orderBy, 'o.');
      
      // 添加分页
      if (page && pageSize) {
        const pagination = this.dbUtil.buildPagination(page, pageSize);
        sql += pagination.sql;
        params.push(...pagination.params);
      }
      
      const orders = await this.dbUtil.query(sql, params);
      return orders.map(this.formatOrder);
    } catch (error) {
      console.error('Get all orders error:', error);
      throw new Error(`Failed to get orders: ${error.message}`);
    }
  }

  /**
   * 根据ID获取订单
   * @param {number} orderId 订单ID
   * @returns {Promise<Object|null>} 订单信息
   */
  async getOrderById(orderId) {
    try {
      const sql = `
        SELECT o.*, s.name as student_name, s.student_id as student_number,
               p.name as product_name, p.price as product_price
        FROM orders o
        LEFT JOIN students s ON o.student_id = s.id
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.id = ?
      `;
      
      const order = await this.dbUtil.queryFirst(sql, [orderId]);
      return order ? this.formatOrder(order) : null;
    } catch (error) {
      console.error('Get order by ID error:', error);
      throw new Error(`Failed to get order: ${error.message}`);
    }
  }

  /**
   * 创建新订单
   * @param {Object} orderData 订单数据
   * @returns {Promise<Object>} 创建的订单信息
   */
  async createOrder(orderData) {
    try {
      const { studentId, productId, quantity = 1, notes } = orderData;
      
      // 验证必填字段
      if (!studentId || !productId) {
        throw new Error('Student ID and Product ID are required');
      }
      
      // 验证数量
      if (typeof quantity !== 'number' || quantity <= 0) {
        throw new Error('Quantity must be a positive number');
      }
      
      // 检查学生是否存在
      const studentSql = 'SELECT * FROM students WHERE id = ?';
      const student = await this.dbUtil.queryFirst(studentSql, [studentId]);
      if (!student) {
        throw new Error(`Student with ID ${studentId} not found`);
      }
      
      // 检查商品是否存在且有库存
      const productSql = 'SELECT * FROM products WHERE id = ? AND status = ?';
      const product = await this.dbUtil.queryFirst(productSql, [productId, 'active']);
      if (!product) {
        throw new Error(`Product with ID ${productId} not found or inactive`);
      }
      
      if (product.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}, Required: ${quantity}`);
      }
      
      // 计算总价
      const totalPrice = product.price * quantity;
      
      // 检查学生积分余额
      if (student.points < totalPrice) {
        throw new Error(`Insufficient points. Available: ${student.points}, Required: ${totalPrice}`);
      }
      
      // 开始事务操作
      const operations = [
        // 创建订单
        {
          sql: `
            INSERT INTO orders (student_id, product_id, quantity, unit_price, total_price, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          params: [studentId, productId, quantity, product.price, totalPrice, notes || null]
        },
        // 扣减学生积分
        {
          sql: 'UPDATE students SET points = points - ?, updated_at = ? WHERE id = ?',
          params: [totalPrice, this.dbUtil.formatDate(), studentId]
        },
        // 扣减商品库存
        {
          sql: 'UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?',
          params: [quantity, this.dbUtil.formatDate(), productId]
        }
      ];
      
      const results = await this.dbUtil.transaction(operations);
      
      if (!results.success) {
        throw new Error('Failed to create order: Transaction failed');
      }
      
      // 获取创建的订单ID（第一个操作的结果）
      const orderId = results.results[0].lastRowId;
      
      return await this.getOrderById(orderId);
    } catch (error) {
      console.error('Create order error:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * 更新订单状态
   * @param {number} orderId 订单ID
   * @param {string} status 新状态
   * @param {string} notes 备注
   * @returns {Promise<Object>} 更新后的订单信息
   */
  async updateOrderStatus(orderId, status, notes) {
    try {
      const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Valid statuses: ${validStatuses.join(', ')}`);
      }
      
      const existing = await this.getOrderById(orderId);
      if (!existing) {
        throw new Error(`Order with ID ${orderId} not found`);
      }
      
      // 如果是取消订单，需要退还积分和库存
      if (status === 'cancelled' && existing.status !== 'cancelled') {
        const operations = [
          // 更新订单状态
          {
            sql: 'UPDATE orders SET status = ?, notes = ?, updated_at = ? WHERE id = ?',
            params: [status, notes || existing.notes, this.dbUtil.formatDate(), orderId]
          },
          // 退还学生积分
          {
            sql: 'UPDATE students SET points = points + ?, updated_at = ? WHERE id = ?',
            params: [existing.totalPrice, this.dbUtil.formatDate(), existing.studentId]
          },
          // 退还商品库存
          {
            sql: 'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?',
            params: [existing.quantity, this.dbUtil.formatDate(), existing.productId]
          }
        ];
        
        const results = await this.dbUtil.transaction(operations);
        
        if (!results.success) {
          throw new Error('Failed to cancel order: Transaction failed');
        }
      } else {
        // 普通状态更新
        const sql = 'UPDATE orders SET status = ?, notes = ?, updated_at = ? WHERE id = ?';
        const result = await this.dbUtil.execute(sql, [
          status,
          notes || existing.notes,
          this.dbUtil.formatDate(),
          orderId
        ]);
        
        if (!result.success) {
          throw new Error('Failed to update order status');
        }
      }
      
      return await this.getOrderById(orderId);
    } catch (error) {
      console.error('Update order status error:', error);
      throw new Error(`Failed to update order status: ${error.message}`);
    }
  }

  /**
   * 根据学生ID获取订单
   * @param {number} studentId 学生ID
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 订单列表
   */
  async getOrdersByStudentId(studentId, options = {}) {
    try {
      return await this.getAllOrders({ ...options, studentId });
    } catch (error) {
      console.error('Get orders by student ID error:', error);
      throw new Error(`Failed to get orders by student ID: ${error.message}`);
    }
  }

  /**
   * 根据商品ID获取订单
   * @param {number} productId 商品ID
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 订单列表
   */
  async getOrdersByProductId(productId, options = {}) {
    try {
      const { status, startDate, endDate, page, pageSize } = options;
      
      let sql = `
        SELECT o.*, s.name as student_name, s.student_id as student_number,
               p.name as product_name, p.price as product_price
        FROM orders o
        LEFT JOIN students s ON o.student_id = s.id
        LEFT JOIN products p ON o.product_id = p.id
        WHERE o.product_id = ?
      `;
      let params = [productId];
      
      if (status) {
        sql += ' AND o.status = ?';
        params.push(status);
      }
      
      if (startDate) {
        sql += ' AND o.created_at >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        sql += ' AND o.created_at <= ?';
        params.push(endDate);
      }
      
      sql += ' ORDER BY o.created_at DESC';
      
      if (page && pageSize) {
        const pagination = this.dbUtil.buildPagination(page, pageSize);
        sql += pagination.sql;
        params.push(...pagination.params);
      }
      
      const orders = await this.dbUtil.query(sql, params);
      return orders.map(this.formatOrder);
    } catch (error) {
      console.error('Get orders by product ID error:', error);
      throw new Error(`Failed to get orders by product ID: ${error.message}`);
    }
  }

  /**
   * 获取订单统计信息
   * @param {Object} options 统计选项
   * @returns {Promise<Object>} 统计信息
   */
  async getOrderStats(options = {}) {
    try {
      const { startDate, endDate, studentId, productId } = options;
      
      let whereConditions = [];
      let params = [];
      
      if (startDate) {
        whereConditions.push('created_at >= ?');
        params.push(startDate);
      }
      
      if (endDate) {
        whereConditions.push('created_at <= ?');
        params.push(endDate);
      }
      
      if (studentId) {
        whereConditions.push('student_id = ?');
        params.push(studentId);
      }
      
      if (productId) {
        whereConditions.push('product_id = ?');
        params.push(productId);
      }
      
      const whereClause = whereConditions.length > 0 ? ` WHERE ${whereConditions.join(' AND ')}` : '';
      
      const totalSql = `SELECT COUNT(*) as total, SUM(total_price) as total_amount FROM orders${whereClause}`;
      const statusSql = `
        SELECT status, COUNT(*) as count, SUM(total_price) as amount 
        FROM orders${whereClause} 
        GROUP BY status
      `;
      
      const [totalResult, statusResults] = await Promise.all([
        this.dbUtil.queryFirst(totalSql, params),
        this.dbUtil.query(statusSql, params)
      ]);
      
      return {
        total: totalResult?.total || 0,
        totalAmount: totalResult?.total_amount || 0,
        byStatus: statusResults.reduce((acc, row) => {
          acc[row.status] = {
            count: row.count,
            amount: row.amount
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Get order stats error:', error);
      throw new Error(`Failed to get order stats: ${error.message}`);
    }
  }

  /**
   * 获取热门商品统计
   * @param {Object} options 统计选项
   * @returns {Promise<Array>} 热门商品列表
   */
  async getPopularProducts(options = {}) {
    try {
      const { limit = 10, startDate, endDate } = options;
      
      let sql = `
        SELECT p.id, p.name, p.price, 
               COUNT(o.id) as order_count,
               SUM(o.quantity) as total_quantity,
               SUM(o.total_price) as total_revenue
        FROM products p
        LEFT JOIN orders o ON p.id = o.product_id
      `;
      let params = [];
      
      let whereConditions = [];
      
      if (startDate) {
        whereConditions.push('o.created_at >= ?');
        params.push(startDate);
      }
      
      if (endDate) {
        whereConditions.push('o.created_at <= ?');
        params.push(endDate);
      }
      
      if (whereConditions.length > 0) {
        sql += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      sql += `
        GROUP BY p.id, p.name, p.price
        ORDER BY order_count DESC, total_quantity DESC
        LIMIT ?
      `;
      params.push(limit);
      
      const products = await this.dbUtil.query(sql, params);
      return products.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        orderCount: product.order_count,
        totalQuantity: product.total_quantity,
        totalRevenue: product.total_revenue
      }));
    } catch (error) {
      console.error('Get popular products error:', error);
      throw new Error(`Failed to get popular products: ${error.message}`);
    }
  }

  /**
   * 格式化订单数据
   * @param {Object} order 原始订单数据
   * @returns {Object} 格式化后的订单数据
   */
  formatOrder(order) {
    if (!order) return null;
    
    return {
      id: order.id,
      studentId: order.student_id,
      studentName: order.student_name,
      studentNumber: order.student_number,
      productId: order.product_id,
      productName: order.product_name,
      productPrice: order.product_price,
      quantity: order.quantity,
      unitPrice: order.unit_price,
      totalPrice: order.total_price,
      status: order.status,
      notes: order.notes,
      createdAt: this.dbUtil.parseDate(order.created_at),
      updatedAt: this.dbUtil.parseDate(order.updated_at)
    };
  }
}