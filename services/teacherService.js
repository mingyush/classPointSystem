const DataAccess = require('../utils/dataAccess');
const { Teacher } = require('../models/dataModels');

/**
 * 教师服务类
 * 处理教师相关的业务逻辑
 */
class TeacherService {
    constructor() {
        this.dataAccess = new DataAccess();
        this.adminId = process.env.ADMIN_USERNAME || 'admin';
        this.adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    }

    /**
     * 确保数据访问层初始化
     */
    async _ensureInit() {
        await this.dataAccess.ensureDirectories();
    }

    /**
     * 获取所有教师
     * @param {boolean} activeOnly - 是否只返回活跃的教师
     * @returns {Promise<Teacher[]>}
     */
    async getAllTeachers(activeOnly = true) {
        try {
            await this._ensureInit();
            const teachers = await this.dataAccess.getAllTeachers();

            if (activeOnly) {
                return teachers.filter(t => t.isActive && t.id !== this.adminId).map(t => new Teacher(t));
            }

            return teachers.filter(t => t.id !== this.adminId).map(teacherData => new Teacher(teacherData));
        } catch (error) {
            console.error('获取教师列表失败:', error);
            throw new Error('获取教师列表失败');
        }
    }

    /**
     * 根据ID获取教师
     * @param {string} teacherId - 教师ID
     * @returns {Promise<Teacher|null>}
     */
    async getTeacherById(teacherId) {
        try {
            if (teacherId === this.adminId) {
                return new Teacher({
                    id: this.adminId,
                    name: '超级管理员',
                    password: this.adminPassword,
                    role: 'admin',
                    department: '系统管理',
                    isActive: true,
                    createdAt: new Date().toISOString()
                });
            }

            await this._ensureInit();
            const teacher = await this.dataAccess.getTeacherById(teacherId);

            if (!teacher || !teacher.isActive) {
                return null;
            }

            return new Teacher(teacher);
        } catch (error) {
            console.error('获取教师失败:', error);
            throw new Error('获取教师失败');
        }
    }

    /**
     * 验证教师登录
     * @param {string} teacherId - 教师ID
     * @param {string} password - 密码
     * @returns {Promise<Teacher|null>}
     */
    async validateTeacherLogin(teacherId, password) {
        try {
            const teacher = await this.getTeacherById(teacherId);

            if (!teacher) {
                return null;
            }

            // 验证密码
            if (teacher.password !== password) {
                return null;
            }

            // 返回教师信息（不包含密码）
            const teacherInfo = teacher.toJSON();
            delete teacherInfo.password;

            return new Teacher(teacherInfo);
        } catch (error) {
            console.error('验证教师登录失败:', error);
            throw new Error('验证教师登录失败');
        }
    }

    /**
     * 创建新教师
     * @param {object} teacherData - 教师数据
     * @returns {Promise<Teacher>}
     */
    async createTeacher(teacherData) {
        try {
            await this._ensureInit();
            const teacher = new Teacher(teacherData);

            // 验证教师数据
            const validation = teacher.validate();
            if (!validation.isValid) {
                throw new Error('教师数据验证失败: ' + validation.errors.join(', '));
            }

            // 检查教师ID是否已存在或是否为内置admin
            if (teacher.id === this.adminId) {
                throw new Error('不能使用系统预留的管理员ID');
            }
            if (teacher.role === 'admin') {
                throw new Error('不能创建额外的超级管理员');
            }

            const existingTeacher = await this.dataAccess.getTeacherById(teacher.id);
            if (existingTeacher && existingTeacher.isActive) {
                throw new Error('教师ID已存在');
            }

            const created = await this.dataAccess.createTeacher(teacher.toJSON());

            console.log(`创建教师成功: ${teacher.name} (ID: ${teacher.id})`);

            // 返回教师信息（不包含密码）
            const teacherInfo = created;
            delete teacherInfo.password;

            return new Teacher(teacherInfo);
        } catch (error) {
            console.error('创建教师失败:', error);
            throw error;
        }
    }

    /**
     * 更新教师信息
     * @param {string} teacherId - 教师ID
     * @param {object} updateData - 更新数据
     * @returns {Promise<Teacher>}
     */
    async updateTeacher(teacherId, updateData) {
        try {
            if (teacherId === this.adminId) {
                throw new Error('内置系统管理员信息不可修改');
            }

            await this._ensureInit();

            const existingTeacher = await this.dataAccess.getTeacherById(teacherId);
            if (!existingTeacher) {
                throw new Error('教师不存在');
            }

            // 合并更新数据
            const updatedTeacherData = { ...existingTeacher, ...updateData };
            const updatedTeacher = new Teacher(updatedTeacherData);

            // 验证更新后的教师数据
            const validation = updatedTeacher.validate();
            if (!validation.isValid) {
                throw new Error('教师数据验证失败: ' + validation.errors.join(', '));
            }

            const updated = await this.dataAccess.updateTeacher(teacherId, updateData);

            console.log(`更新教师成功: ${updatedTeacher.name} (ID: ${teacherId})`);

            // 返回教师信息（不包含密码）
            const teacherInfo = updated;
            delete teacherInfo.password;

            return new Teacher(teacherInfo);
        } catch (error) {
            console.error('更新教师失败:', error);
            throw error;
        }
    }

    /**
     * 自助修改密码
     * @param {string} teacherId - 当前登录的教师ID
     * @param {string} oldPassword - 旧密码
     * @param {string} newPassword - 新密码
     * @returns {Promise<boolean>}
     */
    async changePassword(teacherId, oldPassword, newPassword) {
        try {
            if (teacherId === this.adminId) {
                throw new Error('系统内置管理员密码请在服务器端（环境变量或配置）修改，不支持通过页面修改。');
            }
            
            await this._ensureInit();
            
            if (!newPassword || newPassword.length < 3) {
                throw new Error('新密码长度至少需要3位');
            }

            const teacher = await this.dataAccess.getTeacherById(teacherId);
            if (!teacher || !teacher.isActive) {
                throw new Error('教师不存在或已停用');
            }

            if (teacher.password !== oldPassword) {
                throw new Error('原密码错误');
            }

            await this.dataAccess.updateTeacher(teacherId, { password: newPassword });
            console.log(`教师 ${teacherId} 自助重置密码成功`);
            return true;
        } catch (error) {
            console.error(`教师 ${teacherId} 修改密码失败:`, error.message);
            throw error;
        }
    }

    /**
     * 强行重置密码 (针对管理员或班主任直接操作普通账号)
     * @param {string} teacherId - 目标教师ID
     * @param {string} newPassword - 新密码
     * @returns {Promise<boolean>}
     */
    async resetPassword(teacherId, newPassword) {
        try {
            if (teacherId === this.adminId) {
                throw new Error('无法通过系统重置内置管理员的密码');
            }
            
            await this._ensureInit();
            
            if (!newPassword || newPassword.length < 3) {
                throw new Error('新密码长度至少需要3位');
            }

            const teacher = await this.dataAccess.getTeacherById(teacherId);
            if (!teacher) {
                throw new Error('目标教师不存在');
            }

            // 保护管理员账号不被直接通过API强行重置，除非是通过 changePassword 验证旧密码
            if (teacher.role === 'admin') {
                throw new Error('无法强制重置最高管理员的密码');
            }

            await this.dataAccess.updateTeacher(teacherId, { password: newPassword });
            console.log(`教师 ${teacherId} 密码已被管理员/班主任强制重置`);
            return true;
        } catch (error) {
            console.error(`重置教师 ${teacherId} 密码失败:`, error.message);
            throw error;
        }
    }

    /**
     * 删除教师（软删除）
     * @param {string} teacherId - 教师ID
     * @returns {Promise<boolean>}
     */
    async deleteTeacher(teacherId) {
        try {
            if (teacherId === this.adminId) {
                throw new Error('内置系统管理员不可删除');
            }

            await this._ensureInit();

            const existingTeacher = await this.dataAccess.getTeacherById(teacherId);
            if (!existingTeacher) {
                throw new Error('教师不存在');
            }

            await this.dataAccess.deleteTeacher(teacherId);

            console.log(`删除教师成功: ID ${teacherId}`);
            return true;
        } catch (error) {
            console.error('删除教师失败:', error);
            throw error;
        }
    }

    /**
     * 获取教师统计信息
     * @returns {Promise<object>}
     */
    async getTeacherStatistics() {
        try {
            const teachers = await this.getAllTeachers(false);

            const statistics = {
                total: teachers.length,
                active: teachers.filter(t => t.isActive).length,
                inactive: teachers.filter(t => !t.isActive).length,
                byDepartment: {}
            };

            // 按部门统计
            teachers.forEach(teacher => {
                if (teacher.isActive && teacher.department) {
                    statistics.byDepartment[teacher.department] =
                        (statistics.byDepartment[teacher.department] || 0) + 1;
                }
            });

            return statistics;
        } catch (error) {
            console.error('获取教师统计失败:', error);
            throw error;
        }
    }
}

module.exports = TeacherService;
