const fs = require('fs').promises;
const path = require('path');
const PointsService = require('../services/pointsService');
const StudentService = require('../services/studentService');
const { PointRecord } = require('../models/dataModels');

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
            },
            toBeGreaterThanOrEqual: (expected) => {
                if (actual < expected) {
                    throw new Error(`期望大于等于 ${expected}，但得到 ${actual}`);
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
 * 积分服务测试
 */
describe('PointsService', () => {
    let pointsService;
    let studentService;
    const testDir = 'test_data';
    const testStudent = {
        id: '2024888',
        name: '测试学生',
        class: '初一(1)班',
        balance: 0
    };

    beforeAll(async () => {
        // 使用测试数据目录
        pointsService = new PointsService();
        pointsService.dataAccess.dataDir = testDir;
        pointsService.studentService.dataAccess.dataDir = testDir;
        
        studentService = new StudentService();
        studentService.dataAccess.dataDir = testDir;
        
        await pointsService.dataAccess.ensureDirectories();
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
            await fs.unlink(path.join(testDir, 'points.json'));
            await fs.unlink(path.join(testDir, 'students.json'));
        } catch (error) {
            // 文件不存在，忽略错误
        }
        
        // 创建测试学生
        await studentService.createStudent(testStudent);
    });

    test('应该能够添加积分记录', async () => {
        const recordData = {
            studentId: testStudent.id,
            points: 10,
            reason: '课堂表现优秀',
            operatorId: 'admin',
            type: 'add'
        };

        const record = await pointsService.addPointRecord(recordData);
        
        expect(record).toBeInstanceOf(PointRecord);
        expect(record.studentId).toBe(testStudent.id);
        expect(record.points).toBe(10);
        expect(record.reason).toBe('课堂表现优秀');
    });

    test('应该能够获取学生积分记录', async () => {
        const recordData = {
            studentId: testStudent.id,
            points: 15,
            reason: '作业完成优秀',
            operatorId: 'admin',
            type: 'add'
        };

        await pointsService.addPointRecord(recordData);
        const records = await pointsService.getPointRecordsByStudent(testStudent.id);
        
        expect(records.length).toBeGreaterThan(0);
        expect(records[0]).toBeInstanceOf(PointRecord);
        expect(records[0].studentId).toBe(testStudent.id);
    });

    test('应该能够计算学生积分余额', async () => {
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 20,
            reason: '测试加分',
            operatorId: 'admin',
            type: 'add'
        });

        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: -5,
            reason: '测试减分',
            operatorId: 'admin',
            type: 'subtract'
        });

        const balance = await pointsService.calculateStudentBalance(testStudent.id);
        expect(balance).toBe(15);
    });

    test('应该能够获取总积分排行榜', async () => {
        // 创建另一个测试学生
        const testStudent2 = {
            id: '2024889',
            name: '测试学生2',
            class: '初一(1)班',
            balance: 0
        };
        await studentService.createStudent(testStudent2);

        // 添加积分记录
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 30,
            reason: '测试',
            operatorId: 'admin',
            type: 'add'
        });

        await pointsService.addPointRecord({
            studentId: testStudent2.id,
            points: 20,
            reason: '测试',
            operatorId: 'admin',
            type: 'add'
        });

        const ranking = await pointsService.getPointsRanking('total');
        
        expect(ranking.length).toBeGreaterThanOrEqual(2);
        expect(ranking[0]).toHaveProperty('rank');
        expect(ranking[0]).toHaveProperty('studentId');
        expect(ranking[0]).toHaveProperty('studentName');
        expect(ranking[0]).toHaveProperty('points');
        expect(ranking[0].rank).toBe(1);
    });

    test('应该能够获取日榜排行榜', async () => {
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 25,
            reason: '今日表现',
            operatorId: 'admin',
            type: 'add'
        });

        const ranking = await pointsService.getPointsRanking('daily');
        
        expect(ranking.length).toBeGreaterThan(0);
        expect(ranking[0]).toHaveProperty('type');
        expect(ranking[0].type).toBe('daily');
    });

    test('应该能够获取周榜排行榜', async () => {
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 35,
            reason: '本周表现',
            operatorId: 'admin',
            type: 'add'
        });

        const ranking = await pointsService.getPointsRanking('weekly');
        
        expect(ranking.length).toBeGreaterThan(0);
        expect(ranking[0]).toHaveProperty('type');
        expect(ranking[0].type).toBe('weekly');
    });

    test('应该能够获取学生排名信息', async () => {
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 40,
            reason: '测试排名',
            operatorId: 'admin',
            type: 'add'
        });

        const rankInfo = await pointsService.getStudentRankInfo(testStudent.id);
        
        expect(rankInfo).toHaveProperty('studentId');
        expect(rankInfo).toHaveProperty('totalRank');
        expect(rankInfo).toHaveProperty('dailyRank');
        expect(rankInfo).toHaveProperty('weeklyRank');
        expect(rankInfo).toHaveProperty('totalStudents');
        expect(rankInfo.studentId).toBe(testStudent.id);
    });

    test('应该能够获取积分统计信息', async () => {
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 50,
            reason: '统计测试',
            operatorId: 'admin',
            type: 'add'
        });

        const stats = await pointsService.getPointsStatistics();
        
        expect(stats).toHaveProperty('totalRecords');
        expect(stats).toHaveProperty('totalPointsAwarded');
        expect(stats).toHaveProperty('totalPointsDeducted');
        expect(stats).toHaveProperty('averageBalance');
        expect(stats).toHaveProperty('activeStudents');
        expect(stats).toHaveProperty('recentActivity');
        expect(stats.totalRecords).toBeGreaterThan(0);
    });

    test('应该能够同步学生积分余额', async () => {
        // 手动修改学生余额使其不一致
        await studentService.updateStudentBalance(testStudent.id, 999);
        
        // 添加积分记录
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 10,
            reason: '同步测试',
            operatorId: 'admin',
            type: 'add'
        });

        // 同步余额
        await pointsService.syncAllStudentBalances();
        
        const student = await studentService.getStudentById(testStudent.id);
        const calculatedBalance = await pointsService.calculateStudentBalance(testStudent.id);
        
        expect(student.balance).toBe(calculatedBalance);
    });

    test('应该能够按时间范围获取积分记录', async () => {
        await pointsService.addPointRecord({
            studentId: testStudent.id,
            points: 60,
            reason: '时间范围测试',
            operatorId: 'admin',
            type: 'add'
        });

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const records = await pointsService.getPointRecordsByDateRange(startOfDay, endOfDay);
        
        expect(records.length).toBeGreaterThan(0);
        expect(records[0]).toBeInstanceOf(PointRecord);
    });
});

// 如果直接运行此文件，执行测试
if (require.main === module) {
    testRunner.run().then(success => {
        process.exit(success ? 0 : 1);
    });
}