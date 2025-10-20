/**
 * Cloudflare Workers - 商品管理 API
 */

import { createSuccessResponse, createErrorResponse, parseRequestBody, validateRequiredFields, generateId } from './index';
import { authenticateRequest, requireTeacher } from '../utils/auth';

/**
 * 处理商品相关 API 请求
 */
export async function handleProductsAPI(context) {
  const { pathname, method, dbAdapter } = context;
  
  try {
    // 获取所有商品
    if (pathname === '/api/products' && method === 'GET') {
      return await handleGetAllProducts(context);
    }
    
    // 创建商品
    if (pathname === '/api/products' && method === 'POST') {
      return await handleCreateProduct(context);
    }
    
    // 获取单个商品信息
    if (pathname.match(/^\/api\/products\/([^\/]+)$/) && method === 'GET') {
      const productId = pathname.split('/').pop();
      return await handleGetProduct(context, productId);
    }
    
    // 更新商品信息
    if (pathname.match(/^\/api\/products\/([^\/]+)$/) && method === 'PUT') {
      const productId = pathname.split('/').pop();
      return await handleUpdateProduct(context, productId);
    }
    
    // 删除商品
    if (pathname.match(/^\/api\/products\/([^\/]+)$/) && method === 'DELETE') {
      const productId = pathname.split('/').pop();
      return await handleDeleteProduct(context, productId);
    }
    
    return createErrorResponse('商品 API 路由未找到', 404);
    
  } catch (error) {
    console.error('商品 API 处理错误:', error);
    return createErrorResponse('商品操作失败', 500, error.message);
  }
}

/**
 * 获取所有商品信息
 */
async function handleGetAllProducts(context) {
  const { dbAdapter, searchParams } = context;
  
  try {
    const activeOnly = searchParams.get('active') !== 'false';
    const products = await dbAdapter.getProducts(activeOnly);
    
    return createSuccessResponse({
      products: products.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock,
        isActive: product.is_active,
        createdAt: product.created_at
      })),
      total: products.length
    });
    
  } catch (error) {
    return createErrorResponse('获取商品列表失败', 500, error.message);
  }
}

/**
 * 获取单个商品信息
 */
async function handleGetProduct(context, productId) {
  const { dbAdapter } = context;
  
  try {
    const product = await dbAdapter.getProductById(productId);
    if (!product) {
      return createErrorResponse('商品不存在', 404);
    }
    
    return createSuccessResponse({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      isActive: product.is_active,
      createdAt: product.created_at
    });
    
  } catch (error) {
    return createErrorResponse('获取商品信息失败', 500, error.message);
  }
}

/**
 * 创建新商品
 */
async function handleCreateProduct(context) {
  const { request, dbAdapter } = context;
  
  // 验证教师权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  const teacherCheck = requireTeacher(authResult.user);
  if (!teacherCheck.success) {
    return createErrorResponse(teacherCheck.message, 403);
  }
  
  try {
    const data = await parseRequestBody(request);
    validateRequiredFields(data, ['name', 'price']);
    
    const { name, description = '', price, stock = 0 } = data;
    
    // 参数验证
    if (!name.trim()) {
      return createErrorResponse('商品名称不能为空', 400);
    }
    
    if (typeof price !== 'number' || price < 0) {
      return createErrorResponse('商品价格必须为非负数', 400);
    }
    
    if (typeof stock !== 'number' || stock < 0) {
      return createErrorResponse('商品库存必须为非负数', 400);
    }
    
    // 创建商品
    const productId = generateId('prod_');
    const product = await dbAdapter.createProduct({
      id: productId,
      name: name.trim(),
      description: description.trim(),
      price,
      stock,
      isActive: 1
    });
    
    return createSuccessResponse({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock: product.stock,
      isActive: product.is_active,
      createdAt: product.created_at
    }, 201);
    
  } catch (error) {
    return createErrorResponse('创建商品失败', 500, error.message);
  }
}

/**
 * 更新商品信息
 */
async function handleUpdateProduct(context, productId) {
  const { request, dbAdapter } = context;
  
  // 验证教师权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  const teacherCheck = requireTeacher(authResult.user);
  if (!teacherCheck.success) {
    return createErrorResponse(teacherCheck.message, 403);
  }
  
  try {
    const data = await parseRequestBody(request);
    
    // 验证商品是否存在
    const product = await dbAdapter.getProductById(productId);
    if (!product) {
      return createErrorResponse('商品不存在', 404);
    }
    
    // 准备更新数据
    const updates = {};
    
    if (data.name !== undefined) {
      if (!data.name.trim()) {
        return createErrorResponse('商品名称不能为空', 400);
      }
      updates.name = data.name.trim();
    }
    
    if (data.description !== undefined) {
      updates.description = data.description.trim();
    }
    
    if (data.price !== undefined) {
      if (typeof data.price !== 'number' || data.price < 0) {
        return createErrorResponse('商品价格必须为非负数', 400);
      }
      updates.price = data.price;
    }
    
    if (data.stock !== undefined) {
      if (typeof data.stock !== 'number' || data.stock < 0) {
        return createErrorResponse('商品库存必须为非负数', 400);
      }
      updates.stock = data.stock;
    }
    
    if (typeof data.isActive === 'boolean') {
      updates.isActive = data.isActive;
    }
    
    if (Object.keys(updates).length === 0) {
      return createErrorResponse('没有需要更新的字段', 400);
    }
    
    // 更新商品信息
    const updatedProduct = await dbAdapter.updateProduct(productId, updates);
    
    return createSuccessResponse({
      id: updatedProduct.id,
      name: updatedProduct.name,
      description: updatedProduct.description,
      price: updatedProduct.price,
      stock: updatedProduct.stock,
      isActive: updatedProduct.is_active,
      createdAt: updatedProduct.created_at
    });
    
  } catch (error) {
    return createErrorResponse('更新商品信息失败', 500, error.message);
  }
}

/**
 * 删除商品
 */
async function handleDeleteProduct(context, productId) {
  const { request, dbAdapter } = context;
  
  // 验证教师权限
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.message, 401);
  }
  
  const teacherCheck = requireTeacher(authResult.user);
  if (!teacherCheck.success) {
    return createErrorResponse(teacherCheck.message, 403);
  }
  
  try {
    // 验证商品是否存在
    const product = await dbAdapter.getProductById(productId);
    if (!product) {
      return createErrorResponse('商品不存在', 404);
    }
    
    // 检查是否有未完成的订单
    const pendingOrders = await dbAdapter.getOrders({
      productId,
      status: 'pending'
    });
    
    if (pendingOrders.length > 0) {
      return createErrorResponse('该商品有未完成的订单，无法删除', 409);
    }
    
    // 软删除商品（设置为不活跃）
    const success = await dbAdapter.updateProduct(productId, { isActive: false });
    
    if (success) {
      return createSuccessResponse({ message: '删除商品成功' });
    } else {
      return createErrorResponse('删除商品失败', 500);
    }
    
  } catch (error) {
    return createErrorResponse('删除商品失败', 500, error.message);
  }
}