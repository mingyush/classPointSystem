#!/bin/bash

# 班级积分管理系统 - 自动化部署脚本
# 支持前端和Workers的完整部署流程

set -e  # 遇到错误立即退出

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

# 显示帮助信息
show_help() {
    echo "班级积分管理系统 - 部署脚本"
    echo ""
    echo "用法: $0 [选项] [目标]"
    echo ""
    echo "目标:"
    echo "  frontend     部署前端应用"
    echo "  workers      部署Cloudflare Workers"
    echo "  all          部署前端和Workers（默认）"
    echo ""
    echo "选项:"
    echo "  -e, --env ENV        部署环境 (dev|staging|prod，默认: dev)"
    echo "  -f, --force          强制部署，跳过确认"
    echo "  -s, --skip-build     跳过构建步骤"
    echo "  -t, --skip-test      跳过测试步骤"
    echo "  -m, --migrate        部署后执行数据迁移"
    echo "  -v, --verbose        详细输出"
    echo "  -h, --help           显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 frontend -e prod          # 部署前端到生产环境"
    echo "  $0 workers -e staging -m     # 部署Workers到预发布环境并执行迁移"
    echo "  $0 all -e prod -f            # 强制部署所有组件到生产环境"
}

# 默认参数
ENV="dev"
TARGET="all"
FORCE=false
SKIP_BUILD=false
SKIP_TEST=false
MIGRATE=false
VERBOSE=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENV="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -t|--skip-test)
            SKIP_TEST=true
            shift
            ;;
        -m|--migrate)
            MIGRATE=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        frontend|workers|all)
            TARGET="$1"
            shift
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 验证环境参数
if [[ ! "$ENV" =~ ^(dev|staging|prod)$ ]]; then
    log_error "无效的环境: $ENV. 支持的环境: dev, staging, prod"
    exit 1
fi

# 设置详细输出
if [[ "$VERBOSE" == "true" ]]; then
    set -x
fi

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT"
WORKERS_DIR="$PROJECT_ROOT/workers"

log_info "开始部署班级积分管理系统"
log_info "环境: $ENV"
log_info "目标: $TARGET"
log_info "项目根目录: $PROJECT_ROOT"

# 检查必要的工具
check_dependencies() {
    log_info "检查依赖工具..."
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    # 检查npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    # 如果需要部署Workers，检查wrangler
    if [[ "$TARGET" == "workers" || "$TARGET" == "all" ]]; then
        if ! command -v wrangler &> /dev/null; then
            log_warning "wrangler 未安装，正在安装..."
            npm install -g wrangler
        fi
        
        # 检查wrangler登录状态
        if ! wrangler whoami &> /dev/null; then
            log_error "请先登录Cloudflare: wrangler login"
            exit 1
        fi
    fi
    
    log_success "依赖检查完成"
}

# 部署前确认
confirm_deployment() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    echo ""
    log_warning "即将部署到 $ENV 环境"
    log_warning "目标: $TARGET"
    
    if [[ "$ENV" == "prod" ]]; then
        log_warning "⚠️  这是生产环境部署！"
    fi
    
    echo ""
    read -p "确认继续部署？(y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "部署已取消"
        exit 0
    fi
}

# 运行测试
run_tests() {
    if [[ "$SKIP_TEST" == "true" ]]; then
        log_info "跳过测试步骤"
        return 0
    fi
    
    log_info "运行测试..."
    
    # 前端测试
    if [[ "$TARGET" == "frontend" || "$TARGET" == "all" ]]; then
        log_info "运行前端测试..."
        cd "$FRONTEND_DIR"
        if npm run test:unit &> /dev/null; then
            log_success "前端测试通过"
        else
            log_warning "前端测试失败或未配置，继续部署"
        fi
    fi
    
    # Workers测试
    if [[ "$TARGET" == "workers" || "$TARGET" == "all" ]]; then
        log_info "运行Workers测试..."
        cd "$WORKERS_DIR"
        if [[ -f "package.json" ]] && npm run test &> /dev/null; then
            log_success "Workers测试通过"
        else
            log_warning "Workers测试失败或未配置，继续部署"
        fi
    fi
}

# 构建前端
build_frontend() {
    log_info "构建前端应用..."
    cd "$FRONTEND_DIR"
    
    # 安装依赖
    log_info "安装前端依赖..."
    npm ci
    
    # 设置环境变量
    case $ENV in
        "dev")
            export VITE_API_BASE_URL="http://localhost:8787/api"
            export VITE_APP_ENV="development"
            ;;
        "staging")
            export VITE_API_BASE_URL="https://class-point-system-dev.your-workers-domain.workers.dev/api"
            export VITE_APP_ENV="staging"
            ;;
        "prod")
            export VITE_API_BASE_URL="https://api.your-domain.com/api"
            export VITE_APP_ENV="production"
            ;;
    esac
    
    # 构建
    log_info "构建前端应用 (环境: $ENV)..."
    npm run build
    
    log_success "前端构建完成"
}

# 部署前端
deploy_frontend() {
    log_info "部署前端应用..."
    cd "$FRONTEND_DIR"
    
    case $ENV in
        "dev")
            log_info "开发环境 - 启动本地服务器"
            log_info "运行: npm run dev"
            log_warning "请手动运行 'npm run dev' 启动开发服务器"
            ;;
        "staging"|"prod")
            # 检查是否有Vercel配置
            if [[ -f "vercel.json" ]]; then
                log_info "使用Vercel部署前端..."
                
                # 检查vercel CLI
                if ! command -v vercel &> /dev/null; then
                    log_info "安装Vercel CLI..."
                    npm install -g vercel
                fi
                
                # 部署
                if [[ "$ENV" == "prod" ]]; then
                    vercel --prod
                else
                    vercel
                fi
            else
                log_warning "未找到vercel.json配置文件"
                log_info "请手动部署前端应用，构建文件位于: dist/"
            fi
            ;;
    esac
    
    log_success "前端部署完成"
}

# 部署Workers
deploy_workers() {
    log_info "部署Cloudflare Workers..."
    cd "$WORKERS_DIR"
    
    # 安装依赖
    log_info "安装Workers依赖..."
    npm ci
    
    # 检查wrangler配置
    if [[ ! -f "wrangler.toml" ]]; then
        log_error "未找到wrangler.toml配置文件"
        exit 1
    fi
    
    # 部署
    case $ENV in
        "dev")
            log_info "部署到开发环境..."
            wrangler deploy --env development
            ;;
        "staging")
            log_info "部署到预发布环境..."
            wrangler deploy --env development  # 使用development环境作为staging
            ;;
        "prod")
            log_info "部署到生产环境..."
            wrangler deploy --env production
            ;;
    esac
    
    log_success "Workers部署完成"
}

# 执行数据迁移
run_migration() {
    if [[ "$MIGRATE" != "true" ]]; then
        return 0
    fi
    
    log_info "执行数据迁移..."
    cd "$WORKERS_DIR"
    
    # 应用数据库迁移
    case $ENV in
        "dev")
            wrangler d1 migrations apply class-point-system-db --local
            ;;
        "staging"|"prod")
            wrangler d1 migrations apply class-point-system-db
            ;;
    esac
    
    log_success "数据迁移完成"
}

# 部署后验证
verify_deployment() {
    log_info "验证部署状态..."
    
    # 验证Workers
    if [[ "$TARGET" == "workers" || "$TARGET" == "all" ]]; then
        log_info "验证Workers部署..."
        
        # 获取Workers URL
        case $ENV in
            "dev")
                WORKERS_URL="http://localhost:8787"
                ;;
            "staging")
                WORKERS_URL="https://class-point-system-dev.your-workers-domain.workers.dev"
                ;;
            "prod")
                WORKERS_URL="https://api.your-domain.com"
                ;;
        esac
        
        # 健康检查
        if curl -s "$WORKERS_URL/health" > /dev/null; then
            log_success "Workers健康检查通过"
        else
            log_warning "Workers健康检查失败，请检查部署状态"
        fi
    fi
    
    # 验证前端
    if [[ "$TARGET" == "frontend" || "$TARGET" == "all" ]]; then
        log_info "前端部署验证请手动检查应用是否正常访问"
    fi
}

# 清理函数
cleanup() {
    log_info "清理临时文件..."
    # 这里可以添加清理逻辑
}

# 主函数
main() {
    # 设置错误处理
    trap cleanup EXIT
    
    # 检查依赖
    check_dependencies
    
    # 确认部署
    confirm_deployment
    
    # 运行测试
    run_tests
    
    # 根据目标执行部署
    case $TARGET in
        "frontend")
            if [[ "$SKIP_BUILD" != "true" ]]; then
                build_frontend
            fi
            deploy_frontend
            ;;
        "workers")
            deploy_workers
            run_migration
            ;;
        "all")
            if [[ "$SKIP_BUILD" != "true" ]]; then
                build_frontend
            fi
            deploy_frontend
            deploy_workers
            run_migration
            ;;
    esac
    
    # 验证部署
    verify_deployment
    
    log_success "🎉 部署完成！"
    
    # 显示访问信息
    echo ""
    log_info "访问信息:"
    case $ENV in
        "dev")
            echo "  前端: http://localhost:5173"
            echo "  API:  http://localhost:8787"
            ;;
        "staging")
            echo "  前端: https://your-frontend-staging-url.vercel.app"
            echo "  API:  https://class-point-system-dev.your-workers-domain.workers.dev"
            ;;
        "prod")
            echo "  前端: https://your-domain.com"
            echo "  API:  https://api.your-domain.com"
            ;;
    esac
    echo ""
}

# 运行主函数
main "$@"