const DataAccess = require('./dataAccess');
const { StudentInfo, Product, SystemConfig, Teacher } = require('../models/dataModels');

/**
 * 数据初始化工具
 * 负责创建默认数据和初始化系统数据库
 */
class DataInitializer {
    constructor() {
        this.dataAccess = new DataAccess();
    }

    /**
     * 初始化所有数据
     */
    async initializeAllData() {
        console.log('开始初始化数据库...');

        try {
            // 确保数据库目录和表结构存在
            await this.dataAccess.ensureDirectories();

            // 检查是否已有数据
            const stats = await this.dataAccess.getDatabaseStats();

            // 如果没有数据，则初始化默认数据
            if (stats.students === 0) {
                await this.initializeStudents();
            }

            if (stats.products === 0) {
                await this.initializeProducts();
            }

            if (stats.teachers === 0) {
                await this.initializeTeachers();
            }

            // 初始化配置
            await this.initializeConfig();

            console.log('数据库初始化完成');
        } catch (error) {
            console.error('数据初始化失败:', error);
            throw error;
        }
    }

    /**
     * 初始化学生数据
     */
    async initializeStudents() {
        const defaultStudents = [
            { id: '01', name: '陈珈', class: '花儿起舞', balance: 0 },
            { id: '2024001', name: '张三', class: '初一(1)班', balance: 0 },
            { id: '2024002', name: '李四', class: '初一(1)班', balance: 0 },
            { id: '2024003', name: '王五', class: '初一(1)班', balance: 0 },
            { id: '2024004', name: '赵六', class: '初一(1)班', balance: 0 },
            { id: '2024005', name: '钱七', class: '初一(1)班', balance: 0 }
        ];

        for (const studentData of defaultStudents) {
            const student = new StudentInfo(studentData);
            try {
                await this.dataAccess.createStudent(student.toJSON());
            } catch (error) {
                // 忽略重复键错误
                if (!error.message.includes('UNIQUE constraint failed')) {
                    console.error(`创建学生失败 ${student.id}:`, error.message);
                }
            }
        }

        console.log('学生数据初始化完成');
    }

    /**
     * 初始化商品数据
     */
    async initializeProducts() {
        const defaultProducts = [
            { id: 'prod001', name: '精美笔记本', price: 50, stock: 10, description: '高质量笔记本，适合学习记录', isActive: true },
            { id: 'prod002', name: '优质钢笔', price: 30, stock: 20, description: '书写流畅的钢笔', isActive: true },
            { id: 'prod003', name: '精美书签', price: 10, stock: 50, description: '漂亮的书签，阅读好伴侣', isActive: true },
            { id: 'prod004', name: '学习用品套装', price: 80, stock: 5, description: '包含笔、橡皮、尺子等学习用品', isActive: true },
            { id: 'prod005', name: '励志贴纸', price: 5, stock: 100, description: '激励学习的精美贴纸', isActive: true }
        ];

        for (const productData of defaultProducts) {
            const product = new Product(productData);
            try {
                await this.dataAccess.createProduct(product.toJSON());
            } catch (error) {
                if (!error.message.includes('UNIQUE constraint failed')) {
                    console.error(`创建商品失败 ${product.id}:`, error.message);
                }
            }
        }

        console.log('商品数据初始化完成');
    }

    /**
     * 初始化教师数据
     */
    async initializeTeachers() {
        const defaultTeachers = [
            { id: '8001', name: '管理员', password: 'admin123', role: 'admin', department: '系统管理', isActive: true },
            { id: '8002', name: '班主任', password: 'teacher123', role: 'teacher', department: '教学部', isActive: true }
        ];

        for (const teacherData of defaultTeachers) {
            const teacher = new Teacher(teacherData);
            try {
                await this.dataAccess.createTeacher(teacher.toJSON());
            } catch (error) {
                if (!error.message.includes('UNIQUE constraint failed')) {
                    console.error(`创建教师失败 ${teacher.id}:`, error.message);
                }
            }
        }

        console.log('教师数据初始化完成');
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

        // 保存配置到数据库
        for (const [key, value] of Object.entries(defaultConfig)) {
            try {
                const existing = await this.dataAccess.getConfig(key);
                if (existing === null) {
                    await this.dataAccess.setConfig(key, value);
                }
            } catch (error) {
                console.error(`设置配置失败 ${key}:`, error.message);
            }
        }

        // 额外的系统配置
        const extraConfig = {
            className: '花儿起舞',
            author: '茗雨',
            copyright: '© 2025 花儿起舞班级积分管理系统 | 作者：茗雨'
        };

        for (const [key, value] of Object.entries(extraConfig)) {
            try {
                const existing = await this.dataAccess.getConfig(key);
                if (existing === null) {
                    await this.dataAccess.setConfig(key, value);
                }
            } catch (error) {
                console.error(`设置配置失败 ${key}:`, error.message);
            }
        }

        console.log('系统配置初始化完成');
    }

    /**
     * 重置所有数据（慎用）
     */
    async resetAllData() {
        console.log('警告：正在重置所有数据...');

        try {
            // 清空所有表
            await this.dataAccess._run('DELETE FROM orders');
            await this.dataAccess._run('DELETE FROM point_records');
            await this.dataAccess._run('DELETE FROM products');
            await this.dataAccess._run('DELETE FROM students');
            await this.dataAccess._run('DELETE FROM teachers');
            await this.dataAccess._run('DELETE FROM system_config');

            // 重新初始化
            await this.initializeStudents();
            await this.initializeProducts();
            await this.initializeTeachers();
            await this.initializeConfig();

            console.log('所有数据已重置为默认值');
        } catch (error) {
            console.error('数据重置失败:', error);
            throw error;
        }
    }

    /**
     * 验证数据完整性
     */
    async validateDataIntegrity() {
        const results = {
            valid: true,
            statistics: {},
            issues: []
        };

        try {
            const stats = await this.dataAccess.getDatabaseStats();
            results.statistics = stats;

            // 检查必要的数据表是否有数据
            if (stats.students === 0) {
                results.issues.push('学生表为空');
                results.valid = false;
            }

            // 检查外键约束
            const orphanRecords = await this.dataAccess._all(`
                SELECT pr.id FROM point_records pr
                LEFT JOIN students s ON pr.student_id = s.id
                WHERE s.id IS NULL
            `);

            if (orphanRecords.length > 0) {
                results.issues.push(`发现 ${orphanRecords.length} 条孤立的积分记录`);
                results.valid = false;
            }

            const orphanOrders = await this.dataAccess._all(`
                SELECT o.id FROM orders o
                LEFT JOIN students s ON o.student_id = s.id
                LEFT JOIN products p ON o.product_id = p.id
                WHERE s.id IS NULL OR p.id IS NULL
            `);

            if (orphanOrders.length > 0) {
                results.issues.push(`发现 ${orphanOrders.length} 条孤立的订单记录`);
                results.valid = false;
            }

        } catch (error) {
            results.valid = false;
            results.issues.push(`验证失败: ${error.message}`);
        }

        return results;
    }

    /**
     * 修复损坏的数据
     */
    async repairCorruptedData() {
        console.log('检查数据完整性...');

        const integrity = await this.validateDataIntegrity();

        if (integrity.valid) {
            console.log('数据完整，无需修复');
            return;
        }

        console.log('发现问题，开始修复...');

        for (const issue of integrity.issues) {
            console.log(`处理问题: ${issue}`);

            if (issue.includes('学生表为空')) {
                await this.initializeStudents();
            }

            if (issue.includes('孤立的积分记录')) {
                await this.dataAccess._run(`
                    DELETE FROM point_records
                    WHERE student_id NOT IN (SELECT id FROM students)
                `);
                console.log('已清理孤立的积分记录');
            }

            if (issue.includes('孤立的订单记录')) {
                await this.dataAccess._run(`
                    DELETE FROM orders
                    WHERE student_id NOT IN (SELECT id FROM students)
                    OR product_id NOT IN (SELECT id FROM products)
                `);
                console.log('已清理孤立的订单记录');
            }
        }

        console.log('数据修复完成');
    }
}

module.exports = DataInitializer;
