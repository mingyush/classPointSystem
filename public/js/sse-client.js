/**
 * SSE客户端工具类
 * 处理Server-Sent Events连接和消息处理
 */
class SSEClient {
    constructor(options = {}) {
        this.url = options.url || '/api/sse/events';
        this.eventSource = null;
        this.reconnectInterval = options.reconnectInterval || 5000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.eventHandlers = new Map();
        this.onConnectionChange = options.onConnectionChange || null;
        this.autoReconnect = options.autoReconnect !== false;
        
        // 绑定方法到实例
        this.handleOpen = this.handleOpen.bind(this);
        this.handleError = this.handleError.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * 连接到SSE服务器
     */
    connect() {
        if (this.eventSource && this.eventSource.readyState !== EventSource.CLOSED) {
            console.log('SSE连接已存在');
            return;
        }

        try {
            console.log('正在连接SSE服务器...');
            this.eventSource = new EventSource(this.url);
            
            // 设置事件监听器
            this.eventSource.addEventListener('open', this.handleOpen);
            this.eventSource.addEventListener('error', this.handleError);
            this.eventSource.addEventListener('message', this.handleMessage);
            
            // 设置自定义事件监听器
            this.setupCustomEventListeners();
            
        } catch (error) {
            console.error('创建SSE连接失败:', error);
            this.handleConnectionError();
        }
    }

    /**
     * 断开SSE连接
     */
    disconnect() {
        this.autoReconnect = false;
        
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        
        this.isConnected = false;
        this.reconnectAttempts = 0;
        
        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
        
        console.log('SSE连接已断开');
    }

    /**
     * 处理连接打开事件
     */
    handleOpen(event) {
        console.log('SSE连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        if (this.onConnectionChange) {
            this.onConnectionChange(true);
        }
    }

    /**
     * 处理连接错误事件
     */
    handleError(event) {
        console.error('SSE连接错误:', event);
        this.isConnected = false;
        
        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
        
        this.handleConnectionError();
    }

    /**
     * 处理普通消息事件
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('收到SSE消息:', data);
            this.emit('message', data);
        } catch (error) {
            console.error('解析SSE消息失败:', error);
        }
    }

    /**
     * 设置自定义事件监听器
     */
    setupCustomEventListeners() {
        if (!this.eventSource) return;

        // 连接确认事件
        this.eventSource.addEventListener('connected', (event) => {
            const data = JSON.parse(event.data);
            console.log('SSE连接确认:', data);
            this.emit('connected', data);
        });

        // 心跳事件
        this.eventSource.addEventListener('heartbeat', (event) => {
            const data = JSON.parse(event.data);
            this.emit('heartbeat', data);
        });

        // 积分更新事件
        this.eventSource.addEventListener('points_updated', (event) => {
            const data = JSON.parse(event.data);
            console.log('积分更新:', data);
            this.emit('points_updated', data);
        });

        // 排行榜更新事件
        this.eventSource.addEventListener('rankings_updated', (event) => {
            const data = JSON.parse(event.data);
            console.log('排行榜更新:', data);
            this.emit('rankings_updated', data);
        });

        // 模式变更事件
        this.eventSource.addEventListener('mode_changed', (event) => {
            const data = JSON.parse(event.data);
            console.log('模式变更:', data);
            this.emit('mode_changed', data);
        });

        // 商品更新事件
        this.eventSource.addEventListener('product_updated', (event) => {
            const data = JSON.parse(event.data);
            console.log('商品更新:', data);
            this.emit('product_updated', data);
        });

        // 订单更新事件
        this.eventSource.addEventListener('order_updated', (event) => {
            const data = JSON.parse(event.data);
            console.log('订单更新:', data);
            this.emit('order_updated', data);
        });

        // 配置更新事件
        this.eventSource.addEventListener('config_updated', (event) => {
            const data = JSON.parse(event.data);
            console.log('配置更新:', data);
            this.emit('config_updated', data);
        });

        // 数据重置事件
        this.eventSource.addEventListener('data_reset', (event) => {
            const data = JSON.parse(event.data);
            console.log('数据重置:', data);
            this.emit('data_reset', data);
        });

        // 错误事件
        this.eventSource.addEventListener('error', (event) => {
            const data = JSON.parse(event.data);
            console.error('服务器错误:', data);
            this.emit('server_error', data);
        });

        // 通知事件
        this.eventSource.addEventListener('notification', (event) => {
            const data = JSON.parse(event.data);
            console.log('通知:', data);
            this.emit('notification', data);
        });
    }

    /**
     * 处理连接错误和重连逻辑
     */
    handleConnectionError() {
        if (!this.autoReconnect) {
            return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`SSE重连失败，已达到最大重试次数 (${this.maxReconnectAttempts})`);
            this.emit('max_reconnect_attempts_reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectInterval * this.reconnectAttempts, 30000);
        
        console.log(`SSE将在 ${delay}ms 后尝试重连 (第${this.reconnectAttempts}次)`);
        
        setTimeout(() => {
            if (this.autoReconnect) {
                this.connect();
            }
        }, delay);
    }

    /**
     * 添加事件监听器
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    /**
     * 移除事件监听器
     */
    off(event, handler) {
        if (!this.eventHandlers.has(event)) {
            return;
        }
        
        const handlers = this.eventHandlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }

    /**
     * 触发事件
     */
    emit(event, data) {
        if (!this.eventHandlers.has(event)) {
            return;
        }
        
        const handlers = this.eventHandlers.get(event);
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`事件处理器执行失败 (${event}):`, error);
            }
        });
    }

    /**
     * 获取连接状态
     */
    getConnectionState() {
        if (!this.eventSource) {
            return 'CLOSED';
        }
        
        switch (this.eventSource.readyState) {
            case EventSource.CONNECTING:
                return 'CONNECTING';
            case EventSource.OPEN:
                return 'OPEN';
            case EventSource.CLOSED:
                return 'CLOSED';
            default:
                return 'UNKNOWN';
        }
    }

    /**
     * 检查是否已连接
     */
    isConnectedToServer() {
        return this.isConnected && this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }
}

// 创建全局SSE客户端实例
window.sseClient = new SSEClient({
    onConnectionChange: (connected) => {
        // 更新连接状态指示器
        const indicator = document.querySelector('.connection-status');
        if (indicator) {
            indicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
            indicator.textContent = connected ? '已连接' : '连接断开';
        }
        
        // 显示连接状态消息
        if (window.showMessage) {
            window.showMessage(
                connected ? '实时连接已建立' : '实时连接断开，数据可能不是最新的',
                connected ? 'success' : 'warning'
            );
        }
    }
});

// 页面加载完成后自动连接
document.addEventListener('DOMContentLoaded', () => {
    // 延迟连接，确保页面完全加载
    setTimeout(() => {
        window.sseClient.connect();
    }, 1000);
});

// 页面卸载时断开连接
window.addEventListener('beforeunload', () => {
    if (window.sseClient) {
        window.sseClient.disconnect();
    }
});

// 页面可见性变化处理
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // 页面隐藏时保持连接但可以降低活动
        console.log('页面隐藏，SSE连接保持');
    } else {
        // 页面显示时确保连接正常
        if (window.sseClient && !window.sseClient.isConnectedToServer()) {
            console.log('页面显示，重新连接SSE');
            window.sseClient.connect();
        }
    }
});