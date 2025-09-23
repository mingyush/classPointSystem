/**
 * 系统配置API路由 - Cloudflare Workers版本
 * 实现系统配置管理功能
 */

import { Router } from 'itty-router';
import { 
  authenticateToken,
  requireTeacher,
  requireAuth,
  successResponse, 
  errorResponse, 
  parseRequestBody, 
  validateParams 
} from '../middleware/auth.js';
import { ConfigService } from '../services/configService.js';
import { PerformanceMiddleware } from '../middleware/performance.js';
import { CACHE_STRATEGIES, CacheKeyGenerator } from '../cache/cache-manager.js';

/**
 * 处理配置API请求
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @param {Object} ctx 上下文
 * @returns {Response} 响应对象
 */
export async function handleConfigAPI(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  // 初始化服务
  const configService = new ConfigService(env.DB);
  
  // 初始化性能中间件
  const performance = new PerformanceMiddleware(env);
  
  // 使用路由处理请求
  const router = createConfigRouter(env);
  return router.handle(request, env, ctx);
}

/**
 * 创建配置路由
 * @param {Object} env 环境变量
 * @returns {Router} 路由实例
 */
export function createConfigRouter(env) {
  const router = Router({ base: '/api/config' });
  
  // 获取所有配置（仅教师）
  router.get('/', 
    authenticateToken(env), 
    requireTeacher,
    performance.monitoringMiddleware('config:get'),
    performance.cacheMiddleware(
      () => CacheKeyGenerator.systemConfig(),
      CACHE_STRATEGIES.SYSTEM_CONFIG
    ),
    async (request) => {
      try {
        const configService = new ConfigService(env.DB);
        const configs = await configService.getAllConfigs();
        
        return successResponse(configs);
      } catch (error) {
        console.error('Get all configs error:', error);
        return errorResponse('Failed to get configs', 500);
      }
    }
  );
  
  // 获取单个配置
  router.get('/:key', authenticateToken(env), requireAuth, async (request) => {
    try {
      const { key } = request.params;
      
      if (!key) {
        return errorResponse('Config key is required', 400);
      }
      
      const configService = new ConfigService(env.DB);
      const config = await configService.getConfig(key);
      
      if (config === null) {
        return errorResponse('Config not found', 404);
      }
      
      return successResponse({ key, value: config });
    } catch (error) {
      console.error('Get config error:', error);
      return errorResponse('Failed to get config', 500);
    }
  });
  
  // 设置单个配置（仅教师）
  router.put('/:key', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { key } = request.params;
      
      if (!key) {
        return errorResponse('Config key is required', 400);
      }
      
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        value: { required: true }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { value } = body;
      
      const configService = new ConfigService(env.DB);
      await configService.setConfig(key, value);
      
      return successResponse({ 
        message: 'Config updated successfully',
        key, 
        value 
      });
    } catch (error) {
      console.error('Set config error:', error);
      return errorResponse('Failed to set config', 500);
    }
  });
  
  // 删除配置（仅教师）
  router.delete('/:key', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { key } = request.params;
      
      if (!key) {
        return errorResponse('Config key is required', 400);
      }
      
      const configService = new ConfigService(env.DB);
      
      // 检查配置是否存在
      const existingConfig = await configService.getConfig(key);
      if (existingConfig === null) {
        return errorResponse('Config not found', 404);
      }
      
      await configService.deleteConfig(key);
      
      return successResponse({ 
        message: 'Config deleted successfully',
        key 
      });
    } catch (error) {
      console.error('Delete config error:', error);
      return errorResponse('Failed to delete config', 500);
    }
  });
  
  // 批量设置配置（仅教师）
  router.post('/batch', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        configs: { required: true, type: 'object' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { configs } = body;
      
      if (Object.keys(configs).length === 0) {
        return errorResponse('At least one config is required', 400);
      }
      
      const configService = new ConfigService(env.DB);
      await configService.setBatchConfigs(configs);
      
      return successResponse({ 
        message: 'Configs updated successfully',
        configs 
      });
    } catch (error) {
      console.error('Batch set configs error:', error);
      return errorResponse('Failed to batch set configs', 500);
    }
  });
  
  // 获取系统信息配置
  router.get('/system/info', authenticateToken(env), requireAuth, async (request) => {
    try {
      const configService = new ConfigService(env.DB);
      const systemInfo = await configService.getSystemInfo();
      
      return successResponse(systemInfo);
    } catch (error) {
      console.error('Get system info error:', error);
      return errorResponse('Failed to get system info', 500);
    }
  });
  
  // 更新系统信息配置（仅教师）
  router.put('/system/info', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        systemName: { required: false, type: 'string', maxLength: 100 },
        className: { required: false, type: 'string', maxLength: 100 },
        teacherName: { required: false, type: 'string', maxLength: 100 },
        description: { required: false, type: 'string', maxLength: 500 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const configService = new ConfigService(env.DB);
      const systemInfo = await configService.updateSystemInfo(body);
      
      return successResponse({ 
        message: 'System info updated successfully',
        systemInfo 
      });
    } catch (error) {
      console.error('Update system info error:', error);
      return errorResponse('Failed to update system info', 500);
    }
  });
  
  // 获取积分规则配置
  router.get('/points/rules', authenticateToken(env), requireAuth, async (request) => {
    try {
      const configService = new ConfigService(env.DB);
      const pointsRules = await configService.getPointsRules();
      
      return successResponse(pointsRules);
    } catch (error) {
      console.error('Get points rules error:', error);
      return errorResponse('Failed to get points rules', 500);
    }
  });
  
  // 更新积分规则配置（仅教师）
  router.put('/points/rules', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        maxDailyPoints: { required: false, type: 'number', min: 0 },
        maxWeeklyPoints: { required: false, type: 'number', min: 0 },
        maxMonthlyPoints: { required: false, type: 'number', min: 0 },
        pointsExpireDays: { required: false, type: 'number', min: 0 },
        enablePointsExpiry: { required: false, type: 'boolean' },
        enableDailyLimit: { required: false, type: 'boolean' },
        enableWeeklyLimit: { required: false, type: 'boolean' },
        enableMonthlyLimit: { required: false, type: 'boolean' },
        pointsCategories: { required: false, type: 'array' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const configService = new ConfigService(env.DB);
      const pointsRules = await configService.updatePointsRules(body);
      
      return successResponse({ 
        message: 'Points rules updated successfully',
        pointsRules 
      });
    } catch (error) {
      console.error('Update points rules error:', error);
      return errorResponse('Failed to update points rules', 500);
    }
  });
  
  // 重置配置到默认值（仅教师）
  router.post('/reset', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        configKeys: { required: false, type: 'array' },
        resetAll: { required: false, type: 'boolean' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { configKeys, resetAll } = body;
      
      if (!resetAll && (!configKeys || configKeys.length === 0)) {
        return errorResponse('Either configKeys or resetAll must be provided', 400);
      }
      
      const configService = new ConfigService(env.DB);
      
      if (resetAll) {
        // 重置所有配置到默认值
        const defaultConfigs = {
          'system.name': env.SYSTEM_NAME || '班级积分管理系统',
          'system.class_name': env.CLASS_NAME || '示例班级',
          'system.teacher_name': env.TEACHER_NAME || '示例教师',
          'system.description': '班级积分管理系统，用于管理学生积分和商品兑换',
          'points.max_daily': 100,
          'points.max_weekly': 500,
          'points.max_monthly': 2000,
          'points.expire_days': 365,
          'points.enable_expiry': false,
          'points.enable_daily_limit': false,
          'points.enable_weekly_limit': false,
          'points.enable_monthly_limit': false,
          'points.categories': JSON.stringify([
            { name: '课堂表现', color: '#10B981' },
            { name: '作业完成', color: '#3B82F6' },
            { name: '考试成绩', color: '#8B5CF6' },
            { name: '纪律表现', color: '#F59E0B' },
            { name: '其他', color: '#6B7280' }
          ])
        };
        
        await configService.setBatchConfigs(defaultConfigs);
        
        return successResponse({ 
          message: 'All configs reset to default values successfully',
          configs: defaultConfigs 
        });
      } else {
        // 重置指定配置
        const defaultValues = {
          'system.name': env.SYSTEM_NAME || '班级积分管理系统',
          'system.class_name': env.CLASS_NAME || '示例班级',
          'system.teacher_name': env.TEACHER_NAME || '示例教师',
          'system.description': '班级积分管理系统，用于管理学生积分和商品兑换',
          'points.max_daily': 100,
          'points.max_weekly': 500,
          'points.max_monthly': 2000,
          'points.expire_days': 365,
          'points.enable_expiry': false,
          'points.enable_daily_limit': false,
          'points.enable_weekly_limit': false,
          'points.enable_monthly_limit': false,
          'points.categories': JSON.stringify([
            { name: '课堂表现', color: '#10B981' },
            { name: '作业完成', color: '#3B82F6' },
            { name: '考试成绩', color: '#8B5CF6' },
            { name: '纪律表现', color: '#F59E0B' },
            { name: '其他', color: '#6B7280' }
          ])
        };
        
        const resetConfigs = {};
        for (const key of configKeys) {
          if (defaultValues.hasOwnProperty(key)) {
            resetConfigs[key] = defaultValues[key];
          }
        }
        
        if (Object.keys(resetConfigs).length === 0) {
          return errorResponse('No valid config keys provided', 400);
        }
        
        await configService.setBatchConfigs(resetConfigs);
        
        return successResponse({ 
          message: 'Selected configs reset to default values successfully',
          configs: resetConfigs 
        });
      }
    } catch (error) {
      console.error('Reset configs error:', error);
      return errorResponse('Failed to reset configs', 500);
    }
  });
  
  // 导出配置（仅教师）
  router.get('/export/all', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const configService = new ConfigService(env.DB);
      const configs = await configService.getAllConfigs();
      
      // 转换为导出格式
      const exportData = {
        exportTime: new Date().toISOString(),
        version: '1.0',
        configs: configs.reduce((acc, config) => {
          acc[config.key] = config.value;
          return acc;
        }, {})
      };
      
      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="config-export-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    } catch (error) {
      console.error('Export configs error:', error);
      return errorResponse('Failed to export configs', 500);
    }
  });
  
  // 导入配置（仅教师）
  router.post('/import', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        configs: { required: true, type: 'object' },
        overwrite: { required: false, type: 'boolean' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { configs, overwrite = false } = body;
      
      if (Object.keys(configs).length === 0) {
        return errorResponse('No configs to import', 400);
      }
      
      const configService = new ConfigService(env.DB);
      
      // 如果不覆盖，检查冲突的配置
      if (!overwrite) {
        const existingConfigs = await configService.getAllConfigs();
        const existingKeys = new Set(existingConfigs.map(c => c.key));
        const conflictKeys = Object.keys(configs).filter(key => existingKeys.has(key));
        
        if (conflictKeys.length > 0) {
          return errorResponse('Config conflicts detected', 409, { 
            conflictKeys,
            message: 'Set overwrite=true to force import' 
          });
        }
      }
      
      await configService.setBatchConfigs(configs);
      
      return successResponse({ 
        message: 'Configs imported successfully',
        importedCount: Object.keys(configs).length,
        configs 
      });
    } catch (error) {
      console.error('Import configs error:', error);
      return errorResponse('Failed to import configs', 500);
    }
  });
  
  return router;
}