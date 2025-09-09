# 截图说明

本目录用于存放系统功能截图，以下是需要添加的截图文件：

## 📋 截图清单

### 必需截图文件

1. **homepage.png** - 系统首页
   - 访问: http://localhost:3000
   - 展示: 主页面布局，各功能模块入口

2. **display-normal-mode.png** - 大屏展示平时模式
   - 访问: http://localhost:3000/display
   - 展示: 积分排行榜（总积分、日榜、周榜）

3. **display-class-mode.png** - 大屏展示上课模式
   - 访问: http://localhost:3000/display (需要教师登录后切换模式)
   - 展示: 学生积分操作界面，按学号排序

4. **teacher-points-management.png** - 教师积分管理
   - 访问: http://localhost:3000/teacher (积分管理标签页)
   - 展示: 学生列表、积分操作表单、操作记录

5. **teacher-product-management.png** - 教师商品管理
   - 访问: http://localhost:3000/teacher (商品管理标签页)
   - 展示: 商品列表、添加/编辑商品表单

6. **teacher-order-management.png** - 教师预约管理
   - 访问: http://localhost:3000/teacher (预约管理标签页)
   - 展示: 待确认订单列表、订单操作

7. **teacher-system-settings.png** - 教师系统设置
   - 访问: http://localhost:3000/teacher (系统设置标签页)
   - 展示: 系统配置、数据管理、备份功能

8. **student-personal-center.png** - 学生个人中心
   - 访问: http://localhost:3000/student (登录后)
   - 展示: 积分余额、排名、操作记录

9. **student-product-browse.png** - 学生商品浏览
   - 访问: http://localhost:3000/student (商品浏览页面)
   - 展示: 商品列表、预约功能

10. **login-interface.png** - 登录界面
    - 访问: 任意需要登录的页面
    - 展示: 教师/学生登录表单

11. **mobile-responsive.png** - 移动端界面
    - 使用浏览器开发者工具切换到移动端视图
    - 展示: 响应式设计效果

## 📐 截图规范

### 尺寸要求
- **桌面端截图**: 1920x1080 或 1366x768
- **移动端截图**: 375x667 (iPhone SE) 或 414x896 (iPhone XR)

### 质量要求
- 格式: PNG (推荐) 或 JPG
- 分辨率: 高清，文字清晰可读
- 文件大小: 单个文件不超过 2MB

### 内容要求
- 包含有意义的测试数据
- 界面完整，无遮挡或截断
- 展示核心功能和特色
- 避免包含敏感信息

## 🚀 快速截图指南

### 1. 启动系统
```bash
npm start
```

### 2. 准备测试数据
- 确保有学生数据 (data/students.json)
- 添加一些积分记录
- 创建测试商品
- 生成预约订单

### 3. 截图步骤
1. 打开浏览器访问对应页面
2. 使用浏览器截图工具或系统截图功能
3. 保存为对应的文件名
4. 放置在 screenshots/ 目录下

### 4. 验证截图
- 检查文件名是否正确
- 确认图片清晰度
- 验证功能展示完整

## 🔧 截图工具推荐

### 浏览器工具
- Chrome DevTools 截图功能
- Firefox 开发者工具
- Edge 开发者工具

### 系统工具
- **macOS**: Cmd + Shift + 4
- **Windows**: Win + Shift + S
- **Linux**: gnome-screenshot

### 第三方工具
- Snagit
- LightShot
- Greenshot

## 📝 更新说明

截图添加完成后，请确保：
1. 所有文件名与 README.md 中的引用一致
2. 图片能正常显示
3. 文件大小合理
4. 展示效果良好

如需更新截图，请替换对应文件并保持文件名不变。