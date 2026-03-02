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

        // 检查response是否为undefined或null
        if (!response) {
            throw new Error('服务器未返回响应，请稍后重试');
        }

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
            throw new Error(response.message || '学号不存在或登录失败');
        }

    } catch (error) {
        console.error('登录失败:', error);
        // 检查错误是否是TypeError，这可能是因为访问了undefined的属性
        if (error instanceof TypeError && error.message.includes('reading \'success\'')) {
            showMessage('服务器响应异常，请稍后重试', 'error');
        } else {
            showMessage(error.message || '登录失败，请检查学号是否正确', 'error');
        }

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
        <div class="clay-panel p-6 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 bg-[#ECFEFF] border-[#164E63] shadow-[6px_6px_0px_rgba(22,78,99,1)]">
            <div class="student-welcome">
                <h2 class="text-2xl font-display font-black text-brand-900 mb-1 uppercase tracking-widest">欢迎，<span class="text-[#06B6D4] underline decoration-4 underline-offset-4">${currentStudent.name}</span>！</h2>
                <p class="text-sm font-bold text-brand-900/60 font-mono tracking-widest mt-2 uppercase">学号：${currentStudent.id}</p>
            </div>
            <div class="flex flex-wrap gap-3">
                <button onclick="refreshData()" class="px-5 py-2 text-sm font-black uppercase rounded-lg bg-white hover:bg-[#CFFAFE] text-brand-900 border-4 border-brand-900 shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-[0px_0px_0px_rgba(22,78,99,1)] transition-all">刷新数据</button>
                <button onclick="logout()" class="px-5 py-2 text-sm font-black uppercase rounded-lg bg-[#FCA5A5] hover:bg-[#F87171] text-[#7F1D1D] border-4 border-[#7F1D1D] shadow-[4px_4px_0px_rgba(127,29,29,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(127,29,29,1)] active:translate-y-1 active:shadow-[0px_0px_0px_rgba(127,29,29,1)] transition-all flex items-center gap-2 focus:outline-none">退出登录</button>
            </div>
        </div>
        
        <div class="flex gap-4 overflow-x-auto pb-4 mb-2 border-b-4 border-brand-900/10 custom-scrollbar">
            <button class="tab-button active px-5 py-2 text-sm font-black uppercase rounded-lg border-4 border-transparent hover:border-brand-900 text-brand-900 hover:shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:bg-[#CFFAFE] transition-all [&.active]:bg-[#22D3EE] [&.active]:border-brand-900 [&.active]:shadow-[4px_4px_0px_rgba(22,78,99,1)] whitespace-nowrap" onclick="switchDashboardTab('overview', this)">个人概览</button>
            <button class="tab-button px-5 py-2 text-sm font-black uppercase rounded-lg border-4 border-transparent hover:border-brand-900 text-brand-900 hover:shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:bg-[#CFFAFE] transition-all [&.active]:bg-[#22D3EE] [&.active]:border-brand-900 [&.active]:shadow-[4px_4px_0px_rgba(22,78,99,1)] whitespace-nowrap" onclick="switchDashboardTab('history', this)">积分记录</button>
            <button class="tab-button px-5 py-2 text-sm font-black uppercase rounded-lg border-4 border-transparent hover:border-brand-900 text-brand-900 hover:shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:bg-[#CFFAFE] transition-all [&.active]:bg-[#22D3EE] [&.active]:border-brand-900 [&.active]:shadow-[4px_4px_0px_rgba(22,78,99,1)] whitespace-nowrap" onclick="switchDashboardTab('products', this)">商品兑换</button>
            <button class="tab-button px-5 py-2 text-sm font-black uppercase rounded-lg border-4 border-transparent hover:border-brand-900 text-brand-900 hover:shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:bg-[#CFFAFE] transition-all [&.active]:bg-[#22D3EE] [&.active]:border-brand-900 [&.active]:shadow-[4px_4px_0px_rgba(22,78,99,1)] whitespace-nowrap" onclick="switchDashboardTab('orders', this)">我的预约</button>
        </div>
        
        <div id="overviewTab" class="dashboard-content active transition-opacity duration-300">
            ${renderOverviewTab()}
        </div>
        
        <div id="historyTab" class="dashboard-content hidden transition-opacity duration-300">
            ${renderHistoryTab()}
        </div>
        
        <div id="productsTab" class="dashboard-content hidden transition-opacity duration-300">
            ${renderProductsTab()}
        </div>
        
        <div id="ordersTab" class="dashboard-content hidden transition-opacity duration-300">
            ${renderOrdersTab()}
        </div>
    `;

    // Fix the display for initially hidden tabs
    document.querySelectorAll('.dashboard-content:not(.active)').forEach(el => el.style.display = 'none');
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
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 mt-6">
            <div class="lg:col-span-4 clay-panel p-6 bg-white flex flex-col justify-center items-center text-center hover:-translate-y-1 transition-transform">
                <h3 class="text-lg font-black uppercase tracking-widest text-[#06B6D4] mb-2 border-b-4 border-brand-900 pb-2 w-full">当前积分</h3>
                <div class="my-6">
                    <div class="text-6xl font-black font-mono tracking-tighter ${balance < 0 ? 'text-[#EF4444]' : 'text-brand-900'}">${balance}</div>
                    <div class="text-sm font-bold text-brand-900/60 mt-2 uppercase tracking-widest border-2 border-brand-900 rounded px-2 py-0.5 inline-block">POINTS</div>
                </div>
                <div class="w-full py-2 rounded font-black uppercase tracking-wider ${balance >= 0 ? 'bg-[#DCFCE7] text-[#16A34A] border-2 border-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626] border-2 border-[#DC2626]'}">
                    ${balance >= 0 ? '积分充足 ✅' : '积分不足 ⚠️'}
                </div>
            </div>
            
            <div class="lg:col-span-4 clay-panel p-6 bg-[#CFFAFE] flex flex-col justify-center items-center text-center hover:-translate-y-1 transition-transform">
                <h3 class="text-lg font-black uppercase tracking-widest text-brand-900 mb-2 border-b-4 border-brand-900 pb-2 w-full">班级排名</h3>
                <div class="my-6">
                    <div class="text-5xl font-black font-display text-brand-900">${rank > 0 ? `第 ${rank} 名` : '暂无'}</div>
                    <div class="text-sm font-bold text-brand-900/60 mt-3 uppercase tracking-widest border-2 border-brand-900 rounded bg-white px-2 py-0.5 inline-block">RANKING</div>
                </div>
                <div class="w-full py-2 rounded font-black text-brand-900 bg-white border-4 border-brand-900 uppercase tracking-wider">
                    ${getRankStatus(rank)}
                </div>
            </div>

            <div class="lg:col-span-4 clay-panel p-6 bg-white hover:-translate-y-1 transition-transform">
                <h3 class="text-lg font-black uppercase tracking-widest text-brand-900 mb-4 border-b-4 border-brand-900 pb-2">统计信息</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="text-center p-3 rounded-xl border-4 border-brand-900 bg-[#ECFEFF]">
                        <div class="text-2xl font-black font-mono text-[#16A34A]">${studentHistory.filter(r => r.points > 0).length}</div>
                        <div class="text-xs font-bold text-brand-900 uppercase mt-1">获得加分</div>
                    </div>
                    <div class="text-center p-3 rounded-xl border-4 border-brand-900 bg-[#ECFEFF]">
                        <div class="text-2xl font-black font-mono text-[#EF4444]">${studentHistory.filter(r => r.points < 0).length}</div>
                        <div class="text-xs font-bold text-brand-900 uppercase mt-1">被减分</div>
                    </div>
                    <div class="text-center p-3 rounded-xl border-4 border-brand-900 bg-[#ECFEFF]">
                        <div class="text-2xl font-black font-mono text-[#06B6D4]">${studentOrders.length}</div>
                        <div class="text-xs font-bold text-brand-900 uppercase mt-1">预约次数</div>
                    </div>
                    <div class="text-center p-3 rounded-xl border-4 border-brand-900 bg-[#CFFAFE]">
                        <div class="text-2xl font-black font-mono text-[#16A34A]">${studentOrders.filter(o => o.status === 'confirmed').length}</div>
                        <div class="text-xs font-bold text-brand-900 uppercase mt-1">成功兑换</div>
                    </div>
                </div>
            </div>
            
            <div class="lg:col-span-12 clay-panel p-6 bg-white">
                <div class="flex justify-between items-end mb-6 border-b-4 border-brand-900 pb-3">
                    <h3 class="text-xl font-black uppercase tracking-widest text-brand-900">最近记录</h3>
                    ${recentHistory.length > 0 ? `<button onclick="switchDashboardTab('history')" class="text-sm font-bold text-[#06B6D4] hover:text-[#0891B2] uppercase tracking-wider border-b-2 border-transparent hover:border-[#0891B2] transition-colors">查看全部 &rarr;</button>` : ''}
                </div>
                
                <div class="space-y-4">
                    ${recentHistory.length > 0 ?
            recentHistory.map(record => `
                            <div class="flex justify-between items-center p-4 rounded-xl border-4 border-brand-900 hover:bg-[#CFFAFE] transition-colors group">
                                <span class="font-bold text-brand-900 group-hover:text-[#06B6D4] transition-colors">${record.reason}</span>
                                <span class="text-xl font-black font-mono px-3 py-1 rounded bg-white border-2 border-brand-900 ${record.points > 0 ? 'text-[#16A34A]' : 'text-[#EF4444]'}">
                                    ${record.points > 0 ? '+' : ''}${record.points}分
                                </span>
                            </div>
                        `).join('') :
            '<div class="text-center text-brand-900/50 font-bold py-8 uppercase tracking-widest border-4 border-dashed border-brand-900/20 rounded-xl">暂无记录</div>'
                    }
                </div>
            </div>
            
        </div>
    `;
}

// 渲染历史记录标签页
function renderHistoryTab() {
    return `
        <div class="clay-panel p-6 mt-6 bg-white min-h-[500px]">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b-4 border-brand-900 pb-4">
                <h3 class="text-xl font-display font-black text-brand-900 uppercase tracking-widest">积分变动记录</h3>
                <div class="w-full sm:w-auto">
                    <select id="historyFilter" onchange="filterHistory()" class="w-full sm:w-auto bg-white border-4 border-brand-900 rounded-xl px-4 py-2 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] font-black shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all cursor-pointer">
                        <option value="">全部记录</option>
                        <option value="add">加分记录</option>
                        <option value="subtract">减分记录</option>
                        <option value="purchase">消费记录</option>
                    </select>
                </div>
            </div>
            
            <div class="space-y-4 pr-3 custom-scrollbar" id="historyList">
                ${renderHistoryList(studentHistory)}
            </div>
        </div>
    `;
}

// 渲染历史记录列表
function renderHistoryList(history) {
    if (!history || history.length === 0) {
        return '<div class="text-center text-brand-900/50 font-bold py-10 uppercase tracking-widest border-4 border-dashed border-brand-900/20 rounded-xl clay-panel shadow-none">暂无积分记录</div>';
    }

    return history.map(record => {
        const isPositive = record.points > 0;
        const typeClass = record.type || (isPositive ? 'add' : 'subtract');
        
        const badgeColors = {
            'add': 'bg-[#DCFCE7] text-[#16A34A] border-[#16A34A]',
            'subtract': 'bg-[#FEE2E2] text-[#DC2626] border-[#DC2626]',
            'purchase': 'bg-[#FEF9C3] text-[#CA8A04] border-[#CA8A04]',
            'refund': 'bg-[#E0E7FF] text-[#4F46E5] border-[#4F46E5]'
        };
        const badgeColor = badgeColors[typeClass] || badgeColors['add'];

        return `
            <div class="p-5 rounded-2xl bg-white border-4 border-brand-900 flex justify-between items-center transition-all hover:shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:-translate-y-1">
                <div class="flex flex-col gap-2">
                    <div class="font-black text-brand-900 text-lg sm:text-xl">${record.reason}</div>
                    <div class="flex items-center gap-3">
                        <div class="text-xs font-bold text-brand-900/60 font-mono">${formatDate(record.timestamp)}</div>
                        <div class="text-[10px] font-black uppercase tracking-widest border-2 px-2 py-0.5 rounded ${badgeColor}">${getTypeText(typeClass)}</div>
                    </div>
                </div>
                <div class="text-3xl font-black font-mono shrink-0 pl-4 ${isPositive ? 'text-[#16A34A]' : 'text-[#EF4444]'}">
                    ${isPositive ? '+' : ''}${record.points}分
                </div>
            </div>
        `;
    }).join('');
}

// 渲染商品标签页
function renderProductsTab() {
    return `
        <div class="clay-panel p-6 mt-6 bg-[#ECFEFF]">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b-4 border-brand-900 pb-4">
                <h3 class="text-xl font-display font-black text-brand-900 uppercase tracking-widest">商品兑换广场</h3>
                <div class="bg-white border-4 border-brand-900 rounded-lg px-4 py-2 shadow-[2px_2px_0px_rgba(22,78,99,1)]">
                    <span class="text-sm font-black uppercase text-brand-900 mr-2">当前积分:</span>
                    <strong class="text-xl font-mono text-[#06B6D4] font-black">${currentStudent.balance || 0}</strong><span class="text-xs ml-1 font-bold text-brand-900 uppercase">pts</span>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="productsGrid">
                ${renderProductsGrid(products)}
            </div>
        </div>
    `;
}

// 渲染商品网格
function renderProductsGrid(productList) {
    if (!productList || productList.length === 0) {
        return '<div class="col-span-full clay-panel bg-white p-10 text-center text-brand-900/50 font-black uppercase tracking-widest border-4 border-dashed border-brand-900/20 shadow-none">暂无可兑换商品</div>';
    }

    return productList.map(product => {
        const canAfford = (currentStudent.balance || 0) >= product.price;
        const inStock = product.stock > 0;
        const canReserve = canAfford && inStock;

        return `
            <div class="p-6 rounded-2xl bg-white border-4 border-brand-900 flex flex-col hover:-translate-y-2 hover:shadow-[8px_8px_0px_rgba(22,78,99,1)] shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all relative overflow-hidden group">
                ${!inStock ? '<div class="absolute -right-12 top-6 bg-[#EF4444] text-white font-black uppercase tracking-widest px-12 py-1 rotate-45 border-y-2 border-brand-900 text-xs">缺货空空</div>' : ''}
                
                <h4 class="text-xl font-black uppercase tracking-wider font-display text-brand-900 mb-2 truncate group-hover:text-[#06B6D4] transition-colors">${product.name}</h4>
                
                <div class="flex items-center gap-2 mb-4">
                    <div class="text-brand-900 bg-[#CFFAFE] border-2 border-brand-900 px-3 py-1 rounded font-display font-black text-xl">${product.price}分</div>
                    <div class="text-xs font-black uppercase tracking-widest px-2 py-1 rounded border-2 border-brand-900 ${inStock ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'}">
                        ${inStock ? `余 ${product.stock}` : '已售罄'}
                    </div>
                </div>
                
                <p class="text-sm font-bold text-brand-900/70 mb-6 flex-1 min-h-[3rem] line-clamp-2">${product.description || '这件商品很神秘，没有描述。'}</p>
                
                <button class="w-full py-3 rounded-lg border-4 font-black transition-all uppercase tracking-widest text-sm focus:outline-none
                        ${canReserve ? 
                            'bg-[#06B6D4] hover:bg-[#0891B2] text-white border-brand-900 shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none' : 
                            'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed shadow-none'}" 
                        onclick="reserveProduct('${product.id}')" 
                        ${!canReserve ? 'disabled' : ''}>
                    ${!canAfford ? '积分不足，继续努力 💪' : !inStock ? '下次早点来 😢' : '我要预约 🎁'}
                </button>
            </div>
        `;
    }).join('');
}

// 渲染预约标签页
function renderOrdersTab() {
    return `
        <div class="clay-panel p-6 mt-6 bg-[#ECFEFF]">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b-4 border-brand-900 pb-4">
                <h3 class="text-xl font-display font-black text-brand-900 uppercase tracking-widest">我的预约包里</h3>
                <div class="w-full sm:w-auto">
                    <select id="ordersFilter" onchange="filterOrders()" class="w-full sm:w-auto bg-white border-4 border-brand-900 rounded-xl px-4 py-2 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] font-black shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all cursor-pointer">
                        <option value="">全部预约</option>
                        <option value="pending">待老师确认</option>
                        <option value="confirmed">已兑换成功</option>
                        <option value="cancelled">已取消</option>
                    </select>
                </div>
            </div>
            
            <div class="space-y-4" id="ordersList">
                ${renderOrdersList(studentOrders)}
            </div>
        </div>
    `;
}

// 渲染预约列表
function renderOrdersList(orderList) {
    if (!orderList || orderList.length === 0) {
        return '<div class="clay-panel bg-white p-10 text-center text-brand-900/50 font-black uppercase tracking-widest border-4 border-dashed border-brand-900/20 shadow-none">包里空空如也，还没有预约任何商品哦。</div>';
    }

    return orderList.map(order => {
        const product = products.find(p => p.id === order.productId);
        const statusText = getOrderStatusText(order.status);
        
        // 状态徽章颜色
        const statusColors = {
            'pending': 'bg-[#FEF9C3] text-[#CA8A04] border-[#CA8A04]',
            'confirmed': 'bg-[#DCFCE7] text-[#16A34A] border-[#16A34A]',
            'cancelled': 'bg-[#F3F4F6] text-[#6B7280] border-[#9CA3AF]'
        };
        const badgeColor = statusColors[order.status] || statusColors['pending'];

        return `
            <div class="p-5 rounded-2xl bg-white border-4 border-brand-900 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:-translate-y-1 group">
                <div class="flex-1 w-full">
                    <div class="flex justify-between items-start md:items-center mb-3">
                        <h4 class="font-black text-xl text-brand-900 uppercase tracking-wider group-hover:text-[#06B6D4] transition-colors">${product?.name || '未知商品'}</h4>
                        <div class="text-Brand-900 bg-[#CFFAFE] border-2 border-brand-900 px-2 py-0.5 rounded font-display font-black shrink-0 ml-4">${product?.price || 0}分</div>
                    </div>
                    
                    <div class="flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold text-brand-900/60 font-mono">
                        <div>📅 预约于：${formatDate(order.reservedAt)}</div>
                        ${order.confirmedAt ? `<div class="text-[#16A34A]">✅ 确认于：${formatDate(order.confirmedAt)}</div>` : ''}
                    </div>
                </div>
                
                <div class="flex items-center gap-3 w-full md:w-auto shrink-0 justify-between md:justify-end border-t-2 md:border-t-0 md:border-l-4 border-brand-900/10 pt-3 md:pt-0 md:pl-5">
                    <span class="text-xs font-black uppercase tracking-widest px-3 py-1 rounded border-2 ${badgeColor}">${statusText}</span>
                    ${order.status === 'pending' ?
                `<button class="px-4 py-2 text-xs font-black uppercase rounded-lg bg-[#FCA5A5] border-2 border-[#7F1D1D] hover:bg-[#F87171] text-[#7F1D1D] transition-all shadow-[2px_2px_0px_rgba(127,29,29,1)] active:translate-y-1 active:shadow-none focus:outline-none shrink-0" onclick="cancelOrder('${order.id}')">放弃预约</button>` :
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