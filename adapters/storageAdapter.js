/**
 * 存储适配器接口
 * 
 * 功能：
 * - 定义统一的数据存储接口
 * - 支持MySQL8和SQLite两种存储方案
 * - 提供数据模型的CRUD操作
 * - 确保数据一致性和事务支持
 */

/**
 * 存储适配器基类
 */
class StorageAdapter {
    constructor(config) {
        this.config = config;
        this.isConnected = false;
    }

    /**
     * 连接数据库
     */
    async connect() {
        throw new Error('connect方法必须被子类实现');
    }

    /**
     * 断开连接
     */
    async disconnect() {
        throw new Error('disconnect方法必须被子类实现');
    }

    /**
     * 开始事务
     */
    async beginTransaction() {
        throw new Error('beginTransaction方法必须被子类实现');
    }

    /**
     * 提交事务
     */
    async commitTransaction() {
        throw new Error('commitTransaction方法必须被子类实现');
    }

    /**
     * 回滚事务
     */
    async rollbackTransaction() {
        throw new Error('rollbackTransaction方法必须被子类实现');
    }

    // ==================== 学生管理 ====================
    
    /**
     * 获取学生列表
     */
    async getStudents(classId, filters = {}) {
        throw new Error('getStudents方法必须被子类实现');
    }

    /**
     * 根据ID获取学生
     */
    async getStudentById(classId, studentId) {
        throw new Error('getStudentById方法必须被子类实现');
    }

    /**
     * 根据学号获取学生
     */
    async getStudentByNumber(classId, studentNumber) {
        throw new Error('getStudentByNumber方法必须被子类实现');
    }

    /**
     * 创建学生
     */
    async createStudent(classId, student) {
        throw new Error('createStudent方法必须被子类实现');
    }

    /**
     * 更新学生信息
     */
    async updateStudent(classId, studentId, updates) {
        throw new Error('updateStudent方法必须被子类实现');
    }

    /**
     * 删除学生
     */
    async deleteStudent(classId, studentId) {
        throw new Error('deleteStudent方法必须被子类实现');
    }

    // ==================== 积分管理 ====================
    
    /**
     * 获取积分记录
     */
    async getPointRecords(classId, filters = {}) {
        throw new Error('getPointRecords方法必须被子类实现');
    }

    /**
     * 创建积分记录
     */
    async createPointRecord(classId, record) {
        throw new Error('createPointRecord方法必须被子类实现');
    }

    /**
     * 计算积分余额
     */
    async calculatePointBalance(classId, studentId) {
        throw new Error('calculatePointBalance方法必须被子类实现');
    }

    /**
     * 获取积分排行榜
     */
    async getPointRanking(classId, type = 'total', limit = 50) {
        throw new Error('getPointRanking方法必须被子类实现');
    }

    /**
     * 批量积分操作
     */
    async batchPointOperations(classId, operations) {
        throw new Error('batchPointOperations方法必须被子类实现');
    }

    /**
     * 清零所有学生积分
     */
    async resetAllPoints(classId, teacherId, reason) {
        throw new Error('resetAllPoints方法必须被子类实现');
    }

    // ==================== 商品管理 ====================
    
    /**
     * 获取商品列表
     */
    async getProducts(classId, filters = {}) {
        throw new Error('getProducts方法必须被子类实现');
    }

    /**
     * 根据ID获取商品
     */
    async getProductById(classId, productId) {
        throw new Error('getProductById方法必须被子类实现');
    }

    /**
     * 创建商品
     */
    async createProduct(classId, product) {
        throw new Error('createProduct方法必须被子类实现');
    }

    /**
     * 更新商品信息
     */
    async updateProduct(classId, productId, updates) {
        throw new Error('updateProduct方法必须被子类实现');
    }

    /**
     * 删除商品
     */
    async deleteProduct(classId, productId) {
        throw new Error('deleteProduct方法必须被子类实现');
    }

    /**
     * 更新商品库存
     */
    async updateProductStock(classId, productId, stockChange) {
        throw new Error('updateProductStock方法必须被子类实现');
    }

    // ==================== 预约管理 ====================
    
    /**
     * 获取预约订单
     */
    async getOrders(classId, filters = {}) {
        throw new Error('getOrders方法必须被子类实现');
    }

    /**
     * 根据ID获取订单
     */
    async getOrderById(classId, orderId) {
        throw new Error('getOrderById方法必须被子类实现');
    }

    /**
     * 创建预约订单
     */
    async createOrder(classId, order) {
        throw new Error('createOrder方法必须被子类实现');
    }

    /**
     * 更新订单状态
     */
    async updateOrderStatus(classId, orderId, status, updatedBy) {
        throw new Error('updateOrderStatus方法必须被子类实现');
    }

    /**
     * 取消订单
     */
    async cancelOrder(classId, orderId, reason) {
        throw new Error('cancelOrder方法必须被子类实现');
    }

    // ==================== 奖惩项管理 ====================
    
    /**
     * 获取奖惩项列表
     */
    async getRewardPenaltyItems(classId) {
        throw new Error('getRewardPenaltyItems方法必须被子类实现');
    }

    /**
     * 创建奖惩项
     */
    async createRewardPenaltyItem(classId, item) {
        throw new Error('createRewardPenaltyItem方法必须被子类实现');
    }

    /**
     * 更新奖惩项
     */
    async updateRewardPenaltyItem(classId, itemId, updates) {
        throw new Error('updateRewardPenaltyItem方法必须被子类实现');
    }

    /**
     * 删除奖惩项
     */
    async deleteRewardPenaltyItem(classId, itemId) {
        throw new Error('deleteRewardPenaltyItem方法必须被子类实现');
    }

    // ==================== 用户管理 ====================
    
    /**
     * 获取用户列表
     */
    async getUsers(classId, filters = {}) {
        throw new Error('getUsers方法必须被子类实现');
    }

    /**
     * 根据ID获取用户
     */
    async getUserById(classId, userId) {
        throw new Error('getUserById方法必须被子类实现');
    }

    /**
     * 根据用户名获取用户
     */
    async getUserByUsername(classId, username) {
        throw new Error('getUserByUsername方法必须被子类实现');
    }

    /**
     * 创建用户
     */
    async createUser(classId, user) {
        throw new Error('createUser方法必须被子类实现');
    }

    /**
     * 更新用户信息
     */
    async updateUser(classId, userId, updates) {
        throw new Error('updateUser方法必须被子类实现');
    }

    /**
     * 删除用户
     */
    async deleteUser(classId, userId) {
        throw new Error('deleteUser方法必须被子类实现');
    }

    // ==================== 统计查询 ====================
    
    /**
     * 获取班级统计信息
     */
    async getClassStatistics(classId) {
        throw new Error('getClassStatistics方法必须被子类实现');
    }

    /**
     * 获取学生积分统计
     */
    async getStudentPointStatistics(classId, studentId, dateRange = {}) {
        throw new Error('getStudentPointStatistics方法必须被子类实现');
    }

    /**
     * 获取商品销售统计
     */
    async getProductSalesStatistics(classId, dateRange = {}) {
        throw new Error('getProductSalesStatistics方法必须被子类实现');
    }

    // ==================== 系统状态管理 ====================
    
    /**
     * 获取系统状态
     */
    async getSystemState(classId = 'default') {
        throw new Error('getSystemState方法必须被子类实现');
    }

    /**
     * 更新系统状态
     */
    async updateSystemState(classId = 'default', updates) {
        throw new Error('updateSystemState方法必须被子类实现');
    }

    /**
     * 创建系统状态
     */
    async createSystemState(classId = 'default', state) {
        throw new Error('createSystemState方法必须被子类实现');
    }

    // ==================== 数据备份和恢复 ====================
    
    /**
     * 导出班级数据
     */
    async exportClassData(classId) {
        throw new Error('exportClassData方法必须被子类实现');
    }

    /**
     * 导入班级数据
     */
    async importClassData(classId, data) {
        throw new Error('importClassData方法必须被子类实现');
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        throw new Error('healthCheck方法必须被子类实现');
    }
}

/**
 * 数据过滤器接口
 */
class DataFilter {
    constructor() {
        this.conditions = [];
        this.orderBy = [];
        this.limit = null;
        this.offset = null;
    }

    where(field, operator, value) {
        this.conditions.push({ field, operator, value });
        return this;
    }

    orderBy(field, direction = 'ASC') {
        this.orderBy.push({ field, direction });
        return this;
    }

    limit(count) {
        this.limit = count;
        return this;
    }

    offset(count) {
        this.offset = count;
        return this;
    }

    build() {
        return {
            conditions: this.conditions,
            orderBy: this.orderBy,
            limit: this.limit,
            offset: this.offset
        };
    }
}

/**
 * 积分过滤器
 */
class PointFilter extends DataFilter {
    constructor() {
        super();
    }

    byStudent(studentId) {
        return this.where('student_id', '=', studentId);
    }

    byTeacher(teacherId) {
        return this.where('teacher_id', '=', teacherId);
    }

    byType(type) {
        return this.where('type', '=', type);
    }

    byDateRange(startDate, endDate) {
        this.where('created_at', '>=', startDate);
        this.where('created_at', '<=', endDate);
        return this;
    }

    byAmountRange(minAmount, maxAmount) {
        if (minAmount !== undefined) {
            this.where('amount', '>=', minAmount);
        }
        if (maxAmount !== undefined) {
            this.where('amount', '<=', maxAmount);
        }
        return this;
    }
}

/**
 * 订单过滤器
 */
class OrderFilter extends DataFilter {
    constructor() {
        super();
    }

    byStudent(studentId) {
        return this.where('student_id', '=', studentId);
    }

    byProduct(productId) {
        return this.where('product_id', '=', productId);
    }

    byStatus(status) {
        return this.where('status', '=', status);
    }

    byDateRange(startDate, endDate) {
        this.where('created_at', '>=', startDate);
        this.where('created_at', '<=', endDate);
        return this;
    }

    pending() {
        return this.byStatus('pending');
    }

    confirmed() {
        return this.byStatus('confirmed');
    }

    completed() {
        return this.byStatus('completed');
    }

    cancelled() {
        return this.byStatus('cancelled');
    }
}

module.exports = {
    StorageAdapter,
    DataFilter,
    PointFilter,
    OrderFilter
};