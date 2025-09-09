// 加载状态和进度指示器管理系统

class LoadingManager {
    constructor() {
        this.activeLoaders = new Map();
        this.globalLoadingCount = 0;
        this.setupStyles();
        this.setupGlobalLoader();
    }

    // 设置样式
    setupStyles() {
        if (document.getElementById('loadingManagerStyles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'loadingManagerStyles';
        style.textContent = `
            /* 全局加载遮罩 */
            .global-loading-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(2px);
            }

            .global-loading-content {
                background: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                min-width: 200px;
            }

            /* 加载动画 */
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            }

            .loading-dots {
                display: inline-block;
                position: relative;
                width: 80px;
                height: 80px;
            }

            .loading-dots div {
                position: absolute;
                top: 33px;
                width: 13px;
                height: 13px;
                border-radius: 50%;
                background: #007bff;
                animation-timing-function: cubic-bezier(0, 1, 1, 0);
            }

            .loading-dots div:nth-child(1) {
                left: 8px;
                animation: dots1 0.6s infinite;
            }

            .loading-dots div:nth-child(2) {
                left: 8px;
                animation: dots2 0.6s infinite;
            }

            .loading-dots div:nth-child(3) {
                left: 32px;
                animation: dots2 0.6s infinite;
            }

            .loading-dots div:nth-child(4) {
                left: 56px;
                animation: dots3 0.6s infinite;
            }

            /* 进度条 */
            .progress-bar-container {
                width: 100%;
                height: 6px;
                background: #f0f0f0;
                border-radius: 3px;
                overflow: hidden;
                margin: 10px 0;
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #007bff, #0056b3);
                border-radius: 3px;
                transition: width 0.3s ease;
                position: relative;
            }

            .progress-bar.indeterminate {
                width: 30% !important;
                animation: indeterminate 2s infinite linear;
            }

            .progress-text {
                font-size: 14px;
                color: #666;
                margin-top: 5px;
            }

            /* 按钮加载状态 */
            .btn-loading {
                position: relative;
                pointer-events: none;
                opacity: 0.7;
            }

            .btn-loading::after {
                content: '';
                position: absolute;
                width: 16px;
                height: 16px;
                top: 50%;
                left: 50%;
                margin-left: -8px;
                margin-top: -8px;
                border: 2px solid transparent;
                border-top-color: currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .btn-loading .btn-text {
                opacity: 0;
            }

            /* 表单加载状态 */
            .form-loading {
                position: relative;
                pointer-events: none;
            }

            .form-loading::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.8);
                z-index: 10;
            }

            .form-loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 30px;
                height: 30px;
                margin: -15px 0 0 -15px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                z-index: 11;
            }

            /* 内联加载指示器 */
            .inline-loading {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .inline-loading .mini-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #007bff;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            /* 骨架屏 */
            .skeleton {
                background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
            }

            .skeleton-text {
                height: 16px;
                border-radius: 4px;
                margin: 8px 0;
            }

            .skeleton-title {
                height: 24px;
                border-radius: 4px;
                margin: 12px 0;
                width: 60%;
            }

            .skeleton-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
            }

            /* 动画定义 */
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes dots1 {
                0% { transform: scale(0); }
                100% { transform: scale(1); }
            }

            @keyframes dots3 {
                0% { transform: scale(1); }
                100% { transform: scale(0); }
            }

            @keyframes dots2 {
                0% { transform: translate(0, 0); }
                100% { transform: translate(24px, 0); }
            }

            @keyframes indeterminate {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(300%); }
            }

            @keyframes skeleton-loading {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }

            /* 响应式调整 */
            @media (max-width: 768px) {
                .global-loading-content {
                    padding: 20px;
                    margin: 20px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // 设置全局加载器
    setupGlobalLoader() {
        this.globalLoader = document.createElement('div');
        this.globalLoader.className = 'global-loading-overlay';
        this.globalLoader.style.display = 'none';
        this.globalLoader.innerHTML = `
            <div class="global-loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-message">正在加载...</div>
                <div class="progress-bar-container" style="display: none;">
                    <div class="progress-bar" style="width: 0%;"></div>
                </div>
                <div class="progress-text" style="display: none;"></div>
            </div>
        `;
        document.body.appendChild(this.globalLoader);
    }

    // 显示全局加载
    showGlobalLoading(message = '正在加载...', options = {}) {
        const { 
            showProgress = false, 
            cancellable = false,
            timeout = 0
        } = options;

        this.globalLoadingCount++;
        
        const messageEl = this.globalLoader.querySelector('.loading-message');
        const progressContainer = this.globalLoader.querySelector('.progress-bar-container');
        const progressText = this.globalLoader.querySelector('.progress-text');
        
        messageEl.textContent = message;
        progressContainer.style.display = showProgress ? 'block' : 'none';
        progressText.style.display = showProgress ? 'block' : 'none';
        
        this.globalLoader.style.display = 'flex';
        
        // 添加取消按钮
        if (cancellable && !this.globalLoader.querySelector('.cancel-btn')) {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'cancel-btn';
            cancelBtn.textContent = '取消';
            cancelBtn.style.cssText = `
                margin-top: 15px;
                padding: 8px 16px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            `;
            cancelBtn.onclick = () => this.hideGlobalLoading();
            this.globalLoader.querySelector('.global-loading-content').appendChild(cancelBtn);
        }
        
        // 设置超时
        if (timeout > 0) {
            setTimeout(() => {
                this.hideGlobalLoading();
                showMessage('操作超时，请重试', 'warning');
            }, timeout);
        }
        
        return this.createLoadingController('global');
    }

    // 隐藏全局加载
    hideGlobalLoading() {
        this.globalLoadingCount = Math.max(0, this.globalLoadingCount - 1);
        
        if (this.globalLoadingCount === 0) {
            this.globalLoader.style.display = 'none';
            
            // 移除取消按钮
            const cancelBtn = this.globalLoader.querySelector('.cancel-btn');
            if (cancelBtn) {
                cancelBtn.remove();
            }
        }
    }

    // 更新全局加载进度
    updateGlobalProgress(progress, text = '') {
        const progressBar = this.globalLoader.querySelector('.progress-bar');
        const progressText = this.globalLoader.querySelector('.progress-text');
        
        if (progressBar) {
            progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            progressBar.classList.remove('indeterminate');
        }
        
        if (progressText && text) {
            progressText.textContent = text;
        }
    }

    // 显示按钮加载状态
    showButtonLoading(button, text = '') {
        if (typeof button === 'string') {
            button = document.querySelector(button);
        }
        
        if (!button) return null;
        
        const originalText = button.textContent;
        const originalDisabled = button.disabled;
        
        button.classList.add('btn-loading');
        button.disabled = true;
        
        if (text) {
            button.innerHTML = `<span class="btn-text">${text}</span>`;
        }
        
        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, {
            type: 'button',
            element: button,
            originalText,
            originalDisabled
        });
        
        return this.createLoadingController(loaderId);
    }

    // 隐藏按钮加载状态
    hideButtonLoading(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'button') return;
        
        const button = loader.element;
        button.classList.remove('btn-loading');
        button.disabled = loader.originalDisabled;
        button.textContent = loader.originalText;
        
        this.activeLoaders.delete(loaderId);
    }

    // 显示表单加载状态
    showFormLoading(form) {
        if (typeof form === 'string') {
            form = document.querySelector(form);
        }
        
        if (!form) return null;
        
        form.classList.add('form-loading');
        
        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, {
            type: 'form',
            element: form
        });
        
        return this.createLoadingController(loaderId);
    }

    // 隐藏表单加载状态
    hideFormLoading(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'form') return;
        
        loader.element.classList.remove('form-loading');
        this.activeLoaders.delete(loaderId);
    }

    // 显示内联加载指示器
    showInlineLoading(container, message = '加载中...') {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (!container) return null;
        
        const originalContent = container.innerHTML;
        container.innerHTML = `
            <div class="inline-loading">
                <div class="mini-spinner"></div>
                <span>${message}</span>
            </div>
        `;
        
        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, {
            type: 'inline',
            element: container,
            originalContent
        });
        
        return this.createLoadingController(loaderId);
    }

    // 隐藏内联加载指示器
    hideInlineLoading(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'inline') return;
        
        loader.element.innerHTML = loader.originalContent;
        this.activeLoaders.delete(loaderId);
    }

    // 显示骨架屏
    showSkeleton(container, config = {}) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (!container) return null;
        
        const {
            lines = 3,
            showTitle = true,
            showAvatar = false,
            customTemplate = null
        } = config;
        
        const originalContent = container.innerHTML;
        
        if (customTemplate) {
            container.innerHTML = customTemplate;
        } else {
            let skeletonHTML = '';
            
            if (showAvatar) {
                skeletonHTML += '<div class="skeleton skeleton-avatar"></div>';
            }
            
            if (showTitle) {
                skeletonHTML += '<div class="skeleton skeleton-title"></div>';
            }
            
            for (let i = 0; i < lines; i++) {
                const width = i === lines - 1 ? '60%' : '100%';
                skeletonHTML += `<div class="skeleton skeleton-text" style="width: ${width};"></div>`;
            }
            
            container.innerHTML = skeletonHTML;
        }
        
        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, {
            type: 'skeleton',
            element: container,
            originalContent
        });
        
        return this.createLoadingController(loaderId);
    }

    // 隐藏骨架屏
    hideSkeleton(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'skeleton') return;
        
        loader.element.innerHTML = loader.originalContent;
        this.activeLoaders.delete(loaderId);
    }

    // 创建进度条
    createProgressBar(container, options = {}) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        
        if (!container) return null;
        
        const {
            showText = true,
            indeterminate = false,
            color = '#007bff'
        } = options;
        
        const progressHTML = `
            <div class="progress-bar-container">
                <div class="progress-bar ${indeterminate ? 'indeterminate' : ''}" 
                     style="background: ${color}; width: ${indeterminate ? '30%' : '0%'};"></div>
            </div>
            ${showText ? '<div class="progress-text">0%</div>' : ''}
        `;
        
        container.innerHTML = progressHTML;
        
        const loaderId = this.generateLoaderId();
        this.activeLoaders.set(loaderId, {
            type: 'progress',
            element: container,
            progressBar: container.querySelector('.progress-bar'),
            progressText: container.querySelector('.progress-text')
        });
        
        return {
            update: (progress, text) => this.updateProgress(loaderId, progress, text),
            complete: () => this.completeProgress(loaderId),
            remove: () => this.removeProgress(loaderId)
        };
    }

    // 更新进度条
    updateProgress(loaderId, progress, text = '') {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'progress') return;
        
        if (loader.progressBar) {
            loader.progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
            loader.progressBar.classList.remove('indeterminate');
        }
        
        if (loader.progressText) {
            loader.progressText.textContent = text || `${Math.round(progress)}%`;
        }
    }

    // 完成进度条
    completeProgress(loaderId) {
        this.updateProgress(loaderId, 100, '完成');
        
        setTimeout(() => {
            this.removeProgress(loaderId);
        }, 1000);
    }

    // 移除进度条
    removeProgress(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader || loader.type !== 'progress') return;
        
        loader.element.innerHTML = '';
        this.activeLoaders.delete(loaderId);
    }

    // 创建加载控制器
    createLoadingController(loaderId) {
        return {
            hide: () => this.hideLoader(loaderId),
            updateProgress: (progress, text) => {
                if (loaderId === 'global') {
                    this.updateGlobalProgress(progress, text);
                } else {
                    this.updateProgress(loaderId, progress, text);
                }
            },
            updateMessage: (message) => {
                if (loaderId === 'global') {
                    const messageEl = this.globalLoader.querySelector('.loading-message');
                    if (messageEl) messageEl.textContent = message;
                }
            }
        };
    }

    // 隐藏加载器
    hideLoader(loaderId) {
        if (loaderId === 'global') {
            this.hideGlobalLoading();
            return;
        }
        
        const loader = this.activeLoaders.get(loaderId);
        if (!loader) return;
        
        switch (loader.type) {
            case 'button':
                this.hideButtonLoading(loaderId);
                break;
            case 'form':
                this.hideFormLoading(loaderId);
                break;
            case 'inline':
                this.hideInlineLoading(loaderId);
                break;
            case 'skeleton':
                this.hideSkeleton(loaderId);
                break;
            case 'progress':
                this.removeProgress(loaderId);
                break;
        }
    }

    // 生成加载器ID
    generateLoaderId() {
        return 'loader_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 清除所有加载状态
    clearAllLoading() {
        // 隐藏全局加载
        this.globalLoadingCount = 0;
        this.hideGlobalLoading();
        
        // 清除所有活动的加载器
        for (const [loaderId] of this.activeLoaders) {
            this.hideLoader(loaderId);
        }
        
        this.activeLoaders.clear();
    }

    // 获取活动加载器数量
    getActiveLoadersCount() {
        return this.activeLoaders.size + (this.globalLoadingCount > 0 ? 1 : 0);
    }

    // 包装异步操作
    async wrapAsyncOperation(operation, options = {}) {
        const {
            type = 'global',
            target = null,
            message = '正在处理...',
            showProgress = false,
            timeout = 30000
        } = options;
        
        let controller;
        
        try {
            // 显示加载状态
            switch (type) {
                case 'global':
                    controller = this.showGlobalLoading(message, { showProgress, timeout });
                    break;
                case 'button':
                    controller = this.showButtonLoading(target, message);
                    break;
                case 'form':
                    controller = this.showFormLoading(target);
                    break;
                case 'inline':
                    controller = this.showInlineLoading(target, message);
                    break;
            }
            
            // 执行操作
            const result = await operation(controller);
            
            return result;
            
        } catch (error) {
            // 处理错误
            if (window.errorHandler) {
                window.errorHandler.handleError(error, { context: 'async_operation' });
            } else {
                console.error('异步操作失败:', error);
                showMessage(error.message || '操作失败', 'error');
            }
            throw error;
            
        } finally {
            // 隐藏加载状态
            if (controller) {
                controller.hide();
            }
        }
    }
}

// 创建全局加载管理器实例
window.loadingManager = new LoadingManager();

// 导出便捷函数
window.showLoading = (message, options) => window.loadingManager.showGlobalLoading(message, options);
window.hideLoading = () => window.loadingManager.hideGlobalLoading();
window.showButtonLoading = (button, text) => window.loadingManager.showButtonLoading(button, text);
window.showFormLoading = (form) => window.loadingManager.showFormLoading(form);
window.wrapAsync = (operation, options) => window.loadingManager.wrapAsyncOperation(operation, options);