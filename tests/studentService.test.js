const fs = require('fs').promises;
const path = require('path');
const StudentService = require('../services/studentService');
const { StudentInfo } = require('../models/dataModels');

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
            },
            toBeNull: () => {
                if (actual !== null) {
                    throw new Error(`期望为 null，但得到 ${actual}`);
                }
            },
            toBeInstanceOf: (expectedClass) => {
                if (!(actual instanceof expectedClass)) {
                    throw new Error(`期望为 ${expectedClass.name} 实例，但得到 ${actual.constructor.name}`);
                }
            },
            toContain: (expected) => {
                if (!actual.includes(expected)) {
                    throw new Error(`期望包含 ${expected}，但在 ${actual} 中未找到`);
                }
            },
            toBeGreaterThan: (expected) => {
                if (actual <= expected) {
                    throw new Error(`期望大于 ${expected}，但得到 ${actual}`);
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
 * 学生服务测试
 */
describe('StudentService', () => {
    let studentService;
    const testDir = 'test_data';
    const testStudentData = {
        id: '2024999',
        name: '测试学生',
        class: '初一(1)班',
        balance: 100
    };

    beforeAll(async () => {
        // 使用测试数据目录
        studentService = new StudentService();
        studentService.dataAccess.dataDir = testDir;
        await studentService.dataAccess.ensureDirectories();
    });

    afterAll(async () => {
        // 清理测试文件
        try {
            await fs.rm(testDir, { recursive: true });
        } catch (error) {
            console.log('清理测试文件失败:', error.message);
        }
    });

    beforeEach(async () => {
        // 清理测试数据
        try {
            await fs.unlink(path.join(testDir, 'students.json'));
        } catch (error) {
            // 文件不存在，忽略错误
        }
    });

    test('应该能够创建新学生', async () => {
        const student = await studentService.createStudent(testStudentData);
        
        expect(student).toBeInstanceOf(StudentInfo);
        expect(student.id).toBe(testStudentData.id);
        expect(student.name).toBe(testStudentData.name);
        expect(student.class).toBe(testStudentData.class);
        expect(student.balance).toBe(testStudentData.balance);
    });

    test('应该能够获取学生信息', async () => {
        await studentService.createStudent(testStudentData);
        const student = await studentService.getStudentById(testStudentData.id);
        
        expect(student).toBeInstanceOf(StudentInfo);
        expect(student.id).toBe(testStudentData.id);
    });

    test('应该能够获取所有学生', async () => {
        await studentService.createStudent(testStudentData);
        const students = await studentService.getAllStudents();
        
        expect(students.length).toBeGreaterThan(0);
        expect(students[0]).toBeInstanceOf(StudentInfo);
    });

    test('应该能够更新学生信息', async () => {
        await studentService.createStudent(testStudentData);
        const updatedStudent = await studentService.updateStudent(testStudentData.id, {
            name: '更新后的姓名',
            balance: 200
        });
        
        expect(updatedStudent.name).toBe('更新后的姓名');
        expect(updatedStudent.balance).toBe(200);
    });

    test('应该能够删除学生', async () => {
        await studentService.createStudent(testStudentData);
        const result = await studentService.deleteStudent(testStudentData.id);
        
        expect(result).toBe(true);
        
        const student = await studentService.getStudentById(testStudentData.id);
        expect(student).toBeNull();
    });

    test('应该能够验证学生登录', async () => {
        await studentService.createStudent(testStudentData);
        const student = await studentService.validateStudentLogin(testStudentData.id);
        
        expect(student).toBeInstanceOf(StudentInfo);
        expect(student.id).toBe(testStudentData.id);
    });

    test('应该能够搜索学生', async () => {
        await studentService.createStudent(testStudentData);
        const results = await studentService.searchStudents('测试');
        
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toContain('测试');
    });

    test('应该能够获取学生统计信息', async () => {
        await studentService.createStudent(testStudentData);
        const stats = await studentService.getStudentStatistics();
        
        expect(stats).toHaveProperty('totalStudents');
        expect(stats).toHaveProperty('totalBalance');
        expect(stats).toHaveProperty('averageBalance');
        expect(stats.totalStudents).toBeGreaterThan(0);
    });

    test('应该能够更新学生积分余额', async () => {
        await studentService.createStudent(testStudentData);
        const updatedStudent = await studentService.updateStudentBalance(testStudentData.id, 300);
        
        expect(updatedStudent.balance).toBe(300);
    });

    test('应该能够按班级获取学生', async () => {
        await studentService.createStudent(testStudentData);
        const students = await studentService.getStudentsByClass('初一(1)班');
        
        expect(students.length).toBeGreaterThan(0);
        expect(students[0].class).toBe('初一(1)班');
    });
});

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testRunner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}