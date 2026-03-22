// 教师管理页面逻辑

let currentMode = 'normal';
let selectedStudent = null;
let students = [];
let products = [];
let orders = [];
let interactions = [];
let interactionHistoryPage = 1;
let interactionHistoryPageSize = 20;
let interactionHistoryTotalPages = 1;

// 页面初始化
document.addEventListener('DOMContentLoaded', function () {
    console.log('教师页面DOM加载完成');

    // 确保common.js中的函数已加载
    if (typeof checkTeacherAuth === 'function' && typeof showTeacherLogin === 'function') {
        console.log('common.js函数已加载，开始初始化');
        initTeacherPanel();
        setupEventListeners();
    } else {
        console.log('等待common.js加载完成...');
        // 延迟执行，等待common.js加载
        setTimeout(() => {
            console.log('延迟初始化教师面板');
            initTeacherPanel();
            setupEventListeners();
        }, 100);
    }
});

// 初始化教师面板
async function initTeacherPanel() {
    try {
        console.log('开始初始化教师面板');

        // 检查登录状态
        if (typeof checkTeacherAuth !== 'function') {
            console.error('checkTeacherAuth函数未定义，可能common.js未正确加载');
            showMessage('系统加载失败，请刷新页面', 'error');
            return;
        }

        if (!checkTeacherAuth()) {
            console.log('未登录，显示登录界面');
            showLoginRequiredState();
            return;
        }

        console.log('已登录，继续初始化');
        updateUserInfo(); // 更新用户信息显示
        await loadSystemMode();
        await loadInitialData();
        renderTeacherContent();
        enableAllControls(); // 启用所有控件
    } catch (error) {
        console.error('初始化失败:', error);
        document.getElementById('teacherContent').innerHTML =
            '<div class="error">系统初始化失败，请刷新页面重试</div>';
    }
}

// 设置事件监听器
function setupEventListeners() {
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleSystemMode);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', showChangePasswordModal);
    }

    // 更新用户信息显示
    updateUserInfo();
}

// 加载系统模式
async function loadSystemMode() {
    try {
        const response = await apiRequest('/api/config/mode');
        currentMode = response.data?.mode || response.mode || 'normal';
        updateModeToggle();
    } catch (error) {
        console.error('获取系统模式失败:', error);
        currentMode = storage.get('systemMode') || 'normal';
        updateModeToggle();
    }
}

// 更新模式切换按钮
function updateModeToggle() {
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.textContent = currentMode === 'class' ? '切换到平时模式' : '切换到上课模式';
        modeToggle.className = `mode-toggle ${currentMode}-mode`;
    }
}

// 更新用户信息显示
function updateUserInfo() {
    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        const teacher = storage.get('currentTeacher');
        if (teacher) {
            userInfo.innerHTML = `
                <span class="user-name">欢迎，${teacher.name}</span>
                <span class="user-id">(${teacher.id})</span>
            `;
        } else {
            userInfo.innerHTML = '<span class="user-name">未登录</span>';
        }
    }
}

// 处理退出登录
function handleLogout() {
    showConfirmModal('确定要退出登录吗？', () => {
        // 清除本地存储的登录信息
        storage.remove('teacherToken');
        storage.remove('currentTeacher');
        storage.remove('systemMode');

        // 显示退出消息
        showMessage('正在退出登录...', 'info');

        // 立即显示退出状态界面
        showLogoutState();

        // 延迟显示登录弹窗，给用户时间看到退出状态
        setTimeout(() => {
            if (typeof showTeacherLogin === 'function') {
                showTeacherLogin();
            } else {
                window.location.reload();
            }
        }, 1500);
    });
}

// 显示退出状态界面
function showLogoutState() {
    const container = document.getElementById('teacherContent');
    if (container) {
        container.innerHTML = `
            <div class="logout-state">
                <div class="logout-message">
                    <div class="logout-icon">👋</div>
                    <h2>已退出登录</h2>
                    <p>感谢您的使用，您已成功退出教师管理系统</p>
                    <div class="logout-actions">
                        <button onclick="showTeacherLogin()" class="login-again-btn">重新登录</button>
                        <a href="/" class="back-home-btn">返回首页</a>
                    </div>
                </div>
            </div>
        `;
    }

    // 更新用户信息显示
    updateUserInfo();

    // 禁用所有操作按钮
    disableAllControls();
}

// 切换系统模式
async function toggleSystemMode() {
    const newMode = currentMode === 'class' ? 'normal' : 'class';

    try {
        const response = await apiRequest('/api/config/mode', {
            method: 'POST',
            body: JSON.stringify({ mode: newMode })
        });

        currentMode = response.data?.mode || newMode;
        storage.set('systemMode', currentMode);
        updateModeToggle();
        showMessage(`已切换到${currentMode === 'class' ? '上课' : '平时'}模式`, 'success');

    } catch (error) {
        console.error('切换模式失败:', error);
        showMessage('切换模式失败，请重试', 'error');
    }
}

// 加载初始数据
async function loadInitialData() {
    try {
        // 并行加载所有数据
        const [studentsResponse, productsResponse, ordersResponse, interactionsResponse] = await Promise.all([
            apiRequest('/api/students').catch(() => ({ students: [] })),
            apiRequest('/api/products').catch(() => ({ products: [] })),
            apiRequest('/api/orders/pending').catch(() => ({ orders: [] })),
            apiRequest('/api/interactions/list?page=1&pageSize=100').catch(() => ({ data: { interactions: [] } }))
        ]);

        students = studentsResponse.data?.students || studentsResponse.students || [];
        products = productsResponse.data?.products || productsResponse.products || [];
        orders = ordersResponse.data?.orders || ordersResponse.orders || [];
        interactions = interactionsResponse.data?.interactions || [];

        // 保存到本地存储
        storage.set('teacherData', { students, products, orders, interactions });

    } catch (error) {
        console.error('加载数据失败:', error);
        // 尝试从本地存储恢复数据
        const cachedData = storage.get('teacherData');
        if (cachedData) {
            students = cachedData.students || [];
            products = cachedData.products || [];
            orders = cachedData.orders || [];
            interactions = cachedData.interactions || [];
        }
    }
}

// 渲染教师内容
function renderTeacherContent() {
    const container = document.getElementById('teacherContent');
    const teacher = storage.get('currentTeacher') || {};
    const canManageTeachers = ['admin', 'director'].includes(teacher.role);

    let tabsHtml = `
        <div class="management-tabs">
            <button class="tab-button active" onclick="switchTab(event, 'points')">积分管理</button>
            <button class="tab-button" onclick="switchTab(event, 'students')">学生管理</button>
            <button class="tab-button" onclick="switchTab(event, 'products')">商品管理</button>
            <button class="tab-button" onclick="switchTab(event, 'orders')">预约管理</button>
            <button class="tab-button" onclick="switchTab(event, 'interaction')">班级互动</button>
            <button class="tab-button" onclick="switchTab(event, 'semesters')">学期管理</button>
            <button class="tab-button" onclick="switchTab(event, 'system')">系统设置</button>
            ${canManageTeachers ? `<button class="tab-button" onclick="switchTab(event, 'teachers')">教师管理</button>` : ''}
        </div>
        
        <div id="pointsTab" class="tab-content active">
            ${renderPointsManagement()}
        </div>

        <div id="studentsTab" class="tab-content">
            ${renderStudentsManagement()}
        </div>
        
        <div id="productsTab" class="tab-content">
            ${renderProductsManagement()}
        </div>
        
        <div id="ordersTab" class="tab-content">
            ${renderOrdersManagement()}
        </div>

        <div id="interactionTab" class="tab-content">
            ${renderInteractionManagement()}
        </div>
        
        <div id="semestersTab" class="tab-content">
            ${renderSemestersManagement()}
        </div>
        
        <div id="systemTab" class="tab-content">
            ${renderSystemSettings()}
        </div>
    `;

    if (canManageTeachers) {
        tabsHtml += `
        <div id="teachersTab" class="tab-content">
            ${renderTeachersManagement()}
        </div>
        `;
    }

    container.innerHTML = tabsHtml;

    // 初始化各个模块
    initPointsManagement();
    renderStudentList(); // 初始化学生列表
    initSemesterPanel(); // 初始化学期管理面板
}

// 切换标签页
function switchTab(evt, tabName) {
    // 兼容旧调用：switchTab('points')
    if (typeof evt === 'string' && tabName === undefined) {
        tabName = evt;
        evt = null;
    }

    // 处理未传 event 的兼容（如果还有旧代码调用）
    const targetEl = evt ? evt.target : document.querySelector(`button[onclick="switchTab(event, '${tabName}')"]`);

    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (targetEl) targetEl.classList.add('active');

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tabEl = document.getElementById(`${tabName}Tab`);
    if (tabEl) tabEl.classList.add('active');

    // 根据标签页执行特定初始化
    switch (tabName) {
        case 'points':
            initPointsManagement();
            break;
        case 'students':
            initStudentsManagement();
            break;
        case 'products':
            initProductsManagement();
            break;
        case 'orders':
            initOrdersManagement();
            break;
        case 'interaction':
            initInteractionManagement();
            break;
        case 'system':
            initSystemSettings();
            break;
        case 'teachers':
            loadTeachersList();
            break;
    }
}

// 渲染积分管理
function renderPointsManagement() {
    return `
        <h2>积分管理</h2>
        <div class="points-management">
            <div class="student-selector">
                <h3>选择学生</h3>
                <div class="search-box">
                    <input type="text" id="studentSearch" placeholder="搜索学生姓名或学号..." 
                           onkeyup="filterStudents(this.value)">
                </div>
                <div class="student-list" id="studentList">
                    <!-- 学生列表将在这里动态生成 -->
                </div>
            </div>
            
            <div class="point-operations">
                <h3>积分操作</h3>
                <div id="selectedStudentInfo" class="selected-student-info">
                    <p>请先选择一个学生</p>
                </div>
                
                <div class="operation-form" id="operationForm" style="display: none;">
                    <div class="point-input-group">
                        <label>积分数量:</label>
                        <input type="number" id="pointsInput" min="1" max="100" value="1">
                        <div class="point-buttons">
                            <button onclick="quickSetPoints(1)">1分</button>
                            <button onclick="quickSetPoints(5)">5分</button>
                            <button onclick="quickSetPoints(10)">10分</button>
                        </div>
                    </div>
                    
                    <div class="reason-input">
                        <label>操作原因:</label>
                        <input type="text" id="reasonInput" placeholder="请输入加分或减分的原因...">
                    </div>
                    
                    <div class="action-buttons">
                        <button class="add-points" onclick="adjustPoints(true)">加分</button>
                        <button class="subtract-points" onclick="adjustPoints(false)">减分</button>
                    </div>
                </div>
                
                <div class="recent-operations" id="recentOperations">
                    <h4>最近操作</h4>
                    <div class="operations-list" id="operationsList">
                        <!-- 最近操作记录 -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 渲染商品管理
function renderProductsManagement() {
    return `
        <h2>商品管理</h2>
        <div class="product-management">
            <div class="product-form">
                <h3>添加/编辑商品</h3>
                <form id="productForm" onsubmit="saveProduct(event)">
                    <input type="hidden" id="productId">
                    
                    <div class="form-group">
                        <label>商品名称:</label>
                        <input type="text" id="productName" required>
                    </div>
                    
                    <div class="form-group">
                        <label>积分价格:</label>
                        <input type="number" id="productPrice" min="1" required>
                    </div>
                    
                    <div class="form-group">
                        <label>库存数量:</label>
                        <input type="number" id="productStock" min="0" required>
                    </div>
                    
                    <div class="form-group">
                        <label>商品描述:</label>
                        <textarea id="productDescription" rows="3"></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" id="saveProductBtn">保存商品</button>
                        <button type="button" onclick="resetProductForm()">重置</button>
                    </div>
                </form>
            </div>
            
            <div class="product-list">
                <h3>商品列表</h3>
                <div id="productsList">
                    <!-- 商品列表将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;
}

// 渲染预约管理
function renderOrdersManagement() {
    return `
        <h2>预约管理</h2>
        <div class="orders-management">
            <div class="orders-filter">
                <h3>筛选条件</h3>
                <div class="filter-controls">
                    <select id="orderStatusFilter" onchange="filterOrders()">
                        <option value="">所有状态</option>
                        <option value="pending">待确认</option>
                        <option value="confirmed">已确认</option>
                        <option value="cancelled">已取消</option>
                    </select>
                    
                    <input type="text" id="orderStudentFilter" placeholder="搜索学生..." 
                           onkeyup="filterOrders()">
                </div>
            </div>
            
            <div class="orders-list" id="ordersList">
                <!-- 预约列表将在这里动态生成 -->
            </div>
        </div>
    `;
}

// 渲染班级互动管理
function renderInteractionManagement() {
    return `
        <h2>班级互动</h2>
        <div class="interaction-management">
            <div class="interaction-publish">
                <h3>老师下发（通知/任务）</h3>
                <form onsubmit="publishInteraction(event)">
                    <div class="form-group">
                        <label>类型</label>
                        <select id="interactionType" required>
                            <option value="notice">通知</option>
                            <option value="task">任务</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>标题</label>
                        <input type="text" id="interactionTitle" maxlength="80" required placeholder="例如：今日作业收齐确认">
                    </div>
                    <div class="form-group">
                        <label>内容</label>
                        <textarea id="interactionContent" rows="4" maxlength="500" required placeholder="请输入通知或任务的具体内容"></textarea>
                    </div>
                    <div class="form-group">
                        <label>截止时间（可选）</label>
                        <input type="datetime-local" id="interactionDeadlineAt">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="submit-btn">发布</button>
                    </div>
                </form>
            </div>

            <div class="interaction-pending-reports">
                <h3>学生上报待处理</h3>
                <div id="pendingReportsList" class="interaction-list"></div>
            </div>

            <div class="interaction-history">
                <div class="history-header">
                    <h3>历史互动</h3>
                    <div class="history-filters">
                        <select id="interactionHistoryType" onchange="refreshInteractionHistory(1)">
                            <option value="">全部类型</option>
                            <option value="notice">通知</option>
                            <option value="task">任务</option>
                            <option value="report">上报</option>
                        </select>
                        <select id="interactionHistoryStatus" onchange="refreshInteractionHistory(1)">
                            <option value="">全部状态</option>
                            <option value="pending">待处理</option>
                            <option value="confirmed">已确认</option>
                            <option value="approved">已通过</option>
                            <option value="rejected">已驳回</option>
                            <option value="closed">已关闭</option>
                        </select>
                        <button type="button" class="action-btn" onclick="refreshInteractionHistory(1)">刷新</button>
                    </div>
                </div>
                <div id="interactionHistoryList" class="interaction-list"></div>
                <div class="history-pagination">
                    <button type="button" class="action-btn" onclick="changeInteractionHistoryPage(-1)">上一页</button>
                    <span id="interactionHistoryPageInfo">第 1 / 1 页</span>
                    <button type="button" class="action-btn" onclick="changeInteractionHistoryPage(1)">下一页</button>
                </div>
            </div>
        </div>
    `;
}

// 渲染系统设置
function renderSystemSettings() {
    return `
        <h2>系统设置</h2>
        <div class="system-settings">
            <div class="setting-section">
                <h3>系统模式</h3>
                <div class="mode-controls">
                    <p>当前模式: <span id="currentModeDisplay">${currentMode === 'class' ? '上课模式' : '平时模式'}</span></p>
                    <button onclick="toggleSystemMode()" class="mode-switch-btn">
                        切换到${currentMode === 'class' ? '平时' : '上课'}模式
                    </button>
                </div>
            </div>
            
            <div class="setting-section">
                <h3>系统参数配置</h3>
                <form id="configForm" onsubmit="saveSystemConfig(event)">
                    <div class="config-group">
                        <label for="autoRefreshInterval">自动刷新间隔 (秒):</label>
                        <input type="number" id="autoRefreshInterval" min="5" max="300" value="30">
                        <small>大屏显示的自动刷新间隔，范围: 5-300秒</small>
                    </div>
                    
                    <div class="config-group">
                        <label for="maxPointsPerOperation">单次操作最大积分:</label>
                        <input type="number" id="maxPointsPerOperation" min="1" max="1000" value="100">
                        <small>教师单次加分或减分的最大值，范围: 1-1000分</small>
                    </div>
                    
                    <div class="config-group">
                        <label for="semesterStartDate">学期开始日期:</label>
                        <input type="date" id="semesterStartDate">
                        <small>用于计算周榜和学期统计</small>
                    </div>
                    
                    <div class="config-group">
                        <label for="className">班级名称:</label>
                        <input type="text" id="className" placeholder="请输入班级名称" value="花儿起舞">
                        <small>显示在系统标题和页面中的班级名称</small>
                    </div>
                    
                    <div class="config-group">
                        <label for="author">作者:</label>
                        <input type="text" id="author" placeholder="请输入作者名称" value="茗雨">
                        <small>系统作者信息</small>
                    </div>
                    
                    <div class="config-group">
                        <label for="copyright">版权信息:</label>
                        <input type="text" id="copyright" placeholder="请输入版权信息" value="© 2025 花儿起舞班级积分管理系统 | 作者：茗雨">
                        <small>显示在页面底部的版权信息</small>
                    </div>
                    
                    <div class="config-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="pointsResetEnabled">
                            启用积分清零功能
                        </label>
                        <small>启用后可以在数据管理中重置所有学生积分</small>
                    </div>
                    
                    <div class="config-actions">
                        <button type="submit" class="save-config-btn">保存配置</button>
                        <button type="button" onclick="resetConfigForm()" class="reset-config-btn">重置</button>
                    </div>
                </form>
            </div>
            
            <div class="setting-section">
                <h3>数据管理</h3>
                <div class="data-controls">
                    <button onclick="exportData()" class="export-btn">导出数据</button>
                    <button onclick="createBackup()" class="backup-btn">创建备份</button>
                    <button onclick="showBackupManager()" class="backup-manager-btn">备份管理</button>
                    <button onclick="repairDataConsistency()" class="repair-btn">修复数据一致性</button>
                    <button onclick="showResetConfirm()" class="reset-btn danger" id="resetPointsBtn" disabled>重置积分</button>
                </div>
                <small>重置积分功能需要在系统参数中启用</small>
            </div>
            
            <div class="setting-section" id="backupManagerSection" style="display: none;">
                <h3>备份管理</h3>
                <div class="backup-manager">
                    <div class="backup-actions">
                        <button onclick="refreshBackupList()" class="refresh-btn">刷新列表</button>
                        <button onclick="cleanOldBackups()" class="cleanup-btn">清理旧备份</button>
                        <div class="file-upload-group">
                            <input type="file" id="restoreFileInput" accept=".zip" style="display: none;" onchange="handleRestoreFile(event)">
                            <button onclick="document.getElementById('restoreFileInput').click()" class="restore-btn">从文件恢复</button>
                        </div>
                    </div>
                    
                    <div class="backup-list" id="backupList">
                        <div class="loading">正在加载备份列表...</div>
                    </div>
                    
                    <div class="data-export-section">
                        <h4>单独数据导出/导入</h4>
                        <div class="data-type-controls">
                            <div class="data-type-item">
                                <span>学生数据</span>
                                <button onclick="exportSingleData('students')" class="export-single-btn">导出</button>
                                <input type="file" id="importStudentsInput" accept=".json" style="display: none;" onchange="importSingleData('students', event)">
                                <button onclick="document.getElementById('importStudentsInput').click()" class="import-single-btn">导入</button>
                            </div>
                            <div class="data-type-item">
                                <span>积分记录</span>
                                <button onclick="exportSingleData('points')" class="export-single-btn">导出</button>
                                <input type="file" id="importPointsInput" accept=".json" style="display: none;" onchange="importSingleData('points', event)">
                                <button onclick="document.getElementById('importPointsInput').click()" class="import-single-btn">导入</button>
                            </div>
                            <div class="data-type-item">
                                <span>商品数据</span>
                                <button onclick="exportSingleData('products')" class="export-single-btn">导出</button>
                                <input type="file" id="importProductsInput" accept=".json" style="display: none;" onchange="importSingleData('products', event)">
                                <button onclick="document.getElementById('importProductsInput').click()" class="import-single-btn">导入</button>
                            </div>
                            <div class="data-type-item">
                                <span>预约订单</span>
                                <button onclick="exportSingleData('orders')" class="export-single-btn">导出</button>
                                <input type="file" id="importOrdersInput" accept=".json" style="display: none;" onchange="importSingleData('orders', event)">
                                <button onclick="document.getElementById('importOrdersInput').click()" class="import-single-btn">导入</button>
                            </div>
                            <div class="data-type-item">
                                <span>系统配置</span>
                                <button onclick="exportSingleData('config')" class="export-single-btn">导出</button>
                                <input type="file" id="importConfigInput" accept=".json" style="display: none;" onchange="importSingleData('config', event)">
                                <button onclick="document.getElementById('importConfigInput').click()" class="import-single-btn">导入</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="data-statistics" id="dataStatistics">
                        <h4>数据统计</h4>
                        <div class="stats-loading">正在加载统计信息...</div>
                    </div>
                </div>
            </div>
            
            <div class="setting-section">
                <h3>系统信息</h3>
                <div class="system-info">
                    <p>班级名称: <span id="currentClassName">花儿起舞</span></p>
                    <p>学生总数: <span id="studentCount">${students.length}</span></p>
                    <p>商品总数: <span id="productCount">${products.length}</span></p>
                    <p>待处理预约: <span id="pendingOrderCount">${orders.filter(o => o.status === 'pending').length}</span></p>
                    <p>系统版本: <span>1.0.0</span></p>
                    <p>作者: <span id="currentAuthor">茗雨</span></p>
                    <p>最后更新: <span id="lastUpdateTime">-</span></p>
                </div>
            </div>
        </div>
    `;
}

// 初始化班级互动
async function initInteractionManagement() {
    await refreshInteractionData();
    await refreshInteractionHistory(1);
}

async function refreshInteractionData() {
    try {
        const response = await apiRequest('/api/interactions/list?page=1&pageSize=100');
        interactions = response.data?.interactions || [];
        renderPendingReports();
        storage.set('teacherData', { students, products, orders, interactions });
    } catch (error) {
        console.error('加载互动数据失败:', error);
        showMessage('加载互动数据失败', 'error');
    }
}

async function publishInteraction(event) {
    event.preventDefault();

    const type = document.getElementById('interactionType')?.value;
    const title = document.getElementById('interactionTitle')?.value.trim();
    const content = document.getElementById('interactionContent')?.value.trim();
    const deadlineRaw = document.getElementById('interactionDeadlineAt')?.value;

    if (!type || !title || !content) {
        showMessage('请完整填写互动信息', 'warning');
        return;
    }

    try {
        // datetime-local 是本地时间字符串，这里统一转为 ISO 便于后端和大屏渲染。
        const deadlineAt = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
        await apiRequest('/api/interactions/publish', {
            method: 'POST',
            body: JSON.stringify({ type, title, content, deadlineAt })
        });
        showMessage('发布成功', 'success');

        document.getElementById('interactionTitle').value = '';
        document.getElementById('interactionContent').value = '';
        document.getElementById('interactionDeadlineAt').value = '';

        await refreshInteractionData();
        await refreshInteractionHistory(1);
    } catch (error) {
        console.error('发布互动失败:', error);
        showMessage(error.message || '发布失败', 'error');
    }
}

function renderPendingReports() {
    const container = document.getElementById('pendingReportsList');
    if (!container) return;

    const pendingReports = interactions.filter(item => item.type === 'report' && item.status === 'pending');
    if (pendingReports.length === 0) {
        container.innerHTML = '<div class="no-data">暂无待处理上报</div>';
        return;
    }

    container.innerHTML = pendingReports.map(item => `
        <div class="interaction-item">
            <div class="interaction-item-header">
                <span class="tag type-report">上报</span>
                <span class="tag status-pending">待审核</span>
                <span class="meta">${formatDate(item.createdAt)}</span>
            </div>
            <h4>${escapeInteractionText(item.title)}</h4>
            <p>${escapeInteractionText(item.content)}</p>
            <div class="meta">上报人：${escapeInteractionText(item.createdByName || item.createdById)}</div>
            <div class="interaction-actions">
                <button class="action-btn success" onclick="reviewReportInteraction('${item.id}', 'approved')">通过</button>
                <button class="action-btn danger" onclick="reviewReportInteraction('${item.id}', 'rejected')">驳回</button>
            </div>
        </div>
    `).join('');
}

async function reviewReportInteraction(id, status) {
    const note = status === 'rejected' ? prompt('请输入驳回原因（可选）：', '') : '';
    try {
        await apiRequest(`/api/interactions/${id}/teacher-review`, {
            method: 'POST',
            body: JSON.stringify({
                status,
                note: note || ''
            })
        });
        showMessage(status === 'approved' ? '已审核通过' : '已驳回', 'success');
        await refreshInteractionData();
        await refreshInteractionHistory(interactionHistoryPage);
    } catch (error) {
        console.error('审核上报失败:', error);
        showMessage(error.message || '审核失败', 'error');
    }
}

async function closeTeacherInteraction(id) {
    try {
        await apiRequest(`/api/interactions/${id}/close`, {
            method: 'POST',
            body: JSON.stringify({})
        });
        showMessage('已关闭互动', 'success');
        await refreshInteractionData();
        await refreshInteractionHistory(interactionHistoryPage);
    } catch (error) {
        console.error('关闭互动失败:', error);
        showMessage(error.message || '关闭失败', 'error');
    }
}

async function refreshInteractionHistory(page = 1) {
    const type = document.getElementById('interactionHistoryType')?.value || '';
    const status = document.getElementById('interactionHistoryStatus')?.value || '';

    interactionHistoryPage = Math.max(1, page);
    const query = new URLSearchParams({
        page: String(interactionHistoryPage),
        pageSize: String(interactionHistoryPageSize)
    });
    if (type) query.set('type', type);
    if (status) query.set('status', status);

    try {
        const response = await apiRequest(`/api/interactions/list?${query.toString()}`);
        const list = response.data?.interactions || [];
        const pagination = response.data?.pagination || {};
        interactionHistoryTotalPages = pagination.pages || 1;

        renderInteractionHistoryList(list);
        updateInteractionHistoryPager();
    } catch (error) {
        console.error('加载互动历史失败:', error);
        showMessage(error.message || '加载历史失败', 'error');
    }
}

function renderInteractionHistoryList(list) {
    const container = document.getElementById('interactionHistoryList');
    if (!container) return;

    if (!list || list.length === 0) {
        container.innerHTML = '<div class="no-data">暂无历史互动记录</div>';
        return;
    }

    container.innerHTML = list.map(item => {
        const canClose = (item.type === 'notice' || item.type === 'task') && item.status !== 'closed';
        return `
            <div class="interaction-item">
                <div class="interaction-item-header">
                    <span class="tag type-${item.type}">${interactionTypeText(item.type)}</span>
                    <span class="tag status-${item.status}">${interactionStatusText(item.status)}</span>
                    <span class="meta">${formatDate(item.createdAt)}</span>
                </div>
                <h4>${escapeInteractionText(item.title)}</h4>
                <p>${escapeInteractionText(item.content)}</p>
                <div class="meta">发布/上报：${escapeInteractionText(item.createdByName || item.createdById)}</div>
                ${item.classActionBy ? `<div class="meta">班级确认：${escapeInteractionText(item.classActionBy)} ${item.classActionAt ? `(${formatDate(item.classActionAt)})` : ''}</div>` : ''}
                ${item.teacherActionBy ? `<div class="meta">教师处理：${escapeInteractionText(item.teacherActionBy)} ${item.teacherActionAt ? `(${formatDate(item.teacherActionAt)})` : ''}</div>` : ''}
                ${item.teacherActionNote ? `<div class="meta">教师备注：${escapeInteractionText(item.teacherActionNote)}</div>` : ''}
                ${canClose ? `<div class="interaction-actions"><button class="action-btn warning" onclick="closeTeacherInteraction('${item.id}')">关闭</button></div>` : ''}
            </div>
        `;
    }).join('');
}

function updateInteractionHistoryPager() {
    const info = document.getElementById('interactionHistoryPageInfo');
    if (!info) return;
    info.textContent = `第 ${interactionHistoryPage} / ${interactionHistoryTotalPages} 页`;
}

function changeInteractionHistoryPage(delta) {
    const nextPage = interactionHistoryPage + delta;
    if (nextPage < 1 || nextPage > interactionHistoryTotalPages) {
        return;
    }
    refreshInteractionHistory(nextPage);
}

function interactionTypeText(type) {
    if (type === 'notice') return '通知';
    if (type === 'task') return '任务';
    if (type === 'report') return '上报';
    return type;
}

function interactionStatusText(status) {
    const map = {
        pending: '待处理',
        confirmed: '已确认',
        approved: '已通过',
        rejected: '已驳回',
        closed: '已关闭'
    };
    return map[status] || status;
}

function escapeInteractionText(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 初始化积分管理
function initPointsManagement() {
    renderStudentList();
    loadRecentOperations();
}

// 渲染学生列表
function renderStudentList(filteredStudents = null) {
    const container = document.getElementById('studentList');
    const studentsToShow = filteredStudents || students;

    if (studentsToShow.length === 0) {
        container.innerHTML = '<div class="no-data">暂无学生数据</div>';
        return;
    }

    // 按学号排序
    const sortedStudents = [...studentsToShow].sort((a, b) => {
        // 确保学号按数字顺序排序
        const idA = String(a.id || '').padStart(10, '0');
        const idB = String(b.id || '').padStart(10, '0');
        return idA.localeCompare(idB);
    });

    container.innerHTML = sortedStudents.map(student => `
        <div class="student-item" onclick="selectStudent('${student.id}')">
            <div class="student-info">
                <div class="student-name">${student.name}</div>
                <div class="student-id">${student.id}</div>
            </div>
            <div class="student-balance">${student.balance || 0}分</div>
        </div>
    `).join('');
}

// 筛选学生
function filterStudents(searchTerm) {
    if (!searchTerm.trim()) {
        renderStudentList();
        return;
    }

    const filtered = students.filter(student =>
        student.name.includes(searchTerm) ||
        student.id.includes(searchTerm)
    );

    renderStudentList(filtered);
}

// 选择学生
function selectStudent(studentId) {
    selectedStudent = students.find(s => s.id === studentId);

    // 更新选中状态
    document.querySelectorAll('.student-item').forEach(item => {
        item.classList.remove('selected');
    });
    const targetItem = document.querySelector(`.student-item[onclick="selectStudent('${studentId}')"]`);
    if (targetItem) targetItem.classList.add('selected');

    // 显示学生信息和操作表单
    const infoContainer = document.getElementById('selectedStudentInfo');
    const formContainer = document.getElementById('operationForm');

    if (selectedStudent) {
        infoContainer.innerHTML = `
            <div class="selected-student">
                <h4>${selectedStudent.name} (${selectedStudent.id})</h4>
                <p>当前积分: <span class="balance">${selectedStudent.balance || 0}分</span></p>
            </div>
        `;
        formContainer.style.display = 'block';

        // 清空输入框
        document.getElementById('pointsInput').value = '1';
        document.getElementById('reasonInput').value = '';
        
        // 加载该学生的最近操作记录
        loadRecentOperations();
    }
}

// 快速设置积分
function quickSetPoints(points) {
    document.getElementById('pointsInput').value = points;
}

// 调整积分
async function adjustPoints(isAdd) {
    if (!selectedStudent) {
        showMessage('请先选择一个学生', 'warning');
        return;
    }

    const points = parseInt(document.getElementById('pointsInput').value);
    const reason = document.getElementById('reasonInput').value.trim();

    if (!points || points <= 0) {
        showMessage('请输入有效的积分数量', 'warning');
        return;
    }

    if (!reason) {
        showMessage('请输入操作原因', 'warning');
        return;
    }

    const addButton = document.querySelector('.add-points');
    const subButton = document.querySelector('.subtract-points');
    const originalAddText = addButton ? addButton.textContent : '加分';
    const originalSubText = subButton ? subButton.textContent : '减分';

    // 禁用按钮并显示加载状态
    if (addButton) {
        addButton.disabled = true;
        if (isAdd) addButton.textContent = '处理中...';
    }
    if (subButton) {
        subButton.disabled = true;
        if (!isAdd) subButton.textContent = '处理中...';
    }

    try {
        const endpoint = isAdd ? '/api/points/add' : '/api/points/subtract';
        const response = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({
                studentId: selectedStudent.id,
                points: points,
                reason: reason
            })
        });

        // 更新本地学生数据
        const newBalance = response.data ? response.data.newBalance : response.newBalance;
        selectedStudent.balance = newBalance;
        const studentIndex = students.findIndex(s => s.id === selectedStudent.id);
        if (studentIndex !== -1) {
            students[studentIndex].balance = newBalance;
        }

        // 刷新显示，保留搜索关键字
        const searchInput = document.getElementById('studentSearch');
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        if (searchTerm) {
            filterStudents(searchTerm);
        } else {
            renderStudentList();
        }
        
        selectStudent(selectedStudent.id);
        loadRecentOperations();

        showMessage(`${isAdd ? '加分' : '减分'}操作成功`, 'success');

        // 清空原因输入框
        document.getElementById('reasonInput').value = '';

    } catch (error) {
        console.error('积分操作失败:', error);
        // 使用服务器返回的具体错误信息，如果没有则使用默认提示
        showMessage(error.message || '积分操作失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        if (addButton) {
            addButton.disabled = false;
            addButton.textContent = originalAddText;
        }
        if (subButton) {
            subButton.disabled = false;
            subButton.textContent = originalSubText;
        }
    }
}

// 加载最近操作
async function loadRecentOperations() {
    console.log('loadRecentOperations 被调用', selectedStudent ? `(选中的学生ID: ${selectedStudent.id})` : '(无选中的学生)');
    if (!selectedStudent) return;

    try {
        console.log(`正在请求 API: /api/points/history/${selectedStudent.id}`);
        const response = await apiRequest(`/api/points/history/${selectedStudent.id}`);
        console.log('API 返回结果:', response);
        const records = response.data?.records || response.records || [];
        console.log('解析到的记录数:', records.length);
        
        const container = document.getElementById('operationsList');
        if (!container) {
            console.error('致命错误: 在 DOM 中找不到 ID 为 operationsList 的容器');
            return;
        }
        
        if (records.length === 0) {
            container.innerHTML = '<div class="no-data">暂无最近操作记录</div>';
            return;
        }

        const htmlContent = records.map(record => `
            <div class="operation-item">
                <div class="operation-header">
                    <span class="operation-reason">${record.reason}</span>
                    <span class="operation-points ${record.type}">${record.points > 0 ? '+' : ''}${record.points}分</span>
                </div>
                <div class="operation-footer">
                    <span class="operation-time">${new Date(record.timestamp).toLocaleString()}</span>
                    <span class="operation-operator">操作人: ${record.operatorId || '系统'}</span>
                </div>
            </div>
        `).join('');
        
        console.log('生成的 HTML 长度:', htmlContent.length);
        container.innerHTML = htmlContent;
        console.log('HTML 已插入到 operationsList 容器中');
    } catch (error) {
        console.error('加载操作记录失败:', error);
        const container = document.getElementById('operationsList');
        if (container) container.innerHTML = '<div class="error">加载失败</div>';
    }
}

// 初始化商品管理
function initProductsManagement() {
    renderProductsList();
}

// 渲染商品列表
function renderProductsList() {
    const container = document.getElementById('productsList');

    if (products.length === 0) {
        container.innerHTML = '<div class="no-data">暂无商品数据</div>';
        return;
    }

    container.innerHTML = products.map(product => `
        <div class="product-item">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-details">
                    价格: ${product.price}分 | 库存: ${product.stock}个
                </div>
            </div>
            <div class="product-actions">
                <button class="edit-btn" onclick="editProduct('${product.id}')">编辑</button>
                <button class="delete-btn" onclick="deleteProduct('${product.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 保存商品
async function saveProduct(event) {
    event.preventDefault();

    const productId = document.getElementById('productId').value;
    const name = document.getElementById('productName').value.trim();
    const price = parseInt(document.getElementById('productPrice').value);
    const stock = parseInt(document.getElementById('productStock').value);
    const description = document.getElementById('productDescription').value.trim();

    if (!name || !price || price <= 0 || stock < 0) {
        showMessage('请填写有效的商品信息', 'warning');
        return;
    }

    try {
        const isEdit = !!productId;
        const endpoint = isEdit ? `/api/products/${productId}` : '/api/products';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await apiRequest(endpoint, {
            method: method,
            body: JSON.stringify({
                name: name,
                price: price,
                stock: stock,
                description: description
            })
        });

        // 更新本地数据
        const productData = response.data?.product || response.product;
        if (isEdit) {
            const index = products.findIndex(p => p.id === productId);
            if (index !== -1) {
                products[index] = productData;
            }
        } else {
            products.push(productData);
        }

        // 刷新显示
        renderProductsList();
        resetProductForm();

        showMessage(`商品${isEdit ? '更新' : '添加'}成功`, 'success');

    } catch (error) {
        console.error('保存商品失败:', error);
        showMessage('保存商品失败，请重试', 'error');
    }
}

// 编辑商品
function editProduct(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productDescription').value = product.description || '';

    document.getElementById('saveProductBtn').textContent = '更新商品';
}

// 删除商品
async function deleteProduct(productId) {
    if (!confirm('确定要删除这个商品吗？')) return;

    try {
        await apiRequest(`/api/products/${productId}`, {
            method: 'DELETE'
        });

        // 从本地数据中移除
        products = products.filter(p => p.id !== productId);

        // 刷新显示
        renderProductsList();

        showMessage('商品删除成功', 'success');

    } catch (error) {
        console.error('删除商品失败:', error);
        showMessage('删除商品失败，请重试', 'error');
    }
}

// 重置商品表单
function resetProductForm() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('saveProductBtn').textContent = '保存商品';
}

// 初始化预约管理
function initOrdersManagement() {
    renderOrdersList();
}

// 渲染预约列表
function renderOrdersList(filteredOrders = null) {
    const container = document.getElementById('ordersList');
    const ordersToShow = filteredOrders || orders;

    if (ordersToShow.length === 0) {
        container.innerHTML = '<div class="no-data">暂无预约数据</div>';
        return;
    }

    container.innerHTML = ordersToShow.map(orderData => {
        // 处理数据结构：如果是从API获取的详细数据，包含order、student、product字段
        let order, student, product;

        if (orderData.order && orderData.student && orderData.product) {
            // 来自API的详细数据结构
            order = orderData.order;
            student = orderData.student;
            product = orderData.product;
        } else {
            // 简单的订单数据结构，需要从本地数据中查找
            order = orderData;
            student = students.find(s => s.id === order.studentId);
            product = products.find(p => p.id === order.productId);
        }

        return `
            <div class="order-item">
                <div class="order-info">
                    <div class="order-header">
                        <span class="student-name">${student?.name || '未知学生'} (${student?.id || order.studentId})</span>
                        <span class="order-status status-${order.status}">${getStatusText(order.status)}</span>
                    </div>
                    <div class="order-details">
                        <div class="order-detail-row">
                            <strong>商品:</strong> ${product?.name || '未知商品'}
                        </div>
                        <div class="order-detail-row">
                            <strong>价格:</strong> ${product?.price || 0}分
                        </div>
                        <div class="order-detail-row">
                            <strong>预约时间:</strong> ${formatDate(order.reservedAt)}
                        </div>
                        ${order.confirmedAt ? `
                            <div class="order-detail-row">
                                <strong>确认时间:</strong> ${formatDate(order.confirmedAt)}
                            </div>
                        ` : ''}
                        ${order.cancelledAt ? `
                            <div class="order-detail-row">
                                <strong>取消时间:</strong> ${formatDate(order.cancelledAt)}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="order-actions">
                    ${order.status === 'pending' ? `
                        <button class="confirm-btn" onclick="confirmOrder('${order.id}')">确认兑换</button>
                        <button class="cancel-btn" onclick="cancelOrder('${order.id}')">取消预约</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 获取状态文本
function getStatusText(status) {
    const statusMap = {
        'pending': '待确认',
        'confirmed': '已确认',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

// 筛选预约
function filterOrders() {
    const statusFilter = document.getElementById('orderStatusFilter').value;
    const studentFilter = document.getElementById('orderStudentFilter').value.toLowerCase();

    let filtered = orders;

    if (statusFilter) {
        filtered = filtered.filter(orderData => {
            const order = orderData.order || orderData;
            return order.status === statusFilter;
        });
    }

    if (studentFilter) {
        filtered = filtered.filter(orderData => {
            let student;
            if (orderData.student) {
                // 来自API的详细数据
                student = orderData.student;
            } else {
                // 简单数据，需要查找
                const order = orderData;
                student = students.find(s => s.id === order.studentId);
            }
            return student && (
                student.name.toLowerCase().includes(studentFilter) ||
                student.id.toLowerCase().includes(studentFilter)
            );
        });
    }

    renderOrdersList(filtered);
}

// 确认预约
async function confirmOrder(orderId) {
    try {
        const response = await apiRequest(`/api/orders/${orderId}/confirm`, {
            method: 'POST'
        });

        // 更新本地数据
        const orderIndex = orders.findIndex(orderData => {
            const order = orderData.order || orderData;
            return order.id === orderId;
        });

        if (orderIndex !== -1) {
            if (orders[orderIndex].order) {
                // 详细数据结构
                orders[orderIndex].order.status = 'confirmed';
                orders[orderIndex].order.confirmedAt = new Date().toISOString();
            } else {
                // 简单数据结构
                orders[orderIndex].status = 'confirmed';
                orders[orderIndex].confirmedAt = new Date().toISOString();
            }
        }

        // 刷新显示
        renderOrdersList();

        showMessage('预约确认成功', 'success');

    } catch (error) {
        console.error('确认预约失败:', error);
        showMessage('确认预约失败，请重试', 'error');
    }
}

// 取消预约
async function cancelOrder(orderId) {
    if (!confirm('确定要取消这个预约吗？')) return;

    try {
        const response = await apiRequest(`/api/orders/${orderId}/cancel`, {
            method: 'POST'
        });

        // 更新本地数据
        const orderIndex = orders.findIndex(orderData => {
            const order = orderData.order || orderData;
            return order.id === orderId;
        });

        if (orderIndex !== -1) {
            if (orders[orderIndex].order) {
                // 详细数据结构
                orders[orderIndex].order.status = 'cancelled';
                orders[orderIndex].order.cancelledAt = new Date().toISOString();
            } else {
                // 简单数据结构
                orders[orderIndex].status = 'cancelled';
                orders[orderIndex].cancelledAt = new Date().toISOString();
            }
        }

        // 刷新显示
        renderOrdersList();

        showMessage('预约取消成功', 'success');

    } catch (error) {
        console.error('取消预约失败:', error);
        showMessage('取消预约失败，请重试', 'error');
    }
}

// 初始化系统设置
async function initSystemSettings() {
    // 更新显示的统计信息
    document.getElementById('studentCount').textContent = students.length;
    document.getElementById('productCount').textContent = products.length;
    document.getElementById('pendingOrderCount').textContent = orders.filter(o => o.status === 'pending').length;
    document.getElementById('currentModeDisplay').textContent = currentMode === 'class' ? '上课模式' : '平时模式';

    // 加载系统配置
    await loadSystemConfig();
}

// 导出数据
function exportData() {
    const data = {
        students: students,
        products: products,
        orders: orders,
        exportTime: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classroom-points-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showMessage('数据导出成功', 'success');
}

// 备份数据
async function backupData() {
    try {
        await apiRequest('/api/config/backup', {
            method: 'POST'
        });

        showMessage('数据备份成功', 'success');

    } catch (error) {
        console.error('备份数据失败:', error);
        showMessage('备份数据失败，请重试', 'error');
    }
}

// 显示重置确认
function showResetConfirm() {
    const confirmed = confirm('警告：此操作将重置所有学生的积分为0，且无法撤销。确定要继续吗？');
    if (confirmed) {
        const doubleConfirmed = confirm('请再次确认：您真的要重置所有积分吗？');
        if (doubleConfirmed) {
            resetAllPoints();
        }
    }
}

// 重置所有积分
async function resetAllPoints() {
    try {
        await apiRequest('/api/config/reset-points', {
            method: 'POST'
        });

        // 更新本地数据
        students.forEach(student => {
            student.balance = 0;
        });

        // 刷新显示
        if (document.getElementById('studentList')) {
            renderStudentList();
        }

        showMessage('积分重置成功', 'success');

    } catch (error) {
        console.error('重置积分失败:', error);
        showMessage('重置积分失败，请重试', 'error');
    }
}

// 加载系统配置
async function loadSystemConfig() {
    try {
        const response = await apiRequest('/api/config');
        const config = response.data;

        // 填充配置表单
        document.getElementById('autoRefreshInterval').value = config.autoRefreshInterval || 30;
        document.getElementById('maxPointsPerOperation').value = config.maxPointsPerOperation || 100;
        document.getElementById('pointsResetEnabled').checked = config.pointsResetEnabled || false;
        document.getElementById('className').value = config.className || '花儿起舞';
        document.getElementById('author').value = config.author || '茗雨';
        document.getElementById('copyright').value = config.copyright || '© 2025 花儿起舞班级积分管理系统 | 作者：茗雨';

        // 设置学期开始日期
        if (config.semesterStartDate) {
            const date = new Date(config.semesterStartDate);
            document.getElementById('semesterStartDate').value = date.toISOString().split('T')[0];
        }

        // 更新系统信息显示
        const currentClassNameElement = document.getElementById('currentClassName');
        const currentAuthorElement = document.getElementById('currentAuthor');
        if (currentClassNameElement) {
            currentClassNameElement.textContent = config.className || '花儿起舞';
        }
        if (currentAuthorElement) {
            currentAuthorElement.textContent = config.author || '茗雨';
        }

        // 更新重置按钮状态
        const resetBtn = document.getElementById('resetPointsBtn');
        if (resetBtn) {
            resetBtn.disabled = !config.pointsResetEnabled;
        }

        // 更新最后更新时间
        const lastUpdateElement = document.getElementById('lastUpdateTime');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = formatDate(new Date().toISOString());
        }

    } catch (error) {
        console.error('加载系统配置失败:', error);
        showMessage('加载系统配置失败', 'warning');
    }
}

// 保存系统配置
async function saveSystemConfig(event) {
    event.preventDefault();

    const autoRefreshInterval = parseInt(document.getElementById('autoRefreshInterval').value);
    const maxPointsPerOperation = parseInt(document.getElementById('maxPointsPerOperation').value);
    const pointsResetEnabled = document.getElementById('pointsResetEnabled').checked;
    const semesterStartDate = document.getElementById('semesterStartDate').value;
    const className = document.getElementById('className').value.trim();
    const author = document.getElementById('author').value.trim();
    const copyright = document.getElementById('copyright').value.trim();

    // 参数验证
    if (autoRefreshInterval < 5 || autoRefreshInterval > 300) {
        showMessage('自动刷新间隔必须在5-300秒之间', 'warning');
        return;
    }

    if (maxPointsPerOperation < 1 || maxPointsPerOperation > 1000) {
        showMessage('单次操作最大积分必须在1-1000之间', 'warning');
        return;
    }

    if (!semesterStartDate) {
        showMessage('请选择学期开始日期', 'warning');
        return;
    }

    if (!className) {
        showMessage('班级名称不能为空', 'warning');
        return;
    }

    if (!author) {
        showMessage('作者名称不能为空', 'warning');
        return;
    }

    if (!copyright) {
        showMessage('版权信息不能为空', 'warning');
        return;
    }

    try {
        const configData = {
            autoRefreshInterval: autoRefreshInterval,
            maxPointsPerOperation: maxPointsPerOperation,
            pointsResetEnabled: pointsResetEnabled,
            semesterStartDate: new Date(semesterStartDate).toISOString(),
            className: className,
            author: author,
            copyright: copyright
        };

        await apiRequest('/api/config', {
            method: 'PUT',
            body: JSON.stringify(configData)
        });

        // 更新重置按钮状态
        const resetBtn = document.getElementById('resetPointsBtn');
        if (resetBtn) {
            resetBtn.disabled = !pointsResetEnabled;
        }

        // 更新最后更新时间
        const lastUpdateElement = document.getElementById('lastUpdateTime');
        if (lastUpdateElement) {
            lastUpdateElement.textContent = formatDate(new Date().toISOString());
        }

        // 更新系统信息显示
        const currentClassNameElement = document.getElementById('currentClassName');
        const currentAuthorElement = document.getElementById('currentAuthor');
        if (currentClassNameElement) {
            currentClassNameElement.textContent = className;
        }
        if (currentAuthorElement) {
            currentAuthorElement.textContent = author;
        }

        // 保存到本地存储，供其他页面使用
        storage.set('systemClassName', className);
        storage.set('systemAuthor', author);
        storage.set('systemCopyright', copyright);

        showMessage('系统配置保存成功', 'success');

    } catch (error) {
        console.error('保存系统配置失败:', error);
        showMessage('保存系统配置失败，请重试', 'error');
    }
}

// 重置配置表单
async function resetConfigForm() {
    if (confirm('确定要重置配置表单吗？这将恢复到当前保存的配置。')) {
        await loadSystemConfig();
        showMessage('配置表单已重置', 'info');
    }
}
//
备份管理功能

// 创建系统备份
async function createBackup() {
    try {
        showMessage('正在创建系统备份...', 'info');

        const response = await apiRequest('/api/backup/create', {
            method: 'POST'
        });

        showMessage('系统备份创建成功', 'success');

        // 如果备份管理器是打开的，刷新列表
        if (document.getElementById('backupManagerSection').style.display !== 'none') {
            refreshBackupList();
        }

    } catch (error) {
        console.error('创建备份失败:', error);
        showMessage('创建备份失败，请重试', 'error');
    }
}

// 显示备份管理器
async function showBackupManager() {
    const section = document.getElementById('backupManagerSection');
    const isVisible = section.style.display !== 'none';

    if (isVisible) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    await refreshBackupList();
    await loadDataStatistics();
}

// 刷新备份列表
async function refreshBackupList() {
    const container = document.getElementById('backupList');
    container.innerHTML = '<div class="loading">正在加载备份列表...</div>';

    try {
        const response = await apiRequest('/api/backup/list');
        const backups = response.backups || [];

        if (backups.length === 0) {
            container.innerHTML = '<div class="no-data">暂无备份文件</div>';
            return;
        }

        container.innerHTML = `
            <div class="backup-list-header">
                <span>文件名</span>
                <span>大小</span>
                <span>创建时间</span>
                <span>操作</span>
            </div>
            ${backups.map(backup => `
                <div class="backup-item">
                    <div class="backup-filename">${backup.filename}</div>
                    <div class="backup-size">${backup.sizeFormatted}</div>
                    <div class="backup-date">${formatDate(backup.created)}</div>
                    <div class="backup-actions">
                        <button onclick="downloadBackup('${backup.filename}')" class="download-btn">下载</button>
                        <button onclick="deleteBackup('${backup.filename}')" class="delete-btn">删除</button>
                    </div>
                </div>
            `).join('')}
        `;

    } catch (error) {
        console.error('加载备份列表失败:', error);
        container.innerHTML = '<div class="error">加载备份列表失败</div>';
    }
}

// 下载备份文件
function downloadBackup(filename) {
    const link = document.createElement('a');
    link.href = `/api/backup/download/${filename}`;
    link.download = filename;
    link.click();

    showMessage('备份文件下载开始', 'success');
}

// 删除备份文件
async function deleteBackup(filename) {
    if (!confirm(`确定要删除备份文件 "${filename}" 吗？`)) return;

    try {
        await apiRequest(`/api/backup/${filename}`, {
            method: 'DELETE'
        });

        showMessage('备份文件删除成功', 'success');
        refreshBackupList();

    } catch (error) {
        console.error('删除备份文件失败:', error);
        showMessage('删除备份文件失败，请重试', 'error');
    }
}

// 处理恢复文件选择
async function handleRestoreFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
        showMessage('请选择ZIP格式的备份文件', 'warning');
        return;
    }

    const confirmed = confirm(`确定要从备份文件 "${file.name}" 恢复系统吗？\n\n警告：此操作将覆盖当前所有数据，建议先创建当前数据的备份。`);
    if (!confirmed) return;

    try {
        showMessage('正在恢复系统，请稍候...', 'info');

        const formData = new FormData();
        formData.append('backupFile', file);

        const response = await fetch('/api/backup/restore', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showMessage('系统恢复成功，页面将自动刷新', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } else {
            throw new Error(result.message || '恢复失败');
        }

    } catch (error) {
        console.error('系统恢复失败:', error);
        showMessage('系统恢复失败：' + error.message, 'error');
    } finally {
        // 清空文件输入
        event.target.value = '';
    }
}

// 清理旧备份
async function cleanOldBackups() {
    const keepCount = prompt('请输入要保留的备份文件数量（默认10个）:', '10');
    if (keepCount === null) return;

    const count = parseInt(keepCount);
    if (isNaN(count) || count < 1) {
        showMessage('请输入有效的数量', 'warning');
        return;
    }

    try {
        const response = await apiRequest('/api/backup/cleanup', {
            method: 'POST',
            body: JSON.stringify({ keepCount: count })
        });

        showMessage(`清理完成，删除了${response.deletedCount}个旧备份文件`, 'success');
        refreshBackupList();

    } catch (error) {
        console.error('清理备份失败:', error);
        showMessage('清理备份失败，请重试', 'error');
    }
}

// 导出单个数据文件
async function exportSingleData(dataType) {
    try {
        showMessage(`正在导出${getDataTypeName(dataType)}...`, 'info');

        const response = await apiRequest(`/api/backup/export/${dataType}`, {
            method: 'POST'
        });

        // 下载导出的文件
        const link = document.createElement('a');
        link.href = `/api/backup/download/${response.filename}`;
        link.download = response.filename;
        link.click();

        showMessage(`${getDataTypeName(dataType)}导出成功`, 'success');

    } catch (error) {
        console.error('导出数据失败:', error);
        showMessage('导出数据失败，请重试', 'error');
    }
}

// 导入单个数据文件
async function importSingleData(dataType, event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
        showMessage('请选择JSON格式的数据文件', 'warning');
        return;
    }

    const confirmed = confirm(`确定要导入${getDataTypeName(dataType)}吗？\n\n警告：此操作将覆盖当前的${getDataTypeName(dataType)}，建议先创建备份。`);
    if (!confirmed) return;

    try {
        showMessage(`正在导入${getDataTypeName(dataType)}...`, 'info');

        const formData = new FormData();
        formData.append('dataFile', file);

        const response = await fetch(`/api/backup/import/${dataType}`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showMessage(`${getDataTypeName(dataType)}导入成功`, 'success');

            // 刷新相关数据
            await loadInitialData();

            // 根据当前标签页刷新显示
            const activeTab = document.querySelector('.tab-button.active');
            if (activeTab) {
                const tabName = activeTab.textContent.includes('积分') ? 'points' :
                    activeTab.textContent.includes('商品') ? 'products' :
                        activeTab.textContent.includes('预约') ? 'orders' : 'system';
                switchTab(tabName);
            }

        } else {
            throw new Error(result.message || '导入失败');
        }

    } catch (error) {
        console.error('导入数据失败:', error);
        showMessage('导入数据失败：' + error.message, 'error');
    } finally {
        // 清空文件输入
        event.target.value = '';
    }
}

// 加载数据统计信息
async function loadDataStatistics() {
    const container = document.getElementById('dataStatistics');
    const statsDiv = container.querySelector('.stats-loading') || container.querySelector('.stats-content');

    if (statsDiv) {
        statsDiv.innerHTML = '正在加载统计信息...';
    }

    try {
        const response = await apiRequest('/api/backup/statistics');
        const stats = response.statistics || {};

        const statsHtml = `
            <div class="stats-content">
                ${Object.entries(stats).map(([filename, stat]) => `
                    <div class="stat-item">
                        <div class="stat-name">${getDataTypeName(filename.replace('.json', ''))}</div>
                        <div class="stat-details">
                            记录数: ${stat.recordCount} | 
                            文件大小: ${formatFileSize(stat.size)} | 
                            最后修改: ${formatDate(stat.modified)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        if (statsDiv) {
            statsDiv.outerHTML = statsHtml;
        } else {
            container.innerHTML = `<h4>数据统计</h4>${statsHtml}`;
        }

    } catch (error) {
        console.error('加载数据统计失败:', error);
        if (statsDiv) {
            statsDiv.innerHTML = '加载统计信息失败';
        }
    }
}

// 获取数据类型中文名称
function getDataTypeName(dataType) {
    const typeNames = {
        'students': '学生数据',
        'points': '积分记录',
        'products': '商品数据',
        'orders': '预约订单',
        'config': '系统配置'
    };
    return typeNames[dataType] || dataType;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
// 显示需要登录的状态界面
function showLoginRequiredState() {
    const container = document.getElementById('teacherContent');
    if (container) {
        container.innerHTML = `
            <div class="login-required-state">
                <div class="login-required-message">
                    <div class="login-icon">🔐</div>
                    <h2>需要登录</h2>
                    <p>请登录教师账号以访问管理功能</p>
                    <div class="login-actions">
                        <button onclick="showTeacherLogin()" class="login-btn">立即登录</button>
                        <a href="/" class="back-home-btn">返回首页</a>
                    </div>
                </div>
            </div>
        `;
    }

    // 更新用户信息显示
    updateUserInfo();

    // 禁用所有操作按钮
    disableAllControls();

    // 自动显示登录弹窗
    setTimeout(() => {
        if (typeof showTeacherLogin === 'function') {
            showTeacherLogin();
        }
    }, 1000);
}

// 禁用所有控件
function disableAllControls() {
    // 禁用模式切换按钮
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.disabled = true;
        modeToggle.style.opacity = '0.5';
        modeToggle.style.cursor = 'not-allowed';
    }

    // 禁用所有标签按钮
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    });

    // 禁用所有表单元素
    document.querySelectorAll('input, button, select, textarea').forEach(element => {
        if (!element.classList.contains('login-btn') &&
            !element.classList.contains('login-again-btn') &&
            !element.id.includes('teacher')) {
            element.disabled = true;
            element.style.opacity = '0.5';
        }
    });
}

// 启用所有控件
function enableAllControls() {
    // 启用模式切换按钮
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.disabled = false;
        modeToggle.style.opacity = '1';
        modeToggle.style.cursor = 'pointer';
    }

    // 启用所有标签按钮
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });

    // 启用所有表单元素
    document.querySelectorAll('input, button, select, textarea').forEach(element => {
        element.disabled = false;
        element.style.opacity = '1';
    });
}

// ====== 学生管理 ======

function initStudentsManagement() {
    renderStudentsList();
}

function renderStudentsManagement() {
    return `
        <h2>学生管理</h2>
        <div class="product-management">
            <div class="product-form">
                <h3>添加/编辑学生</h3>
                <form id="studentForm" onsubmit="saveStudent(event)">
                    <input type="hidden" id="editStudentId">
                    
                    <div class="form-group">
                        <label>学号:</label>
                        <input type="text" id="studentId" required>
                    </div>
                    
                    <div class="form-group">
                        <label>姓名:</label>
                        <input type="text" id="studentName" required>
                    </div>
                    
                    <div class="form-group">
                        <label>班级:</label>
                        <input type="text" id="studentClass" required>
                    </div>
                    
                    <div class="form-group">
                        <label>初始积分:</label>
                        <input type="number" id="studentBalance" min="0" value="0" required>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" id="saveStudentBtn">保存学生</button>
                        <button type="button" onclick="resetStudentForm()">重置</button>
                    </div>
                </form>
            </div>
            
            <div class="product-list">
                <h3>学生列表</h3>
                <div id="studentsManagementList">
                    <!-- 学生列表将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;
}

function renderStudentsList() {
    const container = document.getElementById('studentsManagementList');
    if (!container) return;

    if (students.length === 0) {
        container.innerHTML = '<div class="no-data">暂无学生数据</div>';
        return;
    }

    container.innerHTML = students.map(student => `
        <div class="product-item">
            <div class="product-info">
                <div class="product-name">${student.name} (${student.id})</div>
                <div class="product-details">
                    班级: ${student.class || '-'} | 积分: ${student.balance || 0}分
                </div>
            </div>
            <div class="product-actions">
                <button class="edit-btn" onclick="editStudent('${student.id}')">编辑</button>
                <button class="delete-btn" onclick="deleteStudent('${student.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

async function saveStudent(event) {
    event.preventDefault();

    const editId = document.getElementById('editStudentId').value;
    const id = document.getElementById('studentId').value.trim();
    const name = document.getElementById('studentName').value.trim();
    const className = document.getElementById('studentClass').value.trim();
    const balance = parseInt(document.getElementById('studentBalance').value) || 0;

    if (!id || !name || !className || balance < 0) {
        showMessage('请填写有效的学生信息', 'warning');
        return;
    }

    try {
        const isEdit = !!editId;
        const endpoint = isEdit ? `/api/students/${id}` : '/api/students';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await apiRequest(endpoint, {
            method: method,
            body: JSON.stringify({
                id: id,
                name: name,
                class: className,
                balance: balance
            })
        });

        const studentData = response.data?.student || response.student;
        if (isEdit) {
            const index = students.findIndex(s => s.id === id);
            if (index !== -1) {
                // preserve balance if not explicitly updated via API return
                students[index] = { ...students[index], ...studentData };
            }
        } else {
            students.push(studentData);
        }

        renderStudentsList();
        resetStudentForm();
        if (document.getElementById('studentList')) renderStudentList();

        showMessage(`学生${isEdit ? '更新' : '添加'}成功`, 'success');

    } catch (error) {
        console.error('保存学生失败:', error);
        showMessage('保存学生失败: ' + (error.message || ''), 'error');
    }
}

function editStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('editStudentId').value = student.id;
    document.getElementById('studentId').value = student.id;
    document.getElementById('studentId').disabled = true;
    document.getElementById('studentName').value = student.name;
    document.getElementById('studentClass').value = student.class || '';
    document.getElementById('studentBalance').value = student.balance || 0;
    if (student.balance !== undefined) {
        document.getElementById('studentBalance').disabled = true; // prevent editing balance directly when editing student
    }

    document.getElementById('saveStudentBtn').textContent = '更新学生';
}

async function deleteStudent(studentId) {
    if (!confirm('确定要删除这个学生吗？所有积分记录也将被删除！')) return;

    try {
        await apiRequest(`/api/students/${studentId}`, {
            method: 'DELETE'
        });

        students = students.filter(s => s.id !== studentId);

        renderStudentsList();
        if (document.getElementById('studentList')) renderStudentList();

        showMessage('学生删除成功', 'success');

    } catch (error) {
        console.error('删除学生失败:', error);
        showMessage('删除学生失败，请重试', 'error');
    }
}

function resetStudentForm() {
    const form = document.getElementById('studentForm');
    if (form) form.reset();
    document.getElementById('editStudentId').value = '';
    document.getElementById('studentId').disabled = false;
    document.getElementById('studentBalance').disabled = false;
    document.getElementById('saveStudentBtn').textContent = '保存学生';
}
// ==================== 学期管理 ====================

function renderSemestersManagement() {
    return `
        <div class="management-section">
            <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2>学期管理</h2>
                <button class="action-btn add-btn" onclick="showSemesterModal()">
                    <span class="icon">＋</span> 新增学期
                </button>
            </div>
            
            <div class="semesters-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>学期名称</th>
                            <th>开始日期</th>
                            <th>结束日期</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="semestersListBody">
                        <tr><td colspan="5" style="text-align: center;">加载中...</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="archive-hints" style="margin-top:20px; padding:15px; background:#fff3cd; border:1px solid #ffeeba; border-radius:4px; color:#856404;">
                <h4>⚠️ 激活新学期说明</h4>
                <p>1. 点击“设为当前学期”将把该学期变成活动状态。</p>
                <p>2. 此操作将会<b>结算并封存</b>目前所有学生的总积分到旧学期档案中。</p>
                <p>3. 此操作将会<b>清零</b>所有学生的现有积分。</p>
                <p>4. 随后，系统会根据刚刚的结界排名，为所有学生自动发放新学期的初始阶梯积分（前10名+40分，11-20名+30分，21-30名+20分，30名以后+10分）。</p>
                <p>注意：此操作不可逆，请在真实的新老学期交接时使用！</p>
            </div>
        </div>

        <!-- 学期表单弹窗 -->
        <div id="semesterModal" class="modal" style="display: none;">
            <div class="modal-content" style="max-width: 500px;">
                <h3 id="semesterModalTitle">新增学期</h3>
                <form id="semesterForm" onsubmit="handleSemesterSubmit(event)">
                    <input type="hidden" id="semesterId">
                    <div class="form-group">
                        <label for="semesterName">学期名称:</label>
                        <input type="text" id="semesterName" required placeholder="例如：2026年春季学期">
                    </div>
                    <div class="form-group">
                        <label for="semesterStartDate">开始日期:</label>
                        <input type="date" id="semesterStartDate" required>
                    </div>
                    <div class="form-group">
                        <label for="semesterEndDate">结束日期:</label>
                        <input type="date" id="semesterEndDate" required>
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" class="submit-btn">保存</button>
                        <button type="button" class="cancel-btn" onclick="hideSemesterModal()">取消</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function initSemesterPanel() {
    await loadSemestersList();
}

async function loadSemestersList() {
    const listBody = document.getElementById('semestersListBody');
    if (!listBody) return;
    
    try {
        const response = await apiRequest('/api/semesters');
        const semesters = response.data || [];
        
        if (semesters.length === 0) {
            listBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">暂无学期数据</td></tr>';
            return;
        }

        listBody.innerHTML = semesters.map(sem => {
            const startDate = new Date(sem.startDate).toLocaleDateString();
            const endDate = new Date(sem.endDate).toLocaleDateString();
            const statusHtml = sem.isCurrent 
                ? `<span class="status-badge active" style="background-color: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px;">当前学期</span>`
                : `<span class="status-badge inactive" style="background-color: #e2e3e5; color: #383d41; padding: 4px 8px; border-radius: 4px;">未激活</span>`;
                
            const actionHtml = sem.isCurrent
                ? `<button class="action-btn edit" onclick="editSemester('${sem.id}')">编辑</button>`
                : `
                   <button class="action-btn edit" onclick="editSemester('${sem.id}')">编辑</button>
                   <button class="action-btn text-warning" style="background-color: #ffc107; color: #000; margin-left: 5px;" onclick="activateSemesterPrompt('${sem.id}', '${sem.name}')">设为当前学期</button>
                  `;

            return `
                <tr>
                    <td>${sem.name}</td>
                    <td>${startDate}</td>
                    <td>${endDate}</td>
                    <td>${statusHtml}</td>
                    <td>${actionHtml}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('获取学期列表失败:', error);
        listBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">加载失败，请重试</td></tr>';
    }
}

function showSemesterModal() {
    document.getElementById('semesterModalTitle').textContent = '新增学期';
    document.getElementById('semesterForm').reset();
    document.getElementById('semesterId').value = '';
    
    // 设置默认日期
    const now = new Date();
    document.getElementById('semesterStartDate').value = now.toISOString().split('T')[0];
    
    const end = new Date();
    end.setMonth(end.getMonth() + 5);
    document.getElementById('semesterEndDate').value = end.toISOString().split('T')[0];
    
    document.getElementById('semesterModal').style.display = 'flex';
}

function hideSemesterModal() {
    document.getElementById('semesterModal').style.display = 'none';
}

async function editSemester(id) {
    try {
        const response = await apiRequest('/api/semesters');
        const semesters = response.data || [];
        const sem = semesters.find(s => s.id === id);
        if (!sem) return;

        document.getElementById('semesterModalTitle').textContent = '编辑学期';
        document.getElementById('semesterId').value = sem.id;
        document.getElementById('semesterName').value = sem.name;
        document.getElementById('semesterStartDate').value = sem.startDate.split('T')[0];
        document.getElementById('semesterEndDate').value = sem.endDate.split('T')[0];
        
        document.getElementById('semesterModal').style.display = 'flex';
    } catch (e) {
        showMessage('无法获取学期信息', 'error');
    }
}

async function handleSemesterSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById('semesterId').value;
    const name = document.getElementById('semesterName').value.trim();
    const startDate = document.getElementById('semesterStartDate').value;
    const endDate = document.getElementById('semesterEndDate').value;
    
    if (!name || !startDate || !endDate) {
        showMessage('请填写完整信息', 'warning');
        return;
    }

    try {
        const payload = { 
            name, 
            startDate: new Date(startDate).toISOString(), 
            endDate: new Date(endDate).toISOString() 
        };
        
        if (id) {
            await apiRequest(`/api/semesters/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
            showMessage('学期更新成功', 'success');
        } else {
            await apiRequest('/api/semesters', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showMessage('学期创建成功', 'success');
        }
        
        hideSemesterModal();
        loadSemestersList();
    } catch (error) {
        showMessage('操作失败: ' + error.message, 'error');
    }
}

async function activateSemesterPrompt(id, name) {
    const confirmMsg = `⚠️ 危险操作警告：\n您正在尝试将【${name}】设为当前学期。\n此操作会结算并封存这学期所有学生的现有积分，然后统一重置发放入学奖励！\n\n如果您确定这是新老学期交接时刻，请点击“确定”继续。不可逆转！`;

    showConfirmModal(confirmMsg, async () => {
        try {
            const response = await apiRequest(`/api/semesters/${id}/activate`, {
                method: 'POST'
            });
            showMessage(response.message || '学期激活成功并已完成数据结算！', 'success');
            loadSemestersList();
            
            // 刷新学生和积分相关数据缓存
            if(typeof renderStudentList === 'function') renderStudentList();
            
            // 强制刷新整个页面以重新加载图表等缓存
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            showMessage('激活失败: ' + error.message, 'error');
        }
    });
}

// ==================== 自助修改密码功能 ====================

function showChangePasswordModal() {
    document.getElementById('changePasswordForm').reset();
    document.getElementById('changePasswordModal').style.display = 'flex';
}

function hideChangePasswordModal() {
    document.getElementById('changePasswordModal').style.display = 'none';
}

async function handleChangePasswordSubmit(event) {
    event.preventDefault();
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        showMessage('两次填写的密码不一致', 'error');
        return;
    }

    if (newPassword.length < 3) {
        showMessage('新密码长度不能少于3位', 'warning');
        return;
    }

    try {
        await apiRequest('/api/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ oldPassword, newPassword })
        });
        
        showMessage('密码修改成功，请重新登录', 'success');
        hideChangePasswordModal();
        
        // 修改密码后需要重新登录
        setTimeout(() => {
            handleLogout();
        }, 1500);
    } catch (error) {
        showMessage('修改密码失败: ' + error.message, 'error');
    }
}

// ==================== 教师管理系统功能 ====================

function renderTeachersManagement() {
    return `
        <div class="management-header">
            <h3>教师与管理员账号列表</h3>
            <button class="add-btn" onclick="showTeacherModal()">新增教师</button>
        </div>
        <div class="teacher-list-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>工号/账号</th>
                        <th>姓名</th>
                        <th>角色</th>
                        <th>部门</th>
                        <th>状态</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="teachersTableBody">
                    <tr><td colspan="6" class="loading-cell">加载中...</td></tr>
                </tbody>
            </table>
        </div>
    `;
}

async function loadTeachersList() {
    const tbody = document.getElementById('teachersTableBody');
    if (!tbody) return;

    try {
        const response = await apiRequest('/api/teachers');
        const teachers = response.data.teachers || [];
        
        const currentUser = storage.get('currentTeacher') || {};

        if (teachers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-cell">暂无教师数据</td></tr>';
            return;
        }

        tbody.innerHTML = teachers.map(t => {
            const isDirector = t.role === 'director';
            const roleName = isDirector ? '班主任' : (t.role === 'admin' ? '管理员' : '普通教师');
            
            // 当前登录人是 admin 则可以设置班主任，但不能自己设自己，也不能操作 admin
            let setDirectorBtn = '';
            if (currentUser.role === 'admin' && t.role === 'teacher') {
                setDirectorBtn = `<button class="action-btn small highlight" onclick="setAsDirector('${t.id}', '${t.name}')">设为班主任</button>`;
            } else if (currentUser.role === 'admin' && t.role === 'director') {
                setDirectorBtn = `<button class="action-btn small danger" onclick="revokeDirector('${t.id}', '${t.name}')">撤销班主任</button>`;
            }

            // Admin 账号不可在界面上编辑、重置密码或删除
            let actionButtons = '';
            if (t.role !== 'admin') {
                actionButtons = `
                    <button class="action-btn small" onclick="editTeacher('${t.id}')">编辑</button>
                    <button class="action-btn small warning" onclick="resetTeacherPasswordPrompt('${t.id}', '${t.name}')">重置密码</button>
                    ${setDirectorBtn}
                    <button class="action-btn small danger" onclick="deleteTeacher('${t.id}', '${t.name}')">删除</button>
                `;
            }

            return `
            <tr>
                <td>${t.id}</td>
                <td>${t.name}</td>
                <td><span class="role-badge ${t.role}">${roleName}</span></td>
                <td>${t.department || '-'}</td>
                <td>${t.isActive ? '<span class="status-active">正常</span>' : '<span class="status-inactive">停用</span>'}</td>
                <td>
                    ${actionButtons}
                </td>
            </tr>
        `}).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="error-cell">加载异常: ${error.message}</td></tr>`;
    }
}

function showTeacherModal(id = null) {
    document.getElementById('teacherForm').reset();
    document.getElementById('teacherOriginalId').value = '';
    
    // 如果是新增，可以配置密码，如果编辑，则密码不在这个表单里处理(统一通过重置)
    const passwordGroup = document.getElementById('teacherPasswordGroup');
    const idInput = document.getElementById('formTeacherId');

    if (!id) {
        document.getElementById('teacherModalTitle').textContent = '新增教师';
        passwordGroup.style.display = 'block';
        idInput.disabled = false;
        document.getElementById('teacherModal').style.display = 'flex';
    }
}

function hideTeacherModal() {
    document.getElementById('teacherModal').style.display = 'none';
}

async function editTeacher(id) {
    try {
        const response = await apiRequest('/api/teachers');
        const teachers = response.data.teachers || [];
        const t = teachers.find(item => item.id === id);
        
        if (!t) return;

        document.getElementById('teacherModalTitle').textContent = '编辑教师信息';
        document.getElementById('teacherOriginalId').value = t.id;
        
        const idInput = document.getElementById('formTeacherId');
        idInput.value = t.id;
        idInput.disabled = true; // 编辑时不允许改ID

        document.getElementById('formTeacherName').value = t.name;
        document.getElementById('formTeacherDepartment').value = t.department || '';
        
        // 隐藏密码输入框，通过“重置密码”功能单独改
        document.getElementById('teacherPasswordGroup').style.display = 'none';
        
        document.getElementById('teacherModal').style.display = 'flex';
    } catch (error) {
        showMessage('获取信息失败', 'error');
    }
}

async function handleTeacherSubmit(event) {
    event.preventDefault();
    
    const originalId = document.getElementById('teacherOriginalId').value;
    const isEdit = !!originalId;
    
    const id = document.getElementById('formTeacherId').value.trim();
    const name = document.getElementById('formTeacherName').value.trim();
    const department = document.getElementById('formTeacherDepartment').value.trim();
    const password = document.getElementById('formTeacherPassword').value.trim();

    if (!id || !name) {
        showMessage('学工号和姓名不能为空', 'warning');
        return;
    }

    try {
        let payload = { id, name, department };
        
        if (!isEdit) {
            payload.password = password || 'teacher123';
            payload.role = 'teacher'; // 默认新建都是 teacher
            
            await apiRequest('/api/teachers', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showMessage('新增成功', 'success');
        } else {
            // Edit
            await apiRequest(`/api/teachers/${originalId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, department })
            });
            showMessage('编辑成功', 'success');
        }
        
        hideTeacherModal();
        loadTeachersList();
    } catch (e) {
        showMessage('操作失败: ' + e.message, 'error');
    }
}

async function deleteTeacher(id, name) {
    showConfirmModal(`确定要删除教师【${name}】吗？删除后此账号不可登录！`, async () => {
        try {
            await apiRequest(`/api/teachers/${id}`, { method: 'DELETE' });
            showMessage('删除成功', 'success');
            loadTeachersList();
        } catch (e) {
            showMessage(e.message, 'error');
        }
    });
}

async function resetTeacherPasswordPrompt(id, name) {
    showConfirmModal(`确定要强行将教师【${name}】的密码重置为 teacher123 吗？`, async () => {
        try {
            await apiRequest(`/api/teachers/${id}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({ newPassword: 'teacher123' })
            });
            showMessage('密码已成功重置为 teacher123', 'success');
        } catch (e) {
            showMessage(e.message, 'error');
        }
    });
}

async function setAsDirector(id, name) {
    showConfirmModal(`确定将教师【${name}】设为班主任吗？`, async () => {
        try {
            await apiRequest(`/api/teachers/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ role: 'director' })
            });
            showMessage(`【${name}】已成功被设为班主任！`, 'success');
            loadTeachersList();
        } catch(e) {
            showMessage(e.message, 'error');
        }
    });
}

async function revokeDirector(id, name) {
    showConfirmModal(`确定撤销【${name}】的班主任职务吗？撤销后将成为普通教师。`, async () => {
        try {
            await apiRequest(`/api/teachers/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ role: 'teacher' })
            });
            showMessage(`【${name}】已被撤销班主任职务！`, 'success');
            loadTeachersList();
        } catch(e) {
            showMessage(e.message, 'error');
        }
    });
}

// 修复数据一致性
async function repairDataConsistency() {
    showConfirmModal('该操作将合并重复的学期并根据流水自动对等学生余额。确定要执行数据一致性修复吗？', async () => {
        try {
            showMessage('正在执行数据修复，请稍候...', 'info');
            const response = await apiRequest('/api/config/fix-data', {
                method: 'POST'
            });

            if (response.success) {
                const results = response.data;
                const msg = `修复成功！合并学期: ${results.semestersMerged}, 补全记录: ${results.recordsAdded}`;
                showMessage(msg, 'success');
                // 重新加载数据
                await loadInitialData();
            } else {
                showMessage(response.message || '修复失败', 'error');
            }
        } catch (error) {
            console.error('修复数据失败:', error);
            showMessage('修复请求失败: ' + (error.message || '未知错误'), 'error');
        }
    });
}
