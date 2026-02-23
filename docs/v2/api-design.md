# 班级积分管理系统 V2 - API接口设计

## 一、API设计规范

### 1.1 基础信息

| 项目 | 说明 |
|------|------|
| 基础路径 | `/api/v1` |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |
| 认证方式 | JWT Bearer Token |

### 1.2 响应格式

**成功响应:**
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**失败响应:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数验证失败",
    "details": [...]
  }
}
```

**分页响应:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 1.3 错误码定义

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| VALIDATION_ERROR | 400 | 参数验证失败 |
| UNAUTHORIZED | 401 | 未登录或Token无效 |
| FORBIDDEN | 403 | 无权限访问 |
| NOT_FOUND | 404 | 资源不存在 |
| CONFLICT | 409 | 资源冲突 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

---

## 二、认证接口

### 2.1 教师登录

```
POST /api/v1/auth/teacher-login
```

**请求体:**
```json
{
  "teacherId": "8001",
  "password": "123456"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "teacher": {
      "id": "8001",
      "name": "张老师",
      "role": "teacher",
      "department": "语文组"
    }
  }
}
```

### 2.2 学生登录

```
POST /api/v1/auth/student-login
```

**请求体:**
```json
{
  "studentId": "0501"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "student": {
      "id": "0501",
      "name": "张三",
      "class": "花儿起舞",
      "balance": 45
    }
  }
}
```

### 2.3 验证Token

```
GET /api/v1/auth/verify
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "userId": "8001",
    "userType": "teacher",
    "name": "张老师",
    "role": "teacher"
  }
}
```

### 2.4 修改密码

```
PUT /api/v1/auth/password
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "oldPassword": "123456",
  "newPassword": "newpass123"
}
```

---

## 三、学期接口

### 3.1 获取学期列表

```
GET /api/v1/semesters
Authorization: Bearer <token>
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页条数，默认20 |
| status | string | 否 | 状态筛选 |

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-xxx",
      "name": "2024-2025第一学期",
      "startDate": "2024-09-01T00:00:00.000Z",
      "endDate": "2025-01-31T00:00:00.000Z",
      "isActive": true,
      "isArchived": false
    }
  ],
  "pagination": {...}
}
```

### 3.2 创建学期

```
POST /api/v1/semesters
Authorization: Bearer <token>
Require: admin
```

**请求体:**
```json
{
  "name": "2024-2025第二学期",
  "startDate": "2025-02-01",
  "endDate": "2025-06-30"
}
```

### 3.3 获取当前学期

```
GET /api/v1/semesters/current
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-xxx",
    "name": "2024-2025第一学期",
    "isActive": true,
    "startDate": "2024-09-01",
    "endDate": "2025-01-31"
  }
}
```

### 3.4 激活学期

```
PUT /api/v1/semesters/:id/activate
Authorization: Bearer <token>
Require: admin
```

**请求体:**
```json
{
  "transferMode": "reset",
  "transferPercentage": 50
}
```

### 3.5 归档学期

```
PUT /api/v1/semesters/:id/archive
Authorization: Bearer <token>
Require: admin
```

### 3.6 学期报告

```
GET /api/v1/semesters/:id/report
Authorization: Bearer <token>
```

---

## 四、学生接口

### 4.1 获取学生列表

```
GET /api/v1/students
Authorization: Bearer <token>
Require: teacher
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页条数 |
| keyword | string | 否 | 搜索关键词 |
| class | string | 否 | 班级筛选 |
| status | string | 否 | 状态筛选 |
| sortBy | string | 否 | 排序字段 |
| sortOrder | string | 否 | asc/desc |

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "0501",
      "name": "张三",
      "class": "花儿起舞",
      "balance": 45,
      "totalBalance": 120,
      "status": "active"
    }
  ],
  "pagination": {...}
}
```

### 4.2 获取学生详情

```
GET /api/v1/students/:id
Authorization: Bearer <token>
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": "0501",
    "name": "张三",
    "class": "花儿起舞",
    "balance": 45,
    "totalBalance": 120,
    "status": "active",
    "rank": {
      "total": 5,
      "daily": 2,
      "weekly": 3
    },
    "stats": {
      "pointsAdded": 150,
      "pointsSubtracted": 15,
      "ordersCount": 3
    }
  }
}
```

### 4.3 创建学生

```
POST /api/v1/students
Authorization: Bearer <token>
Require: admin
```

**请求体:**
```json
{
  "id": "0501",
  "name": "张三",
  "class": "花儿起舞",
  "gender": "M"
}
```

### 4.4 批量导入学生

```
POST /api/v1/students/import
Authorization: Bearer <token>
Require: admin
Content-Type: multipart/form-data
```

**请求体:** FormData with Excel file

**响应:**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "success": 48,
    "failed": 2,
    "errors": [
      { "row": 5, "reason": "学号已存在" },
      { "row": 12, "reason": "姓名不能为空" }
    ]
  }
}
```

### 4.5 更新学生

```
PUT /api/v1/students/:id
Authorization: Bearer <token>
Require: admin
```

### 4.6 删除学生

```
DELETE /api/v1/students/:id
Authorization: Bearer <token>
Require: admin
```

### 4.7 导出学生

```
GET /api/v1/students/export
Authorization: Bearer <token>
Require: teacher
```

---

## 五、积分接口

### 5.1 获取排行榜

```
GET /api/v1/points/rankings
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | total/daily/weekly/monthly，默认total |
| limit | number | 否 | 返回条数，默认20 |
| semesterId | string | 否 | 学期ID，默认当前学期 |

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "studentId": "0503",
      "studentName": "王五",
      "class": "花儿起舞",
      "points": 156,
      "change": 2
    }
  ]
}
```

### 5.2 添加积分

```
POST /api/v1/points/add
Authorization: Bearer <token>
Require: teacher
```

**请求体:**
```json
{
  "studentIds": ["0501", "0503"],
  "points": 5,
  "reason": "课堂表现优秀",
  "category": "学习"
}
```

**响应:**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": "uuid-xxx",
        "studentId": "0501",
        "points": 5,
        "newBalance": 50
      },
      {
        "id": "uuid-xxx",
        "studentId": "0503",
        "points": 5,
        "newBalance": 161
      }
    ]
  }
}
```

### 5.3 扣减积分

```
POST /api/v1/points/subtract
Authorization: Bearer <token>
Require: teacher
```

**请求体:**
```json
{
  "studentIds": ["0501"],
  "points": 2,
  "reason": "迟到",
  "category": "纪律"
}
```

### 5.4 获取积分记录

```
GET /api/v1/points/records
Authorization: Bearer <token>
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| studentId | string | 否 | 学生ID |
| semesterId | string | 否 | 学期ID |
| type | string | 否 | 类型筛选 |
| category | string | 否 | 类别筛选 |
| startDate | string | 否 | 开始日期 |
| endDate | string | 否 | 结束日期 |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页条数 |

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-xxx",
      "studentId": "0501",
      "studentName": "张三",
      "points": 5,
      "reason": "课堂表现优秀",
      "type": "add",
      "category": "学习",
      "operatorId": "8001",
      "operatorName": "张老师",
      "createdAt": "2024-03-15T10:30:00.000Z"
    }
  ],
  "pagination": {...}
}
```

### 5.5 撤销积分操作

```
POST /api/v1/points/records/:id/undo
Authorization: Bearer <token>
Require: teacher
```

### 5.6 获取积分统计

```
GET /api/v1/points/statistics
Authorization: Bearer <token>
Require: teacher
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| semesterId | string | 否 | 学期ID |
| startDate | string | 否 | 开始日期 |
| endDate | string | 否 | 结束日期 |

**响应:**
```json
{
  "success": true,
  "data": {
    "totalStudents": 50,
    "activeStudents": 45,
    "averagePoints": 42.5,
    "maxPoints": 156,
    "minPoints": 5,
    "totalPointsAdded": 2500,
    "totalPointsSubtracted": 375,
    "distribution": [
      { "range": "0-50", "count": 20 },
      { "range": "51-100", "count": 15 },
      { "range": "101-150", "count": 10 },
      { "range": "151+", "count": 5 }
    ],
    "byCategory": [
      { "category": "学习", "count": 150, "totalPoints": 750 },
      { "category": "纪律", "count": 30, "totalPoints": -60 },
      { "category": "活动", "count": 20, "totalPoints": 200 }
    ]
  }
}
```

---

## 六、积分规则接口

### 6.1 获取规则列表

```
GET /api/v1/points/rules
Authorization: Bearer <token>
Require: teacher
```

### 6.2 创建规则

```
POST /api/v1/points/rules
Authorization: Bearer <token>
Require: admin
```

**请求体:**
```json
{
  "name": "课堂积极发言",
  "points": 3,
  "reason": "课堂积极发言",
  "category": "学习",
  "icon": "message"
}
```

### 6.3 更新规则

```
PUT /api/v1/points/rules/:id
Authorization: Bearer <token>
Require: admin
```

### 6.4 删除规则

```
DELETE /api/v1/points/rules/:id
Authorization: Bearer <token>
Require: admin
```

---

## 七、商品接口

### 7.1 获取商品列表

```
GET /api/v1/products
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页条数 |
| category | string | 否 | 分类筛选 |
| isActive | boolean | 否 | 是否上架 |

### 7.2 获取商品详情

```
GET /api/v1/products/:id
```

### 7.3 创建商品

```
POST /api/v1/products
Authorization: Bearer <token>
Require: teacher
```

**请求体:**
```json
{
  "name": "笔记本",
  "price": 50,
  "stock": 20,
  "description": "精美笔记本",
  "category": "文具"
}
```

### 7.4 更新商品

```
PUT /api/v1/products/:id
Authorization: Bearer <token>
Require: teacher
```

### 7.5 删除商品

```
DELETE /api/v1/products/:id
Authorization: Bearer <token>
Require: teacher
```

---

## 八、订单接口

### 8.1 获取订单列表

```
GET /api/v1/orders
Authorization: Bearer <token>
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态筛选 |
| studentId | string | 否 | 学生ID |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页条数 |

### 8.2 创建预约

```
POST /api/v1/orders
Authorization: Bearer <token>
Require: student
```

**请求体:**
```json
{
  "productId": "uuid-xxx"
}
```

### 8.3 取消预约

```
PUT /api/v1/orders/:id/cancel
Authorization: Bearer <token>
```

**请求体:**
```json
{
  "reason": "不想兑换了"
}
```

### 8.4 确认订单

```
PUT /api/v1/orders/:id/confirm
Authorization: Bearer <token>
Require: teacher
```

### 8.5 拒绝订单

```
PUT /api/v1/orders/:id/reject
Authorization: Bearer <token>
Require: teacher
```

**请求体:**
```json
{
  "reason": "库存不足"
}
```

### 8.6 批量确认

```
PUT /api/v1/orders/batch-confirm
Authorization: Bearer <token>
Require: teacher
```

**请求体:**
```json
{
  "orderIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

---

## 九、教师接口

### 9.1 获取教师列表

```
GET /api/v1/teachers
Authorization: Bearer <token>
Require: admin
```

### 9.2 创建教师

```
POST /api/v1/teachers
Authorization: Bearer <token>
Require: admin
```

**请求体:**
```json
{
  "id": "8003",
  "name": "王老师",
  "password": "123456",
  "role": "teacher",
  "department": "数学组"
}
```

### 9.3 更新教师

```
PUT /api/v1/teachers/:id
Authorization: Bearer <token>
Require: admin
```

### 9.4 重置密码

```
PUT /api/v1/teachers/:id/reset-password
Authorization: Bearer <token>
Require: admin
```

### 9.5 禁用/启用教师

```
PUT /api/v1/teachers/:id/toggle
Authorization: Bearer <token>
Require: admin
```

---

## 十、系统接口

### 10.1 获取系统配置

```
GET /api/v1/system/config
Authorization: Bearer <token>
Require: admin
```

### 10.2 更新系统配置

```
PUT /api/v1/system/config
Authorization: Bearer <token>
Require: admin
```

**请求体:**
```json
{
  "maxPointsPerOperation": 100,
  "autoRefreshInterval": 30
}
```

### 10.3 获取操作日志

```
GET /api/v1/system/logs
Authorization: Bearer <token>
Require: admin
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| module | string | 否 | 模块筛选 |
| operatorId | string | 否 | 操作者ID |
| startDate | string | 否 | 开始日期 |
| endDate | string | 否 | 结束日期 |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页条数 |

### 10.4 获取健康状态

```
GET /api/v1/system/health
```

**响应:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "2.0.0",
    "uptime": 86400,
    "database": "connected",
    "semester": {
      "id": "uuid-xxx",
      "name": "2024-2025第一学期"
    }
  }
}
```

### 10.5 数据备份

```
POST /api/v1/system/backup
Authorization: Bearer <token>
Require: admin
```

### 10.6 数据恢复

```
POST /api/v1/system/restore
Authorization: Bearer <token>
Require: admin
Content-Type: multipart/form-data
```

---

## 十一、SSE实时推送

### 11.1 连接SSE

```
GET /api/v1/sse
```

**响应:** Server-Sent Events流

### 11.2 事件类型

| 事件 | 数据 | 说明 |
|------|------|------|
| points_updated | { studentId, newBalance } | 积分变更 |
| ranking_updated | { type, rankings } | 排行榜更新 |
| order_created | { order } | 新订单 |
| order_updated | { order } | 订单状态变更 |
| system_config_updated | { config } | 配置变更 |

---

## 十二、API权限矩阵

| 接口 | 管理员 | 教师 | 学生 |
|------|--------|------|------|
| 认证接口 | ✓ | ✓ | ✓ |
| 学期CRUD | ✓ | - | - |
| 学期查询 | ✓ | ✓ | - |
| 学生CRUD | ✓ | - | - |
| 学生查询 | ✓ | ✓ | 自己 |
| 积分操作 | ✓ | ✓ | - |
| 积分查询 | ✓ | ✓ | 自己 |
| 商品CRUD | ✓ | ✓ | - |
| 商品查询 | ✓ | ✓ | ✓ |
| 订单确认 | ✓ | ✓ | - |
| 订单创建/取消 | - | - | ✓ |
| 订单查询 | ✓ | ✓ | 自己 |
| 教师管理 | ✓ | - | - |
| 系统配置 | ✓ | - | - |
| 操作日志 | ✓ | - | - |
