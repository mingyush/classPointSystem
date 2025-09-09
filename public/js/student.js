// 学生查询页面逻辑

let currentStudent = null;
let studentHistory = [];
let products = [];
let studentOrders = [];

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    initStudentPage();
    setupEventListeners();
});

// 初始化学生页面
function initStudentPage() {
    // 检查是否已经登录
    const savedStudent = storage.get('currentStudent');
    if (savedStudent) {
        currentStudent = savedStudent;
        loadStudentDashboard();
    } else {
        showLoginForm();
    }
}

// 设置事件监听器
function setupEventListeners() {
    const loginBtn = document.getElementById('loginBtn');
    const studentIdInput = document.getElementById('studentId');

    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }

    if (studentIdInput) {
        studentIdInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                handleLogin();
            }
        });

        // 自动聚焦到输入框
        studentIdInput.focus();
    }
}

// 显示登录表单
function showLoginForm() {
    const container = document.getElementById('studentContent');
    container.innerHTML = `
        <div class="login-form">
            <h2>请输入学号登录</h2>
            <div class="login-input-group">
                <input type="text" id="studentId" placeholder="请输入学号" maxlength="10" autocomplete="off">
                <button id="loginBtn">登录</button>
            </div>
            <div class="login-tips">
                <p>提示：直接输入学号即可登录，无需密码</p>
            </div>
        </div>
    `;

    // 重新设置事件监听器
    setupEventListeners();
}

// 处理登录
async function handleLogin() {
    const studentIdInput = document.getElementById('studentId');
    const loginBtn = document.getElementById('loginBtn');
    const studentId = studentIdInput.value.trim();

    if (!studentId) {
        showMessage('请输入学号', 'warning');
        studentIdInput.focus();
        return;
    }

    // 禁用按钮防止重复点击
    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';

    try {
        const response = await apiRequest('/api/auth/student-login', {
            method: 'POST',
            body: JSON.stringify({ studentId: studentId })
        });

        if (response.success && response.data && response.data.student) {
            currentStudent = response.data.student;
            storage.set('currentStudent', currentStudent);
            // 保存学生token
            if (response.data.token) {
                storage.set('studentToken', response.data.token);
            }
            showMessage('登录成功', 'success');
            await loadStudentDashboard();
        } else {
            throw new Error('学号不存在或登录失败');
        }

    } catch (error) {
        console.error('登录失败:', error);
        showMessage(error.message || '登录失败，请检查学号是否正确', 'error');

        // 重新启用按钮
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
        studentIdInput.focus();
        studentIdInput.select();
    }
}

// 加载学生仪表板
async function loadStudentDashboard() {
    const container = document.getElementById('studentContent');

    // 显示加载状态
    container.innerHTML = '<div class="loading">正在加载数据...</div>';

    try {
        // 并行加载所有数据，每个都独立处理错误
        await Promise.allSettled([
            loadStudentInfo(),
            loadStudentHistory(),
            loadProducts(),
            loadStudentOrders()
        ]);

        renderStudentDashboard();

    } catch (error) {
        console.error('加载数据失败:', error);
        container.innerHTML = `
            <div class="error">
                <h3>加载失败</h3>
                <p>无法加载学生数据，请重试</p>
                <button onclick="loadStudentDashboard()" class="retry-btn">重试</button>
                <button onclick="logout()" class="logout-btn">重新登录</button>
            </div>
        `;
    }
}

// 加载学生信息
async function loadStudentInfo() {
    try {
        const response = await apiRequest(`/api/students/${currentStudent.id}`);
        if (response.student) {
            // 更新当前学生信息
            currentStudent = { ...currentStudent, ...response.student };
            currentStudent.balance = response.balance || 0;
            currentStudent.rank = response.rank || 0;
            storage.set('currentStudent', currentStudent);
        }
    } catch (error) {
        console.error('加载学生信息失败:', error);
        // 使用缓存的学生信息
    }
}

// 加载学生历史记录
async function loadStudentHistory() {
    try {
        const response = await apiRequest(`/api/points/history/${currentStudent.id}`);
        studentHistory = response.data?.records || response.records || [];
        storage.set('studentHistory', studentHistory);
    } catch (error) {
        console.error('加载历史记录失败:', error);
        // 使用缓存的历史记录
        studentHistory = storage.get('studentHistory') || [];
    }
}

// 加载商品列表
async function loadProducts() {
    try {
        const response = await apiRequest('/api/products?active=true');
        if (response.success && response.data && response.data.products) {
            products = response.data.products;
        } else {
            products = [];
        }
        storage.set('products', products);
    } catch (error) {
        console.error('加载商品失败:', error);
        // 使用缓存的商品数据
        products = storage.get('products') || [];
    }
}

// 加载学生预约
async function loadStudentOrders() {
    try {
        const response = await apiRequest(`/api/orders?studentId=${currentStudent.id}`);
        studentOrders = response.data?.orders || response.orders || [];
        storage.set('studentOrders', studentOrders);
    } catch (error) {
        console.error('加载预约记录失败:', error);
        // 使用缓存的预约数据
        studentOrders = storage.get('studentOrders') || [];
    }
}

// 渲染学生仪表板
function renderStudentDashboard() {
    const container = document.getElementById('studentContent');

    container.innerHTML = `
        <div class="student-header">
            <div class="student-welcome">
                <h2>欢迎，${currentStudent.name}！</h2>
                <p>学号：${currentStudent.id}</p>
            </div>
            <div class="header-actions">
                <button onclick="refreshData()" class="refresh-btn">刷新数据</button>
                <button onclick="logout()" class="logout-btn">退出登录</button>
            </div>
        </div>
        
        <div class="dashboard-tabs">
            <button class="tab-button active" onclick="switchDashboardTab('overview', this)">个人概览</button>
            <button class="tab-button" onclick="switchDashboardTab('history', this)">积分记录</button>
            <button class="tab-button" onclick="switchDashboardTab('products', this)">商品兑换</button>
            <button class="tab-button" onclick="switchDashboardTab('orders', this)">我的预约</button>
        </div>
        
        <div id="overviewTab" class="dashboard-content active">
            ${renderOverviewTab()}
        </div>
        
        <div id="historyTab" class="dashboard-content">
            ${renderHistoryTab()}
        </div>
        
        <div id="productsTab" class="dashboard-content">
            ${renderProductsTab()}
        </div>
        
        <div id="ordersTab" class="dashboard-content">
            ${renderOrdersTab()}
        </div>
    `;
}

// 切换仪表板标签页
function switchDashboardTab(tabName, buttonElement) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // 如果没有传入按钮元素，尝试通过事件获取
    const targetButton = buttonElement || document.querySelector(`[onclick*="${tabName}"]`);
    if (targetButton) {
        targetButton.classList.add('active');
    }

    // 更新内容显示
    document.querySelectorAll('.dashboard-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// 渲染概览标签页
function renderOverviewTab() {
    const balance = currentStudent.balance || 0;
    const rank = currentStudent.rank || 0;
    const recentHistory = studentHistory.slice(0, 5);

    return `
        <div class="overview-grid">
            <div class="info-card balance-card">
                <h3>当前积分</h3>
                <div class="balance-display">
                    <div class="balance-amount ${balance < 0 ? 'negative' : ''}">${balance}</div>
                    <div class="balance-label">积分</div>
                </div>
                <div class="balance-status">
                    ${balance >= 0 ? '积分充足' : '积分不足'}
                </div>
            </div>
            
            <div class="info-card rank-card">
                <h3>班级排名</h3>
                <div class="rank-display">
                    <div class="rank-number">${rank > 0 ? `第 ${rank} 名` : '暂无排名'}</div>
                    <div class="rank-label">班级排名</div>
                </div>
                <div class="rank-status">
                    ${getRankStatus(rank)}
                </div>
            </div>
            
            <div class="info-card recent-card">
                <h3>最近记录</h3>
                <div class="recent-history">
                    ${recentHistory.length > 0 ?
            recentHistory.map(record => `
                            <div class="recent-item">
                                <span class="recent-reason">${record.reason}</span>
                                <span class="recent-points ${record.points > 0 ? 'positive' : 'negative'}">
                                    ${record.points > 0 ? '+' : ''}${record.points}分
                                </span>
                            </div>
                        `).join('') :
            '<div class="no-data">暂无记录</div>'
        }
                </div>
                ${recentHistory.length > 0 ? '<button onclick="switchDashboardTab(\'history\')" class="view-all-btn">查看全部</button>' : ''}
            </div>
            
            <div class="info-card stats-card">
                <h3>统计信息</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${studentHistory.filter(r => r.points > 0).length}</div>
                        <div class="stat-label">获得加分次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${studentHistory.filter(r => r.points < 0).length}</div>
                        <div class="stat-label">被减分次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${studentOrders.length}</div>
                        <div class="stat-label">预约次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${studentOrders.filter(o => o.status === 'confirmed').length}</div>
                        <div class="stat-label">成功兑换</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 渲染历史记录标签页
function renderHistoryTab() {
    return `
        <div class="history-section">
            <div class="history-header">
                <h3>积分变动记录</h3>
                <div class="history-filter">
                    <select id="historyFilter" onchange="filterHistory()">
                        <option value="">全部记录</option>
                        <option value="add">加分记录</option>
                        <option value="subtract">减分记录</option>
                        <option value="purchase">消费记录</option>
                    </select>
                </div>
            </div>
            
            <div class="history-list" id="historyList">
                ${renderHistoryList(studentHistory)}
            </div>
        </div>
    `;
}

// 渲染历史记录列表
function renderHistoryList(history) {
    if (!history || history.length === 0) {
        return '<div class="no-data">暂无积分记录</div>';
    }

    return history.map(record => {
        const isPositive = record.points > 0;
        const typeClass = record.type || (isPositive ? 'add' : 'subtract');

        return `
            <div class="history-item ${isPositive ? 'positive' : 'negative'}">
                <div class="history-info">
                    <div class="history-reason">${record.reason}</div>
                    <div class="history-time">${formatDate(record.timestamp)}</div>
                    <div class="history-type">${getTypeText(typeClass)}</div>
                </div>
                <div class="history-points ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${record.points}分
                </div>
            </div>
        `;
    }).join('');
}

// 渲染商品标签页
function renderProductsTab() {
    return `
        <div class="products-section">
            <div class="products-header">
                <h3>商品兑换</h3>
                <div class="products-info">
                    <span>当前积分：<strong>${currentStudent.balance || 0}分</strong></span>
                </div>
            </div>
            
            <div class="products-grid" id="productsGrid">
                ${renderProductsGrid(products)}
            </div>
        </div>
    `;
}

// 渲染商品网格
function renderProductsGrid(productList) {
    if (!productList || productList.length === 0) {
        return '<div class="no-data">暂无可兑换商品</div>';
    }

    return productList.map(product => {
        const canAfford = (currentStudent.balance || 0) >= product.price;
        const inStock = product.stock > 0;
        const canReserve = canAfford && inStock;

        return `
            <div class="product-card">
                <div class="product-name">${product.name}</div>
                <div class="product-price">${product.price}分</div>
                <div class="product-stock ${inStock ? '' : 'out-of-stock'}">
                    ${inStock ? `库存：${product.stock}个` : '暂时缺货'}
                </div>
                ${product.description ? `<div class="product-description">${product.description}</div>` : ''}
                <button class="reserve-btn" 
                        onclick="reserveProduct('${product.id}')" 
                        ${!canReserve ? 'disabled' : ''}>
                    ${!canAfford ? '积分不足' : !inStock ? '暂时缺货' : '立即预约'}
                </button>
            </div>
        `;
    }).join('');
}

// 渲染预约标签页
function renderOrdersTab() {
    return `
        <div class="orders-section">
            <div class="orders-header">
                <h3>我的预约</h3>
                <div class="orders-filter">
                    <select id="ordersFilter" onchange="filterOrders()">
                        <option value="">全部预约</option>
                        <option value="pending">待确认</option>
                        <option value="confirmed">已确认</option>
                        <option value="cancelled">已取消</option>
                    </select>
                </div>
            </div>
            
            <div class="orders-list" id="ordersList">
                ${renderOrdersList(studentOrders)}
            </div>
        </div>
    `;
}

// 渲染预约列表
function renderOrdersList(orderList) {
    if (!orderList || orderList.length === 0) {
        return '<div class="no-data">暂无预约记录</div>';
    }

    return orderList.map(order => {
        const product = products.find(p => p.id === order.productId);
        const statusText = getOrderStatusText(order.status);

        return `
            <div class="order-item">
                <div class="order-info">
                    <div class="order-product">${product?.name || '未知商品'}</div>
                    <div class="order-price">${product?.price || 0}分</div>
                    <div class="order-time">预约时间：${formatDate(order.reservedAt)}</div>
                    ${order.confirmedAt ? `<div class="order-confirmed">确认时间：${formatDate(order.confirmedAt)}</div>` : ''}
                </div>
                <div class="order-status">
                    <span class="status-badge status-${order.status}">${statusText}</span>
                    ${order.status === 'pending' ?
                `<button class="cancel-order-btn" onclick="cancelOrder('${order.id}')">取消预约</button>` :
                ''
            }
                </div>
            </div>
        `;
    }).join('');
}

// 预约商品
async function reserveProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) {
        showMessage('商品不存在', 'error');
        return;
    }

    if ((currentStudent.balance || 0) < product.price) {
        showMessage('积分不足，无法预约', 'warning');
        return;
    }

    if (product.stock <= 0) {
        showMessage('商品暂时缺货', 'warning');
        return;
    }

    const confirmed = confirm(`确定要预约 "${product.name}" 吗？\n需要积分：${product.price}分`);
    if (!confirmed) return;

    try {
        const response = await apiRequest('/api/orders/reserve', {
            method: 'POST',
            body: JSON.stringify({
                studentId: currentStudent.id,
                productId: productId
            })
        });

        if (response.success) {
            showMessage('预约成功！请联系老师确认兑换', 'success');

            // 更新本地数据
            const newOrder = response.data?.order || response.order;
            if (newOrder) {
                studentOrders.unshift(newOrder);
                storage.set('studentOrders', studentOrders);
            }

            // 刷新显示
            if (document.getElementById('ordersTab').classList.contains('active')) {
                document.getElementById('ordersList').innerHTML = renderOrdersList(studentOrders);
            }
        }

    } catch (error) {
        console.error('预约失败:', error);
        showMessage(error.message || '预约失败，请重试', 'error');
    }
}

// 取消预约
async function cancelOrder(orderId) {
    const confirmed = confirm('确定要取消这个预约吗？');
    if (!confirmed) return;

    try {
        const response = await apiRequest(`/api/orders/${orderId}/cancel`, {
            method: 'POST'
        });

        if (response.success) {
            showMessage('预约已取消', 'success');

            // 更新本地数据
            const orderIndex = studentOrders.findIndex(o => o.id === orderId);
            if (orderIndex !== -1) {
                studentOrders[orderIndex].status = 'cancelled';
                studentOrders[orderIndex].cancelledAt = new Date().toISOString();
                storage.set('studentOrders', studentOrders);
            }

            // 刷新显示
            document.getElementById('ordersList').innerHTML = renderOrdersList(studentOrders);
        }

    } catch (error) {
        console.error('取消预约失败:', error);
        showMessage(error.message || '取消预约失败，请重试', 'error');
    }
}

// 筛选历史记录
function filterHistory() {
    const filter = document.getElementById('historyFilter').value;
    let filteredHistory = studentHistory;

    if (filter) {
        filteredHistory = studentHistory.filter(record => {
            switch (filter) {
                case 'add':
                    return record.points > 0 && record.type !== 'purchase';
                case 'subtract':
                    return record.points < 0 && record.type !== 'purchase';
                case 'purchase':
                    return record.type === 'purchase';
                default:
                    return true;
            }
        });
    }

    document.getElementById('historyList').innerHTML = renderHistoryList(filteredHistory);
}

// 筛选预约记录
function filterOrders() {
    const filter = document.getElementById('ordersFilter').value;
    let filteredOrders = studentOrders;

    if (filter) {
        filteredOrders = studentOrders.filter(order => order.status === filter);
    }

    document.getElementById('ordersList').innerHTML = renderOrdersList(filteredOrders);
}

// 刷新数据
async function refreshData() {
    try {
        showMessage('正在刷新数据...', 'info');
        await loadStudentDashboard();
        showMessage('数据刷新成功', 'success');
    } catch (error) {
        console.error('刷新数据失败:', error);
        showMessage('刷新数据失败', 'error');
    }
}

// 退出登录
function logout() {
    const confirmed = confirm('确定要退出登录吗？');
    if (confirmed) {
        currentStudent = null;
        studentHistory = [];
        products = [];
        studentOrders = [];

        // 清除本地存储
        storage.remove('currentStudent');
        storage.remove('studentToken');
        storage.remove('studentHistory');
        storage.remove('products');
        storage.remove('studentOrders');

        showLoginForm();
        showMessage('已退出登录', 'info');
    }
}

// 工具函数
function getRankStatus(rank) {
    if (rank === 0) return '继续努力！';
    if (rank <= 3) return '表现优秀！';
    if (rank <= 10) return '成绩良好！';
    return '继续加油！';
}

function getTypeText(type) {
    const typeMap = {
        'add': '加分',
        'subtract': '减分',
        'purchase': '消费',
        'refund': '退款'
    };
    return typeMap[type] || '其他';
}

function getOrderStatusText(status) {
    const statusMap = {
        'pending': '待确认',
        'confirmed': '已确认',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}