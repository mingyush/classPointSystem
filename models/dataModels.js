/**
 * 数据模型定义
 * 定义系统中所有数据结构的接口和验证规则
 */

/**
 * 学生信息模型
 */
class StudentInfo {
    constructor(data = {}) {
        this.id = data.id || '';
        this.name = data.name || '';
        this.class = data.class || '';
        this.balance = data.balance || 0;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    /**
     * 验证学生信息数据
     * @returns {object} 验证结果
     */
    validate() {
        const errors = [];

        if (!this.id || typeof this.id !== 'string') {
            errors.push('学号不能为空且必须为字符串');
        }

        if (!this.name || typeof this.name !== 'string') {
            errors.push('姓名不能为空且必须为字符串');
        }

        if (!this.class || typeof this.class !== 'string') {
            errors.push('班级不能为空且必须为字符串');
        }

        if (typeof this.balance !== 'number') {
            errors.push('积分余额必须为数字');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为JSON对象
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            class: this.class,
            balance: this.balance,
            createdAt: this.createdAt
        };
    }
}

/**
 * 积分记录模型
 */
class PointRecord {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.studentId = data.studentId || '';
        this.semesterId = data.semesterId || null;
        this.points = data.points || 0;
        this.reason = data.reason || '';
        this.operatorId = data.operatorId || '';
        this.timestamp = data.timestamp || new Date().toISOString();
        this.type = data.type || 'add'; // 'add', 'subtract', 'purchase', 'refund'
    }

    /**
     * 生成唯一ID
     * @returns {string}
     */
    generateId() {
        return 'point_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 验证积分记录数据
     * @returns {object} 验证结果
     */
    validate() {
        const errors = [];
        const validTypes = ['add', 'subtract', 'purchase', 'refund'];

        if (!this.studentId || typeof this.studentId !== 'string') {
            errors.push('学生ID不能为空且必须为字符串');
        }

        if (typeof this.points !== 'number' || this.points === 0) {
            errors.push('积分变化必须为非零数字');
        }

        if (!this.reason || typeof this.reason !== 'string') {
            errors.push('操作原因不能为空且必须为字符串');
        }

        if (!validTypes.includes(this.type)) {
            errors.push('操作类型必须为: ' + validTypes.join(', '));
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为JSON对象
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            studentId: this.studentId,
            semesterId: this.semesterId,
            points: this.points,
            reason: this.reason,
            operatorId: this.operatorId,
            timestamp: this.timestamp,
            type: this.type
        };
    }
}

/**
 * 商品信息模型
 */
class Product {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.name = data.name || '';
        this.price = data.price || 0;
        this.stock = data.stock || 0;
        this.description = data.description || '';
        this.imageUrl = data.imageUrl || '';
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    /**
     * 生成唯一ID
     * @returns {string}
     */
    generateId() {
        return 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 验证商品信息数据
     * @returns {object} 验证结果
     */
    validate() {
        const errors = [];

        if (!this.name || typeof this.name !== 'string') {
            errors.push('商品名称不能为空且必须为字符串');
        }

        if (typeof this.price !== 'number' || this.price < 0) {
            errors.push('商品价格必须为非负数字');
        }

        if (typeof this.stock !== 'number' || this.stock < 0) {
            errors.push('商品库存必须为非负数字');
        }

        if (typeof this.isActive !== 'boolean') {
            errors.push('商品状态必须为布尔值');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为JSON对象
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            price: this.price,
            stock: this.stock,
            description: this.description,
            imageUrl: this.imageUrl,
            isActive: this.isActive,
            createdAt: this.createdAt
        };
    }
}

/**
 * 预约订单模型
 */
class Order {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.studentId = data.studentId || '';
        this.semesterId = data.semesterId || null;
        this.productId = data.productId || '';
        this.status = data.status || 'pending'; // 'pending', 'confirmed', 'cancelled'
        this.reservedAt = data.reservedAt || new Date().toISOString();
        this.confirmedAt = data.confirmedAt || null;
        this.cancelledAt = data.cancelledAt || null;
    }

    /**
     * 生成唯一ID
     * @returns {string}
     */
    generateId() {
        return 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 验证订单数据
     * @returns {object} 验证结果
     */
    validate() {
        const errors = [];
        const validStatuses = ['pending', 'confirmed', 'cancelled'];

        if (!this.studentId || typeof this.studentId !== 'string') {
            errors.push('学生ID不能为空且必须为字符串');
        }

        if (!this.productId || typeof this.productId !== 'string') {
            errors.push('商品ID不能为空且必须为字符串');
        }

        if (!validStatuses.includes(this.status)) {
            errors.push('订单状态必须为: ' + validStatuses.join(', '));
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为JSON对象
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            studentId: this.studentId,
            semesterId: this.semesterId,
            productId: this.productId,
            status: this.status,
            reservedAt: this.reservedAt,
            confirmedAt: this.confirmedAt,
            cancelledAt: this.cancelledAt
        };
    }
}

/**
 * 系统配置模型
 */
class SystemConfig {
    constructor(data = {}) {
        this.mode = data.mode || 'normal'; // 'class', 'normal'
        this.autoRefreshInterval = data.autoRefreshInterval || 30;
        this.pointsResetEnabled = data.pointsResetEnabled || false;
        this.maxPointsPerOperation = data.maxPointsPerOperation || 100;
        this.semesterStartDate = data.semesterStartDate || new Date().toISOString();
    }

    /**
     * 验证系统配置数据
     * @returns {object} 验证结果
     */
    validate() {
        const errors = [];
        const validModes = ['class', 'normal'];

        if (!validModes.includes(this.mode)) {
            errors.push('系统模式必须为: ' + validModes.join(', '));
        }

        if (typeof this.autoRefreshInterval !== 'number' || this.autoRefreshInterval < 1) {
            errors.push('自动刷新间隔必须为正数');
        }

        if (typeof this.pointsResetEnabled !== 'boolean') {
            errors.push('积分清零启用状态必须为布尔值');
        }

        if (typeof this.maxPointsPerOperation !== 'number' || this.maxPointsPerOperation < 1) {
            errors.push('单次操作最大积分必须为正数');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为JSON对象
     * @returns {object}
     */
    toJSON() {
        return {
            mode: this.mode,
            autoRefreshInterval: this.autoRefreshInterval,
            pointsResetEnabled: this.pointsResetEnabled,
            maxPointsPerOperation: this.maxPointsPerOperation,
            semesterStartDate: this.semesterStartDate
        };
    }
}

/**
 * 教师信息模型
 */
class Teacher {
    constructor(data = {}) {
        this.id = data.id || '';
        this.name = data.name || '';
        this.password = data.password || '';
        this.role = data.role || 'teacher'; // 'teacher', 'admin'
        this.department = data.department || '';
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    /**
     * 验证教师信息数据
     * @returns {object} 验证结果
     */
    validate() {
        const errors = [];
        const validRoles = ['teacher', 'director', 'admin'];

        if (!this.id || typeof this.id !== 'string') {
            errors.push('教师ID不能为空且必须为字符串');
        }

        if (!this.name || typeof this.name !== 'string') {
            errors.push('教师姓名不能为空且必须为字符串');
        }

        if (!this.password || typeof this.password !== 'string') {
            errors.push('密码不能为空且必须为字符串');
        }

        if (!validRoles.includes(this.role)) {
            errors.push('教师角色必须为: ' + validRoles.join(', '));
        }

        if (typeof this.isActive !== 'boolean') {
            errors.push('教师状态必须为布尔值');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为JSON对象
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            password: this.password,
            role: this.role,
            department: this.department,
            isActive: this.isActive,
            createdAt: this.createdAt
        };
    }

    /**
     * 转换为安全的JSON对象（不包含密码）
     * @returns {object}
     */
    toSafeJSON() {
        const data = this.toJSON();
        delete data.password;
        return data;
    }
}

/**
 * 学期信息模型
 */
class Semester {
    constructor(data = {}) {
        this.id = data.id || '';
        this.name = data.name || '';
        this.startDate = data.startDate || new Date().toISOString();
        this.endDate = data.endDate || new Date().toISOString();
        this.isCurrent = data.isCurrent !== undefined ? data.isCurrent : false;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    validate() {
        const errors = [];

        if (!this.name || typeof this.name !== 'string') {
            errors.push('学期名称不能为空且必须为字符串');
        }

        if (!this.startDate) {
            errors.push('学期开始日期不能为空');
        }

        if (!this.endDate) {
            errors.push('学期结束日期不能为空');
        }

        if (typeof this.isCurrent !== 'boolean') {
            errors.push('当前学期标识必须为布尔值');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            startDate: this.startDate,
            endDate: this.endDate,
            isCurrent: this.isCurrent,
            createdAt: this.createdAt
        };
    }
}

/**
 * 学期归档记录模型
 */
class SemesterArchive {
    constructor(data = {}) {
        this.id = data.id || '';
        this.semesterId = data.semesterId || '';
        this.studentId = data.studentId || '';
        this.finalBalance = data.finalBalance || 0;
        this.finalRank = data.finalRank || 0;
    }

    validate() {
        const errors = [];

        if (!this.semesterId || typeof this.semesterId !== 'string') {
            errors.push('学期ID不能为空且必须为字符串');
        }
        
        if (!this.studentId || typeof this.studentId !== 'string') {
            errors.push('学生ID不能为空且必须为字符串');
        }

        if (typeof this.finalBalance !== 'number') {
            errors.push('最终积分必须为数字');
        }

        if (typeof this.finalRank !== 'number' || this.finalRank <= 0) {
            errors.push('最终排名必须为正整数');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toJSON() {
        return {
            id: this.id,
            semesterId: this.semesterId,
            studentId: this.studentId,
            finalBalance: this.finalBalance,
            finalRank: this.finalRank
        };
    }
}

module.exports = {
    StudentInfo,
    PointRecord,
    Product,
    Order,
    SystemConfig,
    Teacher,
    Semester,
    SemesterArchive
};