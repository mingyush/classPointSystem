const request = require('supertest');
const express = require('express');
const {
    ValidationRules,
    validateField,
    validateObject,
    createValidator,
    Validators,
    CustomValidators
} = require('../middleware/validation');
const { errorHandler } = require('../middleware/errorHandler');

describe('验证中间件测试', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    describe('validateField函数', () => {
        test('应该验证必填字段', () => {
            const rule = { required: true, type: 'string' };
            
            // 测试空值
            const emptyResult = validateField('', rule, '测试字段');
            expect(emptyResult).toEqual(['测试字段不能为空']);

            // 测试null值
            const nullResult = validateField(null, rule, '测试字段');
            expect(nullResult).toEqual(['测试字段不能为空']);

            // 测试undefined值
            const undefinedResult = validateField(undefined, rule, '测试字段');
            expect(undefinedResult).toEqual(['测试字段不能为空']);

            // 测试有效值
            const validResult = validateField('test', rule, '测试字段');
            expect(validResult.errors).toEqual([]);
            expect(validResult.value).toBe('test');
        });

        test('应该处理默认值', () => {
            const rule = { required: false, type: 'number', default: 10 };
            
            const result = validateField(undefined, rule, '测试字段');
            expect(result.value).toBe(10);
            expect(result.errors).toEqual([]);
        });

        test('应该验证数字类型', () => {
            const rule = { required: true, type: 'number', min: 1, max: 100 };
            
            // 测试字符串数字转换
            const stringResult = validateField('50', rule, '数字字段');
            expect(stringResult.value).toBe(50);
            expect(stringResult.errors).toEqual([]);

            // 测试无效数字
            const invalidResult = validateField('abc', rule, '数字字段');
            expect(invalidResult).toEqual(['数字字段必须为数字']);

            // 测试范围验证
            const tooSmallResult = validateField(0, rule, '数字字段');
            expect(tooSmallResult.errors).toContain('数字字段不能小于1');

            const tooBigResult = validateField(101, rule, '数字字段');
            expect(tooBigResult.errors).toContain('数字字段不能大于100');
        });

        test('应该验证字符串长度', () => {
            const rule = { required: true, type: 'string', minLength: 2, maxLength: 10 };
            
            // 测试长度过短
            const tooShortResult = validateField('a', rule, '字符串字段');
            expect(tooShortResult.errors).toContain('字符串字段长度不能少于2个字符');

            // 测试长度过长
            const tooLongResult = validateField('abcdefghijk', rule, '字符串字段');
            expect(tooLongResult.errors).toContain('字符串字段长度不能超过10个字符');

            // 测试有效长度
            const validResult = validateField('abc', rule, '字符串字段');
            expect(validResult.errors).toEqual([]);
        });

        test('应该验证枚举值', () => {
            const rule = { required: true, type: 'string', enum: ['option1', 'option2', 'option3'] };
            
            // 测试无效枚举值
            const invalidResult = validateField('invalid', rule, '枚举字段');
            expect(invalidResult.errors).toContain('枚举字段必须为以下值之一: option1, option2, option3');

            // 测试有效枚举值
            const validResult = validateField('option1', rule, '枚举字段');
            expect(validResult.errors).toEqual([]);
        });

        test('应该验证正则表达式', () => {
            const rule = { 
                required: true, 
                type: 'string', 
                pattern: /^[a-zA-Z0-9]+$/, 
                message: '只能包含字母和数字' 
            };
            
            // 测试无效格式
            const invalidResult = validateField('test@123', rule, '格式字段');
            expect(invalidResult.errors).toContain('只能包含字母和数字');

            // 测试有效格式
            const validResult = validateField('test123', rule, '格式字段');
            expect(validResult.errors).toEqual([]);
        });
    });

    describe('validateObject函数', () => {
        test('应该验证整个对象', () => {
            const schema = {
                name: { required: true, type: 'string', minLength: 2 },
                age: { required: true, type: 'number', min: 0, max: 150 },
                email: { required: false, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }
            };

            const data = {
                name: 'John',
                age: '25',
                email: 'john@example.com'
            };

            const result = validateObject(data, schema);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.data).toEqual({
                name: 'John',
                age: 25,
                email: 'john@example.com'
            });
        });

        test('应该收集所有验证错误', () => {
            const schema = {
                name: { required: true, type: 'string', minLength: 2 },
                age: { required: true, type: 'number', min: 0, max: 150 }
            };

            const data = {
                name: 'J',
                age: -5
            };

            const result = validateObject(data, schema);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('name长度不能少于2个字符');
            expect(result.errors).toContain('age不能小于0');
        });
    });

    describe('createValidator中间件', () => {
        test('应该创建验证中间件', async () => {
            const validator = createValidator({
                name: { required: true, type: 'string', minLength: 2 }
            });

            app.post('/test', validator, (req, res) => {
                res.json({ success: true, validated: req.validated.body });
            });

            app.use(errorHandler);

            // 测试有效数据
            await request(app)
                .post('/test')
                .send({ name: 'John' })
                .expect(200)
                .expect(res => {
                    expect(res.body.validated.name).toBe('John');
                });

            // 测试无效数据
            await request(app)
                .post('/test')
                .send({ name: 'J' })
                .expect(400)
                .expect(res => {
                    expect(res.body.code).toBe('VALIDATION_ERROR');
                    expect(res.body.details.errors).toContain('name长度不能少于2个字符');
                });
        });

        test('应该验证查询参数', async () => {
            const validator = createValidator({
                limit: { required: false, type: 'number', min: 1, max: 100, default: 20 }
            }, 'query');

            app.get('/test', validator, (req, res) => {
                res.json({ success: true, validated: req.validated.query });
            });

            app.use(errorHandler);

            // 测试默认值
            await request(app)
                .get('/test')
                .expect(200)
                .expect(res => {
                    expect(res.body.validated.limit).toBe(20);
                });

            // 测试有效参数
            await request(app)
                .get('/test?limit=50')
                .expect(200)
                .expect(res => {
                    expect(res.body.validated.limit).toBe(50);
                });

            // 测试无效参数
            await request(app)
                .get('/test?limit=200')
                .expect(400);
        });
    });

    describe('预定义验证器', () => {
        test('学生登录验证器', async () => {
            app.post('/student-login', Validators.studentLogin, (req, res) => {
                res.json({ success: true });
            });
            app.use(errorHandler);

            // 测试有效学号
            await request(app)
                .post('/student-login')
                .send({ studentId: 'student123' })
                .expect(200);

            // 测试无效学号
            await request(app)
                .post('/student-login')
                .send({ studentId: '' })
                .expect(400);

            // 测试特殊字符学号
            await request(app)
                .post('/student-login')
                .send({ studentId: 'student@123' })
                .expect(400);
        });

        test('教师登录验证器', async () => {
            app.post('/teacher-login', Validators.teacherLogin, (req, res) => {
                res.json({ success: true });
            });
            app.use(errorHandler);

            // 测试有效登录
            await request(app)
                .post('/teacher-login')
                .send({ teacherId: 'teacher1', password: 'password123' })
                .expect(200);

            // 测试缺少密码
            await request(app)
                .post('/teacher-login')
                .send({ teacherId: 'teacher1' })
                .expect(400);

            // 测试密码过短
            await request(app)
                .post('/teacher-login')
                .send({ teacherId: 'teacher1', password: '123' })
                .expect(400);
        });

        test('积分操作验证器', async () => {
            app.post('/points', Validators.pointsOperation, (req, res) => {
                res.json({ success: true });
            });
            app.use(errorHandler);

            // 测试有效积分操作
            await request(app)
                .post('/points')
                .send({ 
                    studentId: 'student123', 
                    points: 10, 
                    reason: '课堂表现优秀' 
                })
                .expect(200);

            // 测试负积分
            await request(app)
                .post('/points')
                .send({ 
                    studentId: 'student123', 
                    points: -5, 
                    reason: '迟到' 
                })
                .expect(400);

            // 测试积分过大
            await request(app)
                .post('/points')
                .send({ 
                    studentId: 'student123', 
                    points: 200, 
                    reason: '测试' 
                })
                .expect(400);
        });

        test('批量操作验证器', async () => {
            app.post('/batch', Validators.batchOperations, (req, res) => {
                res.json({ success: true });
            });
            app.use(errorHandler);

            // 测试有效批量操作
            await request(app)
                .post('/batch')
                .send({
                    operations: [
                        { studentId: 'student1', points: 10, reason: '测试1' },
                        { studentId: 'student2', points: -5, reason: '测试2' }
                    ]
                })
                .expect(200);

            // 测试空操作列表
            await request(app)
                .post('/batch')
                .send({ operations: [] })
                .expect(400);

            // 测试非数组操作
            await request(app)
                .post('/batch')
                .send({ operations: 'invalid' })
                .expect(400);

            // 测试操作过多
            const tooManyOperations = Array(51).fill().map((_, i) => ({
                studentId: `student${i}`,
                points: 1,
                reason: '测试'
            }));

            await request(app)
                .post('/batch')
                .send({ operations: tooManyOperations })
                .expect(400);
        });
    });

    describe('自定义验证函数', () => {
        test('日期范围验证', () => {
            // 测试有效日期范围
            const validRange = CustomValidators.validateDateRange('2024-01-01', '2024-01-31');
            expect(validRange.start).toBeInstanceOf(Date);
            expect(validRange.end).toBeInstanceOf(Date);
            expect(validRange.start < validRange.end).toBe(true);

            // 测试无效日期格式
            expect(() => {
                CustomValidators.validateDateRange('invalid-date', '2024-01-31');
            }).toThrow('日期格式无效');

            // 测试开始时间晚于结束时间
            expect(() => {
                CustomValidators.validateDateRange('2024-01-31', '2024-01-01');
            }).toThrow('开始时间必须早于结束时间');

            // 测试日期范围过大
            expect(() => {
                CustomValidators.validateDateRange('2020-01-01', '2025-01-01');
            }).toThrow('日期范围不能超过1年');
        });

        test('积分操作权限验证', () => {
            const studentUser = { userType: 'student', userId: 'student123' };
            const teacherUser = { userType: 'teacher', userId: 'teacher1' };

            // 学生操作自己的积分应该通过
            expect(() => {
                CustomValidators.validatePointsOperationPermission(studentUser, 'student123');
            }).not.toThrow();

            // 学生操作他人积分应该失败
            expect(() => {
                CustomValidators.validatePointsOperationPermission(studentUser, 'student456');
            }).toThrow('学生只能操作自己的积分');

            // 教师操作任何学生积分应该通过
            expect(() => {
                CustomValidators.validatePointsOperationPermission(teacherUser, 'student123');
            }).not.toThrow();
        });

        test('文件上传验证', () => {
            const validFile = {
                mimetype: 'image/jpeg',
                size: 1024 * 1024 // 1MB
            };

            const invalidTypeFile = {
                mimetype: 'application/exe',
                size: 1024
            };

            const oversizeFile = {
                mimetype: 'image/jpeg',
                size: 10 * 1024 * 1024 // 10MB
            };

            // 测试有效文件
            expect(() => {
                CustomValidators.validateFileUpload(
                    validFile, 
                    ['image/jpeg', 'image/png'], 
                    5 * 1024 * 1024
                );
            }).not.toThrow();

            // 测试无效文件类型
            expect(() => {
                CustomValidators.validateFileUpload(
                    invalidTypeFile, 
                    ['image/jpeg', 'image/png']
                );
            }).toThrow('文件类型必须为: image/jpeg, image/png');

            // 测试文件过大
            expect(() => {
                CustomValidators.validateFileUpload(
                    oversizeFile, 
                    ['image/jpeg'], 
                    5 * 1024 * 1024
                );
            }).toThrow('文件大小不能超过5MB');

            // 测试空文件
            expect(() => {
                CustomValidators.validateFileUpload(null);
            }).toThrow('文件不能为空');
        });
    });

    describe('ValidationRules定义', () => {
        test('应该包含所有必要的验证规则', () => {
            expect(ValidationRules).toHaveProperty('studentId');
            expect(ValidationRules).toHaveProperty('points');
            expect(ValidationRules).toHaveProperty('reason');
            expect(ValidationRules).toHaveProperty('productName');
            expect(ValidationRules).toHaveProperty('systemMode');

            // 验证学号规则
            expect(ValidationRules.studentId).toMatchObject({
                required: true,
                type: 'string',
                minLength: 1,
                maxLength: 20,
                pattern: /^[a-zA-Z0-9]+$/
            });

            // 验证积分规则
            expect(ValidationRules.points).toMatchObject({
                required: true,
                type: 'number',
                min: -1000,
                max: 1000
            });
        });

        test('验证规则应该有合理的限制', () => {
            // 学号长度限制
            expect(ValidationRules.studentId.maxLength).toBeLessThanOrEqual(20);
            
            // 积分范围限制
            expect(ValidationRules.points.min).toBeGreaterThanOrEqual(-1000);
            expect(ValidationRules.points.max).toBeLessThanOrEqual(1000);
            
            // 原因长度限制
            expect(ValidationRules.reason.maxLength).toBeLessThanOrEqual(200);
            
            // 商品价格限制
            expect(ValidationRules.productPrice.max).toBeLessThanOrEqual(10000);
        });
    });

    describe('集成测试', () => {
        test('应该正确处理复杂验证场景', async () => {
            // 创建一个复杂的验证场景
            const complexValidator = createValidator({
                user: {
                    required: true,
                    type: 'string',
                    pattern: /^[a-zA-Z0-9]+$/,
                    minLength: 3,
                    maxLength: 20
                },
                score: {
                    required: true,
                    type: 'number',
                    min: 0,
                    max: 100
                },
                category: {
                    required: true,
                    type: 'string',
                    enum: ['homework', 'exam', 'participation']
                },
                comment: {
                    required: false,
                    type: 'string',
                    maxLength: 500,
                    default: ''
                }
            });

            app.post('/complex', complexValidator, (req, res) => {
                res.json({ 
                    success: true, 
                    data: req.validated.body 
                });
            });

            app.use(errorHandler);

            // 测试完全有效的数据
            await request(app)
                .post('/complex')
                .send({
                    user: 'student123',
                    score: 85,
                    category: 'exam',
                    comment: '表现优秀'
                })
                .expect(200)
                .expect(res => {
                    expect(res.body.data).toMatchObject({
                        user: 'student123',
                        score: 85,
                        category: 'exam',
                        comment: '表现优秀'
                    });
                });

            // 测试使用默认值
            await request(app)
                .post('/complex')
                .send({
                    user: 'student123',
                    score: 85,
                    category: 'exam'
                })
                .expect(200)
                .expect(res => {
                    expect(res.body.data.comment).toBe('');
                });

            // 测试多个验证错误
            await request(app)
                .post('/complex')
                .send({
                    user: 'ab',  // 太短
                    score: 150,  // 超出范围
                    category: 'invalid',  // 无效枚举值
                    comment: 'a'.repeat(501)  // 太长
                })
                .expect(400)
                .expect(res => {
                    expect(res.body.details.errors).toContain('user长度不能少于3个字符');
                    expect(res.body.details.errors).toContain('score不能大于100');
                    expect(res.body.details.errors).toContain('category必须为以下值之一: homework, exam, participation');
                    expect(res.body.details.errors).toContain('comment长度不能超过500个字符');
                });
        });
    });
});