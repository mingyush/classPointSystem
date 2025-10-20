#!/usr/bin/env node

/**
 * 教室大屏问题诊断脚本
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

console.log('🔍 教室大屏问题诊断');
console.log('==================');

async function diagnose() {
    let allGood = true;

    // 1. 检查配置文件
    console.log('\n📋 1. 检查配置文件');
    try {
        const configPath = path.join(__dirname, '../config/v1.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('✅ 配置文件读取成功');
        console.log(`   数据库类型: ${config.database.type}`);
        console.log(`   数据库路径: ${config.database.path}`);
        
        // 检查数据库文件是否存在
        const dbPath = path.resolve(config.database.path);
        if (fs.existsSync(dbPath)) {
            console.log('✅ 数据库文件存在');
        } else {
            console.log('❌ 数据库文件不存在:', dbPath);
            allGood = false;
        }
    } catch (error) {
        console.log('❌ 配置文件读取失败:', error.message);
        allGood = false;
    }

    // 2. 检查数据库连接和数据
    console.log('\n📋 2. 检查数据库连接和数据');
    try {
        const configPath = path.join(__dirname, '../config/v1.json');
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const dbPath = path.resolve(config.database.path);
        
        const db = new sqlite3.Database(dbPath);
        
        // 检查表结构
        const tables = await new Promise((resolve, reject) => {
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => row.name));
            });
        });
        
        console.log('✅ 数据库连接成功');
        console.log('   表列表:', tables.join(', '));
        
        // 检查用户数据
        const userCount = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM users WHERE role='student'", (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        console.log(`   学生数量: ${userCount}`);
        
        if (userCount === 0) {
            console.log('⚠️  数据库中没有学生数据');
            allGood = false;
        }
        
        // 检查积分记录
        const pointCount = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM point_records", (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        console.log(`   积分记录数量: ${pointCount}`);
        
        // 检查商品数据
        const productCount = await new Promise((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        console.log(`   商品数量: ${productCount}`);
        
        db.close();
        
    } catch (error) {
        console.log('❌ 数据库检查失败:', error.message);
        allGood = false;
    }

    // 3. 检查关键文件
    console.log('\n📋 3. 检查关键文件');
    const criticalFiles = [
        'public/display/index.html',
        'public/js/display.js',
        'public/css/display.css',
        'public/js/common.js',
        'api/points.js',
        'api/students.js',
        'services/studentService.js',
        'adapters/storageAdapterFactory.js'
    ];
    
    for (const file of criticalFiles) {
        const filePath = path.join(__dirname, '..', file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file}`);
        } else {
            console.log(`❌ ${file} 不存在`);
            allGood = false;
        }
    }

    // 4. 检查端口占用
    console.log('\n📋 4. 检查端口占用');
    try {
        const net = require('net');
        const server = net.createServer();
        
        await new Promise((resolve, reject) => {
            server.listen(3000, () => {
                console.log('✅ 端口3000可用');
                server.close();
                resolve();
            });
            
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    console.log('⚠️  端口3000被占用');
                } else {
                    console.log('❌ 端口检查失败:', err.message);
                    allGood = false;
                }
                reject(err);
            });
        });
    } catch (error) {
        // 端口被占用是正常的，如果服务器正在运行
    }

    // 5. 检查依赖模块
    console.log('\n📋 5. 检查依赖模块');
    try {
        require('express');
        console.log('✅ express');
        
        require('sqlite3');
        console.log('✅ sqlite3');
        
        require('jsonwebtoken');
        console.log('✅ jsonwebtoken');
        
    } catch (error) {
        console.log('❌ 依赖模块缺失:', error.message);
        allGood = false;
    }

    // 总结
    console.log('\n📊 诊断结果');
    if (allGood) {
        console.log('✅ 所有检查通过，系统应该可以正常运行');
        console.log('\n💡 建议操作:');
        console.log('   1. 启动服务器: npm run start:dev');
        console.log('   2. 访问: http://localhost:3000/display');
        console.log('   3. 如果仍有问题，检查浏览器控制台错误');
    } else {
        console.log('❌ 发现问题，请根据上述错误信息进行修复');
        console.log('\n💡 常见解决方案:');
        console.log('   1. 运行数据导入: node scripts/import-class75-data.js');
        console.log('   2. 安装依赖: npm install');
        console.log('   3. 检查配置文件: config/v1.json');
    }
}

diagnose().catch(console.error);