#!/bin/bash

# 班级积分管理系统启动脚本
# 使用方法: ./scripts/start.sh [dev|prod]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 切换到项目目录
cd "$PROJECT_DIR"

# 检查参数
MODE=${1:-dev}
if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
    log_error "无效的模式参数。使用方法: $0 [dev|prod]"
    exit 1
fi

log_info "启动班级积分管理系统 (模式: $MODE)"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js 未安装。请先安装 Node.js 14.0.0 或更高版本。"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="14.0.0"

if ! node -e "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION') ? 0 : 1)" 2>/dev/null; then
    log_error "Node.js 版本过低。当前版本: $NODE_VERSION，要求版本: $REQUIRED_VERSION 或更高。"
    exit 1
fi

log_success "Node.js 版本检查通过: $NODE_VERSION"

# 检查依赖
if [ ! -d "node_modules" ]; then
    log_info "安装项目依赖..."
    if [[ "$MODE" == "prod" ]]; then
        npm install --production
    else
        npm install
    fi
    log_success "依赖安装完成"
else
    log_info "依赖已存在，跳过安装"
fi

# 创建必要的目录
log_info "创建必要的目录..."
mkdir -p data logs backups
log_success "目录创建完成"

# 检查配置文件
if [[ "$MODE" == "prod" ]]; then
    CONFIG_FILE="config/production.json"
    if [ ! -f "$CONFIG_FILE" ]; then
        log_error "生产环境配置文件不存在: $CONFIG_FILE"
        exit 1
    fi
    
    # 检查关键配置
    JWT_SECRET=$(node -e "console.log(require('./$CONFIG_FILE').security.jwtSecret)" 2>/dev/null || echo "")
    if [[ "$JWT_SECRET" == "CHANGE_THIS_IN_PRODUCTION_ENVIRONMENT" ]]; then
        log_error "请修改生产环境配置中的 JWT 密钥！"
        exit 1
    fi
    
    log_success "生产环境配置检查通过"
else
    CONFIG_FILE="config/development.json"
    if [ ! -f "$CONFIG_FILE" ]; then
        log_warning "开发环境配置文件不存在，将使用默认配置"
    else
        log_success "开发环境配置文件存在"
    fi
fi

# 检查端口占用
PORT=$(node -e "console.log(require('./$CONFIG_FILE').server.port)" 2>/dev/null || echo "3000")
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_error "端口 $PORT 已被占用。请停止占用该端口的进程或修改配置文件中的端口设置。"
    log_info "查看端口占用: lsof -i :$PORT"
    exit 1
fi

log_success "端口 $PORT 可用"

# 初始化数据
log_info "检查数据文件..."
if [ ! -f "data/students.json" ] || [ ! -f "data/config.json" ]; then
    log_info "初始化系统数据..."
    node -e "
        const DataInitializer = require('./utils/dataInitializer');
        const initializer = new DataInitializer();
        initializer.initializeAllData()
            .then(() => console.log('数据初始化完成'))
            .catch(err => {
                console.error('数据初始化失败:', err.message);
                process.exit(1);
            });
    "
    log_success "数据初始化完成"
else
    log_info "数据文件已存在，跳过初始化"
fi

# 启动服务
log_info "启动服务..."

if [[ "$MODE" == "prod" ]]; then
    # 生产环境启动
    export NODE_ENV=production
    export PORT=$PORT
    
    # 检查是否安装了 PM2
    if command -v pm2 &> /dev/null; then
        log_info "使用 PM2 启动服务..."
        
        # 检查是否已有运行的实例
        if pm2 list | grep -q "classroom-points-system"; then
            log_warning "发现已运行的实例，正在重启..."
            pm2 restart classroom-points-system
        else
            # 检查是否有 ecosystem.config.js
            if [ -f "ecosystem.config.js" ]; then
                pm2 start ecosystem.config.js
            else
                pm2 start server.js --name "classroom-points-system"
            fi
        fi
        
        log_success "服务已通过 PM2 启动"
        log_info "查看状态: pm2 status"
        log_info "查看日志: pm2 logs classroom-points-system"
        
    else
        log_warning "PM2 未安装，使用直接启动方式"
        log_info "建议安装 PM2: npm install -g pm2"
        
        # 后台启动
        nohup node server.js > logs/app.log 2>&1 &
        SERVER_PID=$!
        echo $SERVER_PID > .server.pid
        
        log_success "服务已后台启动 (PID: $SERVER_PID)"
        log_info "查看日志: tail -f logs/app.log"
        log_info "停止服务: ./scripts/stop.sh"
    fi
    
else
    # 开发环境启动
    export NODE_ENV=development
    export PORT=$PORT
    
    log_info "开发模式启动，按 Ctrl+C 停止服务"
    node server.js
fi

# 等待服务启动
log_info "等待服务启动..."
sleep 3

# 健康检查
HEALTH_URL="http://localhost:$PORT/api/health"
if curl -s "$HEALTH_URL" > /dev/null 2>&1; then
    HEALTH_RESPONSE=$(curl -s "$HEALTH_URL")
    if echo "$HEALTH_RESPONSE" | grep -q '"success":true'; then
        log_success "服务启动成功！"
        log_info "访问地址:"
        log_info "  主页: http://localhost:$PORT"
        log_info "  大屏展示: http://localhost:$PORT/display"
        log_info "  教师管理: http://localhost:$PORT/teacher"
        log_info "  学生查询: http://localhost:$PORT/student"
        log_info "  健康检查: http://localhost:$PORT/api/health"
    else
        log_warning "服务已启动，但健康检查未通过"
        log_info "请检查日志: tail -f logs/app.log"
    fi
else
    log_warning "无法连接到服务，可能仍在启动中"
    log_info "请稍等片刻后访问: http://localhost:$PORT"
    log_info "或检查日志: tail -f logs/app.log"
fi

log_info "启动脚本执行完成"