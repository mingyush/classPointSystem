# 班级积分系统

一个简洁高效的单班级积分管理工具，支持本地部署和云端部署两种方式。专为中学班级设计，提供教室大屏展示和管理后台两个独立入口。

> **🤖 AI 驱动项目**: 本系统完全由 AI 编程助手设计和开发，展示了 AI 在全栈 Web 开发中的强大能力。从需求分析到代码实现，从测试编写到文档生成，全程 AI 自动化完成。

## 🎯 功能特点

- **🖥️ 双模式大屏**: 平时模式显示排行榜，上课模式支持快速积分操作
- **👨‍🏫 权限分离**: 班主任完整权限，任课老师只能操作积分
- **👨‍🎓 学生查询**: 学号登录查看个人积分和排名
- **💾 双数据库支持**: 本地SQLite + 云端Cloudflare D1
- **⚡ 实时同步**: 数据变更实时更新到大屏
- **🔐 自动切换**: 上课模式2小时后自动切换回平时模式
- **📊 多维排行**: 总积分、日积分、周积分排行榜
- **🎁 预约系统**: 简化的商品兑换预约流程
- **⚙️ 奖惩项**: 预设常用奖惩项，支持一键操作

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

> **🎉 这是一个展示 AI 编程能力的完整项目案例，证明了 AI 可以独立完成复杂的全栈 Web 应用开发！**

详细了解请查看 **[AI 开发详细说明](docs/AI-DEVELOPMENT.md)**

## 🛠️ 技术栈

### 本地部署
- **后端**: Node.js + Express.js
- **前端**: HTML5 + CSS3 + 原生JavaScript
- **数据存储**: SQLite 数据库
- **实时通信**: Server-Sent Events (SSE)
- **认证**: Session-based
- **测试**: Jest + Supertest

### Cloudflare部署
- **后端**: Cloudflare Workers
- **前端**: Cloudflare Pages
- **数据存储**: Cloudflare D1 数据库
- **会话存储**: Cloudflare KV
- **全球CDN**: Cloudflare网络

## 🚀 快速开始

### 本地部署

```bash
# 下载项目
git clone <repository-url>
cd classroom-points-system

# 安装依赖
npm install

# 启动服务
npm start

# 验证部署
./scripts/verify-deployment.sh
```

### Cloudflare部署

```bash
# 安装Wrangler CLI
npm install -g wrangler
wrangler login

# 创建D1数据库
npm run cf:d1:create

# 初始化数据库
npm run cf:d1:init

# 部署应用
npm run deploy:cf
```

### 访问系统

- **教室大屏**: http://localhost:3000/display
- **管理后台**: http://localhost:3000/admin

### 默认账户

**班主任账户**: admin / admin123 (完整权限)
**任课老师账户**: teacher / 123456 (仅积分操作)
**学生查询**: 使用学号登录（无需密码）

## 📁 项目结构

```
classroom-points-system/
├── 📁 public/                 # 前端静态文件
│   ├── 📁 display/           # 教室大屏界面
│   ├── 📁 admin/             # 管理后台界面（新）
│   ├── 📁 css/               # 共享样式文件
│   └── 📁 js/                # 共享JavaScript文件
├── 📁 api/                   # 后端API路由
├── 📁 services/              # 业务逻辑服务
├── 📁 adapters/              # 数据库适配器（新）
│   ├── 📄 sqliteStorageAdapter.js    # SQLite适配器
│   ├── 📄 d1StorageAdapter.js        # Cloudflare D1适配器
│   └── 📄 storageAdapterFactory.js   # 适配器工厂
├── 📁 middleware/            # 中间件
├── 📁 utils/                 # 工具函数
├── 📁 data/                  # SQLite数据库文件
│   └── 📄 classroom_points.db   # 主数据库文件
├── 📁 sql/                   # 数据库脚本（新）
│   ├── 📄 init_standalone.sql          # 建表语句
│   ├── 📄 seed.sql          # 初始数据
│   └── 📄 d1_schema.sql     # D1专用脚本
├── 📁 src/                   # Cloudflare Workers源码（新）
│   ├── 📄 worker.js         # Workers入口
│   ├── 📁 handlers/         # 请求处理器
│   └── 📁 utils/            # Workers工具函数
├── 📁 tests/                 # 测试文件
├── 📁 scripts/               # 部署和运维脚本
├── 📁 docs/                  # 文档
│   ├── 📄 deployment.md             # 部署指南
│   ├── 📄 deployment-v1-cloudflare.md # Cloudflare部署指南
│   └── 📄 operation.md              # 操作指南
├── 📁 config/                # 配置文件
│   ├── 📄 config.json       # 基础配置
│   ├── 📄 development.json  # 开发环境配置
│   └── 📄 production.json   # 生产环境配置
├── 📄 server.js             # 本地部署服务器
├── 📄 wrangler.toml         # Cloudflare配置（新）
└── 📄 ecosystem.config.js   # PM2配置
```

## 🤝 贡献指南

### AI 辅助开发
本项目展示了 AI 编程的完整流程，如果你想了解或参与 AI 驱动的开发：

- **🔍 学习 AI 开发模式**: 研究项目结构和代码组织方式
- **🤖 使用 AI 工具**: 尝试使用 AI 编程助手进行功能扩展
- **📊 分析 AI 代码质量**: 评估 AI 生成代码的质量和最佳实践应用
- **🚀 AI 功能增强**: 使用 AI 添加新功能或优化现有功能

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系支持

- 📧 提交 Issue
- 💬 发送邮件至 [mingyu0704@outlook.com]
- 📖 查看文档：`docs/` 目录

---

**🎉 部署完成！系统已准备就绪，开始使用班级积分管理系统吧！**