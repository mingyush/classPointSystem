/**
 * 教室大屏状态管理服务 V1
 * 
 * 功能：
 * - 管理大屏的平时模式和上课模式
 * - 简化的单班级状态管理
 * - 使用数据库存储状态而非JSON文件
 * - 自动切换模式定时器管理
 */

const { createError } = require('../middleware/errorHandler');
const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');

/**
 * 大屏状态管理器类 V1
 */
class DisplayManager {
    constructor() {
        this.classId = 'default'; // V1版本只支持单班级
        this.storageAdapter = null;
        this.autoSwitchTimer = null;
        this.autoSwitchHours = 2; // 默认2小时自动切换
        
        // 异步初始化，不在构造函数中等待
        this.initializeStorage().catch(error => {
            console.error('DisplayManagerV1初始化失败:', error);
        });
    }

    /**
     * 初始化存储适配器
     */
    async initializeStorage() {
        try {
            this.storageAdapter = await storageAdapterFactory.createAdapter();
            await this.storageAdapter.connect();
            
            // 确保系统状态存在
            await this.ensureSystemStateExists();
            
            // 恢复定时器（如果需要）
            await this.restoreAutoSwitchTimer();
        } catch (error) {
            console.error('初始化存储适配器失败:', error);
            throw error;
        }
    }

    /**
     * 确保系统状态存在
     */
    async ensureSystemStateExists() {
        try {
            await this.storageAdapter.getSystemState(this.classId);
        } catch (error) {
            // 如果不存在，会自动创建默认状态
            console.log('系统状态已初始化');
        }
    }

    /**
     * 恢复自动切换定时器
     */
    async restoreAutoSwitchTimer() {
        try {
            const state = await this.storageAdapter.getSystemState(this.classId);
            
            if (state.mode === 'class' && state.sessionStartTime) {
                const elapsed = Date.now() - new Date(state.sessionStartTime).getTime();
                const remaining = state.autoSwitchHours * 60 * 60 * 1000 - elapsed;
                
                if (remaining > 0) {
                    this.startAutoSwitchTimer(remaining);
                } else {
                    // 已超时，切换到平时模式
                    await this.switchToNormalMode();
                }
            }
        } catch (error) {
            console.error('恢复自动切换定时器失败:', error);
        }
    }

    /**
     * 获取当前系统状态
     */
    async getCurrentState() {
        try {
            const state = await this.storageAdapter.getSystemState(this.classId);
            return {
                mode: state.mode,
                currentTeacher: state.currentTeacher,
                sessionStartTime: state.sessionStartTime,
                lastActivity: state.lastActivity,
                isAuthenticated: state.isAuthenticated,
                autoSwitchHours: state.autoSwitchHours,
                hasAutoSwitchTimer: !!this.autoSwitchTimer
            };
        } catch (error) {
            console.error('获取系统状态失败:', error);
            throw createError('DATABASE_ERROR', '获取系统状态失败');
        }
    }

    /**
     * 切换到上课模式
     */
    async switchToClassMode(teacherId) {
        try {
            if (!teacherId) {
                throw createError('VALIDATION_ERROR', '教师ID不能为空');
            }

            // 验证教师是否存在
            const teacher = await this.storageAdapter.getUserById(this.classId, teacherId);
            if (!teacher || (teacher.role !== 'teacher' && teacher.role !== 'admin')) {
                throw createError('TEACHER_REQUIRED', '教师不存在或权限不足');
            }

            const now = new Date().toISOString();
            
            // 更新系统状态
            const updatedState = await this.storageAdapter.updateSystemState(this.classId, {
                mode: 'class',
                currentTeacher: teacherId,
                sessionStartTime: now,
                lastActivity: now
            });
            
            // 启动自动切换定时器
            this.startAutoSwitchTimer(updatedState.autoSwitchHours * 60 * 60 * 1000);
            
            // 广播状态变更
            this.broadcastStateChange(updatedState);
            
            return {
                success: true,
                mode: 'class',
                currentTeacher: teacherId,
                sessionStartTime: now,
                autoSwitchTime: new Date(Date.now() + updatedState.autoSwitchHours * 60 * 60 * 1000)
            };
        } catch (error) {
            console.error('切换到上课模式失败:', error);
            throw error;
        }
    }

    /**
     * 切换到平时模式
     */
    async switchToNormalMode() {
        try {
            const now = new Date().toISOString();
            
            // 更新系统状态
            const updatedState = await this.storageAdapter.updateSystemState(this.classId, {
                mode: 'normal',
                currentTeacher: null,
                sessionStartTime: null,
                lastActivity: now
            });
            
            // 清除自动切换定时器
            this.clearAutoSwitchTimer();
            
            // 广播状态变更
            this.broadcastStateChange(updatedState);
            
            return {
                success: true,
                mode: 'normal'
            };
        } catch (error) {
            console.error('切换到平时模式失败:', error);
            throw error;
        }
    }

    /**
     * 启动自动切换定时器
     */
    startAutoSwitchTimer(delayMs) {
        // 清除现有定时器
        this.clearAutoSwitchTimer();
        
        this.autoSwitchTimer = setTimeout(async () => {
            console.log('自动切换到平时模式');
            try {
                await this.switchToNormalMode();
            } catch (error) {
                console.error('自动切换失败:', error);
            }
        }, delayMs);
        
        console.log(`设置自动切换定时器，${Math.round(delayMs / 1000 / 60)} 分钟后切换`);
    }

    /**
     * 清除自动切换定时器
     */
    clearAutoSwitchTimer() {
        if (this.autoSwitchTimer) {
            clearTimeout(this.autoSwitchTimer);
            this.autoSwitchTimer = null;
        }
    }

    /**
     * 更新活动时间
     */
    async updateActivity() {
        try {
            await this.storageAdapter.updateSystemState(this.classId, {
                lastActivity: new Date().toISOString()
            });
        } catch (error) {
            console.error('更新活动时间失败:', error);
        }
    }

    /**
     * 设置认证状态
     */
    async setAuthenticated(isAuthenticated) {
        try {
            await this.storageAdapter.updateSystemState(this.classId, {
                isAuthenticated,
                lastActivity: new Date().toISOString()
            });
        } catch (error) {
            console.error('设置认证状态失败:', error);
            throw error;
        }
    }

    /**
     * 检查认证状态
     */
    async checkAuthentication() {
        try {
            const state = await this.storageAdapter.getSystemState(this.classId);
            return state.isAuthenticated;
        } catch (error) {
            console.error('检查认证状态失败:', error);
            return false;
        }
    }

    /**
     * 强制切换模式（管理员权限）
     */
    async forceSwitch(mode, adminUserId) {
        try {
            // 验证管理员权限
            const admin = await this.storageAdapter.getUserById(this.classId, adminUserId);
            if (!admin || admin.role !== 'admin') {
                throw createError('PERMISSION_DENIED', '需要管理员权限');
            }

            if (mode === 'normal') {
                return await this.switchToNormalMode();
            } else if (mode === 'class') {
                throw createError('VALIDATION_ERROR', '强制切换只能切换到平时模式');
            } else {
                throw createError('VALIDATION_ERROR', '无效的模式');
            }
        } catch (error) {
            console.error('强制切换模式失败:', error);
            throw error;
        }
    }

    /**
     * 设置自动切换时间
     */
    async setAutoSwitchHours(hours) {
        try {
            if (hours < 0.5 || hours > 24) {
                throw createError('VALIDATION_ERROR', '自动切换时间必须在0.5-24小时之间');
            }

            await this.storageAdapter.updateSystemState(this.classId, {
                autoSwitchHours: hours
            });

            // 如果当前处于上课模式，重新设置定时器
            const state = await this.storageAdapter.getSystemState(this.classId);
            if (state.mode === 'class' && state.sessionStartTime) {
                const elapsed = Date.now() - new Date(state.sessionStartTime).getTime();
                const remaining = hours * 60 * 60 * 1000 - elapsed;
                
                if (remaining > 0) {
                    this.startAutoSwitchTimer(remaining);
                } else {
                    await this.switchToNormalMode();
                }
            }

            return { success: true, autoSwitchHours: hours };
        } catch (error) {
            console.error('设置自动切换时间失败:', error);
            throw error;
        }
    }

    /**
     * 广播状态变更
     */
    broadcastStateChange(state) {
        try {
            const sseService = require('./sseService');
            sseService.broadcast({
                type: 'display_mode_changed',
                data: {
                    mode: state.mode,
                    currentTeacher: state.currentTeacher,
                    sessionStartTime: state.sessionStartTime,
                    lastActivity: state.lastActivity
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('广播状态变更失败:', error);
        }
    }

    /**
     * 获取统计信息
     */
    async getStatistics() {
        try {
            const state = await this.storageAdapter.getSystemState(this.classId);
            
            return {
                mode: state.mode,
                currentTeacher: state.currentTeacher,
                sessionStartTime: state.sessionStartTime,
                lastActivity: state.lastActivity,
                isAuthenticated: state.isAuthenticated,
                autoSwitchHours: state.autoSwitchHours,
                hasActiveTimer: !!this.autoSwitchTimer,
                uptime: state.sessionStartTime ? 
                    Date.now() - new Date(state.sessionStartTime).getTime() : 0
            };
        } catch (error) {
            console.error('获取统计信息失败:', error);
            throw error;
        }
    }

    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const state = await this.storageAdapter.getSystemState(this.classId);
            const isHealthy = this.storageAdapter && this.storageAdapter.isConnected;
            
            return {
                healthy: isHealthy,
                mode: state.mode,
                lastActivity: state.lastActivity,
                hasTimer: !!this.autoSwitchTimer,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('健康检查失败:', error);
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * 清理资源
     */
    async cleanup() {
        this.clearAutoSwitchTimer();
        if (this.storageAdapter) {
            await this.storageAdapter.disconnect();
        }
    }
}

// 创建全局实例
const displayManagerV1 = new DisplayManager();

// 进程退出时清理资源
process.on('SIGINT', async () => {
    console.log('正在清理DisplayManagerV1资源...');
    await displayManagerV1.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('正在清理DisplayManagerV1资源...');
    await displayManagerV1.cleanup();
    process.exit(0);
});

module.exports = {
    DisplayManagerV1: DisplayManager,
    displayManagerV1
};