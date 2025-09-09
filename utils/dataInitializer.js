const DataAccess = require('./dataAccess');
const { StudentInfo, PointRecord, Product, Order, SystemConfig } = require('../models/dataModels');

/**
 * 数据初始化工具
 * 负责创建默认数据文件和初始化系统数据
 */
class DataInitializer {
    constructor() {
        this.dataAccess = new DataAccess();
    }

    /**
     * 初始化所有数据文件
     */
    async initializeAllData() {
        console.log('开始初始化数据文件...');
        
        try {
            // 确保数据目录存在
            await this.dataAccess.ensureDirectories();
            
            // 初始化各个数据文件
            await this.initializeStudents();
            await this.initializePoints();
            await this.initializeProducts();
            await this.initializeOrders();
            await this.initializeConfig();
            
            console.log('数据文件初始化完成');
        } catch (error) {
            console.error('数据初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化学生数据
     */
    async initializeStudents() {
        const defaultStudents = {
            students: [
                new StudentInfo({
                    id: '2024001',
                    name: '张三',
                    class: '初一(1)班',
                    balance: 0
                }).toJSON(),
                new StudentInfo({
                    id: '2024002',
                    name: '李四',
                    class: '初一(1)班',
                    balance: 0
                }).toJSON(),
                new StudentInfo({
                    id: '2024003',
                    name: '王五',
                    class: '初一(1)班',
                    balance: 0
                }).toJSON(),
                new StudentInfo({
                    id: '2024004',
                    name: '赵六',
                    class: '初一(1)班',
                    balance: 0
                }).toJSON(),
                new StudentInfo({
                    id: '2024005',
                    name: '钱七',
                    class: '初一(1)班',
                    balance: 0
                }).toJSON()
            ]
        };

        await this.dataAccess.readFile('students.json', defaultStudents);
        console.log('学生数据初始化完成');
    }

    /**
     * 初始化积分记录数据
     */
    async initializePoints() {
        const defaultPoints = {
            records: []
        };

        await this.dataAccess.readFile('points.json', defaultPoints);
        console.log('积分记录数据初始化完成');
    }

    /**
     * 初始化商品数据
     */
    async initializeProducts() {
        const defaultProducts = {
            products: [
                new Product({
                    id: 'prod001',
                    name: '精美笔记本',
                    price: 50,
                    stock: 10,
                    description: '高质量笔记本，适合学习记录',
                    isActive: true
                }).toJSON(),
                new Product({
                    id: 'prod002',
                    name: '优质钢笔',
                    price: 30,
                    stock: 20,
                    description: '书写流畅的钢笔',
                    isActive: true
                }).toJSON(),
                new Product({
                    id: 'prod003',
                    name: '精美书签',
                    price: 10,
                    stock: 50,
                    description: '漂亮的书签，阅读好伴侣',
                    isActive: true
                }).toJSON(),
                new Product({
                    id: 'prod004',
                    name: '学习用品套装',
                    price: 80,
                    stock: 5,
                    description: '包含笔、橡皮、尺子等学习用品',
                    isActive: true
                }).toJSON(),
                new Product({
                    id: 'prod005',
                    name: '励志贴纸',
                    price: 5,
                    stock: 100,
                    description: '激励学习的精美贴纸',
                    isActive: true
                }).toJSON()
            ]
        };

        await this.dataAccess.readFile('products.json', defaultProducts);
        console.log('商品数据初始化完成');
    }

    /**
     * 初始化订单数据
     */
    async initializeOrders() {
        const defaultOrders = {
            orders: []
        };

        await this.dataAccess.readFile('orders.json', defaultOrders);
        console.log('订单数据初始化完成');
    }

    /**
     * 初始化系统配置
     */
    async initializeConfig() {
        const defaultConfig = new SystemConfig({
            mode: 'normal',
            autoRefreshInterval: 30,
            pointsResetEnabled: false,
            maxPointsPerOperation: 100,
            semesterStartDate: new Date('2024-09-01').toISOString()
        }).toJSON();

        await this.dataAccess.readFile('config.json', defaultConfig);
        console.log('系统配置初始化完成');
    }

    /**
     * 重置所有数据（慎用）
     */
    async resetAllData() {
        console.log('警告：正在重置所有数据...');
        
        try {
            await this.initializeStudents();
            await this.initializePoints();
            await this.initializeProducts();
            await this.initializeOrders();
            await this.initializeConfig();
            
            console.log('所有数据已重置为默认值');
        } catch (error) {
            console.error('数据重置失败:', error);
            throw error;
        }
    }

    /**
     * 验证数据文件完整性
     */
    async validateDataIntegrity() {
        const requiredFiles = [
            'students.json',
            'points.json', 
            'products.json',
            'orders.json',
            'config.json'
        ];

        const results = {
            valid: true,
            missing: [],
            corrupted: []
        };

        for (const filename of requiredFiles) {
            try {
                const exists = await this.dataAccess.fileExists(filename);
                if (!exists) {
                    results.missing.push(filename);
                    results.valid = false;
                } else {
                    // 尝试读取文件验证格式
                    await this.dataAccess.readFile(filename, {});
                }
            } catch (error) {
                results.corrupted.push(filename);
                results.valid = false;
            }
        }

        return results;
    }

    /**
     * 修复损坏的数据文件
     */
    async repairCorruptedData() {
        console.log('检查数据文件完整性...');
        
        const integrity = await this.validateDataIntegrity();
        
        if (integrity.valid) {
            console.log('所有数据文件完整');
            return;
        }

        console.log('发现问题文件，开始修复...');
        
        // 修复缺失的文件
        for (const filename of integrity.missing) {
            console.log(`修复缺失文件: ${filename}`);
            switch (filename) {
                case 'students.json':
                    await this.initializeStudents();
                    break;
                case 'points.json':
                    await this.initializePoints();
                    break;
                case 'products.json':
                    await this.initializeProducts();
                    break;
                case 'orders.json':
                    await this.initializeOrders();
                    break;
                case 'config.json':
                    await this.initializeConfig();
                    break;
            }
        }

        // 修复损坏的文件
        for (const filename of integrity.corrupted) {
            console.log(`修复损坏文件: ${filename}`);
            // 尝试从备份恢复，如果失败则重新初始化
            try {
                await this.dataAccess.restoreFromBackup(filename, {});
            } catch (error) {
                console.log(`备份恢复失败，重新初始化: ${filename}`);
                switch (filename) {
                    case 'students.json':
                        await this.initializeStudents();
                        break;
                    case 'points.json':
                        await this.initializePoints();
                        break;
                    case 'products.json':
                        await this.initializeProducts();
                        break;
                    case 'orders.json':
                        await this.initializeOrders();
                        break;
                    case 'config.json':
                        await this.initializeConfig();
                        break;
                }
            }
        }

        console.log('数据文件修复完成');
    }
}

module.exports = DataInitializer;