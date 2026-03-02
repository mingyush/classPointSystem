const express = require('express');
const OrderService = require('../services/orderService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');
const router = express.Router();

// 创建订单服务实例
const orderService = new OrderService();

/**
 * 预约商品
 * POST /api/orders/reserve
 * 需要学生或教师权限
 */
router.post('/reserve', authenticateToken,
    operationLogger('预约商品'),
    asyncHandler(async (req, res) => {
        const { studentId, productId } = req.body;

        // 参数验证
        if (!studentId || typeof studentId !== 'string') {
            throw createError('INVALID_STUDENT_ID', '学生ID不能为空');
        }

        if (!productId || typeof productId !== 'string') {
            throw createError('VALIDATION_ERROR', '商品ID不能为空');
        }

        // 如果是学生登录，只能为自己预约
        if (req.user.userType === 'student' && req.user.userId !== studentId) {
            throw createError('PERMISSION_DENIED', '只能为自己预约商品');
        }

        try {
            const order = await orderService.createReservation(studentId, productId);

            res.status(201).json({
                success: true,
                message: '预约商品成功',
                data: {
                    order: order.toJSON()
                }
            });
        } catch (error) {
            if (error.isOperational) throw error;
            if (error.message.includes('学生不存在')) {
                throw createError('STUDENT_NOT_FOUND', '学生不存在');
            }
            if (error.message.includes('商品不存在')) {
                throw createError('PRODUCT_NOT_FOUND', '商品不存在');
            }
            if (error.message.includes('商品已下架')) {
                throw createError('VALIDATION_ERROR', '商品已下架');
            }
            if (error.message.includes('商品库存不足')) {
                throw createError('PRODUCT_OUT_OF_STOCK', '商品库存不足');
            }
            if (error.message.includes('积分不足')) {
                throw createError('INSUFFICIENT_POINTS', '积分不足');
            }
            if (error.message.includes('该商品已有待处理的预约')) {
                throw createError('ORDER_ALREADY_EXISTS', '该商品已有待处理的预约');
            }
            throw error;
        }
    })
);

/**
 * 获取待处理预约
 * GET /api/orders/pending
 * 需要教师权限
 */
router.get('/pending', authenticateToken, requireTeacher,
    asyncHandler(async (req, res) => {
        const ordersWithDetails = await orderService.getPendingOrdersWithDetails();

        res.json({
            success: true,
            message: '获取待处理预约成功',
            data: {
                orders: ordersWithDetails,
                total: ordersWithDetails.length
            }
        });
    })
);

/**
 * 获取订单统计信息
 * GET /api/orders/statistics
 * 需要教师权限
 */
router.get('/statistics', authenticateToken, requireTeacher,
    asyncHandler(async (req, res) => {
        const statistics = await orderService.getOrderStatistics();

        res.json({
            success: true,
            message: '获取订单统计成功',
            data: statistics
        });
    })
);

/**
 * 获取所有订单
 * GET /api/orders?status=pending&studentId=2024001
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { status, studentId } = req.query;

    let orders;
    
    if (studentId) {
        // 如果是学生登录，只能查看自己的订单
        if (req.user.userType === 'student' && req.user.userId !== studentId) {
            throw createError('PERMISSION_DENIED', '只能查看自己的订单');
        }
        
        orders = await orderService.getOrdersByStudentId(studentId, status);
    } else {
        // 只有教师可以查看所有订单
        if (req.user.userType !== 'teacher') {
            throw createError('PERMISSION_DENIED', '权限不足');
        }
        
        orders = await orderService.getAllOrders(status);
    }

    res.json({
        success: true,
        message: '获取订单列表成功',
        data: {
            orders: orders.map(order => order.toJSON()),
            total: orders.length
        }
    });
}));

/**
 * 获取订单详情
 * GET /api/orders/:id
 */
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
        throw createError('VALIDATION_ERROR', '订单ID不能为空');
    }

    try {
        const orderDetails = await orderService.getOrderDetails(id);

        // 如果是学生登录，只能查看自己的订单
        if (req.user.userType === 'student' && req.user.userId !== orderDetails.order.studentId) {
            throw createError('PERMISSION_DENIED', '只能查看自己的订单');
        }

        res.json({
            success: true,
            message: '获取订单详情成功',
            data: orderDetails
        });
    } catch (error) {
        if (error.isOperational) throw error;
        if (error.message.includes('订单不存在')) {
            throw createError('ORDER_NOT_FOUND', '订单不存在');
        }
        throw error;
    }
}));

/**
 * 确认预约
 * POST /api/orders/:id/confirm
 * 需要教师权限
 */
router.post('/:id/confirm', authenticateToken, requireTeacher,
    operationLogger('确认预约'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        if (!id || typeof id !== 'string') {
            throw createError('VALIDATION_ERROR', '订单ID不能为空');
        }

        try {
            const updatedOrder = await orderService.confirmReservation(id);

            res.json({
                success: true,
                message: '确认预约成功',
                data: {
                    order: updatedOrder.toJSON()
                }
            });
        } catch (error) {
            if (error.isOperational) throw error;
            if (error.message.includes('订单不存在')) {
                throw createError('ORDER_NOT_FOUND', '订单不存在');
            }
            if (error.message.includes('只能确认待处理的订单')) {
                throw createError('VALIDATION_ERROR', '只能确认待处理的订单');
            }
            if (error.message.includes('商品不存在')) {
                throw createError('PRODUCT_NOT_FOUND', '商品不存在');
            }
            throw error;
        }
    })
);

/**
 * 取消预约
 * POST /api/orders/:id/cancel
 */
router.post('/:id/cancel', authenticateToken,
    operationLogger('取消预约'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        if (!id || typeof id !== 'string') {
            throw createError('VALIDATION_ERROR', '订单ID不能为空');
        }

        // 获取订单信息以验证权限
        let order;
        try {
            order = await orderService.getOrderById(id);
        } catch (error) {
            if (error.message.includes('订单不存在')) {
                throw createError('ORDER_NOT_FOUND', '订单不存在');
            }
            throw error;
        }

        if (!order) {
            throw createError('ORDER_NOT_FOUND', '订单不存在');
        }

        // 如果是学生登录，只能取消自己的订单
        if (req.user.userType === 'student' && req.user.userId !== order.studentId) {
            throw createError('PERMISSION_DENIED', '只能取消自己的订单');
        }

        try {
            const updatedOrder = await orderService.cancelReservation(id);

            res.json({
                success: true,
                message: '取消预约成功',
                data: {
                    order: updatedOrder.toJSON()
                }
            });
        } catch (error) {
            if (error.isOperational) throw error;
            if (error.message.includes('订单不存在')) {
                throw createError('ORDER_NOT_FOUND', '订单不存在');
            }
            if (error.message.includes('只能取消待处理的订单')) {
                throw createError('VALIDATION_ERROR', '只能取消待处理的订单');
            }
            if (error.message.includes('学生或商品信息不存在')) {
                throw createError('RESOURCE_NOT_FOUND', '学生或商品信息不存在');
            }
            throw error;
        }
    })
);

module.exports = router;
