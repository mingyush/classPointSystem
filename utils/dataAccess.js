const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

/**
 * 数据访问层 - SQLite 实现
 * 提供规范化的数据库表结构和直接 SQL 操作
 */
class DataAccess {
    static instances = [];

    constructor(dataDir = 'data') {
        this._dataDir = dataDir;
        this.backupDir = path.join(dataDir, 'backups');
        this.databasePath = path.join(dataDir, 'database.sqlite');
        this.db = null;
        this.initialized = false;
        this._initPromise = null;

        // 性能监控
        this.metrics = {
            readCount: 0,
            writeCount: 0,
            averageReadTime: 0,
            averageWriteTime: 0
        };

        DataAccess.instances.push(this);
    }

    get dataDir() {
        return this._dataDir;
    }

    static async closeAll() {
        if (DataAccess.instances.length > 0) {
            console.log(`正在关闭 ${DataAccess.instances.length} 个 DataAccess 数据库实例...`);
            const promises = DataAccess.instances.map(async (instance) => {
                if (instance.db) {
                    return new Promise((resolve) => {
                        instance.db.close((err) => {
                            if (err) {
                                console.error('关闭 SQLite 数据库连接出错:', err);
                            }
                            instance.db = null;
                            instance.initialized = false;
                            resolve();
                        });
                    });
                }
            });
            await Promise.all(promises);
            DataAccess.instances = [];
            console.log('所有依赖 sqlite 的 DataAccess 实例已完成释放。');
        }
    }

    set dataDir(nextDataDir) {
        if (!nextDataDir || nextDataDir === this._dataDir) return;
        this._dataDir = nextDataDir;
        this.backupDir = path.join(nextDataDir, 'backups');
        this.databasePath = path.join(nextDataDir, 'database.sqlite');
        this.initialized = false;
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * 确保数据库初始化
     */
    async ensureDirectories() {
        if (this.initialized) return;
        if (this._initPromise) return this._initPromise;

        this._initPromise = (async () => {
            // 创建目录
            await fs.mkdir(this.dataDir, { recursive: true });
        await fs.mkdir(this.backupDir, { recursive: true });

        // 创建数据库连接
        if (!this.db) {
            console.log('Connecting to SQLite at: ', this.databasePath);
            this.db = await new Promise((resolve, reject) => {
                const db = new sqlite3.Database(this.databasePath, error => {
                    console.log('SQLite connection callback hit. Error:', error);
                    if (error) reject(error);
                    else {
                        // 避免 SQLITE_BUSY: 增加等待时间，并可以考虑后续改为 WAL
                        db.configure('busyTimeout', 5000);
                        resolve(db);
                    }
                });
            });
            console.log('Applying PRAGMAs');
            try {
                console.log('Running PRAGMA journal_mode = WAL');
                await this._runRaw('PRAGMA journal_mode = WAL');
                console.log('Running PRAGMA synchronous = NORMAL');
                await this._runRaw('PRAGMA synchronous = NORMAL');
                console.log('PRAGMAs Applied');
            } catch(e) {
                console.error("PRAGMA error", e);
            }
        }

        // 创建表结构
        await this._createTables();

        // 先确保默认学期存在（必须在旧数据迁移前，否则时间回填时找不到学期）
        await this._ensureDefaultSemester();

        // 迁移旧数据（此时学期已存在，可正确关联）
        await this._migrateLegacyData();

        // 检查版本升级以处理学期关联变更等 (1.2.0+)
        await this._checkAndUpgradeData();

        this.initialized = true;
        })();
        
        await this._initPromise;
    }

    /**
     * 创建数据库表
     */
    async _createTables() {
        console.log('Starting _createTables...');
        try {
            // 启用外键约束
            console.log('Enabling PRAGMA foreign_keys');
            await this._runRaw('PRAGMA foreign_keys = ON');

            // 学生表
            console.log('Creating students table');
            await this._runRaw(`
                CREATE TABLE IF NOT EXISTS students (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    class TEXT NOT NULL,
                    balance INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                )
            `);

            // 积分记录表
            console.log('Creating point_records table');
            await this._runRaw(`
                CREATE TABLE IF NOT EXISTS point_records (
                    id TEXT PRIMARY KEY,
                    student_id TEXT NOT NULL,
                    semester_id TEXT,
                    points INTEGER NOT NULL,
                    reason TEXT NOT NULL,
                    operator_id TEXT,
                    timestamp TEXT NOT NULL,
                    type TEXT NOT NULL DEFAULT 'add',
                    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
                )
            `);

            await this._runRaw(`
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                price INTEGER NOT NULL DEFAULT 0,
                stock INTEGER NOT NULL DEFAULT 0,
                description TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
        `);
        console.log('Created products table');

        // 订单表
        console.log('Creating orders table');
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                semester_id TEXT,
                product_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reserved_at TEXT NOT NULL,
                confirmed_at TEXT,
                cancelled_at TEXT,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `);
        console.log('Created orders table');

        // 教师表
        console.log('Creating teachers table');
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS teachers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'teacher',
                department TEXT DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
        `);
        console.log('Created teachers table');

        // 系统配置表
        console.log('Creating system_config table');
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);
        console.log('Created system_config table');

        // 学期表
        console.log('Creating semesters table');
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS semesters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                is_current INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        `);
        console.log('Created semesters table');

        // 学期归档表 (记录历史学期的最终积分和排名)
        console.log('Creating semester_archives table');
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS semester_archives (
                id TEXT PRIMARY KEY,
                semester_id TEXT NOT NULL,
                student_id TEXT NOT NULL,
                final_balance INTEGER NOT NULL,
                final_rank INTEGER NOT NULL,
                FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `);
        console.log('Created semester_archives table');

        // 班级互动表（老师下发 + 班级代表上报/确认）
        console.log('Creating class_interactions table');
        await this._runRaw(`
            CREATE TABLE IF NOT EXISTS class_interactions (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_by_role TEXT NOT NULL,
                created_by_id TEXT NOT NULL,
                created_by_name TEXT DEFAULT '',
                class_action_by TEXT,
                class_action_at TEXT,
                class_action_note TEXT,
                teacher_action_by TEXT,
                teacher_action_at TEXT,
                teacher_action_note TEXT,
                deadline_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);
        console.log('Created class_interactions table');

        // 创建索引
        console.log('Creating indexes');
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_point_records_student_id ON point_records(student_id)`);
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_point_records_timestamp ON point_records(timestamp)`);
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id)`);
        await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
            await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)`);
            await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_semesters_is_current ON semesters(is_current)`);
            await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_semester_archives_semester_id ON semester_archives(semester_id)`);
            await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_class_interactions_status_type ON class_interactions(status, type)`);
            await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_class_interactions_created_at ON class_interactions(created_at DESC)`);
            await this._runRaw(`CREATE INDEX IF NOT EXISTS idx_class_interactions_deadline_at ON class_interactions(deadline_at)`);
            console.log('Indexes created successfully.');
        } catch (e) {
            console.error('_createTables error:', e);
            throw e;
        }
    }

    /**
     * 确保默认学期存在
     * 学期定义：春季学期 2月1日~7月31日，秋季学期 9月1日~次年1月31日
     */
    async _ensureDefaultSemester() {
        const row = await this._getRaw('SELECT COUNT(*) as count FROM semesters');
        const count = row ? row.count : 0;
        if (count === 0) {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1; // 1-12

            // 判断当前处于哪个学期（春季：2~8月，秋季：9~次年1月）
            const isSpring = month >= 2 && month <= 8;

            let currentSemester, previousSemester;

            if (isSpring) {
                // 当前：春季学期 year年2月1日~7月31日
                currentSemester = {
                    id: this._generateId('sem'),
                    name: `${year}年春季学期`,
                    startDate: new Date(year, 1, 1).toISOString(),   // 2月1日
                    endDate:   new Date(year, 6, 31).toISOString(),  // 7月31日
                    isCurrent: 1,
                    createdAt: now.toISOString()
                };
                // 上一个：秋季学期 (year-1)年9月1日~(year)年1月31日
                previousSemester = {
                    id: this._generateId('sem_prev'),
                    name: `${year - 1}年秋季学期`,
                    startDate: new Date(year - 1, 8, 1).toISOString(),  // 9月1日
                    endDate:   new Date(year, 0, 31).toISOString(),     // 次年1月31日
                    isCurrent: 0,
                    createdAt: new Date(now.getTime() - 86400000).toISOString()
                };
            } else {
                // 当前：秋季学期 year年9月1日~(year+1)年1月31日
                currentSemester = {
                    id: this._generateId('sem'),
                    name: `${year}年秋季学期`,
                    startDate: new Date(year, 8, 1).toISOString(),      // 9月1日
                    endDate:   new Date(year + 1, 0, 31).toISOString(), // 次年1月31日
                    isCurrent: 1,
                    createdAt: now.toISOString()
                };
                // 上一个：春季学期 year年2月1日~7月31日
                previousSemester = {
                    id: this._generateId('sem_prev'),
                    name: `${year}年春季学期`,
                    startDate: new Date(year, 1, 1).toISOString(),  // 2月1日
                    endDate:   new Date(year, 6, 31).toISOString(), // 7月31日
                    isCurrent: 0,
                    createdAt: new Date(now.getTime() - 86400000).toISOString()
                };
            }

            // 再次检查确认（双重锁定，避免并发竞争导致的重复）
            const checkRow = await this._getRaw('SELECT COUNT(*) as count FROM semesters');
            if (checkRow && checkRow.count > 0) return;

            // 插入上一个学期
            await this._runRaw(
                'INSERT INTO semesters (id, name, start_date, end_date, is_current, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [previousSemester.id, previousSemester.name, previousSemester.startDate, previousSemester.endDate, previousSemester.isCurrent, previousSemester.createdAt]
            );
            console.log(`初始化默认学期(上期): ${previousSemester.name} [${previousSemester.startDate.slice(0,10)} ~ ${previousSemester.endDate.slice(0,10)}]`);

            // 插入当前学期
            await this._runRaw(
                'INSERT INTO semesters (id, name, start_date, end_date, is_current, created_at) VALUES (?, ?, ?, ?, ?, ?)',
                [currentSemester.id, currentSemester.name, currentSemester.startDate, currentSemester.endDate, currentSemester.isCurrent, currentSemester.createdAt]
            );
            console.log(`初始化默认学期(当期): ${currentSemester.name} [${currentSemester.startDate.slice(0,10)} ~ ${currentSemester.endDate.slice(0,10)}]`);
        }
    }

    /**
     * 系统版本校验及数据升级
     */
    async _checkAndUpgradeData() {
        console.log('Checking system data version...');
        try {
            const row = await this._getRaw("SELECT value FROM system_config WHERE key = 'system_version'");
            let currentVersion = row ? row.value : '1.0.0';

            const upgradesDir = path.join(__dirname, 'upgrades');
            // 确保 upgrades 目录存在
            try {
                await fs.access(upgradesDir);
            } catch (err) {
                console.log('No upgrades directory found, skipping script-driven upgrades.');
                return;
            }

            const files = await fs.readdir(upgradesDir);
            const scriptFiles = files.filter(f => f.startsWith('v') && f.endsWith('.js'));
            
            // 辅助函数：语义化版本比较 (a > b 返回正数, a < b 返回负数)
            const compareVersions = (v1, v2) => {
                const parts1 = v1.replace(/^v/, '').split('.').map(Number);
                const parts2 = v2.replace(/^v/, '').split('.').map(Number);
                const len = Math.max(parts1.length, parts2.length);
                for (let i = 0; i < len; i++) {
                    const p1 = parts1[i] || 0;
                    const p2 = parts2[i] || 0;
                    if (p1 !== p2) return p1 - p2;
                }
                return 0;
            };

            // 过滤出版本高于当前数据库版本的脚本并按版本从小到大排序
            const pendingUpgrades = scriptFiles
                .map(file => {
                    const scriptPath = path.join(upgradesDir, file);
                    // 清除 require 缓存便于动态调试（可选）
                    delete require.cache[require.resolve(scriptPath)];
                    const script = require(scriptPath);
                    return { file, script };
                })
                .filter(item => item.script && item.script.version && compareVersions(item.script.version, currentVersion) > 0)
                .sort((a, b) => compareVersions(a.script.version, b.script.version));

            if (pendingUpgrades.length === 0) {
                console.log(`System data is up to date (version ${currentVersion}).`);
                return;
            }

            console.log(`Found ${pendingUpgrades.length} pending upgrade(s). Current version: ${currentVersion}.`);

            for (const { file, script } of pendingUpgrades) {
                console.log(`Executing upgrade script for version ${script.version} (${file})...`);
                if (typeof script.upgrade === 'function') {
                    await script.upgrade(this);
                    
                    // 升级成功后更新版本记录
                    const now = new Date().toISOString();
                    await this._runRaw(
                        'INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?, ?, ?)',
                        ['system_version', script.version, now]
                    );
                    currentVersion = script.version;
                    console.log(`System version upgraded to ${script.version} successfully.`);
                } else {
                    console.warn(`Upgrade script ${file} is missing 'upgrade' function.`);
                }
            }
        } catch (error) {
            console.error('Error during data upgrade procedure:', error);
            // 这里非致命异常可让系统强行启动以保障最小业务可用
        }
    }

    /**
     * 迁移旧的 JSON 数据
     */
    async _migrateLegacyData() {
        // 检查是否已有学生数据
        const row = await this._getRaw('SELECT COUNT(*) as count FROM students');
        if (row && row.count > 0) return;

        const now = new Date().toISOString();
        const jsonFiles = [
            { name: 'students.json', key: 'students' },
            { name: 'points.json', key: 'records' },
            { name: 'products.json', key: 'products' },
            { name: 'orders.json', key: 'orders' },
            { name: 'teachers.json', key: 'teachers' }
        ];

        for (const file of jsonFiles) {
            const filePath = path.join(this.dataDir, file.name);
            try {
                const content = await fs.readFile(filePath, 'utf8');
                const data = JSON.parse(content);
                const items = data[file.key] || [];

                for (const item of items) {
                    try {
                        await this._importItem(file.name, item, now);
                    } catch (e) {
                        // 忽略重复键等错误
                    }
                }
                console.log(`迁移 ${file.name} 完成: ${items.length} 条记录`);
            } catch (e) {
                // 文件不存在，忽略
            }
        }
    }

    /**
     * 导入单条数据
     */
    async _importItem(filename, item, now) {
        switch (filename) {
            case 'students.json':
                await this._runRaw(
                    'INSERT INTO students (id, name, class, balance, created_at) VALUES (?, ?, ?, ?, ?)',
                    [item.id, item.name, item.class || '', item.balance || 0, item.createdAt || now]
                );
                break;
            case 'points.json':
                await this._runRaw(
                    'INSERT INTO point_records (id, student_id, points, reason, operator_id, timestamp, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.studentId, item.points, item.reason, item.operatorId || '', item.timestamp, item.type || 'add']
                );
                break;
            case 'products.json':
                await this._runRaw(
                    'INSERT INTO products (id, name, price, stock, description, image_url, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.name, item.price || 0, item.stock || 0, item.description || '', item.imageUrl || '', item.isActive !== false ? 1 : 0, item.createdAt || now]
                );
                break;
            case 'orders.json':
                await this._runRaw(
                    'INSERT INTO orders (id, student_id, product_id, status, reserved_at, confirmed_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.studentId, item.productId, item.status || 'pending', item.reservedAt || now, item.confirmedAt || null, item.cancelledAt || null]
                );
                break;
            case 'teachers.json':
                await this._runRaw(
                    'INSERT INTO teachers (id, name, password, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [item.id, item.name, item.password, item.role || 'teacher', item.department || '', item.isActive !== false ? 1 : 0, item.createdAt || now]
                );
                break;
        }
    }

    // ==================== 基础数据库操作 ====================

    async _runRaw(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (error) {
                if (error) reject(error);
                else resolve();
            });
        });
    }

    async _getRaw(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (error, row) => {
                if (error) reject(error);
                else resolve(row || null);
            });
        });
    }

    async _allRaw(sql, params = []) {
        if (!this.db) throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (error, rows) => {
                if (error) reject(error);
                else resolve(rows || []);
            });
        });
    }

    async _run(sql, params = []) {
        await this.ensureDirectories();
        return this._runRaw(sql, params);
    }

    async _get(sql, params = []) {
        await this.ensureDirectories();
        return this._getRaw(sql, params);
    }

    async _all(sql, params = []) {
        await this.ensureDirectories();
        return this._allRaw(sql, params);
    }

    async _count(tableName, whereClause = '', params = []) {
        const sql = `SELECT COUNT(*) as count FROM ${tableName}${whereClause ? ' WHERE ' + whereClause : ''}`;
        const row = await this._get(sql, params);
        return row ? row.count : 0;
    }

    // ==================== 学生操作 ====================

    async getAllStudents() {
        const rows = await this._all('SELECT * FROM students ORDER BY id ASC');
        return rows.map(row => this._rowToStudent(row));
    }

    async getStudentById(id) {
        const row = await this._get('SELECT * FROM students WHERE id = ?', [id]);
        return row ? this._rowToStudent(row) : null;
    }

    async createStudent(data) {
        const now = new Date().toISOString();
        await this._run(
            'INSERT INTO students (id, name, class, balance, created_at) VALUES (?, ?, ?, ?, ?)',
            [data.id, data.name, data.class, data.balance || 0, data.createdAt || now]
        );
        return this.getStudentById(data.id);
    }

    async updateStudent(id, updateData) {
        const fields = [];
        const values = [];
        ['name', 'class', 'balance'].forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });
        if (fields.length === 0) return this.getStudentById(id);
        values.push(id);
        await this._run(`UPDATE students SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getStudentById(id);
    }

    async deleteStudent(id) {
        await this._run('DELETE FROM students WHERE id = ?', [id]);
        return true;
    }

    async searchStudents(keyword) {
        const searchTerm = `%${keyword.toLowerCase()}%`;
        const rows = await this._all(
            'SELECT * FROM students WHERE LOWER(id) LIKE ? OR LOWER(name) LIKE ? ORDER BY id ASC',
            [searchTerm, searchTerm]
        );
        return rows.map(row => this._rowToStudent(row));
    }

    async getStudentsByClass(className) {
        const rows = await this._all('SELECT * FROM students WHERE class = ? ORDER BY id ASC', [className]);
        return rows.map(row => this._rowToStudent(row));
    }

    _rowToStudent(row) {
        return {
            id: row.id,
            name: row.name,
            class: row.class,
            balance: row.balance,
            createdAt: row.created_at
        };
    }

    // ==================== 积分记录操作 ====================

    async getAllPointRecords() {
        const rows = await this._all('SELECT * FROM point_records ORDER BY timestamp DESC');
        return rows.map(row => this._rowToPointRecord(row));
    }

    async getPointRecordsByStudent(studentId, limit = null, semesterId = null) {
        let sql = 'SELECT * FROM point_records WHERE student_id = ?';
        let params = [studentId];
        
        if (semesterId) {
            sql += ' AND semester_id = ?';
            params.push(semesterId);
        }
        
        sql += ' ORDER BY timestamp DESC';
        if (limit) sql += ` LIMIT ${parseInt(limit)}`;
        
        const rows = await this._all(sql, params);
        return rows.map(row => this._rowToPointRecord(row));
    }

    async getPointRecordsByDateRange(startDate, endDate, semesterId = null, studentId = null) {
        let sql = 'SELECT * FROM point_records WHERE timestamp >= ? AND timestamp <= ?';
        const params = [startDate, endDate];
        if (semesterId) {
            sql += ' AND semester_id = ?';
            params.push(semesterId);
        }
        if (studentId) {
            sql += ' AND student_id = ?';
            params.push(studentId);
        }
        // Exclude system transition actions from performance rankings
        sql += " AND reason NOT LIKE '%初始奖励%' AND reason NOT LIKE '%积分清零%'";
        sql += ' ORDER BY timestamp DESC';
        const rows = await this._all(sql, params);
        return rows.map(row => this._rowToPointRecord(row));
    }

    async createPointRecord(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('point');
        await this._run(
            'INSERT INTO point_records (id, student_id, semester_id, points, reason, operator_id, timestamp, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, data.studentId, data.semesterId, data.points, data.reason, data.operatorId || '', data.timestamp || now, data.type || 'add']
        );
        return {
            id,
            studentId: data.studentId,
            semesterId: data.semesterId,
            points: data.points,
            reason: data.reason,
            operatorId: data.operatorId || '',
            timestamp: data.timestamp || now,
            type: data.type || 'add'
        };
    }

    _rowToPointRecord(row) {
        return {
            id: row.id,
            studentId: row.student_id,
            semesterId: row.semester_id,
            points: row.points,
            reason: row.reason,
            operatorId: row.operator_id,
            timestamp: row.timestamp,
            type: row.type
        };
    }

    // ==================== 商品操作 ====================

    async getAllProducts(activeOnly = false) {
        let sql = 'SELECT * FROM products';
        if (activeOnly) sql += ' WHERE is_active = 1';
        sql += ' ORDER BY created_at DESC';
        const rows = await this._all(sql);
        return rows.map(row => this._rowToProduct(row));
    }

    async getProductById(id) {
        const row = await this._get('SELECT * FROM products WHERE id = ?', [id]);
        return row ? this._rowToProduct(row) : null;
    }

    async createProduct(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('prod');
        await this._run(
            'INSERT INTO products (id, name, price, stock, description, image_url, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, data.name, data.price || 0, data.stock || 0, data.description || '', data.imageUrl || '', data.isActive !== false ? 1 : 0, data.createdAt || now]
        );
        return this.getProductById(id);
    }

    async updateProduct(id, updateData) {
        const fields = [];
        const values = [];
        const fieldMap = { name: 'name', price: 'price', stock: 'stock', description: 'description', imageUrl: 'image_url', isActive: 'is_active' };
        for (const [key, dbField] of Object.entries(fieldMap)) {
            if (updateData[key] !== undefined) {
                fields.push(`${dbField} = ?`);
                values.push(key === 'isActive' ? (updateData[key] ? 1 : 0) : updateData[key]);
            }
        }
        if (fields.length === 0) return this.getProductById(id);
        values.push(id);
        await this._run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getProductById(id);
    }

    async deleteProduct(id) {
        await this._run('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
        return true;
    }

    async reduceProductStock(id, quantity = 1) {
        await this._run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [quantity, id, quantity]);
        return this.getProductById(id);
    }

    async increaseProductStock(id, quantity = 1) {
        await this._run('UPDATE products SET stock = stock + ? WHERE id = ?', [quantity, id]);
        return this.getProductById(id);
    }

    _rowToProduct(row) {
        return {
            id: row.id,
            name: row.name,
            price: row.price,
            stock: row.stock,
            description: row.description,
            imageUrl: row.image_url,
            isActive: row.is_active === 1,
            createdAt: row.created_at
        };
    }

    // ==================== 订单操作 ====================

    async getAllOrders(status = null, semesterId = null) {
        let sql = 'SELECT * FROM orders';
        const params = [];
        const conditions = [];
        
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (semesterId) {
            conditions.push('semester_id = ?');
            params.push(semesterId);
        }
        
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        
        sql += ' ORDER BY reserved_at DESC';
        const rows = await this._all(sql, params);
        return rows.map(row => this._rowToOrder(row));
    }

    async getOrderById(id) {
        const row = await this._get('SELECT * FROM orders WHERE id = ?', [id]);
        return row ? this._rowToOrder(row) : null;
    }

    async getOrdersByStudentId(studentId, status = null, semesterId = null) {
        let sql = 'SELECT * FROM orders WHERE student_id = ?';
        const params = [studentId];
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        if (semesterId) {
            sql += ' AND semester_id = ?';
            params.push(semesterId);
        }
        sql += ' ORDER BY reserved_at DESC';
        const rows = await this._all(sql, params);
        return rows.map(row => this._rowToOrder(row));
    }

    async createOrder(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('order');
        await this._run(
            'INSERT INTO orders (id, student_id, semester_id, product_id, status, reserved_at, confirmed_at, cancelled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, data.studentId, data.semesterId, data.productId, data.status || 'pending', data.reservedAt || now, data.confirmedAt || null, data.cancelledAt || null]
        );
        return this.getOrderById(id);
    }

    async updateOrderStatus(id, status, confirmedAt = null, cancelledAt = null) {
        const now = new Date().toISOString();
        if (status === 'confirmed') {
            await this._run('UPDATE orders SET status = ?, confirmed_at = ? WHERE id = ?', [status, confirmedAt || now, id]);
        } else if (status === 'cancelled') {
            await this._run('UPDATE orders SET status = ?, cancelled_at = ? WHERE id = ?', [status, cancelledAt || now, id]);
        } else {
            await this._run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        }
        return this.getOrderById(id);
    }

    _rowToOrder(row) {
        return {
            id: row.id,
            studentId: row.student_id,
            semesterId: row.semester_id,
            productId: row.product_id,
            status: row.status,
            reservedAt: row.reserved_at,
            confirmedAt: row.confirmed_at,
            cancelledAt: row.cancelled_at
        };
    }

    // ==================== 教师操作 ====================

    async getAllTeachers() {
        const rows = await this._all('SELECT * FROM teachers ORDER BY id ASC');
        return rows.map(row => this._rowToTeacher(row));
    }

    async getTeacherById(id) {
        const row = await this._get('SELECT * FROM teachers WHERE id = ?', [id]);
        return row ? this._rowToTeacher(row) : null;
    }

    async createTeacher(data) {
        const now = new Date().toISOString();
        await this._run(
            'INSERT INTO teachers (id, name, password, role, department, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [data.id, data.name, data.password, data.role || 'teacher', data.department || '', data.isActive !== false ? 1 : 0, data.createdAt || now]
        );
        return this.getTeacherById(data.id);
    }

    async updateTeacher(id, updateData) {
        const fields = [];
        const values = [];
        const fieldMap = { name: 'name', password: 'password', role: 'role', department: 'department', isActive: 'is_active' };
        for (const [key, dbField] of Object.entries(fieldMap)) {
            if (updateData[key] !== undefined) {
                fields.push(`${dbField} = ?`);
                values.push(key === 'isActive' ? (updateData[key] ? 1 : 0) : updateData[key]);
            }
        }
        if (fields.length === 0) return this.getTeacherById(id);
        values.push(id);
        await this._run(`UPDATE teachers SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getTeacherById(id);
    }

    async deleteTeacher(id) {
        await this._run('DELETE FROM teachers WHERE id = ?', [id]);
        return true;
    }

    _rowToTeacher(row) {
        return {
            id: row.id,
            name: row.name,
            password: row.password,
            role: row.role,
            department: row.department,
            isActive: row.is_active === 1,
            createdAt: row.created_at
        };
    }

    // ==================== 学期操作 ====================

    async getAllSemesters() {
        const rows = await this._all('SELECT * FROM semesters ORDER BY created_at DESC');
        return rows.map(row => this._rowToSemester(row));
    }

    async getSemesterById(id) {
        const row = await this._get('SELECT * FROM semesters WHERE id = ?', [id]);
        return row ? this._rowToSemester(row) : null;
    }

    async getActiveSemester() {
        const row = await this._get('SELECT * FROM semesters WHERE is_current = 1 LIMIT 1');
        return row ? this._rowToSemester(row) : null;
    }

    async createSemester(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('sem');
        await this._run(
            'INSERT INTO semesters (id, name, start_date, end_date, is_current, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, data.name, data.startDate, data.endDate, data.isCurrent ? 1 : 0, data.createdAt || now]
        );
        return this.getSemesterById(id);
    }

    async updateSemester(id, updateData) {
        const fields = [];
        const values = [];
        const fieldMap = { name: 'name', startDate: 'start_date', endDate: 'end_date', isCurrent: 'is_current' };
        
        for (const [key, dbField] of Object.entries(fieldMap)) {
            if (updateData[key] !== undefined) {
                fields.push(`${dbField} = ?`);
                values.push(key === 'isCurrent' ? (updateData[key] ? 1 : 0) : updateData[key]);
            }
        }
        
        if (fields.length === 0) return this.getSemesterById(id);
        values.push(id);
        await this._run(`UPDATE semesters SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getSemesterById(id);
    }

    async setActiveSemester(id) {
        await this._run('UPDATE semesters SET is_current = 0');
        await this._run('UPDATE semesters SET is_current = 1 WHERE id = ?', [id]);
        return this.getSemesterById(id);
    }

    async archiveStudentPoints(semesterId, studentId, finalBalance, finalRank) {
        const archiveId = this._generateId('arc');
        await this._run(
            'INSERT INTO semester_archives (id, semester_id, student_id, final_balance, final_rank) VALUES (?, ?, ?, ?, ?)',
            [archiveId, semesterId, studentId, finalBalance, finalRank]
        );
        return archiveId;
    }

    async getSemesterArchives(semesterId) {
        const rows = await this._all('SELECT * FROM semester_archives WHERE semester_id = ? ORDER BY final_rank ASC', [semesterId]);
        return rows.map(row => ({
            id: row.id,
            semesterId: row.semester_id,
            studentId: row.student_id,
            finalBalance: row.final_balance,
            finalRank: row.final_rank
        }));
    }

    _rowToSemester(row) {
        return {
            id: row.id,
            name: row.name,
            startDate: row.start_date,
            endDate: row.end_date,
            isCurrent: row.is_current === 1,
            createdAt: row.created_at
        };
    }

    // ==================== 配置操作 ====================

    async getConfig(key, defaultValue = null) {
        const row = await this._get('SELECT value FROM system_config WHERE key = ?', [key]);
        if (!row) return defaultValue;
        try { return JSON.parse(row.value); }
        catch { return row.value; }
    }

    async setConfig(key, value) {
        const now = new Date().toISOString();
        const jsonValue = JSON.stringify(value);
        await this._run(
            'INSERT OR REPLACE INTO system_config (key, value, updated_at) VALUES (?, ?, ?)',
            [key, jsonValue, now]
        );
    }

    async getAllConfig() {
        const rows = await this._all('SELECT key, value FROM system_config');
        const config = {};
        for (const row of rows) {
            try { config[row.key] = JSON.parse(row.value); }
            catch { config[row.key] = row.value; }
        }
        return config;
    }

    // ==================== 班级互动操作 ====================

    /**
     * 查询班级互动列表（支持筛选和分页）
     */
    async getClassInteractions(filters = {}, page = 1, pageSize = 20) {
        const where = [];
        const params = [];

        if (filters.type) {
            where.push('type = ?');
            params.push(filters.type);
        }
        if (filters.status) {
            where.push('status = ?');
            params.push(filters.status);
        }
        if (filters.createdByRole) {
            where.push('created_by_role = ?');
            params.push(filters.createdByRole);
        }
        if (filters.from) {
            where.push('created_at >= ?');
            params.push(filters.from);
        }
        if (filters.to) {
            where.push('created_at <= ?');
            params.push(filters.to);
        }
        if (filters.keyword) {
            where.push('(title LIKE ? OR content LIKE ?)');
            const keyword = `%${filters.keyword}%`;
            params.push(keyword, keyword);
        }

        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const safePage = Math.max(1, parseInt(page, 10) || 1);
        const safePageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
        const offset = (safePage - 1) * safePageSize;

        const rows = await this._all(
            `SELECT * FROM class_interactions ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, safePageSize, offset]
        );

        return rows.map(row => this._rowToClassInteraction(row));
    }

    async countClassInteractions(filters = {}) {
        const where = [];
        const params = [];

        if (filters.type) {
            where.push('type = ?');
            params.push(filters.type);
        }
        if (filters.status) {
            where.push('status = ?');
            params.push(filters.status);
        }
        if (filters.createdByRole) {
            where.push('created_by_role = ?');
            params.push(filters.createdByRole);
        }
        if (filters.from) {
            where.push('created_at >= ?');
            params.push(filters.from);
        }
        if (filters.to) {
            where.push('created_at <= ?');
            params.push(filters.to);
        }
        if (filters.keyword) {
            where.push('(title LIKE ? OR content LIKE ?)');
            const keyword = `%${filters.keyword}%`;
            params.push(keyword, keyword);
        }

        const whereSql = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
        const row = await this._get(`SELECT COUNT(*) as count FROM class_interactions${whereSql}`, params);
        return row ? row.count : 0;
    }

    async getClassInteractionById(id) {
        const row = await this._get('SELECT * FROM class_interactions WHERE id = ?', [id]);
        return row ? this._rowToClassInteraction(row) : null;
    }

    async createClassInteraction(data) {
        const now = new Date().toISOString();
        const id = data.id || this._generateId('interaction');
        await this._run(
            `INSERT INTO class_interactions (
                id, type, status, title, content,
                created_by_role, created_by_id, created_by_name,
                class_action_by, class_action_at, class_action_note,
                teacher_action_by, teacher_action_at, teacher_action_note,
                deadline_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                data.type,
                data.status,
                data.title,
                data.content,
                data.createdByRole,
                data.createdById,
                data.createdByName || '',
                data.classActionBy || null,
                data.classActionAt || null,
                data.classActionNote || null,
                data.teacherActionBy || null,
                data.teacherActionAt || null,
                data.teacherActionNote || null,
                data.deadlineAt || null,
                data.createdAt || now,
                data.updatedAt || now
            ]
        );
        return this.getClassInteractionById(id);
    }

    async updateClassInteraction(id, updateData = {}) {
        const fields = [];
        const values = [];

        const fieldMap = {
            type: 'type',
            status: 'status',
            title: 'title',
            content: 'content',
            createdByRole: 'created_by_role',
            createdById: 'created_by_id',
            createdByName: 'created_by_name',
            classActionBy: 'class_action_by',
            classActionAt: 'class_action_at',
            classActionNote: 'class_action_note',
            teacherActionBy: 'teacher_action_by',
            teacherActionAt: 'teacher_action_at',
            teacherActionNote: 'teacher_action_note',
            deadlineAt: 'deadline_at',
            updatedAt: 'updated_at'
        };

        Object.entries(fieldMap).forEach(([key, dbField]) => {
            if (updateData[key] !== undefined) {
                fields.push(`${dbField} = ?`);
                values.push(updateData[key]);
            }
        });

        // 如果外部没有明确传 updatedAt，这里自动更新时间
        if (updateData.updatedAt === undefined) {
            fields.push('updated_at = ?');
            values.push(new Date().toISOString());
        }

        if (fields.length === 0) {
            return this.getClassInteractionById(id);
        }

        values.push(id);
        await this._run(`UPDATE class_interactions SET ${fields.join(', ')} WHERE id = ?`, values);
        return this.getClassInteractionById(id);
    }

    _rowToClassInteraction(row) {
        return {
            id: row.id,
            type: row.type,
            status: row.status,
            title: row.title,
            content: row.content,
            createdByRole: row.created_by_role,
            createdById: row.created_by_id,
            createdByName: row.created_by_name,
            classActionBy: row.class_action_by,
            classActionAt: row.class_action_at,
            classActionNote: row.class_action_note,
            teacherActionBy: row.teacher_action_by,
            teacherActionAt: row.teacher_action_at,
            teacherActionNote: row.teacher_action_note,
            deadlineAt: row.deadline_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    // ==================== 工具方法 ====================

    _generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getPerformanceMetrics() {
        return { ...this.metrics, cacheSize: 0, queueSize: 0 };
    }

    async getDatabaseStats() {
        return {
            students: await this._count('students'),
            pointRecords: await this._count('point_records'),
            products: await this._count('products'),
            activeProducts: await this._count('products', 'is_active = 1'),
            orders: await this._count('orders'),
            pendingOrders: await this._count('orders', 'status = ?', ['pending']),
            teachers: await this._count('teachers'),
            activeTeachers: await this._count('teachers', 'is_active = 1'),
            semesters: await this._count('semesters'),
            archives: await this._count('semester_archives')
        };
    }

    async createBackup(filename = null) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, filename || `database_${timestamp}.backup`);
        return new Promise((resolve, reject) => {
            const backupDb = new sqlite3.Database(backupPath, (error) => {
                if (error) return reject(error);
                this.db.backup(backupDb, (error) => {
                    if (error) reject(error);
                    else { console.log(`数据库备份成功: ${backupPath}`); resolve(backupPath); }
                    backupDb.close();
                });
            });
        });
    }

    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((error) => {
                    if (error) reject(error);
                    else { this.db = null; this.initialized = false; resolve(); }
                });
            });
        }
    }
}

module.exports = DataAccess;
