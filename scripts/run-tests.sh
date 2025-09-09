#!/bin/bash

# 集成测试运行脚本
# 使用方法: ./scripts/run-tests.sh [test-type]

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
TEST_TYPE=${1:-all}

log_info "运行集成测试 (类型: $TEST_TYPE)"

# 确保服务器没有运行
log_info "检查并停止现有服务..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warning "端口3000被占用，尝试停止服务..."
    if [ -f "$SCRIPT_DIR/stop.sh" ]; then
        bash "$SCRIPT_DIR/stop.sh" >/dev/null 2>&1 || true
    fi
    
    # 等待端口释放
    for i in {1..10}; do
        if ! lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

# 设置测试环境
export NODE_ENV=test
export PORT=3001  # 使用不同的端口避免冲突

# 创建测试数据目录
mkdir -p test-data test-logs test-backups

# 备份现有数据
if [ -d "data" ]; then
    log_info "备份现有数据..."
    cp -r data data-backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
fi

# 运行测试
case "$TEST_TYPE" in
    "unit")
        log_info "运行单元测试..."
        npm test -- --testPathIgnorePatterns="integration" --verbose
        ;;
    "integration")
        log_info "运行集成测试..."
        npm test -- --testPathPatterns="integration" --runInBand --verbose
        ;;
    "performance")
        log_info "运行性能测试..."
        npm test -- --testPathPatterns="performance" --runInBand --verbose
        ;;
    "all")
        log_info "运行所有测试..."
        
        # 先运行单元测试
        log_info "1. 运行单元测试..."
        npm test -- --testPathIgnorePatterns="integration" --verbose
        
        # 再运行集成测试
        log_info "2. 运行集成测试..."
        npm test -- --testPathPatterns="integration" --runInBand --verbose
        ;;
    *)
        log_error "未知的测试类型: $TEST_TYPE"
        log_info "支持的类型: unit, integration, performance, all"
        exit 1
        ;;
esac

TEST_EXIT_CODE=$?

# 清理测试环境
log_info "清理测试环境..."
rm -rf test-data test-logs test-backups 2>/dev/null || true

# 恢复环境变量
unset NODE_ENV
unset PORT

if [ $TEST_EXIT_CODE -eq 0 ]; then
    log_success "所有测试通过！"
else
    log_error "测试失败，退出码: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE