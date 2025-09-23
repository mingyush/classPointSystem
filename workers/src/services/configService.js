/**
 * 系统配置服务 - D1数据库版本
 * 实现系统配置管理功能
 */

import { DatabaseUtil } from '../utils/database.js';

export class ConfigService {
  constructor(db) {
    this.dbUtil = new DatabaseUtil(db);
    this.cache = new Map(); // 内存缓存
    this.cacheExpiry = new Map(); // 缓存过期时间
    this.cacheTTL = 5 * 60 * 1000; // 5分钟缓存
  }

  /**
   * 获取所有配置
   * @param {boolean} useCache 是否使用缓存
   * @returns {Promise<Object>} 配置对象
   */
  async getAllConfigs(useCache = true) {
    try {
      const cacheKey = 'all_configs';
      
      // 检查缓存
      if (useCache && this.isValidCache(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      const sql = 'SELECT * FROM system_config ORDER BY config_key';
      const configs = await this.dbUtil.query(sql);
      
      // 转换为对象格式
      const configObj = configs.reduce((acc, config) => {
        acc[config.config_key] = this.parseConfigValue(config.config_value, config.value_type);
        return acc;
      }, {});
      
      // 更新缓存
      if (useCache) {
        this.setCache(cacheKey, configObj);
      }
      
      return configObj;
    } catch (error) {
      console.error('Get all configs error:', error);
      throw new Error(`Failed to get configs: ${error.message}`);
    }
  }

  /**
   * 根据键获取配置值
   * @param {string} key 配置键
   * @param {*} defaultValue 默认值
   * @param {boolean} useCache 是否使用缓存
   * @returns {Promise<*>} 配置值
   */
  async getConfig(key, defaultValue = null, useCache = true) {
    try {
      const cacheKey = `config_${key}`;
      
      // 检查缓存
      if (useCache && this.isValidCache(cacheKey)) {
        return this.cache.get(cacheKey);
      }
      
      const sql = 'SELECT * FROM system_config WHERE config_key = ?';
      const config = await this.dbUtil.queryFirst(sql, [key]);
      
      let value = defaultValue;
      if (config) {
        value = this.parseConfigValue(config.config_value, config.value_type);
      }
      
      // 更新缓存
      if (useCache) {
        this.setCache(cacheKey, value);
      }
      
      return value;
    } catch (error) {
      console.error('Get config error:', error);
      throw new Error(`Failed to get config: ${error.message}`);
    }
  }

  /**
   * 设置配置值
   * @param {string} key 配置键
   * @param {*} value 配置值
   * @param {string} description 配置描述
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setConfig(key, value, description = null) {
    try {
      const { stringValue, valueType } = this.serializeConfigValue(value);
      
      // 检查配置是否已存在
      const existing = await this.dbUtil.queryFirst(
        'SELECT * FROM system_config WHERE config_key = ?',
        [key]
      );
      
      let result;
      if (existing) {
        // 更新现有配置
        const sql = `
          UPDATE system_config 
          SET config_value = ?, value_type = ?, description = ?, updated_at = ?
          WHERE config_key = ?
        `;
        result = await this.dbUtil.execute(sql, [
          stringValue,
          valueType,
          description || existing.description,
          this.dbUtil.formatDate(),
          key
        ]);
      } else {
        // 创建新配置
        const sql = `
          INSERT INTO system_config (config_key, config_value, value_type, description)
          VALUES (?, ?, ?, ?)
        `;
        result = await this.dbUtil.execute(sql, [
          key,
          stringValue,
          valueType,
          description
        ]);
      }
      
      if (result.success) {
        // 清除相关缓存
        this.clearCache(`config_${key}`);
        this.clearCache('all_configs');
      }
      
      return result.success;
    } catch (error) {
      console.error('Set config error:', error);
      throw new Error(`Failed to set config: ${error.message}`);
    }
  }

  /**
   * 删除配置
   * @param {string} key 配置键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteConfig(key) {
    try {
      const sql = 'DELETE FROM system_config WHERE config_key = ?';
      const result = await this.dbUtil.execute(sql, [key]);
      
      if (result.success && result.changes > 0) {
        // 清除相关缓存
        this.clearCache(`config_${key}`);
        this.clearCache('all_configs');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Delete config error:', error);
      throw new Error(`Failed to delete config: ${error.message}`);
    }
  }

  /**
   * 批量设置配置
   * @param {Object} configs 配置对象
   * @returns {Promise<boolean>} 是否设置成功
   */
  async setConfigs(configs) {
    try {
      const operations = [];
      
      for (const [key, value] of Object.entries(configs)) {
        const { stringValue, valueType } = this.serializeConfigValue(value);
        
        // 检查配置是否已存在
        const existing = await this.dbUtil.queryFirst(
          'SELECT * FROM system_config WHERE config_key = ?',
          [key]
        );
        
        if (existing) {
          operations.push({
            sql: `
              UPDATE system_config 
              SET config_value = ?, value_type = ?, updated_at = ?
              WHERE config_key = ?
            `,
            params: [stringValue, valueType, this.dbUtil.formatDate(), key]
          });
        } else {
          operations.push({
            sql: `
              INSERT INTO system_config (config_key, config_value, value_type)
              VALUES (?, ?, ?)
            `,
            params: [key, stringValue, valueType]
          });
        }
      }
      
      const result = await this.dbUtil.transaction(operations);
      
      if (result.success) {
        // 清除所有缓存
        this.clearAllCache();
      }
      
      return result.success;
    } catch (error) {
      console.error('Set configs error:', error);
      throw new Error(`Failed to set configs: ${error.message}`);
    }
  }

  /**
   * 获取系统信息配置
   * @returns {Promise<Object>} 系统信息
   */
  async getSystemInfo() {
    try {
      const configs = await this.getAllConfigs();
      
      return {
        systemName: configs.system_name || '班级积分管理系统',
        className: configs.class_name || '示例班级',
        teacherName: configs.teacher_name || '示例老师',
        schoolYear: configs.school_year || '2024-2025',
        semester: configs.semester || '上学期',
        maxPoints: configs.max_points || 1000,
        minPoints: configs.min_points || 0,
        pointsUnit: configs.points_unit || '分',
        enableShop: configs.enable_shop || true,
        enableRanking: configs.enable_ranking || true,
        rankingUpdateInterval: configs.ranking_update_interval || 60,
        theme: configs.theme || 'light',
        language: configs.language || 'zh-CN'
      };
    } catch (error) {
      console.error('Get system info error:', error);
      throw new Error(`Failed to get system info: ${error.message}`);
    }
  }

  /**
   * 更新系统信息配置
   * @param {Object} systemInfo 系统信息
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateSystemInfo(systemInfo) {
    try {
      const configMap = {
        systemName: 'system_name',
        className: 'class_name',
        teacherName: 'teacher_name',
        schoolYear: 'school_year',
        semester: 'semester',
        maxPoints: 'max_points',
        minPoints: 'min_points',
        pointsUnit: 'points_unit',
        enableShop: 'enable_shop',
        enableRanking: 'enable_ranking',
        rankingUpdateInterval: 'ranking_update_interval',
        theme: 'theme',
        language: 'language'
      };
      
      const configs = {};
      Object.keys(systemInfo).forEach(key => {
        if (configMap[key]) {
          configs[configMap[key]] = systemInfo[key];
        }
      });
      
      return await this.setConfigs(configs);
    } catch (error) {
      console.error('Update system info error:', error);
      throw new Error(`Failed to update system info: ${error.message}`);
    }
  }

  /**
   * 获取积分规则配置
   * @returns {Promise<Object>} 积分规则
   */
  async getPointRules() {
    try {
      const configs = await this.getAllConfigs();
      
      return {
        dailyAttendance: configs.points_daily_attendance || 5,
        homeworkComplete: configs.points_homework_complete || 10,
        classParticipation: configs.points_class_participation || 3,
        goodBehavior: configs.points_good_behavior || 5,
        badBehavior: configs.points_bad_behavior || -5,
        lateToClass: configs.points_late_to_class || -2,
        absentFromClass: configs.points_absent_from_class || -10,
        customRules: JSON.parse(configs.custom_point_rules || '[]')
      };
    } catch (error) {
      console.error('Get point rules error:', error);
      throw new Error(`Failed to get point rules: ${error.message}`);
    }
  }

  /**
   * 更新积分规则配置
   * @param {Object} pointRules 积分规则
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updatePointRules(pointRules) {
    try {
      const configMap = {
        dailyAttendance: 'points_daily_attendance',
        homeworkComplete: 'points_homework_complete',
        classParticipation: 'points_class_participation',
        goodBehavior: 'points_good_behavior',
        badBehavior: 'points_bad_behavior',
        lateToClass: 'points_late_to_class',
        absentFromClass: 'points_absent_from_class'
      };
      
      const configs = {};
      Object.keys(pointRules).forEach(key => {
        if (configMap[key]) {
          configs[configMap[key]] = pointRules[key];
        }
      });
      
      // 处理自定义规则
      if (pointRules.customRules) {
        configs.custom_point_rules = JSON.stringify(pointRules.customRules);
      }
      
      return await this.setConfigs(configs);
    } catch (error) {
      console.error('Update point rules error:', error);
      throw new Error(`Failed to update point rules: ${error.message}`);
    }
  }

  /**
   * 解析配置值
   * @param {string} value 字符串值
   * @param {string} type 值类型
   * @returns {*} 解析后的值
   */
  parseConfigValue(value, type) {
    if (value === null || value === undefined) {
      return null;
    }
    
    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1';
      case 'number':
        return Number(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      case 'string':
      default:
        return value;
    }
  }

  /**
   * 序列化配置值
   * @param {*} value 配置值
   * @returns {Object} 序列化结果
   */
  serializeConfigValue(value) {
    if (value === null || value === undefined) {
      return { stringValue: null, valueType: 'string' };
    }
    
    if (typeof value === 'boolean') {
      return { stringValue: value.toString(), valueType: 'boolean' };
    }
    
    if (typeof value === 'number') {
      return { stringValue: value.toString(), valueType: 'number' };
    }
    
    if (typeof value === 'object') {
      return { stringValue: JSON.stringify(value), valueType: 'json' };
    }
    
    return { stringValue: value.toString(), valueType: 'string' };
  }

  /**
   * 检查缓存是否有效
   * @param {string} key 缓存键
   * @returns {boolean} 是否有效
   */
  isValidCache(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    
    const expiry = this.cacheExpiry.get(key);
    if (!expiry || Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * 设置缓存
   * @param {string} key 缓存键
   * @param {*} value 缓存值
   */
  setCache(key, value) {
    this.cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.cacheTTL);
  }

  /**
   * 清除指定缓存
   * @param {string} key 缓存键
   */
  clearCache(key) {
    this.cache.delete(key);
    this.cacheExpiry.delete(key);
  }

  /**
   * 清除所有缓存
   */
  clearAllCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ttl: this.cacheTTL
    };
  }
}