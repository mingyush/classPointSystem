#!/usr/bin/env node

/**
 * Cloudflare Workers 构建脚本
 * 将 Node.js 代码转换为 Workers 兼容格式
 */

const fs = require('fs').promises;
const path = require('path');

async function buildWorker() {
  console.log('开始构建 Cloudflare Workers...');
  
  try {
    // 创建构建目录
    const buildDir = path.join(process.cwd(), 'dist');
    await fs.mkdir(buildDir, { recursive: true });
    
    // 复制 Workers 源代码
    await copyWorkerFiles();
    
    // 生成 Workers 配置
    await generateWorkerConfig();
    
    // 复制静态文件
    await copyStaticFiles();
    
    console.log('Cloudflare Workers 构建完成！');
    
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
}

/**
 * 复制 Workers 文件
 */
async function copyWorkerFiles() {
  const srcDir = path.join(process.cwd(), 'src');
  const distDir = path.join(process.cwd(), 'dist');
  
  // 检查源目录是否存在
  try {
    await fs.access(srcDir);
  } catch {
    console.log('src 目录不存在，跳过 Workers 文件复制');
    return;
  }
  
  // 递归复制文件
  await copyDirectory(srcDir, path.join(distDir, 'src'));
  
  console.log('Workers 源代码复制完成');
}

/**
 * 生成 Workers 配置
 */
async function generateWorkerConfig() {
  const config = {
    name: 'classroom-points-system',
    main: 'src/worker.js',
    compatibility_date: '2024-01-01',
    compatibility_flags: ['nodejs_compat'],
    vars: {
      DEPLOYMENT: 'cloudflare',
      NODE_ENV: 'production'
    }
  };
  
  const configPath = path.join(process.cwd(), 'dist', 'wrangler.toml');
  const tomlContent = generateTOML(config);
  
  await fs.writeFile(configPath, tomlContent);
  console.log('Workers 配置生成完成');
}

/**
 * 复制静态文件
 */
async function copyStaticFiles() {
  const publicDir = path.join(process.cwd(), 'public');
  const distDir = path.join(process.cwd(), 'dist');
  
  try {
    await fs.access(publicDir);
    await copyDirectory(publicDir, distDir);
    console.log('静态文件复制完成');
  } catch {
    console.log('public 目录不存在，跳过静态文件复制');
  }
}

/**
 * 递归复制目录
 */
async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  
  const entries = await fs.readdir(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * 生成 TOML 配置
 */
function generateTOML(config) {
  let toml = `# 自动生成的 Cloudflare Workers 配置
name = "${config.name}"
main = "${config.main}"
compatibility_date = "${config.compatibility_date}"
compatibility_flags = ${JSON.stringify(config.compatibility_flags)}

[vars]
`;
  
  Object.entries(config.vars).forEach(([key, value]) => {
    toml += `${key} = "${value}"\n`;
  });
  
  toml += `
# D1 数据库绑定（需要手动配置）
# [[d1_databases]]
# binding = "DB"
# database_name = "classroom-points"
# database_id = "your-d1-database-id"

# KV 存储绑定（需要手动配置）
# [[kv_namespaces]]
# binding = "SESSIONS"
# id = "your-kv-namespace-id"
`;
  
  return toml;
}

// 运行构建
if (require.main === module) {
  buildWorker();
}

module.exports = { buildWorker };