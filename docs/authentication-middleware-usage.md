# 认证中间件使用说明

## 概述

班级积分管理系统提供了完整的认证和权限控制中间件，支持学生和教师两种用户类型的身份验证和权限管理。

## 可用的中间件

### 1. authenticateToken
验证JWT令牌的有效性，确保用户已登录。

```javascript
const authRouter = require('./auth');

router.get('/protected-route', authRouter.authenticateToken, (req, res) => {
    // req.user 包含解码后的用户信息
    res.json({
        success: true,
        user: req.user
    });
});
```

### 2. requireTeacher
确保当前用户是教师，必须与 `authenticateToken` 一起使用。

```javascript
router.post('/teacher-only', authRouter.authenticateToken, authRouter.requireTeacher, (req, res) => {
    // 只有教师可以访问此接口
    res.json({
        success: true,
        message: '教师专用接口'
    });
});
```

### 3. requireStudent
确保当前用户是学生，必须与 `authenticateToken` 一起使用。

```javascript
router.get('/student-only', authRouter.authenticateToken, authRouter.requireStudent, (req, res) => {
    // 只有学生可以访问此接口
    res.json({
        success: true,
        message: '学生专用接口'
    });
});
```

## 用户信息结构

认证成功后，`req.user` 对象包含以下信息：

### 学生用户
```javascript
{
    userId: "2024001",      // 学号
    userType: "student",    // 用户类型
    name: "张三",           // 姓名
    class: "初一(1)班",     // 班级
    iat: 1234567890,        // 令牌签发时间
    exp: 1234567890         // 令牌过期时间
}
```

### 教师用户
```javascript
{
    userId: "admin",   // 教师ID
    userType: "teacher",    // 用户类型
    name: "教师",           // 姓名
    iat: 1234567890,        // 令牌签发时间
    exp: 1234567890         // 令牌过期时间
}
```

## 错误响应

### 401 Unauthorized - 令牌缺失
```javascript
{
    success: false,
    message: "访问令牌缺失",
    code: "TOKEN_MISSING"
}
```

### 403 Forbidden - 令牌无效
```javascript
{
    success: false,
    message: "访问令牌无效或已过期",
    code: "TOKEN_INVALID"
}
```

### 403 Forbidden - 权限不足
```javascript
{
    success: false,
    message: "需要教师权限",
    code: "TEACHER_REQUIRED"
}
```

## 使用示例

### 示例1：学生只能查看自己的信息
```javascript
router.get('/students/:id', authRouter.authenticateToken, (req, res) => {
    const { id } = req.params;
    
    // 学生只能查看自己的信息，教师可以查看所有学生信息
    if (req.user.userType === 'student' && req.user.userId !== id) {
        return res.status(403).json({
            success: false,
            message: '学生只能查看自己的信息',
            code: 'ACCESS_DENIED'
        });
    }
    
    // 查询学生信息的逻辑...
});
```

### 示例2：教师专用的积分管理接口
```javascript
router.post('/points/add', authRouter.authenticateToken, authRouter.requireTeacher, (req, res) => {
    const { studentId, points, reason } = req.body;
    
    // 只有教师可以执行加分操作
    // req.user.userId 是操作者的教师ID
    
    // 加分逻辑...
});
```

### 示例3：混合权限控制
```javascript
router.get('/points/history/:studentId', authRouter.authenticateToken, (req, res) => {
    const { studentId } = req.params;
    
    // 教师可以查看任何学生的积分历史
    // 学生只能查看自己的积分历史
    if (req.user.userType === 'student' && req.user.userId !== studentId) {
        return res.status(403).json({
            success: false,
            message: '权限不足',
            code: 'ACCESS_DENIED'
        });
    }
    
    // 查询积分历史的逻辑...
});
```

## 前端使用

### 存储令牌
```javascript
// 登录成功后存储令牌
localStorage.setItem('authToken', response.data.token);
```

### 发送请求时携带令牌
```javascript
// 在请求头中携带令牌
fetch('/api/students', {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
    }
});
```

### 处理认证错误
```javascript
fetch('/api/protected-route', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
})
.then(response => {
    if (response.status === 401 || response.status === 403) {
        // 令牌无效或权限不足，重定向到登录页面
        window.location.href = '/login';
        return;
    }
    return response.json();
})
.then(data => {
    // 处理成功响应
});
```

## 安全注意事项

1. **令牌存储**：前端应将JWT令牌存储在安全的地方（如localStorage），避免XSS攻击。

2. **HTTPS**：生产环境必须使用HTTPS传输，保护令牌不被窃取。

3. **令牌过期**：学生令牌有效期24小时，教师令牌有效期8小时，过期后需要重新登录。

4. **密钥安全**：JWT密钥应通过环境变量设置，不要硬编码在代码中。

5. **权限检查**：除了中间件的基础权限检查，业务逻辑中还应进行细粒度的权限控制。