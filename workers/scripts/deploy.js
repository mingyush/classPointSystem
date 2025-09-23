#!/usr/bin/env node

/**
 * Cloudflare Workers 部署脚本
 * 自动化部署流程，包括环境检查、构建和部署
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * 日志工具
 */
class Logger {
  static info(message) {
    console.log(`\x1b[36m[INFO]\x1b[0m ${message}`);
  }
  
  static success(message) {
    console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`);
  }
  
  static warning(message) {
    console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`);
  }
  
  static error(message) {
    console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  }
}

/**
 * 部署器类
 */
class WorkersDeployer {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.isProduction = this.environment === 'production';
  }
  
  /**
   * 检查必要的依赖和配置
   */
  async checkPrerequisites() {
    Logger.info('检查部署前置条件...');
    
    // 检查 wrangler CLI
    try {
      execSync('wrangler --version', { stdio: 'pipe' });
      Logger.success('Wrangler CLI 已安装');
    } catch (error) {
      Logger.error('Wrangler CLI 未安装，请运行: npm install -g wrangler');
      process.exit(1);
    }
    
    // 检查 wrangler.toml
    const wranglerConfig = path.join(projectRoot, 'wrangler.toml');
    if (!fs.existsSync(wranglerConfig)) {
      Logger.error('wrangler.toml 配置文件不存在');
      process.exit(1);
    }
    Logger.success('wrangler.toml 配置文件存在');
    
    // 检查认证状态
    try {
      execSync('wrangler whoami', { stdio: 'pipe' });
      Logger.success('Cloudflare 认证状态正常');
    } catch (error) {
      Logger.error('Cloudflare 认证失败，请运行: wrangler login');
      process.exit(1);
    }
  }
  
  /**
   * 运行测试
   */
  async runTests() {
    if (this.isProduction) {
      Logger.info('运行测试套件...');
      try {
        execSync('npm test', { 
          stdio: 'inherit',
          cwd: projectRoot 
        });
        Logger.success('所有测试通过');
      } catch (error) {
        Logger.error('测试失败，部署中止');
        process.exit(1);
      }
    } else {
      Logger.info('开发环境跳过测试');
    }
  }
  
  /**
   * 构建项目
   */
  async build() {
    Logger.info('构建项目...');
    try {
      // 清理之前的构建
      if (fs.existsSync(path.join(projectRoot, 'dist'))) {
        execSync('rm -rf dist', { cwd: projectRoot });
      }
      
      // 运行构建
      execSync('npm run build', { 
        stdio: 'inherit',
        cwd: projectRoot 
      });
      Logger.success('项目构建完成');
    } catch (error) {
      Logger.error('构建失败');
      process.exit(1);
    }
  }
  
  /**
   * 部署到 Cloudflare Workers
   */
  async deploy() {
    Logger.info(`部署到 ${this.isProduction ? '生产' : '开发'} 环境...`);
    
    try {
      const deployCommand = this.isProduction 
        ? 'wrangler deploy --env production'
        : 'wrangler deploy --env development';
        
      execSync(deployCommand, { 
        stdio: 'inherit',
        cwd: projectRoot 
      });
      
      Logger.success(`部署到 ${this.isProduction ? '生产' : '开发'} 环境成功！`);
    } catch (error) {
      Logger.error('部署失败');
      process.exit(1);
    }
  }
  
  /**
   * 部署数据库迁移
   */
  async deployMigrations() {
    Logger.info('检查数据库迁移...');
    
    const migrationsDir = path.join(projectRoot, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      Logger.warning('未找到迁移文件夹，跳过数据库迁移');
      return;
    }
    
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    if (migrationFiles.length === 0) {
      Logger.info('没有待执行的迁移文件');
      return;
    }
    
    Logger.info(`发现 ${migrationFiles.length} 个迁移文件`);
    
    for (const file of migrationFiles) {
      try {
        const migrationPath = path.join(migrationsDir, file);
        const dbName = this.isProduction ? 'class-point-system-prod' : 'class-point-system-dev';
        
        execSync(`wrangler d1 execute ${dbName} --file=${migrationPath}`, {
          stdio: 'inherit',
          cwd: projectRoot
        });
        
        Logger.success(`迁移文件 ${file} 执行成功`);
      } catch (error) {
        Logger.error(`迁移文件 ${file} 执行失败`);
        throw error;
      }
    }
  }
  
  /**
   * 验证部署
   */
  async validateDeployment() {
    Logger.info('验证部署状态...');
    
    try {
      // 获取部署信息
      const result = execSync('wrangler deployments list --limit 1', {
        encoding: 'utf8',
        cwd: projectRoot
      });
      
      Logger.success('部署验证完成');
      Logger.info('最新部署信息:');
      console.log(result);
    } catch (error) {
      Logger.warning('无法获取部署信息，但部署可能已成功');
    }
  }
  
  /**
   * 执行完整部署流程
   */
  async run() {
    const startTime = Date.now();
    
    try {
      Logger.info(`开始部署到 ${this.isProduction ? '生产' : '开发'} 环境`);
      
      await this.checkPrerequisites();
      await this.runTests();
      await this.build();
      await this.deployMigrations();
      await this.deploy();
      await this.validateDeployment();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      Logger.success(`部署完成！耗时: ${duration}s`);
      
    } catch (error) {
      Logger.error('部署过程中发生错误');
      console.error(error);
      process.exit(1);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  
  // 解析命令行参数
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
使用方法:
  node deploy.js [选项]

选项:
  --production, -p    部署到生产环境
  --development, -d   部署到开发环境 (默认)
  --skip-tests        跳过测试
  --help, -h          显示帮助信息
`);
    return;
  }
  
  // 设置环境
  if (args.includes('--production') || args.includes('-p')) {
    process.env.NODE_ENV = 'production';
  } else if (args.includes('--development') || args.includes('-d')) {
    process.env.NODE_ENV = 'development';
  }
  
  const deployer = new WorkersDeployer();
  await deployer.run();
}

// 运行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { WorkersDeployer };