/**
 * 班级隔离中间件
 * 
 * 功能：
 * - 根据URL中的classKey进行数据隔离
 * - 验证班级标识的有效性
 * - 设置班级上下文信息
 * - 确保每个班级数据完全隔离
 */

const { createError } = require('./errorHandler');
const path = require('path');
const fs = require('fs').promises;

/**
 * 班级上下文接口
 */
class ClassContext {
    constructor(classId, classKey, className, settings = {}) {
        this.classId = classId;
        this.classKey = classKey;
        this.className = className;
        this.settings = {
            requireSwitchPassword: false,
            switchPassword: '',
            autoSwitchHours: 2,
            displayConfig: {
                showStudentQuery: true,
                queryPosition: 'bottom',
                theme: 'default'
            },
            ...settings
        };
    }
}

/**
 * 班级隔离中间件类
 */
class ClassIsolationMiddleware {
    constructor() {
        this.classesFile = path.join(process.cwd(), 'data', 'classes.json');
        this.classCache = new Map(); // 缓存班级信息
        this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存过期
        this.initializeClassesFile();
    }

    /**
     * 初始化班级数据文件
     */
    async initializeClassesFile() {
        try {
            await fs.access(this.classesFile);
        } catch (error) {
            // 文件不存在，创建默认班级数据
            const defaultClasses = [
                {
                    id: 'default',
                    schoolId: 'default-school',
                    key: 'default',
                    name: '默认班级',
                    grade: '初一',
                    graduationYear: 2028,
                    studentNumberPrefix: '2025',
                    settings: {
                        requireSwitchPassword: false,
                        switchPassword: '',
                        autoSwitchHours: 2,
                        displayConfig: {
                            showStudentQuery: true,
                            queryPosition: 'bottom',
                            theme: 'default'
                        }
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];

            await fs.writeFile(this.classesFile, JSON.stringify(defaultClasses, null, 2));
            console.log('已创建默认班级数据文件');
        }
    }

    /**
     * 验证班级标识
     */
    async validateClassKey(classKey) {
        try {
            const classes = await this.loadClasses();
            return classes.some(cls => cls.key === classKey && cls.isActive !== false);
        } catch (error) {
            console.error('验证班级标识失败:', error);
            return false;
        }
    }

    /**
     * 获取班级信息
     */
    async getClassByKey(classKey) {
        try {
            // 检查缓存
            const cacheKey = `class_${classKey}`;
            const cached = this.classCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                return cached.data;
            }

            const classes = await this.loadClasses();
            const classInfo = classes.find(cls => cls.key === classKey);
            
            if (classInfo) {
                // 更新缓存
                this.classCache.set(cacheKey, {
                    data: classInfo,
                    timestamp: Date.now()
                });
            }

            return classInfo;
        } catch (error) {
            console.error('获取班级信息失败:', error);
            return null;
        }
    }

    /**
     * 设置班级上下文
     */
    setClassContext(req, classInfo) {
        req.classContext = new ClassContext(
            classInfo.id,
            classInfo.key,
            classInfo.name,
            classInfo.settings
        );
        
        // 设置数据路径前缀，用于数据隔离
        req.dataPathPrefix = `class_${classInfo.id}`;
    }

    /**
     * 获取班级上下文
     */
    getClassContext(req) {
        return req.classContext;
    }

    /**
     * 加载班级数据
     */
    async loadClasses() {
        try {
            const data = await fs.readFile(this.classesFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('加载班级数据失败:', error);
            return [];
        }
    }

    /**
     * 创建班级隔离中间件
     */
    createMiddleware() {
        return async (req, res, next) => {
            try {
                // 从URL中提取classKey
                const classKey = req.params.classKey || req.query.classKey;
                
                if (!classKey) {
                    // 如果没有classKey，检查是否是系统管理路径
                    if (req.path.startsWith('/api/system/')) {
                        return next(); // 系统管理路径不需要班级隔离
                    }
                    
                    const error = createError('VALIDATION_ERROR', '缺少班级标识');
                    return next(error);
                }

                // 验证班级标识
                const isValid = await this.validateClassKey(classKey);
                if (!isValid) {
                    const error = createError('RESOURCE_NOT_FOUND', '班级不存在或已停用');
                    return next(error);
                }

                // 获取班级信息
                const classInfo = await this.getClassByKey(classKey);
                if (!classInfo) {
                    const error = createError('RESOURCE_NOT_FOUND', '无法获取班级信息');
                    return next(error);
                }

                // 设置班级上下文
                this.setClassContext(req, classInfo);

                next();
            } catch (error) {
                console.error('班级隔离中间件错误:', error);
                next(error);
            }
        };
    }

    /**
     * 清除缓存
     */
    clearCache(classKey = null) {
        if (classKey) {
            this.classCache.delete(`class_${classKey}`);
        } else {
            this.classCache.clear();
        }
    }

    /**
     * 获取所有班级列表（系统管理用）
     */
    async getAllClasses() {
        return await this.loadClasses();
    }

    /**
     * 创建新班级（系统管理用）
     */
    async createClass(classData) {
        try {
            const classes = await this.loadClasses();
            
            // 检查classKey是否已存在
            if (classes.some(cls => cls.key === classData.key)) {
                throw createError('DUPLICATE_RESOURCE', '班级标识已存在');
            }

            const newClass = {
                id: classData.id || `class_${Date.now()}`,
                schoolId: classData.schoolId || 'default-school',
                key: classData.key,
                name: classData.name,
                grade: classData.grade || '',
                graduationYear: classData.graduationYear || new Date().getFullYear() + 3,
                studentNumberPrefix: classData.studentNumberPrefix || new Date().getFullYear().toString(),
                settings: {
                    requireSwitchPassword: false,
                    switchPassword: '',
                    autoSwitchHours: 2,
                    displayConfig: {
                        showStudentQuery: true,
                        queryPosition: 'bottom',
                        theme: 'default'
                    },
                    ...classData.settings
                },
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            classes.push(newClass);
            await fs.writeFile(this.classesFile, JSON.stringify(classes, null, 2));
            
            // 清除缓存
            this.clearCache();
            
            return newClass;
        } catch (error) {
            console.error('创建班级失败:', error);
            throw error;
        }
    }

    /**
     * 更新班级信息
     */
    async updateClass(classKey, updates) {
        try {
            const classes = await this.loadClasses();
            const classIndex = classes.findIndex(cls => cls.key === classKey);
            
            if (classIndex === -1) {
                throw createError('RESOURCE_NOT_FOUND', '班级不存在');
            }

            classes[classIndex] = {
                ...classes[classIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };

            await fs.writeFile(this.classesFile, JSON.stringify(classes, null, 2));
            
            // 清除缓存
            this.clearCache(classKey);
            
            return classes[classIndex];
        } catch (error) {
            console.error('更新班级失败:', error);
            throw error;
        }
    }
}

// 创建全局实例
const classIsolation = new ClassIsolationMiddleware();

module.exports = {
    ClassContext,
    ClassIsolationMiddleware,
    classIsolation
};