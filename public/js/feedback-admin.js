/**
 * 反馈管理页面
 * 用于教师查看和管理用户反馈
 */

// 反馈管理页面
let feedbackList = [];
let currentPage = 1;
const itemsPerPage = 10;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    loadFeedbackList();
});

// 加载反馈列表
async function loadFeedbackList(page = 1, filters = {}) {
    try {
        const container = document.getElementById('feedbackContent');
        container.innerHTML = '<div class="loading">正在加载反馈数据...</div>';
        
        // 构建查询参数
        const params = new URLSearchParams({
            page: page,
            limit: itemsPerPage
        });
        
        if (filters.category) params.append('category', filters.category);
        if (filters.status) params.append('status', filters.status);
        if (filters.priority) params.append('priority', filters.priority);
        if (filters.search) params.append('search', filters.search);
        
        const response = await apiRequest(`/api/feedback?${params.toString()}`);
        
        if (response.success) {
            feedbackList = response.data.feedbacks;
            currentPage = page;
            
            renderFeedbackList(response.data);
        } else {
            throw new Error(response.message || '加载反馈列表失败');
        }
    } catch (error) {
        console.error('加载反馈列表失败:', error);
        showError('加载反馈列表失败: ' + error.message);
    }
}

// 渲染反馈列表
function renderFeedbackList(data) {
    const container = document.getElementById('feedbackContent');
    
    if (data.feedbacks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>暂无反馈</h3>
                <p>目前还没有收到任何反馈</p>
            </div>
        `;
        return;
    }
    
    const totalPages = data.pagination.pages;
    
    container.innerHTML = `
        <div class="feedback-controls">
            <div class="filter-controls">
                <select id="filterCategory" onchange="applyFilters()">
                    <option value="">所有类别</option>
                    <option value="bug">Bug报告</option>
                    <option value="feature">功能建议</option>
                    <option value="suggestion">优化建议</option>
                    <option value="question">使用疑问</option>
                    <option value="general">通用反馈</option>
                </select>
                
                <select id="filterStatus" onchange="applyFilters()">
                    <option value="">所有状态</option>
                    <option value="open">待处理</option>
                    <option value="in-progress">处理中</option>
                    <option value="resolved">已解决</option>
                    <option value="closed">已关闭</option>
                </select>
                
                <select id="filterPriority" onchange="applyFilters()">
                    <option value="">所有优先级</option>
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                    <option value="urgent">紧急</option>
                </select>
                
                <input type="text" id="searchInput" placeholder="搜索反馈..." onkeypress="handleSearchKeyPress(event)">
                <button onclick="applyFilters()">搜索</button>
            </div>
        </div>
        
        <div class="feedback-list">
            ${data.feedbacks.map(renderFeedbackItem).join('')}
        </div>
        
        <div class="pagination">
            <button onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>
            <span>第 ${currentPage} 页，共 ${totalPages} 页</span>
            <button onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>
        </div>
    `;
}

// 渲染单个反馈项目
function renderFeedbackItem(feedback) {
    const priorityColors = {
        'low': '#28a745',
        'medium': '#ffc107',
        'high': '#fd7e14',
        'urgent': '#dc3545'
    };
    
    const statusColors = {
        'open': '#007bff',
        'in-progress': '#ffc107',
        'resolved': '#28a745',
        'closed': '#6c757d'
    };
    
    const categoryNames = {
        'bug': 'Bug报告',
        'feature': '功能建议',
        'suggestion': '优化建议',
        'question': '使用疑问',
        'general': '通用反馈'
    };
    
    const statusNames = {
        'open': '待处理',
        'in-progress': '处理中',
        'resolved': '已解决',
        'closed': '已关闭'
    };
    
    return `
        <div class="feedback-item" data-id="${feedback.id}">
            <div class="feedback-header">
                <div class="feedback-title">${escapeHtml(feedback.title)}</div>
                <div class="feedback-meta">
                    <span class="feedback-category" style="background-color: ${priorityColors[feedback.priority]}20; color: ${priorityColors[feedback.priority]}">
                        ${categoryNames[feedback.category] || feedback.category}
                    </span>
                    <span class="feedback-priority" style="background-color: ${priorityColors[feedback.priority]}20; color: ${priorityColors[feedback.priority]}">
                        ${feedback.priority === 'low' ? '低' : feedback.priority === 'medium' ? '中' : feedback.priority === 'high' ? '高' : '紧急'}
                    </span>
                    <span class="feedback-status" style="background-color: ${statusColors[feedback.status]}20; color: ${statusColors[feedback.status]}">
                        ${statusNames[feedback.status] || feedback.status}
                    </span>
                </div>
            </div>
            
            <div class="feedback-content">
                <p>${escapeHtml(feedback.content)}</p>
            </div>
            
            <div class="feedback-details">
                <div class="detail-item">
                    <strong>提交者:</strong> ${escapeHtml(feedback.submitterName)}
                </div>
                <div class="detail-item">
                    <strong>提交时间:</strong> ${formatDate(feedback.createdAt)}
                </div>
                <div class="detail-item">
                    <strong>联系方式:</strong> ${feedback.contactInfo || '未提供'}
                </div>
                ${feedback.tags && feedback.tags.length > 0 ? `
                <div class="detail-item">
                    <strong>标签:</strong> ${feedback.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
                </div>
                ` : ''}
            </div>
            
            <div class="feedback-actions">
                <button class="btn btn-sm btn-primary" onclick="editFeedback('${feedback.id}')">编辑</button>
                <button class="btn btn-sm btn-warning" onclick="updateFeedbackStatus('${feedback.id}', 'in-progress')">处理中</button>
                <button class="btn btn-sm btn-success" onclick="updateFeedbackStatus('${feedback.id}', 'resolved')">已解决</button>
                <button class="btn btn-sm btn-secondary" onclick="updateFeedbackStatus('${feedback.id}', 'closed')">关闭</button>
            </div>
        </div>
    `;
}

// 转义HTML以防止XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 格式化日期
function formatDate(dateString) {
    return new Date(dateString).toLocaleString('zh-CN');
}

// 更新反馈状态
async function updateFeedbackStatus(feedbackId, newStatus) {
    try {
        const response = await apiRequest(`/api/feedback/${feedbackId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.success) {
            showMessage('反馈状态更新成功', 'success');
            // 重新加载列表
            const category = document.getElementById('filterCategory').value;
            const status = document.getElementById('filterStatus').value;
            const priority = document.getElementById('filterPriority').value;
            const search = document.getElementById('searchInput').value;
            
            const filters = {};
            if (category) filters.category = category;
            if (status) filters.status = status;
            if (priority) filters.priority = priority;
            if (search) filters.search = search;
            
            loadFeedbackList(currentPage, filters);
        } else {
            throw new Error(response.message || '更新反馈状态失败');
        }
    } catch (error) {
        console.error('更新反馈状态失败:', error);
        showMessage('更新反馈状态失败: ' + error.message, 'error');
    }
}

// 编辑反馈（目前只支持更新状态）
function editFeedback(feedbackId) {
    const feedback = feedbackList.find(f => f.id === feedbackId);
    if (!feedback) {
        showMessage('找不到指定的反馈', 'error');
        return;
    }
    
    // 在这里可以实现更详细的编辑功能
    alert(`反馈详情:\n标题: ${feedback.title}\n内容: ${feedback.content}\n类别: ${feedback.category}\n状态: ${feedback.status}`);
}

// 分页功能
function goToPage(page) {
    if (page < 1) return;
    
    const category = document.getElementById('filterCategory').value;
    const status = document.getElementById('filterStatus').value;
    const priority = document.getElementById('filterPriority').value;
    const search = document.getElementById('searchInput').value;
    
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (search) filters.search = search;
    
    loadFeedbackList(page, filters);
}

// 应用过滤器
function applyFilters() {
    const category = document.getElementById('filterCategory').value;
    const status = document.getElementById('filterStatus').value;
    const priority = document.getElementById('filterPriority').value;
    const search = document.getElementById('searchInput').value;
    
    const filters = {};
    if (category) filters.category = category;
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (search.trim()) filters.search = search.trim();
    
    loadFeedbackList(1, filters);
}

// 处理搜索框按键事件
function handleSearchKeyPress(event) {
    if (event.key === 'Enter') {
        applyFilters();
    }
}

// 显示错误消息
function showError(message) {
    const container = document.getElementById('feedbackContent');
    container.innerHTML = `
        <div class="error">
            <h3>加载失败</h3>
            <p>${escapeHtml(message)}</p>
            <button onclick="loadFeedbackList()">重新加载</button>
        </div>
    `;
}

// 显示消息
function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    // 根据类型设置颜色
    switch (type) {
        case 'success':
            messageEl.style.backgroundColor = '#28a745';
            break;
        case 'error':
            messageEl.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            messageEl.style.backgroundColor = '#ffc107';
            messageEl.style.color = '#212529';
            break;
        default:
            messageEl.style.backgroundColor = '#007bff';
    }
    
    document.body.appendChild(messageEl);
    
    // 3秒后移除消息
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.parentNode.removeChild(messageEl);
        }
    }, 3000);
}