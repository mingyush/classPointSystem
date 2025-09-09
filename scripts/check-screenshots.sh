#!/bin/bash

# 截图完整性检查脚本

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

# 需要的截图文件列表
REQUIRED_SCREENSHOTS=(
    "homepage.png"
    "display-normal-mode.png"
    "display-class-mode.png"
    "teacher-points-management.png"
    "teacher-product-management.png"
    "teacher-order-management.png"
    "teacher-system-settings.png"
    "student-personal-center.png"
    "student-product-browse.png"
    "login-interface.png"
    "mobile-responsive.png"
)

# 检查截图文件
check_screenshots() {
    print_header "检查截图文件"
    
    local missing_files=()
    local existing_files=()
    local total_size=0
    
    for screenshot in "${REQUIRED_SCREENSHOTS[@]}"; do
        local filepath="screenshots/$screenshot"
        
        if [ -f "$filepath" ]; then
            # 文件存在，检查大小
            local filesize=$(stat -f%z "$filepath" 2>/dev/null || stat -c%s "$filepath" 2>/dev/null || echo "0")
            
            if [ "$filesize" -gt 0 ]; then
                existing_files+=("$screenshot")
                total_size=$((total_size + filesize))
                
                # 检查文件大小是否合理 (10KB - 5MB)
                if [ "$filesize" -lt 10240 ]; then
                    print_message $YELLOW "⚠ $screenshot 文件过小 (${filesize} bytes)"
                elif [ "$filesize" -gt 5242880 ]; then
                    print_message $YELLOW "⚠ $screenshot 文件过大 ($(($filesize / 1024 / 1024)) MB)"
                else
                    print_message $GREEN "✓ $screenshot ($(($filesize / 1024)) KB)"
                fi
            else
                print_message $RED "✗ $screenshot 文件为空"
                missing_files+=("$screenshot")
            fi
        else
            print_message $RED "✗ $screenshot 文件不存在"
            missing_files+=("$screenshot")
        fi
    done
    
    echo
    print_message $BLUE "统计信息:"
    echo "  已存在: ${#existing_files[@]}/${#REQUIRED_SCREENSHOTS[@]} 个文件"
    echo "  缺失: ${#missing_files[@]} 个文件"
    echo "  总大小: $(($total_size / 1024 / 1024)) MB"
    
    if [ ${#missing_files[@]} -eq 0 ]; then
        print_message $GREEN "✓ 所有截图文件都已存在！"
        return 0
    else
        echo
        print_message $YELLOW "缺失的截图文件:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        return 1
    fi
}

# 检查README中的引用
check_readme_references() {
    print_header "检查README中的截图引用"
    
    if [ ! -f "README.md" ]; then
        print_message $RED "✗ README.md 文件不存在"
        return 1
    fi
    
    local broken_refs=()
    
    for screenshot in "${REQUIRED_SCREENSHOTS[@]}"; do
        if grep -q "screenshots/$screenshot" README.md; then
            if [ -f "screenshots/$screenshot" ]; then
                print_message $GREEN "✓ $screenshot 引用正确"
            else
                print_message $RED "✗ $screenshot 在README中被引用但文件不存在"
                broken_refs+=("$screenshot")
            fi
        else
            print_message $YELLOW "⚠ $screenshot 未在README中被引用"
        fi
    done
    
    if [ ${#broken_refs[@]} -eq 0 ]; then
        print_message $GREEN "✓ README中的截图引用都正确！"
        return 0
    else
        print_message $RED "✗ 发现 ${#broken_refs[@]} 个损坏的引用"
        return 1
    fi
}

# 生成截图报告
generate_report() {
    print_header "生成截图报告"
    
    local report_file="screenshots/screenshot-report.md"
    
    cat > "$report_file" << EOF
# 截图报告

生成时间: $(date)

## 文件状态

EOF
    
    for screenshot in "${REQUIRED_SCREENSHOTS[@]}"; do
        local filepath="screenshots/$screenshot"
        
        if [ -f "$filepath" ]; then
            local filesize=$(stat -f%z "$filepath" 2>/dev/null || stat -c%s "$filepath" 2>/dev/null || echo "0")
            local filesize_kb=$((filesize / 1024))
            echo "- ✅ **$screenshot** - ${filesize_kb} KB" >> "$report_file"
        else
            echo "- ❌ **$screenshot** - 文件缺失" >> "$report_file"
        fi
    done
    
    cat >> "$report_file" << EOF

## 使用说明

1. 缺失的截图请使用以下命令生成：
   \`\`\`bash
   ./scripts/generate-screenshots.sh
   \`\`\`

2. 或参考详细指南：[README.md](README.md)

3. 截图规范请查看：[screenshots/README.md](README.md)

EOF
    
    print_message $GREEN "✓ 报告已生成: $report_file"
}

# 显示帮助信息
show_help() {
    echo "截图完整性检查脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  --report       生成详细报告"
    echo "  --fix          提供修复建议"
    echo
    echo "此脚本将检查："
    echo "1. 所有必需的截图文件是否存在"
    echo "2. 文件大小是否合理"
    echo "3. README中的引用是否正确"
}

# 提供修复建议
show_fix_suggestions() {
    print_header "修复建议"
    
    echo "如果截图文件缺失或不完整，请执行以下步骤："
    echo
    print_message $YELLOW "1. 生成所有截图"
    echo "   ./scripts/generate-screenshots.sh"
    echo
    print_message $YELLOW "2. 手动添加特定截图"
    echo "   - 启动系统: npm start"
    echo "   - 访问对应页面进行截图"
    echo "   - 保存到 screenshots/ 目录"
    echo
    print_message $YELLOW "3. 验证截图质量"
    echo "   - 检查图片清晰度"
    echo "   - 确认功能展示完整"
    echo "   - 验证文件大小合理"
    echo
    print_message $YELLOW "4. 重新检查"
    echo "   ./scripts/check-screenshots.sh"
}

# 主函数
main() {
    local generate_report=false
    local show_fix=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            --report)
                generate_report=true
                shift
                ;;
            --fix)
                show_fix=true
                shift
                ;;
            *)
                echo "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_header "班级积分管理系统 - 截图检查"
    
    local check1_result=0
    local check2_result=0
    
    check_screenshots || check1_result=$?
    check_readme_references || check2_result=$?
    
    if [ "$generate_report" = true ]; then
        generate_report
    fi
    
    if [ "$show_fix" = true ]; then
        show_fix_suggestions
    fi
    
    echo
    if [ $check1_result -eq 0 ] && [ $check2_result -eq 0 ]; then
        print_message $GREEN "🎉 所有检查都通过了！截图已完整。"
        exit 0
    else
        print_message $RED "❌ 发现问题，请修复后重新检查。"
        if [ "$show_fix" = false ]; then
            echo
            print_message $YELLOW "💡 使用 --fix 参数查看修复建议"
        fi
        exit 1
    fi
}

# 运行主函数
main "$@"