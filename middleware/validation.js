const { createError } = require('./errorHandler');

/**
 * 通用验证规则
 */
const ValidationRules = {
    // 学号验证
    studentId: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9]+$/,
        message: '学号必须为1-20位的字母或数字'
    },

    // 积分验证
    points: {
        required: true,
        type: 'number',
        min: -1000,
        max: 1000,
        message: '积分必须为-1000到1000之间的数字'
    },

    // 正积分验证（用于加分操作）
    positivePoints: {
        required: true,
        type: 'number',
        min: 0.01,
        max: 100,
        message: '积分必须为0.01到100之间的正数'
    },

    // 原因验证
    reason: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 200,
        message: '原因必须为1-200个字符'
    },

    // 限制数量验证
    limit: {
        required: false,
        type: 'number',
        min: 1,
        max: 100,
        default: 20,
        message: '限制数量必须为1-100之间的数字'
    },

    // 商品名称验证
    productName: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100,
        message: '商品名称必须为1-100个字符'
    },

    // 商品价格验证
    productPrice: {
        required: true,
        type: 'number',
        min: 1,
        max: 10000,
        message: '商品价格必须为1-10000之间的数字'
    },

    // 库存验证
    stock: {
        required: true,
        type: 'number',
        min: 0,
        max: 99999,
        message: '库存必须为0-99999之间的数字'
    },

    // 日期验证
    date: {
        required: true,
        type: 'string',
        pattern: /^\d{4}-\d{2}-\d{2}$/,
        message: '日期格式必须为YYYY-MM-DD'
    },

    // 教师ID验证
    teacherId: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 50,
        message: '教师ID必须为1-50个字符'
    },

    // 密码验证
    password: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 100,
        message: '密码必须为6-100个字符'
    },

    // 系统模式验证
    systemMode: {
        required: true,
        type: 'string',
        enum: ['class', 'normal'],
        message: '系统模式必须为class或normal'
    },

    // 排行榜类型验证
    rankingType: {
        required: false,
        type: 'string',
        enum: ['total', 'daily', 'weekly'],
        default: 'total',
        message: '排行榜类型必须为total、daily或weekly',
        errorCode: 'INVALID_RANKING_TYPE'
    },

    // 订单状态验证
    orderStatus: {
        required: false,
        type: 'string',
        enum: ['pending', 'confirmed', 'cancelled'],
        message: '订单状态必须为pending、confirmed或cancelled'
    }
};

/**
 * 验证单个字段
 */
function validateField(value, rule, fieldName) {
    const errors = [];

    // 检查必填项
    if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${fieldName}不能为空`);
        return errors;
    }

    // 如果不是必填且值为空，使用默认值
    if (!rule.required && (value === undefined || value === null || value === '')) {
        return { value: rule.default, errors: [] };
    }

    let processedValue = value;

    // 类型验证和转换
    if (rule.type === 'number') {
        if (typeof value === 'string') {
            processedValue = parseFloat(value);
        }
        if (typeof processedValue !== 'number' || isNaN(processedValue)) {
            errors.push(`${fieldName}必须为数字`);
            return errors;
        }
    } else if (rule.type === 'string') {
        if (typeof value !== 'string') {
            processedValue = String(value);
        }
        processedValue = processedValue.trim();
    } else if (rule.type === 'boolean') {
        if (typeof value === 'string') {
            processedValue = value.toLowerCase() === 'true';
        } else {
            processedValue = Boolean(value);
        }
    }

    // 长度验证
    if (rule.minLength !== undefined && processedValue.length < rule.minLength) {
        errors.push(`${fieldName}长度不能少于${rule.minLength}个字符`);
    }
    if (rule.maxLength !== undefined && processedValue.length > rule.maxLength) {
        errors.push(`${fieldName}长度不能超过${rule.maxLength}个字符`);
    }

    // 数值范围验证
    if (rule.min !== undefined && processedValue < rule.min) {
        errors.push(`${fieldName}不能小于${rule.min}`);
    }
    if (rule.max !== undefined && processedValue > rule.max) {
        errors.push(`${fieldName}不能大于${rule.max}`);
    }

    // 枚举值验证
    if (rule.enum && !rule.enum.includes(processedValue)) {
        const errorMessage = rule.message || `${fieldName}必须为以下值之一: ${rule.enum.join(', ')}`;
        if (rule.errorCode) {
            // 如果有自定义错误码，抛出特定错误
            const { createError } = require('./errorHandler');
            throw createError(rule.errorCode, errorMessage);
        }
        errors.push(errorMessage);
    }

    // 正则表达式验证
    if (rule.pattern && !rule.pattern.test(processedValue)) {
        errors.push(rule.message || `${fieldName}格式不正确`);
    }

    return { value: processedValue, errors };
}

/**
 * 验证对象
 */
function validateObject(data, schema) {
    const result = {
        isValid: true,
        errors: [],
        data: {}
    };

    // 验证每个字段
    for (const [fieldName, rule] of Object.entries(schema)) {
        const fieldResult = validateField(data[fieldName], rule, fieldName);
        
        if (Array.isArray(fieldResult)) {
            // 只有错误信息
            result.errors.push(...fieldResult);
            result.isValid = false;
        } else {
            // 有处理后的值和错误信息
            if (fieldResult.errors.length > 0) {
                result.errors.push(...fieldResult.errors);
                result.isValid = false;
            }
            if (fieldResult.value !== undefined) {
                result.data[fieldName] = fieldResult.value;
            }
        }
    }

    return result;
}

/**
 * 创建验证中间件
 */
function createValidator(schema, source = 'body') {
    return (req, res, next) => {
        const data = source === 'body' ? req.body : 
                    source === 'query' ? req.query :
                    source === 'params' ? req.params : req[source];

        const validation = validateObject(data, schema);

        if (!validation.isValid) {
            const error = createError(
                'VALIDATION_ERROR',
                '请求参数验证失败',
                {
                    errors: validation.errors,
                    invalidFields: Object.keys(schema).filter(field => 
                        validation.errors.some(error => error.includes(field))
                    )
                }
            );
            return next(error);
        }

        // 将验证后的数据添加到请求对象
        req.validated = req.validated || {};
        req.validated[source] = validation.data;

        next();
    };
}

/**
 * 预定义的验证器
 */
const Validators = {
    // 学生登录验证
    studentLogin: createValidator({
        studentId: ValidationRules.studentId
    }),

    // 教师登录验证
    teacherLogin: createValidator({
        teacherId: ValidationRules.teacherId,
        password: ValidationRules.password
    }),

    // 积分操作验证
    pointsOperation: createValidator({
        studentId: ValidationRules.studentId,
        points: ValidationRules.positivePoints,
        reason: ValidationRules.reason
    }),

    // 积分查询验证
    pointsQuery: createValidator({
        type: ValidationRules.rankingType,
        limit: ValidationRules.limit
    }, 'query'),

    // 学生ID参数验证
    studentIdParam: createValidator({
        studentId: ValidationRules.studentId
    }, 'params'),

    // 商品创建验证
    productCreate: createValidator({
        name: ValidationRules.productName,
        price: ValidationRules.productPrice,
        stock: ValidationRules.stock
    }),

    // 商品更新验证
    productUpdate: createValidator({
        name: { ...ValidationRules.productName, required: false },
        price: { ...ValidationRules.productPrice, required: false },
        stock: { ...ValidationRules.stock, required: false }
    }),

    // 订单创建验证
    orderCreate: createValidator({
        studentId: ValidationRules.studentId,
        productId: ValidationRules.studentId // 复用学号规则
    }),

    // 系统配置验证
    systemConfig: createValidator({
        mode: ValidationRules.systemMode
    }),

    // 日期范围验证
    dateRange: createValidator({
        startDate: ValidationRules.date,
        endDate: ValidationRules.date,
        studentId: { ...ValidationRules.studentId, required: false }
    }, 'query'),

    // 批量操作验证
    batchOperations: (req, res, next) => {
        const { operations } = req.body;

        if (!Array.isArray(operations)) {
            const error = createError('VALIDATION_ERROR', '操作列表必须为数组');
            return next(error);
        }

        if (operations.length === 0) {
            const error = createError('VALIDATION_ERROR', '操作列表不能为空');
            return next(error);
        }

        if (operations.length > 50) {
            const error = createError('VALIDATION_ERROR', '批量操作不能超过50个');
            return next(error);
        }

        const errors = [];
        const validatedOperations = [];

        operations.forEach((op, index) => {
            const validation = validateObject(op, {
                studentId: ValidationRules.studentId,
                points: ValidationRules.points,
                reason: ValidationRules.reason
            });

            if (!validation.isValid) {
                errors.push(`操作${index + 1}: ${validation.errors.join(', ')}`);
            } else {
                validatedOperations.push(validation.data);
            }
        });

        if (errors.length > 0) {
            const error = createError(
                'VALIDATION_ERROR',
                '批量操作验证失败',
                { errors }
            );
            return next(error);
        }

        req.validated = req.validated || {};
        req.validated.body = { operations: validatedOperations };
        next();
    }
};

/**
 * 自定义验证函数
 */
const CustomValidators = {
    // 验证日期范围
    validateDateRange: (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw createError('VALIDATION_ERROR', '日期格式无效');
        }

        if (start >= end) {
            throw createError('VALIDATION_ERROR', '开始时间必须早于结束时间');
        }

        const maxRange = 365 * 24 * 60 * 60 * 1000; // 最大1年
        if (end - start > maxRange) {
            throw createError('VALIDATION_ERROR', '日期范围不能超过1年');
        }

        return { start, end };
    },

    // 验证积分操作权限
    validatePointsOperationPermission: (user, studentId) => {
        if (user.userType === 'student' && user.userId !== studentId) {
            throw createError('PERMISSION_DENIED', '学生只能操作自己的积分');
        }
    },

    // 验证文件上传
    validateFileUpload: (file, allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
        if (!file) {
            throw createError('VALIDATION_ERROR', '文件不能为空');
        }

        if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
            throw createError('VALIDATION_ERROR', `文件类型必须为: ${allowedTypes.join(', ')}`);
        }

        if (file.size > maxSize) {
            throw createError('VALIDATION_ERROR', `文件大小不能超过${Math.round(maxSize / 1024 / 1024)}MB`);
        }

        return true;
    }
};

module.exports = {
    ValidationRules,
    validateField,
    validateObject,
    createValidator,
    Validators,
    CustomValidators
};