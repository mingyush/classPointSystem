/**
 * 集成测试运行器
 * 统一运行所有集成测试并生成报告
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class IntegrationTestRunner {
    constructor() {
        this.testSuites = [
            {
                name: '数据库一致性测试',
                file: 'integration-database-consistency.test.js',
                description: '测试SQLite和D1数据库适配器的功能一致性',
                timeout: 60000
            },
            {
                name: 'SQLite扩展测试',
                file: 'integration-sqlite-extended.test.js',
                description: '测试SQLite特有功能和性能特性',
                timeout: 120000
            },
            {
                name: 'D1扩展测试',
                file: 'integration-d1-extended.test.js',
                description: '测试D1特有功能和云端部署特性',
                timeout: 90000
            },
            {
                name: '部署一致性测试',
                file: 'integration-deployment-consistency.test.js',
                description: '测试本地部署和Cloudflare部署的功能一致性',
                timeout: 150000
            },
            {
                name: 'API V1集成测试',
                file: 'api-v1-integration.test.js',
                description: '测试简化后的单班级API接口',
                timeout: 90000
            },
            {
                name: '完整工作流测试',
                file: 'integration-full-workflow.test.js',
                description: '测试从学生登录到积分操作到商品预约的完整流程',
                timeout: 120000
            },
            {
                name: '性能压力测试',
                file: 'integration-performance.test.js',
                description: '测试系统在高负载下的性能表现',
                timeout: 180000
            }
        ];

        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            suites: [],
            startTime: null,
            endTime: null,
            duration: 0
        };
    }

    /**
     * 运行所有集成测试
     */
    async runAllTests(options = {}) {
        console.log('🚀 开始运行集成测试套件...\n');
        
        this.results.startTime = new Date();
        
        const {
            parallel = false,
            filter = null,
            verbose = false,
            generateReport = true
        } = options;

        try {
            if (parallel) {
                await this.runTestsInParallel(filter, verbose);
            } else {
                await this.runTestsSequentially(filter, verbose);
            }

            this.results.endTime = new Date();
            this.results.duration = this.results.endTime - this.results.startTime;

            await this.printSummary();

            if (generateReport) {
                await this.generateReport();
            }

            return this.results;

        } catch (error) {
            console.error('❌ 测试运行器发生错误:', error);
            throw error;
        }
    }

    /**
     * 顺序运行测试
     */
    async runTestsSequentially(filter, verbose) {
        const suitesToRun = filter ? 
            this.testSuites.filter(suite => suite.name.includes(filter)) : 
            this.testSuites;

        for (const suite of suitesToRun) {
            console.log(`📋 运行测试套件: ${suite.name}`);
            console.log(`   描述: ${suite.description}`);
            
            const result = await this.runSingleTest(suite, verbose);
            this.results.suites.push(result);
            
            this.updateOverallResults(result);
            
            if (result.status === 'failed' && !verbose) {
                console.log(`❌ ${suite.name} 失败`);
                console.log(`   错误: ${result.error}`);
            } else if (result.status === 'passed') {
                console.log(`✅ ${suite.name} 通过 (${result.duration}ms)`);
            }
            
            console.log(''); // 空行分隔
        }
    }

    /**
     * 并行运行测试
     */
    async runTestsInParallel(filter, verbose) {
        const suitesToRun = filter ? 
            this.testSuites.filter(suite => suite.name.includes(filter)) : 
            this.testSuites;

        console.log(`🔄 并行运行 ${suitesToRun.length} 个测试套件...\n`);

        const promises = suitesToRun.map(suite => this.runSingleTest(suite, verbose));
        const results = await Promise.allSettled(promises);

        results.forEach((result, index) => {
            const suite = suitesToRun[index];
            const testResult = result.status === 'fulfilled' ? result.value : {
                name: suite.name,
                status: 'failed',
                error: result.reason.message,
                duration: 0,
                tests: { total: 0, passed: 0, failed: 1 }
            };

            this.results.suites.push(testResult);
            this.updateOverallResults(testResult);
        });
    }

    /**
     * 运行单个测试套件
     */
    async runSingleTest(suite, verbose) {
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const testProcess = spawn('npm', ['test', '--', suite.file], {
                cwd: path.dirname(__dirname),
                stdio: verbose ? 'inherit' : 'pipe',
                timeout: suite.timeout
            });

            let stdout = '';
            let stderr = '';

            if (!verbose) {
                testProcess.stdout?.on('data', (data) => {
                    stdout += data.toString();
                });

                testProcess.stderr?.on('data', (data) => {
                    stderr += data.toString();
                });
            }

            testProcess.on('close', (code) => {
                const duration = Date.now() - startTime;
                
                const result = {
                    name: suite.name,
                    file: suite.file,
                    status: code === 0 ? 'passed' : 'failed',
                    duration,
                    tests: this.parseTestOutput(stdout),
                    error: code !== 0 ? stderr || '测试失败' : null,
                    output: verbose ? null : stdout
                };

                resolve(result);
            });

            testProcess.on('error', (error) => {
                const duration = Date.now() - startTime;
                
                resolve({
                    name: suite.name,
                    file: suite.file,
                    status: 'failed',
                    duration,
                    tests: { total: 0, passed: 0, failed: 1 },
                    error: error.message
                });
            });
        });
    }

    /**
     * 解析测试输出
     */
    parseTestOutput(output) {
        const tests = { total: 0, passed: 0, failed: 0 };
        
        if (!output) return tests;

        // 解析Jest输出格式
        const testResults = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
        if (testResults) {
            tests.failed = parseInt(testResults[1]);
            tests.passed = parseInt(testResults[2]);
            tests.total = parseInt(testResults[3]);
        } else {
            // 尝试其他格式
            const passedMatch = output.match(/(\d+)\s+passing/);
            const failedMatch = output.match(/(\d+)\s+failing/);
            
            if (passedMatch) tests.passed = parseInt(passedMatch[1]);
            if (failedMatch) tests.failed = parseInt(failedMatch[1]);
            tests.total = tests.passed + tests.failed;
        }

        return tests;
    }

    /**
     * 更新总体结果
     */
    updateOverallResults(suiteResult) {
        this.results.total += suiteResult.tests.total;
        this.results.passed += suiteResult.tests.passed;
        this.results.failed += suiteResult.tests.failed;
        
        if (suiteResult.status === 'skipped') {
            this.results.skipped++;
        }
    }

    /**
     * 打印测试摘要
     */
    async printSummary() {
        console.log('📊 测试结果摘要');
        console.log('='.repeat(50));
        
        console.log(`总测试套件: ${this.testSuites.length}`);
        console.log(`运行时间: ${this.formatDuration(this.results.duration)}`);
        console.log('');
        
        console.log(`总测试用例: ${this.results.total}`);
        console.log(`✅ 通过: ${this.results.passed}`);
        console.log(`❌ 失败: ${this.results.failed}`);
        console.log(`⏭️  跳过: ${this.results.skipped}`);
        
        const successRate = this.results.total > 0 ? 
            ((this.results.passed / this.results.total) * 100).toFixed(1) : 0;
        console.log(`📈 成功率: ${successRate}%`);
        
        console.log('');
        console.log('📋 各测试套件详情:');
        console.log('-'.repeat(50));
        
        this.results.suites.forEach(suite => {
            const status = suite.status === 'passed' ? '✅' : '❌';
            const duration = this.formatDuration(suite.duration);
            console.log(`${status} ${suite.name} (${duration})`);
            
            if (suite.tests.total > 0) {
                console.log(`   测试用例: ${suite.tests.passed}/${suite.tests.total} 通过`);
            }
            
            if (suite.status === 'failed' && suite.error) {
                console.log(`   错误: ${suite.error.split('\n')[0]}`);
            }
        });
        
        console.log('');
        
        if (this.results.failed > 0) {
            console.log('❌ 部分测试失败，请检查详细日志');
            process.exitCode = 1;
        } else {
            console.log('🎉 所有测试通过！');
        }
    }

    /**
     * 生成测试报告
     */
    async generateReport() {
        const reportData = {
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                skipped: this.results.skipped,
                successRate: this.results.total > 0 ? 
                    ((this.results.passed / this.results.total) * 100).toFixed(1) : 0,
                duration: this.results.duration,
                startTime: this.results.startTime.toISOString(),
                endTime: this.results.endTime.toISOString()
            },
            suites: this.results.suites.map(suite => ({
                name: suite.name,
                file: suite.file,
                status: suite.status,
                duration: suite.duration,
                tests: suite.tests,
                error: suite.error
            })),
            environment: {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                timestamp: new Date().toISOString()
            }
        };

        // 生成JSON报告
        const jsonReportPath = path.join(__dirname, 'integration-test-report.json');
        await fs.writeFile(jsonReportPath, JSON.stringify(reportData, null, 2));
        
        // 生成HTML报告
        const htmlReport = this.generateHtmlReport(reportData);
        const htmlReportPath = path.join(__dirname, 'integration-test-report.html');
        await fs.writeFile(htmlReportPath, htmlReport);
        
        console.log(`📄 测试报告已生成:`);
        console.log(`   JSON: ${jsonReportPath}`);
        console.log(`   HTML: ${htmlReportPath}`);
    }

    /**
     * 生成HTML报告
     */
    generateHtmlReport(data) {
        return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>集成测试报告 - 班级积分系统V1</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2196F3; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .passed { color: #4CAF50; }
        .failed { color: #f44336; }
        .skipped { color: #ff9800; }
        .suite { border: 1px solid #ddd; border-radius: 6px; margin-bottom: 15px; }
        .suite-header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; }
        .suite-body { padding: 15px; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .status-passed { background: #d4edda; color: #155724; }
        .status-failed { background: #f8d7da; color: #721c24; }
        .error { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin-top: 10px; font-family: monospace; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>集成测试报告</h1>
            <p>班级积分系统V1 - 系统集成测试</p>
            <p>生成时间: ${new Date(data.environment.timestamp).toLocaleString('zh-CN')}</p>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value">${data.summary.total}</div>
                    <div class="metric-label">总测试用例</div>
                </div>
                <div class="metric">
                    <div class="metric-value passed">${data.summary.passed}</div>
                    <div class="metric-label">通过</div>
                </div>
                <div class="metric">
                    <div class="metric-value failed">${data.summary.failed}</div>
                    <div class="metric-label">失败</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${data.summary.successRate}%</div>
                    <div class="metric-label">成功率</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.formatDuration(data.summary.duration)}</div>
                    <div class="metric-label">总耗时</div>
                </div>
            </div>
            
            <h2>测试套件详情</h2>
            ${data.suites.map(suite => `
                <div class="suite">
                    <div class="suite-header">
                        <div>
                            <strong>${suite.name}</strong>
                            <div style="font-size: 0.9em; color: #666; margin-top: 5px;">${suite.file}</div>
                        </div>
                        <div>
                            <span class="status-badge status-${suite.status}">${suite.status === 'passed' ? '通过' : '失败'}</span>
                            <span style="margin-left: 10px; color: #666;">${this.formatDuration(suite.duration)}</span>
                        </div>
                    </div>
                    <div class="suite-body">
                        <div>测试用例: ${suite.tests.passed}/${suite.tests.total} 通过</div>
                        ${suite.error ? `<div class="error">错误: ${suite.error}</div>` : ''}
                    </div>
                </div>
            `).join('')}
            
            <h2>环境信息</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                <div>Node.js版本: ${data.environment.nodeVersion}</div>
                <div>操作系统: ${data.environment.platform} (${data.environment.arch})</div>
                <div>测试开始时间: ${new Date(data.summary.startTime).toLocaleString('zh-CN')}</div>
                <div>测试结束时间: ${new Date(data.summary.endTime).toLocaleString('zh-CN')}</div>
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * 格式化持续时间
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
    }

    /**
     * 运行特定测试套件
     */
    async runSpecificTest(testName, options = {}) {
        const suite = this.testSuites.find(s => 
            s.name.includes(testName) || s.file.includes(testName)
        );

        if (!suite) {
            throw new Error(`找不到测试套件: ${testName}`);
        }

        console.log(`🎯 运行特定测试: ${suite.name}\n`);
        
        const result = await this.runSingleTest(suite, options.verbose || false);
        
        console.log(`\n📊 测试结果:`);
        console.log(`状态: ${result.status === 'passed' ? '✅ 通过' : '❌ 失败'}`);
        console.log(`耗时: ${this.formatDuration(result.duration)}`);
        console.log(`测试用例: ${result.tests.passed}/${result.tests.total} 通过`);
        
        if (result.error) {
            console.log(`错误: ${result.error}`);
        }

        return result;
    }
}

// CLI接口
if (require.main === module) {
    const runner = new IntegrationTestRunner();
    
    const args = process.argv.slice(2);
    const options = {
        parallel: args.includes('--parallel'),
        verbose: args.includes('--verbose'),
        generateReport: !args.includes('--no-report'),
        filter: args.find(arg => arg.startsWith('--filter='))?.split('=')[1]
    };

    const specificTest = args.find(arg => !arg.startsWith('--'));

    if (specificTest) {
        runner.runSpecificTest(specificTest, options)
            .catch(error => {
                console.error('❌ 测试运行失败:', error.message);
                process.exit(1);
            });
    } else {
        runner.runAllTests(options)
            .catch(error => {
                console.error('❌ 测试运行失败:', error.message);
                process.exit(1);
            });
    }
}

module.exports = IntegrationTestRunner;