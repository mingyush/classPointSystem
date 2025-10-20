/**
 * 测试结果处理器
 * 处理Jest测试结果并生成自定义报告
 */

const fs = require('fs');
const path = require('path');

/**
 * 处理测试结果
 */
function processTestResults(results) {
    const {
        numTotalTests,
        numPassedTests,
        numFailedTests,
        numPendingTests,
        testResults,
        startTime,
        success
    } = results;

    // 计算测试统计信息
    const stats = {
        total: numTotalTests,
        passed: numPassedTests,
        failed: numFailedTests,
        skipped: numPendingTests,
        successRate: numTotalTests > 0 ? ((numPassedTests / numTotalTests) * 100).toFixed(1) : 0,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success
    };

    // 处理每个测试套件的结果
    const suiteResults = testResults.map(suite => {
        const {
            testFilePath,
            numPassingTests,
            numFailingTests,
            numPendingTests,
            testResults: tests,
            perfStats,
            failureMessage
        } = suite;

        return {
            file: path.relative(process.cwd(), testFilePath),
            name: extractSuiteName(testFilePath),
            stats: {
                total: tests.length,
                passed: numPassingTests,
                failed: numFailingTests,
                skipped: numPendingTests,
                duration: perfStats.end - perfStats.start
            },
            tests: tests.map(test => ({
                title: test.title,
                fullName: test.fullName,
                status: test.status,
                duration: test.duration,
                failureMessages: test.failureMessages,
                location: test.location
            })),
            failureMessage,
            success: numFailingTests === 0
        };
    });

    // 生成详细报告
    const report = {
        summary: stats,
        suites: suiteResults,
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            cwd: process.cwd(),
            timestamp: new Date().toISOString()
        }
    };

    // 保存报告到文件
    saveReport(report);

    // 打印摘要到控制台
    printSummary(report);

    return results;
}

/**
 * 从文件路径提取测试套件名称
 */
function extractSuiteName(filePath) {
    const fileName = path.basename(filePath, '.test.js');
    
    // 转换文件名为可读的套件名称
    const nameMap = {
        'integration-database-consistency': '数据库一致性测试',
        'integration-sqlite-extended': 'SQLite扩展测试',
        'integration-d1-extended': 'D1扩展测试',
        'integration-deployment-consistency': '部署一致性测试',
        'api-v1-integration': 'API V1集成测试',
        'integration-full-workflow': '完整工作流测试',
        'integration-performance': '性能压力测试'
    };

    return nameMap[fileName] || fileName;
}

/**
 * 保存报告到文件
 */
function saveReport(report) {
    const reportsDir = path.join(process.cwd(), 'coverage', 'integration');
    
    // 确保报告目录存在
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    // 保存JSON报告
    const jsonReportPath = path.join(reportsDir, 'test-results.json');
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

    // 保存简化的摘要报告
    const summaryPath = path.join(reportsDir, 'test-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify({
        summary: report.summary,
        suites: report.suites.map(suite => ({
            name: suite.name,
            file: suite.file,
            success: suite.success,
            stats: suite.stats
        }))
    }, null, 2));

    console.log(`\n📄 测试报告已保存到: ${jsonReportPath}`);
}

/**
 * 打印测试摘要
 */
function printSummary(report) {
    const { summary, suites } = report;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 集成测试结果摘要');
    console.log('='.repeat(60));
    
    console.log(`总测试用例: ${summary.total}`);
    console.log(`✅ 通过: ${summary.passed}`);
    console.log(`❌ 失败: ${summary.failed}`);
    console.log(`⏭️  跳过: ${summary.skipped}`);
    console.log(`📈 成功率: ${summary.successRate}%`);
    console.log(`⏱️  总耗时: ${formatDuration(summary.duration)}`);
    
    console.log('\n📋 测试套件详情:');
    console.log('-'.repeat(60));
    
    suites.forEach(suite => {
        const status = suite.success ? '✅' : '❌';
        const duration = formatDuration(suite.stats.duration);
        
        console.log(`${status} ${suite.name}`);
        console.log(`   文件: ${suite.file}`);
        console.log(`   用例: ${suite.stats.passed}/${suite.stats.total} 通过`);
        console.log(`   耗时: ${duration}`);
        
        if (!suite.success && suite.failureMessage) {
            const firstError = suite.failureMessage.split('\n')[0];
            console.log(`   错误: ${firstError}`);
        }
        
        console.log('');
    });
    
    if (summary.failed > 0) {
        console.log('❌ 部分测试失败，请查看详细报告');
    } else {
        console.log('🎉 所有集成测试通过！');
    }
    
    console.log('='.repeat(60));
}

/**
 * 格式化持续时间
 */
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * 生成性能报告
 */
function generatePerformanceReport(suites) {
    const performanceData = suites.map(suite => ({
        name: suite.name,
        duration: suite.stats.duration,
        testsPerSecond: suite.stats.total > 0 ? 
            (suite.stats.total / (suite.stats.duration / 1000)).toFixed(2) : 0,
        avgTestDuration: suite.stats.total > 0 ? 
            (suite.stats.duration / suite.stats.total).toFixed(2) : 0
    }));

    // 按执行时间排序
    performanceData.sort((a, b) => b.duration - a.duration);

    console.log('\n⚡ 性能分析:');
    console.log('-'.repeat(60));
    
    performanceData.forEach((suite, index) => {
        console.log(`${index + 1}. ${suite.name}`);
        console.log(`   总耗时: ${formatDuration(suite.duration)}`);
        console.log(`   平均每个测试: ${suite.avgTestDuration}ms`);
        console.log(`   测试速度: ${suite.testsPerSecond} tests/sec`);
        console.log('');
    });
}

/**
 * 检查测试覆盖率阈值
 */
function checkCoverageThresholds(results) {
    if (results.coverageMap) {
        const coverage = results.coverageMap.getCoverageSummary();
        const thresholds = {
            statements: 80,
            branches: 70,
            functions: 75,
            lines: 80
        };

        console.log('\n📊 代码覆盖率:');
        console.log('-'.repeat(60));
        
        Object.entries(thresholds).forEach(([metric, threshold]) => {
            const actual = coverage[metric].pct;
            const status = actual >= threshold ? '✅' : '❌';
            console.log(`${status} ${metric}: ${actual.toFixed(1)}% (阈值: ${threshold}%)`);
        });
    }
}

module.exports = processTestResults;