/**
 * 问题反馈功能模块
 * 处理用户反馈表单的显示、验证和提交
 */

// 全局反馈模块对象
window.feedbackModule = (function() {
    // 反馈弹窗元素
    let feedbackOverlay = null;
    let feedbackModal = null;
    let feedbackForm = null;

    // 初始化反馈模块
    function init() {
        createFeedbackElements();
        attachEventListeners();
        console.log('反馈模块初始化完成');
    }

    // 创建反馈相关DOM元素
    function createFeedbackElements() {
        // 创建反馈触发按钮
        const triggerButton = document.createElement('button');
        triggerButton.className = 'feedback-trigger';
        triggerButton.innerHTML = '💬';
        triggerButton.title = '问题反馈';
        triggerButton.id = 'feedbackTrigger';
        document.body.appendChild(triggerButton);

        // 创建反馈弹窗
        feedbackOverlay = document.createElement('div');
        feedbackOverlay.className = 'feedback-overlay';
        feedbackOverlay.id = 'feedbackOverlay';
        feedbackOverlay.style.display = 'none';
        feedbackOverlay.innerHTML = `
            <div class="feedback-modal" id="feedbackModal">
                <div class="feedback-header">
                    <h2>问题反馈</h2>
                    <button class="feedback-close" id="feedbackClose">&times;</button>
                </div>
                <div class="feedback-body">
                    <div class="feedback-success" id="feedbackSuccess">
                        反馈提交成功！我们会尽快处理您的意见。
                    </div>
                    <div class="feedback-error" id="feedbackError"></div>
                    
                    <form class="feedback-form" id="feedbackForm">
                        <div class="form-group required">
                            <label for="feedbackTitle">反馈标题 *</label>
                            <input type="text" id="feedbackTitle" name="title" placeholder="请输入反馈标题" maxlength="200" required>
                        </div>
                        
                        <div class="form-group required">
                            <label for="feedbackContent">反馈内容 *</label>
                            <textarea id="feedbackContent" name="content" placeholder="请详细描述您遇到的问题或建议..." required></textarea>
                            <div class="form-hint">请尽可能详细地描述问题或建议，包括重现步骤（如适用）</div>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label for="feedbackCategory">反馈类别</label>
                                <select id="feedbackCategory" name="category">
                                    <option value="general">通用反馈</option>
                                    <option value="bug">Bug报告</option>
                                    <option value="feature">功能建议</option>
                                    <option value="suggestion">优化建议</option>
                                    <option value="question">使用疑问</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label for="feedbackPriority">紧急程度</label>
                                <select id="feedbackPriority" name="priority">
                                    <option value="low">低</option>
                                    <option value="medium" selected>中</option>
                                    <option value="high">高</option>
                                    <option value="urgent">紧急</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label for="feedbackContact">联系方式（可选）</label>
                            <input type="email" id="feedbackContact" name="contactInfo" placeholder="请输入邮箱或电话号码，方便我们联系您">
                            <div class="form-hint">我们承诺保护您的隐私，仅用于反馈沟通</div>
                        </div>
                        
                        <div class="form-group">
                            <label for="feedbackTags">标签（可选）</label>
                            <input type="text" id="feedbackTags" name="tags" placeholder="用逗号分隔多个标签，例如：积分管理,商品管理">
                            <div class="form-hint">请输入相关的标签，帮助我们更好地分类处理</div>
                        </div>
                        
                        <div class="feedback-actions">
                            <button type="button" class="feedback-btn feedback-btn-secondary" id="feedbackCancel">取消</button>
                            <button type="submit" class="feedback-btn feedback-btn-primary" id="feedbackSubmit">提交反馈</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(feedbackOverlay);

        feedbackModal = document.getElementById('feedbackModal');
        feedbackForm = document.getElementById('feedbackForm');
    }

    // 绑定事件监听器
    function attachEventListeners() {
        // 打开反馈弹窗
        document.getElementById('feedbackTrigger').addEventListener('click', showFeedbackForm);
        
        // 关闭反馈弹窗
        document.getElementById('feedbackClose').addEventListener('click', hideFeedbackForm);
        document.getElementById('feedbackCancel').addEventListener('click', hideFeedbackForm);
        
        // 点击遮罩层关闭
        feedbackOverlay.addEventListener('click', function(e) {
            if (e.target === feedbackOverlay) {
                hideFeedbackForm();
            }
        });
        
        // 表单提交
        feedbackForm.addEventListener('submit', handleFeedbackSubmit);
        
        // ESC键关闭弹窗
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && feedbackOverlay.style.display === 'flex') {
                hideFeedbackForm();
            }
        });
    }

    // 显示反馈表单
    function showFeedbackForm() {
        resetForm();
        feedbackOverlay.style.display = 'flex';
        document.getElementById('feedbackTitle').focus();
    }

    // 隐藏反馈表单
    function hideFeedbackForm() {
        feedbackOverlay.style.display = 'none';
    }

    // 重置表单
    function resetForm() {
        feedbackForm.reset();
        document.getElementById('feedbackCategory').value = 'general';
        document.getElementById('feedbackPriority').value = 'medium';
        hideMessages();
    }

    // 隐藏消息
    function hideMessages() {
        document.getElementById('feedbackSuccess').style.display = 'none';
        document.getElementById('feedbackError').style.display = 'none';
    }

    // 显示成功消息
    function showSuccessMessage(message) {
        const successElement = document.getElementById('feedbackSuccess');
        successElement.textContent = message || '反馈提交成功！我们会尽快处理您的意见。';
        successElement.style.display = 'block';
        
        // 3秒后自动隐藏成功消息
        setTimeout(() => {
            successElement.style.display = 'none';
        }, 3000);
    }

    // 显示错误消息
    function showErrorMessage(message) {
        const errorElement = document.getElementById('feedbackError');
        errorElement.textContent = message || '提交失败，请稍后重试。';
        errorElement.style.display = 'block';
    }

    // 处理反馈提交
    async function handleFeedbackSubmit(e) {
        e.preventDefault();
        
        const submitButton = document.getElementById('feedbackSubmit');
        const formData = new FormData(feedbackForm);
        
        // 获取表单数据
        const feedbackData = {
            title: formData.get('title').trim(),
            content: formData.get('content').trim(),
            category: formData.get('category'),
            priority: formData.get('priority'),
            contactInfo: formData.get('contactInfo').trim(),
            tags: parseTags(formData.get('tags'))
        };
        
        // 验证必填字段
        if (!validateFeedbackData(feedbackData)) {
            return;
        }
        
        // 禁用提交按钮，防止重复提交
        submitButton.disabled = true;
        submitButton.textContent = '提交中...';
        
        try {
            // 提交反馈
            const response = await apiRequest('/api/feedback', {
                method: 'POST',
                body: JSON.stringify(feedbackData)
            });
            
            if (response.success) {
                showSuccessMessage('反馈提交成功！感谢您的宝贵意见。');
                
                // 清空表单
                resetForm();
                
                // 2秒后自动关闭弹窗
                setTimeout(() => {
                    hideFeedbackForm();
                }, 2000);
            } else {
                throw new Error(response.message || '提交失败');
            }
        } catch (error) {
            console.error('提交反馈失败:', error);
            showErrorMessage(error.message || '提交失败，请检查网络连接后重试。');
        } finally {
            // 恢复提交按钮状态
            submitButton.disabled = false;
            submitButton.textContent = '提交反馈';
        }
    }

    // 验证反馈数据
    function validateFeedbackData(data) {
        hideMessages();
        
        if (!data.title || data.title.trim().length === 0) {
            showErrorMessage('请输入反馈标题');
            document.getElementById('feedbackTitle').focus();
            return false;
        }
        
        if (data.title.length > 200) {
            showErrorMessage('反馈标题长度不能超过200字符');
            document.getElementById('feedbackTitle').focus();
            return false;
        }
        
        if (!data.content || data.content.trim().length === 0) {
            showErrorMessage('请输入反馈内容');
            document.getElementById('feedbackContent').focus();
            return false;
        }
        
        if (data.content.length > 5000) {
            showErrorMessage('反馈内容长度不能超过5000字符');
            document.getElementById('feedbackContent').focus();
            return false;
        }
        
        return true;
    }

    // 解析标签字符串为数组
    function parseTags(tagsString) {
        if (!tagsString || typeof tagsString !== 'string') {
            return [];
        }
        
        return tagsString
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
    }

    // 暴露公共方法
    return {
        init: init,
        showFeedbackForm: showFeedbackForm,
        hideFeedbackForm: hideFeedbackForm
    };
})();

// 页面加载完成后初始化反馈模块
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.apiRequest === 'function') {
        window.feedbackModule.init();
    } else {
        // 如果common.js还未加载，等待其加载完成后再初始化
        const checkAndInit = () => {
            if (typeof window.apiRequest === 'function') {
                window.feedbackModule.init();
            } else {
                setTimeout(checkAndInit, 100);
            }
        };
        checkAndInit();
    }
});