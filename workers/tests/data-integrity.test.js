/**
 * 数据完整性验证测试
 * 验证数据迁移后的数据完整性和一致性
 */

const fs = require('fs').promises;
const path = require('path');

// 模拟D1数据库连接（在实际测试中会使用真实的D1连接）
class MockD1Database {
  constructor() {
    this.data = {
      students: [],
      point_records: [],
      products: [],
      orders: [],
      system_config: [],
      teachers: []
    };
  }

  async prepare(sql) {
    const statement = {
      bind: (...params) => statement,
      all: async () => {
        // 模拟SQL查询结果
        if (sql.includes('SELECT * FROM students')) {
          return { results: this.data.students };
        }
        if (sql.includes('SELECT * FROM point_records')) {
          return { results: this.data.point_records };
        }
        if (sql.includes('SELECT * FROM products')) {
          return { results: this.data.products };
        }
        if (sql.includes('SELECT * FROM orders')) {
          return { results: this.data.orders };
        }
        if (sql.includes('SELECT * FROM system_config')) {
          return { results: this.data.system_config };
        }
        if (sql.includes('SELECT * FROM teachers')) {
          return { results: this.data.teachers };
        }
        if (sql.includes('COUNT(*)')) {
          const tableName = sql.match(/FROM (\w+)/)?.[1];
          return { results: [{ count: this.data[tableName]?.length || 0 }] };
        }
        return { results: [] };
      },
      first: async () => {
        const results = await statement.all();
        return results.results[0] || null;
      }
    };
    return statement;
  }

  // 模拟数据加载
  loadMockData(data) {
    this.data = { ...this.data, ...data };
  }
}

// 数据完整性验证器
class DataIntegrityValidator {
  constructor(db) {
    this.db = db;
    this.errors = [];
    this.warnings = [];
  }

  // 验证学生数据完整性
  async validateStudents() {
    console.log('验证学生数据完整性...');
    
    const students = await this.db.prepare('SELECT * FROM students').all();
    const studentData = students.results;

    // 检查必需字段
    for (const student of studentData) {
      if (!student.id) {
        this.errors.push(`学生记录缺少ID: ${JSON.stringify(student)}`);
      }
      if (!student.name) {
        this.errors.push(`学生 ${student.id} 缺少姓名`);
      }
      if (student.balance === null || student.balance === undefined) {
        this.errors.push(`学生 ${student.id} 缺少积分余额`);
      }
      if (student.balance < 0) {
        this.warnings.push(`学生 ${student.id} 积分余额为负数: ${student.balance}`);
      }
    }

    // 检查ID唯一性
    const ids = studentData.map(s => s.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      this.errors.push(`发现重复的学生ID: ${duplicateIds.join(', ')}`);
    }

    console.log(`学生数据验证完成: ${studentData.length} 条记录`);
  }

  // 验证积分记录完整性
  async validatePointRecords() {
    console.log('验证积分记录完整性...');
    
    const records = await this.db.prepare('SELECT * FROM point_records').all();
    const recordData = records.results;
    
    const students = await this.db.prepare('SELECT * FROM students').all();
    const studentIds = new Set(students.results.map(s => s.id));

    for (const record of recordData) {
      // 检查必需字段
      if (!record.id) {
        this.errors.push(`积分记录缺少ID: ${JSON.stringify(record)}`);
      }
      if (!record.student_id) {
        this.errors.push(`积分记录 ${record.id} 缺少学生ID`);
      }
      if (record.points === null || record.points === undefined) {
        this.errors.push(`积分记录 ${record.id} 缺少积分值`);
      }
      if (!record.reason) {
        this.warnings.push(`积分记录 ${record.id} 缺少原因说明`);
      }
      if (!record.created_at) {
        this.errors.push(`积分记录 ${record.id} 缺少创建时间`);
      }

      // 检查外键约束
      if (record.student_id && !studentIds.has(record.student_id)) {
        this.errors.push(`积分记录 ${record.id} 引用了不存在的学生ID: ${record.student_id}`);
      }
    }

    console.log(`积分记录验证完成: ${recordData.length} 条记录`);
  }

  // 验证商品数据完整性
  async validateProducts() {
    console.log('验证商品数据完整性...');
    
    const products = await this.db.prepare('SELECT * FROM products').all();
    const productData = products.results;

    for (const product of productData) {
      // 检查必需字段
      if (!product.id) {
        this.errors.push(`商品记录缺少ID: ${JSON.stringify(product)}`);
      }
      if (!product.name) {
        this.errors.push(`商品 ${product.id} 缺少名称`);
      }
      if (product.price === null || product.price === undefined) {
        this.errors.push(`商品 ${product.id} 缺少价格`);
      }
      if (product.price < 0) {
        this.errors.push(`商品 ${product.id} 价格不能为负数: ${product.price}`);
      }
      if (product.stock === null || product.stock === undefined) {
        this.errors.push(`商品 ${product.id} 缺少库存`);
      }
      if (product.stock < 0) {
        this.warnings.push(`商品 ${product.id} 库存为负数: ${product.stock}`);
      }
    }

    // 检查名称唯一性（在同一分类下）
    const namesByCategory = {};
    for (const product of productData) {
      const category = product.category || 'default';
      if (!namesByCategory[category]) {
        namesByCategory[category] = [];
      }
      namesByCategory[category].push(product.name);
    }

    for (const [category, names] of Object.entries(namesByCategory)) {
      const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index);
      if (duplicateNames.length > 0) {
        this.warnings.push(`分类 ${category} 下发现重复的商品名称: ${duplicateNames.join(', ')}`);
      }
    }

    console.log(`商品数据验证完成: ${productData.length} 条记录`);
  }

  // 验证订单数据完整性
  async validateOrders() {
    console.log('验证订单数据完整性...');
    
    const orders = await this.db.prepare('SELECT * FROM orders').all();
    const orderData = orders.results;
    
    const students = await this.db.prepare('SELECT * FROM students').all();
    const studentIds = new Set(students.results.map(s => s.id));
    
    const products = await this.db.prepare('SELECT * FROM products').all();
    const productIds = new Set(products.results.map(p => p.id));

    for (const order of orderData) {
      // 检查必需字段
      if (!order.id) {
        this.errors.push(`订单记录缺少ID: ${JSON.stringify(order)}`);
      }
      if (!order.student_id) {
        this.errors.push(`订单 ${order.id} 缺少学生ID`);
      }
      if (!order.product_id) {
        this.errors.push(`订单 ${order.id} 缺少商品ID`);
      }
      if (order.quantity === null || order.quantity === undefined) {
        this.errors.push(`订单 ${order.id} 缺少数量`);
      }
      if (order.quantity <= 0) {
        this.errors.push(`订单 ${order.id} 数量必须大于0: ${order.quantity}`);
      }
      if (order.total_points === null || order.total_points === undefined) {
        this.errors.push(`订单 ${order.id} 缺少总积分`);
      }
      if (!order.status) {
        this.errors.push(`订单 ${order.id} 缺少状态`);
      }
      if (!order.created_at) {
        this.errors.push(`订单 ${order.id} 缺少创建时间`);
      }

      // 检查外键约束
      if (order.student_id && !studentIds.has(order.student_id)) {
        this.errors.push(`订单 ${order.id} 引用了不存在的学生ID: ${order.student_id}`);
      }
      if (order.product_id && !productIds.has(order.product_id)) {
        this.errors.push(`订单 ${order.id} 引用了不存在的商品ID: ${order.product_id}`);
      }

      // 检查状态值
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (order.status && !validStatuses.includes(order.status)) {
        this.errors.push(`订单 ${order.id} 状态无效: ${order.status}`);
      }
    }

    console.log(`订单数据验证完成: ${orderData.length} 条记录`);
  }

  // 验证系统配置完整性
  async validateSystemConfig() {
    console.log('验证系统配置完整性...');
    
    const configs = await this.db.prepare('SELECT * FROM system_config').all();
    const configData = configs.results;

    // 检查必需的配置项
    const requiredConfigs = [
      'system_name',
      'system_version',
      'points_rules',
      'system_mode'
    ];

    const existingKeys = new Set(configData.map(c => c.key));
    
    for (const requiredKey of requiredConfigs) {
      if (!existingKeys.has(requiredKey)) {
        this.warnings.push(`缺少必需的系统配置: ${requiredKey}`);
      }
    }

    // 检查配置值格式
    for (const config of configData) {
      if (!config.key) {
        this.errors.push(`系统配置缺少键名: ${JSON.stringify(config)}`);
      }
      if (config.value === null || config.value === undefined) {
        this.warnings.push(`系统配置 ${config.key} 值为空`);
      }
    }

    // 检查键名唯一性
    const keys = configData.map(c => c.key).filter(k => k);
    const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      this.errors.push(`发现重复的配置键名: ${duplicateKeys.join(', ')}`);
    }

    console.log(`系统配置验证完成: ${configData.length} 条记录`);
  }

  // 验证教师数据完整性
  async validateTeachers() {
    console.log('验证教师数据完整性...');
    
    const teachers = await this.db.prepare('SELECT * FROM teachers').all();
    const teacherData = teachers.results;

    for (const teacher of teacherData) {
      // 检查必需字段
      if (!teacher.id) {
        this.errors.push(`教师记录缺少ID: ${JSON.stringify(teacher)}`);
      }
      if (!teacher.name) {
        this.errors.push(`教师 ${teacher.id} 缺少姓名`);
      }
      if (!teacher.password_hash) {
        this.errors.push(`教师 ${teacher.id} 缺少密码哈希`);
      }
      if (!teacher.role) {
        this.errors.push(`教师 ${teacher.id} 缺少角色`);
      }

      // 检查角色值
      const validRoles = ['admin', 'teacher'];
      if (teacher.role && !validRoles.includes(teacher.role)) {
        this.errors.push(`教师 ${teacher.id} 角色无效: ${teacher.role}`);
      }
    }

    // 检查ID唯一性
    const ids = teacherData.map(t => t.id).filter(id => id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      this.errors.push(`发现重复的教师ID: ${duplicateIds.join(', ')}`);
    }

    console.log(`教师数据验证完成: ${teacherData.length} 条记录`);
  }

  // 验证数据一致性
  async validateDataConsistency() {
    console.log('验证数据一致性...');
    
    // 验证学生积分余额与积分记录的一致性
    const students = await this.db.prepare('SELECT * FROM students').all();
    const pointRecords = await this.db.prepare('SELECT * FROM point_records').all();
    
    const studentBalances = {};
    students.results.forEach(student => {
      studentBalances[student.id] = student.balance || 0;
    });
    
    const calculatedBalances = {};
    pointRecords.results.forEach(record => {
      if (!calculatedBalances[record.student_id]) {
        calculatedBalances[record.student_id] = 0;
      }
      calculatedBalances[record.student_id] += record.points || 0;
    });
    
    for (const [studentId, storedBalance] of Object.entries(studentBalances)) {
      const calculatedBalance = calculatedBalances[studentId] || 0;
      if (Math.abs(storedBalance - calculatedBalance) > 0.01) {
        this.errors.push(
          `学生 ${studentId} 积分余额不一致: 存储值=${storedBalance}, 计算值=${calculatedBalance}`
        );
      }
    }
    
    // 验证订单总积分与商品价格的一致性
    const orders = await this.db.prepare('SELECT * FROM orders').all();
    const products = await this.db.prepare('SELECT * FROM products').all();
    
    const productPrices = {};
    products.results.forEach(product => {
      productPrices[product.id] = product.price || 0;
    });
    
    for (const order of orders.results) {
      const productPrice = productPrices[order.product_id] || 0;
      const expectedTotal = productPrice * (order.quantity || 0);
      const actualTotal = order.total_points || 0;
      
      if (Math.abs(expectedTotal - actualTotal) > 0.01) {
        this.warnings.push(
          `订单 ${order.id} 总积分可能不正确: 期望=${expectedTotal}, 实际=${actualTotal}`
        );
      }
    }
    
    console.log('数据一致性验证完成');
  }

  // 执行完整验证
  async validateAll() {
    console.log('开始数据完整性验证...');
    
    this.errors = [];
    this.warnings = [];
    
    await this.validateStudents();
    await this.validatePointRecords();
    await this.validateProducts();
    await this.validateOrders();
    await this.validateSystemConfig();
    await this.validateTeachers();
    await this.validateDataConsistency();
    
    return {
      success: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        totalErrors: this.errors.length,
        totalWarnings: this.warnings.length
      }
    };
  }

  // 生成验证报告
  generateReport(result) {
    const report = [
      '=== 数据完整性验证报告 ===',
      `验证时间: ${new Date().toISOString()}`,
      `验证结果: ${result.success ? '通过' : '失败'}`,
      `错误数量: ${result.summary.totalErrors}`,
      `警告数量: ${result.summary.totalWarnings}`,
      ''
    ];
    
    if (result.errors.length > 0) {
      report.push('=== 错误列表 ===');
      result.errors.forEach((error, index) => {
        report.push(`${index + 1}. ${error}`);
      });
      report.push('');
    }
    
    if (result.warnings.length > 0) {
      report.push('=== 警告列表 ===');
      result.warnings.forEach((warning, index) => {
        report.push(`${index + 1}. ${warning}`);
      });
      report.push('');
    }
    
    if (result.success) {
      report.push('✅ 数据完整性验证通过！');
    } else {
      report.push('❌ 数据完整性验证失败，请检查上述错误。');
    }
    
    return report.join('\n');
  }
}

// 测试用例
describe('数据完整性验证', () => {
  let db;
  let validator;
  
  beforeEach(() => {
    db = new MockD1Database();
    validator = new DataIntegrityValidator(db);
  });
  
  test('应该验证完整的数据集', async () => {
    // 加载测试数据
    const testData = {
      students: [
        { id: '2024001', name: '张三', balance: 100, created_at: '2024-01-01T00:00:00Z' },
        { id: '2024002', name: '李四', balance: 50, created_at: '2024-01-01T00:00:00Z' }
      ],
      point_records: [
        { id: 1, student_id: '2024001', points: 50, reason: '课堂表现', category: 'behavior', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, student_id: '2024001', points: 50, reason: '作业完成', category: 'homework', created_at: '2024-01-01T00:00:00Z' },
        { id: 3, student_id: '2024002', points: 50, reason: '课堂表现', category: 'behavior', created_at: '2024-01-01T00:00:00Z' }
      ],
      products: [
        { id: 1, name: '笔记本', price: 30, stock: 10, category: 'stationery', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: '橡皮', price: 5, stock: 20, category: 'stationery', created_at: '2024-01-01T00:00:00Z' }
      ],
      orders: [
        { id: 1, student_id: '2024001', product_id: 1, quantity: 1, total_points: 30, status: 'completed', created_at: '2024-01-01T00:00:00Z' }
      ],
      system_config: [
        { key: 'system_name', value: '班级积分管理系统', created_at: '2024-01-01T00:00:00Z' },
        { key: 'system_version', value: '1.0.0', created_at: '2024-01-01T00:00:00Z' },
        { key: 'system_mode', value: 'normal', created_at: '2024-01-01T00:00:00Z' }
      ],
      teachers: [
        { id: '8001', name: '王老师', password_hash: 'hashed_password', role: 'admin', created_at: '2024-01-01T00:00:00Z' }
      ]
    };
    
    db.loadMockData(testData);
    
    const result = await validator.validateAll();
    
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.warnings.length).toBe(0);
  });
  
  test('应该检测数据错误', async () => {
    // 加载有问题的测试数据
    const testData = {
      students: [
        { id: '', name: '张三', balance: 100 }, // 缺少ID
        { id: '2024002', name: '', balance: -50 } // 缺少姓名，负余额
      ],
      point_records: [
        { id: 1, student_id: '2024999', points: 50, reason: '课堂表现' } // 引用不存在的学生
      ],
      products: [
        { id: 1, name: '笔记本', price: -30, stock: 10 } // 负价格
      ],
      orders: [
        { id: 1, student_id: '2024001', product_id: 999, quantity: 0, total_points: 30, status: 'invalid' } // 引用不存在的商品，无效数量和状态
      ],
      system_config: [
        { key: '', value: '班级积分管理系统' }, // 缺少键名
        { key: 'system_name', value: '班级积分管理系统' },
        { key: 'system_name', value: '重复键名' } // 重复键名
      ],
      teachers: [
        { id: '8001', name: '', password_hash: '', role: 'invalid_role' } // 缺少姓名和密码，无效角色
      ]
    };
    
    db.loadMockData(testData);
    
    const result = await validator.validateAll();
    
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
  
  test('应该生成详细的验证报告', async () => {
    const testData = {
      students: [{ id: '', name: '张三', balance: 100 }],
      point_records: [],
      products: [],
      orders: [],
      system_config: [],
      teachers: []
    };
    
    db.loadMockData(testData);
    
    const result = await validator.validateAll();
    const report = validator.generateReport(result);
    
    expect(report).toContain('数据完整性验证报告');
    expect(report).toContain('验证时间');
    expect(report).toContain('验证结果');
    expect(report).toContain('错误数量');
    expect(report).toContain('警告数量');
  });
});

module.exports = {
  DataIntegrityValidator,
  MockD1Database
};