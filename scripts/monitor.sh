#!/bin/bash

# 班级积分管理系统监控脚本
# 使用方法: ./scripts/monitor.sh [--interval SECONDS] [--log-file FILE] [--alert-email EMAIL]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${BLUE}[$timestamp INFO]${NC} $1"
    if [ -n "$LOG_FILE" ]; then
        echo "[$timestamp INFO] $1" >> "$LOG_FILE"
    fi
}

log_success() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${GREEN}[$timestamp SUCCESS]${NC} $1"
    if [ -n "$LOG_FILE" ]; then
        echo "[$timestamp SUCCESS] $1" >> "$LOG_FILE"
    fi
}

log_warning() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${YELLOW}[$timestamp WARNING]${NC} $1"
    if [ -n "$LOG_FILE" ]; then
        echo "[$timestamp WARNING] $1" >> "$LOG_FILE"
    fi
}

log_error() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${RED}[$timestamp ERROR]${NC} $1"
    if [ -n "$LOG_FILE" ]; then
        echo "[$timestamp ERROR] $1" >> "$LOG_FILE"
    fi
}

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 切换到项目目录
cd "$PROJECT_DIR"

# 默认参数
INTERVAL=60  # 检查间隔（秒）
LOG_FILE=""  # 日志文件
ALERT_EMAIL=""  # 告警邮箱
PORT=3000

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --interval)
            INTERVAL="$2"
            shift 2
            ;;
        --log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        --alert-email)
            ALERT_EMAIL="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        -h|--help)
            echo "使用方法: $0 [选项]"
            echo "选项:"
            echo "  --interval SECONDS    监控检查间隔 (默认: 60秒)"
            echo "  --log-file FILE       监控日志文件"
            echo "  --alert-email EMAIL   告警邮箱地址"
            echo "  --port PORT           服务端口 (默认: 3000)"
            echo "  --help                显示帮助信息"
            exit 0
            ;;
        *)
            log_error "未知参数: $1"
            exit 1
            ;;
    esac
done

# 创建日志文件目录
if [ -n "$LOG_FILE" ]; then
    LOG_DIR=$(dirname "$LOG_FILE")
    mkdir -p "$LOG_DIR"
fi

# 监控状态变量
SERVICE_DOWN_COUNT=0
LAST_ALERT_TIME=0
ALERT_COOLDOWN=3600  # 告警冷却时间（秒）

# 发送告警函数
send_alert() {
    local subject="$1"
    local message="$2"
    local current_time=$(date +%s)
    
    # 检查告警冷却时间
    if [ $((current_time - LAST_ALERT_TIME)) -lt $ALERT_COOLDOWN ]; then
        log_info "告警冷却中，跳过发送"
        return
    fi
    
    log_warning "发送告警: $subject"
    
    if [ -n "$ALERT_EMAIL" ]; then
        # 尝试发送邮件告警
        if command -v mail &> /dev/null; then
            echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
            log_info "邮件告警已发送到 $ALERT_EMAIL"
        elif command -v sendmail &> /dev/null; then
            {
                echo "To: $ALERT_EMAIL"
                echo "Subject: $subject"
                echo ""
                echo "$message"
            } | sendmail "$ALERT_EMAIL"
            log_info "邮件告警已发送到 $ALERT_EMAIL"
        else
            log_warning "未找到邮件发送工具，无法发送邮件告警"
        fi
    fi
    
    LAST_ALERT_TIME=$current_time
}

# 检查服务状态
check_service_status() {
    local status="healthy"
    local issues=()
    
    # 检查端口监听
    if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        status="unhealthy"
        issues+=("端口 $PORT 未监听")
    fi
    
    # 检查进程
    if ! pgrep -f "node.*server.js" >/dev/null 2>&1; then
        status="unhealthy"
        issues+=("Node.js 进程未运行")
    fi
    
    # 检查 HTTP 响应
    if ! curl -s -f "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
        status="unhealthy"
        issues+=("HTTP 服务无响应")
    else
        # 检查健康检查接口响应
        local health_response=$(curl -s "http://localhost:$PORT/api/health" 2>/dev/null || echo '{}')
        if ! echo "$health_response" | grep -q '"success":true'; then
            status="degraded"
            issues+=("健康检查接口返回异常")
        fi
    fi
    
    echo "$status|$(IFS=';'; echo "${issues[*]}")"
}

# 检查系统资源
check_system_resources() {
    local warnings=()
    
    # 检查磁盘空间
    local disk_usage=$(df . | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -gt 90 ]; then
        warnings+=("磁盘使用率过高: ${disk_usage}%")
    elif [ "$disk_usage" -gt 80 ]; then
        warnings+=("磁盘使用率较高: ${disk_usage}%")
    fi
    
    # 检查内存使用
    if command -v free &> /dev/null; then
        local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [ "$memory_usage" -gt 90 ]; then
            warnings+=("内存使用率过高: ${memory_usage}%")
        elif [ "$memory_usage" -gt 80 ]; then
            warnings+=("内存使用率较高: ${memory_usage}%")
        fi
    fi
    
    # 检查负载
    if command -v uptime &> /dev/null; then
        local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        local cpu_cores=$(nproc 2>/dev/null || echo 1)
        local load_ratio=$(echo "$load_avg $cpu_cores" | awk '{printf "%.2f", $1/$2}')
        
        if (( $(echo "$load_ratio > 2.0" | bc -l 2>/dev/null || echo 0) )); then
            warnings+=("系统负载过高: $load_avg (${load_ratio}x)")
        elif (( $(echo "$load_ratio > 1.5" | bc -l 2>/dev/null || echo 0) )); then
            warnings+=("系统负载较高: $load_avg (${load_ratio}x)")
        fi
    fi
    
    IFS=';'; echo "${warnings[*]}"
}

# 检查应用指标
check_application_metrics() {
    local warnings=()
    
    # 检查错误日志
    if [ -f "logs/app.log" ]; then
        local recent_errors=$(tail -100 logs/app.log | grep -i error | wc -l)
        if [ "$recent_errors" -gt 10 ]; then
            warnings+=("最近错误数量过多: $recent_errors")
        elif [ "$recent_errors" -gt 5 ]; then
            warnings+=("最近错误数量较多: $recent_errors")
        fi
    fi
    
    # 检查响应时间
    local response_time=$(curl -w "%{time_total}" -s -o /dev/null "http://localhost:$PORT/api/health" 2>/dev/null || echo "999")
    local response_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null || echo "999")
    
    if (( $(echo "$response_ms > 5000" | bc -l 2>/dev/null || echo 0) )); then
        warnings+=("响应时间过慢: ${response_ms}ms")
    elif (( $(echo "$response_ms > 2000" | bc -l 2>/dev/null || echo 0) )); then
        warnings+=("响应时间较慢: ${response_ms}ms")
    fi
    
    IFS=';'; echo "${warnings[*]}"
}

# 自动恢复尝试
attempt_recovery() {
    log_warning "尝试自动恢复服务..."
    
    # 尝试重启服务
    if [ -f "$SCRIPT_DIR/restart.sh" ]; then
        log_info "执行重启脚本..."
        if bash "$SCRIPT_DIR/restart.sh" prod >/dev/null 2>&1; then
            log_success "服务重启成功"
            return 0
        else
            log_error "服务重启失败"
        fi
    fi
    
    # 尝试通过 PM2 重启
    if command -v pm2 &> /dev/null && pm2 list | grep -q "classroom-points-system"; then
        log_info "尝试通过 PM2 重启..."
        if pm2 restart classroom-points-system >/dev/null 2>&1; then
            log_success "PM2 重启成功"
            return 0
        else
            log_error "PM2 重启失败"
        fi
    fi
    
    return 1
}

# 信号处理
cleanup() {
    log_info "监控脚本正在退出..."
    exit 0
}

trap cleanup SIGINT SIGTERM

# 主监控循环
log_info "开始监控班级积分管理系统"
log_info "监控间隔: ${INTERVAL}秒"
log_info "服务端口: $PORT"
[ -n "$LOG_FILE" ] && log_info "日志文件: $LOG_FILE"
[ -n "$ALERT_EMAIL" ] && log_info "告警邮箱: $ALERT_EMAIL"

while true; do
    # 检查服务状态
    service_check=$(check_service_status)
    service_status=$(echo "$service_check" | cut -d'|' -f1)
    service_issues=$(echo "$service_check" | cut -d'|' -f2)
    
    # 检查系统资源
    resource_warnings=$(check_system_resources)
    
    # 检查应用指标
    app_warnings=$(check_application_metrics)
    
    # 记录当前状态
    current_time=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$service_status" in
        "healthy")
            if [ "$SERVICE_DOWN_COUNT" -gt 0 ]; then
                log_success "服务已恢复正常"
                send_alert "服务恢复" "班级积分管理系统已恢复正常运行。\n时间: $current_time"
            fi
            SERVICE_DOWN_COUNT=0
            log_info "服务状态: 正常"
            ;;
        "degraded")
            log_warning "服务状态: 降级 - $service_issues"
            SERVICE_DOWN_COUNT=$((SERVICE_DOWN_COUNT + 1))
            
            if [ "$SERVICE_DOWN_COUNT" -eq 3 ]; then
                send_alert "服务降级" "班级积分管理系统运行异常。\n问题: $service_issues\n时间: $current_time"
            fi
            ;;
        "unhealthy")
            log_error "服务状态: 异常 - $service_issues"
            SERVICE_DOWN_COUNT=$((SERVICE_DOWN_COUNT + 1))
            
            # 第一次检测到异常时尝试自动恢复
            if [ "$SERVICE_DOWN_COUNT" -eq 1 ]; then
                if attempt_recovery; then
                    SERVICE_DOWN_COUNT=0
                    continue
                fi
            fi
            
            # 连续异常3次发送告警
            if [ "$SERVICE_DOWN_COUNT" -eq 3 ]; then
                send_alert "服务异常" "班级积分管理系统服务异常。\n问题: $service_issues\n时间: $current_time\n\n已尝试自动恢复但失败，请手动检查。"
            fi
            ;;
    esac
    
    # 处理资源告警
    if [ -n "$resource_warnings" ]; then
        log_warning "系统资源告警: $resource_warnings"
        
        # 资源告警不频繁发送，每小时最多一次
        local current_time_epoch=$(date +%s)
        if [ $((current_time_epoch - LAST_ALERT_TIME)) -gt 3600 ]; then
            send_alert "系统资源告警" "系统资源使用异常。\n详情: $resource_warnings\n时间: $current_time"
        fi
    fi
    
    # 处理应用告警
    if [ -n "$app_warnings" ]; then
        log_warning "应用指标告警: $app_warnings"
    fi
    
    # 输出统计信息（每10次循环输出一次）
    if [ $(($(date +%s) % 600)) -lt $INTERVAL ]; then
        log_info "监控统计 - 服务异常次数: $SERVICE_DOWN_COUNT"
        
        # 输出系统资源使用情况
        if command -v free &> /dev/null; then
            local memory_info=$(free -h | grep Mem)
            log_info "内存使用: $memory_info"
        fi
        
        local disk_info=$(df -h . | tail -1)
        log_info "磁盘使用: $disk_info"
    fi
    
    # 等待下次检查
    sleep "$INTERVAL"
done