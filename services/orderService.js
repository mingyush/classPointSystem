const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');
const { Order } = require('../models/dataModels');
const StudentService = require('./studentService');
const ProductService = require('./productService');

/**
 * 订单服务类 - V1版本
 * 处理预约订单相关的业务逻辑
 * 适配新的数据库存储接口
 */
class OrderService {
    constructor(classId = 'default') {
        this.classId = classId; // 单班级ID，默认为'default'
        this.adapter = null;
        this.studentService = new StudentService(classId);
        this.productService = new ProductService(classId);
    }

    /**
     * 获取存储适配器
     */
    async getAdapter() {
        if (!this.adapter) {
            this.adapter = await storageAdapterFactory.getDefaultAdapter();
        }
        return this.adapter;
    }

    /**
     * 获取所有订单
     * @param {string} status - 订单状态筛选 ('pending', 'confirmed', 'cancelled')
     * @returns {Promise<Order[]>}
     */
    async getAllOrders(status = null) {
        try {
            const adapter = await this.getAdapter();
            const filters = {};
            if (status) {
                filters.status = status;
            }
            
            const orders = await adapter.getOrders(this.classId, filters);
            return orders.map(order => new Order(order));
        } catch (error) {
            console.error('获取订单列表失败:', error);
            throw new Error('获取订单列表失败');
        }
    }

    /**
     * 根据ID获取订单
     * @param {string} orderId - 订单ID
     * @returns {Promise<Order|null>}
     */
    async getOrderById(orderId) {
        try {
            const adapter = await this.getAdapter();
            const order = await adapter.getOrderById(this.classId, orderId);
            
            return order ? new Order(order) : null;
        } catch (error) {
            console.error('获取订单失败:', error);
            throw new Error('获取订单失败');
        }
    }

    /**
     * 根据学生ID获取订单
     * @param {string} studentId - 学生ID
     * @param {string} status - 订单状态筛选
     * @returns {Promise<Order[]>}
     */
    async getOrdersByStudentId(studentId, status = null) {
        try {
            const adapter = await this.getAdapter();
            const filters = { studentId };
            if (status) {
                filters.status = status;
            }
            
            const orders = await adapter.getOrders(this.classId, filters);
            return orders.map(order => new Order(order));
        } catch (error) {
            console.error('获取学生订单失败:', error);
            throw new Error('获取学生订单失败');
        }
    }

    /**
     * 创建预约订单
     * @param {string} studentId - 学生ID
     * @param {string} productId - 商品ID
     * @returns {Promise<Order>}
     */
    async createReservation(studentId, productId) {
        try {
            // 验证学生是否存在
            const student = await this.studentService.getStudentById(studentId);
            if (!student) {
                throw new Error('学生不存在');
            }

            // 验证商品是否存在且可用
            const product = await this.productService.getProductById(productId);
            if (!product) {
                throw new Error('商品不存在');
            }

            if (!product.isActive) {
                throw new Error('商品已下架');
            }

            if (product.stock <= 0) {
                throw new Error('商品库存不足');
            }

            // 检查学生积分是否足够（通过积分服务计算当前余额）
            const PointsService = require('./pointsService');
            const pointsService = new PointsService(this.classId);
            const currentBalance = await pointsService.calculateStudentBalance(studentId);
            
            if (currentBalance < product.price) {
                throw new Error('积分不足');
            }

            // 检查学生是否已有该商品的待处理预约
            const existingOrders = await this.getOrdersByStudentId(studentId, 'pending');
            const duplicateOrder = existingOrders.find(order => order.productId === productId);
            if (duplicateOrder) {
                throw new Error('该商品已有待处理的预约');
            }

            // 创建订单
            const order = new Order({
                studentId,
                productId,
                status: 'pending'
            });

            // 验证订单数据
            const validation = order.validate();
            if (!validation.isValid) {
                throw new Error('订单数据验证失败: ' + validation.errors.join(', '));
            }

            const adapter = await this.getAdapter();
            
            // 准备订单数据
            const orderData = {
                ...order.toJSON(),
                quantity: 1,
                totalPrice: product.price
            };

            const createdOrder = await adapter.createOrder(this.classId, orderData);

            console.log(`创建预约成功: 学生 ${studentId} 预约商品 ${productId} (订单ID: ${createdOrder.id})`);
            return new Order(createdOrder);

        } catch (error) {
            console.error('创建预约失败:', error);
            throw error;
        }
    }

    /**
     * 确认预约订单
     * @param {string} orderId - 订单ID
     * @param {string} updatedBy - 操作者ID
     * @returns {Promise<Order>}
     */
    async confirmReservation(orderId, updatedBy = null) {
        try {
            // 获取订单
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new Error('订单不存在');
            }

            if (order.status !== 'pending') {
                throw new Error('只能确认待处理的订单');
            }

            // 获取商品信息
            const product = await this.productService.getProductById(order.productId);
            if (!product) {
                throw new Error('商品不存在');
            }

            // 减少商品库存
            await this.productService.reduceStock(order.productId, 1);

            // 扣除学生积分
            const PointsService = require('./pointsService');
            const pointsService = new PointsService(this.classId);
            await pointsService.addPointRecord({
                studentId: order.studentId,
                points: -product.price,
                reason: `兑换商品: ${product.name}`,
                operatorId: updatedBy || 'system',
                type: 'purchase'
            });

            // 更新订单状态
            const adapter = await this.getAdapter();
            const updatedOrder = await adapter.updateOrderStatus(this.classId, orderId, 'confirmed', updatedBy);

            console.log(`确认预约成功: 订单 ${orderId}`);
            return new Order(updatedOrder);

        } catch (error) {
            console.error('确认预约失败:', error);
            throw error;
        }
    }

    /**
     * 取消预约订单
     * @param {string} orderId - 订单ID
     * @param {string} reason - 取消原因
     * @returns {Promise<Order>}
     */
    async cancelReservation(orderId, reason = '用户取消') {
        try {
            // 获取订单
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new Error('订单不存在');
            }

            if (order.status !== 'pending') {
                throw new Error('只能取消待处理的订单');
            }

            const adapter = await this.getAdapter();
            const updatedOrder = await adapter.cancelOrder(this.classId, orderId, reason);

            console.log(`取消预约成功: 订单 ${orderId}`);
            return new Order(updatedOrder);

        } catch (error) {
            console.error('取消预约失败:', error);
            throw error;
        }
    }

    /**
     * 获取订单详情（包含学生和商品信息）
     * @param {string} orderId - 订单ID
     * @returns {Promise<object>}
     */
    async getOrderDetails(orderId) {
        try {
            const order = await this.getOrderById(orderId);
            if (!order) {
                throw new Error('订单不存在');
            }

            const student = await this.studentService.getStudentById(order.studentId);
            const product = await this.productService.getProductById(order.productId);

            return {
                order: order.toJSON(),
                student: student ? student.toJSON() : null,
                product: product ? product.toJSON() : null
            };

        } catch (error) {
            console.error('获取订单详情失败:', error);
            throw error;
        }
    }

    /**
     * 获取待处理订单列表（包含学生和商品信息）
     * @returns {Promise<object[]>}
     */
    async getPendingOrdersWithDetails() {
        try {
            const pendingOrders = await this.getAllOrders('pending');
            const ordersWithDetails = [];

            for (const order of pendingOrders) {
                const details = await this.getOrderDetails(order.id);
                ordersWithDetails.push(details);
            }

            return ordersWithDetails;

        } catch (error) {
            console.error('获取待处理订单详情失败:', error);
            throw error;
        }
    }

    /**
     * 获取订单统计信息
     * @returns {Promise<object>}
     */
    async getOrderStatistics() {
        try {
            const orders = await this.getAllOrders();
            
            const statistics = {
                total: orders.length,
                pending: orders.filter(o => o.status === 'pending').length,
                confirmed: orders.filter(o => o.status === 'confirmed').length,
                cancelled: orders.filter(o => o.status === 'cancelled').length,
                todayOrders: 0,
                weekOrders: 0
            };

            // 计算今日和本周订单数
            const today = new Date();
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

            statistics.todayOrders = orders.filter(order => {
                const orderDate = new Date(order.reservedAt);
                return orderDate >= todayStart;
            }).length;

            statistics.weekOrders = orders.filter(order => {
                const orderDate = new Date(order.reservedAt);
                return orderDate >= weekAgo;
            }).length;

            return statistics;

        } catch (error) {
            console.error('获取订单统计失败:', error);
            throw error;
        }
    }
}

module.exports = OrderService;