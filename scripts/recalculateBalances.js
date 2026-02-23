#!/usr/bin/env node

/**
 * 重新计算学生积分余额脚本
 * 根据积分记录重新计算每个学生的积分余额
 */

const { sqliteConnection } = require('../utils/sqliteConnection');

class BalanceRecalculator {
    constructor() {
        this.results = {
            updated: 0,
            errors: []
        };
    }

    async recalculateAllBalances() {
        console.log('🔄 开始重新计算学生积分余额...');
        
        try {
            // 获取所有学生
            const students = await this.getAllStudents();
            console.log(`📊 找到 ${students.length} 个学生`);
            
            // 为每个学生重新计算积分
            for (const student of students) {
                await this.recalculateStudentBalance(student.id);
            }
            
            console.log(`✅ 成功更新了 ${this.results.updated} 个学生的积分余额`);
            
            if (this.results.errors.length > 0) {
                console.log(`⚠️  ${this.results.errors.length} 个错误:`);
                this.results.errors.forEach(error => console.log(`  - ${error}`));
            }
            
        } catch (error) {
            console.error('❌ 重新计算失败:', error);
            throw error;
        } finally {
            await sqliteConnection.close();
        }
    }

    async getAllStudents() {
        return new Promise((resolve, reject) => {
            const query = 'SELECT id, name FROM students';
            sqliteConnection.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async recalculateStudentBalance(studentId) {
        try {
            // 计算学生的总积分
            const totalPoints = await this.calculateTotalPoints(studentId);
            
            // 更新学生记录
            await this.updateStudentBalance(studentId, totalPoints);
            
            this.results.updated++;
            console.log(`✅ 学生 ${studentId}: ${totalPoints} 积分`);
            
        } catch (error) {
            const errorMsg = `学生 ${studentId}: ${error.message}`;
            this.results.errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
        }
    }

    async calculateTotalPoints(studentId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT COALESCE(SUM(points), 0) as total 
                FROM points 
                WHERE studentId = ?
            `;
            sqliteConnection.db.get(query, [studentId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.total || 0);
                }
            });
        });
    }

    async updateStudentBalance(studentId, totalPoints) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE students 
                SET totalPoints = ?, currentPoints = ?, updatedAt = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            sqliteConnection.db.run(query, [totalPoints, totalPoints, studentId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }
}

async function main() {
    const recalculator = new BalanceRecalculator();
    
    try {
        await recalculator.recalculateAllBalances();
        console.log('\n🎉 积分余额重新计算完成！');
        
    } catch (error) {
        console.error('\n💥 积分余额重新计算失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = BalanceRecalculator;