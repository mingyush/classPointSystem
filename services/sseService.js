/**
 * SSE服务 - 处理实时数据推送
 */
class SSEService {
    constructor() {
        this.broadcastFunction = null;
    }

    /**
     * 设置广播函数（由SSE路由模块提供）
     */
    setBroadcastFunction(broadcastFn) {
        this.broadcastFunction = broadcastFn;
    }

    /**
     * 广播积分变更事件
     */
    broadcastPointsUpdate(data) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('points_updated', {
            type: 'points_update',
            studentId: data.studentId,
            points: data.points,
            newBalance: data.newBalance,
            reason: data.reason,
            operatorId: data.operatorId,
            recordId: data.recordId
        });
    }

    /**
     * 广播排行榜更新事件
     */
    broadcastRankingsUpdate(rankings) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('rankings_updated', {
            type: 'rankings_update',
            rankings: rankings
        });
    }

    /**
     * 广播系统模式变更事件
     */
    broadcastModeChange(mode) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('mode_changed', {
            type: 'mode_change',
            mode: mode,
            modeText: mode === 'class' ? '上课模式' : '平时模式'
        });
    }

    /**
     * 广播商品更新事件
     */
    broadcastProductUpdate(data) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('product_updated', {
            type: 'product_update',
            action: data.action, // 'created', 'updated', 'deleted'
            product: data.product
        });
    }

    /**
     * 广播订单状态变更事件
     */
    broadcastOrderUpdate(data) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('order_updated', {
            type: 'order_update',
            action: data.action, // 'created', 'confirmed', 'cancelled'
            order: data.order,
            studentId: data.studentId
        });
    }

    /**
     * 广播学生数据更新事件
     */
    broadcastStudentUpdate(data) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('student_updated', {
            type: 'student_update',
            action: data.action, // 'created', 'updated', 'deleted'
            student: data.student
        });
    }

    /**
     * 广播系统配置更新事件
     */
    broadcastConfigUpdate(config) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('config_updated', {
            type: 'config_update',
            config: config
        });
    }

    /**
     * 广播数据重置事件
     */
    broadcastDataReset(type) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('data_reset', {
            type: 'data_reset',
            resetType: type, // 'points', 'all'
            message: type === 'points' ? '积分数据已重置' : '所有数据已重置'
        });
    }

    /**
     * 广播错误事件
     */
    broadcastError(error) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('error', {
            type: 'error',
            message: error.message || '系统错误',
            code: error.code || 'UNKNOWN_ERROR'
        });
    }

    /**
     * 广播通知消息
     */
    broadcastNotification(notification) {
        if (!this.broadcastFunction) {
            console.warn('SSE广播函数未设置');
            return;
        }

        this.broadcastFunction('notification', {
            type: 'notification',
            level: notification.level || 'info', // 'info', 'success', 'warning', 'error'
            message: notification.message,
            title: notification.title,
            duration: notification.duration || 5000
        });
    }

    /**
     * 检查SSE服务是否可用
     */
    isAvailable() {
        return this.broadcastFunction !== null;
    }
}

// 创建单例实例
const sseService = new SSEService();

module.exports = sseService;