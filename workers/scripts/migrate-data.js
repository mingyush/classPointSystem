#!/usr/bin/env node

/**
 * 数据迁移脚本
 * 从现有系统迁移数据到 Cloudflare D1 数据库
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * 日志工具
 */
class Logger {
  static info(message) {
    console.log(`\x1b[36m[INFO]\x1b[0m ${message}`);
  }
  
  static success(message) {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`);
  }
  
  static warning(message) {
    console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`);
  }
  
  static error(message) {
    console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  }
}

/**
 * 数据迁移器
 */
class DataMigrator {
  constructor(sourceConfig, targetConfig) {
    this.sourceConfig = sourceConfig;
    this.targetConfig = targetConfig;
    this.batchSize = 100;
  }
  
  /**
   * 连接源数据库
   */
  async connectSource() {
    Logger.info('连接源数据库...');
    
    // 这里根据源数据库类型实现连接逻辑
    // 示例：MySQL, PostgreSQL, SQLite 等
    if (this.sourceConfig.type === 'sqlite') {
      const Database = await import('better-sqlite3');
      this.sourceDb = new Database.default(this.sourceConfig.path);
      Logger.success('SQLite 源数据库连接成功');
    } else if (this.sourceConfig.type === 'mysql') {
      const mysql = await import('mysql2/promise');
      this.sourceDb = await mysql.createConnection(this.sourceConfig);
      Logger.success('MySQL 源数据库连接成功');
    } else if (this.sourceConfig.type === 'json') {
      // 从 JSON 文件读取数据
      this.sourceData = this.loadJsonData();
      Logger.success('JSON 数据文件加载成功');
    }
  }
  
  /**
   * 加载 JSON 数据
   */
  loadJsonData() {
    const dataPath = this.sourceConfig.path;
    if (!fs.existsSync(dataPath)) {
      throw new Error(`数据文件不存在: ${dataPath}`);
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    Logger.info(`从 ${dataPath} 加载了 ${Object.keys(data).length} 个数据表`);
    return data;
  }
  
  /**
   * 生成迁移 SQL
   */
  generateMigrationSQL() {
    const migrations = [];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 学生表迁移
    if (this.sourceData.students) {
      const studentSQL = this.generateStudentMigration(this.sourceData.students);
      migrations.push({
        name: `${timestamp}-migrate-students.sql`,
        content: studentSQL
      });
    }
    
    // 积分记录迁移
    if (this.sourceData.points) {
      const pointsSQL = this.generatePointsMigration(this.sourceData.points);
      migrations.push({
        name: `${timestamp}-migrate-points.sql`,
        content: pointsSQL
      });
    }
    
    // 商品表迁移
    if (this.sourceData.products) {
      const productsSQL = this.generateProductsMigration(this.sourceData.products);
      migrations.push({
        name: `${timestamp}-migrate-products.sql`,
        content: productsSQL
      });
    }
    
    // 订单表迁移
    if (this.sourceData.orders) {
      const ordersSQL = this.generateOrdersMigration(this.sourceData.orders);
      migrations.push({
        name: `${timestamp}-migrate-orders.sql`,
        content: ordersSQL
      });
    }
    
    // 系统配置迁移
    if (this.sourceData.config) {
      const configSQL = this.generateConfigMigration(this.sourceData.config);
      migrations.push({
        name: `${timestamp}-migrate-config.sql`,
        content: configSQL
      });
    }
    
    return migrations;
  }
  
  /**
   * 生成学生表迁移 SQL
   */
  generateStudentMigration(students) {
    let sql = '-- 学生数据迁移\n\n';
    
    for (const student of students) {
      const values = [
        this.escapeString(student.student_id || student.id),
        this.escapeString(student.name),
        this.escapeString(student.class_name || student.class),
        student.total_points || 0,
        student.available_points || student.total_points || 0,
        this.escapeString(student.avatar_url || ''),
        this.escapeString(student.created_at || new Date().toISOString()),
        this.escapeString(student.updated_at || new Date().toISOString())
      ];
      
      sql += `INSERT OR IGNORE INTO students (student_id, name, class_name, total_points, available_points, avatar_url, created_at, updated_at) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }
  
  /**
   * 生成积分记录迁移 SQL
   */
  generatePointsMigration(points) {
    let sql = '-- 积分记录数据迁移\n\n';
    
    for (const point of points) {
      const values = [
        this.escapeString(point.student_id),
        point.points || 0,
        this.escapeString(point.type || 'earned'),
        this.escapeString(point.reason || ''),
        this.escapeString(point.teacher_id || ''),
        this.escapeString(point.created_at || new Date().toISOString())
      ];
      
      sql += `INSERT INTO points_records (student_id, points, type, reason, teacher_id, created_at) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }
  
  /**
   * 生成商品表迁移 SQL
   */
  generateProductsMigration(products) {
    let sql = '-- 商品数据迁移\n\n';
    
    for (const product of products) {
      const values = [
        this.escapeString(product.name),
        this.escapeString(product.description || ''),
        product.points_cost || 0,
        product.stock_quantity || 0,
        this.escapeString(product.category || 'general'),
        this.escapeString(product.image_url || ''),
        product.is_active ? 1 : 0,
        this.escapeString(product.created_at || new Date().toISOString()),
        this.escapeString(product.updated_at || new Date().toISOString())
      ];
      
      sql += `INSERT INTO products (name, description, points_cost, stock_quantity, category, image_url, is_active, created_at, updated_at) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }
  
  /**
   * 生成订单表迁移 SQL
   */
  generateOrdersMigration(orders) {
    let sql = '-- 订单数据迁移\n\n';
    
    for (const order of orders) {
      const values = [
        this.escapeString(order.student_id),
        order.product_id || 0,
        order.quantity || 1,
        order.points_cost || 0,
        this.escapeString(order.status || 'pending'),
        this.escapeString(order.created_at || new Date().toISOString()),
        this.escapeString(order.updated_at || new Date().toISOString())
      ];
      
      sql += `INSERT INTO orders (student_id, product_id, quantity, points_cost, status, created_at, updated_at) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }
  
  /**
   * 生成系统配置迁移 SQL
   */
  generateConfigMigration(config) {
    let sql = '-- 系统配置数据迁移\n\n';
    
    const configs = [
      { key: 'system_mode', value: config.system_mode || 'normal' },
      { key: 'daily_points_limit', value: config.daily_points_limit || '100' },
      { key: 'weekly_points_limit', value: config.weekly_points_limit || '500' },
      { key: 'monthly_points_limit', value: config.monthly_points_limit || '2000' },
      { key: 'exchange_enabled', value: config.exchange_enabled ? 'true' : 'false' },
      { key: 'min_exchange_points', value: config.min_exchange_points || '10' }
    ];
    
    for (const configItem of configs) {
      const values = [
        this.escapeString(configItem.key),
        this.escapeString(configItem.value),
        this.escapeString(new Date().toISOString()),
        this.escapeString(new Date().toISOString())
      ];
      
      sql += `INSERT OR REPLACE INTO system_config (config_key, config_value, created_at, updated_at) VALUES (${values.join(', ')});\n`;
    }
    
    return sql;
  }
  
  /**
   * 转义字符串
   */
  escapeString(value) {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    return `'${String(value).replace(/'/g, "''")}'`;
  }
  
  /**
   * 保存迁移文件
   */
  saveMigrationFiles(migrations) {
    const migrationsDir = path.join(projectRoot, 'migrations');
    
    // 确保迁移目录存在
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    for (const migration of migrations) {
      const filePath = path.join(migrationsDir, migration.name);
      fs.writeFileSync(filePath, migration.content, 'utf8');
      Logger.success(`迁移文件已保存: ${migration.name}`);
    }
  }
  
  /**
   * 验证数据完整性
   */
  validateData() {
    Logger.info('验证数据完整性...');
    
    const issues = [];
    
    // 检查学生数据
    if (this.sourceData.students) {
      for (const student of this.sourceData.students) {
        if (!student.student_id && !student.id) {
          issues.push('学生记录缺少ID');
        }
        if (!student.name) {
          issues.push(`学生 ${student.student_id || student.id} 缺少姓名`);
        }
      }
    }
    
    // 检查积分记录
    if (this.sourceData.points) {
      for (const point of this.sourceData.points) {
        if (!point.student_id) {
          issues.push('积分记录缺少学生ID');
        }
        if (typeof point.points !== 'number') {
          issues.push('积分记录包含无效的积分值');
        }
      }
    }
    
    if (issues.length > 0) {
      Logger.warning(`发现 ${issues.length} 个数据问题:`);
      issues.forEach(issue => Logger.warning(`  - ${issue}`));
    } else {
      Logger.success('数据验证通过');
    }
    
    return issues;
  }
  
  /**
   * 执行迁移
   */
  async migrate() {
    try {
      Logger.info('开始数据迁移...');
      
      // 连接源数据库
      await this.connectSource();
      
      // 验证数据
      const issues = this.validateData();
      if (issues.length > 0) {
        Logger.warning('数据存在问题，但继续迁移...');
      }
      
      // 生成迁移 SQL
      const migrations = this.generateMigrationSQL();
      
      // 保存迁移文件
      this.saveMigrationFiles(migrations);
      
      Logger.success(`数据迁移完成！生成了 ${migrations.length} 个迁移文件`);
      Logger.info('请运行以下命令应用迁移:');
      Logger.info('  npm run deploy:migrations');
      
    } catch (error) {
      Logger.error('数据迁移失败');
      console.error(error);
      process.exit(1);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
数据迁移工具

使用方法:
  node migrate-data.js --source <path> [选项]

选项:
  --source <path>     源数据文件路径 (JSON格式)
  --type <type>       源数据类型 (json|sqlite|mysql)
  --batch-size <n>    批处理大小 (默认: 100)
  --help, -h          显示帮助信息

示例:
  node migrate-data.js --source ./data/backup.json --type json
`);
    return;
  }
  
  // 解析命令行参数
  const sourceIndex = args.indexOf('--source');
  if (sourceIndex === -1 || !args[sourceIndex + 1]) {
    Logger.error('请指定源数据文件路径: --source <path>');
    process.exit(1);
  }
  
  const sourcePath = args[sourceIndex + 1];
  const typeIndex = args.indexOf('--type');
  const sourceType = typeIndex !== -1 ? args[typeIndex + 1] : 'json';
  
  const sourceConfig = {
    type: sourceType,
    path: sourcePath
  };
  
  const migrator = new DataMigrator(sourceConfig, {});
  await migrator.migrate();
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DataMigrator };