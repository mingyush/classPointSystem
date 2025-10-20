/**
 * Cloudflare Workers 路由器
 */

import { handleAPIRequest } from '../api/index';
import { handleStaticFile } from './static';

/**
 * 创建路由器
 */
export function createRouter() {
  return new Router();
}

/**
 * 路由器类
 */
class Router {
  constructor() {
    this.routes = [];
  }

  /**
   * 添加路由
   */
  add(method, pattern, handler) {
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(pattern),
      handler
    });
  }

  /**
   * GET 路由
   */
  get(pattern, handler) {
    this.add('GET', pattern, handler);
  }

  /**
   * POST 路由
   */
  post(pattern, handler) {
    this.add('POST', pattern, handler);
  }

  /**
   * PUT 路由
   */
  put(pattern, handler) {
    this.add('PUT', pattern, handler);
  }

  /**
   * DELETE 路由
   */
  delete(pattern, handler) {
    this.add('DELETE', pattern, handler);
  }

  /**
   * 处理请求
   */
  async handle(context) {
    const { method, pathname } = context;

    // API 路由
    if (pathname.startsWith('/api/')) {
      return await handleAPIRequest(context);
    }

    // 静态文件路由
    if (pathname.startsWith('/static/') || 
        pathname.endsWith('.css') || 
        pathname.endsWith('.js') || 
        pathname.endsWith('.png') || 
        pathname.endsWith('.jpg') || 
        pathname.endsWith('.ico')) {
      return await handleStaticFile(context);
    }

    // 页面路由
    return await this.handlePageRoute(context);
  }

  /**
   * 处理页面路由
   */
  async handlePageRoute(context) {
    const { pathname } = context;

    // 根据路径返回相应的 HTML 页面
    switch (pathname) {
      case '/':
        return await this.serveHTML('index.html');
      
      case '/display':
        return await this.serveHTML('display/index.html');
      
      case '/admin':
        return await this.serveHTML('teacher/index.html');
      
      case '/student':
        // 重定向到教室大屏，学生查询功能已合并
        return Response.redirect('/display', 302);
      
      default:
        return new Response('页面未找到', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
  }

  /**
   * 服务 HTML 文件
   */
  async serveHTML(filename) {
    try {
      // 在 Cloudflare Pages 中，静态文件会自动处理
      // 这里返回一个重定向或者基本的 HTML 结构
      const html = await this.getHTMLContent(filename);
      
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        }
      });
      
    } catch (error) {
      console.error('服务 HTML 文件错误:', error);
      return new Response('页面加载失败', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }

  /**
   * 获取 HTML 内容
   */
  async getHTMLContent(filename) {
    // 基本的 HTML 模板
    const templates = {
      'index.html': `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>班级积分管理系统</title>
          <link rel="stylesheet" href="/static/css/common.css">
        </head>
        <body>
          <div class="container">
            <h1>班级积分管理系统</h1>
            <div class="menu">
              <a href="/display" class="btn btn-primary">教室大屏</a>
              <a href="/admin" class="btn btn-secondary">管理后台</a>
              <a href="/student" class="btn btn-info">学生查询</a>
            </div>
          </div>
          <script src="/static/js/common.js"></script>
        </body>
        </html>
      `,
      
      'display/index.html': `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>教室大屏 - 班级积分系统</title>
          <link rel="stylesheet" href="/static/css/display.css">
        </head>
        <body>
          <div id="app">
            <div id="display-container">
              <!-- 大屏内容将通过 JavaScript 动态加载 -->
            </div>
          </div>
          <script src="/static/js/display.js"></script>
        </body>
        </html>
      `,
      
      'teacher/index.html': `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>管理后台 - 班级积分系统</title>
          <link rel="stylesheet" href="/static/css/teacher.css">
        </head>
        <body>
          <div id="app">
            <div id="admin-container">
              <!-- 管理后台内容将通过 JavaScript 动态加载 -->
            </div>
          </div>
          <script src="/static/js/teacher.js"></script>
        </body>
        </html>
      `,
      

    };

    return templates[filename] || templates['index.html'];
  }
}