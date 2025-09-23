/**
 * 商品API路由 - Cloudflare Workers版本
 * 实现商品管理和库存控制功能
 */

import { Router } from 'itty-router';
import { 
  authenticateToken,
  requireTeacher,
  requireAuth,
  successResponse, 
  errorResponse, 
  parseRequestBody, 
  validateParams 
} from '../middleware/auth.js';
import { ProductService } from '../services/product.js';
import { PerformanceMiddleware } from '../middleware/performance.js';
import { CACHE_STRATEGIES, CacheKeyGenerator } from '../cache/cache-manager.js';

/**
 * 创建商品路由
 * @param {Object} env 环境变量
 * @returns {Router} 路由实例
 */
export function createProductsRouter(env) {
  const router = Router({ base: '/api/products' });
  
  // 初始化性能中间件
  const performance = new PerformanceMiddleware(env);
  
  // 获取所有商品列表
  router.get('/', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('products:list'),
    performance.cacheMiddleware(
      (request) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const category = url.searchParams.get('category') || '';
        const active = url.searchParams.get('active');
        const search = url.searchParams.get('search') || '';
        return CacheKeyGenerator.productList(page, limit) +
               (category ? `:category:${category}` : '') +
               (active ? `:active:${active}` : '') +
               (search ? `:search:${search}` : '');
      },
      CACHE_STRATEGIES.PRODUCTS
    ),
    async (request) => {
      try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page')) || 1;
        const limit = parseInt(url.searchParams.get('limit')) || 20;
        const category = url.searchParams.get('category') || '';
        const active = url.searchParams.get('active');
        const search = url.searchParams.get('search') || '';
        const sortBy = url.searchParams.get('sortBy') || 'name';
        const sortOrder = url.searchParams.get('sortOrder') || 'asc';
        
        const productService = new ProductService(env.DB);
        
        const filters = {
          category,
          active: active !== null ? active === 'true' : null,
          search
        };
        
        const result = await productService.getAllProducts({
          page,
          limit,
          filters,
          sortBy,
          sortOrder
        });
        
        return successResponse({
          products: result.products,
          pagination: {
            page,
            limit,
            total: result.total,
            totalPages: Math.ceil(result.total / limit)
          }
        });
      } catch (error) {
        console.error('Get products error:', error);
        return errorResponse('Failed to get products', 500);
      }
    }
  );
  
  // 获取单个商品信息
  router.get('/:id', authenticateToken(env), requireAuth,
    performance.monitoringMiddleware('products:get'),
    performance.cacheMiddleware(
      (request) => CacheKeyGenerator.product(request.params.id),
      CACHE_STRATEGIES.PRODUCTS
    ),
    async (request) => {
      try {
        const { id } = request.params;
        
        if (!id || isNaN(parseInt(id))) {
          return errorResponse('Invalid product ID', 400);
        }
        
        const productService = new ProductService(env.DB);
        const product = await productService.getProductById(parseInt(id));
        
        if (!product) {
          return errorResponse('Product not found', 404);
        }
        
        // 学生用户只能查看活跃的商品
        if (request.user.role === 'student' && !product.is_active) {
          return errorResponse('Product not found', 404);
        }
        
        return successResponse(product);
      } catch (error) {
        console.error('Get product error:', error);
        return errorResponse('Failed to get product', 500);
      }
    }
  );
  
  // 创建新商品（仅教师）
  router.post('/', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        name: { required: true, type: 'string', minLength: 1 },
        description: { required: false, type: 'string' },
        price: { required: true, type: 'number', min: 1 },
        stock: { required: true, type: 'number', min: 0 },
        category: { required: true, type: 'string', minLength: 1 },
        image: { required: false, type: 'string' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const productData = {
        name: body.name,
        description: body.description || '',
        price: body.price,
        stock: body.stock,
        category: body.category,
        image: body.image || ''
      };
      
      const productService = new ProductService(env.DB);
      const product = await productService.createProduct(productData);
      
      return successResponse(product, 201);
    } catch (error) {
      console.error('Create product error:', error);
      return errorResponse('Failed to create product', 500);
    }
  });
  
  // 更新商品信息（仅教师）
  router.put('/:id', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid product ID', 400);
      }
      
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        name: { required: false, type: 'string', minLength: 1 },
        description: { required: false, type: 'string' },
        price: { required: false, type: 'number', min: 1 },
        stock: { required: false, type: 'number', min: 0 },
        category: { required: false, type: 'string', minLength: 1 },
        image: { required: false, type: 'string' }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const productService = new ProductService(env.DB);
      
      // 检查商品是否存在
      const existingProduct = await productService.getProductById(parseInt(id));
      if (!existingProduct) {
        return errorResponse('Product not found', 404);
      }
      
      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.price !== undefined) updateData.price = body.price;
      if (body.stock !== undefined) updateData.stock = body.stock;
      if (body.category !== undefined) updateData.category = body.category;
      if (body.image !== undefined) updateData.image = body.image;
      
      const product = await productService.updateProduct(parseInt(id), updateData);
      
      return successResponse(product);
    } catch (error) {
      console.error('Update product error:', error);
      return errorResponse('Failed to update product', 500);
    }
  });
  
  // 删除商品（软删除，仅教师）
  router.delete('/:id', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid product ID', 400);
      }
      
      const productService = new ProductService(env.DB);
      
      // 检查商品是否存在
      const existingProduct = await productService.getProductById(parseInt(id));
      if (!existingProduct) {
        return errorResponse('Product not found', 404);
      }
      
      const success = await productService.deleteProduct(parseInt(id));
      
      if (!success) {
        return errorResponse('Failed to delete product', 500);
      }
      
      return successResponse({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Delete product error:', error);
      return errorResponse('Failed to delete product', 500);
    }
  });
  
  // 更新商品库存（仅教师）
  router.patch('/:id/stock', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid product ID', 400);
      }
      
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        stock: { required: true, type: 'number', min: 0 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const productService = new ProductService(env.DB);
      
      // 检查商品是否存在
      const existingProduct = await productService.getProductById(parseInt(id));
      if (!existingProduct) {
        return errorResponse('Product not found', 404);
      }
      
      const success = await productService.updateProductStock(parseInt(id), body.stock);
      
      if (!success) {
        return errorResponse('Failed to update product stock', 500);
      }
      
      // 获取更新后的商品信息
      const updatedProduct = await productService.getProductById(parseInt(id));
      
      return successResponse(updatedProduct);
    } catch (error) {
      console.error('Update product stock error:', error);
      return errorResponse('Failed to update product stock', 500);
    }
  });
  
  // 获取商品分类列表
  router.get('/categories/list', authenticateToken(env), requireAuth, async (request) => {
    try {
      const productService = new ProductService(env.DB);
      const categories = await productService.getProductCategories();
      
      return successResponse({ categories });
    } catch (error) {
      console.error('Get product categories error:', error);
      return errorResponse('Failed to get product categories', 500);
    }
  });
  
  // 获取商品统计信息（仅教师）
  router.get('/stats/overview', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const productService = new ProductService(env.DB);
      const stats = await productService.getProductStats();
      
      return successResponse(stats);
    } catch (error) {
      console.error('Get product stats error:', error);
      return errorResponse('Failed to get product stats', 500);
    }
  });
  
  // 批量导入商品（仅教师）
  router.post('/batch-import', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const body = await parseRequestBody(request);
      
      // 验证参数
      const validation = validateParams(body, {
        products: { required: true, type: 'array', minLength: 1 }
      });
      
      if (!validation.valid) {
        return errorResponse('Validation failed', 400, { errors: validation.errors });
      }
      
      const { products } = body;
      const productService = new ProductService(env.DB);
      
      // 验证每个商品数据
      const validProducts = [];
      const errors = [];
      
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const productValidation = validateParams(product, {
          name: { required: true, type: 'string', minLength: 1 },
          description: { required: false, type: 'string' },
          price: { required: true, type: 'number', min: 1 },
          stock: { required: true, type: 'number', min: 0 },
          category: { required: true, type: 'string', minLength: 1 },
          image: { required: false, type: 'string' }
        });
        
        if (!productValidation.valid) {
          errors.push({ index: i, errors: productValidation.errors });
        } else {
          validProducts.push({
            name: product.name,
            description: product.description || '',
            price: product.price,
            stock: product.stock,
            category: product.category,
            image: product.image || ''
          });
        }
      }
      
      if (errors.length > 0) {
        return errorResponse('Validation failed for some products', 400, { errors });
      }
      
      // 批量创建商品
      const createdProducts = [];
      for (const productData of validProducts) {
        try {
          const product = await productService.createProduct(productData);
          createdProducts.push(product);
        } catch (error) {
          console.error('Failed to create product:', productData, error);
        }
      }
      
      return successResponse({
        message: `Successfully imported ${createdProducts.length} products`,
        products: createdProducts
      });
    } catch (error) {
      console.error('Batch import products error:', error);
      return errorResponse('Failed to import products', 500);
    }
  });
  
  // 恢复已删除的商品（仅教师）
  router.post('/:id/restore', authenticateToken(env), requireTeacher, async (request) => {
    try {
      const { id } = request.params;
      
      if (!id || isNaN(parseInt(id))) {
        return errorResponse('Invalid product ID', 400);
      }
      
      const productService = new ProductService(env.DB);
      
      // 检查商品是否存在且已删除
      const existingProduct = await productService.getProductById(parseInt(id));
      if (!existingProduct) {
        return errorResponse('Product not found', 404);
      }
      
      if (!existingProduct.deleted_at) {
        return errorResponse('Product is not deleted', 400);
      }
      
      // 恢复商品
      const sql = 'UPDATE products SET deleted_at = NULL, updated_at = ? WHERE id = ?';
      const result = await env.DB.prepare(sql)
        .bind(new Date().toISOString(), parseInt(id))
        .run();
      
      if (!result.success) {
        return errorResponse('Failed to restore product', 500);
      }
      
      // 获取恢复后的商品信息
      const restoredProduct = await productService.getProductById(parseInt(id));
      
      return successResponse({
        message: 'Product restored successfully',
        product: restoredProduct
      });
    } catch (error) {
      console.error('Restore product error:', error);
      return errorResponse('Failed to restore product', 500);
    }
  });
  
  return router;
}