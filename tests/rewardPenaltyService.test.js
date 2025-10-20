const RewardPenaltyService = require('../services/rewardPenaltyService');
const { RewardPenaltyItem } = require('../models/dataModels');

describe('RewardPenaltyService', () => {
    let service;
    
    beforeEach(() => {
        service = new RewardPenaltyService('test-class');
    });

    describe('RewardPenaltyItem Model', () => {
        test('应该创建有效的奖励项', () => {
            const rewardData = {
                name: '课堂表现优秀',
                points: 5,
                type: 'reward'
            };
            
            const reward = new RewardPenaltyItem(rewardData);
            const validation = reward.validate();
            
            expect(validation.isValid).toBe(true);
            expect(reward.name).toBe('课堂表现优秀');
            expect(reward.points).toBe(5);
            expect(reward.type).toBe('reward');
        });

        test('应该创建有效的惩罚项', () => {
            const penaltyData = {
                name: '课堂违纪',
                points: -2,
                type: 'penalty'
            };
            
            const penalty = new RewardPenaltyItem(penaltyData);
            const validation = penalty.validate();
            
            expect(validation.isValid).toBe(true);
            expect(penalty.name).toBe('课堂违纪');
            expect(penalty.points).toBe(-2);
            expect(penalty.type).toBe('penalty');
        });

        test('应该验证奖励项积分为正数', () => {
            const invalidReward = new RewardPenaltyItem({
                name: '测试奖励',
                points: -1, // 奖励项不能为负数
                type: 'reward'
            });
            
            const validation = invalidReward.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('奖励项积分必须为正数');
        });

        test('应该验证惩罚项积分为负数', () => {
            const invalidPenalty = new RewardPenaltyItem({
                name: '测试惩罚',
                points: 1, // 惩罚项不能为正数
                type: 'penalty'
            });
            
            const validation = invalidPenalty.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('惩罚项积分必须为负数');
        });

        test('应该验证必需字段', () => {
            const invalidItem = new RewardPenaltyItem({
                // 缺少name
                points: 5,
                type: 'reward'
            });
            
            const validation = invalidItem.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('奖惩项名称不能为空且必须为字符串');
        });

        test('应该验证类型字段', () => {
            const invalidItem = new RewardPenaltyItem({
                name: '测试项目',
                points: 5,
                type: 'invalid' // 无效类型
            });
            
            const validation = invalidItem.validate();
            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain('奖惩项类型必须为: reward, penalty');
        });
    });

    describe('Service Methods', () => {
        test('应该有正确的构造函数', () => {
            expect(service.classId).toBe('test-class');
            expect(service.adapter).toBeNull();
        });

        test('应该有所有必需的方法', () => {
            expect(typeof service.getAllRewardPenaltyItems).toBe('function');
            expect(typeof service.getRewardPenaltyItemById).toBe('function');
            expect(typeof service.createRewardPenaltyItem).toBe('function');
            expect(typeof service.updateRewardPenaltyItem).toBe('function');
            expect(typeof service.deleteRewardPenaltyItem).toBe('function');
            expect(typeof service.getRewardItems).toBe('function');
            expect(typeof service.getPenaltyItems).toBe('function');
            expect(typeof service.applyRewardPenaltyItem).toBe('function');
            expect(typeof service.batchApplyRewardPenaltyItems).toBe('function');
            expect(typeof service.getRewardPenaltyStatistics).toBe('function');
            expect(typeof service.createDefaultItems).toBe('function');
            expect(typeof service.reorderItems).toBe('function');
            expect(typeof service.toggleItemStatus).toBe('function');
        });
    });

    describe('Default Items', () => {
        test('应该定义默认奖惩项', () => {
            // 这个测试验证createDefaultItems方法的结构
            expect(typeof service.createDefaultItems).toBe('function');
        });
    });
});