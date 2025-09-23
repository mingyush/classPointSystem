/**
 * 商品服务 - D1数据库版本
 * 实现商品管理功能
 */

import { DatabaseUtil } from '../utils/database.js';

export class ProductService {
  constructor(db) {
    this.dbUtil = new DatabaseUtil(db);
  }

  /**
   * 获取所有商品
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 商品列表
   */
  async getAllProducts(options = {}) {
    try {
      const { category, status = 'active', page, pageSize, orderBy = 'name' } = options;
      
      let sql = 'SELECT * FROM products';
      let params = [];
      
      // 构建WHERE条件
      const conditions = {};
      if (category) conditions.category = category;
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
      
      const products = await this.dbUtil.query(sql, params);
      return products.map(this.formatProduct);
    } catch (error) {
      console.error('Get all products error:', error);
      throw new Error(`Failed to get products: ${error.message}`);
    }
  }

  /**
   * 根据ID获取商品
   * @param {number} productId 商品ID
   * @returns {Promise<Object|null>} 商品信息
   */
  async getProductById(productId) {
    try {
      const sql = 'SELECT * FROM products WHERE id = ?';
      const product = await this.dbUtil.queryFirst(sql, [productId]);
      return product ? this.formatProduct(product) : null;
    } catch (error) {
      console.error('Get product by ID error:', error);
      throw new Error(`Failed to get product: ${error.message}`);
    }
  }

  /**
   * 创建新商品
   * @param {Object} productData 商品数据
   * @returns {Promise<Object>} 创建的商品信息
   */
  async createProduct(productData) {
    try {
      const { name, description, price, stock = 0, imageUrl, category = 'general' } = productData;
      
      // 验证必填字段
      if (!name || price === undefined) {
        throw new Error('Product name and price are required');
      }
      
      // 验证价格
      if (typeof price !== 'number' || price <= 0) {
        throw new Error('Price must be a positive number');
      }
      
      // 验证库存
      if (typeof stock !== 'number' || stock < 0) {
        throw new Error('Stock must be a non-negative number');
      }
      
      const sql = `
        INSERT INTO products (name, description, price, stock, image_url, category)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await this.dbUtil.execute(sql, [
        name,
        description || null,
        price,
        stock,
        imageUrl || null,
        category
      ]);
      
      if (!result.success) {
        throw new Error('Failed to create product');
      }
      
      return await this.getProductById(result.lastRowId);
    } catch (error) {
      console.error('Create product error:', error);
      throw new Error(`Failed to create product: ${error.message}`);
    }
  }

  /**
   * 更新商品信息
   * @param {number} productId 商品ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<Object>} 更新后的商品信息
   */
  async updateProduct(productId, updateData) {
    try {
      const existing = await this.getProductById(productId);
      if (!existing) {
        throw new Error(`Product with ID ${productId} not found`);
      }
      
      const allowedFields = ['name', 'description', 'price', 'stock', 'image_url', 'category', 'status'];
      const updates = {};
      
      // 过滤允许更新的字段
      Object.keys(updateData).forEach(key => {
        const dbKey = key === 'imageUrl' ? 'image_url' : key;
        if (allowedFields.includes(dbKey)) {
          updates[dbKey] = updateData[key];
        }
      });
      
      if (Object.keys(updates).length === 0) {
        return existing;
      }
      
      // 验证价格
      if (updates.price !== undefined && (typeof updates.price !== 'number' || updates.price <= 0)) {
        throw new Error('Price must be a positive number');
      }
      
      // 验证库存
      if (updates.stock !== undefined && (typeof updates.stock !== 'number' || updates.stock < 0)) {
        throw new Error('Stock must be a non-negative number');
      }
      
      // 添加更新时间
      updates.updated_at = this.dbUtil.formatDate();
      
      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const sql = `UPDATE products SET ${setClause} WHERE id = ?`;
      const params = [...Object.values(updates), productId];
      
      const result = await this.dbUtil.execute(sql, params);
      
      if (!result.success) {
        throw new Error('Failed to update product');
      }
      
      return await this.getProductById(productId);
    } catch (error) {
      console.error('Update product error:', error);
      throw new Error(`Failed to update product: ${error.message}`);
    }
  }

  /**
   * 删除商品
   * @param {number} productId 商品ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteProduct(productId) {
    try {
      const existing = await this.getProductById(productId);
      if (!existing) {
        throw new Error(`Product with ID ${productId} not found`);
      }
      
      // 软删除：更新状态为inactive
      const sql = 'UPDATE products SET status = ?, updated_at = ? WHERE id = ?';
      const result = await this.dbUtil.execute(sql, [
        'inactive',
        this.dbUtil.formatDate(),
        productId
      ]);
      
      return result.success && result.changes > 0;
    } catch (error) {
      console.error('Delete product error:', error);
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  /**
   * 更新商品库存
   * @param {number} productId 商品ID
   * @param {number} quantity 库存变化量（正数增加，负数减少）
   * @returns {Promise<Object>} 更新后的商品信息
   */
  async updateProductStock(productId, quantity) {
    try {
      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }
      
      const newStock = product.stock + quantity;
      if (newStock < 0) {
        throw new Error('Insufficient stock');
      }
      
      const sql = `
        UPDATE products 
        SET stock = ?, updated_at = ? 
        WHERE id = ?
      `;
      
      const result = await this.dbUtil.execute(sql, [
        newStock,
        this.dbUtil.formatDate(),
        productId
      ]);
      
      if (!result.success) {
        throw new Error('Failed to update product stock');
      }
      
      return await this.getProductById(productId);
    } catch (error) {
      console.error('Update product stock error:', error);
      throw new Error(`Failed to update product stock: ${error.message}`);
    }
  }

  /**
   * 根据分类获取商品
   * @param {string} category 商品分类
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 商品列表
   */
  async getProductsByCategory(category, options = {}) {
    try {
      return await this.getAllProducts({ ...options, category });
    } catch (error) {
      console.error('Get products by category error:', error);
      throw new Error(`Failed to get products by category: ${error.message}`);
    }
  }

  /**
   * 搜索商品
   * @param {string} keyword 搜索关键词
   * @param {Object} options 搜索选项
   * @returns {Promise<Array>} 搜索结果
   */
  async searchProducts(keyword, options = {}) {
    try {
      const { category, status = 'active' } = options;
      
      let sql = `
        SELECT * FROM products 
        WHERE (name LIKE ? OR description LIKE ?)
      `;
      let params = [`%${keyword}%`, `%${keyword}%`];
      
      if (category) {
        sql += ' AND category = ?';
        params.push(category);
      }
      
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }
      
      sql += ' ORDER BY name';
      
      const products = await this.dbUtil.query(sql, params);
      return products.map(this.formatProduct);
    } catch (error) {
      console.error('Search products error:', error);
      throw new Error(`Failed to search products: ${error.message}`);
    }
  }

  /**
   * 获取商品分类列表
   * @returns {Promise<Array>} 分类列表
   */
  async getProductCategories() {
    try {
      const sql = `
        SELECT category, COUNT(*) as count 
        FROM products 
        WHERE status = 'active' 
        GROUP BY category 
        ORDER BY category
      `;
      
      const categories = await this.dbUtil.query(sql);
      return categories.map(cat => ({
        name: cat.category,
        count: cat.count
      }));
    } catch (error) {
      console.error('Get product categories error:', error);
      throw new Error(`Failed to get product categories: ${error.message}`);
    }
  }

  /**
   * 获取商品统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getProductStats() {
    try {
      const totalSql = 'SELECT COUNT(*) as total FROM products WHERE status = ?';
      const categorySql = `
        SELECT category, COUNT(*) as count, SUM(stock) as total_stock 
        FROM products 
        WHERE status = ? 
        GROUP BY category
      `;
      const stockSql = 'SELECT SUM(stock) as total_stock FROM products WHERE status = ?';
      
      const [totalResult, categoryResults, stockResult] = await Promise.all([
        this.dbUtil.queryFirst(totalSql, ['active']),
        this.dbUtil.query(categorySql, ['active']),
        this.dbUtil.queryFirst(stockSql, ['active'])
      ]);
      
      return {
        total: totalResult?.total || 0,
        totalStock: stockResult?.total_stock || 0,
        byCategory: categoryResults.reduce((acc, row) => {
          acc[row.category] = {
            count: row.count,
            stock: row.total_stock
          };
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Get product stats error:', error);
      throw new Error(`Failed to get product stats: ${error.message}`);
    }
  }

  /**
   * 检查商品库存是否充足
   * @param {number} productId 商品ID
   * @param {number} quantity 需要的数量
   * @returns {Promise<boolean>} 是否库存充足
   */
  async checkStock(productId, quantity) {
    try {
      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error(`Product with ID ${productId} not found`);
      }
      
      return product.stock >= quantity;
    } catch (error) {
      console.error('Check stock error:', error);
      throw new Error(`Failed to check stock: ${error.message}`);
    }
  }

  /**
   * 格式化商品数据
   * @param {Object} product 原始商品数据
   * @returns {Object} 格式化后的商品数据
   */
  formatProduct(product) {
    if (!product) return null;
    
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      imageUrl: product.image_url,
      category: product.category,
      status: product.status,
      createdAt: this.dbUtil.parseDate(product.created_at),
      updatedAt: this.dbUtil.parseDate(product.updated_at)
    };
  }
}