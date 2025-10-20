const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');
const { Product } = require('../models/dataModels');

/**
 * 商品服务类 - V1版本
 * 处理商品相关的业务逻辑
 * 适配新的数据库存储接口
 */
class ProductService {
    constructor(classId = 'default') {
        this.classId = classId; // 单班级ID，默认为'default'
        this.adapter = null;
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
     * 获取所有商品
     * @param {boolean} activeOnly - 是否只返回启用的商品
     * @returns {Promise<Product[]>}
     */
    async getAllProducts(activeOnly = false) {
        try {
            const adapter = await this.getAdapter();
            const filters = {};
            if (activeOnly) {
                filters.isActive = true;
            }
            
            const products = await adapter.getProducts(this.classId, filters);
            return products.map(product => new Product(product));
        } catch (error) {
            console.error('获取商品列表失败:', error);
            throw new Error('获取商品列表失败');
        }
    }

    /**
     * 根据ID获取商品
     * @param {string} productId - 商品ID
     * @returns {Promise<Product|null>}
     */
    async getProductById(productId) {
        try {
            const adapter = await this.getAdapter();
            const product = await adapter.getProductById(this.classId, productId);
            
            return product ? new Product(product) : null;
        } catch (error) {
            console.error('获取商品失败:', error);
            throw new Error('获取商品失败');
        }
    }

    /**
     * 创建新商品
     * @param {object} productData - 商品数据
     * @returns {Promise<Product>}
     */
    async createProduct(productData) {
        try {
            const product = new Product(productData);
            
            // 验证商品数据
            const validation = product.validate();
            if (!validation.isValid) {
                throw new Error('商品数据验证失败: ' + validation.errors.join(', '));
            }

            const adapter = await this.getAdapter();
            const createdProduct = await adapter.createProduct(this.classId, product.toJSON());
            
            console.log(`创建商品成功: ${createdProduct.name} (ID: ${createdProduct.id})`);
            return new Product(createdProduct);
            
        } catch (error) {
            console.error('创建商品失败:', error);
            throw error;
        }
    }

    /**
     * 更新商品信息
     * @param {string} productId - 商品ID
     * @param {object} updateData - 更新数据
     * @returns {Promise<Product>}
     */
    async updateProduct(productId, updateData) {
        try {
            const adapter = await this.getAdapter();
            const updatedProduct = await adapter.updateProduct(this.classId, productId, updateData);
            
            console.log(`更新商品成功: ${updatedProduct.name} (ID: ${productId})`);
            return new Product(updatedProduct);
            
        } catch (error) {
            console.error('更新商品失败:', error);
            throw error;
        }
    }

    /**
     * 删除商品（软删除，设置为不活跃）
     * @param {string} productId - 商品ID
     * @returns {Promise<boolean>}
     */
    async deleteProduct(productId) {
        try {
            const adapter = await this.getAdapter();
            const result = await adapter.deleteProduct(this.classId, productId);
            
            if (result) {
                console.log(`删除商品成功: ID ${productId}`);
            }
            return result;
            
        } catch (error) {
            console.error('删除商品失败:', error);
            throw error;
        }
    }

    /**
     * 检查商品库存
     * @param {string} productId - 商品ID
     * @param {number} quantity - 需要的数量
     * @returns {Promise<boolean>}
     */
    async checkStock(productId, quantity = 1) {
        try {
            const product = await this.getProductById(productId);
            
            if (!product) {
                throw new Error('商品不存在');
            }

            if (!product.isActive) {
                throw new Error('商品已下架');
            }

            return product.stock >= quantity;
            
        } catch (error) {
            console.error('检查库存失败:', error);
            throw error;
        }
    }

    /**
     * 减少商品库存
     * @param {string} productId - 商品ID
     * @param {number} quantity - 减少的数量
     * @returns {Promise<Product>}
     */
    async reduceStock(productId, quantity = 1) {
        try {
            const adapter = await this.getAdapter();
            const updatedProduct = await adapter.updateProductStock(this.classId, productId, -quantity);
            
            console.log(`减少库存成功: ${updatedProduct.name} 减少 ${quantity}，剩余 ${updatedProduct.stock}`);
            return new Product(updatedProduct);
            
        } catch (error) {
            console.error('减少库存失败:', error);
            throw error;
        }
    }

    /**
     * 增加商品库存
     * @param {string} productId - 商品ID
     * @param {number} quantity - 增加的数量
     * @returns {Promise<Product>}
     */
    async increaseStock(productId, quantity = 1) {
        try {
            const adapter = await this.getAdapter();
            const updatedProduct = await adapter.updateProductStock(this.classId, productId, quantity);
            
            console.log(`增加库存成功: ${updatedProduct.name} 增加 ${quantity}，现有 ${updatedProduct.stock}`);
            return new Product(updatedProduct);
            
        } catch (error) {
            console.error('增加库存失败:', error);
            throw error;
        }
    }

    /**
     * 获取商品统计信息
     * @returns {Promise<object>}
     */
    async getProductStatistics() {
        try {
            const products = await this.getAllProducts();
            
            const statistics = {
                total: products.length,
                active: products.filter(p => p.isActive).length,
                inactive: products.filter(p => !p.isActive).length,
                outOfStock: products.filter(p => p.isActive && p.stock === 0).length,
                lowStock: products.filter(p => p.isActive && p.stock > 0 && p.stock <= 5).length,
                totalValue: products
                    .filter(p => p.isActive)
                    .reduce((sum, p) => sum + (p.price * p.stock), 0)
            };
            
            return statistics;
            
        } catch (error) {
            console.error('获取商品统计失败:', error);
            throw error;
        }
    }

    /**
     * 搜索商品
     * @param {string} keyword - 搜索关键词
     * @param {boolean} activeOnly - 是否只搜索活跃商品
     * @returns {Promise<Product[]>}
     */
    async searchProducts(keyword, activeOnly = true) {
        try {
            const filters = { search: keyword };
            if (activeOnly) {
                filters.isActive = true;
            }
            
            const adapter = await this.getAdapter();
            const products = await adapter.getProducts(this.classId, filters);
            return products.map(product => new Product(product));
            
        } catch (error) {
            console.error('搜索商品失败:', error);
            throw error;
        }
    }

    /**
     * 批量更新商品状态
     * @param {string[]} productIds - 商品ID列表
     * @param {boolean} isActive - 新的活跃状态
     * @returns {Promise<number>}
     */
    async batchUpdateStatus(productIds, isActive) {
        try {
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            let updatedCount = 0;
            
            for (const productId of productIds) {
                const productIndex = data.products.findIndex(p => p.id === productId);
                if (productIndex !== -1) {
                    data.products[productIndex].isActive = isActive;
                    updatedCount++;
                }
            }
            
            if (updatedCount > 0) {
                await this.dataAccess.writeFile(this.filename, data);
                console.log(`批量更新商品状态成功: ${updatedCount} 个商品`);
            }
            
            return updatedCount;
            
        } catch (error) {
            console.error('批量更新商品状态失败:', error);
            throw error;
        }
    }
}

module.exports = ProductService;