const DataAccess = require('../utils/dataAccess');
const { Teacher } = require('../models/dataModels');

/**
 * 教师服务类
 * 处理教师相关的业务逻辑
 */
class TeacherService {
    constructor() {
        this.dataAccess = new DataAccess();
        this.filename = 'teachers.json';
        this.defaultData = { teachers: [] };
    }

    /**
     * 获取所有教师
     * @param {boolean} activeOnly - 是否只返回活跃的教师
     * @returns {Promise<Teacher[]>}
     */
    async getAllTeachers(activeOnly = true) {
        try {
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            let teachers = data.teachers.map(teacherData => new Teacher(teacherData));
            
            if (activeOnly) {
                teachers = teachers.filter(teacher => teacher.isActive);
            }
            
            return teachers;
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
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const teacherData = data.teachers.find(t => t.id === teacherId && t.isActive);
            
            return teacherData ? new Teacher(teacherData) : null;
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
            const teacher = new Teacher(teacherData);
            
            // 验证教师数据
            const validation = teacher.validate();
            if (!validation.isValid) {
                throw new Error('教师数据验证失败: ' + validation.errors.join(', '));
            }

            // 检查教师ID是否已存在
            const existingTeacher = await this.getTeacherById(teacher.id);
            if (existingTeacher) {
                throw new Error('教师ID已存在');
            }

            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            
            // 添加新教师
            data.teachers.push(teacher.toJSON());
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`创建教师成功: ${teacher.name} (ID: ${teacher.id})`);
            
            // 返回教师信息（不包含密码）
            const teacherInfo = teacher.toJSON();
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
            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const teacherIndex = data.teachers.findIndex(t => t.id === teacherId);
            
            if (teacherIndex === -1) {
                throw new Error('教师不存在');
            }

            // 合并更新数据
            const existingTeacher = data.teachers[teacherIndex];
            const updatedTeacherData = { ...existingTeacher, ...updateData };
            const updatedTeacher = new Teacher(updatedTeacherData);
            
            // 验证更新后的教师数据
            const validation = updatedTeacher.validate();
            if (!validation.isValid) {
                throw new Error('教师数据验证失败: ' + validation.errors.join(', '));
            }

            // 更新教师数据
            data.teachers[teacherIndex] = updatedTeacher.toJSON();
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`更新教师成功: ${updatedTeacher.name} (ID: ${teacherId})`);
            
            // 返回教师信息（不包含密码）
            const teacherInfo = updatedTeacher.toJSON();
            delete teacherInfo.password;
            
            return new Teacher(teacherInfo);
            
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
            // 读取现有数据
            const data = await this.dataAccess.readFile(this.filename, this.defaultData);
            const teacherIndex = data.teachers.findIndex(t => t.id === teacherId);
            
            if (teacherIndex === -1) {
                throw new Error('教师不存在');
            }

            // 软删除：设置为不活跃
            data.teachers[teacherIndex].isActive = false;
            
            // 保存数据
            await this.dataAccess.writeFile(this.filename, data);
            
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