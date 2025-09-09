/**
 * 简单的SSE功能测试
 */
const request = require('supertest');
const express = require('express');
const sseService = require('../services/sseService');
const { router: sseRouter, broadcastSSEMessage } = require('../api/sse');

// 创建测试应用
const app = express();
app.use(express.json());

// 设置SSE服务
sseService.setBroadcastFunction(broadcastSSEMessage);
app.use('/api/sse', sseRouter);

describe('SSE Simple Tests', () => {
    let server;

    beforeAll((done) => {
        server = app.listen(0, done); // 使用随机端口
    });

    afterAll((done) => {
        server.close(done);
    });

    test('SSE状态API应该正常工作', async () => {
        const response = await request(app)
            .get('/api/sse/status')
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('activeConnections');
        expect(response.body.data).toHaveProperty('connections');
        expect(typeof response.body.data.activeConnections).toBe('number');
        expect(Array.isArray(response.body.data.connections)).toBe(true);
    });

    test('SSE测试API应该能够发送消息', async () => {
        const testMessage = {
            event: 'test_event',
            message: '这是一个测试消息'
        };

        const response = await request(app)
            .post('/api/sse/test')
            .send(testMessage)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('测试消息已发送');
        expect(response.body.data.event).toBe(testMessage.event);
        expect(response.body.data.sentCount).toBeGreaterThanOrEqual(0);
    });

    test('SSE服务应该能够设置广播函数', () => {
        expect(sseService.isAvailable()).toBe(true);
    });

    test('SSE服务应该能够广播积分更新', () => {
        const testData = {
            studentId: 'TEST001',
            points: 10,
            newBalance: 100,
            reason: '测试加分',
            operatorId: 'admin',
            recordId: 'RECORD001'
        };

        // 这个测试只验证方法调用不会出错
        expect(() => {
            sseService.broadcastPointsUpdate(testData);
        }).not.toThrow();
    });

    test('SSE服务应该能够广播模式变更', () => {
        const testMode = 'class';

        // 这个测试只验证方法调用不会出错
        expect(() => {
            sseService.broadcastModeChange(testMode);
        }).not.toThrow();
    });

    test('SSE服务应该能够广播排行榜更新', () => {
        const testRankings = {
            total: [{ id: 'TEST001', name: '测试学生', balance: 100 }],
            daily: [{ id: 'TEST001', name: '测试学生', points: 10 }],
            weekly: [{ id: 'TEST001', name: '测试学生', points: 50 }]
        };

        // 这个测试只验证方法调用不会出错
        expect(() => {
            sseService.broadcastRankingsUpdate(testRankings);
        }).not.toThrow();
    });

    test('SSE服务应该能够广播通知消息', () => {
        const testNotification = {
            level: 'info',
            message: '这是一个测试通知',
            title: '测试标题',
            duration: 3000
        };

        // 这个测试只验证方法调用不会出错
        expect(() => {
            sseService.broadcastNotification(testNotification);
        }).not.toThrow();
    });
});

console.log('✅ SSE简单功能测试完成！');