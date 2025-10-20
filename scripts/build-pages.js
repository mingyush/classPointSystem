#!/usr/bin/env node

/**
 * Cloudflare Pages 构建脚本
 * 优化静态文件用于 Pages 部署
 */

const fs = require('fs').promises;
const path = require('path');

async function buildPages() {
  console.log('开始构建 Cloudflare Pages...');
  
  try {
    // 创建构建目录
    const buildDir = path.join(process.cwd(), 'dist');
    await fs.mkdir(buildDir, { recursive: true });
    
    // 复制静态文件
    await copyStaticFiles();
    
    // 生成优化的 HTML 文件
    await generateOptimizedHTML();
    
    // 生成 _headers 文件
    await generateHeadersFile();
    
    // 生成 _redirects 文件
    await generateRedirectsFile();
    
    // 生成 functions 目录（用于 Pages Functions）
    await generatePagesFunctions();
    
    console.log('Cloudflare Pages 构建完成！');
    
  } catch (error) {
    console.error('构建失败:', error);
    process.exit(1);
  }
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
    console.log('✓ 静态文件复制完成');
  } catch {
    console.log('⚠ public 目录不存在，跳过静态文件复制');
  }
}

/**
 * 生成优化的 HTML 文件
 */
async function generateOptimizedHTML() {
  const distDir = path.join(process.cwd(), 'dist');
  
  // 主页
  const indexHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>班级积分管理系统</title>
  <meta name="description" content="简单易用的班级积分管理工具">
  <link rel="stylesheet" href="/css/common.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
  <div class="container">
    <header>
      <h1>班级积分管理系统</h1>
      <p class="subtitle">让班级管理更简单</p>
    </header>
    
    <main class="menu-grid">
      <a href="/display" class="menu-card">
        <div class="card-icon">📺</div>
        <h2>教室大屏</h2>
        <p>实时显示积分排行榜</p>
      </a>
      
      <a href="/admin" class="menu-card">
        <div class="card-icon">⚙️</div>
        <h2>管理后台</h2>
        <p>教师管理界面</p>
      </a>
      
      <a href="/student" class="menu-card">
        <div class="card-icon">👨‍🎓</div>
        <h2>学生查询</h2>
        <p>查看个人积分记录</p>
      </a>
    </main>
    
    <footer>
      <p>&copy; 2024 班级积分管理系统 </p>
    </footer>
  </div>
  
  <script src="/js/common.js"></script>
</body>
</html>`;

  await fs.writeFile(path.join(distDir, 'index.html'), indexHTML);
  
  // 404 页面
  const notFoundHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面未找到 - 班级积分管理系统</title>
  <link rel="stylesheet" href="/css/common.css">
</head>
<body>
  <div class="container">
    <div class="error-page">
      <h1>404</h1>
      <h2>页面未找到</h2>
      <p>您访问的页面不存在</p>
      <a href="/" class="btn btn-primary">返回首页</a>
    </div>
  </div>
</body>
</html>`;

  await fs.writeFile(path.join(distDir, '404.html'), notFoundHTML);
  
  console.log('✓ HTML 文件生成完成');
}

/**
 * 生成 _headers 文件
 */
async function generateHeadersFile() {
  const distDir = path.join(process.cwd(), 'dist');
  
  const headers = `# Cloudflare Pages Headers Configuration

# Security Headers
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

# API Routes
/api/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
  Access-Control-Max-Age: 86400

# Static Assets Caching
/css/*
  Cache-Control: public, max-age=31536000, immutable
  
/js/*
  Cache-Control: public, max-age=31536000, immutable
  
/images/*
  Cache-Control: public, max-age=31536000, immutable
  
/fonts/*
  Cache-Control: public, max-age=31536000, immutable

# HTML Files
/*.html
  Cache-Control: public, max-age=3600

# Root Files
/
  Cache-Control: public, max-age=3600
`;

  await fs.writeFile(path.join(distDir, '_headers'), headers);
  console.log('✓ _headers 文件生成完成');
}

/**
 * 生成 _redirects 文件
 */
async function generateRedirectsFile() {
  const distDir = path.join(process.cwd(), 'dist');
  
  const redirects = `# Cloudflare Pages Redirects Configuration

# SPA Fallback for client-side routing
/display/* /display/index.html 200
/admin/* /admin/index.html 200
/student/* /student/index.html 200

# API Proxy to Workers (if needed)
/api/* https://classroom-points-system.your-subdomain.workers.dev/api/:splat 200

# Legacy URL redirects
/teacher/* /admin/:splat 301
/management/* /admin/:splat 301

# Force HTTPS
http://classroom-points.your-domain.com/* https://classroom-points.your-domain.com/:splat 301!
`;

  await fs.writeFile(path.join(distDir, '_redirects'), redirects);
  console.log('✓ _redirects 文件生成完成');
}

/**
 * 生成 Pages Functions
 */
async function generatePagesFunctions() {
  const functionsDir = path.join(process.cwd(), 'dist', 'functions');
  await fs.mkdir(functionsDir, { recursive: true });
  
  // API 代理函数
  const apiProxyFunction = `// Cloudflare Pages Function for API proxy
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // 代理到 Workers
  const workerUrl = \`https://classroom-points-system.your-subdomain.workers.dev\${url.pathname}\${url.search}\`;
  
  const response = await fetch(workerUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
  
  return response;
}`;

  await fs.mkdir(path.join(functionsDir, 'api'), { recursive: true });
  await fs.writeFile(path.join(functionsDir, 'api', '[[path]].js'), apiProxyFunction);
  
  // 健康检查函数
  const healthFunction = `// Health check function
export async function onRequest() {
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'pages'
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
}`;

  await fs.writeFile(path.join(functionsDir, 'health.js'), healthFunction);
  
  console.log('✓ Pages Functions 生成完成');
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

// 运行构建
if (require.main === module) {
  buildPages();
}

module.exports = { buildPages };