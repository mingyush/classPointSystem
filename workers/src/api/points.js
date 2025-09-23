/**
 * 积分API路由 - Cloudflare Workers版本
 * 实现积分记录管理和排行榜功能
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
import { PointsService } from '../services/pointsService.js';
import { StudentService } from '../services/studentService.js';
import { PerformanceMiddleware } from '../middleware/performance.js';
import { CACHE_STRATEGIES, CacheKeyGenerator } from '../cache/cache-manager.js';

export async function handlePointsAPI(request, env, ctx) {
  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  // 初始化服务
  const pointsService = new PointsService(env.DB);
  const studentService = new StudentService(env.DB);
  
  // 初始化性能中间件
  const performance = new PerformanceMiddleware(env);
}

/**
 * 创建积分路由
 * @param {Object} env 环境变量
 * @returns {Router} 路由实例
 */
export function createPointsRouter(env) {
  const router = Router({ base: '/api/points' });
  
  // 获取积分记录列表
  router.get('/', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('points:list'),
    performance.cacheMiddleware(
      (request) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const studentId = url.searchParams.get('studentId');
        const type = url.searchParams.get('type');
        return CacheKeyGenerator.pointsList(page, limit) + 
               (studentId ? `:student:${studentId}` : '') +
               (type ? `:type:${type}` : '');
      },
      CACHE_STRATEGIES.POINTS
    ),
    async (request) => {
      try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const studentId = url.searchParams.get('studentId');
        const type = url.searchParams.get('type'); // 'earn' 或 'spend'
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        
        const pointsService = new PointsService(env.DB);
        
        const filters = {
          studentId: studentId ? parseInt(studentId) : null,
          type,
          startDate,
          endDate
        };
        
        const result = await pointsService.getPointsRecords({
          page,
          limit,
          filters
        });
        
        return successResponse({
          records: result.records,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
          }
        });
      } catch (error) {
        console.error('Get points records error:', error);
        return errorResponse('Failed to get points records', 500);
      }
    }
  );
  
  // 添加积分记录（仅教师）
  router.post('/', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        studentId: { required: true, type: 'number', min: 1 },
        points: { required: true, type: 'number' },
        type: { required: true, type: 'string', enum: ['earn', 'spend'] },
        reason: { required: true, type: 'string', minLength: 1 },
        category: { required: false, type: 'string' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { studentId, points, type, reason, category } = body;
      
      // 验证积分值
      if (points <= 0) {
        return errorResponse('Points must be greater than 0', 400);
      }
      
      const studentService = new StudentService(env.DB);
      const pointsService = new PointsService(env.DB);
      
      // 检查学生是否存在
      const student = await studentService.getStudentById(studentId);
      if (!student) {
        return errorResponse('Student not found', 404);
      }
      
      // 如果是消费积分，检查余额是否足够
      if (type === 'spend' && student.points < points) {
        return errorResponse('Insufficient points balance', 400);
      }
      
      const recordData = {
        studentId,
        points: type === 'spend' ? -points : points,
        type,
        reason,
        category: category || (type === 'earn' ? '奖励' : '消费'),
        teacherId: request.user.id
      };
      
      const record = await pointsService.addPointRecord(recordData);
      
      return successResponse(record, 201);
    } catch (error) {
      console.error('Add point record error:', error);
      return errorResponse('Failed to add point record', 500);
    }
  });
  
  // 获取学生积分历史
  router.get('/history/:studentId', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('points:history'),
    performance.cacheMiddleware(
      (request) => {
        const { studentId } = request.params;
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const type = url.searchParams.get('type') || '';
        return CacheKeyGenerator.pointsHistory(studentId, page, limit) + (type ? `:type:${type}` : '');
      },
      CACHE_STRATEGIES.POINTS
    ),
    async (request) => {
      try {
        const { studentId } = request.params;
        
        if (!studentId || isNaN(parseInt(studentId))) {
          return errorResponse('Invalid student ID', 400);
        }
        
        // 检查权限：学生只能查看自己的积分历史
        if (request.user.role === 'student' && request.user.id !== parseInt(studentId)) {
          return errorResponse('Access denied', 403);
        }
        
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const type = url.searchParams.get('type') || ''; // 'earn' or 'spend'
        
        const pointsService = new PointsService(env.DB);
        const result = await pointsService.getStudentPointHistory(parseInt(studentId), {
          page,
          limit,
          type
        });
        
        return successResponse({
          history: result.records,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
          }
        });
      } catch (error) {
        console.error('Get student point history error:', error);
        return errorResponse('Failed to get student point history', 500);
      }
    }
  );
  
  // 获取积分排行榜
  router.get('/leaderboard', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('points:leaderboard'),
    performance.cacheMiddleware(
      (request) => {
        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'total';
        const limit = parseInt(url.searchParams.get('limit')) || 10;
        const classFilter = url.searchParams.get('class') || '';
        return CacheKeyGenerator.leaderboard(type, limit) + (classFilter ? `:class:${classFilter}` : '');
      },
      CACHE_STRATEGIES.LEADERBOARD
    ),
    async (request) => {
      try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'total'; // 'total', 'daily', 'weekly'
        const limit = parseInt(url.searchParams.get('limit')) || 10;
        const classFilter = url.searchParams.get('class') || '';
        
        const pointsService = new PointsService(env.DB);
        
        let leaderboard;
        switch (type) {
          case 'daily':
            leaderboard = await pointsService.getDailyLeaderboard(limit, classFilter);
            break;
          case 'weekly':
            leaderboard = await pointsService.getWeeklyLeaderboard(limit, classFilter);
            break;
          case 'total':
          default:
            leaderboard = await pointsService.getTotalLeaderboard(limit, classFilter);
            break;
        }
        
        return successResponse({
          type,
          leaderboard
        });
      } catch (error) {
        console.error('Get leaderboard error:', error);
        return errorResponse('Failed to get leaderboard', 500);
      }
    }
  );
  
  // 获取积分统计信息
  router.get('/stats', authenticateToken(env), requireAuth, async (request) => {
    try {
      const url = new URL(request.url);
      const studentId = url.searchParams.get('studentId') || '';
      const period = url.searchParams.get('period') || 'all'; // 'all', 'today', 'week', 'month'
      
      const pointsService = new PointsService(env.DB);
      
      // 如果是学生用户，只能查看自己的统计
      let finalStudentId = studentId;
      if (request.user.role === 'student') {
        finalStudentId = request.user.id.toString();
      }
      
      const stats = await pointsService.getPointsStats(finalStudentId, period);
      
      return successResponse(stats);
    } catch (error) {
      console.error('Get points stats error:', error);
      return errorResponse('Failed to get points stats', 500);
    }
  });
  
  // 同步所有学生积分余额（仅教师）
  router.post('/sync-balances', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const pointsService = new PointsService(env.DB);
      const result = await pointsService.syncAllStudentBalances();
      
      return successResponse({
        message: 'Points balances synchronized successfully',
        updatedCount: result.updatedCount
      });
    } catch (error) {
      console.error('Sync points balances error:', error);
      return errorResponse('Failed to sync points balances', 500);
    }
  });
  
  // 批量添加积分记录（仅教师）
  router.post('/batch', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        records: { required: true, type: 'array', minLength: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { records } = body;
      const pointsService = new PointsService(env.DB);
      const studentService = new StudentService(env.DB);
      
      // 验证每条记录
      const validRecords = [];
      const errors = [];
      
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordValidation = validateParams(record, {
          studentId: { required: true, type: 'number', min: 1 },
          points: { required: true, type: 'number', min: 1 },
          type: { required: true, type: 'string', enum: ['earn', 'spend'] },
          reason: { required: true, type: 'string', minLength: 1 },
          category: { required: false, type: 'string' }
        });
        
        if (!recordValidation.valid) {
          errors.push({ index: i, errors: recordValidation.errors });
          continue;
        }
        
        // 检查学生是否存在
        const student = await studentService.getStudentById(record.studentId);
        if (!student) {
          errors.push({ index: i, errors: ['Student not found'] });
          continue;
        }
        
        // 如果是消费积分，检查余额
        if (record.type === 'spend' && student.points < record.points) {
          errors.push({ index: i, errors: ['Insufficient points balance'] });
          continue;
        }
        
        validRecords.push({
          studentId: record.studentId,
          points: record.type === 'spend' ? -record.points : record.points,
          type: record.type,
          reason: record.reason,
          category: record.category || (record.type === 'earn' ? '奖励' : '消费'),
          teacherId: request.user.id
        });
      }
      
      if (errors.length > 0) {
        return errorResponse('Validation failed for some records', 400, { errors });
      }
      
      // 批量添加记录
      const createdRecords = [];
      for (const recordData of validRecords) {
        try {
          const record = await pointsService.addPointRecord(recordData);
          createdRecords.push(record);
        } catch (error) {
          console.error('Failed to create point record:', recordData, error);
        }
      }
      
      return successResponse({
        message: `Successfully added ${createdRecords.length} point records`,
        records: createdRecords
      });
    } catch (error) {
      console.error('Batch add points error:', error);
      return errorResponse('Failed to batch add points', 500);
    }
  });
  
  // 获取积分类别统计
  router.get('/categories', authenticateToken(env), requireAuth, async (request) => {
    try {
      const url = new URL(request.url);
      const studentId = url.searchParams.get('studentId') || '';
      const type = url.searchParams.get('type') || ''; // 'earn' or 'spend'
      const startDate = url.searchParams.get('startDate') || '';
      const endDate = url.searchParams.get('endDate') || '';
      
      // 如果是学生用户，只能查看自己的统计
      let finalStudentId = studentId;
      if (request.user.role === 'student') {
        finalStudentId = request.user.id.toString();
      }
      
      const sql = `
        SELECT 
          category,
          COUNT(*) as count,
          SUM(ABS(points)) as total_points,
          AVG(ABS(points)) as avg_points
        FROM point_records pr
        JOIN students s ON pr.student_id = s.id
        WHERE 1=1
        ${finalStudentId ? 'AND pr.student_id = ?' : ''}
        ${type ? 'AND pr.type = ?' : ''}
        ${startDate ? 'AND DATE(pr.created_at) >= ?' : ''}
        ${endDate ? 'AND DATE(pr.created_at) <= ?' : ''}
        GROUP BY category
        ORDER BY total_points DESC
      `;
      
      const params = [];
      if (finalStudentId) params.push(parseInt(finalStudentId));
      if (type) params.push(type);
      if (startDate) params.push(startDate);
      if (endDate) params.push(endDate);
      
      const stmt = env.DB.prepare(sql);
      const result = await stmt.bind(...params).all();
      
      return successResponse({
        categories: result.results || []
      });
    } catch (error) {
      console.error('Get categories stats error:', error);
      return errorResponse('Failed to get categories stats', 500);
    }
  });
  
  // 删除积分记录（仅教师）
  router.delete('/:id', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid record ID', 400);
      }
      
      // 检查记录是否存在
      const sql = 'SELECT * FROM point_records WHERE id = ?';
      const record = await env.DB.prepare(sql).bind(parseInt(id)).first();
      
      if (!record) {
        return errorResponse('Point record not found', 404);
      }
      
      // 删除记录并更新学生积分余额
      const pointsService = new PointsService(env.DB);
      
      // 反向操作：如果原来是加分，现在减分；如果原来是减分，现在加分
      const reversePoints = -record.points;
      
      // 更新学生积分余额
      const studentService = new StudentService(env.DB);
      const student = await studentService.getStudentById(record.student_id);
      
      if (student) {
        const newBalance = student.points + reversePoints;
        if (newBalance >= 0) {
          await studentService.updateStudentPoints(record.student_id, newBalance);
        }
      }
      
      // 删除记录
      const deleteSql = 'DELETE FROM point_records WHERE id = ?';
      const deleteResult = await env.DB.prepare(deleteSql).bind(parseInt(id)).run();
      
      if (!deleteResult.success) {
        return errorResponse('Failed to delete point record', 500);
      }
      
      return successResponse({ message: 'Point record deleted successfully' });
    } catch (error) {
      console.error('Delete point record error:', error);
      return errorResponse('Failed to delete point record', 500);
    }
  });
  
  return router;
}