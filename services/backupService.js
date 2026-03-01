const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const DataAccess = require('../utils/dataAccess');

/**
 * 备份服务 - 处理数据备份和恢复功能
 * 适配 SQLite 数据库
 */
class BackupService {
    constructor() {
        this.dataAccess = new DataAccess();
        this.dataDir = 'data';
        this.backupDir = path.join(this.dataDir, 'backups');
        this.exportDir = path.join(this.dataDir, 'exports');
    }

    /**
     * 确保导出目录存在
     */
    async ensureExportDirectory() {
        try {
            await fs.mkdir(this.exportDir, { recursive: true });
            await fs.mkdir(this.backupDir, { recursive: true });
        } catch (error) {
            console.error('创建导出目录失败:', error);
            throw error;
        }
    }

    /**
     * 创建完整系统备份
     * @returns {Promise<string>} 备份文件路径
     */
    async createFullBackup() {
        await this.ensureExportDirectory();
        await this.dataAccess.ensureDirectories();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `system-backup-${timestamp}.zip`;
        const backupPath = path.join(this.exportDir, backupFileName);

        return new Promise((resolve, reject) => {
            const output = fsSync.createWriteStream(backupPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log(`系统备份创建成功: ${backupFileName} (${archive.pointer()} bytes)`);
                resolve(backupPath);
            });

            archive.on('error', (err) => {
                console.error('创建备份失败:', err);
                reject(err);
            });

            archive.pipe(output);

            // 导出数据为 JSON 格式并添加到备份
            const exportDataPromise = (async () => {
                // 导出学生数据
                const students = await this.dataAccess.getAllStudents();
                archive.append(JSON.stringify({ students }, null, 2), { name: 'students.json' });

                // 导出积分记录
                const pointRecords = await this.dataAccess.getAllPointRecords();
                archive.append(JSON.stringify({ records: pointRecords }, null, 2), { name: 'points.json' });

                // 导出商品数据
                const products = await this.dataAccess.getAllProducts();
                archive.append(JSON.stringify({ products }, null, 2), { name: 'products.json' });

                // 导出订单数据
                const orders = await this.dataAccess.getAllOrders();
                archive.append(JSON.stringify({ orders }, null, 2), { name: 'orders.json' });

                // 导出教师数据
                const teachers = await this.dataAccess.getAllTeachers();
                archive.append(JSON.stringify({ teachers }, null, 2), { name: 'teachers.json' });

                // 导出配置
                const config = await this.dataAccess.getAllConfig();
                archive.append(JSON.stringify(config, null, 2), { name: 'config.json' });

                // 添加数据库统计信息
                const stats = await this.dataAccess.getDatabaseStats();
                archive.append(JSON.stringify(stats, null, 2), { name: 'backup_stats.json' });
            })();

            // 添加 SQLite 数据库文件
            const dbPath = path.join(this.dataDir, 'database.sqlite');
            if (fsSync.existsSync(dbPath)) {
                archive.file(dbPath, { name: 'database.sqlite' });
            }

            // 添加备份目录
            if (fsSync.existsSync(this.backupDir)) {
                archive.directory(this.backupDir, 'backups');
            }

            exportDataPromise
                .then(() => archive.finalize())
                .catch(reject);
        });
    }

    /**
     * 从备份文件恢复系统
     * @param {string} backupFilePath - 备份文件路径
     * @returns {Promise<boolean>} 恢复是否成功
     */
    async restoreFromBackup(backupFilePath) {
        try {
            // 创建临时恢复目录
            const tempDir = path.join(this.dataDir, 'temp-restore');
            await fs.mkdir(tempDir, { recursive: true });

            // 解压备份文件
            await new Promise((resolve, reject) => {
                require('fs').createReadStream(backupFilePath)
                    .pipe(unzipper.Extract({ path: tempDir }))
                    .on('close', resolve)
                    .on('error', reject);
            });

            // 验证备份文件完整性
            const isValid = await this.validateBackupFiles(tempDir);
            if (!isValid) {
                throw new Error('备份文件不完整或损坏');
            }

            // 备份当前数据（以防恢复失败）
            const currentBackupPath = await this.createFullBackup();
            console.log(`当前数据已备份到: ${currentBackupPath}`);

            // 优先从 SQLite 数据库文件恢复
            const dbPath = path.join(tempDir, 'database.sqlite');
            if (fsSync.existsSync(dbPath)) {
                const targetDbPath = path.join(this.dataDir, 'database.sqlite');
                await fs.copyFile(dbPath, targetDbPath);
                console.log('从 SQLite 数据库文件恢复成功');
            } else {
                // 从 JSON 文件恢复
                await this.restoreFromJsonFiles(tempDir);
            }

            // 清理临时目录
            await fs.rm(tempDir, { recursive: true, force: true });

            console.log('系统恢复完成');
            return true;

        } catch (error) {
            console.error('系统恢复失败:', error);
            throw error;
        }
    }

    /**
     * 从 JSON 文件恢复数据
     * @param {string} tempDir - 临时目录路径
     */
    async restoreFromJsonFiles(tempDir) {
        const dataFiles = ['students.json', 'points.json', 'products.json', 'orders.json', 'teachers.json'];

        for (const file of dataFiles) {
            const tempFilePath = path.join(tempDir, file);

            if (await this.fileExists(tempFilePath)) {
                const content = await fs.readFile(tempFilePath, 'utf8');
                const data = JSON.parse(content);

                // 根据文件类型恢复数据
                switch (file) {
                    case 'students.json':
                        await this.restoreStudents(data.students || []);
                        break;
                    case 'points.json':
                        await this.restorePointRecords(data.records || []);
                        break;
                    case 'products.json':
                        await this.restoreProducts(data.products || []);
                        break;
                    case 'orders.json':
                        await this.restoreOrders(data.orders || []);
                        break;
                    case 'teachers.json':
                        await this.restoreTeachers(data.teachers || []);
                        break;
                }
                console.log(`恢复文件: ${file}`);
            }
        }
    }

    /**
     * 恢复学生数据
     */
    async restoreStudents(students) {
        await this.dataAccess._run('DELETE FROM students');
        for (const student of students) {
            await this.dataAccess.createStudent(student);
        }
    }

    /**
     * 恢复积分记录
     */
    async restorePointRecords(records) {
        await this.dataAccess._run('DELETE FROM point_records');
        for (const record of records) {
            await this.dataAccess.createPointRecord(record);
        }
    }

    /**
     * 恢复商品数据
     */
    async restoreProducts(products) {
        await this.dataAccess._run('DELETE FROM products');
        for (const product of products) {
            await this.dataAccess.createProduct(product);
        }
    }

    /**
     * 恢复订单数据
     */
    async restoreOrders(orders) {
        await this.dataAccess._run('DELETE FROM orders');
        for (const order of orders) {
            await this.dataAccess.createOrder(order);
        }
    }

    /**
     * 恢复教师数据
     */
    async restoreTeachers(teachers) {
        await this.dataAccess._run('DELETE FROM teachers');
        for (const teacher of teachers) {
            await this.dataAccess.createTeacher(teacher);
        }
    }

    /**
     * 验证备份文件完整性
     * @param {string} backupDir - 备份目录路径
     * @returns {Promise<boolean>} 是否有效
     */
    async validateBackupFiles(backupDir) {
        try {
            // 检查是否有 SQLite 数据库文件
            const dbPath = path.join(backupDir, 'database.sqlite');
            if (fsSync.existsSync(dbPath)) {
                return true;
            }

            // 否则检查必要的数据文件
            const requiredFiles = ['students.json', 'points.json'];

            for (const file of requiredFiles) {
                const filePath = path.join(backupDir, file);
                if (!(await this.fileExists(filePath))) {
                    console.error(`缺少必要文件: ${file}`);
                    return false;
                }

                // 验证JSON格式
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    JSON.parse(content);
                } catch (parseError) {
                    console.error(`文件格式错误 ${file}:`, parseError.message);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('验证备份文件失败:', error);
            return false;
        }
    }

    /**
     * 获取备份文件列表
     * @returns {Promise<Array>} 备份文件信息列表
     */
    async getBackupList() {
        try {
            await this.ensureExportDirectory();
            const files = await fs.readdir(this.exportDir);
            const backupFiles = files.filter(file => file.endsWith('.zip'));

            const backupList = [];
            for (const file of backupFiles) {
                const filePath = path.join(this.exportDir, file);
                const stats = await fs.stat(filePath);

                backupList.push({
                    filename: file,
                    path: filePath,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime
                });
            }

            // 按创建时间倒序排列
            return backupList.sort((a, b) => b.created - a.created);

        } catch (error) {
            console.error('获取备份列表失败:', error);
            return [];
        }
    }

    /**
     * 删除备份文件
     * @param {string} filename - 备份文件名
     * @returns {Promise<boolean>} 删除是否成功
     */
    async deleteBackup(filename) {
        try {
            const filePath = path.join(this.exportDir, filename);
            await fs.unlink(filePath);
            console.log(`删除备份文件: ${filename}`);
            return true;
        } catch (error) {
            console.error(`删除备份文件失败 ${filename}:`, error);
            return false;
        }
    }

    /**
     * 导出数据为 JSON 文件
     * @param {string} dataType - 数据类型 (students, points, products, orders, teachers)
     * @returns {Promise<string>} 导出文件路径
     */
    async exportDataFile(dataType) {
        await this.ensureExportDirectory();

        let data;
        let filename;

        switch (dataType) {
            case 'students':
                data = { students: await this.dataAccess.getAllStudents() };
                break;
            case 'points':
                data = { records: await this.dataAccess.getAllPointRecords() };
                break;
            case 'products':
                data = { products: await this.dataAccess.getAllProducts() };
                break;
            case 'orders':
                data = { orders: await this.dataAccess.getAllOrders() };
                break;
            case 'teachers':
                data = { teachers: await this.dataAccess.getAllTeachers() };
                break;
            case 'config':
                data = await this.dataAccess.getAllConfig();
                break;
            default:
                throw new Error(`不支持的数据类型: ${dataType}`);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportFileName = `${dataType}-export-${timestamp}.json`;
        const exportPath = path.join(this.exportDir, exportFileName);

        await fs.writeFile(exportPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`导出数据文件: ${exportFileName}`);

        return exportPath;
    }

    /**
     * 导入数据文件
     * @param {string} dataType - 数据类型
     * @param {string} importFilePath - 导入文件路径
     * @returns {Promise<boolean>} 导入是否成功
     */
    async importDataFile(dataType, importFilePath) {
        try {
            // 验证文件格式
            const content = await fs.readFile(importFilePath, 'utf8');
            const data = JSON.parse(content);

            // 根据数据类型恢复
            switch (dataType) {
                case 'students':
                    await this.restoreStudents(data.students || data);
                    break;
                case 'points':
                    await this.restorePointRecords(data.records || data);
                    break;
                case 'products':
                    await this.restoreProducts(data.products || data);
                    break;
                case 'orders':
                    await this.restoreOrders(data.orders || data);
                    break;
                case 'teachers':
                    await this.restoreTeachers(data.teachers || data);
                    break;
                default:
                    throw new Error(`不支持的数据类型: ${dataType}`);
            }

            console.log(`导入数据文件成功: ${dataType}`);
            return true;

        } catch (error) {
            console.error(`导入数据文件失败 ${dataType}:`, error);
            throw error;
        }
    }

    /**
     * 清理旧的导出文件
     * @param {number} keepCount - 保留文件数量
     * @returns {Promise<number>} 清理的文件数量
     */
    async cleanOldExports(keepCount = 10) {
        try {
            const backupList = await this.getBackupList();
            const filesToDelete = backupList.slice(keepCount);

            let deletedCount = 0;
            for (const backup of filesToDelete) {
                if (await this.deleteBackup(backup.filename)) {
                    deletedCount++;
                }
            }

            console.log(`清理了 ${deletedCount} 个旧的导出文件`);
            return deletedCount;

        } catch (error) {
            console.error('清理旧导出文件失败:', error);
            return 0;
        }
    }

    /**
     * 获取系统数据统计信息
     * @returns {Promise<object>} 数据统计
     */
    async getDataStatistics() {
        try {
            return await this.dataAccess.getDatabaseStats();
        } catch (error) {
            console.error('获取数据统计失败:', error);
            return {};
        }
    }

    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>}
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = BackupService;
