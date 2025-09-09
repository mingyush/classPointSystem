const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const BackupService = require('../services/backupService');

const router = express.Router();
const backupService = new BackupService();

// 配置文件上传
const upload = multer({
    dest: 'data/temp-uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB限制
    },
    fileFilter: (req, file, cb) => {
        // 只允许JSON和ZIP文件
        const allowedTypes = ['.json', '.zip'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('只支持JSON和ZIP文件格式'));
        }
    }
});

/**
 * 创建完整系统备份
 */
router.post('/create', async (req, res) => {
    try {
        console.log('开始创建系统备份...');
        const backupPath = await backupService.createFullBackup();
        
        res.json({
            success: true,
            message: '系统备份创建成功',
            backupPath: path.basename(backupPath),
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('创建备份失败:', error);
        res.status(500).json({
            success: false,
            message: '创建备份失败',
            error: error.message
        });
    }
});

/**
 * 获取备份文件列表
 */
router.get('/list', async (req, res) => {
    try {
        const backupList = await backupService.getBackupList();
        
        res.json({
            success: true,
            backups: backupList.map(backup => ({
                filename: backup.filename,
                size: backup.size,
                created: backup.created,
                modified: backup.modified,
                sizeFormatted: formatFileSize(backup.size)
            }))
        });
        
    } catch (error) {
        console.error('获取备份列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取备份列表失败',
            error: error.message
        });
    }
});

/**
 * 下载备份文件
 */
router.get('/download/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join('data', 'exports', filename);
        
        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({
                success: false,
                message: '备份文件不存在'
            });
        }
        
        // 设置下载头
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/zip');
        
        // 发送文件
        res.sendFile(path.resolve(filePath));
        
    } catch (error) {
        console.error('下载备份文件失败:', error);
        res.status(500).json({
            success: false,
            message: '下载备份文件失败',
            error: error.message
        });
    }
});

/**
 * 从备份文件恢复系统
 */
router.post('/restore', upload.single('backupFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请选择备份文件'
            });
        }
        
        console.log('开始恢复系统...', req.file.originalname);
        
        // 恢复系统
        await backupService.restoreFromBackup(req.file.path);
        
        // 清理上传的临时文件
        await fs.unlink(req.file.path);
        
        res.json({
            success: true,
            message: '系统恢复成功',
            filename: req.file.originalname,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('系统恢复失败:', error);
        
        // 清理上传的临时文件
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('清理临时文件失败:', cleanupError);
            }
        }
        
        res.status(500).json({
            success: false,
            message: '系统恢复失败',
            error: error.message
        });
    }
});

/**
 * 删除备份文件
 */
router.delete('/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const success = await backupService.deleteBackup(filename);
        
        if (success) {
            res.json({
                success: true,
                message: '备份文件删除成功',
                filename
            });
        } else {
            res.status(404).json({
                success: false,
                message: '备份文件不存在或删除失败'
            });
        }
        
    } catch (error) {
        console.error('删除备份文件失败:', error);
        res.status(500).json({
            success: false,
            message: '删除备份文件失败',
            error: error.message
        });
    }
});

/**
 * 导出单个数据文件
 */
router.post('/export/:dataType', async (req, res) => {
    try {
        const { dataType } = req.params;
        const validTypes = ['students', 'points', 'products', 'orders', 'config'];
        
        if (!validTypes.includes(dataType)) {
            return res.status(400).json({
                success: false,
                message: '无效的数据类型'
            });
        }
        
        const exportPath = await backupService.exportDataFile(dataType);
        
        res.json({
            success: true,
            message: `${dataType}数据导出成功`,
            filename: path.basename(exportPath),
            dataType
        });
        
    } catch (error) {
        console.error('导出数据失败:', error);
        res.status(500).json({
            success: false,
            message: '导出数据失败',
            error: error.message
        });
    }
});

/**
 * 导入单个数据文件
 */
router.post('/import/:dataType', upload.single('dataFile'), async (req, res) => {
    try {
        const { dataType } = req.params;
        const validTypes = ['students', 'points', 'products', 'orders', 'config'];
        
        if (!validTypes.includes(dataType)) {
            return res.status(400).json({
                success: false,
                message: '无效的数据类型'
            });
        }
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请选择数据文件'
            });
        }
        
        console.log(`开始导入${dataType}数据...`, req.file.originalname);
        
        // 导入数据
        await backupService.importDataFile(dataType, req.file.path);
        
        // 清理上传的临时文件
        await fs.unlink(req.file.path);
        
        res.json({
            success: true,
            message: `${dataType}数据导入成功`,
            filename: req.file.originalname,
            dataType
        });
        
    } catch (error) {
        console.error('导入数据失败:', error);
        
        // 清理上传的临时文件
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('清理临时文件失败:', cleanupError);
            }
        }
        
        res.status(500).json({
            success: false,
            message: '导入数据失败',
            error: error.message
        });
    }
});

/**
 * 清理旧的备份文件
 */
router.post('/cleanup', async (req, res) => {
    try {
        const { keepCount = 10 } = req.body;
        const deletedCount = await backupService.cleanOldExports(keepCount);
        
        res.json({
            success: true,
            message: `清理完成，删除了${deletedCount}个旧备份文件`,
            deletedCount
        });
        
    } catch (error) {
        console.error('清理备份文件失败:', error);
        res.status(500).json({
            success: false,
            message: '清理备份文件失败',
            error: error.message
        });
    }
});

/**
 * 获取数据统计信息
 */
router.get('/statistics', async (req, res) => {
    try {
        const stats = await backupService.getDataStatistics();
        
        res.json({
            success: true,
            statistics: stats
        });
        
    } catch (error) {
        console.error('获取数据统计失败:', error);
        res.status(500).json({
            success: false,
            message: '获取数据统计失败',
            error: error.message
        });
    }
});

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = router;