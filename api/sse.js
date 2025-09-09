const express = require('express');
const router = express.Router();

// 存储所有活跃的SSE连接
const sseConnections = new Set();

/**
 * SSE连接端点
 * GET /api/sse/events
 */
router.get('/events', (req, res) => {
    // 设置SSE响应头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // 创建连接对象
    const connection = {
        id: Date.now() + Math.random(),
        response: res,
        lastPing: Date.now()
    };

    // 添加到连接池
    sseConnections.add(connection);
    console.log(`SSE连接建立，当前连接数: ${sseConnections.size}`);

    // 发送初始连接确认
    sendSSEMessage(res, 'connected', {
        message: '连接已建立',
        timestamp: new Date().toISOString(),
        connectionId: connection.id
    });

    // 定期发送心跳包
    const heartbeat = setInterval(() => {
        if (res.writableEnded) {
            clearInterval(heartbeat);
            return;
        }
        
        try {
            sendSSEMessage(res, 'heartbeat', {
                timestamp: new Date().toISOString()
            });
            connection.lastPing = Date.now();
        } catch (error) {
            console.error('发送心跳包失败:', error);
            clearInterval(heartbeat);
            sseConnections.delete(connection);
        }
    }, 30000); // 每30秒发送一次心跳

    // 处理连接关闭
    req.on('close', () => {
        clearInterval(heartbeat);
        sseConnections.delete(connection);
        console.log(`SSE连接关闭，当前连接数: ${sseConnections.size}`);
    });

    req.on('error', (error) => {
        console.error('SSE连接错误:', error);
        clearInterval(heartbeat);
        sseConnections.delete(connection);
    });
});

/**
 * 发送SSE消息的工具函数
 */
function sendSSEMessage(res, event, data) {
    if (res.writableEnded) {
        return false;
    }

    try {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        res.write(message);
        return true;
    } catch (error) {
        console.error('发送SSE消息失败:', error);
        return false;
    }
}

/**
 * 广播消息给所有连接的客户端
 */
function broadcastSSEMessage(event, data) {
    const message = {
        ...data,
        timestamp: new Date().toISOString()
    };

    console.log(`广播SSE消息: ${event}`, message);

    // 记录失效的连接
    const deadConnections = [];

    sseConnections.forEach(connection => {
        const success = sendSSEMessage(connection.response, event, message);
        if (!success) {
            deadConnections.push(connection);
        }
    });

    // 清理失效的连接
    deadConnections.forEach(connection => {
        sseConnections.delete(connection);
    });

    if (deadConnections.length > 0) {
        console.log(`清理了 ${deadConnections.length} 个失效连接，当前连接数: ${sseConnections.size}`);
    }

    return sseConnections.size;
}

/**
 * 获取连接状态
 * GET /api/sse/status
 */
router.get('/status', (req, res) => {
    res.json({
        success: true,
        data: {
            activeConnections: sseConnections.size,
            connections: Array.from(sseConnections).map(conn => ({
                id: conn.id,
                lastPing: conn.lastPing,
                connected: !conn.response.writableEnded
            }))
        }
    });
});

/**
 * 手动触发测试消息
 * POST /api/sse/test
 */
router.post('/test', (req, res) => {
    const { event = 'test', message = '测试消息' } = req.body;
    
    const sentCount = broadcastSSEMessage(event, {
        message,
        source: 'manual_test'
    });

    res.json({
        success: true,
        message: `测试消息已发送给 ${sentCount} 个客户端`,
        data: {
            event,
            sentCount,
            activeConnections: sseConnections.size
        }
    });
});

// 导出广播函数供其他模块使用
module.exports = {
    router,
    broadcastSSEMessage,
    getConnectionCount: () => sseConnections.size
};