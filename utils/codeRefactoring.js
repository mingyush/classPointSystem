/**
 * 代码重构工具
 * 用于识别重复代码、优化代码结构和提供重构建议
 */

const fs = require('fs').promises;
const path = require('path');

class CodeRefactoringTool {
    constructor() {
        this.duplicatePatterns = new Map();
        this.complexityMetrics = new Map();
        this.refactoringSuggestions = [];
    }

    /**
     * 分析项目代码质量
     * @param {string} projectPath - 项目路径
     * @returns {Promise<object>} 分析结果
     */
    async analyzeProject(projectPath = '.') {
        console.log('开始代码质量分析...');
        
        const analysis = {
            duplicateCode: [],
            complexityIssues: [],
            refactoringSuggestions: [],
            performanceIssues: [],
            codeMetrics: {}
        };

        try {
            // 获取所有JavaScript文件
            const jsFiles = await this.getJavaScriptFiles(projectPath);
            
            // 分析每个文件
            for (const file of jsFiles) {
                const fileAnalysis = await this.analyzeFile(file);
                
                // 合并分析结果
                analysis.duplicateCode.push(...fileAnalysis.duplicateCode);
                analysis.complexityIssues.push(...fileAnalysis.complexityIssues);
                analysis.performanceIssues.push(...fileAnalysis.performanceIssues);
            }

            // 生成重构建议
            analysis.refactoringSuggestions = this.generateRefactoringSuggestions(analysis);
            
            // 计算代码指标
            analysis.codeMetrics = this.calculateCodeMetrics(jsFiles);
            
            console.log('代码质量分析完成');
            return analysis;
            
        } catch (error) {
            console.error('代码分析失败:', error);
            throw error;
        }
    }

    /**
     * 获取所有JavaScript文件
     * @private
     */
    async getJavaScriptFiles(dir, files = []) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // 跳过node_modules等目录
                if (!['node_modules', '.git', 'coverage', 'dist'].includes(entry.name)) {
                    await this.getJavaScriptFiles(fullPath, files);
                }
            } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.min.js')) {
                files.push(fullPath);
            }
        }
        
        return files;
    }

    /**
     * 分析单个文件
     * @private
     */
    async analyzeFile(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        
        const analysis = {
            file: filePath,
            duplicateCode: [],
            complexityIssues: [],
            performanceIssues: []
        };

        // 检查重复代码
        analysis.duplicateCode = this.findDuplicateCode(content, filePath);
        
        // 检查复杂度问题
        analysis.complexityIssues = this.findComplexityIssues(content, filePath);
        
        // 检查性能问题
        analysis.performanceIssues = this.findPerformanceIssues(content, filePath);
        
        return analysis;
    }

    /**
     * 查找重复代码
     * @private
     */
    findDuplicateCode(content, filePath) {
        const duplicates = [];
        const lines = content.split('\n');
        const minDuplicateLines = 5; // 最少5行才算重复
        
        // 简单的重复代码检测
        for (let i = 0; i < lines.length - minDuplicateLines; i++) {
            const block = lines.slice(i, i + minDuplicateLines).join('\n').trim();
            
            if (block.length > 50) { // 忽略太短的代码块
                const pattern = this.normalizeCode(block);
                
                if (this.duplicatePatterns.has(pattern)) {
                    const existing = this.duplicatePatterns.get(pattern);
                    duplicates.push({
                        type: 'duplicate_code',
                        severity: 'medium',
                        message: `重复代码块 (与 ${existing.file}:${existing.line} 重复)`,
                        file: filePath,
                        line: i + 1,
                        suggestion: '考虑提取为公共函数'
                    });
                } else {
                    this.duplicatePatterns.set(pattern, {
                        file: filePath,
                        line: i + 1,
                        content: block
                    });
                }
            }
        }
        
        return duplicates;
    }

    /**
     * 查找复杂度问题
     * @private
     */
    findComplexityIssues(content, filePath) {
        const issues = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // 检查过长的函数
            if (trimmedLine.includes('function') || trimmedLine.includes('=>')) {
                const functionContent = this.extractFunctionContent(content, index);
                if (functionContent && functionContent.split('\n').length > 50) {
                    issues.push({
                        type: 'long_function',
                        severity: 'high',
                        message: '函数过长，建议拆分',
                        file: filePath,
                        line: index + 1,
                        suggestion: '将大函数拆分为多个小函数'
                    });
                }
            }
            
            // 检查深层嵌套
            const indentLevel = line.length - line.trimStart().length;
            if (indentLevel > 24) { // 超过6层嵌套
                issues.push({
                    type: 'deep_nesting',
                    severity: 'medium',
                    message: '嵌套层级过深',
                    file: filePath,
                    line: index + 1,
                    suggestion: '考虑使用早期返回或提取函数'
                });
            }
            
            // 检查过长的行
            if (line.length > 120) {
                issues.push({
                    type: 'long_line',
                    severity: 'low',
                    message: '代码行过长',
                    file: filePath,
                    line: index + 1,
                    suggestion: '将长行拆分为多行'
                });
            }
        });
        
        return issues;
    }

    /**
     * 查找性能问题
     * @private
     */
    findPerformanceIssues(content, filePath) {
        const issues = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // 检查同步文件操作
            if (trimmedLine.includes('fs.readFileSync') || trimmedLine.includes('fs.writeFileSync')) {
                issues.push({
                    type: 'sync_file_operation',
                    severity: 'high',
                    message: '使用同步文件操作可能阻塞事件循环',
                    file: filePath,
                    line: index + 1,
                    suggestion: '使用异步文件操作'
                });
            }
            
            // 检查循环中的异步操作
            if ((trimmedLine.includes('for') || trimmedLine.includes('forEach')) && 
                content.includes('await') && 
                this.isInLoop(content, index)) {
                issues.push({
                    type: 'async_in_loop',
                    severity: 'medium',
                    message: '循环中的异步操作可能影响性能',
                    file: filePath,
                    line: index + 1,
                    suggestion: '考虑使用Promise.all()并行处理'
                });
            }
            
            // 检查未优化的DOM查询
            if (trimmedLine.includes('document.querySelector') || 
                trimmedLine.includes('document.getElementById')) {
                if (this.isInLoop(content, index)) {
                    issues.push({
                        type: 'dom_query_in_loop',
                        severity: 'medium',
                        message: '循环中的DOM查询影响性能',
                        file: filePath,
                        line: index + 1,
                        suggestion: '将DOM查询移到循环外部'
                    });
                }
            }
            
            // 检查内存泄漏风险
            if (trimmedLine.includes('setInterval') && !content.includes('clearInterval')) {
                issues.push({
                    type: 'potential_memory_leak',
                    severity: 'high',
                    message: '可能的内存泄漏：未清理定时器',
                    file: filePath,
                    line: index + 1,
                    suggestion: '确保在适当时机调用clearInterval'
                });
            }
        });
        
        return issues;
    }

    /**
     * 生成重构建议
     * @private
     */
    generateRefactoringSuggestions(analysis) {
        const suggestions = [];
        
        // 基于重复代码的建议
        const duplicateCount = analysis.duplicateCode.length;
        if (duplicateCount > 5) {
            suggestions.push({
                type: 'extract_common_functions',
                priority: 'high',
                message: `发现${duplicateCount}处重复代码，建议提取公共函数`,
                action: '创建utils目录，将重复代码提取为可复用函数'
            });
        }
        
        // 基于复杂度的建议
        const complexityCount = analysis.complexityIssues.length;
        if (complexityCount > 10) {
            suggestions.push({
                type: 'reduce_complexity',
                priority: 'medium',
                message: `发现${complexityCount}处复杂度问题，建议简化代码结构`,
                action: '拆分大函数，减少嵌套层级，使用更清晰的命名'
            });
        }
        
        // 基于性能的建议
        const performanceCount = analysis.performanceIssues.length;
        if (performanceCount > 0) {
            suggestions.push({
                type: 'optimize_performance',
                priority: 'high',
                message: `发现${performanceCount}处性能问题，建议优化`,
                action: '使用异步操作，优化循环，缓存DOM查询结果'
            });
        }
        
        return suggestions;
    }

    /**
     * 计算代码指标
     * @private
     */
    async calculateCodeMetrics(files) {
        let totalLines = 0;
        let totalFunctions = 0;
        let totalClasses = 0;
        let totalComments = 0;
        
        for (const file of files) {
            const content = await fs.readFile(file, 'utf8');
            const lines = content.split('\n');
            
            totalLines += lines.length;
            totalFunctions += (content.match(/function\s+\w+|=>\s*{|\w+\s*:\s*function/g) || []).length;
            totalClasses += (content.match(/class\s+\w+/g) || []).length;
            totalComments += (content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
        }
        
        return {
            totalFiles: files.length,
            totalLines,
            totalFunctions,
            totalClasses,
            totalComments,
            averageLinesPerFile: Math.round(totalLines / files.length),
            commentRatio: Math.round((totalComments / totalLines) * 100)
        };
    }

    /**
     * 工具方法
     */
    normalizeCode(code) {
        return code
            .replace(/\s+/g, ' ')
            .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
            .trim();
    }

    extractFunctionContent(content, startLine) {
        const lines = content.split('\n');
        let braceCount = 0;
        let functionLines = [];
        let started = false;
        
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            functionLines.push(line);
            
            for (const char of line) {
                if (char === '{') {
                    braceCount++;
                    started = true;
                } else if (char === '}') {
                    braceCount--;
                }
            }
            
            if (started && braceCount === 0) {
                break;
            }
        }
        
        return functionLines.join('\n');
    }

    isInLoop(content, lineIndex) {
        const lines = content.split('\n');
        const beforeLines = lines.slice(Math.max(0, lineIndex - 10), lineIndex);
        const afterLines = lines.slice(lineIndex, Math.min(lines.length, lineIndex + 10));
        
        const loopKeywords = ['for', 'while', 'forEach', 'map', 'filter'];
        return loopKeywords.some(keyword => 
            beforeLines.some(line => line.includes(keyword)) ||
            afterLines.some(line => line.includes(keyword))
        );
    }

    /**
     * 生成重构报告
     */
    async generateReport(analysis, outputPath = 'code-analysis-report.json') {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalIssues: analysis.duplicateCode.length + 
                           analysis.complexityIssues.length + 
                           analysis.performanceIssues.length,
                duplicateCodeIssues: analysis.duplicateCode.length,
                complexityIssues: analysis.complexityIssues.length,
                performanceIssues: analysis.performanceIssues.length
            },
            details: analysis,
            recommendations: this.generateRecommendations(analysis)
        };
        
        await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
        console.log(`重构报告已生成: ${outputPath}`);
        
        return report;
    }

    /**
     * 生成具体的重构建议
     * @private
     */
    generateRecommendations(analysis) {
        return [
            {
                category: '代码重复',
                items: [
                    '提取重复的数据验证逻辑到公共验证器',
                    '创建统一的错误处理工具函数',
                    '将相似的API调用封装为通用方法'
                ]
            },
            {
                category: '性能优化',
                items: [
                    '实现数据缓存机制减少重复计算',
                    '使用防抖和节流优化用户交互',
                    '优化数据库查询，减少N+1问题'
                ]
            },
            {
                category: '代码结构',
                items: [
                    '按功能模块重新组织文件结构',
                    '使用依赖注入提高代码可测试性',
                    '实现统一的配置管理系统'
                ]
            }
        ];
    }
}

module.exports = CodeRefactoringTool;