#!/bin/bash

# 部署验证脚本
# 使用方法: ./scripts/verify-deployment.sh [--host HOST] [--port PORT]

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

# 默认参数
HOST="localhost"
PORT="3000"

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            echo "使用方法: $0 [--host HOST] [--port PORT]"
            echo "  --host HOST    目标主机 (默认: localhost)"
            echo "  --port PORT    目标端口 (默认: 3000)"
            echo "  --help         显示帮助信息"
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            exit 1
            ;;
    esac
done

BASE_URL="http://$HOST:$PORT"

log_info "开始验证部署 - $BASE_URL"

# 验证计数器
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# 检查函数
check_endpoint() {
    local name="$1"
    local endpoint="$2"
    local expected_status="$3"
    local timeout="${4:-10}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    log_info "检查: $name"
    
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    
    if [ "$response_code" = "$expected_status" ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        log_success "$name - 通过 (状态码: $response_code)"
        return 0
    else
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        log_error "$name - 失败 (期望: $expected_status, 实际: $response_code)"
        return 1
    fi
}

# 检查服务可用性
log_info "=== 基础服务检查 ==="

# 检查服务是否启动
if ! curl -s --max-time 5 "$BASE_URL" > /dev/null 2>&1; then
    log_error "无法连接到服务: $BASE_URL"
    log_info "请确认:"
    log_info "1. 服务已启动"
    log_info "2. 主机和端口配置正确"
    log_info "3. 防火墙允许访问"
    exit 1
fi

log_success "服务连接正常"

# 检查主要页面
check_endpoint "主页" "/" "200"
check_endpoint "大屏展示页面" "/display" "200"
check_endpoint "教师管理页面" "/teacher" "200"
check_endpoint "学生查询页面" "/student" "200"

# 检查API端点
log_info "=== API端点检查 ==="

check_endpoint "健康检查API" "/api/health" "200"
check_endpoint "积分排行榜API" "/api/points/rankings" "200"
check_endpoint "商品列表API" "/api/products" "200"
check_endpoint "系统模式API" "/api/config/mode" "200"

# 检查需要认证的API（应该返回401）
check_endpoint "学生列表API (未认证)" "/api/students" "401"
check_endpoint "积分操作API (未认证)" "/api/points/add" "401"
check_endpoint "订单管理API (未认证)" "/api/orders/pending" "401"

# 检查不存在的端点（应该返回404）
check_endpoint "不存在的API端点" "/api/nonexistent" "404"

# 检查健康检查详细信息
log_info "=== 健康检查详细信息 ==="

HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health" 2>/dev/null || echo '{}')
if echo "$HEALTH_RESPONSE" | grep -q '"success":true'; then
    log_success "健康检查响应正常"
    
    # 提取健康检查信息
    if command -v python3 &> /dev/null; then
        echo "$HEALTH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_RESPONSE"
    else
        echo "$HEALTH_RESPONSE"
    fi
else
    log_error "健康检查响应异常"
    echo "响应内容: $HEALTH_RESPONSE"
fi

# 检查响应时间
log_info "=== 性能检查 ==="

RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null "$BASE_URL/api/health" 2>/dev/null || echo "999")
RESPONSE_MS=$(echo "$RESPONSE_TIME * 1000" | bc -l 2>/dev/null || echo "999")

if (( $(echo "$RESPONSE_MS < 1000" | bc -l 2>/dev/null || echo 0) )); then
    log_success "响应时间正常: ${RESPONSE_MS}ms"
else
    log_warning "响应时间较慢: ${RESPONSE_MS}ms"
fi

# 检查静态资源
log_info "=== 静态资源检查 ==="

# 检查CSS和JS文件是否可访问
STATIC_FILES=(
    "/css/common.css"
    "/js/common.js"
    "/display/style.css"
    "/teacher/style.css"
    "/student/style.css"
)

for file in "${STATIC_FILES[@]}"; do
    if curl -s --head "$BASE_URL$file" | grep -q "200 OK"; then
        log_success "静态文件可访问: $file"
    else
        log_warning "静态文件不可访问: $file"
    fi
done

# 检查系统资源（如果是本地部署）
if [ "$HOST" = "localhost" ] || [ "$HOST" = "127.0.0.1" ]; then
    log_info "=== 系统资源检查 ==="
    
    # 检查磁盘空间
    DISK_USAGE=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -lt 90 ]; then
        log_success "磁盘空间充足 (使用率: ${DISK_USAGE}%)"
    else
        log_warning "磁盘空间不足 (使用率: ${DISK_USAGE}%)"
    fi
    
    # 检查内存使用
    if command -v free &> /dev/null; then
        MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [ "$MEMORY_USAGE" -lt 80 ]; then
            log_success "内存使用正常 (使用率: ${MEMORY_USAGE}%)"
        else
            log_warning "内存使用较高 (使用率: ${MEMORY_USAGE}%)"
        fi
    fi
    
    # 检查进程状态
    if pgrep -f "node.*server.js" >/dev/null 2>&1; then
        log_success "Node.js 进程运行正常"
    else
        log_error "未找到 Node.js 进程"
    fi
fi

# 检查日志文件（如果是本地部署）
if [ "$HOST" = "localhost" ] || [ "$HOST" = "127.0.0.1" ]; then
    log_info "=== 日志文件检查 ==="
    
    if [ -f "logs/app.log" ]; then
        log_success "应用日志文件存在"
        
        # 检查最近的错误
        RECENT_ERRORS=$(tail -100 logs/app.log | grep -i error | wc -l)
        if [ "$RECENT_ERRORS" -lt 5 ]; then
            log_success "最近错误数量正常 ($RECENT_ERRORS)"
        else
            log_warning "最近错误数量较多 ($RECENT_ERRORS)"
        fi
    else
        log_warning "应用日志文件不存在"
    fi
fi

# 输出验证结果
echo ""
log_info "部署验证完成"
echo "========================================"
echo "总检查项目: $TOTAL_CHECKS"
echo "通过项目: $PASSED_CHECKS"
echo "失败项目: $FAILED_CHECKS"
echo "成功率: $(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))%"
echo "========================================"

# 根据结果设置退出码
if [ "$FAILED_CHECKS" -eq 0 ]; then
    log_success "部署验证通过，系统运行正常"
    echo ""
    log_info "访问地址:"
    echo "  主页: $BASE_URL"
    echo "  大屏展示: $BASE_URL/display"
    echo "  教师管理: $BASE_URL/teacher"
    echo "  学生查询: $BASE_URL/student"
    echo "  健康检查: $BASE_URL/api/health"
    exit 0
elif [ "$FAILED_CHECKS" -lt 3 ]; then
    log_warning "部分检查项目失败，系统可能存在轻微问题"
    exit 1
else
    log_error "多个检查项目失败，系统存在严重问题"
    exit 2
fi