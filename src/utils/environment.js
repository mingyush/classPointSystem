/**
 * Cloudflare Workers - 环境初始化工具
 */

/**
 * 初始化环境
 */
export async function initializeEnvironment(env) {
  try {
    // 验证必需的环境变量和绑定
    if (!env.DB) {
      throw new Error('D1 数据库绑定缺失');
    }
    
    // 初始化数据库表结构（如果需要）
    await initializeDatabaseTables(env.DB);
    
    // 初始化默认数据（如果需要）
    await initializeDefaultData(env.DB);
    
    console.log('环境初始化完成');
    
  } catch (error) {
    console.error('环境初始化失败:', error);
    throw error;
  }
}

/**
 * 初始化数据库表结构
 */
async function initializeDatabaseTables(db) {
  try {
    // 检查表是否存在
    const tables = await db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('users', 'point_records', 'products', 'orders', 'reward_penalty_items', 'system_state')
    `).all();
    
    const existingTables = tables.results?.map(t => t.name) || [];
    
    // 如果所有表都存在，跳过初始化
    if (existingTables.length >= 6) {
      console.log('数据库表已存在，跳过初始化');
      return;
    }
    
    console.log('开始初始化数据库表...');
    
    // 创建表的SQL语句
    const createTableStatements = [
      // 用户表
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
        student_number TEXT UNIQUE,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 积分记录表
      `CREATE TABLE IF NOT EXISTS point_records (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        teacher_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('manual', 'reward', 'penalty', 'purchase')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id),
        FOREIGN KEY (teacher_id) REFERENCES users(id)
      )`,
      
      // 奖惩项表
      `CREATE TABLE IF NOT EXISTS reward_penalty_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        points INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('reward', 'penalty')),
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 商品表
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL,
        stock INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 订单表
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        total_price INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        confirmed_at DATETIME,
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )`,
      
      // 系统状态表
      `CREATE TABLE IF NOT EXISTS system_state (
        id TEXT PRIMARY KEY DEFAULT 'default',
        mode TEXT DEFAULT 'normal' CHECK (mode IN ('normal', 'class')),
        current_teacher TEXT,
        session_start_time DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];
    
    // 批量执行建表语句
    const statements = createTableStatements.map(sql => db.prepare(sql));
    await db.batch(statements);
    
    console.log('数据库表初始化完成');
    
  } catch (error) {
    console.error('数据库表初始化失败:', error);
    throw error;
  }
}

/**
 * 初始化默认数据
 */
async function initializeDefaultData(db) {
  try {
    // 检查是否已有数据
    const userCount = await db.prepare('SELECT COUNT(*) as count FROM users').first();
    if (userCount?.count > 0) {
      console.log('数据库已有数据，跳过默认数据初始化');
      return;
    }
    
    console.log('开始初始化默认数据...');
    
    // 创建默认管理员
    const defaultAdmin = {
      id: 'admin',
      username: 'admin',
      name: '系统管理员',
      role: 'admin',
      student_number: null,
      is_active: 1
    };
    
    await db.prepare(`
      INSERT INTO users (id, username, name, role, student_number, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      defaultAdmin.id,
      defaultAdmin.username,
      defaultAdmin.name,
      defaultAdmin.role,
      defaultAdmin.student_number,
      defaultAdmin.is_active,
      new Date().toISOString()
    ).run();
    
    // 创建默认教师
    const defaultTeacher = {
      id: 'teacher01',
      username: 'teacher01',
      name: '班主任',
      role: 'teacher',
      student_number: null,
      is_active: 1
    };
    
    await db.prepare(`
      INSERT INTO users (id, username, name, role, student_number, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      defaultTeacher.id,
      defaultTeacher.username,
      defaultTeacher.name,
      defaultTeacher.role,
      defaultTeacher.student_number,
      defaultTeacher.is_active,
      new Date().toISOString()
    ).run();
    
    // 创建默认奖惩项
    const defaultRewardPenaltyItems = [
      { id: 'rp_001', name: '课堂表现优秀', points: 5, type: 'reward', description: '积极回答问题，表现突出' },
      { id: 'rp_002', name: '作业完成优秀', points: 3, type: 'reward', description: '作业质量高，按时完成' },
      { id: 'rp_003', name: '帮助同学', points: 2, type: 'reward', description: '主动帮助同学解决问题' },
      { id: 'rp_004', name: '迟到', points: -2, type: 'penalty', description: '上课迟到' },
      { id: 'rp_005', name: '作业未完成', points: -3, type: 'penalty', description: '未按时完成作业' },
      { id: 'rp_006', name: '课堂违纪', points: -5, type: 'penalty', description: '课堂上违反纪律' }
    ];
    
    for (const item of defaultRewardPenaltyItems) {
      await db.prepare(`
        INSERT INTO reward_penalty_items (id, name, points, type, description, is_active, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        item.id,
        item.name,
        item.points,
        item.type,
        item.description,
        1,
        0,
        new Date().toISOString()
      ).run();
    }
    
    // 创建默认商品
    const defaultProducts = [
      { id: 'prod_001', name: '笔记本', description: '精美笔记本一本', price: 10, stock: 20 },
      { id: 'prod_002', name: '圆珠笔', description: '优质圆珠笔一支', price: 5, stock: 50 },
      { id: 'prod_003', name: '橡皮擦', description: '高质量橡皮擦', price: 3, stock: 30 },
      { id: 'prod_004', name: '书签', description: '精美书签一枚', price: 8, stock: 25 }
    ];
    
    for (const product of defaultProducts) {
      await db.prepare(`
        INSERT INTO products (id, name, description, price, stock, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        product.id,
        product.name,
        product.description,
        product.price,
        product.stock,
        1,
        new Date().toISOString()
      ).run();
    }
    
    // 初始化系统状态
    await db.prepare(`
      INSERT INTO system_state (id, mode, current_teacher, session_start_time, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      'default',
      'normal',
      null,
      null,
      new Date().toISOString()
    ).run();
    
    console.log('默认数据初始化完成');
    
  } catch (error) {
    console.error('默认数据初始化失败:', error);
    throw error;
  }
}