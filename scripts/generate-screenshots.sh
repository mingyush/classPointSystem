#!/bin/bash

# 截图生成辅助脚本
# 用于启动系统并提供截图指导

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_header() {
    echo
    print_message $BLUE "=================================="
    print_message $BLUE "$1"
    print_message $BLUE "=================================="
    echo
}

print_step() {
    print_message $GREEN "✓ $1"
}

print_warning() {
    print_message $YELLOW "⚠ $1"
}

print_error() {
    print_message $RED "✗ $1"
}

# 检查系统状态
check_system() {
    print_header "检查系统状态"
    
    # 检查Node.js
    if command -v node >/dev/null 2>&1; then
        print_step "Node.js 已安装: $(node --version)"
    else
        print_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    # 检查npm依赖
    if [ -f "package.json" ]; then
        print_step "发现 package.json"
        if [ -d "node_modules" ]; then
            print_step "依赖已安装"
        else
            print_warning "依赖未安装，正在安装..."
            npm install
        fi
    else
        print_error "未找到 package.json，请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 检查截图目录
    if [ ! -d "screenshots" ]; then
        print_warning "创建截图目录..."
        mkdir -p screenshots
    fi
    print_step "截图目录已准备"
}

# 启动系统
start_system() {
    print_header "启动系统"
    
    # 检查端口是否被占用
    if lsof -i :3000 >/dev/null 2>&1; then
        print_warning "端口 3000 已被占用，尝试停止现有服务..."
        pkill -f "node.*server.js" || true
        sleep 2
    fi
    
    # 启动服务器
    print_step "启动服务器..."
    npm start &
    SERVER_PID=$!
    
    # 等待服务器启动
    print_step "等待服务器启动..."
    sleep 5
    
    # 检查服务器是否正常运行
    if curl -s http://localhost:3000 >/dev/null; then
        print_step "服务器启动成功！"
        print_step "访问地址: http://localhost:3000"
    else
        print_error "服务器启动失败"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
}

# 显示截图指南
show_screenshot_guide() {
    print_header "截图指南"
    
    echo "请按以下顺序进行截图："
    echo
    
    print_message $YELLOW "1. 系统首页"
    echo "   访问: http://localhost:3000"
    echo "   文件: screenshots/homepage.png"
    echo
    
    print_message $YELLOW "2. 大屏展示 - 平时模式"
    echo "   访问: http://localhost:3000/display"
    echo "   文件: screenshots/display-normal-mode.png"
    echo
    
    print_message $YELLOW "3. 教师登录"
    echo "   访问: http://localhost:3000/teacher"
    echo "   账号: 8001 / 123 (或其他教师账号)"
    echo "   文件: screenshots/login-interface.png"
    echo
    
    print_message $YELLOW "4. 大屏展示 - 上课模式"
    echo "   在教师界面切换到上课模式，然后访问: http://localhost:3000/display"
    echo "   文件: screenshots/display-class-mode.png"
    echo
    
    print_message $YELLOW "5. 教师管理界面"
    echo "   访问: http://localhost:3000/teacher"
    echo "   截图各个标签页："
    echo "   - 积分管理: screenshots/teacher-points-management.png"
    echo "   - 商品管理: screenshots/teacher-product-management.png"
    echo "   - 预约管理: screenshots/teacher-order-management.png"
    echo "   - 系统设置: screenshots/teacher-system-settings.png"
    echo
    
    print_message $YELLOW "6. 学生查询界面"
    echo "   访问: http://localhost:3000/student"
    echo "   使用学号登录 (如: 0501)"
    echo "   文件: screenshots/student-personal-center.png"
    echo "   文件: screenshots/student-product-browse.png"
    echo
    
    print_message $YELLOW "7. 移动端适配"
    echo "   使用浏览器开发者工具切换到移动端视图"
    echo "   文件: screenshots/mobile-responsive.png"
    echo
    
    print_message $BLUE "截图完成后，请检查所有文件是否已保存到 screenshots/ 目录"
}

# 准备测试数据
prepare_test_data() {
    print_header "准备测试数据"
    
    # 检查是否有学生数据
    if [ -f "data/students.json" ]; then
        print_step "学生数据已存在"
    else
        print_warning "学生数据不存在，请确保 data/students.json 文件存在"
    fi
    
    # 提示添加测试数据
    print_message $YELLOW "建议操作："
    echo "1. 登录教师账号，为几个学生添加积分"
    echo "2. 在商品管理中添加几个测试商品"
    echo "3. 使用学生账号预约一些商品"
    echo "4. 这样截图会更有意义和美观"
}

# 清理函数
cleanup() {
    if [ ! -z "$SERVER_PID" ]; then
        print_message $YELLOW "正在停止服务器..."
        kill $SERVER_PID 2>/dev/null || true
    fi
}

# 设置清理陷阱
trap cleanup EXIT INT TERM

# 主函数
main() {
    print_header "班级积分管理系统 - 截图生成助手"
    
    check_system
    prepare_test_data
    start_system
    show_screenshot_guide
    
    echo
    print_message $GREEN "系统已启动，请按照上述指南进行截图"
    print_message $YELLOW "按 Ctrl+C 停止服务器"
    echo
    
    # 等待用户中断
    wait $SERVER_PID
}

# 显示帮助信息
show_help() {
    echo "班级积分管理系统 - 截图生成助手"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  --no-start     不启动服务器，仅显示指南"
    echo
    echo "此脚本将："
    echo "1. 检查系统环境和依赖"
    echo "2. 启动开发服务器"
    echo "3. 显示详细的截图指南"
    echo "4. 等待用户完成截图"
    echo
    echo "截图文件将保存到 screenshots/ 目录"
    echo "详细说明请查看 screenshots/README.md"
}

# 解析命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --no-start)
        check_system
        show_screenshot_guide
        exit 0
        ;;
    *)
        main
        ;;
esac