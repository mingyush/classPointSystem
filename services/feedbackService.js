/**
 * 反馈服务模块
 * 处理用户反馈的增删改查和管理功能
 */

const DataAccess = require('../utils/dataAccess');
const { Feedback } = require('../models/feedbackModel');

class FeedbackService {
    constructor() {
        this.dataAccess = new DataAccess(); // 使用默认的 'data' 目录
        this.key = 'feedback'; // 使用 'feedback' 作为数据键
    }

    /**
     * 创建新的反馈
     * @param {Object} feedbackData - 反馈数据
     * @returns {Promise<Feedback>} 创建的反馈对象
     */
    async createFeedback(feedbackData) {
        try {
            // 创建反馈对象
            const feedback = new Feedback({
                ...feedbackData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // 验证数据
            const validation = feedback.validate();
            if (!validation.isValid) {
                throw new Error('反馈数据验证失败: ' + validation.errors.join(', '));
            }

            // 保存到数据文件
            await this.dataAccess.save(feedback.id, feedback.toJSON(), this.key);

            console.log(`反馈创建成功: ${feedback.id}`);
            return feedback;
        } catch (error) {
            console.error('创建反馈失败:', error);
            throw error;
        }
    }

    /**
     * 获取反馈列表
     * @param {Object} filters - 过滤条件
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<Array<Feedback>>} 反馈列表
     */
    async getFeedbackList(filters = {}, page = 1, limit = 20) {
        try {
            let feedbacks = await this.dataAccess.loadAll(this.key);

            // 应用过滤条件
            if (filters.category) {
                feedbacks = feedbacks.filter(fb => fb.category === filters.category);
            }
            if (filters.status) {
                feedbacks = feedbacks.filter(fb => fb.status === filters.status);
            }
            if (filters.priority) {
                feedbacks = feedbacks.filter(fb => fb.priority === filters.priority);
            }
            if (filters.submitterType) {
                feedbacks = feedbacks.filter(fb => fb.submitterType === filters.submitterType);
            }
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                feedbacks = feedbacks.filter(fb => 
                    fb.title.toLowerCase().includes(searchTerm) || 
                    fb.content.toLowerCase().includes(searchTerm)
                );
            }

            // 排序：按创建时间倒序
            feedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            // 分页
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedFeedbacks = feedbacks.slice(startIndex, endIndex);

            return paginatedFeedbacks.map(fb => new Feedback(fb));
        } catch (error) {
            console.error('获取反馈列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取反馈总数
     * @param {Object} filters - 过滤条件
     * @returns {Promise<number>} 反馈总数
     */
    async getFeedbackCount(filters = {}) {
        try {
            let feedbacks = await this.dataAccess.loadAll(this.key);

            // 应用过滤条件
            if (filters.category) {
                feedbacks = feedbacks.filter(fb => fb.category === filters.category);
            }
            if (filters.status) {
                feedbacks = feedbacks.filter(fb => fb.status === filters.status);
            }
            if (filters.priority) {
                feedbacks = feedbacks.filter(fb => fb.priority === filters.priority);
            }
            if (filters.submitterType) {
                feedbacks = feedbacks.filter(fb => fb.submitterType === filters.submitterType);
            }
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                feedbacks = feedbacks.filter(fb => 
                    fb.title.toLowerCase().includes(searchTerm) || 
                    fb.content.toLowerCase().includes(searchTerm)
                );
            }

            return feedbacks.length;
        } catch (error) {
            console.error('获取反馈总数失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取反馈
     * @param {string} id - 反馈ID
     * @returns {Promise<Feedback|null>} 反馈对象或null
     */
    async getFeedbackById(id) {
        try {
            const feedbackData = await this.dataAccess.load(id);
            return feedbackData ? new Feedback(feedbackData) : null;
        } catch (error) {
            console.error(`获取反馈失败 (ID: ${id}):`, error);
            throw error;
        }
    }

    /**
     * 更新反馈
     * @param {string} id - 反馈ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise<Feedback>} 更新后的反馈对象
     */
    async updateFeedback(id, updateData) {
        try {
            const existingFeedback = await this.getFeedbackById(id);
            if (!existingFeedback) {
                throw new Error('反馈不存在');
            }

            // 创建更新后的反馈对象
            const updatedFeedback = new Feedback({
                ...existingFeedback.toJSON(),
                ...updateData,
                id: existingFeedback.id, // 确保ID不变
                updatedAt: new Date().toISOString()
            });

            // 验证数据
            const validation = updatedFeedback.validate();
            if (!validation.isValid) {
                throw new Error('反馈数据验证失败: ' + validation.errors.join(', '));
            }

            // 保存到数据文件
            await this.dataAccess.save(updatedFeedback.id, updatedFeedback.toJSON());

            console.log(`反馈更新成功: ${updatedFeedback.id}`);
            return updatedFeedback;
        } catch (error) {
            console.error(`更新反馈失败 (ID: ${id}):`, error);
            throw error;
        }
    }

    /**
     * 删除反馈
     * @param {string} id - 反馈ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteFeedback(id) {
        try {
            const feedback = await this.getFeedbackById(id);
            if (!feedback) {
                return false;
            }

            await this.dataAccess.remove(id);
            console.log(`反馈删除成功: ${id}`);
            return true;
        } catch (error) {
            console.error(`删除反馈失败 (ID: ${id}):`, error);
            throw error;
        }
    }

    /**
     * 获取反馈统计信息
     * @returns {Promise<Object>} 统计信息
     */
    async getFeedbackStats() {
        try {
            const allFeedbacks = await this.dataAccess.loadAll();
            
            if (allFeedbacks.length === 0) {
                return {
                    total: 0,
                    byCategory: {},
                    byStatus: {},
                    byPriority: {}
                };
            }

            // 按类别统计
            const byCategory = {};
            allFeedbacks.forEach(fb => {
                byCategory[fb.category] = (byCategory[fb.category] || 0) + 1;
            });

            // 按状态统计
            const byStatus = {};
            allFeedbacks.forEach(fb => {
                byStatus[fb.status] = (byStatus[fb.status] || 0) + 1;
            });

            // 按优先级统计
            const byPriority = {};
            allFeedbacks.forEach(fb => {
                byPriority[fb.priority] = (byPriority[fb.priority] || 0) + 1;
            });

            return {
                total: allFeedbacks.length,
                byCategory,
                byStatus,
                byPriority
            };
        } catch (error) {
            console.error('获取反馈统计信息失败:', error);
            throw error;
        }
    }
}

module.exports = FeedbackService;