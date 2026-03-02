// 通用工具函数

// API请求封装
async function apiRequest(url, options = {}) {
    try {
        // 获取存储的token（优先使用教师token，然后是学生token）
        const token = storage.get('teacherToken') || storage.get('studentToken');
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // 如果有token，添加到请求头
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(url, {
            headers,
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // 如果是401错误，可能是token过期，清除token并重定向到登录
            if (response.status === 401) {
                storage.remove('teacherToken');
                storage.remove('currentTeacher');
                storage.remove('studentToken');
                storage.remove('currentStudent');
                if (window.location.pathname.includes('/teacher')) {
                    showTeacherLogin();
                    return;
                } else if (window.location.pathname.includes('/student')) {
                    // 学生页面重新显示登录表单
                    if (typeof showLoginForm === 'function') {
                        showLoginForm();
                    }
                    return;
                }
            }
            throw new Error(data.message || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API请求错误:', error);
        showMessage(error.message || '网络请求失败', 'error');
        throw error;
    }
}

// 显示消息提示
function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    // 添加样式
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    // 根据类型设置背景色
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
    
    // 添加到页面
    document.body.appendChild(messageEl);
    
    // 3秒后自动移除
    setTimeout(() => {
        messageEl.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 300);
    }, 3000);
}

// 添加动画样式
if (!document.querySelector('#messageAnimations')) {
    const style = document.createElement('style');
    style.id = 'messageAnimations';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 格式化积分显示
function formatPoints(points) {
    return points >= 0 ? `+${points}` : `${points}`;
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// 本地存储工具
const storage = {
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('存储数据失败:', error);
        }
    },
    
    get(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('读取数据失败:', error);
            return null;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('删除数据失败:', error);
        }
    }
};

// 显示教师登录弹窗
function showTeacherLogin() {
    // 创建登录弹窗
    const loginModal = document.createElement('div');
    loginModal.className = 'login-modal';
    loginModal.innerHTML = `
        <div class="login-modal-content">
            <h2>教师登录</h2>
            <form id="teacherLoginForm">
                <div class="form-group">
                    <label for="teacherId">教师ID:</label>
                    <input type="text" id="teacherId" required placeholder="请输入教师ID (如: 8001)">
                </div>
                <div class="form-group">
                    <label for="teacherPassword">密码:</label>
                    <input type="password" id="teacherPassword" required placeholder="请输入密码">
                </div>
                <div class="login-tips">
                    <small>提示：教师ID为8001-8005，默认密码为123</small>
                </div>
                <div class="form-actions">
                    <button type="submit">登录</button>
                    <button type="button" onclick="hideTeacherLogin()">取消</button>
                </div>
            </form>
        </div>
    `;
    
    // 添加样式
    loginModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    `;
    
    const modalContent = loginModal.querySelector('.login-modal-content');
    modalContent.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 8px;
        width: 400px;
        max-width: 90%;
    `;
    
    document.body.appendChild(loginModal);
    
    // 处理登录表单提交
    document.getElementById('teacherLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const teacherId = document.getElementById('teacherId').value.trim();
        const password = document.getElementById('teacherPassword').value;
        
        if (!teacherId || !password) {
            showMessage('请填写完整的登录信息', 'warning');
            return;
        }
        
        try {
            console.log('尝试登录:', { teacherId, password });
            
            const response = await fetch('/api/auth/teacher-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    teacherId,
                    password
                })
            });
            
            const data = await response.json();
            console.log('登录响应:', data);
            
            if (!response.ok) {
                console.error('登录失败:', response.status, data);
                throw new Error(data.message || '登录失败');
            }
            
            // 保存token和用户信息
            console.log('保存登录信息:', data.data);
            storage.set('teacherToken', data.data.token);
            storage.set('currentTeacher', data.data.teacher);
            
            // 隐藏登录弹窗
            hideTeacherLogin();
            
            // 重新加载页面或刷新数据
            if (typeof initTeacherPanel === 'function') {
                initTeacherPanel();
            } else if (typeof updateUserInfo === 'function') {
                updateUserInfo();
            } else {
                window.location.reload();
            }
            
            showMessage('登录成功', 'success');
            
        } catch (error) {
            console.error('登录失败:', error);
            showMessage(error.message || '登录失败，请重试', 'error');
        }
    });
}

// 隐藏教师登录弹窗
function hideTeacherLogin() {
    const loginModal = document.querySelector('.login-modal');
    if (loginModal) {
        loginModal.remove();
    }
}

// 检查教师登录状态
function checkTeacherAuth() {
    const token = storage.get('teacherToken');
    const teacher = storage.get('currentTeacher');
    
    if (!token || !teacher) {
        return false;
    }
    
    return true;
}

// 页面加载完成后的通用初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('common.js页面加载完成');
    
    // 标记common.js已加载
    window.commonJsLoaded = true;
});