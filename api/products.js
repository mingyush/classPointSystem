const express = require('express');
const ProductService = require('../services/productService');
const { authenticateToken, requireTeacher } = require('./auth');
const router = express.Router();

// 创建商品服务实例
const productService = new ProductService();

/**
 * 获取所有商品
 * GET /api/products?active=true&search=keyword
 */
router.get('/', async (req, res) => {
    try {
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

    } catch (error) {
        console.error('获取商品列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取商品列表失败，请稍后重试',
            code: 'GET_PRODUCTS_ERROR'
        });
    }
});

/**
 * 根据ID获取单个商品
 * GET /api/products/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 参数验证
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: '商品ID不能为空',
                code: 'INVALID_PRODUCT_ID'
            });
        }

        const product = await productService.getProductById(id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: '商品不存在',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        res.json({
            success: true,
            message: '获取商品信息成功',
            data: {
                product: product.toJSON()
            }
        });

    } catch (error) {
        console.error('获取商品信息失败:', error);
        res.status(500).json({
            success: false,
            message: '获取商品信息失败，请稍后重试',
            code: 'GET_PRODUCT_ERROR'
        });
    }
});

/**
 * 创建新商品
 * POST /api/products
 * 需要教师权限
 */
router.post('/', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { name, price, stock, description, imageUrl } = req.body;

        // 参数验证
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: '商品名称不能为空',
                code: 'INVALID_PRODUCT_NAME'
            });
        }

        if (typeof price !== 'number' || price < 0) {
            return res.status(400).json({
                success: false,
                message: '商品价格必须为非负数字',
                code: 'INVALID_PRODUCT_PRICE'
            });
        }

        if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
            return res.status(400).json({
                success: false,
                message: '商品库存必须为非负整数',
                code: 'INVALID_PRODUCT_STOCK'
            });
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

        const product = await productService.createProduct(productData);

        res.status(201).json({
            success: true,
            message: '创建商品成功',
            data: {
                product: product.toJSON()
            }
        });

    } catch (error) {
        console.error('创建商品失败:', error);
        
        if (error.message.includes('商品名称已存在')) {
            return res.status(409).json({
                success: false,
                message: '商品名称已存在',
                code: 'PRODUCT_NAME_EXISTS'
            });
        }

        if (error.message.includes('验证失败')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'VALIDATION_ERROR'
            });
        }

        res.status(500).json({
            success: false,
            message: '创建商品失败，请稍后重试',
            code: 'CREATE_PRODUCT_ERROR'
        });
    }
});

/**
 * 更新商品信息
 * PUT /api/products/:id
 * 需要教师权限
 */
router.put('/:id', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, stock, description, imageUrl, isActive } = req.body;

        // 参数验证
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: '商品ID不能为空',
                code: 'INVALID_PRODUCT_ID'
            });
        }

        // 构建更新数据对象
        const updateData = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '商品名称不能为空',
                    code: 'INVALID_PRODUCT_NAME'
                });
            }
            updateData.name = name.trim();
        }

        if (price !== undefined) {
            if (typeof price !== 'number' || price < 0) {
                return res.status(400).json({
                    success: false,
                    message: '商品价格必须为非负数字',
                    code: 'INVALID_PRODUCT_PRICE'
                });
            }
            updateData.price = price;
        }

        if (stock !== undefined) {
            if (typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
                return res.status(400).json({
                    success: false,
                    message: '商品库存必须为非负整数',
                    code: 'INVALID_PRODUCT_STOCK'
                });
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
                return res.status(400).json({
                    success: false,
                    message: '商品状态必须为布尔值',
                    code: 'INVALID_PRODUCT_STATUS'
                });
            }
            updateData.isActive = isActive;
        }

        // 检查是否有更新数据
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: '没有提供要更新的数据',
                code: 'NO_UPDATE_DATA'
            });
        }

        const updatedProduct = await productService.updateProduct(id, updateData);

        res.json({
            success: true,
            message: '更新商品成功',
            data: {
                product: updatedProduct.toJSON()
            }
        });

    } catch (error) {
        console.error('更新商品失败:', error);
        
        if (error.message.includes('商品不存在')) {
            return res.status(404).json({
                success: false,
                message: '商品不存在',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        if (error.message.includes('商品名称已存在')) {
            return res.status(409).json({
                success: false,
                message: '商品名称已存在',
                code: 'PRODUCT_NAME_EXISTS'
            });
        }

        if (error.message.includes('验证失败')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'VALIDATION_ERROR'
            });
        }

        res.status(500).json({
            success: false,
            message: '更新商品失败，请稍后重试',
            code: 'UPDATE_PRODUCT_ERROR'
        });
    }
});

/**
 * 删除商品（软删除）
 * DELETE /api/products/:id
 * 需要教师权限
 */
router.delete('/:id', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { id } = req.params;

        // 参数验证
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: '商品ID不能为空',
                code: 'INVALID_PRODUCT_ID'
            });
        }

        const success = await productService.deleteProduct(id);

        if (success) {
            res.json({
                success: true,
                message: '删除商品成功'
            });
        } else {
            res.status(500).json({
                success: false,
                message: '删除商品失败',
                code: 'DELETE_PRODUCT_ERROR'
            });
        }

    } catch (error) {
        console.error('删除商品失败:', error);
        
        if (error.message.includes('商品不存在')) {
            return res.status(404).json({
                success: false,
                message: '商品不存在',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        res.status(500).json({
            success: false,
            message: '删除商品失败，请稍后重试',
            code: 'DELETE_PRODUCT_ERROR'
        });
    }
});

/**
 * 获取商品统计信息
 * GET /api/products/statistics
 * 需要教师权限
 */
router.get('/statistics', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const statistics = await productService.getProductStatistics();

        res.json({
            success: true,
            message: '获取商品统计成功',
            data: statistics
        });

    } catch (error) {
        console.error('获取商品统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取商品统计失败，请稍后重试',
            code: 'STATISTICS_ERROR'
        });
    }
});

/**
 * 批量更新商品状态
 * PATCH /api/products/batch-status
 * 需要教师权限
 */
router.patch('/batch-status', authenticateToken, requireTeacher, async (req, res) => {
    try {
        const { productIds, isActive } = req.body;

        // 参数验证
        if (!Array.isArray(productIds) || productIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '商品ID列表不能为空',
                code: 'INVALID_PRODUCT_IDS'
            });
        }

        if (productIds.length > 50) {
            return res.status(400).json({
                success: false,
                message: '批量操作不能超过50个商品',
                code: 'TOO_MANY_PRODUCTS'
            });
        }

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: '商品状态必须为布尔值',
                code: 'INVALID_STATUS'
            });
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

    } catch (error) {
        console.error('批量更新商品状态失败:', error);
        res.status(500).json({
            success: false,
            message: '批量更新商品状态失败，请稍后重试',
            code: 'BATCH_UPDATE_ERROR'
        });
    }
});

/**
 * 检查商品库存
 * GET /api/products/:id/stock?quantity=1
 */
router.get('/:id/stock', async (req, res) => {
    try {
        const { id } = req.params;
        const { quantity = 1 } = req.query;

        // 参数验证
        if (!id || typeof id !== 'string') {
            return res.status(400).json({
                success: false,
                message: '商品ID不能为空',
                code: 'INVALID_PRODUCT_ID'
            });
        }

        const quantityNum = parseInt(quantity);
        if (isNaN(quantityNum) || quantityNum < 1) {
            return res.status(400).json({
                success: false,
                message: '数量必须为正整数',
                code: 'INVALID_QUANTITY'
            });
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

    } catch (error) {
        console.error('检查库存失败:', error);
        
        if (error.message.includes('商品不存在')) {
            return res.status(404).json({
                success: false,
                message: '商品不存在',
                code: 'PRODUCT_NOT_FOUND'
            });
        }

        res.status(500).json({
            success: false,
            message: '检查库存失败，请稍后重试',
            code: 'CHECK_STOCK_ERROR'
        });
    }
});

module.exports = router;