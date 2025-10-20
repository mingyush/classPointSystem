const { storageAdapterFactory } = require('../adapters/storageAdapterFactory');
const { StudentInfo } = require('../models/dataModels');

/**
 * 学生数据服务层 - V1版本
 * 提供学生信息的CRUD操作和业务逻辑
 * 适配新的数据库存储接口，简化单班级逻辑
 */
class StudentService {
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
     * 获取所有学生信息
     * @param {object} filters - 过滤条件
     * @returns {Promise<StudentInfo[]>}
     */
    async getAllStudents(filters = {}) {
        try {
            const adapter = await this.getAdapter();
            const students = await adapter.getStudents(this.classId, filters);
            return students.map(student => new StudentInfo(student));
        } catch (error) {
            console.error('获取学生列表失败:', error);
            throw new Error('获取学生列表失败');
        }
    }

    /**
     * 根据学号获取学生信息
     * @param {string} studentId - 学号
     * @returns {Promise<StudentInfo|null>}
     */
    async getStudentById(studentId) {
        try {
            if (!studentId || typeof studentId !== 'string') {
                throw new Error('学号不能为空且必须为字符串');
            }

            const adapter = await this.getAdapter();
            const student = await adapter.getStudentById(this.classId, studentId);
            
            return student ? new StudentInfo(student) : null;
        } catch (error) {
            console.error(`获取学生信息失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 根据学号获取学生信息
     * @param {string} studentNumber - 学号
     * @returns {Promise<StudentInfo|null>}
     */
    async getStudentByNumber(studentNumber) {
        try {
            if (!studentNumber || typeof studentNumber !== 'string') {
                throw new Error('学号不能为空且必须为字符串');
            }

            const adapter = await this.getAdapter();
            const student = await adapter.getStudentByNumber(this.classId, studentNumber);
            
            return student ? new StudentInfo(student) : null;
        } catch (error) {
            console.error(`获取学生信息失败 (${studentNumber}):`, error);
            throw error;
        }
    }

    /**
     * 创建新学生
     * @param {object} studentData - 学生数据
     * @returns {Promise<StudentInfo>}
     */
    async createStudent(studentData) {
        try {
            const student = new StudentInfo(studentData);
            const validation = student.validate();
            
            if (!validation.isValid) {
                throw new Error('学生数据验证失败: ' + validation.errors.join(', '));
            }

            const adapter = await this.getAdapter();
            const createdStudent = await adapter.createStudent(this.classId, student.toJSON());
            
            console.log(`创建学生成功: ${createdStudent.name} (${createdStudent.id})`);
            return new StudentInfo(createdStudent);
        } catch (error) {
            console.error('创建学生失败:', error);
            throw error;
        }
    }

    /**
     * 更新学生信息
     * @param {string} studentId - 学号
     * @param {object} updateData - 更新数据
     * @returns {Promise<StudentInfo>}
     */
    async updateStudent(studentId, updateData) {
        try {
            if (!studentId || typeof studentId !== 'string') {
                throw new Error('学号不能为空且必须为字符串');
            }

            const adapter = await this.getAdapter();
            const updatedStudent = await adapter.updateStudent(this.classId, studentId, updateData);
            
            console.log(`更新学生成功: ${updatedStudent.name} (${updatedStudent.id})`);
            return new StudentInfo(updatedStudent);
        } catch (error) {
            console.error(`更新学生失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 删除学生
     * @param {string} studentId - 学号
     * @returns {Promise<boolean>}
     */
    async deleteStudent(studentId) {
        try {
            if (!studentId || typeof studentId !== 'string') {
                throw new Error('学号不能为空且必须为字符串');
            }

            const adapter = await this.getAdapter();
            const result = await adapter.deleteStudent(this.classId, studentId);
            
            if (result) {
                console.log(`删除学生成功: ${studentId}`);
            }
            return result;
        } catch (error) {
            console.error(`删除学生失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 更新学生积分余额（通过积分记录计算，不直接修改余额）
     * @param {string} studentId - 学号
     * @param {number} newBalance - 新的积分余额
     * @returns {Promise<StudentInfo>}
     */
    async updateStudentBalance(studentId, newBalance) {
        try {
            if (typeof newBalance !== 'number') {
                throw new Error('积分余额必须为数字');
            }

            // V1版本中，积分余额通过积分记录计算，这里只是为了兼容性
            // 实际的积分变更应该通过PointsService来处理
            console.warn('updateStudentBalance方法在V1版本中已废弃，请使用PointsService');
            return await this.updateStudent(studentId, { balance: newBalance });
        } catch (error) {
            console.error(`更新学生积分失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 搜索学生（按姓名或学号）
     * @param {string} keyword - 搜索关键词
     * @returns {Promise<StudentInfo[]>}
     */
    async searchStudents(keyword) {
        try {
            if (!keyword || typeof keyword !== 'string') {
                throw new Error('搜索关键词不能为空且必须为字符串');
            }

            const students = await this.getAllStudents({ search: keyword });
            return students;
        } catch (error) {
            console.error(`搜索学生失败 (${keyword}):`, error);
            throw error;
        }
    }

    /**
     * 验证学生登录（仅验证学号是否存在）
     * @param {string} studentNumber - 学号
     * @returns {Promise<StudentInfo|null>}
     */
    async validateStudentLogin(studentNumber) {
        try {
            const student = await this.getStudentByNumber(studentNumber);
            if (student) {
                console.log(`学生登录验证成功: ${student.name} (${studentNumber})`);
                return student;
            } else {
                console.log(`学生登录验证失败: 学号不存在 (${studentNumber})`);
                return null;
            }
        } catch (error) {
            console.error(`学生登录验证失败 (${studentNumber}):`, error);
            throw error;
        }
    }

    /**
     * 获取学生统计信息
     * @returns {Promise<object>}
     */
    async getStudentStatistics() {
        try {
            const adapter = await this.getAdapter();
            const classStats = await adapter.getClassStatistics(this.classId);
            
            return {
                totalStudents: classStats.totalStudents,
                activeStudents: classStats.totalStudents, // V1版本中所有学生都是活跃的
                totalPointRecords: classStats.totalPointRecords,
                averagePoints: classStats.averagePoints
            };
        } catch (error) {
            console.error('获取学生统计信息失败:', error);
            throw error;
        }
    }

    /**
     * 批量创建学生
     * @param {object[]} studentsData - 学生数据数组
     * @returns {Promise<{success: StudentInfo[], failed: object[]}>}
     */
    async batchCreateStudents(studentsData) {
        const results = {
            success: [],
            failed: []
        };

        for (const studentData of studentsData) {
            try {
                const student = await this.createStudent(studentData);
                results.success.push(student);
            } catch (error) {
                results.failed.push({
                    data: studentData,
                    error: error.message
                });
            }
        }

        console.log(`批量创建学生完成: 成功 ${results.success.length}, 失败 ${results.failed.length}`);
        return results;
    }
}

module.exports = StudentService;