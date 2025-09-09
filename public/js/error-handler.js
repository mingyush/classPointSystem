// 全局错误处理和用户反馈系统

class ErrorHandler {
    constructor() {
        this.errorQueue = [];
        this.isProcessing = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.setupGlobalErrorHandlers();
        this.setupNetworkMonitoring();
    }

    // 设置全局错误处理器
    setupGlobalErrorHandlers() {
        // 捕获未处理的Promise错误
        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise错误:', event.reason);
            this.handleError(event.reason, {
                type: 'promise',
                context: 'global'
            });
            event.preventDefault();
        });

        // 捕获JavaScript运行时错误
        window.addEventListener('error', (event) => {
            console.error('JavaScript错误:', event.error);
            this.handleError(event.error, {
                type: 'javascript',
                context: 'global',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                console.error('资源加载错误:', event.target);
                this.handleError(new Error(`资源加载失败: ${event.target.src || event.target.href}`), {
                    type: 'resource',
                    context: 'global',
                    element: event.target.tagName
                });
            }
        }, true);
    }

    // 设置网络监控
    setupNetworkMonitoring() {
        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.handleNetworkStatusChange(true);
        });

        window.addEventListener('offline', () => {
            this.handleNetworkStatusChange(false);
        });

        // 初始网络状态检查
        this.checkNetworkStatus();
    }

    // 处理网络状态变化
    handleNetworkStatusChange(isOnline) {
        if (isOnline) {
            showMessage('网络连接已恢复', 'success');
            this.retryFailedRequests();
        } else {
            showMessage('网络连接断开，将使用离线模式', 'warning');
        }
    }

    // 检查网络状态
    async checkNetworkStatus() {
        try {
            const response = await fetch('/api/health', {
                method: 'HEAD',
                cache: 'no-cache'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // 主要错误处理方法
    handleError(error, context = {}) {
        const errorInfo = this.parseError(error, context);
        
        // 记录错误
        this.logError(errorInfo);
        
        // 根据错误类型决定处理方式
        switch (errorInfo.category) {
            case 'network':
                this.handleNetworkError(errorInfo);
                break;
            case 'validation':
                this.handleValidationError(errorInfo);
                break;
            case 'permission':
                this.handlePermissionError(errorInfo);
                break;
            case 'business':
                this.handleBusinessError(errorInfo);
                break;
            case 'system':
                this.handleSystemError(errorInfo);
                break;
            default:
                this.handleGenericError(errorInfo);
        }

        return errorInfo;
    }

    // 解析错误信息
    parseError(error, context) {
        const errorInfo = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            message: error.message || '未知错误',
            stack: error.stack,
            context: context,
            category: this.categorizeError(error),
            severity: this.determineSeverity(error, context),
            userMessage: this.generateUserMessage(error, context),
            actionable: this.isActionable(error, context),
            retryable: this.isRetryable(error, context)
        };

        return errorInfo;
    }

    // 错误分类
    categorizeError(error) {
        const message = error.message?.toLowerCase() || '';
        
        if (message.includes('fetch') || message.includes('network') || message.includes('连接')) {
            return 'network';
        }
        if (message.includes('validation') || message.includes('验证') || message.includes('格式')) {
            return 'validation';
        }
        if (message.includes('permission') || message.includes('权限') || message.includes('unauthorized')) {
            return 'permission';
        }
        if (message.includes('business') || message.includes('业务') || message.includes('规则')) {
            return 'business';
        }
        if (error.name === 'TypeError' || error.name === 'ReferenceError') {
            return 'system';
        }
        
        return 'generic';
    }

    // 确定错误严重程度
    determineSeverity(error, context) {
        if (context.type === 'javascript' || context.type === 'system') {
            return 'high';
        }
        if (context.type === 'network' && !navigator.onLine) {
            return 'medium';
        }
        if (context.type === 'validation') {
            return 'low';
        }
        
        return 'medium';
    }

    // 生成用户友好的错误消息
    generateUserMessage(error, context) {
        const message = error.message?.toLowerCase() || '';
        
        if (message.includes('fetch') || message.includes('network')) {
            return '网络连接异常，请检查网络设置后重试';
        }
        if (message.includes('timeout')) {
            return '请求超时，请稍后重试';
        }
        if (message.includes('unauthorized') || message.includes('权限')) {
            return '权限不足，请重新登录';
        }
        if (message.includes('validation') || message.includes('验证')) {
            return '输入信息有误，请检查后重新提交';
        }
        if (message.includes('not found') || message.includes('404')) {
            return '请求的资源不存在';
        }
        if (message.includes('server error') || message.includes('500')) {
            return '服务器内部错误，请稍后重试';
        }
        
        return '操作失败，请重试或联系管理员';
    }

    // 判断错误是否可操作
    isActionable(error, context) {
        const category = this.categorizeError(error);
        return ['network', 'validation', 'permission'].includes(category);
    }

    // 判断错误是否可重试
    isRetryable(error, context) {
        const category = this.categorizeError(error);
        return ['network', 'business'].includes(category);
    }

    // 处理网络错误
    handleNetworkError(errorInfo) {
        if (!navigator.onLine) {
            showMessage('网络连接断开，请检查网络设置', 'error', 5000);
            return;
        }

        if (errorInfo.retryable) {
            this.queueForRetry(errorInfo);
        } else {
            showMessage(errorInfo.userMessage, 'error');
        }
    }

    // 处理验证错误
    handleValidationError(errorInfo) {
        showMessage(errorInfo.userMessage, 'warning');
        
        // 如果有具体的表单字段信息，高亮显示
        if (errorInfo.context.field) {
            this.highlightErrorField(errorInfo.context.field);
        }
    }

    // 处理权限错误
    handlePermissionError(errorInfo) {
        showMessage(errorInfo.userMessage, 'error');
        
        // 可能需要重新登录
        setTimeout(() => {
            if (confirm('权限验证失败，是否重新登录？')) {
                this.redirectToLogin();
            }
        }, 2000);
    }

    // 处理业务错误
    handleBusinessError(errorInfo) {
        showMessage(errorInfo.userMessage, 'warning');
    }

    // 处理系统错误
    handleSystemError(errorInfo) {
        console.error('系统错误:', errorInfo);
        showMessage('系统出现异常，页面将自动刷新', 'error');
        
        // 严重系统错误时考虑刷新页面
        if (errorInfo.severity === 'high') {
            setTimeout(() => {
                if (confirm('系统出现严重错误，是否刷新页面？')) {
                    window.location.reload();
                }
            }, 3000);
        }
    }

    // 处理通用错误
    handleGenericError(errorInfo) {
        showMessage(errorInfo.userMessage, 'error');
    }

    // 队列重试
    queueForRetry(errorInfo) {
        if (errorInfo.retryCount >= this.maxRetries) {
            showMessage('多次重试失败，请检查网络连接', 'error');
            return;
        }

        this.errorQueue.push({
            ...errorInfo,
            retryCount: (errorInfo.retryCount || 0) + 1,
            nextRetryTime: Date.now() + (this.retryDelay * Math.pow(2, errorInfo.retryCount || 0))
        });

        this.processRetryQueue();
    }

    // 处理重试队列
    async processRetryQueue() {
        if (this.isProcessing || this.errorQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.errorQueue.length > 0) {
            const errorInfo = this.errorQueue.shift();
            
            if (Date.now() < errorInfo.nextRetryTime) {
                // 还没到重试时间，放回队列
                this.errorQueue.unshift(errorInfo);
                break;
            }

            try {
                await this.retryOperation(errorInfo);
            } catch (retryError) {
                this.queueForRetry({
                    ...errorInfo,
                    retryCount: errorInfo.retryCount + 1
                });
            }
        }

        this.isProcessing = false;

        // 如果队列还有项目，设置下次处理时间
        if (this.errorQueue.length > 0) {
            const nextRetryTime = Math.min(...this.errorQueue.map(e => e.nextRetryTime));
            const delay = Math.max(0, nextRetryTime - Date.now());
            setTimeout(() => this.processRetryQueue(), delay);
        }
    }

    // 重试操作
    async retryOperation(errorInfo) {
        // 这里需要根据具体的错误上下文来决定如何重试
        // 例如重新发送API请求等
        console.log('重试操作:', errorInfo);
    }

    // 重试所有失败的请求
    async retryFailedRequests() {
        const networkErrors = this.errorQueue.filter(e => e.category === 'network');
        for (const errorInfo of networkErrors) {
            try {
                await this.retryOperation(errorInfo);
                // 从队列中移除成功的项目
                const index = this.errorQueue.indexOf(errorInfo);
                if (index > -1) {
                    this.errorQueue.splice(index, 1);
                }
            } catch (error) {
                // 重试失败，保持在队列中
            }
        }
    }

    // 高亮错误字段
    highlightErrorField(fieldName) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (field) {
            field.classList.add('error-field');
            field.focus();
            
            // 3秒后移除高亮
            setTimeout(() => {
                field.classList.remove('error-field');
            }, 3000);
        }
    }

    // 重定向到登录页面
    redirectToLogin() {
        // 清除本地存储的用户信息
        storage.remove('currentStudent');
        storage.remove('teacherToken');
        
        // 根据当前页面重定向
        if (window.location.pathname.includes('teacher')) {
            window.location.href = '/teacher';
        } else if (window.location.pathname.includes('student')) {
            window.location.href = '/student';
        } else {
            window.location.reload();
        }
    }

    // 记录错误
    logError(errorInfo) {
        // 发送错误日志到服务器（如果网络可用）
        if (navigator.onLine) {
            this.sendErrorLog(errorInfo).catch(err => {
                console.warn('发送错误日志失败:', err);
            });
        }

        // 本地存储错误日志
        this.storeErrorLocally(errorInfo);
    }

    // 发送错误日志到服务器
    async sendErrorLog(errorInfo) {
        try {
            await fetch('/api/logs/error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...errorInfo,
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            // 发送失败，忽略
        }
    }

    // 本地存储错误日志
    storeErrorLocally(errorInfo) {
        try {
            const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            logs.push(errorInfo);
            
            // 只保留最近100条错误日志
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }
            
            localStorage.setItem('errorLogs', JSON.stringify(logs));
        } catch (error) {
            console.warn('存储错误日志失败:', error);
        }
    }

    // 生成错误ID
    generateErrorId() {
        return 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 获取错误统计
    getErrorStats() {
        try {
            const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            const stats = {
                total: logs.length,
                byCategory: {},
                bySeverity: {},
                recent: logs.slice(-10)
            };

            logs.forEach(log => {
                stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
                stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
            });

            return stats;
        } catch (error) {
            return { total: 0, byCategory: {}, bySeverity: {}, recent: [] };
        }
    }

    // 清除错误日志
    clearErrorLogs() {
        localStorage.removeItem('errorLogs');
    }
}

// 创建全局错误处理器实例
window.errorHandler = new ErrorHandler();

// 导出错误处理函数供其他模块使用
window.handleError = (error, context) => window.errorHandler.handleError(error, context);