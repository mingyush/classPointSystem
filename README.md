# 班级积分管理系统

一个简化的积分管理工具，专为中学班级设计。系统在教室大屏上显示学生积分排行榜，教师可通过管理界面进行积分操作，学生可查看个人积分并预约奖品。

> **🤖 AI 驱动项目**: 本系统完全由 AI 编程助手设计和开发，展示了 AI 在全栈 Web 开发中的强大能力。从需求分析到代码实现，从测试编写到文档生成，全程 AI 自动化完成。

## 🎯 功能特点

- **🖥️ 大屏展示**: 实时显示学生积分排行榜，支持教室投影
- **👨‍🏫 教师管理**: 简单直观的积分加减操作界面
- **👨‍🎓 学生查询**: 个人积分查看和奖品预约功能
- **💾 数据持久化**: 基于JSON文件的可靠数据存储
- **⚡ 实时更新**: 使用Server-Sent Events实现实时数据推送
- **🔐 权限控制**: 教师和学生分离的权限管理
- **📊 数据统计**: 总积分、日积分、周积分多维度排行
- **🎁 奖品系统**: 完整的商品预约和兑换流程

## 📸 系统界面展示

### 🏠 系统首页
![系统首页](screenshots/homepage.png)
*系统主页面，提供各功能模块的快速入口*

### 🖥️ 大屏展示模式
<table>
<tr>
<td width="50%">

**平时模式**
![大屏展示-平时模式](screenshots/display-normal-mode.png)
*教室大屏展示积分排行榜，包含总积分、日榜、周榜三个维度*

</td>
<td width="50%">

**上课模式**
![大屏展示-上课模式](screenshots/display-class-mode.png)
*上课模式下的学生积分操作界面，学生按学号排序，方便教师快速操作*

</td>
</tr>
</table>

### 👨‍🏫 教师管理界面
<table>
<tr>
<td width="50%">

**积分管理**
![教师管理-积分管理](screenshots/teacher-points-management.png)
*教师积分管理界面，支持学生搜索、积分加减操作和操作记录查看*

</td>
<td width="50%">

**商品管理**
![教师管理-商品管理](screenshots/teacher-product-management.png)
*商品管理界面，支持添加、编辑、删除奖品商品*

</td>
</tr>
</table>

### 👨‍🎓 学生查询界面
<table>
<tr>
<td width="50%">

**个人中心**
![学生查询-个人中心](screenshots/student-personal-center.png)
*学生个人中心，显示积分余额、排名和操作记录*

</td>
<td width="50%">

**商品浏览**
![学生查询-商品浏览](screenshots/student-product-browse.png)
*学生商品浏览界面，可以查看商品信息并进行预约*

</td>
</tr>
</table>

### 🔐 登录界面 & 📱 移动端适配
<table>
<tr>
<td width="50%">

**教师登录**
![教师登录](screenshots/login-teacher.png)
*教师登录界面，支持教师账号密码认证*

**学生登录**
![学生登录](screenshots/login-student.png)
*学生登录界面，使用学号快速登录*

</td>
<td width="50%">

**移动端界面**
![移动端界面](screenshots/mobile-responsive.png)
*系统支持移动端访问，响应式设计适配各种屏幕尺寸*

</td>
</tr>
</table>

> **📝 截图说明**: 系统支持移动端访问，响应式设计适配各种屏幕尺寸。更多截图详情请查看 **[完整截图展示](docs/SCREENSHOTS.md)**

## 🤖 AI 驱动开发亮点

本系统完全由 **AI 编程助手**开发，展示了现代AI技术在软件开发中的强大能力：

### 🎯 AI 开发特色
- **🧠 智能架构设计**: AI 分析需求并设计了完整的系统架构
- **⚡ 快速代码生成**: 从需求到完整系统，AI 在短时间内完成了所有编码工作
- **🔧 自动化测试**: AI 编写了全面的单元测试、集成测试和性能测试
- **📚 完整文档**: 包括 API 文档、部署指南、用户手册等全部由 AI 生成
- **🛠️ 运维脚本**: 部署、监控、备份等运维脚本均由 AI 自动化生成

### 💡 技术实现亮点
- **智能需求分析**: AI 理解中文需求并转化为技术实现
- **最佳实践应用**: 自动应用行业最佳实践和设计模式
- **错误处理**: 完善的错误处理和用户体验优化
- **性能优化**: 自动优化数据库查询和前端性能
- **安全考虑**: 内置安全机制和权限控制

> **🎉 这是一个展示 AI 编程能力的完整项目案例，证明了 AI 可以独立完成复杂的全栈 Web 应用开发！**

详细了解请查看 **[AI 开发详细说明](docs/AI-DEVELOPMENT.md)**

## 🛠️ 技术栈

- **后端**: Node.js + Express.js
- **前端**: HTML5 + CSS3 + 原生JavaScript
- **数据存储**: JSON文件系统
- **实时通信**: Server-Sent Events (SSE)
- **认证**: JWT Token
- **测试**: Jest + Supertest

## 🚀 快速开始

### 一键启动

```bash
# 下载项目
git clone <repository-url>
cd classroom-points-system

# 一键启动（自动安装依赖并启动服务）
./scripts/start.sh dev

# 验证部署
./scripts/verify-deployment.sh
```

### 访问系统

- **主页**: http://localhost:3000
- **大屏展示**: http://localhost:3000/display
- **教师管理**: http://localhost:3000/teacher  
- **学生查询**: http://localhost:3000/student

### 默认账户

**教师账户**:
- 8001 / 123 (张老师)
- 8002 / 123 (李老师)  
- admin / admin123 (管理员)

**学生账户**: 使用学生学号登录（无需密码）
- 学号范围: 0501-0550
- 班级名称: 花儿起舞

## 📁 项目结构

```
classroom-points-system/
├── 📁 public/                 # 前端静态文件
│   ├── 📁 display/           # 大屏展示界面
│   ├── 📁 teacher/           # 教师管理界面
│   ├── 📁 student/           # 学生查询界面
│   ├── 📁 css/               # 共享样式文件
│   └── 📁 js/                # 共享JavaScript文件
├── 📁 api/                   # 后端API路由
├── 📁 services/              # 业务逻辑服务
├── 📁 middleware/            # 中间件
├── 📁 utils/                 # 工具函数
├── 📁 data/                  # JSON数据文件
├── 📁 tests/                 # 测试文件
├── 📁 scripts/               # 部署和运维脚本
├── 📁 docs/                  # 文档
├── 📁 config/                # 配置文件
└── 📄 server.js             # 主服务器文件
```


## 📚 详细文档

- **[完整截图展示](docs/SCREENSHOTS.md)** - 更多系统界面截图
- **[技术架构](docs/ARCHITECTURE.md)** - 系统架构和技术栈详解
- **[AI开发说明](docs/AI-DEVELOPMENT.md)** - AI驱动开发详情
- **[部署指南](docs/DEPLOYMENT.md)** - 生产环境部署指南
- **[API文档](docs/API.md)** - 完整的接口文档
- **[运维指南](docs/OPERATIONS.md)** - 监控和维护指南
- **[故障排除](docs/TROUBLESHOOTING.md)** - 常见问题解决方案
- **[开发指南](docs/DEVELOPMENT.md)** - 开发环境配置和贡献指南
- **[更新日志](CHANGELOG.md)** - 版本更新记录

## 🤝 贡献指南

### 传统开发贡献
1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 运行测试 (`npm test`)
4. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
5. 推送到分支 (`git push origin feature/AmazingFeature`)
6. 打开 Pull Request

### AI 辅助开发
本项目展示了 AI 编程的完整流程，如果你想了解或参与 AI 驱动的开发：

- **🔍 学习 AI 开发模式**: 研究项目结构和代码组织方式
- **🤖 使用 AI 工具**: 尝试使用 AI 编程助手进行功能扩展
- **📊 分析 AI 代码质量**: 评估 AI 生成代码的质量和最佳实践应用
- **🚀 AI 功能增强**: 使用 AI 添加新功能或优化现有功能

详细指南请查看 **[开发指南](docs/DEVELOPMENT.md)**

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系支持

- 📧 提交 Issue
- 💬 发送邮件至 [mingyu0704@outlook.com]
- 📖 查看文档：`docs/` 目录

---

**🎉 部署完成！系统已准备就绪，开始使用班级积分管理系统吧！**