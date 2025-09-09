const fs = require('fs').promises;
const path = require('path');
const DataAccess = require('../utils/dataAccess');

/**
 * 简单的测试运行器
 */
class SimpleTestRunner {
    constructor() {
        this.tests = [];
        this.beforeAllFn = null;
        this.afterAllFn = null;
        this.beforeEachFn = null;
        this.afterEachFn = null;
    }

    describe(name, fn) {
        console.log(`\n运行测试套件: ${name}`);
        fn();
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    beforeAll(fn) {
        this.beforeAllFn = fn;
    }

    afterAll(fn) {
        this.afterAllFn = fn;
    }

    beforeEach(fn) {
        this.beforeEachFn = fn;
    }

    afterEach(fn) {
        this.afterEachFn = fn;
    }

    expect(actual) {
        return {
            toBe: (expected) => {
                if (actual !== expected) {
                    throw new Error(`期望 ${expected}，但得到 ${actual}`);
                }
            },
            toEqual: (expected) => {
                if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                    throw new Error(`期望 ${JSON.stringify(expected)}，但得到 ${JSON.stringify(actual)}`);
                }
            },
            toHaveProperty: (prop) => {
                if (!(prop in actual)) {
                    throw new Error(`期望对象包含属性 ${prop}`);
                }
            }
        };
    }

    async run() {
        try {
            if (this.beforeAllFn) {
                await this.beforeAllFn();
            }

            let passed = 0;
            let failed = 0;

            for (const test of this.tests) {
                try {
                    if (this.beforeEachFn) {
                        await this.beforeEachFn();
                    }

                    await test.fn();
                    console.log(`✓ ${test.name}`);
                    passed++;

                    if (this.afterEachFn) {
                        await this.afterEachFn();
                    }
                } catch (error) {
                    console.log(`✗ ${test.name}: ${error.message}`);
                    failed++;
                }
            }

            if (this.afterAllFn) {
                await this.afterAllFn();
            }

            console.log(`\n测试结果: ${passed} 通过, ${failed} 失败`);
            return failed === 0;
        } catch (error) {
            console.error('测试运行失败:', error);
            return false;
        }
    }
}

// 创建测试运行器实例
const testRunner = new SimpleTestRunner();

// 全局测试函数
global.describe = (name, fn) => testRunner.describe(name, fn);
global.test = (name, fn) => testRunner.test(name, fn);
global.beforeAll = (fn) => testRunner.beforeAll(fn);
global.afterAll = (fn) => testRunner.afterAll(fn);
global.beforeEach = (fn) => testRunner.beforeEach(fn);
global.afterEach = (fn) => testRunner.afterEach(fn);
global.expect = (actual) => testRunner.expect(actual);

/**
 * 数据访问层测试
 */
describe('DataAccess', () => {
    let dataAccess;
    const testDir = 'test_data';
    const testFile = 'test.json';
    const testData = { test: 'data', number: 123 };

    beforeAll(async () => {
        dataAccess = new DataAccess(testDir);
        await dataAccess.ensureDirectories();
    });

    afterAll(async () => {
        // 清理测试文件
        try {
            await fs.rmdir(path.join(testDir, 'backups'), { recursive: true });
            await fs.rmdir(testDir, { recursive: true });
        } catch (error) {
            console.log('清理测试文件失败:', error.message);
        }
    });

    beforeEach(async () => {
        // 清理测试文件
        try {
            await fs.unlink(path.join(testDir, testFile));
        } catch (error) {
            // 文件不存在，忽略错误
        }
    });

    test('应该能够创建数据目录', async () => {
        const exists = await fs.access(testDir).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });

    test('应该能够写入和读取JSON文件', async () => {
        await dataAccess.writeFile(testFile, testData);
        const readData = await dataAccess.readFile(testFile);
        
        expect(readData).toEqual(testData);
    });

    test('应该能够处理不存在的文件', async () => {
        const defaultData = { default: true };
        const readData = await dataAccess.readFile('nonexistent.json', defaultData);
        
        expect(readData).toEqual(defaultData);
    });

    test('应该能够检查文件是否存在', async () => {
        expect(await dataAccess.fileExists(testFile)).toBe(false);
        
        await dataAccess.writeFile(testFile, testData);
        expect(await dataAccess.fileExists(testFile)).toBe(true);
    });

    test('应该能够创建备份文件', async () => {
        await dataAccess.writeFile(testFile, testData);
        await dataAccess.createBackup(testFile);
        
        const backupDir = path.join(testDir, 'backups');
        const backupFiles = await fs.readdir(backupDir);
        const hasBackup = backupFiles.some(file => file.startsWith(testFile));
        
        expect(hasBackup).toBe(true);
    });

    test('应该能够获取文件状态信息', async () => {
        await dataAccess.writeFile(testFile, testData);
        const stats = await dataAccess.getFileStats(testFile);
        
        expect(stats).toHaveProperty('size');
        expect(stats).toHaveProperty('created');
        expect(stats).toHaveProperty('modified');
        expect(stats).toHaveProperty('accessed');
        expect(typeof stats.size).toBe('number');
    });
});

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testRunner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}