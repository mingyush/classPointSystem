#!/bin/bash

# 班级积分管理系统健康检查脚本
# 使用方法: ./scripts/health-check.sh [--port PORT] [--verbose]

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

# 默认参数
PORT=3000
VERBOSE=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PORT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "使用方法: $0 [--port PORT] [--verbose]"
            echo "  --port PORT    指定检查的端口 (默认: 3000)"
            echo "  --verbose      显示详细信息"
            echo "  --help         显示帮助信息"
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            exit 1
            ;;
    esac
done

log_info "开始健康检查 (端口: $PORT)"

# 检查结果统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# 检查函数
check_item() {
    local name="$1"
    local command="$2"
    local expected_result="$3"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ "$VERBOSE" = true ]; then
        log_info "检查: $name"
    fi
    
    if eval "$command" > /dev/null 2>&1; then
        if [ "$expected_result" = "success" ] || [ -z "$expected_result" ]; then
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            if [ "$VERBOSE" = true ]; then
                log_success "$name - 通过"
            fi
            return 0
        else
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            log_error "$name - 失败 (预期失败但实际成功)"
            return 1
        fi
    else
        if [ "$expected_result" = "fail" ]; then
            PASSED_CHECKS=$((PASSED_CHECKS + 1))
            if [ "$VERBOSE" = true ]; then
                log_success "$name - 通过 (预期失败)"
            fi
            return 0
        else
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            log_error "$name - 失败"
            return 1
        fi
    fi
}

# 1. 检查 Node.js 环境
log_info "检查运行环境..."
check_item "Node.js 可用性" "command -v node"
check_item "npm 可用性" "command -v npm"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    log_info "Node.js 版本: $NODE_VERSION"
fi

# 2. 检查项目文件
log_info "检查项目文件..."
check_item "server.js 存在" "[ -f server.js ]"
check_item "package.json 存在" "[ -f package.json ]"
check_item "node_modules 存在" "[ -d node_modules ]"

# 3. 检查配置文件
log_info "检查配置文件..."
check_item "生产配置存在" "[ -f config/production.json ]"
check_item "开发配置存在" "[ -f config/development.json ]"

# 4. 检查数据目录
log_info "检查数据目录..."
check_item "data 目录存在" "[ -d data ]"
check_item "logs 目录存在" "[ -d logs ]"
check_item "backups 目录存在" "[ -d backups ]"

# 5. 检查数据文件
log_info "检查数据文件..."
check_item "students.json 存在" "[ -f data/students.json ]"
check_item "points.json 存在" "[ -f data/points.json ]"
check_item "products.json 存在" "[ -f data/products.json ]"
check_item "orders.json 存在" "[ -f data/orders.json ]"
check_item "config.json 存在" "[ -f data/config.json ]"

# 6. 检查服务状态
log_info "检查服务状态..."

# 检查端口占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    check_item "端口 $PORT 监听中" "true"
    
    # 获取进程信息
    PORT_PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t | head -1)
    if [ "$VERBOSE" = true ]; then
        log_info "端口 $PORT 被进程 $PORT_PID 占用"
        ps -p "$PORT_PID" -o pid,ppid,cmd 2>/dev/null || true
    fi
else
    check_item "端口 $PORT 监听中" "false" "fail"
fi

# 检查进程
NODE_PIDS=$(pgrep -f "node.*server.js" 2>/dev/null || true)
if [ -n "$NODE_PIDS" ]; then
    check_item "Node.js 进程运行中" "true"
    if [ "$VERBOSE" = true ]; then
        log_info "运行中的 Node.js 进程:"
        ps -p $NODE_PIDS -o pid,ppid,cmd 2>/dev/null || true
    fi
else
    check_item "Node.js 进程运行中" "false" "fail"
fi

# 检查 PM2 状态
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "classroom-points-system"; then
        check_item "PM2 进程运行中" "true"
        if [ "$VERBOSE" = true ]; then
            pm2 list | grep -E "(classroom-points|App name)"
        fi
    else
        check_item "PM2 进程运行中" "false" "fail"
    fi
fi

# 7. 检查 HTTP 服务
log_info "检查 HTTP 服务..."

BASE_URL="http://localhost:$PORT"

# 检查主页
if curl -s -f "$BASE_URL" > /dev/null 2>&1; then
    check_item "主页访问" "true"
else
    check_item "主页访问" "false" "fail"
fi

# 检查健康检查接口
HEALTH_URL="$BASE_URL/api/health"
if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then
    check_item "健康检查接口" "true"
    
    # 检查健康检查响应
    HEALTH_RESPONSE=$(curl -s "$HEALTH_URL" 2>/dev/null || echo '{}')
    if echo "$HEALTH_RESPONSE" | grep -q '"success":true'; then
        check_item "健康检查响应正常" "true"
        
        if [ "$VERBOSE" = true ]; then
            log_info "健康检查响应:"
            echo "$HEALTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_RESPONSE"
        fi
    else
        check_item "健康检查响应正常" "false" "fail"
    fi
else
    check_item "健康检查接口" "false" "fail"
fi

# 检查其他关键接口
API_ENDPOINTS=(
    "/api/points/rankings"
    "/api/products"
    "/display"
    "/teacher"
    "/student"
)

for endpoint in "${API_ENDPOINTS[@]}"; do
    if curl -s -f "$BASE_URL$endpoint" > /dev/null 2>&1; then
        check_item "接口 $endpoint" "true"
    else
        check_item "接口 $endpoint" "false" "fail"
    fi
done

# 8. 检查系统资源
log_info "检查系统资源..."

# 检查磁盘空间
DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -lt 90 ]; then
    check_item "磁盘空间充足 (使用率: ${DISK_USAGE}%)" "true"
else
    check_item "磁盘空间充足 (使用率: ${DISK_USAGE}%)" "false" "fail"
fi

# 检查内存使用
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ "$MEMORY_USAGE" -lt 90 ]; then
        check_item "内存使用正常 (使用率: ${MEMORY_USAGE}%)" "true"
    else
        check_item "内存使用正常 (使用率: ${MEMORY_USAGE}%)" "false" "fail"
    fi
fi

# 9. 检查日志文件
log_info "检查日志文件..."

if [ -f "logs/app.log" ]; then
    check_item "应用日志文件存在" "true"
    
    # 检查最近的错误
    RECENT_ERRORS=$(tail -100 logs/app.log | grep -i error | wc -l)
    if [ "$RECENT_ERRORS" -lt 5 ]; then
        check_item "最近错误数量正常 ($RECENT_ERRORS)" "true"
    else
        check_item "最近错误数量正常 ($RECENT_ERRORS)" "false" "fail"
    fi
else
    check_item "应用日志文件存在" "false" "fail"
fi

# 10. 检查备份
log_info "检查备份..."

if [ -d "backups" ] && [ "$(ls -A backups 2>/dev/null)" ]; then
    check_item "备份文件存在" "true"
    
    # 检查最新备份时间
    LATEST_BACKUP=$(ls -t backups/*.zip 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        BACKUP_AGE=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || stat -f %m "$LATEST_BACKUP" 2>/dev/null || echo 0)) / 86400 ))
        if [ "$BACKUP_AGE" -lt 7 ]; then
            check_item "备份时间正常 (${BACKUP_AGE}天前)" "true"
        else
            check_item "备份时间正常 (${BACKUP_AGE}天前)" "false" "fail"
        fi
    fi
else
    check_item "备份文件存在" "false" "fail"
fi

# 输出检查结果
echo ""
log_info "健康检查完成"
echo "========================================"
echo "总检查项目: $TOTAL_CHECKS"
echo "通过项目: $PASSED_CHECKS"
echo "失败项目: $FAILED_CHECKS"
echo "成功率: $(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))%"
echo "========================================"

# 根据结果设置退出码
if [ "$FAILED_CHECKS" -eq 0 ]; then
    log_success "所有检查项目通过，系统运行正常"
    exit 0
elif [ "$FAILED_CHECKS" -lt 3 ]; then
    log_warning "部分检查项目失败，系统可能存在轻微问题"
    exit 1
else
    log_error "多个检查项目失败，系统存在严重问题"
    exit 2
fi