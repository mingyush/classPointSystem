# 班级积分管理系统 Docker 配置
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S classroom-points -u 1001

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY . .

# 创建必要的目录
RUN mkdir -p data logs backups && \
    chown -R classroom-points:nodejs data logs backups

# 设置权限
RUN chown -R classroom-points:nodejs /app

# 切换到非 root 用户
USER classroom-points

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 启动命令
CMD ["node", "server.js"]