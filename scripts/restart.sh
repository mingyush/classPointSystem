#!/bin/bash

# 班级积分管理系统重启脚本
# 使用方法: ./scripts/restart.sh [dev|prod]

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
MODE=${1:-prod}
if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
    log_error "无效的模式参数。使用方法: $0 [dev|prod]"
    exit 1
fi

log_info "重启班级积分管理系统 (模式: $MODE)"

# 执行停止脚本
log_info "正在停止服务..."
if [ -f "$SCRIPT_DIR/stop.sh" ]; then
    bash "$SCRIPT_DIR/stop.sh"
else
    log_error "停止脚本不存在: $SCRIPT_DIR/stop.sh"
    exit 1
fi

# 等待一段时间确保服务完全停止
log_info "等待服务完全停止..."
sleep 3

# 执行启动脚本
log_info "正在启动服务..."
if [ -f "$SCRIPT_DIR/start.sh" ]; then
    bash "$SCRIPT_DIR/start.sh" "$MODE"
else
    log_error "启动脚本不存在: $SCRIPT_DIR/start.sh"
    exit 1
fi

log_success "重启完成"