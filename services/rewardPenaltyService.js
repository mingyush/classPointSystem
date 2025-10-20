const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');
const { RewardPenaltyItem } = require('../models/dataModels');

/**
 * 奖惩项管理服务 - V1版本
 * 处理奖惩项相关的业务逻辑
 * 支持快速积分操作功能
 */
class RewardPenaltyService {
    constructor(classId = null) {
        // 从配置文件获取classId，如果没有则使用传入的参数，最后默认为'default'
        if (!classId) {
            try {
                const fs = require('fs');
                const path = require('path');
                const configPath = path.join(__dirname, '../config/config.json');
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                classId = config.classId || 'default';
            } catch (error) {
                classId = 'default';
            }
        }
        this.classId = classId;
        this.adapter = null;
    }

    /**
     * 获取存储适配器
     */
    async getAdapter() {
        if (!this.adapter) {
            this.adapter = await storageAdapterFactory.getDefaultAdapter();
        }
        return this.adapter;
    }

    /**
     * 获取所有奖惩项
     * @param {boolean} activeOnly - 是否只返回启用的奖惩项
     * @returns {Promise<RewardPenaltyItem[]>}
     */
    async getAllRewardPenaltyItems(activeOnly = true) {
        try {
            const adapter = await this.getAdapter();
            const items = await adapter.getRewardPenaltyItems(this.classId);
            
            let rewardPenaltyItems = items.map(item => new RewardPenaltyItem(item));
            
            if (activeOnly) {
                rewardPenaltyItems = rewardPenaltyItems.filter(item => item.isActive);
            }
            
            // 按排序值排序
            rewardPenaltyItems.sort((a, b) => a.sortOrder - b.sortOrder);
            
            return rewardPenaltyItems;
        } catch (error) {
            console.error('获取奖惩项列表失败:', error);
            throw new Error('获取奖惩项列表失败');
        }
    }

    /**
     * 根据ID获取奖惩项
     * @param {string} itemId - 奖惩项ID
     * @returns {Promise<RewardPenaltyItem|null>}
     */
    async getRewardPenaltyItemById(itemId) {
        try {
            const items = await this.getAllRewardPenaltyItems(false);
            const item = items.find(i => i.id === itemId);
            
            return item || null;
        } catch (error) {
            console.error('获取奖惩项失败:', error);
            throw new Error('获取奖惩项失败');
        }
    }

    /**
     * 创建新奖惩项
     * @param {object} itemData - 奖惩项数据
     * @returns {Promise<RewardPenaltyItem>}
     */
    async createRewardPenaltyItem(itemData) {
        try {
            const item = new RewardPenaltyItem(itemData);
            
            // 验证奖惩项数据
            const validation = item.validate();
            if (!validation.isValid) {
                throw new Error('奖惩项数据验证失败: ' + validation.errors.join(', '));
            }

            const adapter = await this.getAdapter();
            const createdItem = await adapter.createRewardPenaltyItem(this.classId, item.toJSON());
            
            console.log(`创建奖惩项成功: ${createdItem.name} (${createdItem.points}分)`);
            return new RewardPenaltyItem(createdItem);
            
        } catch (error) {
            console.error('创建奖惩项失败:', error);
            throw error;
        }
    }

    /**
     * 更新奖惩项信息
     * @param {string} itemId - 奖惩项ID
     * @param {object} updateData - 更新数据
     * @returns {Promise<RewardPenaltyItem>}
     */
    async updateRewardPenaltyItem(itemId, updateData) {
        try {
            const adapter = await this.getAdapter();
            const updatedItem = await adapter.updateRewardPenaltyItem(this.classId, itemId, updateData);
            
            console.log(`更新奖惩项成功: ${updatedItem.name} (ID: ${itemId})`);
            return new RewardPenaltyItem(updatedItem);
            
        } catch (error) {
            console.error('更新奖惩项失败:', error);
            throw error;
        }
    }

    /**
     * 删除奖惩项
     * @param {string} itemId - 奖惩项ID
     * @returns {Promise<boolean>}
     */
    async deleteRewardPenaltyItem(itemId) {
        try {
            const adapter = await this.getAdapter();
            const result = await adapter.deleteRewardPenaltyItem(this.classId, itemId);
            
            if (result) {
                console.log(`删除奖惩项成功: ID ${itemId}`);
            }
            return result;
            
        } catch (error) {
            console.error('删除奖惩项失败:', error);
            throw error;
        }
    }

    /**
     * 获取奖励项列表
     * @returns {Promise<RewardPenaltyItem[]>}
     */
    async getRewardItems() {
        try {
            const items = await this.getAllRewardPenaltyItems(true);
            return items.filter(item => item.type === 'reward');
        } catch (error) {
            console.error('获取奖励项失败:', error);
            throw error;
        }
    }

    /**
     * 获取惩罚项列表
     * @returns {Promise<RewardPenaltyItem[]>}
     */
    async getPenaltyItems() {
        try {
            const items = await this.getAllRewardPenaltyItems(true);
            return items.filter(item => item.type === 'penalty');
        } catch (error) {
            console.error('获取惩罚项失败:', error);
            throw error;
        }
    }

    /**
     * 快速积分操作 - 使用奖惩项为学生加减分
     * @param {string} studentId - 学生ID
     * @param {string} itemId - 奖惩项ID
     * @param {string} teacherId - 教师ID
     * @returns {Promise<object>} 操作结果
     */
    async applyRewardPenaltyItem(studentId, itemId, teacherId) {
        try {
            // 获取奖惩项信息
            const item = await this.getRewardPenaltyItemById(itemId);
            if (!item) {
                throw new Error('奖惩项不存在');
            }

            if (!item.isActive) {
                throw new Error('奖惩项已禁用');
            }

            // 验证学生是否存在
            const StudentService = require('./studentService');
            const studentService = new StudentService(this.classId);
            const student = await studentService.getStudentById(studentId);
            if (!student) {
                throw new Error('学生不存在');
            }

            // 添加积分记录
            const PointsService = require('./pointsService');
            const pointsService = new PointsService(this.classId);
            
            const pointRecord = await pointsService.addPointRecord({
                studentId: studentId,
                points: item.points,
                reason: item.name,
                operatorId: teacherId,
                type: item.type === 'reward' ? 'add' : 'subtract'
            });

            console.log(`快速积分操作成功: ${student.name} ${item.type === 'reward' ? '获得' : '扣除'} ${Math.abs(item.points)} 分 (${item.name})`);
            
            return {
                success: true,
                student: student,
                item: item,
                pointRecord: pointRecord,
                message: `${item.type === 'reward' ? '奖励' : '惩罚'}操作成功`
            };
            
        } catch (error) {
            console.error('快速积分操作失败:', error);
            throw error;
        }
    }

    /**
     * 批量快速积分操作
     * @param {Array} operations - 操作列表 [{studentId, itemId, teacherId}]
     * @returns {Promise<{success: Array, failed: Array}>}
     */
    async batchApplyRewardPenaltyItems(operations) {
        const results = {
            success: [],
            failed: []
        };

        for (const operation of operations) {
            try {
                const result = await this.applyRewardPenaltyItem(
                    operation.studentId,
                    operation.itemId,
                    operation.teacherId
                );
                results.success.push(result);
            } catch (error) {
                results.failed.push({
                    operation: operation,
                    error: error.message
                });
            }
        }

        console.log(`批量快速积分操作完成: 成功 ${results.success.length}, 失败 ${results.failed.length}`);
        return results;
    }

    /**
     * 获取奖惩项统计信息
     * @returns {Promise<object>}
     */
    async getRewardPenaltyStatistics() {
        try {
            const allItems = await this.getAllRewardPenaltyItems(false);
            const activeItems = allItems.filter(item => item.isActive);
            
            const statistics = {
                total: allItems.length,
                active: activeItems.length,
                inactive: allItems.length - activeItems.length,
                rewards: activeItems.filter(item => item.type === 'reward').length,
                penalties: activeItems.filter(item => item.type === 'penalty').length,
                totalRewardPoints: activeItems
                    .filter(item => item.type === 'reward')
                    .reduce((sum, item) => sum + item.points, 0),
                totalPenaltyPoints: Math.abs(activeItems
                    .filter(item => item.type === 'penalty')
                    .reduce((sum, item) => sum + item.points, 0))
            };
            
            return statistics;
            
        } catch (error) {
            console.error('获取奖惩项统计失败:', error);
            throw error;
        }
    }

    /**
     * 创建默认奖惩项
     * @returns {Promise<RewardPenaltyItem[]>}
     */
    async createDefaultItems() {
        try {
            const defaultItems = [
                // 奖励项
                { name: '课堂表现优秀', points: 5, type: 'reward', sortOrder: 1 },
                { name: '作业完成优秀', points: 3, type: 'reward', sortOrder: 2 },
                { name: '帮助同学', points: 2, type: 'reward', sortOrder: 3 },
                { name: '积极回答问题', points: 2, type: 'reward', sortOrder: 4 },
                { name: '课堂纪律良好', points: 1, type: 'reward', sortOrder: 5 },
                
                // 惩罚项
                { name: '课堂违纪', points: -2, type: 'penalty', sortOrder: 6 },
                { name: '作业未完成', points: -3, type: 'penalty', sortOrder: 7 },
                { name: '迟到', points: -1, type: 'penalty', sortOrder: 8 },
                { name: '扰乱课堂秩序', points: -5, type: 'penalty', sortOrder: 9 }
            ];

            const createdItems = [];
            for (const itemData of defaultItems) {
                try {
                    const item = await this.createRewardPenaltyItem(itemData);
                    createdItems.push(item);
                } catch (error) {
                    console.warn(`创建默认奖惩项失败: ${itemData.name} - ${error.message}`);
                }
            }

            console.log(`创建默认奖惩项完成: 成功 ${createdItems.length} 个`);
            return createdItems;
            
        } catch (error) {
            console.error('创建默认奖惩项失败:', error);
            throw error;
        }
    }

    /**
     * 重新排序奖惩项
     * @param {Array} itemIds - 按新顺序排列的奖惩项ID数组
     * @returns {Promise<boolean>}
     */
    async reorderItems(itemIds) {
        try {
            const updatePromises = itemIds.map((itemId, index) => 
                this.updateRewardPenaltyItem(itemId, { sortOrder: index + 1 })
            );

            await Promise.all(updatePromises);
            
            console.log(`奖惩项重新排序成功: ${itemIds.length} 个项目`);
            return true;
            
        } catch (error) {
            console.error('奖惩项重新排序失败:', error);
            throw error;
        }
    }

    /**
     * 启用/禁用奖惩项
     * @param {string} itemId - 奖惩项ID
     * @param {boolean} isActive - 是否启用
     * @returns {Promise<RewardPenaltyItem>}
     */
    async toggleItemStatus(itemId, isActive) {
        try {
            const updatedItem = await this.updateRewardPenaltyItem(itemId, { isActive });
            
            console.log(`奖惩项状态更新成功: ${updatedItem.name} ${isActive ? '启用' : '禁用'}`);
            return updatedItem;
            
        } catch (error) {
            console.error('更新奖惩项状态失败:', error);
            throw error;
        }
    }
}

module.exports = RewardPenaltyService;