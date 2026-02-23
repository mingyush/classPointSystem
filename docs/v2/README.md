# 班级积分管理系统 V2

## 版本概述

V2版本是对原有系统的全面升级，采用现代化技术栈和架构设计，提供更强大的功能和更好的用户体验。

## 主要升级

### 技术栈升级

| 层级 | V1 | V2 |
|------|----|----|
| 前端框架 | 原生JavaScript | Vue 3 + Composition API |
| 构建工具 | 无 | Vite 5.x |
| UI组件库 | 手写CSS | Element Plus |
| 状态管理 | 全局变量 | Pinia |
| 后端语言 | JavaScript | TypeScript |
| 数据库 | JSON文件 | SQLite |
| ORM | 无 | Prisma |

### 新增功能

- **学期管理**: 支持多学期、学期切换、积分结转
- **积分规则引擎**: 可配置的加减分规则
- **统计报表**: 多维度数据分析和可视化
- **操作审计**: 完整的操作日志和回溯
- **数据导入导出**: Excel批量处理

### 性能提升

- SQLite数据库替代JSON文件，查询性能提升10x+
- 前端虚拟滚动，支持大数据量展示
- 排行榜计算优化，支持缓存

## 文档目录

| 文档 | 说明 |
|------|------|
| [requirements.md](./requirements.md) | 完整功能需求规格说明书 |
| [database-design.md](./database-design.md) | 数据库设计(Prisma Schema) |
| [api-design.md](./api-design.md) | RESTful API接口设计 |
| [ui-design.md](./ui-design.md) | UI/UX设计规范 |
| [migration-guide.md](./migration-guide.md) | V1到V2数据迁移指南 |
| [development-plan.md](./development-plan.md) | 开发计划与里程碑 |

## 快速开始

```bash
# 安装依赖
pnpm install

# 初始化数据库
pnpm prisma migrate dev

# 启动开发服务器
pnpm dev
```

## 项目结构

```
classPointSystem-v2/
├── frontend/                    # Vue 3 前端
│   ├── src/
│   │   ├── views/              # 页面组件
│   │   ├── components/         # 通用组件
│   │   ├── stores/             # Pinia状态
│   │   ├── api/                # API封装
│   │   └── utils/              # 工具函数
│   └── vite.config.ts
│
├── backend/                     # Express + TypeScript 后端
│   ├── src/
│   │   ├── routes/             # API路由
│   │   ├── services/           # 业务逻辑
│   │   ├── middleware/         # 中间件
│   │   └── utils/              # 工具函数
│   └── prisma/
│       └── schema.prisma       # 数据库模型
│
├── shared/                      # 共享类型定义
│   └── types/
│
└── docs/v2/                     # V2版本文档
```

## 开发团队

V2版本基于V1版本进行架构升级，保留原有业务逻辑，增强系统性能和可扩展性。
