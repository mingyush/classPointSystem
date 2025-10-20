/**
 * DisplayManagerV1 单元测试
 */

// Mock SSE服务
jest.mock('../services/sseService', () => ({
    broadcast: jest.fn()
}));

// Mock 存储适配器
const mockStorageAdapter = {
    isConnected: true,
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    getSystemState: jest.fn(),
    updateSystemState: jest.fn(),
    createSystemState: jest.fn(),
    getUserById: jest.fn()
};

// Mock 存储适配器工厂
jest.mock('../adapters/storageAdapterFactory', () => ({
    storageAdapterFactory: {
        create: jest.fn().mockResolvedValue(mockStorageAdapter)
    }
}));

const { DisplayManagerV1 } = require('../services/displayManager');
const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');

describe('DisplayManagerV1', () => {
    let displayManager;
    
    beforeEach(async () => {
        jest.clearAllMocks();
        
        // 重置mock适配器的默认行为
        mockStorageAdapter.getSystemState.mockResolvedValue({
            id: 'default',
            classId: 'default',
            mode: 'normal',
            currentTeacher: null,
            sessionStartTime: null,
            lastActivity: new Date().toISOString(),
            isAuthenticated: false,
            autoSwitchHours: 2
        });
        
        mockStorageAdapter.updateSystemState.mockImplementation((classId, updates) => {
            return Promise.resolve({
                id: 'default',
                classId: 'default',
                mode: updates.mode || 'normal',
                currentTeacher: updates.currentTeacher || null,
                sessionStartTime: updates.sessionStartTime || null,
                lastActivity: updates.lastActivity || new Date().toISOString(),
                isAuthenticated: updates.isAuthenticated || false,
                autoSwitchHours: updates.autoSwitchHours || 2
            });
        });
        
        mockStorageAdapter.getUserById.mockResolvedValue({
            id: 'teacher1',
            name: '张老师',
            role: 'teacher'
        });
        
        displayManager = new DisplayManagerV1();
        await displayManager.initializeStorage();
    });
    
    afterEach(async () => {
        if (displayManager) {
            await displayManager.cleanup();
        }
    });

    describe('初始化', () => {
        test('应该正确初始化存储适配器', async () => {
            expect(storageAdapterFactory.create).toHaveBeenCalled();
            expect(mockStorageAdapter.connect).toHaveBeenCalled();
            expect(mockStorageAdapter.getSystemState).toHaveBeenCalledWith('default');
        });

        test('应该设置默认的类ID和自动切换时间', () => {
            expect(displayManager.classId).toBe('default');
            expect(displayManager.autoSwitchHours).toBe(2);
        });
    });

    describe('获取当前状态', () => {
        test('应该返回正确的系统状态', async () => {
            const state = await displayManager.getCurrentState();
            
            expect(state).toEqual({
                mode: 'normal',
                currentTeacher: null,
                sessionStartTime: null,
                lastActivity: expect.any(String),
                isAuthenticated: false,
                autoSwitchHours: 2,
                hasAutoSwitchTimer: false
            });
        });

        test('数据库错误时应该抛出异常', async () => {
            mockStorageAdapter.getSystemState.mockRejectedValue(new Error('数据库连接失败'));
            
            await expect(displayManager.getCurrentState()).rejects.toThrow('获取系统状态失败');
        });
    });

    describe('切换到上课模式', () => {
        test('应该成功切换到上课模式', async () => {
            const result = await displayManager.switchToClassMode('teacher1');
            
            expect(result.success).toBe(true);
            expect(result.mode).toBe('class');
            expect(result.currentTeacher).toBe('teacher1');
            expect(result.sessionStartTime).toBeDefined();
            expect(result.autoSwitchTime).toBeDefined();
            
            expect(mockStorageAdapter.updateSystemState).toHaveBeenCalledWith('default', {
                mode: 'class',
                currentTeacher: 'teacher1',
                sessionStartTime: expect.any(String),
                lastActivity: expect.any(String)
            });
        });

        test('教师ID为空时应该抛出异常', async () => {
            await expect(displayManager.switchToClassMode('')).rejects.toThrow('教师ID不能为空');
            await expect(displayManager.switchToClassMode(null)).rejects.toThrow('教师ID不能为空');
        });

        test('教师不存在时应该抛出异常', async () => {
            mockStorageAdapter.getUserById.mockResolvedValue(null);
            
            await expect(displayManager.switchToClassMode('nonexistent')).rejects.toThrow('教师不存在或权限不足');
        });

        test('用户角色不是教师时应该抛出异常', async () => {
            mockStorageAdapter.getUserById.mockResolvedValue({
                id: 'student1',
                name: '张三',
                role: 'student'
            });
            
            await expect(displayManager.switchToClassMode('student1')).rejects.toThrow('教师不存在或权限不足');
        });

        test('应该启动自动切换定时器', async () => {
            jest.spyOn(displayManager, 'startAutoSwitchTimer');
            
            await displayManager.switchToClassMode('teacher1');
            
            expect(displayManager.startAutoSwitchTimer).toHaveBeenCalledWith(2 * 60 * 60 * 1000);
        });
    });

    describe('切换到平时模式', () => {
        test('应该成功切换到平时模式', async () => {
            const result = await displayManager.switchToNormalMode();
            
            expect(result.success).toBe(true);
            expect(result.mode).toBe('normal');
            
            expect(mockStorageAdapter.updateSystemState).toHaveBeenCalledWith('default', {
                mode: 'normal',
                currentTeacher: null,
                sessionStartTime: null,
                lastActivity: expect.any(String)
            });
        });

        test('应该清除自动切换定时器', async () => {
            jest.spyOn(displayManager, 'clearAutoSwitchTimer');
            
            await displayManager.switchToNormalMode();
            
            expect(displayManager.clearAutoSwitchTimer).toHaveBeenCalled();
        });
    });

    describe('自动切换定时器', () => {
        test('应该正确启动定时器', () => {
            jest.useFakeTimers();
            jest.spyOn(displayManager, 'switchToNormalMode');
            
            displayManager.startAutoSwitchTimer(5000);
            
            expect(displayManager.autoSwitchTimer).toBeDefined();
            
            jest.advanceTimersByTime(5000);
            
            expect(displayManager.switchToNormalMode).toHaveBeenCalled();
            
            jest.useRealTimers();
        });

        test('应该正确清除定时器', () => {
            jest.useFakeTimers();
            
            displayManager.startAutoSwitchTimer(5000);
            expect(displayManager.autoSwitchTimer).toBeDefined();
            
            displayManager.clearAutoSwitchTimer();
            expect(displayManager.autoSwitchTimer).toBeNull();
            
            jest.useRealTimers();
        });

        test('启动新定时器时应该清除旧定时器', () => {
            jest.useFakeTimers();
            jest.spyOn(displayManager, 'clearAutoSwitchTimer');
            
            displayManager.startAutoSwitchTimer(5000);
            displayManager.startAutoSwitchTimer(10000);
            
            expect(displayManager.clearAutoSwitchTimer).toHaveBeenCalled();
            
            jest.useRealTimers();
        });
    });

    describe('恢复自动切换定时器', () => {
        test('上课模式且未超时时应该恢复定时器', async () => {
            const sessionStartTime = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30分钟前
            
            mockStorageAdapter.getSystemState.mockResolvedValue({
                mode: 'class',
                sessionStartTime,
                autoSwitchHours: 2
            });
            
            jest.spyOn(displayManager, 'startAutoSwitchTimer');
            
            await displayManager.restoreAutoSwitchTimer();
            
            expect(displayManager.startAutoSwitchTimer).toHaveBeenCalled();
        });

        test('上课模式且已超时时应该切换到平时模式', async () => {
            const sessionStartTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3小时前
            
            mockStorageAdapter.getSystemState.mockResolvedValue({
                mode: 'class',
                sessionStartTime,
                autoSwitchHours: 2
            });
            
            jest.spyOn(displayManager, 'switchToNormalMode');
            
            await displayManager.restoreAutoSwitchTimer();
            
            expect(displayManager.switchToNormalMode).toHaveBeenCalled();
        });

        test('平时模式时不应该启动定时器', async () => {
            mockStorageAdapter.getSystemState.mockResolvedValue({
                mode: 'normal',
                sessionStartTime: null,
                autoSwitchHours: 2
            });
            
            jest.spyOn(displayManager, 'startAutoSwitchTimer');
            
            await displayManager.restoreAutoSwitchTimer();
            
            expect(displayManager.startAutoSwitchTimer).not.toHaveBeenCalled();
        });
    });

    describe('活动时间更新', () => {
        test('应该更新最后活动时间', async () => {
            await displayManager.updateActivity();
            
            expect(mockStorageAdapter.updateSystemState).toHaveBeenCalledWith('default', {
                lastActivity: expect.any(String)
            });
        });
    });

    describe('认证状态管理', () => {
        test('应该设置认证状态', async () => {
            await displayManager.setAuthenticated(true);
            
            expect(mockStorageAdapter.updateSystemState).toHaveBeenCalledWith('default', {
                isAuthenticated: true,
                lastActivity: expect.any(String)
            });
        });

        test('应该检查认证状态', async () => {
            mockStorageAdapter.getSystemState.mockResolvedValue({
                isAuthenticated: true
            });
            
            const isAuthenticated = await displayManager.checkAuthentication();
            
            expect(isAuthenticated).toBe(true);
        });

        test('数据库错误时检查认证应该返回false', async () => {
            mockStorageAdapter.getSystemState.mockRejectedValue(new Error('数据库错误'));
            
            const isAuthenticated = await displayManager.checkAuthentication();
            
            expect(isAuthenticated).toBe(false);
        });
    });

    describe('强制切换', () => {
        test('管理员应该能强制切换到平时模式', async () => {
            mockStorageAdapter.getUserById.mockResolvedValue({
                id: 'admin1',
                name: '管理员',
                role: 'admin'
            });
            
            jest.spyOn(displayManager, 'switchToNormalMode').mockResolvedValue({ success: true, mode: 'normal' });
            
            const result = await displayManager.forceSwitch('normal', 'admin1');
            
            expect(result.success).toBe(true);
            expect(displayManager.switchToNormalMode).toHaveBeenCalled();
        });

        test('非管理员不能强制切换', async () => {
            mockStorageAdapter.getUserById.mockResolvedValue({
                id: 'teacher1',
                name: '张老师',
                role: 'teacher'
            });
            
            await expect(displayManager.forceSwitch('normal', 'teacher1')).rejects.toThrow('需要管理员权限');
        });

        test('不能强制切换到上课模式', async () => {
            mockStorageAdapter.getUserById.mockResolvedValue({
                id: 'admin1',
                name: '管理员',
                role: 'admin'
            });
            
            await expect(displayManager.forceSwitch('class', 'admin1')).rejects.toThrow('强制切换只能切换到平时模式');
        });
    });

    describe('自动切换时间设置', () => {
        test('应该设置有效的自动切换时间', async () => {
            const result = await displayManager.setAutoSwitchHours(3);
            
            expect(result.success).toBe(true);
            expect(result.autoSwitchHours).toBe(3);
            
            expect(mockStorageAdapter.updateSystemState).toHaveBeenCalledWith('default', {
                autoSwitchHours: 3
            });
        });

        test('应该拒绝无效的自动切换时间', async () => {
            await expect(displayManager.setAutoSwitchHours(0.3)).rejects.toThrow('自动切换时间必须在0.5-24小时之间');
            await expect(displayManager.setAutoSwitchHours(25)).rejects.toThrow('自动切换时间必须在0.5-24小时之间');
        });

        test('上课模式时更改时间应该重新设置定时器', async () => {
            const sessionStartTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
            
            mockStorageAdapter.getSystemState.mockResolvedValue({
                mode: 'class',
                sessionStartTime,
                autoSwitchHours: 2
            });
            
            jest.spyOn(displayManager, 'startAutoSwitchTimer');
            
            await displayManager.setAutoSwitchHours(1);
            
            expect(displayManager.startAutoSwitchTimer).toHaveBeenCalled();
        });
    });

    describe('统计信息', () => {
        test('应该返回正确的统计信息', async () => {
            const mockState = {
                mode: 'class',
                currentTeacher: 'teacher1',
                sessionStartTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1小时前
                lastActivity: new Date().toISOString(),
                isAuthenticated: true,
                autoSwitchHours: 2
            };
            
            mockStorageAdapter.getSystemState.mockResolvedValue(mockState);
            displayManager.autoSwitchTimer = setTimeout(() => {}, 1000);
            
            const stats = await displayManager.getStatistics();
            
            expect(stats.mode).toBe('class');
            expect(stats.currentTeacher).toBe('teacher1');
            expect(stats.hasActiveTimer).toBe(true);
            expect(stats.uptime).toBeGreaterThan(0);
            
            clearTimeout(displayManager.autoSwitchTimer);
        });
    });

    describe('健康检查', () => {
        test('应该返回健康状态', async () => {
            const health = await displayManager.healthCheck();
            
            expect(health.healthy).toBe(true);
            expect(health.mode).toBeDefined();
            expect(health.lastActivity).toBeDefined();
            expect(health.timestamp).toBeDefined();
        });

        test('数据库错误时应该返回不健康状态', async () => {
            mockStorageAdapter.getSystemState.mockRejectedValue(new Error('数据库错误'));
            
            const health = await displayManager.healthCheck();
            
            expect(health.healthy).toBe(false);
            expect(health.error).toBe('数据库错误');
        });
    });

    describe('资源清理', () => {
        test('应该正确清理资源', async () => {
            jest.spyOn(displayManager, 'clearAutoSwitchTimer');
            
            await displayManager.cleanup();
            
            expect(displayManager.clearAutoSwitchTimer).toHaveBeenCalled();
            expect(mockStorageAdapter.disconnect).toHaveBeenCalled();
        });
    });
});