const express = require('express');
const ProductService = require('../services/productService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');
const router = express.Router();

// 创建商品服务实例
const productService = new ProductService();

/**
 * 获取所有商品
 * GET /api/products?active=true&search=keyword
 */
router.get('/', asyncHandler(async (req, res) => {
    const { active, search } = req.query;
    
    let products;
    
    if (search && search.trim() !== '') {
        // 搜索商品
        const activeOnly = active === 'true';
        products = await productService.searchProducts(search.trim(), activeOnly);
    } else {
        // 获取商品列表
        if (active === 'true') {
            // 只返回活跃商品
            products = await productService.getAllProducts(true);
        } else if (active === 'false') {
            // 只返回非活跃商品
            const allProducts = await productService.getAllProducts(false);
            products = allProducts.filter(product => !product.isActive);
        } else {
            // 返回所有商品
            products = await productService.getAllProducts(false);
        }
    }

    res.json({
        success: true,
        message: '获取商品列表成功',
        data: {
            products: products.map(product => product.toJSON()),
            total: products.length
        }
    });
}));

/**
 * 获取商品统计信息
 * GET /api/products/statistics
 * 需要教师权限
 */
router.get('/statistics', authenticateToken, requireTeacher,
    operationLogger('获取商品统计'),
    asyncHandler(async (req, res) => {
        const statistics = await productService.getProductStatistics();

        res.json({
            success: true,
            message: '获取商品统计成功',
            data: statistics
        });
    })
);

/**
 * 批量更新商品状态
 * PATCH /api/products/batch-status
 * 需要教师权限
 */
router.patch('/batch-status', authenticateToken, requireTeacher,
    operationLogger('批量更新商品状态'),
    asyncHandler(async (req, res) => {
        const { productIds, isActive } = req.body;

        // 参数验证
        if (!Array.isArray(productIds) || productIds.length === 0) {
            throw createError('VALIDATION_ERROR', '商品ID列表不能为空');
        }

        if (productIds.length > 50) {
            throw createError('VALIDATION_ERROR', '批量操作不能超过50个商品');
        }

        if (typeof isActive !== 'boolean') {
            throw createError('VALIDATION_ERROR', '商品状态必须为布尔值');
        }

        const updatedCount = await productService.batchUpdateStatus(productIds, isActive);

        res.json({
            success: true,
            message: '批量更新商品状态成功',
            data: {
                updatedCount,
                totalRequested: productIds.length
            }
        });
    })
);

/**
 * 根据ID获取单个商品
 * GET /api/products/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // 参数验证
    if (!id || typeof id !== 'string') {
        throw createError('VALIDATION_ERROR', '商品ID不能为空');
    }

    const product = await productService.getProductById(id);

    if (!product) {
        throw createError('PRODUCT_NOT_FOUND', '商品不存在');
    }

    res.json({
        success: true,
        message: '获取商品信息成功',
        data: {
            product: product.toJSON()
        }
    });
}));

/**
 * 检查商品库存
 * GET /api/products/:id/stock?quantity=1
 */
router.get('/:id/stock', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { quantity = 1 } = req.query;

    // 参数验证
    if (!id || typeof id !== 'string') {
        throw createError('VALIDATION_ERROR', '商品ID不能为空');
    }

    const quantityNum = parseInt(quantity);
    if (isNaN(quantityNum) || quantityNum < 1) {
        throw createError('VALIDATION_ERROR', '数量必须为正整数');
    }

    const hasStock = await productService.checkStock(id, quantityNum);
    const product = await productService.getProductById(id);

    res.json({
        success: true,
        message: '检查库存成功',
        data: {
            productId: id,
            requestedQuantity: quantityNum,
            currentStock: product ? product.stock : 0,
            hasStock: hasStock,
            isActive: product ? product.isActive : false
        }
    });
}));

/**
 * 创建新商品
 * POST /api/products
 * 需要教师权限
 */
router.post('/', authenticateToken, requireTeacher,
    operationLogger('创建商品'),
    asyncHandler(async (req, res) => {
        const { name, price, stock, description, imageUrl } = req.body;

        // 参数验证
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw createError('VALIDATION_ERROR', '商品名称不能为空');
        }

        if (typeof price !== 'number' || price < 0) {
            throw createError('VALIDATION_ERROR', '商品价格必须为非负数字');
        }

        if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
            throw createError('VALIDATION_ERROR', '商品库存必须为非负整数');
        }

        // 创建商品数据
        const productData = {
            name: name.trim(),
            price: price,
            stock: stock,
            description: description ? description.trim() : '',
            imageUrl: imageUrl ? imageUrl.trim() : '',
            isActive: true
        };

        try {
            const product = await productService.createProduct(productData);

            res.status(201).json({
                success: true,
                message: '创建商品成功',
                data: {
                    product: product.toJSON()
                }
            });
        } catch (error) {
            if (error.isOperational) throw error;
            if (error.message.includes('商品名称已存在')) {
                throw createError('DUPLICATE_RESOURCE', '商品名称已存在');
            }
            if (error.message.includes('验证失败')) {
                throw createError('VALIDATION_ERROR', error.message);
            }
            throw error;
        }
    })
);

/**
 * 更新商品信息
 * PUT /api/products/:id
 * 需要教师权限
 */
router.put('/:id', authenticateToken, requireTeacher,
    operationLogger('更新商品'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { name, price, stock, description, imageUrl, isActive } = req.body;

        // 参数验证
        if (!id || typeof id !== 'string') {
            throw createError('VALIDATION_ERROR', '商品ID不能为空');
        }

        // 构建更新数据对象
        const updateData = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                throw createError('VALIDATION_ERROR', '商品名称不能为空');
            }
            updateData.name = name.trim();
        }

        if (price !== undefined) {
            if (typeof price !== 'number' || price < 0) {
                throw createError('VALIDATION_ERROR', '商品价格必须为非负数字');
            }
            updateData.price = price;
        }

        if (stock !== undefined) {
            if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
                throw createError('VALIDATION_ERROR', '商品库存必须为非负整数');
            }
            updateData.stock = stock;
        }

        if (description !== undefined) {
            updateData.description = typeof description === 'string' ? description.trim() : '';
        }

        if (imageUrl !== undefined) {
            updateData.imageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
        }

        if (isActive !== undefined) {
            if (typeof isActive !== 'boolean') {
                throw createError('VALIDATION_ERROR', '商品状态必须为布尔值');
            }
            updateData.isActive = isActive;
        }

        // 检查是否有更新数据
        if (Object.keys(updateData).length === 0) {
            throw createError('VALIDATION_ERROR', '没有提供要更新的数据');
        }

        try {
            const updatedProduct = await productService.updateProduct(id, updateData);

            res.json({
                success: true,
                message: '更新商品成功',
                data: {
                    product: updatedProduct.toJSON()
                }
            });
        } catch (error) {
            if (error.isOperational) throw error;
            if (error.message.includes('商品不存在')) {
                throw createError('PRODUCT_NOT_FOUND', '商品不存在');
            }
            if (error.message.includes('商品名称已存在')) {
                throw createError('DUPLICATE_RESOURCE', '商品名称已存在');
            }
            if (error.message.includes('验证失败')) {
                throw createError('VALIDATION_ERROR', error.message);
            }
            throw error;
        }
    })
);

/**
 * 删除商品（软删除）
 * DELETE /api/products/:id
 * 需要教师权限
 */
router.delete('/:id', authenticateToken, requireTeacher,
    operationLogger('删除商品'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // 参数验证
        if (!id || typeof id !== 'string') {
            throw createError('VALIDATION_ERROR', '商品ID不能为空');
        }

        try {
            const success = await productService.deleteProduct(id);

            if (!success) {
                throw createError('INTERNAL_ERROR', '删除商品失败');
            }

            res.json({
                success: true,
                message: '删除商品成功'
            });
        } catch (error) {
            if (error.isOperational) throw error;
            if (error.message.includes('商品不存在')) {
                throw createError('PRODUCT_NOT_FOUND', '商品不存在');
            }
            throw error;
        }
    })
);

module.exports = router;
