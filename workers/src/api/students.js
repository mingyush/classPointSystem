/**
 * 学生API路由 - Cloudflare Workers版本
 * 实现学生信息的CRUD操作和积分管理
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
import { StudentService } from '../services/studentService.js';
import { PointsService } from '../services/pointsService.js';
import { PerformanceMiddleware, CACHE_STRATEGIES, CacheKeyGenerator } from '../middleware/performance.js';

/**
 * 创建学生路由
 * @param {Object} env 环境变量
 * @returns {Router} 路由实例
 */
export function createStudentsRouter(env) {
  const router = Router({ base: '/api/students' });
  
  // 初始化性能中间件
  const performance = new PerformanceMiddleware(env);
  
  // 获取所有学生列表
  router.get('/', authenticateToken(env), requireAuth, 
    performance.monitoringMiddleware('students:list'),
    performance.cacheMiddleware(
      (request) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const search = url.searchParams.get('search') || '';
        const classFilter = url.searchParams.get('class') || '';
        return CacheKeyGenerator.studentList(page, limit) + (search ? `:search:${search}` : '') + (classFilter ? `:class:${classFilter}` : '');
      },
      CACHE_STRATEGIES.STUDENTS
    ),
    async (request) => {
      try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const search = url.searchParams.get('search') || '';
        const classFilter = url.searchParams.get('class') || '';
        const sortBy = url.searchParams.get('sortBy') || 'name';
        const sortOrder = url.searchParams.get('sortOrder') || 'asc';
        
        const studentService = new StudentService(env.DB);
        
        let students;
        let total;
        
        if (search) {
          const result = await studentService.searchStudents(search, { page, limit, sortBy, sortOrder });
          students = result.students;
          total = result.total;
        } else if (classFilter) {
          const result = await studentService.getStudentsByClass(classFilter, { page, limit, sortBy, sortOrder });
          students = result.students;
          total = result.total;
        } else {
          const result = await studentService.getAllStudents({ page, limit, sortBy, sortOrder });
          students = result.students;
          total = result.total;
        }
        
        return successResponse({
          students,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } catch (error) {
        console.error('Get students error:', error);
        return errorResponse('Failed to get students', 500);
      }
    }
  );
  
  // 获取单个学生信息
  router.get('/:id', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('students:get'),
    performance.cacheMiddleware(
      (request) => CacheKeyGenerator.student(request.params.id),
      CACHE_STRATEGIES.STUDENTS
    ),
    async (request) => {
      try {
        const { id } = request.params;
        
        if (!id || isNaN(parseInt(id))) {
          return errorResponse('Invalid student ID', 400);
        }
        
        const studentService = new StudentService(env.DB);
        const student = await studentService.getStudentById(parseInt(id));
        
        if (!student) {
          return errorResponse('Student not found', 404);
        }
        
        // 检查权限：学生只能查看自己的信息
        if (request.user.role === 'student' && request.user.id !== student.id) {
          return errorResponse('Access denied', 403);
        }
        
        return successResponse(student);
      } catch (error) {
        console.error('Get student error:', error);
        return errorResponse('Failed to get student', 500);
      }
    }
  );
  
  // 创建新学生（仅教师）
  router.post('/', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        studentId: { required: true, type: 'string', minLength: 1 },
        name: { required: true, type: 'string', minLength: 1 },
        class: { required: true, type: 'string', minLength: 1 },
        points: { required: false, type: 'number', min: 0 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const studentData = {
        studentId: body.studentId,
        name: body.name,
        class: body.class,
        points: body.points || 0
      };
      
      const studentService = new StudentService(env.DB);
      
      // 检查学号是否已存在
      const existingStudent = await studentService.getStudentByStudentId(studentData.studentId);
      if (existingStudent) {
        return errorResponse('Student ID already exists', 409);
      }
      
      const student = await studentService.createStudent(studentData);
      
      return successResponse(student, 201);
    } catch (error) {
      console.error('Create student error:', error);
      return errorResponse('Failed to create student', 500);
    }
  });
  
  // 更新学生信息（仅教师）
  router.put('/:id', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid student ID', 400);
      }
      
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        studentId: { required: false, type: 'string', minLength: 1 },
        name: { required: false, type: 'string', minLength: 1 },
        class: { required: false, type: 'string', minLength: 1 },
        points: { required: false, type: 'number', min: 0 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const studentService = new StudentService(env.DB);
      
      // 检查学生是否存在
      const existingStudent = await studentService.getStudentById(parseInt(id));
      if (!existingStudent) {
        return errorResponse('Student not found', 404);
      }
      
      // 如果更新学号，检查新学号是否已被使用
      if (body.studentId && body.studentId !== existingStudent.studentId) {
        const duplicateStudent = await studentService.getStudentByStudentId(body.studentId);
        if (duplicateStudent) {
          return errorResponse('Student ID already exists', 409);
        }
      }
      
      const updateData = {};
      if (body.studentId !== undefined) updateData.studentId = body.studentId;
      if (body.name !== undefined) updateData.name = body.name;
      if (body.class !== undefined) updateData.class = body.class;
      if (body.points !== undefined) updateData.points = body.points;
      
      const student = await studentService.updateStudent(parseInt(id), updateData);
      
      return successResponse(student);
    } catch (error) {
      console.error('Update student error:', error);
      return errorResponse('Failed to update student', 500);
    }
  });
  
  // 删除学生（仅教师）
  router.delete('/:id', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid student ID', 400);
      }
      
      const studentService = new StudentService(env.DB);
      
      // 检查学生是否存在
      const existingStudent = await studentService.getStudentById(parseInt(id));
      if (!existingStudent) {
        return errorResponse('Student not found', 404);
      }
      
      const success = await studentService.deleteStudent(parseInt(id));
      
      if (!success) {
        return errorResponse('Failed to delete student', 500);
      }
      
      return successResponse({ message: 'Student deleted successfully' });
    } catch (error) {
      console.error('Delete student error:', error);
      return errorResponse('Failed to delete student', 500);
    }
  });
  
  // 获取学生积分记录
  router.get('/:id/points', authenticateToken(env), requireAuth, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid student ID', 400);
      }
      
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = parseInt(url.searchParams.get('limit')) || 20;
      const type = url.searchParams.get('type') || ''; // 'earn' or 'spend'
      const startDate = url.searchParams.get('startDate') || '';
      const endDate = url.searchParams.get('endDate') || '';
      
      const studentService = new StudentService(env.DB);
      const student = await studentService.getStudentById(parseInt(id));
      
      if (!student) {
        return errorResponse('Student not found', 404);
      }
      
      // 检查权限：学生只能查看自己的积分记录
      if (request.user.role === 'student' && request.user.id !== student.id) {
        return errorResponse('Access denied', 403);
      }
      
      const pointsService = new PointsService(env.DB);
      const result = await pointsService.getPointRecordsByStudentId(parseInt(id), {
        page,
        limit,
        type,
        startDate,
        endDate
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
      console.error('Get student points error:', error);
      return errorResponse('Failed to get student points', 500);
    }
  });
  
  // 更新学生积分余额（仅教师）
  router.patch('/:id/points', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid student ID', 400);
      }
      
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        points: { required: true, type: 'number', min: 0 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const studentService = new StudentService(env.DB);
      
      // 检查学生是否存在
      const existingStudent = await studentService.getStudentById(parseInt(id));
      if (!existingStudent) {
        return errorResponse('Student not found', 404);
      }
      
      const success = await studentService.updateStudentPoints(parseInt(id), body.points);
      
      if (!success) {
        return errorResponse('Failed to update student points', 500);
      }
      
      // 获取更新后的学生信息
      const updatedStudent = await studentService.getStudentById(parseInt(id));
      
      return successResponse(updatedStudent);
    } catch (error) {
      console.error('Update student points error:', error);
      return errorResponse('Failed to update student points', 500);
    }
  });
  
  // 获取学生统计信息
  router.get('/stats/overview', authenticateToken(env), requireTeacher,
    performance.monitoringMiddleware('students:stats'),
    performance.cacheMiddleware(
      () => CacheKeyGenerator.studentStats(),
      CACHE_STRATEGIES.STATS
    ),
    async (request) => {
      try {
        const studentService = new StudentService(env.DB);
        const stats = await studentService.getStudentStats();
        
        return successResponse(stats);
      } catch (error) {
        console.error('Get student stats error:', error);
        return errorResponse('Failed to get student stats', 500);
      }
    }
  );
  
  // 批量导入学生（仅教师）
  router.post('/batch-import', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        students: { required: true, type: 'array', minLength: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { students } = body;
      const studentService = new StudentService(env.DB);
      
      // 验证每个学生数据
      const validStudents = [];
      const errors = [];
      
      for (let i = 0; i < students.length; i++) {
        const student = students[i];
        const studentValidation = validateParams(student, {
          studentId: { required: true, type: 'string', minLength: 1 },
          name: { required: true, type: 'string', minLength: 1 },
          class: { required: true, type: 'string', minLength: 1 },
          points: { required: false, type: 'number', min: 0 }
        });
        
        if (!studentValidation.valid) {
          errors.push({ index: i, errors: studentValidation.errors });
        } else {
          // 检查学号是否重复
          const existingStudent = await studentService.getStudentByStudentId(student.studentId);
          if (existingStudent) {
            errors.push({ index: i, errors: ['Student ID already exists'] });
          } else {
            validStudents.push({
              studentId: student.studentId,
              name: student.name,
              class: student.class,
              points: student.points || 0
            });
          }
        }
      }
      
      if (errors.length > 0) {
        return errorResponse('Validation failed for some students', 400, { errors });
      }
      
      // 批量创建学生
      const createdStudents = [];
      for (const studentData of validStudents) {
        try {
          const student = await studentService.createStudent(studentData);
          createdStudents.push(student);
        } catch (error) {
          console.error('Failed to create student:', studentData, error);
        }
      }
      
      return successResponse({
        message: `Successfully imported ${createdStudents.length} students`,
        students: createdStudents
      });
    } catch (error) {
      console.error('Batch import students error:', error);
      return errorResponse('Failed to import students', 500);
    }
  });
  
  return router;
}