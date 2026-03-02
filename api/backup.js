const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const BackupService = require('../services/backupService');
const { authenticateToken, requireTeacher } = require('./auth');
const { asyncHandler, createError, operationLogger } = require('../middleware/errorHandler');

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
router.post('/create', authenticateToken, requireTeacher,
    operationLogger('创建系统备份'),
    asyncHandler(async (req, res) => {
        console.log('开始创建系统备份...');
        const backupPath = await backupService.createFullBackup();
        
        res.json({
            success: true,
            message: '系统备份创建成功',
            backupPath: path.basename(backupPath),
            timestamp: new Date().toISOString()
        });
    })
);

/**
 * 获取备份文件列表
 */
router.get('/list', authenticateToken, requireTeacher,
    asyncHandler(async (req, res) => {
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
    })
);

/**
 * 下载备份文件
 */
router.get('/download/:filename', authenticateToken, requireTeacher,
    asyncHandler(async (req, res) => {
        const { filename } = req.params;
        const filePath = path.join('data', 'exports', filename);
        
        // 检查文件是否存在
        try {
            await fs.access(filePath);
        } catch {
            throw createError('RESOURCE_NOT_FOUND', '备份文件不存在');
        }
        
        // 设置下载头
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/zip');
        
        // 发送文件
        res.sendFile(path.resolve(filePath));
    })
);

/**
 * 获取数据统计信息
 */
router.get('/statistics', authenticateToken, requireTeacher,
    asyncHandler(async (req, res) => {
        const stats = await backupService.getDataStatistics();
        
        res.json({
            success: true,
            statistics: stats
        });
    })
);

/**
 * 从备份文件恢复系统
 */
router.post('/restore', authenticateToken, requireTeacher, upload.single('backupFile'),
    operationLogger('恢复系统备份'),
    asyncHandler(async (req, res) => {
        if (!req.file) {
            throw createError('VALIDATION_ERROR', '请选择备份文件');
        }
        
        console.log('开始恢复系统...', req.file.originalname);
        
        try {
            // 恢复系统
            await backupService.restoreFromBackup(req.file.path);
        } finally {
            // 清理上传的临时文件
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('清理临时文件失败:', cleanupError);
            }
        }
        
        res.json({
            success: true,
            message: '系统恢复成功',
            filename: req.file.originalname,
            timestamp: new Date().toISOString()
        });
    })
);

/**
 * 删除备份文件
 */
router.delete('/:filename', authenticateToken, requireTeacher,
    operationLogger('删除备份文件'),
    asyncHandler(async (req, res) => {
        const { filename } = req.params;
        const success = await backupService.deleteBackup(filename);
        
        if (!success) {
            throw createError('RESOURCE_NOT_FOUND', '备份文件不存在或删除失败');
        }
        
        res.json({
            success: true,
            message: '备份文件删除成功',
            filename
        });
    })
);

/**
 * 导出单个数据文件
 */
router.post('/export/:dataType', authenticateToken, requireTeacher,
    operationLogger('导出数据'),
    asyncHandler(async (req, res) => {
        const { dataType } = req.params;
        const validTypes = ['students', 'points', 'products', 'orders', 'config'];
        
        if (!validTypes.includes(dataType)) {
            throw createError('VALIDATION_ERROR', '无效的数据类型');
        }
        
        const exportPath = await backupService.exportDataFile(dataType);
        
        res.json({
            success: true,
            message: `${dataType}数据导出成功`,
            filename: path.basename(exportPath),
            dataType
        });
    })
);

/**
 * 导入单个数据文件
 */
router.post('/import/:dataType', authenticateToken, requireTeacher, upload.single('dataFile'),
    operationLogger('导入数据'),
    asyncHandler(async (req, res) => {
        const { dataType } = req.params;
        const validTypes = ['students', 'points', 'products', 'orders', 'config'];
        
        if (!validTypes.includes(dataType)) {
            throw createError('VALIDATION_ERROR', '无效的数据类型');
        }
        
        if (!req.file) {
            throw createError('VALIDATION_ERROR', '请选择数据文件');
        }
        
        console.log(`开始导入${dataType}数据...`, req.file.originalname);
        
        try {
            // 导入数据
            await backupService.importDataFile(dataType, req.file.path);
        } finally {
            // 清理上传的临时文件
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('清理临时文件失败:', cleanupError);
            }
        }
        
        res.json({
            success: true,
            message: `${dataType}数据导入成功`,
            filename: req.file.originalname,
            dataType
        });
    })
);

/**
 * 清理旧的备份文件
 */
router.post('/cleanup', authenticateToken, requireTeacher,
    operationLogger('清理旧备份'),
    asyncHandler(async (req, res) => {
        const { keepCount = 10 } = req.body;
        const deletedCount = await backupService.cleanOldExports(keepCount);
        
        res.json({
            success: true,
            message: `清理完成，删除了${deletedCount}个旧备份文件`,
            deletedCount
        });
    })
);

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
