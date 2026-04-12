/**
 * 系统数据升级脚本 v1.3.0
 * 职责：
 * 1. 创建 feedbacks 表以支持反馈模块迁移到 SQLite。
 * 2. 从可能存在的 feedback.json 中迁移旧反馈数据。
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = {
    version: '1.3.0',
    description: '添加 feedbacks 表并迁移旧 feedback.json 数据',
    upgrade: async (dataAccess) => {
        // 1. 创建 feedbacks 表
        try {
            await dataAccess._runRaw(`
                CREATE TABLE IF NOT EXISTS feedbacks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'general',
                    priority TEXT NOT NULL DEFAULT 'medium',
                    status TEXT NOT NULL DEFAULT 'open',
                    submitter_type TEXT NOT NULL DEFAULT 'student',
                    submitter_id TEXT,
                    submitter_name TEXT DEFAULT '匿名用户',
                    contact_info TEXT DEFAULT '',
                    is_public INTEGER NOT NULL DEFAULT 0,
                    tags TEXT DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            `);
            console.log('[v1.3.0] Created feedbacks table.');
            
            // 创建索引
            await dataAccess._runRaw('CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks(status)');
            await dataAccess._runRaw('CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at DESC)');
            console.log('[v1.3.0] Created indexes for feedbacks table.');
        } catch (err) {
            console.error('[v1.3.0] Error creating feedbacks table:', err);
            throw err;
        }

        // 2. 尝试从 feedback.json 迁移旧数据
        try {
            const jsonPath = path.join(dataAccess.dataDir, 'feedback.json');
            let content;
            try {
                content = await fs.readFile(jsonPath, 'utf8');
            } catch (e) {
                // 如果不存在 json 文件，就直接跳过
                console.log('[v1.3.0] No legacy feedback.json found, skipping data migration.');
                return;
            }

            const data = JSON.parse(content);
            const items = Array.isArray(data) ? data : (data.feedbacks || data.feedback || []);
            
            let migratedCount = 0;
            const now = new Date().toISOString();

            for (const item of items) {
                try {
                    // 解析tags数组为字符串存入DB
                    const tagsStr = Array.isArray(item.tags) ? JSON.stringify(item.tags) : '[]';
                    
                    await dataAccess._runRaw(`
                        INSERT INTO feedbacks (
                            id, title, content, category, priority, status, 
                            submitter_type, submitter_id, submitter_name, contact_info, 
                            is_public, tags, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        item.id || ('feedback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)),
                        item.title || '',
                        item.content || '',
                        item.category || 'general',
                        item.priority || 'medium',
                        item.status || 'open',
                        item.submitterType || 'student',
                        item.submitterId || null,
                        item.submitterName || '匿名用户',
                        item.contactInfo || '',
                        item.isPublic ? 1 : 0,
                        tagsStr,
                        item.createdAt || now,
                        item.updatedAt || now
                    ]);
                    migratedCount++;
                } catch (e) {
                    if (!e.message.includes('UNIQUE constraint failed')) {
                        console.error('[v1.3.0] Error migrating feedback item:', e.message);
                    }
                }
            }
            console.log(`[v1.3.0] Successfully migrated ${migratedCount} legacy feedbacks.`);
        } catch (err) {
            console.error('[v1.3.0] Error during feedback.json migration:', err);
        }
    }
};
