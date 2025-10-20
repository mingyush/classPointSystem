/**
 * SQLite扩展集成测试
 * 测试SQLite特有功能和性能特性
 */

const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const SQLiteStorageAdapter = require('../adapters/sqliteStorageAdapter');

// 设置测试环境
process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'sqlite';
process.env.DB_PATH = path.join(__dirname, 'test_sqlite_extended.db');

describe('SQLite扩展集成测试', () => {
    let app;
    let adapter;
    let authToken;
    const testClassId = 'test_class_sqlite';
    const testDbPath = process.env.DB_PATH;

    beforeAll(async () => {
        // 清理可能存在的测试数据库
        try {
            await fs.unlink(testDbPath);
        } catch (error) {
            // 忽略文件不存在错误
        }

        // 创建SQLite适配器
        adapter = new SQLiteStorageAdapter({
            database: testDbPath,
            enableWAL: true
        });
        
        await adapter.connect();
        
        // 创建测试表结构
        await createTestTables();
        
        // 启动应用
        app = require('../server');
        
        // 等待应用初始化
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 获取认证令牌
        const authResponse = await request(app)
            .post('/api/auth/teacher-login')
            .send({
                teacherId: 'admin',
                password: 'admin123'
            });
        
        if (authResponse.status === 200) {
            authToken = authResponse.body.data.token;
        }
    });

    afterAll(async () => {
        // 清理资源
        if (adapter) {
            await adapter.disconnect();
        }
        
        if (app && app.close) {
            app.close();
        }
        
        // 清理测试数据库
        try {
            await fs.unlink(testDbPath);
        } catch (error) {
            // 忽略清理错误
        }
    });

    async function createTestTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                class_id TEXT NOT NULL DEFAULT 'default',
                username TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
                student_number TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            )`,
            
            `CREATE TABLE IF NOT EXISTS point_records (
                id TEXT PRIMARY KEY,
                class_id TEXT NOT NULL DEFAULT 'default',
                student_id TEXT NOT NULL,
                teacher_id TEXT NOT NULL,
                amount INTEGER NOT NULL,
                reason TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('manual', 'reward', 'penalty', 'purchase')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES users(id),
                FOREIGN KEY (teacher_id) REFERENCES users(id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                class_id TEXT NOT NULL DEFAULT 'default',
                name TEXT NOT NULL,
                description TEXT,
                price INTEGER NOT NULL,
                stock INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            )`,
            
            `CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                class_id TEXT NOT NULL DEFAULT 'default',
                student_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                total_price INTEGER NOT NULL,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                confirmed_at TEXT,
                completed_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (student_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS reward_penalty_items (
                id TEXT PRIMARY KEY,
                class_id TEXT NOT NULL DEFAULT 'default',
                name TEXT NOT NULL,
                points INTEGER NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('reward', 'penalty')),
                is_active INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS system_state (
                id TEXT PRIMARY KEY DEFAULT 'default',
                mode TEXT DEFAULT 'normal' CHECK (mode IN ('normal', 'class')),
                current_teacher TEXT,
                session_start_time TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const sql of tables) {
            await adapter.run(sql);
        }

        // 创建索引以提高查询性能
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
            'CREATE INDEX IF NOT EXISTS idx_users_student_number ON users(student_number)',
            'CREATE INDEX IF NOT EXISTS idx_point_records_student_id ON point_records(student_id)',
            'CREATE INDEX IF NOT EXISTS idx_point_records_created_at ON point_records(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)'
        ];

        for (const sql of indexes) {
            await adapter.run(sql);
        }

        // 插入初始管理员用户
        await adapter.run(`
            INSERT OR IGNORE INTO users (id, class_id, username, name, role, is_active)
            VALUES ('admin', 'default', 'admin', '系统管理员', 'admin', 1)
        `);

        // 插入系统状态记录
        await adapter.run(`
            INSERT OR IGNORE INTO system_state (id, mode)
            VALUES ('default', 'normal')
        `);
    }

    describe('SQLite特有功能测试', () => {
        test('WAL模式验证', async () => {
            const result = await adapter.get('PRAGMA journal_mode');
            expect(result.journal_mode.toLowerCase()).toBe('wal');
        });

        test('外键约束验证', async () => {
            const result = await adapter.get('PRAGMA foreign_keys');
            expect(result.foreign_keys).toBe(1);
        });

        test('数据库文件完整性检查', async () => {
            const result = await adapter.get('PRAGMA integrity_check');
            expect(result.integrity_check).toBe('ok');
        });

        test('数据库统计信息', async () => {
            const stats = await adapter.query(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as user_count,
                    (SELECT COUNT(*) FROM point_records) as point_record_count,
                    (SELECT COUNT(*) FROM products) as product_count,
                    (SELECT COUNT(*) FROM orders) as order_count
            `);
            
            expect(stats[0]).toHaveProperty('user_count');
            expect(stats[0]).toHaveProperty('point_record_count');
            expect(stats[0]).toHaveProperty('product_count');
            expect(stats[0]).toHaveProperty('order_count');
        });
    });

    describe('事务处理测试', () => {
        test('事务提交成功', async () => {
            await adapter.beginTransaction();
            
            try {
                const student = await adapter.createStudent(testClassId, {
                    name: '事务测试学生',
                    classStudentNumber: 'TX001'
                });
                
                await adapter.createPointRecord(testClassId, {
                    studentId: student.id,
                    teacherId: 'admin',
                    amount: 10,
                    reason: '事务测试',
                    type: 'manual'
                });
                
                await adapter.commitTransaction();
                
                // 验证数据已提交
                const savedStudent = await adapter.getStudentById(testClassId, student.id);
                expect(savedStudent).toBeDefined();
                expect(savedStudent.name).toBe('事务测试学生');
                
                const balance = await adapter.calculatePointBalance(testClassId, student.id);
                expect(balance).toBe(10);
                
            } catch (error) {
                await adapter.rollbackTransaction();
                throw error;
            }
        });

        test('事务回滚处理', async () => {
            await adapter.beginTransaction();
            
            try {
                const student = await adapter.createStudent(testClassId, {
                    name: '回滚测试学生',
                    classStudentNumber: 'RB001'
                });
                
                // 故意创建一个会失败的操作
                await adapter.run('INSERT INTO invalid_table VALUES (1)');
                
                await adapter.commitTransaction();
                
            } catch (error) {
                await adapter.rollbackTransaction();
                
                // 验证数据已回滚
                const student = await adapter.getStudentByNumber(testClassId, 'RB001');
                expect(student).toBeNull();
            }
        });

        test('嵌套事务处理', async () => {
            // SQLite不支持真正的嵌套事务，但可以测试保存点
            await adapter.beginTransaction();
            
            try {
                const student1 = await adapter.createStudent(testClassId, {
                    name: '嵌套事务学生1',
                    classStudentNumber: 'NT001'
                });
                
                // 创建保存点
                await adapter.run('SAVEPOINT sp1');
                
                try {
                    const student2 = await adapter.createStudent(testClassId, {
                        name: '嵌套事务学生2',
                        classStudentNumber: 'NT002'
                    });
                    
                    // 释放保存点
                    await adapter.run('RELEASE SAVEPOINT sp1');
                    
                } catch (error) {
                    // 回滚到保存点
                    await adapter.run('ROLLBACK TO SAVEPOINT sp1');
                }
                
                await adapter.commitTransaction();
                
                // 验证学生1存在
                const savedStudent1 = await adapter.getStudentByNumber(testClassId, 'NT001');
                expect(savedStudent1).toBeDefined();
                
            } catch (error) {
                await adapter.rollbackTransaction();
                throw error;
            }
        });
    });

    describe('并发处理测试', () => {
        test('并发读取操作', async () => {
            // 创建测试数据
            const students = [];
            for (let i = 1; i <= 10; i++) {
                const student = await adapter.createStudent(testClassId, {
                    name: `并发测试学生${i}`,
                    classStudentNumber: `CR${i.toString().padStart(3, '0')}`
                });
                students.push(student);
            }

            // 并发读取
            const readPromises = students.map(student => 
                adapter.getStudentById(testClassId, student.id)
            );

            const results = await Promise.all(readPromises);
            
            expect(results).toHaveLength(10);
            results.forEach((result, index) => {
                expect(result).toBeDefined();
                expect(result.name).toBe(`并发测试学生${index + 1}`);
            });
        });

        test('并发写入操作', async () => {
            const writePromises = [];
            
            for (let i = 1; i <= 5; i++) {
                writePromises.push(
                    adapter.createStudent(testClassId, {
                        name: `并发写入学生${i}`,
                        classStudentNumber: `CW${i.toString().padStart(3, '0')}`
                    })
                );
            }

            const results = await Promise.allSettled(writePromises);
            
            // 验证所有写入都成功
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            expect(successCount).toBe(5);
        });

        test('并发积分操作', async () => {
            // 创建测试学生
            const student = await adapter.createStudent(testClassId, {
                name: '并发积分测试学生',
                classStudentNumber: 'CP001'
            });

            // 并发积分操作
            const pointOperations = [];
            for (let i = 1; i <= 10; i++) {
                pointOperations.push(
                    adapter.createPointRecord(testClassId, {
                        studentId: student.id,
                        teacherId: 'admin',
                        amount: i,
                        reason: `并发操作${i}`,
                        type: 'manual'
                    })
                );
            }

            const results = await Promise.allSettled(pointOperations);
            const successCount = results.filter(r => r.status === 'fulfilled').length;
            
            expect(successCount).toBe(10);
            
            // 验证最终积分余额
            const finalBalance = await adapter.calculatePointBalance(testClassId, student.id);
            expect(finalBalance).toBe(55); // 1+2+3+...+10 = 55
        });
    });

    describe('性能优化测试', () => {
        test('批量插入性能', async () => {
            const batchSize = 100;
            const startTime = Date.now();
            
            await adapter.beginTransaction();
            
            try {
                const insertPromises = [];
                for (let i = 1; i <= batchSize; i++) {
                    insertPromises.push(
                        adapter.createStudent(testClassId, {
                            name: `批量学生${i}`,
                            classStudentNumber: `BATCH${i.toString().padStart(4, '0')}`
                        })
                    );
                }
                
                await Promise.all(insertPromises);
                await adapter.commitTransaction();
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                console.log(`批量插入${batchSize}条记录耗时: ${duration}ms`);
                expect(duration).toBeLessThan(5000); // 应该在5秒内完成
                
            } catch (error) {
                await adapter.rollbackTransaction();
                throw error;
            }
        });

        test('复杂查询性能', async () => {
            const startTime = Date.now();
            
            // 执行复杂的排行榜查询
            const rankings = await adapter.query(`
                SELECT 
                    u.id,
                    u.name,
                    u.student_number,
                    COALESCE(SUM(pr.amount), 0) as total_points,
                    COUNT(pr.id) as record_count,
                    MAX(pr.created_at) as last_activity
                FROM users u
                LEFT JOIN point_records pr ON u.id = pr.student_id
                WHERE u.role = 'student' AND u.is_active = 1 AND u.class_id = ?
                GROUP BY u.id, u.name, u.student_number
                ORDER BY total_points DESC, last_activity DESC
                LIMIT 50
            `, [testClassId]);
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`复杂查询耗时: ${duration}ms, 返回${rankings.length}条记录`);
            expect(duration).toBeLessThan(1000); // 应该在1秒内完成
        });

        test('索引效果验证', async () => {
            // 测试有索引的查询
            const startTime1 = Date.now();
            await adapter.query('SELECT * FROM users WHERE role = ? LIMIT 10', ['student']);
            const duration1 = Date.now() - startTime1;
            
            // 测试无索引的查询
            const startTime2 = Date.now();
            await adapter.query('SELECT * FROM users WHERE name LIKE ? LIMIT 10', ['%测试%']);
            const duration2 = Date.now() - startTime2;
            
            console.log(`有索引查询耗时: ${duration1}ms, 无索引查询耗时: ${duration2}ms`);
            
            // 有索引的查询应该更快（在有足够数据的情况下）
            expect(duration1).toBeLessThan(100);
        });
    });

    describe('数据完整性测试', () => {
        test('外键约束验证', async () => {
            // 尝试插入无效的外键引用
            await expect(
                adapter.createPointRecord(testClassId, {
                    studentId: 'NON_EXISTENT_STUDENT',
                    teacherId: 'admin',
                    amount: 10,
                    reason: '测试外键约束',
                    type: 'manual'
                })
            ).rejects.toThrow();
        });

        test('检查约束验证', async () => {
            // 尝试插入无效的角色
            await expect(
                adapter.run(`
                    INSERT INTO users (id, class_id, username, name, role)
                    VALUES ('invalid_role_user', ?, 'test', '测试用户', 'invalid_role')
                `, [testClassId])
            ).rejects.toThrow();
        });

        test('唯一约束验证', async () => {
            // 创建第一个学生
            await adapter.createStudent(testClassId, {
                name: '唯一约束测试1',
                classStudentNumber: 'UNIQUE001'
            });

            // 尝试创建相同学号的学生
            await expect(
                adapter.createStudent(testClassId, {
                    name: '唯一约束测试2',
                    classStudentNumber: 'UNIQUE001'
                })
            ).rejects.toThrow();
        });
    });

    describe('备份和恢复测试', () => {
        test('数据库备份', async () => {
            const backupPath = path.join(__dirname, 'test_backup.db');
            
            try {
                // 创建一些测试数据
                const student = await adapter.createStudent(testClassId, {
                    name: '备份测试学生',
                    classStudentNumber: 'BACKUP001'
                });

                // 执行备份（简单的文件复制）
                await fs.copyFile(testDbPath, backupPath);
                
                // 验证备份文件存在
                const backupStats = await fs.stat(backupPath);
                expect(backupStats.isFile()).toBe(true);
                expect(backupStats.size).toBeGreaterThan(0);
                
                // 清理备份文件
                await fs.unlink(backupPath);
                
            } catch (error) {
                // 清理可能存在的备份文件
                try {
                    await fs.unlink(backupPath);
                } catch (cleanupError) {
                    // 忽略清理错误
                }
                throw error;
            }
        });

        test('数据导出功能', async () => {
            const exportData = await adapter.exportClassData(testClassId);
            
            expect(exportData).toHaveProperty('classId');
            expect(exportData).toHaveProperty('data');
            expect(exportData).toHaveProperty('exportTime');
            
            expect(exportData.data).toHaveProperty('students');
            expect(exportData.data).toHaveProperty('pointRecords');
            expect(exportData.data).toHaveProperty('products');
            expect(exportData.data).toHaveProperty('orders');
            
            expect(Array.isArray(exportData.data.students)).toBe(true);
            expect(Array.isArray(exportData.data.pointRecords)).toBe(true);
        });
    });

    describe('错误恢复测试', () => {
        test('数据库锁定处理', async () => {
            // 模拟长时间运行的事务
            await adapter.beginTransaction();
            
            try {
                // 在事务中执行操作
                await adapter.createStudent(testClassId, {
                    name: '锁定测试学生',
                    classStudentNumber: 'LOCK001'
                });
                
                // 尝试并发访问（应该能够处理）
                const concurrentRead = adapter.getStudents(testClassId);
                await expect(concurrentRead).resolves.toBeDefined();
                
                await adapter.commitTransaction();
                
            } catch (error) {
                await adapter.rollbackTransaction();
                throw error;
            }
        });

        test('连接中断恢复', async () => {
            // 断开连接
            await adapter.disconnect();
            
            // 尝试操作（应该失败）
            await expect(
                adapter.getStudents(testClassId)
            ).rejects.toThrow();
            
            // 重新连接
            await adapter.connect();
            
            // 验证连接恢复
            const students = await adapter.getStudents(testClassId);
            expect(Array.isArray(students)).toBe(true);
        });
    });

    describe('内存使用监控', () => {
        test('内存泄漏检测', async () => {
            const initialMemory = process.memoryUsage();
            
            // 执行大量操作
            for (let i = 0; i < 100; i++) {
                await adapter.getStudents(testClassId);
                await adapter.query('SELECT COUNT(*) as count FROM users');
            }
            
            // 强制垃圾回收（如果可用）
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            
            console.log(`内存使用变化: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100}MB`);
            
            // 内存增长应该在合理范围内
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
        });
    });
});