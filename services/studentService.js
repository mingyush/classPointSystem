const DataAccess = require('../utils/dataAccess');
const { StudentInfo } = require('../models/dataModels');

/**
 * 学生数据服务层
 * 提供学生信息的CRUD操作和业务逻辑
 */
class StudentService {
    constructor() {
        this.dataAccess = new DataAccess();
        this.filename = 'students.json';
    }

    /**
     * 获取所有学生信息
     * @returns {Promise<StudentInfo[]>}
     */
    async getAllStudents() {
        try {
            const data = await this.dataAccess.readFile(this.filename, { students: [] });
            return data.students.map(student => new StudentInfo(student));
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

            const students = await this.getAllStudents();
            const student = students.find(s => s.id === studentId);
            
            return student || null;
        } catch (error) {
            console.error(`获取学生信息失败 (${studentId}):`, error);
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

            // 检查学号是否已存在
            const existingStudent = await this.getStudentById(student.id);
            if (existingStudent) {
                throw new Error(`学号 ${student.id} 已存在`);
            }

            // 添加到学生列表
            const data = await this.dataAccess.readFile(this.filename, { students: [] });
            data.students.push(student.toJSON());
            
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`创建学生成功: ${student.name} (${student.id})`);
            return student;
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

            const data = await this.dataAccess.readFile(this.filename, { students: [] });
            const studentIndex = data.students.findIndex(s => s.id === studentId);
            
            if (studentIndex === -1) {
                throw new Error(`学生不存在: ${studentId}`);
            }

            // 合并更新数据
            const currentStudent = data.students[studentIndex];
            const updatedStudentData = { ...currentStudent, ...updateData };
            const updatedStudent = new StudentInfo(updatedStudentData);
            
            const validation = updatedStudent.validate();
            if (!validation.isValid) {
                throw new Error('学生数据验证失败: ' + validation.errors.join(', '));
            }

            // 更新数据
            data.students[studentIndex] = updatedStudent.toJSON();
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`更新学生成功: ${updatedStudent.name} (${updatedStudent.id})`);
            return updatedStudent;
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

            const data = await this.dataAccess.readFile(this.filename, { students: [] });
            const studentIndex = data.students.findIndex(s => s.id === studentId);
            
            if (studentIndex === -1) {
                throw new Error(`学生不存在: ${studentId}`);
            }

            const deletedStudent = data.students[studentIndex];
            data.students.splice(studentIndex, 1);
            
            await this.dataAccess.writeFile(this.filename, data);
            
            console.log(`删除学生成功: ${deletedStudent.name} (${deletedStudent.id})`);
            return true;
        } catch (error) {
            console.error(`删除学生失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 更新学生积分余额
     * @param {string} studentId - 学号
     * @param {number} newBalance - 新的积分余额
     * @returns {Promise<StudentInfo>}
     */
    async updateStudentBalance(studentId, newBalance) {
        try {
            if (typeof newBalance !== 'number') {
                throw new Error('积分余额必须为数字');
            }

            return await this.updateStudent(studentId, { balance: newBalance });
        } catch (error) {
            console.error(`更新学生积分失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 根据班级获取学生列表
     * @param {string} className - 班级名称
     * @returns {Promise<StudentInfo[]>}
     */
    async getStudentsByClass(className) {
        try {
            if (!className || typeof className !== 'string') {
                throw new Error('班级名称不能为空且必须为字符串');
            }

            const students = await this.getAllStudents();
            return students.filter(student => student.class === className);
        } catch (error) {
            console.error(`获取班级学生失败 (${className}):`, error);
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

            const students = await this.getAllStudents();
            const lowerKeyword = keyword.toLowerCase();
            
            return students.filter(student => 
                student.id.toLowerCase().includes(lowerKeyword) ||
                student.name.toLowerCase().includes(lowerKeyword)
            );
        } catch (error) {
            console.error(`搜索学生失败 (${keyword}):`, error);
            throw error;
        }
    }

    /**
     * 验证学生登录（仅验证学号是否存在）
     * @param {string} studentId - 学号
     * @returns {Promise<StudentInfo|null>}
     */
    async validateStudentLogin(studentId) {
        try {
            const student = await this.getStudentById(studentId);
            if (student) {
                console.log(`学生登录验证成功: ${student.name} (${student.id})`);
                return student;
            } else {
                console.log(`学生登录验证失败: 学号不存在 (${studentId})`);
                return null;
            }
        } catch (error) {
            console.error(`学生登录验证失败 (${studentId}):`, error);
            throw error;
        }
    }

    /**
     * 获取学生统计信息
     * @returns {Promise<object>}
     */
    async getStudentStatistics() {
        try {
            const students = await this.getAllStudents();
            
            const stats = {
                totalStudents: students.length,
                totalBalance: students.reduce((sum, student) => sum + student.balance, 0),
                averageBalance: 0,
                maxBalance: 0,
                minBalance: 0,
                classCounts: {}
            };

            if (students.length > 0) {
                stats.averageBalance = Math.round(stats.totalBalance / students.length * 100) / 100;
                stats.maxBalance = Math.max(...students.map(s => s.balance));
                stats.minBalance = Math.min(...students.map(s => s.balance));
                
                // 统计各班级人数
                students.forEach(student => {
                    stats.classCounts[student.class] = (stats.classCounts[student.class] || 0) + 1;
                });
            }

            return stats;
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