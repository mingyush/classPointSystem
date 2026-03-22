/**
 * 班级互动模型
 * 统一承载：老师下发（通知/任务）与班级代表上报
 */
class ClassInteraction {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.type = data.type || 'notice'; // notice | task | report
        this.status = data.status || 'pending'; // pending | confirmed | approved | rejected | closed
        this.title = data.title || '';
        this.content = data.content || '';
        this.createdByRole = data.createdByRole || 'teacher'; // teacher | class
        this.createdById = data.createdById || '';
        this.createdByName = data.createdByName || '';

        this.classActionBy = data.classActionBy || null;
        this.classActionAt = data.classActionAt || null;
        this.classActionNote = data.classActionNote || null;

        this.teacherActionBy = data.teacherActionBy || null;
        this.teacherActionAt = data.teacherActionAt || null;
        this.teacherActionNote = data.teacherActionNote || null;

        this.deadlineAt = data.deadlineAt || null;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    generateId() {
        return `interaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    validate() {
        const errors = [];
        const validTypes = ['notice', 'task', 'report'];
        const validStatuses = ['pending', 'confirmed', 'approved', 'rejected', 'closed'];
        const validRoles = ['teacher', 'class'];

        if (!validTypes.includes(this.type)) {
            errors.push('互动类型必须为 notice/task/report');
        }
        if (!validStatuses.includes(this.status)) {
            errors.push('互动状态无效');
        }
        if (!this.title || typeof this.title !== 'string' || this.title.trim().length === 0) {
            errors.push('标题不能为空');
        }
        if (!this.content || typeof this.content !== 'string' || this.content.trim().length === 0) {
            errors.push('内容不能为空');
        }
        if (!validRoles.includes(this.createdByRole)) {
            errors.push('创建者角色必须为 teacher/class');
        }
        if (!this.createdById || typeof this.createdById !== 'string') {
            errors.push('创建者ID不能为空');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            status: this.status,
            title: this.title,
            content: this.content,
            createdByRole: this.createdByRole,
            createdById: this.createdById,
            createdByName: this.createdByName,
            classActionBy: this.classActionBy,
            classActionAt: this.classActionAt,
            classActionNote: this.classActionNote,
            teacherActionBy: this.teacherActionBy,
            teacherActionAt: this.teacherActionAt,
            teacherActionNote: this.teacherActionNote,
            deadlineAt: this.deadlineAt,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
}

module.exports = {
    ClassInteraction
};
