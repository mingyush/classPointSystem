/**
 * 系统数据升级脚本 v1.2.0
 * 职责：
 * 1. 扩充 point_records 和 orders 表由于早期未设计而缺失的 semester_id 物理字段。
 * 2. 爬取过去无学期标识的积分与订单存量数据，通过发生期截断其应属学期进行自动数据补白，无法匹配则安全退至上级非活跃期。
 *
 * 注意：本脚本在 _checkAndUpgradeData 中调用，此时 ensureDirectories 尚未返回（_initPromise 正处于执行中），
 * 因此必须使用底层 _allRaw / _getRaw / _runRaw 而不能用 _all / _get / _run（后者会调用 ensureDirectories 导致死锁）。
 */

module.exports = {
    version: '1.2.0',
    description: '补充学期 ID 字段到订单与积分流水表，并结合时段自动分类补齐现存裸数据的学期归属。',
    upgrade: async (dataAccess) => {
        // 1. 尝试为 point_records 补充 semester_id 列
        try {
            await dataAccess._runRaw(`ALTER TABLE point_records ADD COLUMN semester_id TEXT`);
            console.log('[v1.2.0] Migrated point_records: added semester_id column.');
        } catch (err) {
            if (!err.message.includes('duplicate column')) {
                console.error('[v1.2.0] Error altering point_records:', err);
            }
        }

        // 2. 尝试为 orders 补充 semester_id 列
        try {
            await dataAccess._runRaw(`ALTER TABLE orders ADD COLUMN semester_id TEXT`);
            console.log('[v1.2.0] Migrated orders: added semester_id column.');
        } catch (err) {
            if (!err.message.includes('duplicate column')) {
                console.error('[v1.2.0] Error altering orders:', err);
            }
        }

        // 3. 将没有学期关联的历史记录根据时间智能划分
        // 使用 _allRaw 避免触发 ensureDirectories 递归死锁
        const allSemesters = await dataAccess._allRaw('SELECT * FROM semesters ORDER BY start_date DESC');
        if (allSemesters && allSemesters.length > 0) {
            
            // 挑选一个距当前最近的非活跃学期（is_current = 0）作为无法匹配真空期的兜底
            let fallbackSemesterId = allSemesters.find(s => s.is_current === 0)?.id;
            if (!fallbackSemesterId) {
                // 极端情况：所有学期都是激活状态，使用最近的那个
                fallbackSemesterId = allSemesters[0].id;
            }

            // 升级 PointRecords
            const nullPoints = await dataAccess._allRaw('SELECT id, timestamp FROM point_records WHERE semester_id IS NULL');
            let pUpdates = 0;
            for (const record of nullPoints) {
                const recTime = new Date(record.timestamp).getTime();
                let targetSemId = fallbackSemesterId;

                for (const sem of allSemesters) {
                    if (recTime >= new Date(sem.start_date).getTime() && recTime <= new Date(sem.end_date).getTime()) {
                        targetSemId = sem.id;
                        break;
                    }
                }
                await dataAccess._runRaw('UPDATE point_records SET semester_id = ? WHERE id = ?', [targetSemId, record.id]);
                pUpdates++;
            }

            // 升级 Orders
            const nullOrders = await dataAccess._allRaw('SELECT id, reserved_at FROM orders WHERE semester_id IS NULL');
            let oUpdates = 0;
            for (const record of nullOrders) {
                const recTime = new Date(record.reserved_at).getTime();
                let targetSemId = fallbackSemesterId;

                for (const sem of allSemesters) {
                    if (recTime >= new Date(sem.start_date).getTime() && recTime <= new Date(sem.end_date).getTime()) {
                        targetSemId = sem.id;
                        break;
                    }
                }
                await dataAccess._runRaw('UPDATE orders SET semester_id = ? WHERE id = ?', [targetSemId, record.id]);
                oUpdates++;
            }

            console.log(`[v1.2.0] Repaired legacy data mapping. Points updated: ${pUpdates}, Orders updated: ${oUpdates}.`);
        } else {
            console.warn('[v1.2.0] No semesters found. Skipping historical data patching for semester_id.');
        }
    }
};
