const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');
const { Teacher } = require('../models/dataModels');

/**
 * 教师服务类 - V1版本
 * 处理教师相关的业务逻辑
 * 简化权限逻辑，适配新的数据库存储接口
 */
class TeacherService {
    constructor(classId = 'default') {
        this.classId = classId; // 单班级ID，默认为'default'
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
     * 获取所有教师
     * @param {boolean} activeOnly - 是否只返回活跃的教师
     * @returns {Promise<Teacher[]>}
     */
    async getAllTeachers(activeOnly = true) {
        try {
            const adapter = await this.getAdapter();
            const filters = { role: 'teacher' };
            if (activeOnly) {
                filters.isActive = true;
            }
            
            const users = await adapter.getUsers(this.classId, filters);
            return users.map(user => new Teacher(user));
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
            const adapter = await this.getAdapter();
            const user = await adapter.getUserById(this.classId, teacherId);
            
            if (user && (user.role === 'teacher' || user.role === 'admin') && user.isActive) {
                return new Teacher(user);
            }
            
            return null;
        } catch (error) {
            console.error('获取教师失败:', error);
            throw new Error('获取教师失败');
        }
    }

    /**
     * 根据用户名获取教师
     * @param {string} username - 用户名
     * @returns {Promise<Teacher|null>}
     */
    async getTeacherByUsername(username) {
        try {
            const adapter = await this.getAdapter();
            const user = await adapter.getUserByUsername(this.classId, username);
            
            if (user && (user.role === 'teacher' || user.role === 'admin') && user.isActive) {
                return new Teacher(user);
            }
            
            return null;
        } catch (error) {
            console.error('获取教师失败:', error);
            throw new Error('获取教师失败');
        }
    }

    /**
     * 验证教师登录（简化版本，V1中使用用户名登录）
     * @param {string} username - 用户名
     * @param {string} password - 密码（V1版本中暂时简化为用户名验证）
     * @returns {Promise<Teacher|null>}
     */
    async validateTeacherLogin(username, password = null) {
        try {
            const teacher = await this.getTeacherByUsername(username);
            
            if (!teacher) {
                console.log(`教师登录验证失败: 用户名不存在 (${username})`);
                return null;
            }

            // V1版本简化密码验证，实际项目中应该有密码验证
            if (password && teacher.password && teacher.password !== password) {
                console.log(`教师登录验证失败: 密码错误 (${username})`);
                return null;
            }

            console.log(`教师登录验证成功: ${teacher.name} (${username})`);
            
            // 返回教师信息（不包含密码）
            return teacher.toSafeJSON ? new Teacher(teacher.toSafeJSON()) : teacher;
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
            const teacher = new Teacher(teacherData);
            
            // 验证教师数据
            const validation = teacher.validate();
            if (!validation.isValid) {
                throw new Error('教师数据验证失败: ' + validation.errors.join(', '));
            }

            const adapter = await this.getAdapter();
            
            // 准备用户数据
            const userData = {
                ...teacher.toJSON(),
                username: teacher.id, // 使用教师ID作为用户名
                role: teacher.role || 'teacher'
            };
            
            const createdUser = await adapter.createUser(this.classId, userData);
            
            console.log(`创建教师成功: ${createdUser.name} (ID: ${createdUser.id})`);
            
            // 返回教师信息（不包含密码）
            const teacherInfo = new Teacher(createdUser);
            return teacherInfo.toSafeJSON ? new Teacher(teacherInfo.toSafeJSON()) : teacherInfo;
            
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
            const adapter = await this.getAdapter();
            const updatedUser = await adapter.updateUser(this.classId, teacherId, updateData);
            
            console.log(`更新教师成功: ${updatedUser.name} (ID: ${teacherId})`);
            
            // 返回教师信息（不包含密码）
            const teacherInfo = new Teacher(updatedUser);
            return teacherInfo.toSafeJSON ? new Teacher(teacherInfo.toSafeJSON()) : teacherInfo;
            
        } catch (error) {
            console.error('更新教师失败:', error);
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
            const adapter = await this.getAdapter();
            
            // 软删除：设置为不活跃
            await adapter.updateUser(this.classId, teacherId, { isActive: false });
            
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
            const allTeachers = await this.getAllTeachers(false);
            const activeTeachers = await this.getAllTeachers(true);
            
            const statistics = {
                total: allTeachers.length,
                active: activeTeachers.length,
                inactive: allTeachers.length - activeTeachers.length,
                admins: activeTeachers.filter(t => t.role === 'admin').length,
                teachers: activeTeachers.filter(t => t.role === 'teacher').length
            };
            
            return statistics;
            
        } catch (error) {
            console.error('获取教师统计失败:', error);
            throw error;
        }
    }

    /**
     * 检查教师权限（简化版本）
     * @param {string} teacherId - 教师ID
     * @param {string} permission - 权限类型
     * @returns {Promise<boolean>}
     */
    async checkPermission(teacherId, permission) {
        try {
            const teacher = await this.getTeacherById(teacherId);
            if (!teacher) {
                return false;
            }

            // V1版本简化权限逻辑
            switch (permission) {
                case 'manage_students':
                case 'manage_products':
                case 'manage_orders':
                case 'reset_points':
                case 'manage_reward_penalty':
                    return teacher.role === 'admin'; // 只有班主任可以管理
                case 'add_points':
                case 'subtract_points':
                    return true; // 所有教师都可以操作积分
                default:
                    return false;
            }
        } catch (error) {
            console.error('检查教师权限失败:', error);
            return false;
        }
    }
}

module.exports = TeacherService;