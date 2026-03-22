const DataAccess = require('../utils/dataAccess');
const { ClassInteraction } = require('../models/interactionModel');

/**
 * 班级互动服务
 * 负责状态流转与业务校验，避免把规则散落在路由层。
 */
class InteractionService {
    constructor() {
        this.dataAccess = new DataAccess();
    }

    async _ensureInit() {
        await this.dataAccess.ensureDirectories();
    }

    async getSystemMode() {
        await this._ensureInit();
        return await this.dataAccess.getConfig('mode', 'normal');
    }

    async publishByTeacher(payload) {
        await this._ensureInit();

        const type = payload.type;
        if (!['notice', 'task'].includes(type)) {
            throw new Error('老师下发类型仅支持 notice 或 task');
        }

        if (payload.deadlineAt) {
            const deadline = new Date(payload.deadlineAt);
            if (Number.isNaN(deadline.getTime())) {
                throw new Error('截止时间格式无效');
            }
        }

        const interaction = new ClassInteraction({
            type,
            status: 'pending',
            title: (payload.title || '').trim(),
            content: (payload.content || '').trim(),
            createdByRole: 'teacher',
            createdById: payload.teacherId,
            createdByName: payload.teacherName || '',
            deadlineAt: payload.deadlineAt || null
        });

        const validation = interaction.validate();
        if (!validation.isValid) {
            throw new Error(`数据校验失败: ${validation.errors.join(', ')}`);
        }

        return await this.dataAccess.createClassInteraction(interaction.toJSON());
    }

    async submitReportByClass(payload) {
        await this._ensureInit();

        const studentId = (payload.studentId || '').trim();
        if (!studentId) {
            throw new Error('学号不能为空');
        }

        const student = await this.dataAccess.getStudentById(studentId);
        if (!student) {
            throw new Error('学号不存在');
        }

        const interaction = new ClassInteraction({
            type: 'report',
            status: 'pending',
            title: (payload.title || '班级上报').trim(),
            content: (payload.content || '').trim(),
            createdByRole: 'class',
            createdById: student.id,
            createdByName: student.name
        });

        const validation = interaction.validate();
        if (!validation.isValid) {
            throw new Error(`数据校验失败: ${validation.errors.join(', ')}`);
        }

        return await this.dataAccess.createClassInteraction(interaction.toJSON());
    }

    async classConfirm(interactionId, payload) {
        await this._ensureInit();

        const interaction = await this.dataAccess.getClassInteractionById(interactionId);
        if (!interaction) {
            throw new Error('互动记录不存在');
        }
        if (!['notice', 'task'].includes(interaction.type)) {
            throw new Error('仅通知/任务支持班级确认');
        }
        if (interaction.status === 'closed') {
            throw new Error('该互动已关闭，无法确认');
        }
        if (interaction.status === 'confirmed') {
            // 幂等：避免大屏重复点击导致报错。
            return interaction;
        }
        if (interaction.status !== 'pending') {
            throw new Error('当前状态不允许确认');
        }

        const studentId = (payload.studentId || '').trim();
        if (!studentId) {
            throw new Error('学号不能为空');
        }

        const student = await this.dataAccess.getStudentById(studentId);
        if (!student) {
            throw new Error('学号不存在');
        }

        return await this.dataAccess.updateClassInteraction(interactionId, {
            status: 'confirmed',
            classActionBy: student.id,
            classActionAt: new Date().toISOString(),
            classActionNote: payload.note ? String(payload.note).trim() : null
        });
    }

    async teacherReviewReport(interactionId, payload) {
        await this._ensureInit();

        const interaction = await this.dataAccess.getClassInteractionById(interactionId);
        if (!interaction) {
            throw new Error('互动记录不存在');
        }
        if (interaction.type !== 'report') {
            throw new Error('仅上报记录可进行老师审核');
        }

        const status = payload.status;
        if (!['approved', 'rejected'].includes(status)) {
            throw new Error('审核状态必须为 approved 或 rejected');
        }

        return await this.dataAccess.updateClassInteraction(interactionId, {
            status,
            teacherActionBy: payload.teacherId,
            teacherActionAt: new Date().toISOString(),
            teacherActionNote: payload.note ? String(payload.note).trim() : null
        });
    }

    async closeTeacherInteraction(interactionId, payload) {
        await this._ensureInit();

        const interaction = await this.dataAccess.getClassInteractionById(interactionId);
        if (!interaction) {
            throw new Error('互动记录不存在');
        }
        if (!['notice', 'task'].includes(interaction.type)) {
            throw new Error('仅通知/任务支持关闭');
        }
        if (interaction.status === 'closed') {
            return interaction;
        }

        return await this.dataAccess.updateClassInteraction(interactionId, {
            status: 'closed',
            teacherActionBy: payload.teacherId,
            teacherActionAt: new Date().toISOString(),
            teacherActionNote: payload.note ? String(payload.note).trim() : null
        });
    }

    async getUnconfirmed(limit = 30) {
        await this._ensureInit();
        const items = await this.dataAccess.getClassInteractions(
            { status: 'pending' },
            1,
            Math.min(100, Math.max(1, parseInt(limit, 10) || 30))
        );

        return items.filter(item => item.type === 'notice' || item.type === 'task');
    }

    async queryHistory(filters = {}, page = 1, pageSize = 20) {
        await this._ensureInit();
        const list = await this.dataAccess.getClassInteractions(filters, page, pageSize);
        const total = await this.dataAccess.countClassInteractions(filters);
        return {
            list,
            page: Math.max(1, parseInt(page, 10) || 1),
            pageSize: Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20)),
            total
        };
    }
}

module.exports = InteractionService;
