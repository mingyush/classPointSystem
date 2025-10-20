#!/usr/bin/env node

/**
 * Cloudflare D1 数据库初始化脚本
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

async function initD1Database() {
  console.log('开始初始化 Cloudflare D1 数据库...');
  
  try {
    // 检查 wrangler 是否安装
    await checkWranglerInstallation();
    
    // 读取配置
    const config = await readWranglerConfig();
    
    // 创建数据库（如果不存在）
    await createD1Database(config);
    
    // 执行数据库迁移
    await runDatabaseMigrations(config);
    
    // 验证数据库结构
    await validateDatabaseSchema(config);
    
    console.log('D1 数据库初始化完成！');
    
  } catch (error) {
    console.error('D1 数据库初始化失败:', error.message);
    process.exit(1);
  }
}

/**
 * 检查 Wrangler 安装
 */
async function checkWranglerInstallation() {
  try {
    execSync('wrangler --version', { stdio: 'pipe' });
    console.log('✓ Wrangler CLI 已安装');
  } catch (error) {
    throw new Error('Wrangler CLI 未安装。请运行: npm install -g wrangler');
  }
}

/**
 * 读取 Wrangler 配置
 */
async function readWranglerConfig() {
  const configPath = path.join(process.cwd(), 'wrangler.toml');
  
  try {
    const configContent = await fs.readFile(configPath, 'utf8');
    
    // 简单解析 TOML 配置
    const nameMatch = configContent.match(/database_name\s*=\s*"([^"]+)"/);
    const databaseName = nameMatch ? nameMatch[1] : 'classroom-points';
    
    return { databaseName };
    
  } catch (error) {
    console.log('未找到 wrangler.toml，使用默认配置');
    return { databaseName: 'classroom-points' };
  }
}

/**
 * 创建 D1 数据库
 */
async function createD1Database(config) {
  const { databaseName } = config;
  
  try {
    console.log(`创建 D1 数据库: ${databaseName}`);
    
    const output = execSync(`wrangler d1 create ${databaseName}`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✓ D1 数据库创建成功');
    
    // 提取数据库 ID
    const idMatch = output.match(/database_id\s*=\s*"([^"]+)"/);
    if (idMatch) {
      console.log(`数据库 ID: ${idMatch[1]}`);
      console.log('请将此 ID 更新到 wrangler.toml 配置文件中');
    }
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ D1 数据库已存在');
    } else {
      throw new Error(`创建 D1 数据库失败: ${error.message}`);
    }
  }
}

/**
 * 运行数据库迁移
 */
async function runDatabaseMigrations(config) {
  const { databaseName } = config;
  const sqlFile = path.join(process.cwd(), 'sql', 'd1_schema.sql');
  
  try {
    // 检查 SQL 文件是否存在
    await fs.access(sqlFile);
    
    console.log('执行数据库迁移...');
    
    execSync(`wrangler d1 execute ${databaseName} --file=${sqlFile}`, {
      stdio: 'inherit'
    });
    
    console.log('✓ 数据库迁移完成');
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('未找到 SQL 迁移文件，跳过迁移');
    } else {
      throw new Error(`数据库迁移失败: ${error.message}`);
    }
  }
}

/**
 * 验证数据库结构
 */
async function validateDatabaseSchema(config) {
  const { databaseName } = config;
  
  try {
    console.log('验证数据库结构...');
    
    // 检查关键表是否存在
    const tables = ['users', 'point_records', 'products', 'orders', 'reward_penalty_items', 'system_state'];
    
    for (const table of tables) {
      try {
        execSync(`wrangler d1 execute ${databaseName} --command="SELECT COUNT(*) FROM ${table}"`, {
          stdio: 'pipe'
        });
        console.log(`✓ 表 ${table} 存在`);
      } catch (error) {
        console.warn(`⚠ 表 ${table} 不存在或有问题`);
      }
    }
    
    console.log('✓ 数据库结构验证完成');
    
  } catch (error) {
    console.warn('数据库结构验证失败:', error.message);
  }
}

/**
 * 显示使用说明
 */
function showUsage() {
  console.log(`
使用说明:
1. 确保已安装 Wrangler CLI: npm install -g wrangler
2. 登录 Cloudflare: wrangler login
3. 运行此脚本: node scripts/init-d1-database.js
4. 将生成的数据库 ID 更新到 wrangler.toml 文件中
5. 部署 Workers: wrangler deploy

配置文件示例 (wrangler.toml):
[[d1_databases]]
binding = "DB"
database_name = "classroom-points"
database_id = "your-database-id-here"
`);
}

// 命令行参数处理
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// 运行初始化
if (require.main === module) {
  initD1Database();
}

module.exports = { initD1Database };