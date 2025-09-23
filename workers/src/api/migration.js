/**
 * 数据迁移API路由 - Cloudflare Workers版本
 * 提供数据迁移和验证功能的Web接口
 */

import { Router } from 'itty-router';
import { 
  authenticateToken,
  requireTeacher,
  successResponse, 
  errorResponse, 
  parseRequestBody, 
  validateParams 
} from '../middleware/auth.js';
import { DataMigrator } from '../../scripts/migrate-data.js';

/**
 * 创建迁移路由
 * @param {Object} env 环境变量
 * @returns {Router} 路由实例
 */
export function createMigrationRouter(env) {
  const router = Router({ base: '/api/migration' });
  
  // 获取迁移状态
  router.get('/status', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const migrator = new DataMigrator(env.DB, null);
      const status = await migrator.validateMigration();
      
      return successResponse({
        status: 'success',
        tables: status,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get migration status error:', error);
      return errorResponse('Failed to get migration status', 500);
    }
  });
  
  // 执行完整数据迁移
  router.post('/migrate-all', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        force: { required: false, type: 'boolean' },
        dataSource: { required: false, type: 'string' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { force = false, dataSource = 'json' } = body;
      
      // 目前只支持从JSON文件迁移
      if (dataSource !== 'json') {
        return errorResponse('Only JSON data source is supported currently', 400);
      }
      
      const migrator = new DataMigrator(env.DB, null);
      
      // 执行迁移前检查
      const preStatus = await migrator.validateMigration();
      
      // 执行迁移
      const success = await migrator.migrateAll(force);
      
      // 执行迁移后检查
      const postStatus = await migrator.validateMigration();
      
      return successResponse({
        success,
        message: success ? 'Migration completed successfully' : 'Migration completed with some errors',
        preStatus,
        postStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Migration error:', error);
      return errorResponse('Migration failed', 500, { error: error.message });
    }
  });
  
  // 迁移学生数据
  router.post('/migrate-students', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      const { force = false, students = [] } = body;
      
      const migrator = new DataMigrator(env.DB, null);
      
      let success;
      if (students.length > 0) {
        // 从请求体中的数据迁移
        success = await migrator.migrateStudentsFromData(students, force);
      } else {
        // 从JSON文件迁移
        success = await migrator.migrateStudents(force);
      }
      
      const status = await migrator.validateMigration();
      
      return successResponse({
        success,
        message: success ? 'Students migration completed successfully' : 'Students migration failed',
        studentsCount: status.students,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Students migration error:', error);
      return errorResponse('Students migration failed', 500, { error: error.message });
    }
  });
  
  // 迁移积分记录数据
  router.post('/migrate-points', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      const { force = false, pointRecords = [] } = body;
      
      const migrator = new DataMigrator(env.DB, null);
      
      let success;
      if (pointRecords.length > 0) {
        // 从请求体中的数据迁移
        success = await migrator.migratePointRecordsFromData(pointRecords, force);
      } else {
        // 从JSON文件迁移
        success = await migrator.migratePointRecords(force);
      }
      
      const status = await migrator.validateMigration();
      
      return successResponse({
        success,
        message: success ? 'Point records migration completed successfully' : 'Point records migration failed',
        pointRecordsCount: status.point_records,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Point records migration error:', error);
      return errorResponse('Point records migration failed', 500, { error: error.message });
    }
  });
  
  // 迁移商品数据
  router.post('/migrate-products', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      const { force = false, products = [] } = body;
      
      const migrator = new DataMigrator(env.DB, null);
      
      let success;
      if (products.length > 0) {
        // 从请求体中的数据迁移
        success = await migrator.migrateProductsFromData(products, force);
      } else {
        // 从JSON文件迁移
        success = await migrator.migrateProducts(force);
      }
      
      const status = await migrator.validateMigration();
      
      return successResponse({
        success,
        message: success ? 'Products migration completed successfully' : 'Products migration failed',
        productsCount: status.products,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Products migration error:', error);
      return errorResponse('Products migration failed', 500, { error: error.message });
    }
  });
  
  // 迁移订单数据
  router.post('/migrate-orders', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      const { force = false, orders = [] } = body;
      
      const migrator = new DataMigrator(env.DB, null);
      
      let success;
      if (orders.length > 0) {
        // 从请求体中的数据迁移
        success = await migrator.migrateOrdersFromData(orders, force);
      } else {
        // 从JSON文件迁移
        success = await migrator.migrateOrders(force);
      }
      
      const status = await migrator.validateMigration();
      
      return successResponse({
        success,
        message: success ? 'Orders migration completed successfully' : 'Orders migration failed',
        ordersCount: status.orders,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Orders migration error:', error);
      return errorResponse('Orders migration failed', 500, { error: error.message });
    }
  });
  
  // 迁移系统配置数据
  router.post('/migrate-config', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      const { force = false, config = {} } = body;
      
      const migrator = new DataMigrator(env.DB, null);
      
      let success;
      if (Object.keys(config).length > 0) {
        // 从请求体中的数据迁移
        success = await migrator.migrateSystemConfigFromData(config, force);
      } else {
        // 从JSON文件迁移
        success = await migrator.migrateSystemConfig(force);
      }
      
      const status = await migrator.validateMigration();
      
      return successResponse({
        success,
        message: success ? 'System config migration completed successfully' : 'System config migration failed',
        configCount: status.system_config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('System config migration error:', error);
      return errorResponse('System config migration failed', 500, { error: error.message });
    }
  });
  
  // 清空指定表数据
  router.delete('/clear/:table', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { table } = request.params;
      
      const allowedTables = ['students', 'point_records', 'products', 'orders', 'system_config', 'teachers'];
      if (!allowedTables.includes(table)) {
        return errorResponse('Invalid table name', 400, { allowedTables });
      }
      
      const migrator = new DataMigrator(env.DB, null);
      
      // 获取清空前的记录数
      const beforeCount = await migrator.getTableCount(table);
      
      // 清空表
      await migrator.clearTable(table);
      
      // 获取清空后的记录数
      const afterCount = await migrator.getTableCount(table);
      
      return successResponse({
        message: `Table ${table} cleared successfully`,
        beforeCount,
        afterCount,
        deletedCount: beforeCount - afterCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Clear table error:', error);
      return errorResponse('Failed to clear table', 500, { error: error.message });
    }
  });
  
  // 重置数据库到初始状态
  router.post('/reset-database', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        confirm: { required: true, type: 'boolean' },
        keepTables: { required: false, type: 'array' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { confirm, keepTables = [] } = body;
      
      if (!confirm) {
        return errorResponse('Database reset requires confirmation', 400);
      }
      
      const migrator = new DataMigrator(env.DB, null);
      
      // 获取重置前的状态
      const beforeStatus = await migrator.validateMigration();
      
      // 清空所有表（除了保留的表）
      const allTables = ['students', 'point_records', 'products', 'orders', 'system_config', 'teachers'];
      const tablesToClear = allTables.filter(table => !keepTables.includes(table));
      
      const clearResults = {};
      for (const table of tablesToClear) {
        try {
          const beforeCount = await migrator.getTableCount(table);
          await migrator.clearTable(table);
          const afterCount = await migrator.getTableCount(table);
          clearResults[table] = {
            beforeCount,
            afterCount,
            deletedCount: beforeCount - afterCount
          };
        } catch (error) {
          console.error(`Error clearing table ${table}:`, error);
          clearResults[table] = { error: error.message };
        }
      }
      
      // 重新创建默认数据
      await migrator.migrateTeachers(true); // 创建默认教师账户
      await migrator.migrateSystemConfig(true); // 创建默认系统配置
      
      // 获取重置后的状态
      const afterStatus = await migrator.validateMigration();
      
      return successResponse({
        message: 'Database reset completed successfully',
        beforeStatus,
        afterStatus,
        clearResults,
        keptTables: keepTables,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Database reset error:', error);
      return errorResponse('Database reset failed', 500, { error: error.message });
    }
  });
  
  // 导出数据
  router.get('/export/:table', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { table } = request.params;
      const url = new URL(request.url);
      const format = url.searchParams.get('format') || 'json';
      
      const allowedTables = ['students', 'point_records', 'products', 'orders', 'system_config', 'teachers'];
      if (!allowedTables.includes(table)) {
        return errorResponse('Invalid table name', 400, { allowedTables });
      }
      
      const migrator = new DataMigrator(env.DB, null);
      const data = await migrator.db.query(`SELECT * FROM ${table} ORDER BY id`);
      
      if (format === 'csv') {
        // 导出为CSV格式
        if (data.length === 0) {
          return new Response('', {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="${table}-export-${new Date().toISOString().split('T')[0]}.csv"`
            }
          });
        }
        
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(header => {
            const value = row[header];
            // 处理包含逗号或引号的值
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(','))
        ].join('\n');
        
        return new Response(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${table}-export-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });
      } else {
        // 导出为JSON格式
        const exportData = {
          table,
          exportTime: new Date().toISOString(),
          count: data.length,
          data
        };
        
        return new Response(JSON.stringify(exportData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${table}-export-${new Date().toISOString().split('T')[0]}.json"`
          }
        });
      }
    } catch (error) {
      console.error('Export data error:', error);
      return errorResponse('Failed to export data', 500, { error: error.message });
    }
  });
  
  // 获取迁移日志
  router.get('/logs', authenticateToken(env), requireTeacher, async (request) => {
    try {
      // 这里可以实现迁移日志的存储和查询
      // 目前返回模拟数据
      const logs = [
        {
          id: 1,
          action: 'migrate_all',
          status: 'success',
          message: 'All data migrated successfully',
          timestamp: new Date().toISOString(),
          details: {
            tables: ['students', 'point_records', 'products', 'orders', 'system_config', 'teachers'],
            recordsCount: 150
          }
        }
      ];
      
      return successResponse({
        logs,
        total: logs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get migration logs error:', error);
      return errorResponse('Failed to get migration logs', 500);
    }
  });
  
  return router;
}