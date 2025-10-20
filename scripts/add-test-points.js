#!/usr/bin/env node

/**
 * 添加测试积分数据
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function addTestPoints() {
    console.log('🎯 添加测试积分数据...');
    
    // 读取配置
    const configPath = path.join(__dirname, '../config/v1.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const dbPath = path.resolve(config.database.path);
    
    const db = new sqlite3.Database(dbPath);
    
    try {
        // 获取一些学生ID
        const students = await new Promise((resolve, reject) => {
            db.all("SELECT id FROM users WHERE role='student' LIMIT 10", (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`找到 ${students.length} 个学生`);
        
        // 获取一个教师ID
        const teacher = await new Promise((resolve, reject) => {
            db.get("SELECT id FROM users WHERE role='teacher' LIMIT 1", (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!teacher) {
            console.log('❌ 没有找到教师');
            return;
        }
        
        console.log(`使用教师: ${teacher.id}`);
        
        // 为每个学生添加随机积分记录
        const pointRecords = [];
        const reasons = [
            '课堂表现优秀',
            '作业完成优秀',
            '积极回答问题',
            '帮助同学',
            '课堂纪律良好',
            '迟到',
            '作业未完成',
            '课堂违纪'
        ];
        
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const recordCount = Math.floor(Math.random() * 5) + 1; // 1-5条记录
            
            for (let j = 0; j < recordCount; j++) {
                const reason = reasons[Math.floor(Math.random() * reasons.length)];
                const isPositive = Math.random() > 0.3; // 70%概率是正分
                const amount = isPositive ? 
                    Math.floor(Math.random() * 5) + 1 : // 1-5分
                    -(Math.floor(Math.random() * 3) + 1); // -1到-3分
                
                const recordId = `test_${Date.now()}_${i}_${j}`;
                const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(); // 过去7天内
                
                pointRecords.push({
                    id: recordId,
                    student_id: student.id,
                    teacher_id: teacher.id,
                    amount: amount,
                    reason: reason,
                    type: isPositive ? 'reward' : 'penalty',
                    created_at: createdAt
                });
            }
        }
        
        console.log(`准备添加 ${pointRecords.length} 条积分记录...`);
        
        // 批量插入积分记录
        const stmt = db.prepare(`
            INSERT INTO point_records (id, student_id, teacher_id, amount, reason, type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const record of pointRecords) {
            await new Promise((resolve, reject) => {
                stmt.run([
                    record.id,
                    record.student_id,
                    record.teacher_id,
                    record.amount,
                    record.reason,
                    record.type,
                    record.created_at
                ], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
        
        stmt.finalize();
        
        // 验证数据
        const totalRecords = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM point_records", (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        console.log(`✅ 成功添加积分记录，总记录数: ${totalRecords}`);
        
        // 显示一些统计信息
        const stats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    u.name,
                    u.id,
                    COALESCE(SUM(pr.amount), 0) as total_points
                FROM users u
                LEFT JOIN point_records pr ON u.id = pr.student_id
                WHERE u.role = 'student'
                GROUP BY u.id, u.name
                ORDER BY total_points DESC
                LIMIT 5
            `, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log('\n📊 积分排行榜前5名:');
        stats.forEach((student, index) => {
            console.log(`   ${index + 1}. ${student.name} (${student.id}): ${student.total_points}分`);
        });
        
    } catch (error) {
        console.error('❌ 添加测试数据失败:', error);
    } finally {
        db.close();
    }
}

addTestPoints().catch(console.error);