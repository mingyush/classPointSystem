/**
 * Cloudflare Workers 入口文件
 * 班级积分管理系统 
 */

import { handleRequest } from './handlers/requestHandler';
import { handleScheduled } from './handlers/scheduledHandler';
import { initializeEnvironment } from './utils/environment';

// Workers 环境变量和绑定
let env;

/**
 * 处理 HTTP 请求
 */
export default {
  async fetch(request, environment, ctx) {
    env = environment;
    
    try {
      // 初始化环境
      await initializeEnvironment(env);
      
      // 处理请求
      return await handleRequest(request, env, ctx);
      
    } catch (error) {
      console.error('Workers 请求处理错误:', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: '服务暂时不可用',
          error: error.message
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  },

  /**
   * 处理定时任务
   */
  async scheduled(event, environment, ctx) {
    env = environment;
    
    try {
      await handleScheduled(event, env, ctx);
    } catch (error) {
      console.error('定时任务执行错误:', error);
    }
  }
};

/**
 * 获取当前环境
 */
export function getEnvironment() {
  return env;
}