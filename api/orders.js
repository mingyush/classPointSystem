const express = require('express');
const OrderService = require('../services/orderService');
const { authenticateToken, requireTeacher } = require('./auth');
const router = express.Router();

// 创建订单服务实例
const orderService = new OrderService();

/**
 * 预约商品
 * POST /api/orders/reserve
 * 需要学生或教师权限
 */
router.post('/reserve', authenticateToken, async (req, res) => {
    try {
        const { studentId, productId } = req.body;

        // 参数验证
        if (!studentId || typeof studentId !== 'string') {
            return res.status(400).json({
                success: false,
                message: '学生ID不能为空',
                code: 'INVALID_STUDENT_ID'
            });
        }

        if (!productId || typeof productId !== 'string') {
            return res.status(400).json({
                success: false,
                message: '商品ID不能为空',
                code: 'INVALID_PRODUCT_ID'
            });
        }

        // 如果是学生登录，只能为自己预约
        if (req.user.userType === 'student' && req.user.userId !== studentId) {
            return res.status(403).json({
                success: false,
                message: '只能为自己预约商品',
                code: 'PERMISSION_DENIED'
            });
        }

        const order = await orderService.createReservation(studentId, productId);

        res.status(201).json({
            success: true,
            message: '预约商品成功',
            data: {
                order: order.toJSON()
            }
        });

    } catch (error) {
        console.error('预约商品失败:', error);
        
        if (error.message.includes('学生不存在')) {
            return res.status(404).json({
                success: false,
                message: '学生不存在',
                code: 'STUDENT_NOT_FOUND'
            });
        }

        if (error.message.includes('商品不存在')) {
            return res.status(404).json({
                success: false,
                message: '商品不存在',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        if (error.message.includes('商品已下架')) {
            return res.status(400).json({
                success: false,
                message: '商品已下架',
                code: 'PRODUCT_INACTIVE'
            });
        }

        if (error.message.includes('商品库存不足')) {
            return res.status(400).json({
                success: false,
                message: '商品库存不足',
                code: 'INSUFFICIENT_STOCK'
            });
        }

        if (error.message.includes('积分不足')) {
            return res.status(400).json({
                success: false,
                message: '积分不足',
                code: 'INSUFFICIENT_POINTS'
            });
        }

        if (error.message.includes('该商品已有待处理的预约')) {
            return res.status(409).json({
                success: false,
                message: '该商品已有待处理的预约',
                code: 'DUPLICATE_RESERVATION'
            });
        }

        res.status(500).json({
            success: false,
            message: '预约商品失败，请稍后重试',
            code: 'RESERVE_ERROR'
        });
    }
});

/**
 * 获取待处理预约
 * GET /api/orders/pending
 * 需要教师权限
 */
router.get('/pending', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const ordersWithDetails = await orderService.getPendingOrdersWithDetails();

        res.json({
            success: true,
            message: '获取待处理预约成功',
            data: {
                orders: ordersWithDetails,
                total: ordersWithDetails.length
            }
        });

    } catch (error) {
        console.error('获取待处理预约失败:', error);
        res.status(500).json({
            success: false,
            message: '获取待处理预约失败，请稍后重试',
            code: 'GET_PENDING_ORDERS_ERROR'
        });
    }
});

/**
 * 获取所有订单
 * GET /api/orders?status=pending&studentId=2024001
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { status, studentId } = req.query;

        let orders;
        
        if (studentId) {
            // 如果是学生登录，只能查看自己的订单
            if (req.user.userType === 'student' && req.user.userId !== studentId) {
                return res.status(403).json({
                    success: false,
                    message: '只能查看自己的订单',
                    code: 'PERMISSION_DENIED'
                });
            }
            
            orders = await orderService.getOrdersByStudentId(studentId, status);
        } else {
            // 只有教师可以查看所有订单
            if (req.user.userType !== 'teacher') {
                return res.status(403).json({
                    success: false,
                    message: '权限不足',
                    code: 'PERMISSION_DENIED'
                });
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

    } catch (error) {
        console.error('获取订单列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取订单列表失败，请稍后重试',
            code: 'GET_ORDERS_ERROR'
        });
    }
});

/**
 * 获取订单详情
 * GET /api/orders/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: '订单ID不能为空',
                code: 'INVALID_ORDER_ID'
            });
        }

        const orderDetails = await orderService.getOrderDetails(id);

        // 如果是学生登录，只能查看自己的订单
        if (req.user.userType === 'student' && req.user.userId !== orderDetails.order.studentId) {
            return res.status(403).json({
                success: false,
                message: '只能查看自己的订单',
                code: 'PERMISSION_DENIED'
            });
        }

        res.json({
            success: true,
            message: '获取订单详情成功',
            data: orderDetails
        });

    } catch (error) {
        console.error('获取订单详情失败:', error);
        
        if (error.message.includes('订单不存在')) {
            return res.status(404).json({
                success: false,
                message: '订单不存在',
                code: 'ORDER_NOT_FOUND'
            });
        }

        res.status(500).json({
            success: false,
            message: '获取订单详情失败，请稍后重试',
            code: 'GET_ORDER_DETAILS_ERROR'
        });
    }
});

/**
 * 确认预约
 * POST /api/orders/:id/confirm
 * 需要教师权限
 */
router.post('/:id/confirm', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: '订单ID不能为空',
                code: 'INVALID_ORDER_ID'
            });
        }

        const updatedOrder = await orderService.confirmReservation(id);

        res.json({
            success: true,
            message: '确认预约成功',
            data: {
                order: updatedOrder.toJSON()
            }
        });

    } catch (error) {
        console.error('确认预约失败:', error);
        
        if (error.message.includes('订单不存在')) {
            return res.status(404).json({
                success: false,
                message: '订单不存在',
                code: 'ORDER_NOT_FOUND'
            });
        }

        if (error.message.includes('只能确认待处理的订单')) {
            return res.status(400).json({
                success: false,
                message: '只能确认待处理的订单',
                code: 'INVALID_ORDER_STATUS'
            });
        }

        if (error.message.includes('商品不存在')) {
            return res.status(404).json({
                success: false,
                message: '商品不存在',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        res.status(500).json({
            success: false,
            message: '确认预约失败，请稍后重试',
            code: 'CONFIRM_ORDER_ERROR'
        });
    }
});

/**
 * 取消预约
 * POST /api/orders/:id/cancel
 */
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: '订单ID不能为空',
                code: 'INVALID_ORDER_ID'
            });
        }

        // 获取订单信息以验证权限
        const order = await orderService.getOrderById(id);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: '订单不存在',
                code: 'ORDER_NOT_FOUND'
            });
        }

        // 如果是学生登录，只能取消自己的订单
        if (req.user.userType === 'student' && req.user.userId !== order.studentId) {
            return res.status(403).json({
                success: false,
                message: '只能取消自己的订单',
                code: 'PERMISSION_DENIED'
            });
        }

        const updatedOrder = await orderService.cancelReservation(id);

        res.json({
            success: true,
            message: '取消预约成功',
            data: {
                order: updatedOrder.toJSON()
            }
        });

    } catch (error) {
        console.error('取消预约失败:', error);
        
        if (error.message.includes('订单不存在')) {
            return res.status(404).json({
                success: false,
                message: '订单不存在',
                code: 'ORDER_NOT_FOUND'
            });
        }

        if (error.message.includes('只能取消待处理的订单')) {
            return res.status(400).json({
                success: false,
                message: '只能取消待处理的订单',
                code: 'INVALID_ORDER_STATUS'
            });
        }

        if (error.message.includes('学生或商品信息不存在')) {
            return res.status(404).json({
                success: false,
                message: '学生或商品信息不存在',
                code: 'STUDENT_OR_PRODUCT_NOT_FOUND'
            });
        }

        res.status(500).json({
            success: false,
            message: '取消预约失败，请稍后重试',
            code: 'CANCEL_ORDER_ERROR'
        });
    }
});

/**
 * 获取订单统计信息
 * GET /api/orders/statistics
 * 需要教师权限
 */
router.get('/statistics', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const statistics = await orderService.getOrderStatistics();

        res.json({
            success: true,
            message: '获取订单统计成功',
            data: statistics
        });

    } catch (error) {
        console.error('获取订单统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取订单统计失败，请稍后重试',
            code: 'STATISTICS_ERROR'
        });
    }
});

module.exports = router;