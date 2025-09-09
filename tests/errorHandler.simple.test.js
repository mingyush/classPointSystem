const request = require('supertest');
const express = require('express');
const { 
    AppError, 
    createError, 
    errorHandler, 
    notFoundHandler, 
    asyncHandler,
    ErrorTypes
} = require('../middleware/errorHandler');

describe('错误处理中间件 - 简化测试', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    describe('AppError类', () => {
        test('应该正确创建应用错误', () => {
            const error = new AppError('测试错误', 400, 'TEST_ERROR');
            
            expect(error.message).toBe('测试错误');
            expect(error.statusCode).toBe(400);
            expect(error.code).toBe('TEST_ERROR');
            expect(error.isOperational).toBe(true);
        });
    });

    describe('createError函数', () => {
        test('应该根据错误类型创建错误', () => {
            const error = createError('STUDENT_NOT_FOUND', '学生不存在');
            
            expect(error.message).toBe('学生不存在');
            expect(error.statusCode).toBe(404);
            expect(error.code).toBe('STUDENT_NOT_FOUND');
        });

        test('应该抛出未知错误类型异常', () => {
            expect(() => {
                createError('UNKNOWN_ERROR_TYPE', '未知错误');
            }).toThrow('未知错误类型: UNKNOWN_ERROR_TYPE');
        });
    });

    describe('errorHandler中间件', () => {
        beforeEach(() => {
            app.use('/test-operational', (req, res, next) => {
                const error = createError('STUDENT_NOT_FOUND', '学生不存在');
                next(error);
            });

            app.use('/test-unknown', (req, res, next) => {
                const error = new Error('未知错误');
                next(error);
            });

            app.use(errorHandler);
        });

        test('应该处理操作性错误', async () => {
            const response = await request(app)
                .get('/test-operational')
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: '学生不存在',
                code: 'STUDENT_NOT_FOUND'
            });
        });

        test('应该处理未知错误', async () => {
            const response = await request(app)
                .get('/test-unknown')
                .expect(500);

            expect(response.body).toMatchObject({
                success: false,
                message: '服务器内部错误',
                code: 'INTERNAL_ERROR'
            });
        });
    });

    describe('notFoundHandler中间件', () => {
        beforeEach(() => {
            app.use(notFoundHandler);
        });

        test('应该处理404错误', async () => {
            const response = await request(app)
                .get('/nonexistent-route')
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: '请求的资源不存在',
                code: 'RESOURCE_NOT_FOUND'
            });
        });
    });

    describe('asyncHandler包装器', () => {
        beforeEach(() => {
            app.get('/test-async-success', asyncHandler(async (req, res) => {
                res.json({ success: true });
            }));

            app.get('/test-async-error', asyncHandler(async (req, res) => {
                throw createError('STUDENT_NOT_FOUND', '学生不存在');
            }));

            app.use(errorHandler);
        });

        test('应该处理异步成功响应', async () => {
            const response = await request(app)
                .get('/test-async-success')
                .expect(200);

            expect(response.body).toEqual({ success: true });
        });

        test('应该捕获异步错误', async () => {
            const response = await request(app)
                .get('/test-async-error')
                .expect(404);

            expect(response.body).toMatchObject({
                success: false,
                message: '学生不存在',
                code: 'STUDENT_NOT_FOUND'
            });
        });
    });

    describe('错误类型定义', () => {
        test('应该包含所有必要的错误类型', () => {
            expect(ErrorTypes).toHaveProperty('VALIDATION_ERROR');
            expect(ErrorTypes).toHaveProperty('STUDENT_NOT_FOUND');
            expect(ErrorTypes).toHaveProperty('PERMISSION_DENIED');
            expect(ErrorTypes).toHaveProperty('INTERNAL_ERROR');
            expect(ErrorTypes).toHaveProperty('TOO_MANY_REQUESTS');
        });

        test('应该有正确的状态码', () => {
            expect(ErrorTypes.VALIDATION_ERROR.statusCode).toBe(400);
            expect(ErrorTypes.TOKEN_MISSING.statusCode).toBe(401);
            expect(ErrorTypes.PERMISSION_DENIED.statusCode).toBe(403);
            expect(ErrorTypes.STUDENT_NOT_FOUND.statusCode).toBe(404);
            expect(ErrorTypes.TOO_MANY_REQUESTS.statusCode).toBe(429);
            expect(ErrorTypes.INTERNAL_ERROR.statusCode).toBe(500);
        });
    });
});