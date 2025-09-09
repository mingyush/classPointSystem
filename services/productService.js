const DataAccess = require('../utils/dataAccess');
const { Product } = require('../models/dataModels');

/**
 * 商品服务类
 * 处理商品相关的业务逻辑
 */
class ProductService {
    constructor() {
        this.dataAccess = new DataAccess();
        this.filename = 'products.json';
        this.defaultData = { products: [] };
    }

    /**
     * 获取所有商品
     * @param {boolean} activeOnly - 是否只返回启用的商品
     * @returns {Promise<Product[]>}
     */
    async getAllProducts(activeOnly = false) {
        try {
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            let products = data.products.map(productData => new Product(productData));
            
            if (activeOnly) {
                products = products.filter(product => product.isActive);
            }
            
            return products;
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
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const productData = data.products.find(p => p.id === productId);
            
            return productData ? new Product(productData) : null;
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

            // 检查商品名称是否已存在
            const existingProducts = await this.getAllProducts();
            const nameExists = existingProducts.some(p => 
                p.name.toLowerCase() === product.name.toLowerCase() && p.isActive
            );
            
            if (nameExists) {
                throw new Error('商品名称已存在');
            }

            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            
            // 添加新商品
            data.products.push(product.toJSON());
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`创建商品成功: ${product.name} (ID: ${product.id})`);
            return product;
            
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
            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const productIndex = data.products.findIndex(p => p.id === productId);
            
            if (productIndex === -1) {
                throw new Error('商品不存在');
            }

            // 合并更新数据
            const existingProduct = data.products[productIndex];
            const updatedProductData = { ...existingProduct, ...updateData };
            const updatedProduct = new Product(updatedProductData);
            
            // 验证更新后的商品数据
            const validation = updatedProduct.validate();
            if (!validation.isValid) {
                throw new Error('商品数据验证失败: ' + validation.errors.join(', '));
            }

            // 检查商品名称是否与其他商品冲突
            if (updateData.name) {
                const nameExists = data.products.some((p, index) => 
                    index !== productIndex && 
                    p.name.toLowerCase() === updatedProduct.name.toLowerCase() && 
                    p.isActive
                );
                
                if (nameExists) {
                    throw new Error('商品名称已存在');
                }
            }

            // 更新商品数据
            data.products[productIndex] = updatedProduct.toJSON();
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`更新商品成功: ${updatedProduct.name} (ID: ${productId})`);
            return updatedProduct;
            
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
            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const productIndex = data.products.findIndex(p => p.id === productId);
            
            if (productIndex === -1) {
                throw new Error('商品不存在');
            }

            // 软删除：设置为不活跃
            data.products[productIndex].isActive = false;
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`删除商品成功: ID ${productId}`);
            return true;
            
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
            // 检查库存是否足够
            const hasStock = await this.checkStock(productId, quantity);
            if (!hasStock) {
                throw new Error('库存不足');
            }

            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const productIndex = data.products.findIndex(p => p.id === productId);
            
            if (productIndex === -1) {
                throw new Error('商品不存在');
            }

            // 减少库存
            data.products[productIndex].stock -= quantity;
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
            const updatedProduct = new Product(data.products[productIndex]);
            console.log(`减少库存成功: ${updatedProduct.name} 减少 ${quantity}，剩余 ${updatedProduct.stock}`);
            
            return updatedProduct;
            
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
            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const productIndex = data.products.findIndex(p => p.id === productId);
            
            if (productIndex === -1) {
                throw new Error('商品不存在');
            }

            // 增加库存
            data.products[productIndex].stock += quantity;
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
            const updatedProduct = new Product(data.products[productIndex]);
            console.log(`增加库存成功: ${updatedProduct.name} 增加 ${quantity}，现有 ${updatedProduct.stock}`);
            
            return updatedProduct;
            
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
            const products = await this.getAllProducts(activeOnly);
            
            if (!keyword || keyword.trim() === '') {
                return products;
            }

            const searchTerm = keyword.toLowerCase().trim();
            
            return products.filter(product => 
                product.name.toLowerCase().includes(searchTerm) ||
                product.description.toLowerCase().includes(searchTerm)
            );
            
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