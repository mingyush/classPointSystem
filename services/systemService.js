const DataAccess = require('../utils/dataAccess');

/**
 * 系统级业务逻辑服务
 */
class SystemService {
    constructor(dataAccess = null) {
        // 复用传入的 dataAccess，避免创建隐式的多重 SQLite 连接
        this.dataAccess = dataAccess || new DataAccess();
    }

    /**
     * 修复数据一致性问题
     * 1. 合并重复的当前学期
     * 2. 补全学生的初始积分流水
     */
    async repairDataConsistency() {
        await this.dataAccess.ensureDirectories();
        const results = {
            semestersMerged: 0,
            recordsAdded: 0,
            errors: []
        };

        try {
            // 1. 合并重复的“当前学期”
            const allCurrent = await this.dataAccess._all('SELECT * FROM semesters WHERE is_current = 1 ORDER BY created_at ASC');
            if (allCurrent.length > 1) {
                const primarySemester = allCurrent[0];
                const duplicates = allCurrent.slice(1);
                
                for (const dup of duplicates) {
                    await this.dataAccess._run('UPDATE point_records SET semester_id = ? WHERE semester_id = ?', [primarySemester.id, dup.id]);
                    await this.dataAccess._run('UPDATE orders SET semester_id = ? WHERE semester_id = ?', [primarySemester.id, dup.id]);
                    await this.dataAccess._run('DELETE FROM semesters WHERE id = ?', [dup.id]);
                    results.semestersMerged++;
                }
            }

            const currentSemester = await this.dataAccess.getActiveSemester();
            if (!currentSemester) {
                throw new Error('未发现活动学期，无法进行对账');
            }

            // 2. 补全流水记录
            const students = await this.dataAccess.getAllStudents();
            for (const student of students) {
                try {
                    // 计算当前学期的流水总和
                    const records = await this.dataAccess.getPointRecordsByStudent(student.id, null, currentSemester.id);
                    // 【修复】1. 根据 type 区分积分增减
                    const recordsSum = records.reduce((sum, r) => {
                        return sum + (r.type === 'subtract' ? -r.points : r.points);
                    }, 0);

                    if (student.balance !== recordsSum) {
                        const diff = student.balance - recordsSum;
                        if (diff !== 0) {
                            await this.dataAccess.createPointRecord({
                                studentId: student.id,
                                semesterId: currentSemester.id,
                                points: Math.abs(diff), // 【修复】2. 确保存入数据库的积分数值为正数
                                reason: '系统修复：余额归集对账',
                                operatorId: 'system',
                                type: diff > 0 ? 'add' : 'subtract'
                            });
                            results.recordsAdded++;
                        }
                    }
                } catch (studentErr) {
                    // 【修复】4. 如果单条学生处理出错，存入 errors 不截断整个过程
                    console.error(`处理学生 [${student.name}] 时出错:`, studentErr);
                    results.errors.push(`学生 [${student.name}] 对账失败: ${studentErr.message}`);
                }
            }
            
            return results;
        } catch (error) {
            console.error('数据修复过程中出错:', error);
            throw error;
        }
    }
}

module.exports = SystemService;
