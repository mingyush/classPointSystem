/**
 * 问题反馈模型
 * 用于收集用户反馈和问题报告
 */

/**
 * 问题反馈信息模型
 */
class Feedback {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.title = data.title || '';
        this.content = data.content || '';
        this.category = data.category || 'general'; // 'bug', 'feature', 'suggestion', 'question', 'general'
        this.priority = data.priority || 'medium'; // 'low', 'medium', 'high', 'urgent'
        this.status = data.status || 'open'; // 'open', 'in-progress', 'resolved', 'closed'
        this.submitterType = data.submitterType || 'student'; // 'student', 'teacher', 'admin'
        this.submitterId = data.submitterId || null;
        this.submitterName = data.submitterName || '匿名用户';
        this.contactInfo = data.contactInfo || ''; // email or phone
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.isPublic = data.isPublic !== undefined ? data.isPublic : false; // whether feedback is visible to other users
        this.tags = data.tags || []; // array of tags for categorization
    }

    /**
     * 生成唯一ID
     * @returns {string}
     */
    generateId() {
        return 'feedback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 验证反馈信息数据
     * @returns {object} 验证结果
     */
    validate() {
        const errors = [];
        const validCategories = ['bug', 'feature', 'suggestion', 'question', 'general'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
        const validSubmitterTypes = ['student', 'teacher', 'admin'];

        if (!this.title || typeof this.title !== 'string' || this.title.trim().length === 0) {
            errors.push('反馈标题不能为空');
        } else if (this.title.length > 200) {
            errors.push('反馈标题长度不能超过200字符');
        }

        if (!this.content || typeof this.content !== 'string' || this.content.trim().length === 0) {
            errors.push('反馈内容不能为空');
        } else if (this.content.length > 5000) {
            errors.push('反馈内容长度不能超过5000字符');
        }

        if (!validCategories.includes(this.category)) {
            errors.push('反馈类别必须为: ' + validCategories.join(', '));
        }

        if (!validPriorities.includes(this.priority)) {
            errors.push('优先级必须为: ' + validPriorities.join(', '));
        }

        if (!validStatuses.includes(this.status)) {
            errors.push('状态必须为: ' + validStatuses.join(', '));
        }

        if (!validSubmitterTypes.includes(this.submitterType)) {
            errors.push('提交者类型必须为: ' + validSubmitterTypes.join(', '));
        }

        if (typeof this.isPublic !== 'boolean') {
            errors.push('公开状态必须为布尔值');
        }

        if (typeof this.tags !== 'object' || !Array.isArray(this.tags)) {
            errors.push('标签必须为数组');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 转换为JSON对象
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            content: this.content,
            category: this.category,
            priority: this.priority,
            status: this.status,
            submitterType: this.submitterType,
            submitterId: this.submitterId,
            submitterName: this.submitterName,
            contactInfo: this.contactInfo,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            isPublic: this.isPublic,
            tags: this.tags
        };
    }

    /**
     * 转换为安全的JSON对象（不包含敏感信息）
     * @returns {object}
     */
    toSafeJSON() {
        const data = this.toJSON();
        // 保留所有字段，但可以根据需要移除敏感信息
        return data;
    }
}

module.exports = {
    Feedback
};