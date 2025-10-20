/**
 * Jest集成测试配置
 */

module.exports = {
    // 测试环境
    testEnvironment: 'node',
    
    // 测试超时时间
    testTimeout: 120000,
    
    // 测试文件匹配模式
    testMatch: [
        '**/tests/integration-*.test.js',
        '**/tests/api-v1-integration.test.js'
    ],
    
    // 忽略的测试文件
    testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/dist/'
    ],
    
    // 设置文件
    setupFilesAfterEnv: ['<rootDir>/tests/setup-integration.js'],
    
    // 覆盖率收集
    collectCoverageFrom: [
        'adapters/**/*.js',
        'services/**/*.js',
        'api/**/*.js',
        'utils/**/*.js',
        'middleware/**/*.js',
        'src/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/coverage/**'
    ],
    
    // 覆盖率报告
    coverageDirectory: 'coverage/integration',
    coverageReporters: ['text', 'lcov', 'html', 'json'],
    
    // 覆盖率阈值
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 75,
            lines: 80,
            statements: 80
        }
    },
    
    // 全局变量
    globals: {
        'process.env.NODE_ENV': 'test'
    },
    
    // 模块路径映射
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/$1'
    },
    
    // 详细输出
    verbose: true,
    
    // 并行运行
    maxWorkers: '50%',
    
    // 错误时停止
    bail: false,
    
    // 强制退出
    forceExit: true,
    
    // 检测打开的句柄
    detectOpenHandles: true,
    
    // 检测泄漏
    detectLeaks: false,
    
    // 报告器
    reporters: [
        'default',
        ['jest-html-reporters', {
            publicPath: './coverage/integration',
            filename: 'integration-test-report.html',
            expand: true,
            hideIcon: false,
            pageTitle: '班级积分系统V1 - 集成测试报告'
        }]
    ],
    
    // 转换配置
    transform: {
        '^.+\\.js$': 'babel-jest'
    },
    
    // 转换忽略模式
    transformIgnorePatterns: [
        '/node_modules/(?!(supertest|eventsource)/)'
    ],
    
    // 清理模拟
    clearMocks: true,
    restoreMocks: true,
    
    // 错误处理
    errorOnDeprecated: true,
    
    // 测试结果处理器
    testResultsProcessor: '<rootDir>/tests/test-results-processor.js'
};