const DataAccess = require("../utils/dataAccess");
const PointsService = require("./pointsService");
const { Semester, SemesterArchive } = require("../models/dataModels");

/**
 * 学期服务层
 * 提供学期的管理以及跨学期结算的逻辑
 */
class SemesterService {
  constructor() {
    this.dataAccess = new DataAccess();
    this.pointsService = new PointsService();
  }

  /**
   * 确保数据访问层初始化
   */
  async _ensureInit() {
    await this.dataAccess.ensureDirectories();
  }

  /**
   * 获取所有学期
   * @returns {Promise<Semester[]>}
   */
  async getAllSemesters() {
    try {
      await this._ensureInit();
      const records = await this.dataAccess.getAllSemesters();
      return records.map((record) => new Semester(record));
    } catch (error) {
      console.error("获取学期列表失败:", error);
      throw new Error("获取学期列表失败");
    }
  }

  /**
   * 获取当前活动的学期
   * @returns {Promise<Semester|null>}
   */
  async getActiveSemester() {
    try {
      await this._ensureInit();
      const record = await this.dataAccess.getActiveSemester();
      return record ? new Semester(record) : null;
    } catch (error) {
      console.error("获取当前学期失败:", error);
      throw new Error("获取当前学期失败");
    }
  }

  /**
   * 根据ID获取学期
   * @param {string} id
   * @returns {Promise<Semester|null>}
   */
  async getSemesterById(id) {
    try {
      await this._ensureInit();
      const record = await this.dataAccess.getSemesterById(id);
      return record ? new Semester(record) : null;
    } catch (error) {
      console.error(`获取学期失败 (${id}):`, error);
      throw error;
    }
  }

  /**
   * 创建新学期
   * @param {object} data
   * @returns {Promise<Semester>}
   */
  async createSemester(data) {
    try {
      await this._ensureInit();
      const semester = new Semester(data);
      const validation = semester.validate();

      if (!validation.isValid) {
        throw new Error("学期数据验证失败: " + validation.errors.join(", "));
      }

      const record = await this.dataAccess.createSemester(semester.toJSON());
      return new Semester(record);
    } catch (error) {
      console.error("创建学期失败:", error);
      throw error;
    }
  }

  /**
   * 更新学期
   * @param {string} id
   * @param {object} updateData
   * @returns {Promise<Semester>}
   */
  async updateSemester(id, updateData) {
    try {
      await this._ensureInit();
      const record = await this.dataAccess.updateSemester(id, updateData);
      return new Semester(record);
    } catch (error) {
      console.error(`更新学期失败 (${id}):`, error);
      throw error;
    }
  }

  /**
   * 根据排名获取新学期初始奖励
   * @param {number} rank 
   * @returns {number}
   */
  _getBonusPointsByRank(rank) {
    if (rank >= 1 && rank <= 10) return 40;
    if (rank >= 11 && rank <= 20) return 30;
    if (rank >= 21 && rank <= 30) return 20;
    return 10;
  }

  /**
   * 激活目标学期并进行旧学期结算
   * 核心重置逻辑
   * @param {string} newSemesterId
   * @param {string} operatorId
   * @returns {Promise<void>}
   */
  async activateSemester(newSemesterId, operatorId) {
    try {
      await this._ensureInit();
      
      const newSemester = await this.getSemesterById(newSemesterId);
      if (!newSemester) {
        throw new Error("目标学期不存在");
      }
      
      if (newSemester.isCurrent) {
        throw new Error("该学期已是当前激活学期");
      }

      const currentSemester = await this.getActiveSemester();
      
      // 1. 获取现在的全部学生总积分排名，为结算做准备
      const studentRankings = await this.pointsService.getPointsRanking("total", 9999);
      
      // 计算当前所有学生的总积分
      const totalCurrentPoints = studentRankings.reduce((sum, item) => sum + item.points, 0);

      // 如果我们要切走的老学期存在
      if (currentSemester) {
          // 检查该学期是否已被归档过
          const hasArchiveQuery = await this.dataAccess._all('SELECT id FROM semester_archives WHERE semester_id = ? LIMIT 1', [currentSemester.id]);
          const hasArchive = hasArchiveQuery && hasArchiveQuery.length > 0;

          if (!hasArchive) {
              console.log(`正在归档 ${currentSemester.name} 的积分...`);
              for (const rankItem of studentRankings) {
                  await this.dataAccess.archiveStudentPoints(
                      currentSemester.id,
                      rankItem.id,
                      rankItem.points,
                      rankItem.rank
                  );
              }
          }

          if (totalCurrentPoints > 0) {
              console.log(`正在清零上一学期(${currentSemester.name})残留的积分...`);
              await this.dataAccess._run('UPDATE students SET balance = 0');
          }
      }
      // 5. 将该学期设置为激活状态（其他自动取消激活），这必须在【新学期发初始奖励前】执行，
      // 以便于之后新插入的记录能自动绑定正确的 semester_id ！！
      await this.dataAccess.setActiveSemester(newSemesterId);

      // 此时所有的操作都在新学期(newSemester)下进行。
      // 可以安全地发放初始奖励
      const checkBonusQuery = await this.dataAccess._all(
          "SELECT id FROM point_records WHERE reason LIKE ? AND semester_id = ? LIMIT 1", 
          [`新学期(${newSemester.name})初始奖励%`, newSemester.id]
      );
      const hasInitialBonuses = checkBonusQuery && checkBonusQuery.length > 0;

      if (hasInitialBonuses) {
          console.log(`新学期 ${newSemester.name} 已存在初始奖励记录，跳过重复发放`);
      } else {
          console.log(`开始发放上期排名的初始奖励`);
          const latestArchive = currentSemester ? await this.dataAccess._all(`
            SELECT student_id as studentId, final_rank as rank, final_balance as points 
            FROM semester_archives 
            WHERE semester_id = ?
          `, [currentSemester.id]) : [];

          const rankDataToUse = latestArchive.length > 0 ? latestArchive : [];

          const bonusRecords = rankDataToUse.map((record) => {
             const bonus = this._getBonusPointsByRank(record.rank);
             return {
                studentId: record.studentId,
                semesterId: newSemester.id, // Explicitly pin to new semester
                points: bonus,
                reason: `新学期(${newSemester.name})初始奖励 (上期排名第${record.rank}名)`,
                operatorId: operatorId,
                type: 'add'
             };
          });

          if (bonusRecords.length > 0) {
            await this.pointsService.batchAddPointRecords(bonusRecords);
          }
      }

      // 6. 清理积分缓存确保最新的排行准确
      this.pointsService.clearCache();

      console.log(`成功激活新学期：${newSemester.name}，并完成初始奖励发放`);
      return newSemester;

    } catch (error) {
      console.error("激活学期失败:", error);
      throw error;
    }
  }
}

module.exports = SemesterService;
