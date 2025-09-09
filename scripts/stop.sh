#!/bin/bash

# 班级积分管理系统停止脚本
# 使用方法: ./scripts/stop.sh

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

log_info "停止班级积分管理系统"

# 停止标志
STOPPED=false

# 1. 尝试通过 PM2 停止
if command -v pm2 &> /dev/null; then
    log_info "检查 PM2 进程..."
    
    if pm2 list | grep -q "classroom-points-system"; then
        log_info "通过 PM2 停止服务..."
        pm2 stop classroom-points-system
        pm2 delete classroom-points-system
        log_success "PM2 进程已停止"
        STOPPED=true
    else
        log_info "未发现 PM2 进程"
    fi
fi

# 2. 尝试通过 PID 文件停止
if [ -f ".server.pid" ] && [ "$STOPPED" = false ]; then
    SERVER_PID=$(cat .server.pid)
    log_info "发现 PID 文件，进程 ID: $SERVER_PID"
    
    if kill -0 "$SERVER_PID" 2>/dev/null; then
        log_info "停止进程 $SERVER_PID..."
        kill "$SERVER_PID"
        
        # 等待进程结束
        for i in {1..10}; do
            if ! kill -0 "$SERVER_PID" 2>/dev/null; then
                log_success "进程已停止"
                STOPPED=true
                break
            fi
            sleep 1
        done
        
        # 如果进程仍在运行，强制杀死
        if kill -0 "$SERVER_PID" 2>/dev/null; then
            log_warning "进程未响应，强制停止..."
            kill -9 "$SERVER_PID"
            log_success "进程已强制停止"
            STOPPED=true
        fi
    else
        log_warning "PID 文件中的进程不存在"
    fi
    
    # 删除 PID 文件
    rm -f .server.pid
fi

# 3. 查找并停止所有相关进程
if [ "$STOPPED" = false ]; then
    log_info "查找相关进程..."
    
    # 查找 Node.js 进程
    PIDS=$(pgrep -f "node.*server.js" 2>/dev/null || true)
    
    if [ -n "$PIDS" ]; then
        log_info "发现相关进程: $PIDS"
        
        for PID in $PIDS; do
            # 检查进程是否是我们的应用
            if ps -p "$PID" -o args= | grep -q "classroom-points-system\|server.js"; then
                log_info "停止进程 $PID..."
                kill "$PID"
                
                # 等待进程结束
                for i in {1..5}; do
                    if ! kill -0 "$PID" 2>/dev/null; then
                        log_success "进程 $PID 已停止"
                        STOPPED=true
                        break
                    fi
                    sleep 1
                done
                
                # 强制杀死仍在运行的进程
                if kill -0 "$PID" 2>/dev/null; then
                    log_warning "强制停止进程 $PID..."
                    kill -9 "$PID"
                    STOPPED=true
                fi
            fi
        done
    fi
fi

# 4. 检查端口占用
log_info "检查端口占用..."

# 尝试从配置文件获取端口
PORT=3000
if [ -f "config/production.json" ]; then
    PORT=$(node -e "console.log(require('./config/production.json').server.port)" 2>/dev/null || echo "3000")
elif [ -f "config/development.json" ]; then
    PORT=$(node -e "console.log(require('./config/development.json').server.port)" 2>/dev/null || echo "3000")
fi

# 检查端口是否仍被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warning "端口 $PORT 仍被占用"
    
    # 获取占用端口的进程
    PORT_PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t)
    log_info "占用端口的进程 ID: $PORT_PID"
    
    # 检查是否是我们的进程
    if ps -p "$PORT_PID" -o args= | grep -q "node.*server.js"; then
        log_info "停止占用端口的进程..."
        kill "$PORT_PID"
        
        # 等待进程结束
        for i in {1..5}; do
            if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
                log_success "端口已释放"
                STOPPED=true
                break
            fi
            sleep 1
        done
        
        # 强制杀死
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_warning "强制停止占用端口的进程..."
            kill -9 "$PORT_PID"
            STOPPED=true
        fi
    else
        log_warning "端口被其他进程占用，请手动处理"
        log_info "查看占用进程: lsof -i :$PORT"
    fi
else
    log_info "端口 $PORT 未被占用"
fi

# 5. 清理临时文件
log_info "清理临时文件..."

# 清理 PID 文件
rm -f .server.pid

# 清理临时日志（可选）
if [ -f "logs/temp.log" ]; then
    rm -f logs/temp.log
fi

log_success "临时文件清理完成"

# 6. 验证停止结果
log_info "验证停止结果..."

# 检查是否还有相关进程
REMAINING_PIDS=$(pgrep -f "node.*server.js" 2>/dev/null || true)
if [ -n "$REMAINING_PIDS" ]; then
    log_warning "仍有相关进程在运行:"
    ps -p $REMAINING_PIDS -o pid,ppid,cmd
    log_info "如需强制停止，请运行: kill -9 $REMAINING_PIDS"
else
    log_success "所有相关进程已停止"
fi

# 检查端口
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warning "端口 $PORT 仍被占用"
    lsof -i :$PORT
else
    log_success "端口 $PORT 已释放"
fi

# 最终状态
if [ "$STOPPED" = true ]; then
    log_success "班级积分管理系统已成功停止"
else
    log_warning "未发现运行中的服务实例"
fi

# 显示系统状态
log_info "当前系统状态:"
echo "  进程状态: $(pgrep -f "node.*server.js" >/dev/null 2>&1 && echo "有相关进程运行" || echo "无相关进程")"
echo "  端口状态: $(lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 && echo "端口 $PORT 被占用" || echo "端口 $PORT 空闲")"

# PM2 状态（如果可用）
if command -v pm2 &> /dev/null; then
    echo "  PM2 状态:"
    pm2 list | grep -E "(classroom-points|App name)" || echo "    无相关 PM2 进程"
fi

log_info "停止脚本执行完成"