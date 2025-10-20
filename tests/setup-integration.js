/**
 * 集成测试设置文件
 * 在所有集成测试运行前执行的初始化代码
 */

const path = require('path');
const fs = require('fs').promises;

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // 减少测试期间的日志输出

// 全局测试配置
global.TEST_CONFIG = {
    timeout: {
        short: 5000,
        medium: 15000,
        long: 30000,
        extended: 60000
    },
    database: {
        sqlite: {
            testDbPath: path.join(__dirname, 'test_integration.db'),
            memoryDb: ':memory:'
        },
        d1: {
            mockMode: true
        }
    },
    api: {
        baseUrl: 'http://localhost:3000',
        timeout: 10000
    }
};

// 全局测试工具函数
global.testUtils = {
    /**
     * 等待指定时间
     */
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    /**
     * 生成随机字符串
     */
    randomString: (length = 8) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    /**
     * 生成测试用户数据
     */
    generateTestUser: (type = 'student', suffix = '') => {
        const id = `TEST_${type.toUpperCase()}_${Date.now()}_${suffix || testUtils.randomString(4)}`;
        return {
            id,
            username: id.toLowerCase(),
            name: `测试${type === 'student' ? '学生' : '教师'}_${suffix || testUtils.randomString(4)}`,
            role: type,
            studentNumber: type === 'student' ? id : undefined,
            isActive: true
        };
    },
    
    /**
     * 生成测试商品数据
     */
    generateTestProduct: (suffix = '') => {
        return {
            id: `TEST_PRODUCT_${Date.now()}_${suffix || testUtils.randomString(4)}`,
            name: `测试商品_${suffix || testUtils.randomString(4)}`,
            description: '用于集成测试的商品',
            price: Math.floor(Math.random() * 100) + 10,
            stock: Math.floor(Math.random() * 20) + 5,
            isActive: true
        };
    },
    
    /**
     * 生成测试积分记录数据
     */
    generateTestPointRecord: (studentId, teacherId = 'admin', suffix = '') => {
        return {
            id: `TEST_POINT_${Date.now()}_${suffix || testUtils.randomString(4)}`,
            studentId,
            teacherId,
            amount: Math.floor(Math.random() * 20) + 1,
            reason: `测试积分记录_${suffix || testUtils.randomString(4)}`,
            type: Math.random() > 0.5 ? 'reward' : 'manual'
        };
    },
    
    /**
     * 清理测试数据库文件
     */
    cleanupTestDatabases: async () => {
        const testDbFiles = [
            global.TEST_CONFIG.database.sqlite.testDbPath,
            path.join(__dirname, 'test_sqlite_extended.db'),
            path.join(__dirname, 'test_local_deployment.db'),
            path.join(__dirname, 'test_d1_extended.db')
        ];
        
        for (const dbFile of testDbFiles) {
            try {
                await fs.unlink(dbFile);
            } catch (error) {
                // 忽略文件不存在的错误
            }
        }
    },
    
    /**
     * 验证API响应结构
     */
    validateApiResponse: (response, expectedStatus = 200) => {
        expect(response.status).toBe(expectedStatus);
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('timestamp');
        
        if (response.body.success) {
            expect(response.body).toHaveProperty('data');
        } else {
            expect(response.body).toHaveProperty('message');
        }
        
        return response.body;
    },
    
    /**
     * 验证数据库记录结构
     */
    validateDatabaseRecord: (record, expectedFields) => {
        expect(record).toBeDefined();
        expect(record).not.toBeNull();
        
        expectedFields.forEach(field => {
            expect(record).toHaveProperty(field);
        });
        
        return record;
    },
    
    /**
     * 创建测试认证令牌
     */
    createTestAuthToken: (userId = 'admin', role = 'admin') => {
        // 这里应该使用与应用相同的JWT签名逻辑
        // 为了简化测试，返回一个模拟令牌
        return `test_token_${userId}_${role}_${Date.now()}`;
    }
};

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
    console.error('未处理的Promise拒绝:', reason);
    // 在测试环境中，我们可能想要更严格的错误处理
});

process.on('uncaughtException', (error) => {
    console.error('未捕获的异常:', error);
    // 在测试环境中记录错误但不退出进程
});

// Jest钩子
beforeAll(async () => {
    console.log('🔧 初始化集成测试环境...');
    
    // 清理可能存在的测试数据库
    await global.testUtils.cleanupTestDatabases();
    
    // 设置测试超时
    jest.setTimeout(global.TEST_CONFIG.timeout.extended);
});

afterAll(async () => {
    console.log('🧹 清理集成测试环境...');
    
    // 清理测试数据库
    await global.testUtils.cleanupTestDatabases();
    
    // 等待一段时间确保所有异步操作完成
    await global.testUtils.sleep(1000);
});

// 每个测试文件运行前的设置
beforeEach(() => {
    // 重置模拟和间谍
    jest.clearAllMocks();
});

// 每个测试文件运行后的清理
afterEach(async () => {
    // 等待一小段时间确保异步操作完成
    await global.testUtils.sleep(100);
});

// 扩展Jest匹配器
expect.extend({
    /**
     * 验证API响应格式
     */
    toBeValidApiResponse(received, expectedStatus = 200) {
        const pass = received.status === expectedStatus &&
                    typeof received.body === 'object' &&
                    received.body.hasOwnProperty('success') &&
                    received.body.hasOwnProperty('timestamp');
        
        if (pass) {
            return {
                message: () => `期望响应不是有效的API响应格式`,
                pass: true
            };
        } else {
            return {
                message: () => `期望响应是有效的API响应格式，但收到: ${JSON.stringify(received.body)}`,
                pass: false
            };
        }
    },
    
    /**
     * 验证数据库记录格式
     */
    toBeValidDatabaseRecord(received, requiredFields = []) {
        const pass = received !== null &&
                    typeof received === 'object' &&
                    requiredFields.every(field => received.hasOwnProperty(field));
        
        if (pass) {
            return {
                message: () => `期望记录不是有效的数据库记录格式`,
                pass: true
            };
        } else {
            const missingFields = requiredFields.filter(field => !received?.hasOwnProperty(field));
            return {
                message: () => `期望记录是有效的数据库记录格式，缺少字段: ${missingFields.join(', ')}`,
                pass: false
            };
        }
    },
    
    /**
     * 验证响应时间
     */
    toRespondWithin(received, maxTime) {
        const pass = received <= maxTime;
        
        if (pass) {
            return {
                message: () => `期望响应时间超过${maxTime}ms，但实际为${received}ms`,
                pass: true
            };
        } else {
            return {
                message: () => `期望响应时间在${maxTime}ms内，但实际为${received}ms`,
                pass: false
            };
        }
    }
});

console.log('✅ 集成测试环境初始化完成');