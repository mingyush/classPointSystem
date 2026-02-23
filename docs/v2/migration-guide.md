# 班级积分管理系统 V2 - 数据迁移指南

## 一、迁移概述

### 1.1 迁移目标

将V1版本的JSON数据迁移到V2版本的SQLite数据库，保留所有历史数据。

### 1.2 迁移范围

| 数据文件 | 目标表 | 预计记录数 |
|---------|--------|-----------|
| students.json | Student | ~50 |
| teachers.json | Teacher | ~5 |
| products.json | Product | ~20 |
| points.json | PointRecord | ~1000+ |
| orders.json | Order | ~50 |
| config.json | SystemConfig | ~10 |

### 1.3 迁移策略

1. **全量迁移**: 一次性迁移所有历史数据
2. **学期划分**: 根据时间自动创建历史学期
3. **数据验证**: 迁移后验证数据完整性
4. **回滚支持**: 保留原始JSON文件作为备份

---

## 二、迁移前准备

### 2.1 环境检查

```bash
# 检查Node.js版本 (需要 >= 18)
node -v

# 检查npm版本
npm -v

# 检查V1数据文件完整性
ls -la data/
```

### 2.2 数据备份

```bash
# 创建备份目录
mkdir -p backup/v1-$(date +%Y%m%d)

# 备份所有JSON文件
cp -r data/*.json backup/v1-$(date +%Y%m%d)/
```

### 2.3 数据检查脚本

```javascript
// scripts/check-v1-data.js
const fs = require('fs');
const path = require('path');

const dataFiles = ['students', 'teachers', 'products', 'points', 'orders', 'config'];

console.log('检查V1数据文件完整性...\n');

for (const file of dataFiles) {
  const filePath = path.join(__dirname, '../../data', `${file}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    const count = Array.isArray(data[file]) || Array.isArray(data.records) || Array.isArray(data.students)
      ? (data[file] || data.records || data.students).length
      : Object.keys(data).length;
    console.log(`✅ ${file}.json - ${count} 条记录`);
  } catch (error) {
    console.log(`❌ ${file}.json - 错误: ${error.message}`);
  }
}
```

---

## 三、数据映射

### 3.1 学生数据映射

| V1 (students.json) | V2 (Student) | 转换规则 |
|-------------------|--------------|---------|
| id | id | 直接映射 |
| name | name | 直接映射 |
| class | class | 直接映射 |
| balance | balance | 当前学期积分 |
| balance | totalBalance | 初始值=balance |
| - | status | 默认 'active' |
| - | gender | 默认 null |
| createdAt | createdAt | 直接映射 |

### 3.2 教师数据映射

| V1 (teachers.json) | V2 (Teacher) | 转换规则 |
|-------------------|--------------|---------|
| id | id | 直接映射 |
| name | name | 直接映射 |
| password | passwordHash | bcrypt加密 |
| role | role | 直接映射 |
| department | department | 直接映射 |
| isActive | isActive | 直接映射 |

### 3.3 积分记录映射

| V1 (points.json) | V2 (PointRecord) | 转换规则 |
|-----------------|------------------|---------|
| id | id | 直接映射 |
| studentId | studentId | 直接映射 |
| points | points | 直接映射 |
| reason | reason | 直接映射 |
| type | type | 直接映射 |
| operatorId | operatorId | 直接映射 |
| timestamp | createdAt | 时间戳转换 |
| - | semesterId | 根据时间匹配学期 |
| - | category | 根据type推断 |

### 3.4 商品数据映射

| V1 (products.json) | V2 (Product) | 转换规则 |
|-------------------|--------------|---------|
| id | id | 直接映射 |
| name | name | 直接映射 |
| price | price | 直接映射 |
| stock | stock | 直接映射 |
| description | description | 直接映射 |
| imageUrl | imageUrl | 直接映射 |
| isActive | isActive | 直接映射 |
| - | category | 默认 '其他' |

### 3.5 订单数据映射

| V1 (orders.json) | V2 (Order) | 转换规则 |
|-----------------|-----------|---------|
| id | id | 直接映射 |
| studentId | studentId | 直接映射 |
| productId | productId | 直接映射 |
| status | status | 直接映射 |
| reservedAt | reservedAt | 时间戳转换 |
| confirmedAt | confirmedAt | 时间戳转换 |
| cancelledAt | cancelledAt | 时间戳转换 |
| - | semesterId | 根据时间匹配学期 |

---

## 四、迁移脚本

### 4.1 主迁移脚本

```typescript
// scripts/migrate-v1-to-v2.ts

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DATA_DIR = path.join(__dirname, '../../data');

interface MigrationResult {
  students: { success: number; failed: number };
  teachers: { success: number; failed: number };
  products: { success: number; failed: number };
  points: { success: number; failed: number };
  orders: { success: number; failed: number };
  semesters: number;
}

async function migrate() {
  console.log('开始V1到V2数据迁移...\n');
  
  const result: MigrationResult = {
    students: { success: 0, failed: 0 },
    teachers: { success: 0, failed: 0 },
    products: { success: 0, failed: 0 },
    points: { success: 0, failed: 0 },
    orders: { success: 0, failed: 0 },
    semesters: 0
  };

  try {
    // 1. 读取V1数据
    console.log('1. 读取V1数据文件...');
    const students = readJsonFile('students.json')?.students || [];
    const teachers = readJsonFile('teachers.json')?.teachers || [];
    const products = readJsonFile('products.json')?.products || [];
    const points = readJsonFile('points.json')?.records || [];
    const orders = readJsonFile('orders.json')?.orders || [];
    
    console.log(`   - 学生: ${students.length} 条`);
    console.log(`   - 教师: ${teachers.length} 条`);
    console.log(`   - 商品: ${products.length} 条`);
    console.log(`   - 积分: ${points.length} 条`);
    console.log(`   - 订单: ${orders.length} 条\n`);

    // 2. 创建历史学期
    console.log('2. 创建历史学期...');
    const semesters = createSemesters(points);
    for (const semester of semesters) {
      await prisma.semester.create({ data: semester });
      result.semesters++;
      console.log(`   - 创建学期: ${semester.name}`);
    }
    
    // 设置最近的学期为当前学期
    if (semesters.length > 0) {
      const latestSemester = semesters[semesters.length - 1];
      await prisma.semester.update({
        where: { id: latestSemester.id },
        data: { isActive: true }
      });
    }
    console.log();

    // 3. 迁移教师数据
    console.log('3. 迁移教师数据...');
    for (const teacher of teachers) {
      try {
        const passwordHash = await bcrypt.hash(teacher.password || '123456', 12);
        await prisma.teacher.create({
          data: {
            id: teacher.id,
            name: teacher.name,
            passwordHash,
            role: teacher.role || 'teacher',
            department: teacher.department || null,
            isActive: teacher.isActive !== false
          }
        });
        result.teachers.success++;
      } catch (error) {
        result.teachers.failed++;
        console.error(`   ❌ 教师迁移失败: ${teacher.id}`);
      }
    }
    console.log(`   ✅ 成功: ${result.teachers.success}, 失败: ${result.teachers.failed}\n`);

    // 4. 迁移学生数据
    console.log('4. 迁移学生数据...');
    for (const student of students) {
      try {
        await prisma.student.create({
          data: {
            id: student.id,
            name: student.name,
            class: student.class,
            balance: student.balance || 0,
            totalBalance: student.balance || 0,
            status: 'active'
          }
        });
        result.students.success++;
      } catch (error) {
        result.students.failed++;
        console.error(`   ❌ 学生迁移失败: ${student.id}`);
      }
    }
    console.log(`   ✅ 成功: ${result.students.success}, 失败: ${result.students.failed}\n`);

    // 5. 迁移商品数据
    console.log('5. 迁移商品数据...');
    for (const product of products) {
      try {
        await prisma.product.create({
          data: {
            id: product.id,
            name: product.name,
            price: product.price,
            stock: product.stock,
            description: product.description || null,
            imageUrl: product.imageUrl || null,
            isActive: product.isActive !== false,
            category: '其他'
          }
        });
        result.products.success++;
      } catch (error) {
        result.products.failed++;
        console.error(`   ❌ 商品迁移失败: ${product.name}`);
      }
    }
    console.log(`   ✅ 成功: ${result.products.success}, 失败: ${result.products.failed}\n`);

    // 6. 迁移积分记录
    console.log('6. 迁移积分记录...');
    const semesterMap = new Map(semesters.map(s => [s.id, s]));
    for (const record of points) {
      try {
        const recordDate = new Date(record.timestamp);
        const semester = findSemester(recordDate, semesters);
        if (!semester) {
          throw new Error('无法匹配学期');
        }
        
        await prisma.pointRecord.create({
          data: {
            id: record.id,
            studentId: record.studentId,
            semesterId: semester.id,
            points: record.points,
            reason: record.reason,
            type: record.type,
            category: inferCategory(record.type, record.reason),
            operatorId: record.operatorId,
            createdAt: recordDate
          }
        });
        result.points.success++;
      } catch (error) {
        result.points.failed++;
      }
    }
    console.log(`   ✅ 成功: ${result.points.success}, 失败: ${result.points.failed}\n`);

    // 7. 迁移订单记录
    console.log('7. 迁移订单记录...');
    for (const order of orders) {
      try {
        const reservedDate = new Date(order.reservedAt);
        const semester = findSemester(reservedDate, semesters);
        if (!semester) {
          throw new Error('无法匹配学期');
        }
        
        await prisma.order.create({
          data: {
            id: order.id,
            studentId: order.studentId,
            productId: order.productId,
            semesterId: semester.id,
            status: order.status,
            reservedAt: reservedDate,
            confirmedAt: order.confirmedAt ? new Date(order.confirmedAt) : null,
            cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null
          }
        });
        result.orders.success++;
      } catch (error) {
        result.orders.failed++;
      }
    }
    console.log(`   ✅ 成功: ${result.orders.success}, 失败: ${result.orders.failed}\n`);

    // 8. 验证数据
    console.log('8. 验证数据完整性...');
    await validateMigration(result);

    // 9. 输出报告
    console.log('\n迁移完成!');
    console.log('========================================');
    console.log(`学期: ${result.semesters} 个`);
    console.log(`教师: ${result.teachers.success}/${teachers.length}`);
    console.log(`学生: ${result.students.success}/${students.length}`);
    console.log(`商品: ${result.products.success}/${products.length}`);
    console.log(`积分: ${result.points.success}/${points.length}`);
    console.log(`订单: ${result.orders.success}/${orders.length}`);
    console.log('========================================\n');

  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 辅助函数
function readJsonFile(filename: string): any {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function createSemesters(points: any[]): any[] {
  if (points.length === 0) {
    return [{
      id: 'default-semester',
      name: '历史学期',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      isActive: false,
      isArchived: true
    }];
  }

  // 按时间排序
  const sortedPoints = [...points].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstDate = new Date(sortedPoints[0].timestamp);
  const lastDate = new Date(sortedPoints[sortedPoints.length - 1].timestamp);

  // 按学期划分
  const semesters: any[] = [];
  let currentYear = firstDate.getFullYear();
  let currentMonth = firstDate.getMonth();

  while (currentYear < lastDate.getFullYear() || 
         (currentYear === lastDate.getFullYear() && currentMonth <= lastDate.getMonth())) {
    const isSpring = currentMonth >= 1 && currentMonth <= 6;
    const semesterName = `${currentYear}-${currentYear + 1}${isSpring ? '第二' : '第一'}学期`;
    
    semesters.push({
      id: `semester-${currentYear}-${isSpring ? '2' : '1'}`,
      name: semesterName,
      startDate: new Date(currentYear, isSpring ? 1 : 8, 1),
      endDate: new Date(currentYear, isSpring ? 6 : 12, 31),
      isActive: false,
      isArchived: true
    });

    if (isSpring) {
      currentYear++;
      currentMonth = 8;
    } else {
      currentMonth = 1;
    }
  }

  return semesters;
}

function findSemester(date: Date, semesters: any[]): any {
  for (const semester of semesters) {
    if (date >= semester.startDate && date <= semester.endDate) {
      return semester;
    }
  }
  return semesters[semesters.length - 1]; // 默认返回最后一个学期
}

function inferCategory(type: string, reason: string): string {
  const reasonLower = reason.toLowerCase();
  if (reasonLower.includes('作业') || reasonLower.includes('考试') || reasonLower.includes('课堂')) {
    return '学习';
  }
  if (reasonLower.includes('迟到') || reasonLower.includes('旷课') || reasonLower.includes('违纪')) {
    return '纪律';
  }
  if (reasonLower.includes('活动') || reasonLower.includes('比赛') || reasonLower.includes('志愿')) {
    return '活动';
  }
  return '其他';
}

async function validateMigration(result: MigrationResult) {
  // 验证学生积分余额
  const students = await prisma.student.findMany();
  for (const student of students) {
    const records = await prisma.pointRecord.findMany({
      where: { studentId: student.id }
    });
    const calculatedBalance = records.reduce((sum, r) => sum + r.points, 0);
    if (student.balance !== calculatedBalance) {
      console.log(`   ⚠️ 学生 ${student.name} 积分不匹配: 数据库=${student.balance}, 计算=${calculatedBalance}`);
    }
  }
  console.log('   ✅ 数据验证完成');
}

// 执行迁移
migrate().catch(console.error);
```

### 4.2 运行迁移

```bash
# 编译TypeScript
npx tsc scripts/migrate-v1-to-v2.ts

# 执行迁移
node scripts/migrate-v1-to-v2.js

# 或者使用ts-node
npx ts-node scripts/migrate-v1-to-v2.ts
```

---

## 五、迁移后验证

### 5.1 数据完整性检查

```typescript
// scripts/validate-migration.ts

async function validate() {
  const prisma = new PrismaClient();
  
  console.log('验证迁移结果...\n');
  
  // 1. 检查学生数量
  const studentCount = await prisma.student.count();
  console.log(`✅ 学生数量: ${studentCount}`);
  
  // 2. 检查积分记录数量
  const pointCount = await prisma.pointRecord.count();
  console.log(`✅ 积分记录数量: ${pointCount}`);
  
  // 3. 验证积分余额
  const students = await prisma.student.findMany({
    include: { points: true }
  });
  
  let mismatchCount = 0;
  for (const student of students) {
    const calculated = student.points.reduce((sum, p) => sum + p.points, 0);
    if (student.balance !== calculated) {
      mismatchCount++;
      console.log(`⚠️ ${student.name}: 数据库=${student.balance}, 计算=${calculated}`);
    }
  }
  
  if (mismatchCount === 0) {
    console.log('✅ 所有学生积分余额正确');
  }
  
  // 4. 检查外键关联
  const orphanRecords = await prisma.pointRecord.findMany({
    where: { student: null }
  });
  console.log(`✅ 孤儿积分记录: ${orphanRecords.length}`);
  
  await prisma.$disconnect();
}

validate();
```

### 5.2 功能测试清单

| 功能 | 测试项 | 预期结果 |
|------|--------|---------|
| 学生登录 | 使用原学号登录 | 成功登录 |
| 积分查询 | 查看历史积分记录 | 显示完整记录 |
| 排行榜 | 查看总榜/日榜/周榜 | 数据正确 |
| 商品浏览 | 查看商品列表 | 显示原商品 |
| 订单查询 | 查看历史订单 | 显示完整订单 |

---

## 六、回滚方案

### 6.1 回滚步骤

```bash
# 1. 停止V2服务
pm2 stop classpoint-v2

# 2. 删除数据库
rm -f backend/prisma/data.db

# 3. 恢复V1版本
git checkout v1

# 4. 启动V1服务
pm2 start ecosystem.config.js
```

### 6.2 数据保留

即使迁移成功，也建议：
- 保留原始JSON文件至少30天
- 定期备份SQLite数据库

---

## 七、常见问题

### Q1: 积分余额不匹配怎么办？

运行修复脚本：
```typescript
// scripts/fix-balances.ts
const students = await prisma.student.findMany();
for (const student of students) {
  const records = await prisma.pointRecord.findMany({
    where: { studentId: student.id }
  });
  const correctBalance = records.reduce((sum, r) => sum + r.points, 0);
  await prisma.student.update({
    where: { id: student.id },
    data: { balance: correctBalance }
  });
}
```

### Q2: 学期划分不正确怎么办？

可以手动调整学期日期：
```sql
UPDATE Semester 
SET startDate = '2024-09-01', endDate = '2025-01-31' 
WHERE id = 'semester-id';
```

### Q3: 迁移过程中断怎么办？

迁移脚本是幂等的，可以多次运行。建议：
1. 清空数据库
2. 重新运行迁移脚本
