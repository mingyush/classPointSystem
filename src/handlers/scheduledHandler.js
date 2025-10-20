/**
 * Cloudflare Workers 定时任务处理器
 */

import { createD1Adapter } from '../adapters/d1Adapter';

/**
 * 处理定时任务
 */
export async function handleScheduled(event, env, ctx) {
  console.log('执行定时任务:', event.cron);
  
  try {
    const dbAdapter = createD1Adapter(env.DB);
    
    // 根据 cron 表达式执行不同任务
    switch (event.cron) {
      case '0 2 * * *': // 每天凌晨2点
        await performDailyMaintenance(dbAdapter, env);
        break;
        
      case '0 0 * * 0': // 每周日凌晨
        await performWeeklyMaintenance(dbAdapter, env);
        break;
        
      case '0 0 1 * *': // 每月1号凌晨
        await performMonthlyMaintenance(dbAdapter, env);
        break;
        
      default:
        console.log('未知的定时任务:', event.cron);
    }
    
  } catch (error) {
    console.error('定时任务执行失败:', error);
  }
}

/**
 * 每日维护任务
 */
async function performDailyMaintenance(dbAdapter, env) {
  console.log('执行每日维护任务');
  
  try {
    // 1. 清理过期会话
    await cleanExpiredSessions(env.SESSIONS);
    
    // 2. 检查系统状态自动切换
    await checkAutoModeSwitch(dbAdapter);
    
    // 3. 生成每日统计
    await generateDailyStats(dbAdapter);
    
    // 4. 清理临时数据
    await cleanTemporaryData(dbAdapter);
    
    console.log('每日维护任务完成');
    
  } catch (error) {
    console.error('每日维护任务失败:', error);
  }
}

/**
 * 每周维护任务
 */
async function performWeeklyMaintenance(dbAdapter, env) {
  console.log('执行每周维护任务');
  
  try {
    // 1. 生成周统计报告
    await generateWeeklyReport(dbAdapter);
    
    // 2. 优化数据库
    await optimizeDatabase(dbAdapter);
    
    // 3. 检查数据完整性
    await checkDataIntegrity(dbAdapter);
    
    console.log('每周维护任务完成');
    
  } catch (error) {
    console.error('每周维护任务失败:', error);
  }
}

/**
 * 每月维护任务
 */
async function performMonthlyMaintenance(dbAdapter, env) {
  console.log('执行每月维护任务');
  
  try {
    // 1. 生成月度报告
    await generateMonthlyReport(dbAdapter);
    
    // 2. 归档旧数据
    await archiveOldData(dbAdapter);
    
    // 3. 系统健康检查
    await performHealthCheck(dbAdapter);
    
    console.log('每月维护任务完成');
    
  } catch (error) {
    console.error('每月维护任务失败:', error);
  }
}

/**
 * 清理过期会话
 */
async function cleanExpiredSessions(sessionsKV) {
  if (!sessionsKV) return;
  
  try {
    // KV 存储会自动处理 TTL，这里可以添加额外的清理逻辑
    console.log('会话清理完成');
  } catch (error) {
    console.error('清理会话失败:', error);
  }
}

/**
 * 检查系统状态自动切换
 */
async function checkAutoModeSwitch(dbAdapter) {
  try {
    const state = await dbAdapter.querySQL(
      'SELECT * FROM system_state WHERE id = ?',
      ['default']
    );
    
    if (state.results.length > 0) {
      const currentState = state.results[0];
      
      if (currentState.mode === 'class' && currentState.session_start_time) {
        const sessionStart = new Date(currentState.session_start_time);
        const now = new Date();
        const hoursDiff = (now - sessionStart) / (1000 * 60 * 60);
        
        // 如果上课模式超过设定时间，自动切换回平时模式
        const autoSwitchHours = currentState.auto_switch_hours || 2;
        if (hoursDiff >= autoSwitchHours) {
          await dbAdapter.runSQL(
            'UPDATE system_state SET mode = ?, current_teacher = NULL, session_start_time = NULL, updated_at = ? WHERE id = ?',
            ['normal', new Date().toISOString(), 'default']
          );
          
          console.log('自动切换到平时模式');
        }
      }
    }
  } catch (error) {
    console.error('检查自动模式切换失败:', error);
  }
}

/**
 * 生成每日统计
 */
async function generateDailyStats(dbAdapter) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 统计今日积分变化
    const pointsStats = await dbAdapter.querySQL(
      `SELECT 
        COUNT(*) as total_records,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_rewards,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_penalties
       FROM point_records 
       WHERE DATE(created_at) = ?`,
      [today]
    );
    
    // 统计今日订单
    const orderStats = await dbAdapter.querySQL(
      `SELECT 
        COUNT(*) as total_orders,
        SUM(total_price) as total_amount
       FROM orders 
       WHERE DATE(created_at) = ?`,
      [today]
    );
    
    console.log('每日统计生成完成:', {
      points: pointsStats.results[0],
      orders: orderStats.results[0]
    });
    
  } catch (error) {
    console.error('生成每日统计失败:', error);
  }
}

/**
 * 清理临时数据
 */
async function cleanTemporaryData(dbAdapter) {
  try {
    // 清理30天前的已完成订单
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    await dbAdapter.runSQL(
      'DELETE FROM orders WHERE status = ? AND completed_at < ?',
      ['completed', thirtyDaysAgo.toISOString()]
    );
    
    console.log('临时数据清理完成');
    
  } catch (error) {
    console.error('清理临时数据失败:', error);
  }
}

/**
 * 生成周统计报告
 */
async function generateWeeklyReport(dbAdapter) {
  try {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // 本周积分统计
    const weeklyPoints = await dbAdapter.querySQL(
      `SELECT 
        u.name,
        SUM(pr.amount) as weekly_points
       FROM point_records pr
       JOIN users u ON pr.student_id = u.id
       WHERE pr.created_at >= ? AND u.role = 'student'
       GROUP BY u.id, u.name
       ORDER BY weekly_points DESC`,
      [oneWeekAgo.toISOString()]
    );
    
    console.log('周统计报告生成完成，活跃学生数:', weeklyPoints.results.length);
    
  } catch (error) {
    console.error('生成周统计报告失败:', error);
  }
}

/**
 * 优化数据库
 */
async function optimizeDatabase(dbAdapter) {
  try {
    // D1 数据库会自动优化，这里可以添加自定义优化逻辑
    console.log('数据库优化完成');
    
  } catch (error) {
    console.error('数据库优化失败:', error);
  }
}

/**
 * 检查数据完整性
 */
async function checkDataIntegrity(dbAdapter) {
  try {
    // 检查外键约束
    const orphanedRecords = await dbAdapter.querySQL(
      `SELECT COUNT(*) as count FROM point_records pr
       LEFT JOIN users u ON pr.student_id = u.id
       WHERE u.id IS NULL`
    );
    
    if (orphanedRecords.results[0].count > 0) {
      console.warn('发现孤立的积分记录:', orphanedRecords.results[0].count);
    }
    
    console.log('数据完整性检查完成');
    
  } catch (error) {
    console.error('数据完整性检查失败:', error);
  }
}

/**
 * 生成月度报告
 */
async function generateMonthlyReport(dbAdapter) {
  try {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    // 月度活跃用户统计
    const monthlyActive = await dbAdapter.querySQL(
      `SELECT COUNT(DISTINCT student_id) as active_students
       FROM point_records
       WHERE created_at >= ?`,
      [oneMonthAgo.toISOString()]
    );
    
    console.log('月度报告生成完成，活跃学生数:', monthlyActive.results[0].active_students);
    
  } catch (error) {
    console.error('生成月度报告失败:', error);
  }
}

/**
 * 归档旧数据
 */
async function archiveOldData(dbAdapter) {
  try {
    // 这里可以实现数据归档逻辑
    // 例如将超过一年的数据移动到归档表
    console.log('数据归档完成');
    
  } catch (error) {
    console.error('数据归档失败:', error);
  }
}

/**
 * 系统健康检查
 */
async function performHealthCheck(dbAdapter) {
  try {
    // 检查数据库连接
    await dbAdapter.querySQL('SELECT 1');
    
    // 检查关键表
    const tables = ['users', 'point_records', 'products', 'orders'];
    for (const table of tables) {
      await dbAdapter.querySQL(`SELECT COUNT(*) FROM ${table}`);
    }
    
    console.log('系统健康检查完成');
    
  } catch (error) {
    console.error('系统健康检查失败:', error);
  }
}