#!/usr/bin/env node

/**
 * JSON到SQLite数据迁移脚本
 * 
 * 功能：
 * - 将现有的JSON文件数据迁移到SQLite数据库
 * - 保持数据完整性和一致性
 * - 提供迁移进度反馈
 */

const fs = require('fs').promises;
const path = require('path');
const { StorageAdapterFactory } = require('../adapters/storageAdapterFactory');

class JsonToSqliteMigrator {
    constructor() {
        this.jsonDataDir = './data';
        this.sqliteDbPath = './data/classroom_points.db';
        this.classId = 'default';
    }

    async migrate() {
        console.log('开始JSON到SQLite数据迁移...');
        
        try {
            // 创建存储适配器
            const factory = new StorageAdapterFactory();
            const sqliteAdapter = await factory.createAdapter('sqlite', {
                database: this.sqliteDbPath
            });

            // 读取JSON数据
            const jsonData = await this.readJsonData();
            console.log('JSON数据读取完成');

            // 迁移数据
            await this.migrateData(sqliteAdapter, jsonData);
            
            // 关闭连接
            await sqliteAdapter.disconnect();
            
            console.log('数据迁移完成！');
            console.log(`SQLite数据库位置: ${this.sqliteDbPath}`);
            
        } catch (error) {
            console.error('数据迁移失败:', error);
            process.exit(1);
        }
    }

    async readJsonData() {
        const data = {};
        
        // 读取各类数据文件
        const files = [
            'students.json',
            'teachers.json', 
            'points.json',
            'products.json',
            'orders.json'
        ];

        for (const file of files) {
            const filePath = path.join(this.jsonDataDir, file);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const key = file.replace('.json', '');
                data[key] = JSON.parse(content);
                console.log(`读取 ${file}: ${data[key].length} 条记录`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log(`文件 ${file} 不存在，跳过`);
                    data[file.replace('.json', '')] = [];
                } else {
                    throw error;
                }
            }
        }

        return data;
    }

    async migrateData(adapter, jsonData) {
        console.log('开始数据迁移...');

        try {
            await adapter.beginTransaction();

            // 1. 迁移教师数据
            if (jsonData.teachers && jsonData.teachers.length > 0) {
                console.log('迁移教师数据...');
                for (const teacher of jsonData.teachers) {
                    await adapter.createUser(this.classId, {
                        id: teacher.id,
                        username: teacher.username,
                        name: teacher.name,
                        role: teacher.role || 'teacher'
                    });
                }
                console.log(`教师数据迁移完成: ${jsonData.teachers.length} 条`);
            }

            // 2. 迁移学生数据
            if (jsonData.students && jsonData.students.length > 0) {
                console.log('迁移学生数据...');
                for (const student of jsonData.students) {
                    await adapter.createStudent(this.classId, {
                        id: student.id,
                        name: student.name,
                        studentNumber: student.classStudentNumber || student.fullStudentNumber,
                        username: student.username || student.classStudentNumber
                    });
                }
                console.log(`学生数据迁移完成: ${jsonData.students.length} 条`);
            }

            // 3. 迁移商品数据
            if (jsonData.products && jsonData.products.length > 0) {
                console.log('迁移商品数据...');
                for (const product of jsonData.products) {
                    await adapter.createProduct(this.classId, {
                        id: product.id,
                        name: product.name,
                        description: product.description || '',
                        price: product.price,
                        stock: product.stock || 0,
                        isActive: product.isActive !== false
                    });
                }
                console.log(`商品数据迁移完成: ${jsonData.products.length} 条`);
            }

            // 4. 迁移积分记录
            if (jsonData.points && jsonData.points.length > 0) {
                console.log('迁移积分记录...');
                for (const point of jsonData.points) {
                    await adapter.createPointRecord(this.classId, {
                        id: point.id,
                        studentId: point.studentId,
                        teacherId: point.teacherId || 'admin_default',
                        amount: point.amount,
                        reason: point.reason || '数据迁移',
                        type: point.type || 'manual'
                    });
                }
                console.log(`积分记录迁移完成: ${jsonData.points.length} 条`);
            }

            // 5. 迁移订单数据
            if (jsonData.orders && jsonData.orders.length > 0) {
                console.log('迁移订单数据...');
                for (const order of jsonData.orders) {
                    await adapter.createOrder(this.classId, {
                        id: order.id,
                        studentId: order.studentId,
                        productId: order.productId,
                        quantity: order.quantity || 1,
                        totalPrice: order.totalPrice || 0,
                        status: order.status || 'pending'
                    });
                }
                console.log(`订单数据迁移完成: ${jsonData.orders.length} 条`);
            }

            await adapter.commitTransaction();
            console.log('所有数据迁移完成');

        } catch (error) {
            await adapter.rollbackTransaction();
            throw error;
        }
    }

    async validateMigration(adapter, jsonData) {
        console.log('验证迁移结果...');

        const stats = await adapter.getClassStatistics(this.classId);
        
        console.log('迁移统计:');
        console.log(`- 学生数量: ${stats.totalStudents}`);
        console.log(`- 商品数量: ${stats.totalProducts}`);
        console.log(`- 订单数量: ${stats.totalOrders}`);
        console.log(`- 积分记录: ${stats.totalPointRecords}`);

        return true;
    }
}

// 执行迁移
if (require.main === module) {
    const migrator = new JsonToSqliteMigrator();
    migrator.migrate().catch(console.error);
}

module.exports = JsonToSqliteMigrator;