/**
 * 数据库初始化工具单元测试
 */

const DatabaseInitializer = require('../utils/databaseInitializer');
const path = require('path');
const fs = require('fs').promises;

describe('DatabaseInitializer', () => {
    let initializer;
    const testDbPath = path.join(__dirname, 'test_init.db');

    beforeAll(() => {
        initializer = new DatabaseInitializer();
    });

    afterAll(async () => {
        // 清理测试数据库
        try {
            await fs.unlink(testDbPath);
        } catch (error) {
            // 忽略文件不存在的错误
        }
    });

    describe('SQLite初始化', () => {
        test('应该能够初始化SQLite数据库', async () => {
            await expect(initializer.initializeSQLite(testDbPath)).resolves.toBe(true);
            
            // 验证数据库文件是否创建
            const stats = await fs.stat(testDbPath);
            expect(stats.isFile()).toBe(true);
        });

        test('应该能够验证数据库结构', async () => {
            await expect(initializer.validateDatabaseSchema('sqlite', { database: testDbPath }))
                .resolves.toBe(true);
        });

        test('应该能够获取数据库统计信息', async () => {
            const stats = await initializer.getDatabaseStats('sqlite', 'default', { database: testDbPath });
            
            expect(stats).toBeDefined();
            expect(stats.storageType).toBe('sqlite');
            expect(stats.classId).toBe('default');
            expect(typeof stats.totalStudents).toBe('number');
            expect(typeof stats.totalProducts).toBe('number');
            expect(stats.totalProducts).toBeGreaterThan(0); // 应该有默认商品
        });

        test('应该能够创建数据库备份', async () => {
            const backupFile = await initializer.createDatabaseBackup('sqlite', 'default', { database: testDbPath });
            
            expect(backupFile).toBeDefined();
            expect(backupFile).toContain('sqlite_backup_');
            
            // 验证备份文件存在
            const stats = await fs.stat(backupFile);
            expect(stats.isFile()).toBe(true);
            
            // 验证备份内容
            const backupContent = JSON.parse(await fs.readFile(backupFile, 'utf8'));
            expect(backupContent.classId).toBe('default');
            expect(backupContent.data).toBeDefined();
            expect(backupContent.data.products).toBeDefined();
            
            // 清理备份文件
            await fs.unlink(backupFile);
        });
    });

    describe('SQL脚本解析', () => {
        test('应该能够正确解析SQL脚本', () => {
            const sqlScript = `
                -- 这是注释
                CREATE TABLE test (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL
                );
                
                INSERT INTO test VALUES ('1', 'Test');
                
                -- 另一个注释
                CREATE INDEX idx_test ON test(name);
            `;
            
            const statements = initializer.parseSQLScript(sqlScript);
            
            expect(statements).toHaveLength(3);
            expect(statements[0]).toContain('CREATE TABLE test');
            expect(statements[1]).toContain('INSERT INTO test');
            expect(statements[2]).toContain('CREATE INDEX idx_test');
        });

        test('应该能够处理包含字符串的SQL语句', () => {
            const sqlScript = `
                INSERT INTO test VALUES ('1', 'Test with; semicolon');
                CREATE TABLE test2 (name TEXT);
            `;
            
            const statements = initializer.parseSQLScript(sqlScript);
            
            expect(statements).toHaveLength(2);
            expect(statements[0]).toContain("'Test with; semicolon'");
            expect(statements[1]).toContain('CREATE TABLE test2');
        });
    });
});