// 教师管理页面逻辑

let currentMode = 'normal';
let selectedStudent = null;
let students = [];
let products = [];
let orders = [];

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
    const confirmed = confirm('确定要退出登录吗？');
    if (confirmed) {
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
    }
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
        const [studentsResponse, productsResponse, ordersResponse] = await Promise.all([
            apiRequest('/api/students').catch(() => ({ students: [] })),
            apiRequest('/api/products').catch(() => ({ products: [] })),
            apiRequest('/api/orders/pending').catch(() => ({ orders: [] }))
        ]);

        students = studentsResponse.data?.students || studentsResponse.students || [];
        products = productsResponse.data?.products || productsResponse.products || [];
        orders = ordersResponse.data?.orders || ordersResponse.orders || [];

        // 保存到本地存储
        storage.set('teacherData', { students, products, orders });

    } catch (error) {
        console.error('加载数据失败:', error);
        // 尝试从本地存储恢复数据
        const cachedData = storage.get('teacherData');
        if (cachedData) {
            students = cachedData.students || [];
            products = cachedData.products || [];
            orders = cachedData.orders || [];
        }
    }
}

// 渲染教师内容
function renderTeacherContent() {
    const container = document.getElementById('teacherContent');

    container.innerHTML = `
        <div class="management-tabs">
            <button class="tab-button active" onclick="switchTab('points')">积分管理</button>
            <button class="tab-button" onclick="switchTab('students')">学生管理</button>
            <button class="tab-button" onclick="switchTab('teachers')">教师管理</button>
            <button class="tab-button" onclick="switchTab('products')">商品管理</button>
            <button class="tab-button" onclick="switchTab('orders')">预约管理</button>
            <button class="tab-button" onclick="switchTab('rewards')">常用奖惩项</button>
            <button class="tab-button" onclick="switchTab('system')">班级设置</button>
        </div>
        
        <div id="pointsTab" class="tab-content active">
            ${renderPointsManagement()}
        </div>
        
        <div id="studentsTab" class="tab-content">
            ${renderStudentsManagement()}
        </div>
        
        <div id="teachersTab" class="tab-content">
            ${renderTeachersManagement()}
        </div>
        
        <div id="productsTab" class="tab-content">
            ${renderProductsManagement()}
        </div>
        
        <div id="ordersTab" class="tab-content">
            ${renderOrdersManagement()}
        </div>
        
        <div id="rewardsTab" class="tab-content">
            ${renderRewardsManagement()}
        </div>
        
        <div id="systemTab" class="tab-content">
            ${renderSystemSettings()}
        </div>
    `;

    // 初始化积分管理
    initPointsManagement();
}

// 切换标签页
function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');

    // 根据标签页执行特定初始化
    switch (tabName) {
        case 'points':
            initPointsManagement();
            break;
        case 'students':
            initStudentsManagement();
            break;
        case 'teachers':
            initTeachersManagement();
            break;
        case 'products':
            initProductsManagement();
            break;
        case 'orders':
            initOrdersManagement();
            break;
        case 'rewards':
            initRewardsManagement();
            break;
        case 'system':
            initSystemSettings();
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
                        <input type="text" id="className" placeholder="请输入班级名称" value="初一钱班">
                        <small>显示在系统标题和页面中的班级名称</small>
                    </div>
                    
                    <div class="config-group">
                        <label for="author">作者:</label>
                        <input type="text" id="author" placeholder="请输入作者名称" value="茗雨">
                        <small>系统作者信息</small>
                    </div>
                    
                    <div class="config-group">
                        <label for="copyright">版权信息:</label>
                        <input type="text" id="copyright" placeholder="请输入版权信息" value="© 2025 初一钱班班级积分管理系统 | 作者：茗雨">
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
                    <p>班级名称: <span id="currentClassName">初一钱班</span></p>
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
    event.currentTarget.classList.add('selected');

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
        selectedStudent.balance = response.newBalance;
        const studentIndex = students.findIndex(s => s.id === selectedStudent.id);
        if (studentIndex !== -1) {
            students[studentIndex].balance = response.newBalance;
        }

        // 刷新显示
        renderStudentList();
        selectStudent(selectedStudent.id);
        loadRecentOperations();

        showMessage(`${isAdd ? '加分' : '减分'}操作成功`, 'success');

        // 清空原因输入框
        document.getElementById('reasonInput').value = '';

    } catch (error) {
        console.error('积分操作失败:', error);
        showMessage('积分操作失败，请重试', 'error');
    }
}

// 加载最近操作
async function loadRecentOperations() {
    try {
        // 这里应该调用获取最近操作的API
        // 暂时显示占位内容
        const container = document.getElementById('operationsList');
        container.innerHTML = '<div class="no-data">暂无最近操作记录</div>';
    } catch (error) {
        console.error('加载操作记录失败:', error);
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
        document.getElementById('className').value = config.className || '初一钱班';
        document.getElementById('author').value = config.author || '茗雨';
        document.getElementById('copyright').value = config.copyright || '© 2025 初一钱班班级积分管理系统 | 作者：茗雨';

        // 设置学期开始日期
        if (config.semesterStartDate) {
            const date = new Date(config.semesterStartDate);
            document.getElementById('semesterStartDate').value = date.toISOString().split('T')[0];
        }

        // 更新系统信息显示
        const currentClassNameElement = document.getElementById('currentClassName');
        const currentAuthorElement = document.getElementById('currentAuthor');
        if (currentClassNameElement) {
            currentClassNameElement.textContent = config.className || '初一钱班';
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
//
显示需要登录的状态界面
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
}// ===
================= 学生管理模块 ====================

// 渲染学生管理
function renderStudentsManagement() {
    return `
        <h2>学生管理</h2>
        <div class="students-management">
            <div class="student-form">
                <h3>添加/编辑学生</h3>
                <form id="studentForm" onsubmit="saveStudent(event)">
                    <input type="hidden" id="studentId">
                    
                    <div class="form-group">
                        <label>学生姓名:</label>
                        <input type="text" id="studentName" required>
                    </div>
                    
                    <div class="form-group">
                        <label>学号:</label>
                        <input type="text" id="studentNumber" required>
                    </div>
                    
                    <div class="form-group">
                        <label>初始积分:</label>
                        <input type="number" id="studentInitialPoints" value="0" min="0">
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" id="saveStudentBtn">保存学生</button>
                        <button type="button" onclick="resetStudentForm()">重置</button>
                    </div>
                </form>
            </div>
            
            <div class="students-list">
                <h3>学生列表</h3>
                <div class="students-search">
                    <input type="text" id="studentsSearchInput" placeholder="搜索学生姓名或学号..." 
                           onkeyup="filterStudentsList(this.value)">
                </div>
                <div id="studentsListContainer">
                    <!-- 学生列表将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;
}

// 初始化学生管理
function initStudentsManagement() {
    renderStudentsListContainer();
}

// 渲染学生列表容器
function renderStudentsListContainer(filteredStudents = null) {
    const container = document.getElementById('studentsListContainer');
    const studentsToShow = filteredStudents || students;

    if (studentsToShow.length === 0) {
        container.innerHTML = '<div class="no-data">暂无学生数据</div>';
        return;
    }

    // 按学号排序
    const sortedStudents = [...studentsToShow].sort((a, b) => {
        const idA = String(a.id || '').padStart(10, '0');
        const idB = String(b.id || '').padStart(10, '0');
        return idA.localeCompare(idB);
    });

    container.innerHTML = sortedStudents.map(student => `
        <div class="student-item-card">
            <div class="student-info">
                <div class="student-name">${student.name}</div>
                <div class="student-details">
                    学号: ${student.id} | 积分: ${student.balance || 0}分
                </div>
            </div>
            <div class="student-actions">
                <button class="edit-btn" onclick="editStudent('${student.id}')">编辑</button>
                <button class="delete-btn" onclick="deleteStudent('${student.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 筛选学生列表
function filterStudentsList(searchTerm) {
    if (!searchTerm.trim()) {
        renderStudentsListContainer();
        return;
    }

    const filtered = students.filter(student =>
        student.name.includes(searchTerm) ||
        student.id.includes(searchTerm)
    );

    renderStudentsListContainer(filtered);
}

// 保存学生
async function saveStudent(event) {
    event.preventDefault();

    const studentId = document.getElementById('studentId').value;
    const name = document.getElementById('studentName').value.trim();
    const number = document.getElementById('studentNumber').value.trim();
    const initialPoints = parseInt(document.getElementById('studentInitialPoints').value) || 0;

    if (!name || !number) {
        showMessage('请填写学生姓名和学号', 'warning');
        return;
    }

    try {
        const isEdit = !!studentId;
        const endpoint = isEdit ? `/api/students/${studentId}` : '/api/students';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await apiRequest(endpoint, {
            method: method,
            body: JSON.stringify({
                name: name,
                id: number,
                balance: initialPoints
            })
        });

        // 更新本地数据
        const studentData = response.data?.student || response.student;
        if (isEdit) {
            const index = students.findIndex(s => s.id === studentId);
            if (index !== -1) {
                students[index] = studentData;
            }
        } else {
            students.push(studentData);
        }

        // 刷新显示
        renderStudentsListContainer();
        resetStudentForm();

        showMessage(`学生${isEdit ? '更新' : '添加'}成功`, 'success');

    } catch (error) {
        console.error('保存学生失败:', error);
        showMessage('保存学生失败，请重试', 'error');
    }
}

// 编辑学生
function editStudent(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('studentId').value = student.id;
    document.getElementById('studentName').value = student.name;
    document.getElementById('studentNumber').value = student.id;
    document.getElementById('studentInitialPoints').value = student.balance || 0;

    document.getElementById('saveStudentBtn').textContent = '更新学生';
}

// 删除学生
async function deleteStudent(studentId) {
    if (!confirm('确定要删除这个学生吗？此操作不可恢复！')) return;

    try {
        await apiRequest(`/api/students/${studentId}`, {
            method: 'DELETE'
        });

        // 从本地数据中移除
        students = students.filter(s => s.id !== studentId);

        // 刷新显示
        renderStudentsListContainer();

        showMessage('学生删除成功', 'success');

    } catch (error) {
        console.error('删除学生失败:', error);
        showMessage('删除学生失败，请重试', 'error');
    }
}

// 重置学生表单
function resetStudentForm() {
    document.getElementById('studentForm').reset();
    document.getElementById('studentId').value = '';
    document.getElementById('saveStudentBtn').textContent = '保存学生';
}

// ==================== 教师管理模块 ====================

// 渲染教师管理
function renderTeachersManagement() {
    return `
        <h2>教师管理</h2>
        <div class="teachers-management">
            <div class="teacher-form">
                <h3>添加/编辑教师</h3>
                <form id="teacherForm" onsubmit="saveTeacher(event)">
                    <input type="hidden" id="teacherId">
                    
                    <div class="form-group">
                        <label>教师姓名:</label>
                        <input type="text" id="teacherName" required>
                    </div>
                    
                    <div class="form-group">
                        <label>教师工号:</label>
                        <input type="text" id="teacherNumber" required>
                    </div>
                    
                    <div class="form-group">
                        <label>教师角色:</label>
                        <select id="teacherRole" required>
                            <option value="">请选择角色</option>
                            <option value="admin">班主任</option>
                            <option value="teacher">任课教师</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>登录密码:</label>
                        <input type="password" id="teacherPassword" placeholder="留空则不修改密码">
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" id="saveTeacherBtn">保存教师</button>
                        <button type="button" onclick="resetTeacherForm()">重置</button>
                    </div>
                </form>
            </div>
            
            <div class="teachers-list">
                <h3>教师列表</h3>
                <div id="teachersListContainer">
                    <!-- 教师列表将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;
}

// 初始化教师管理
function initTeachersManagement() {
    loadTeachers();
}

// 加载教师列表
async function loadTeachers() {
    try {
        const response = await apiRequest('/api/auth/teachers');
        const teachers = response.data?.teachers || response.teachers || [];
        renderTeachersListContainer(teachers);
    } catch (error) {
        console.error('加载教师列表失败:', error);
        document.getElementById('teachersListContainer').innerHTML = 
            '<div class="error">加载教师列表失败</div>';
    }
}

// 渲染教师列表容器
function renderTeachersListContainer(teachers) {
    const container = document.getElementById('teachersListContainer');

    if (!teachers || teachers.length === 0) {
        container.innerHTML = '<div class="no-data">暂无教师数据</div>';
        return;
    }

    container.innerHTML = teachers.map(teacher => `
        <div class="teacher-item-card">
            <div class="teacher-info">
                <div class="teacher-name">${teacher.name}</div>
                <div class="teacher-details">
                    工号: ${teacher.id} | 角色: ${teacher.role === 'admin' ? '班主任' : '任课教师'}
                </div>
            </div>
            <div class="teacher-actions">
                <button class="edit-btn" onclick="editTeacher('${teacher.id}')">编辑</button>
                <button class="delete-btn" onclick="deleteTeacher('${teacher.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 保存教师
async function saveTeacher(event) {
    event.preventDefault();

    const teacherId = document.getElementById('teacherId').value;
    const name = document.getElementById('teacherName').value.trim();
    const number = document.getElementById('teacherNumber').value.trim();
    const role = document.getElementById('teacherRole').value;
    const password = document.getElementById('teacherPassword').value;

    if (!name || !number || !role) {
        showMessage('请填写完整的教师信息', 'warning');
        return;
    }

    try {
        const isEdit = !!teacherId;
        const endpoint = isEdit ? `/api/auth/teachers/${teacherId}` : '/api/auth/teachers';
        const method = isEdit ? 'PUT' : 'POST';

        const requestData = {
            name: name,
            id: number,
            role: role
        };

        if (password) {
            requestData.password = password;
        }

        await apiRequest(endpoint, {
            method: method,
            body: JSON.stringify(requestData)
        });

        // 刷新教师列表
        loadTeachers();
        resetTeacherForm();

        showMessage(`教师${isEdit ? '更新' : '添加'}成功`, 'success');

    } catch (error) {
        console.error('保存教师失败:', error);
        showMessage('保存教师失败，请重试', 'error');
    }
}

// 编辑教师
async function editTeacher(teacherId) {
    try {
        const response = await apiRequest(`/api/auth/teachers/${teacherId}`);
        const teacher = response.data?.teacher || response.teacher;
        
        if (teacher) {
            document.getElementById('teacherId').value = teacher.id;
            document.getElementById('teacherName').value = teacher.name;
            document.getElementById('teacherNumber').value = teacher.id;
            document.getElementById('teacherRole').value = teacher.role;
            document.getElementById('teacherPassword').value = '';

            document.getElementById('saveTeacherBtn').textContent = '更新教师';
        }
    } catch (error) {
        console.error('获取教师信息失败:', error);
        showMessage('获取教师信息失败', 'error');
    }
}

// 删除教师
async function deleteTeacher(teacherId) {
    if (!confirm('确定要删除这个教师吗？此操作不可恢复！')) return;

    try {
        await apiRequest(`/api/auth/teachers/${teacherId}`, {
            method: 'DELETE'
        });

        // 刷新教师列表
        loadTeachers();

        showMessage('教师删除成功', 'success');

    } catch (error) {
        console.error('删除教师失败:', error);
        showMessage('删除教师失败，请重试', 'error');
    }
}

// 重置教师表单
function resetTeacherForm() {
    document.getElementById('teacherForm').reset();
    document.getElementById('teacherId').value = '';
    document.getElementById('saveTeacherBtn').textContent = '保存教师';
}

// ==================== 常用奖惩项管理模块 ====================

// 渲染常用奖惩项管理
function renderRewardsManagement() {
    return `
        <h2>常用奖惩项管理</h2>
        <div class="rewards-management">
            <div class="reward-form">
                <h3>添加/编辑奖惩项</h3>
                <form id="rewardForm" onsubmit="saveReward(event)">
                    <input type="hidden" id="rewardId">
                    
                    <div class="form-group">
                        <label>奖惩项名称:</label>
                        <input type="text" id="rewardName" required placeholder="如：课堂发言、迟到等">
                    </div>
                    
                    <div class="form-group">
                        <label>积分数值:</label>
                        <input type="number" id="rewardPoints" required placeholder="正数为奖励，负数为惩罚">
                    </div>
                    
                    <div class="form-group">
                        <label>类型:</label>
                        <select id="rewardType" required>
                            <option value="">请选择类型</option>
                            <option value="reward">奖励</option>
                            <option value="penalty">惩罚</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>排序权重:</label>
                        <input type="number" id="rewardSortOrder" value="0" min="0" placeholder="数字越小越靠前">
                    </div>
                    
                    <div class="form-actions">
                        <button type="submit" id="saveRewardBtn">保存奖惩项</button>
                        <button type="button" onclick="resetRewardForm()">重置</button>
                    </div>
                </form>
            </div>
            
            <div class="rewards-list">
                <h3>奖惩项列表</h3>
                <div class="rewards-filter">
                    <select id="rewardsFilter" onchange="filterRewards()">
                        <option value="">全部类型</option>
                        <option value="reward">奖励</option>
                        <option value="penalty">惩罚</option>
                    </select>
                </div>
                <div id="rewardsListContainer">
                    <!-- 奖惩项列表将在这里动态生成 -->
                </div>
            </div>
        </div>
    `;
}

// 初始化常用奖惩项管理
function initRewardsManagement() {
    loadRewards();
}

// 加载奖惩项列表
async function loadRewards() {
    try {
        const response = await apiRequest('/api/reward-penalty');
        const rewards = response.data?.items || response.items || [];
        renderRewardsListContainer(rewards);
    } catch (error) {
        console.error('加载奖惩项列表失败:', error);
        document.getElementById('rewardsListContainer').innerHTML = 
            '<div class="error">加载奖惩项列表失败</div>';
    }
}

// 渲染奖惩项列表容器
function renderRewardsListContainer(rewards, filter = '') {
    const container = document.getElementById('rewardsListContainer');

    if (!rewards || rewards.length === 0) {
        container.innerHTML = '<div class="no-data">暂无奖惩项数据</div>';
        return;
    }

    // 筛选数据
    let filteredRewards = rewards;
    if (filter) {
        filteredRewards = rewards.filter(reward => reward.type === filter);
    }

    // 按排序权重和类型排序
    const sortedRewards = [...filteredRewards].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'reward' ? -1 : 1;
        }
        return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    container.innerHTML = sortedRewards.map(reward => `
        <div class="reward-item-card ${reward.type}">
            <div class="reward-info">
                <div class="reward-name">${reward.name}</div>
                <div class="reward-details">
                    积分: ${reward.points > 0 ? '+' : ''}${reward.points}分 | 
                    类型: ${reward.type === 'reward' ? '奖励' : '惩罚'} | 
                    排序: ${reward.sortOrder || 0}
                </div>
            </div>
            <div class="reward-actions">
                <button class="edit-btn" onclick="editReward('${reward.id}')">编辑</button>
                <button class="delete-btn" onclick="deleteReward('${reward.id}')">删除</button>
                <button class="toggle-btn" onclick="toggleReward('${reward.id}', ${!reward.isActive})">
                    ${reward.isActive ? '禁用' : '启用'}
                </button>
            </div>
        </div>
    `).join('');
}

// 筛选奖惩项
function filterRewards() {
    const filter = document.getElementById('rewardsFilter').value;
    // 重新加载并筛选
    loadRewards().then(() => {
        if (filter) {
            const container = document.getElementById('rewardsListContainer');
            const rewards = Array.from(container.children);
            rewards.forEach(reward => {
                const isMatch = reward.classList.contains(filter);
                reward.style.display = isMatch ? 'flex' : 'none';
            });
        }
    });
}

// 保存奖惩项
async function saveReward(event) {
    event.preventDefault();

    const rewardId = document.getElementById('rewardId').value;
    const name = document.getElementById('rewardName').value.trim();
    const points = parseInt(document.getElementById('rewardPoints').value);
    const type = document.getElementById('rewardType').value;
    const sortOrder = parseInt(document.getElementById('rewardSortOrder').value) || 0;

    if (!name || !points || !type) {
        showMessage('请填写完整的奖惩项信息', 'warning');
        return;
    }

    // 验证积分和类型的一致性
    if (type === 'reward' && points <= 0) {
        showMessage('奖励类型的积分应该为正数', 'warning');
        return;
    }
    if (type === 'penalty' && points >= 0) {
        showMessage('惩罚类型的积分应该为负数', 'warning');
        return;
    }

    try {
        const isEdit = !!rewardId;
        const endpoint = isEdit ? `/api/reward-penalty/${rewardId}` : '/api/reward-penalty';
        const method = isEdit ? 'PUT' : 'POST';

        await apiRequest(endpoint, {
            method: method,
            body: JSON.stringify({
                name: name,
                points: points,
                type: type,
                sortOrder: sortOrder,
                isActive: true
            })
        });

        // 刷新奖惩项列表
        loadRewards();
        resetRewardForm();

        showMessage(`奖惩项${isEdit ? '更新' : '添加'}成功`, 'success');

    } catch (error) {
        console.error('保存奖惩项失败:', error);
        showMessage('保存奖惩项失败，请重试', 'error');
    }
}

// 编辑奖惩项
async function editReward(rewardId) {
    try {
        const response = await apiRequest(`/api/reward-penalty/${rewardId}`);
        const reward = response.data?.item || response.item;
        
        if (reward) {
            document.getElementById('rewardId').value = reward.id;
            document.getElementById('rewardName').value = reward.name;
            document.getElementById('rewardPoints').value = reward.points;
            document.getElementById('rewardType').value = reward.type;
            document.getElementById('rewardSortOrder').value = reward.sortOrder || 0;

            document.getElementById('saveRewardBtn').textContent = '更新奖惩项';
        }
    } catch (error) {
        console.error('获取奖惩项信息失败:', error);
        showMessage('获取奖惩项信息失败', 'error');
    }
}

// 删除奖惩项
async function deleteReward(rewardId) {
    if (!confirm('确定要删除这个奖惩项吗？')) return;

    try {
        await apiRequest(`/api/reward-penalty/${rewardId}`, {
            method: 'DELETE'
        });

        // 刷新奖惩项列表
        loadRewards();

        showMessage('奖惩项删除成功', 'success');

    } catch (error) {
        console.error('删除奖惩项失败:', error);
        showMessage('删除奖惩项失败，请重试', 'error');
    }
}

// 切换奖惩项状态
async function toggleReward(rewardId, isActive) {
    try {
        await apiRequest(`/api/reward-penalty/${rewardId}`, {
            method: 'PUT',
            body: JSON.stringify({
                isActive: isActive
            })
        });

        // 刷新奖惩项列表
        loadRewards();

        showMessage(`奖惩项${isActive ? '启用' : '禁用'}成功`, 'success');

    } catch (error) {
        console.error('切换奖惩项状态失败:', error);
        showMessage('操作失败，请重试', 'error');
    }
}

// 重置奖惩项表单
function resetRewardForm() {
    document.getElementById('rewardForm').reset();
    document.getElementById('rewardId').value = '';
    document.getElementById('saveRewardBtn').textContent = '保存奖惩项';
}