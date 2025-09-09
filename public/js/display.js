// 大屏展示页面逻辑

let currentMode = 'normal';
let refreshInterval;
let isLoading = false;
let sseEnabled = false;

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    initDisplay();
    setupSSEHandlers();
    setupDataCacheHandlers();
    setupEventListeners();
    startAutoRefresh();
    
    // 添加键盘快捷键支持
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

// 设置事件监听器
function setupEventListeners() {
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', toggleDisplayMode);
    }
}

// 设置SSE事件处理器
function setupSSEHandlers() {
    if (!window.sseClient) {
        console.warn('SSE客户端未加载');
        return;
    }

    sseEnabled = true;

    // 连接状态变化
    window.sseClient.on('connected', (data) => {
        console.log('SSE连接已建立:', data);
        showMessage('实时连接已建立', 'success');
    });

    // 积分更新事件
    window.sseClient.on('points_updated', (data) => {
        console.log('收到积分更新:', data);
        handlePointsUpdate(data);
    });

    // 排行榜更新事件
    window.sseClient.on('rankings_updated', (data) => {
        console.log('收到排行榜更新:', data);
        handleRankingsUpdate(data);
    });

    // 模式变更事件
    window.sseClient.on('mode_changed', (data) => {
        console.log('收到模式变更:', data);
        handleModeChange(data);
    });

    // 配置更新事件
    window.sseClient.on('config_updated', (data) => {
        console.log('收到配置更新:', data);
        handleConfigUpdate(data);
    });

    // 数据重置事件
    window.sseClient.on('data_reset', (data) => {
        console.log('收到数据重置:', data);
        handleDataReset(data);
    });

    // 通知事件
    window.sseClient.on('notification', (data) => {
        showMessage(data.message, data.level, data.duration);
    });

    // 服务器错误事件
    window.sseClient.on('server_error', (data) => {
        showMessage(data.message || '服务器错误', 'error');
    });

    // 最大重连次数达到
    window.sseClient.on('max_reconnect_attempts_reached', () => {
        showMessage('无法连接到服务器，请刷新页面重试', 'error');
        sseEnabled = false;
    });
}

// 初始化显示
async function initDisplay() {
    try {
        await loadSystemMode();
        await loadDisplayContent();
    } catch (error) {
        console.error('初始化失败:', error);
        document.getElementById('displayContent').innerHTML = 
            '<div class="error">系统初始化失败，请刷新页面重试</div>';
    }
}

// 加载系统模式
async function loadSystemMode() {
    try {
        const response = await apiRequest('/api/config/mode');
        let serverMode = response.data?.mode || response.mode || 'normal';
        
        // 如果服务器返回上课模式，检查教师登录状态
        if (serverMode === 'class') {
            const isTeacherLoggedIn = await checkTeacherLoginStatus();
            if (!isTeacherLoggedIn) {
                // 教师未登录或登录过期，自动切换到平时模式
                console.log('教师未登录或登录过期，自动切换到平时模式');
                await switchToNormalMode();
                serverMode = 'normal';
            }
        }
        
        currentMode = serverMode;
        console.log('加载的系统模式:', currentMode);
        updateModeDisplay();
        storage.set('systemMode', currentMode);
    } catch (error) {
        console.error('获取系统模式失败:', error);
        // 使用本地存储的模式或默认模式
        currentMode = storage.get('systemMode') || 'normal';
        updateModeDisplay();
        showMessage('无法连接服务器，使用离线模式', 'warning');
    }
}

// 更新模式指示器（向后兼容）
function updateModeIndicator() {
    updateModeDisplay();
}

// 加载显示内容
async function loadDisplayContent() {
    if (isLoading) return; // 防止重复加载
    
    const contentEl = document.getElementById('displayContent');
    isLoading = true;
    
    try {
        // 显示加载状态
        contentEl.innerHTML = '<div class="loading">正在加载数据...</div>';
        
        if (currentMode === 'class') {
            await loadClassModeContent(contentEl);
        } else {
            await loadNormalModeContent(contentEl);
        }
    } catch (error) {
        console.error('加载内容失败:', error);
        contentEl.innerHTML = `
            <div class="error">
                <h3>加载失败</h3>
                <p>${error.message || '无法加载数据，请检查网络连接'}</p>
                <button onclick="loadDisplayContent()" class="retry-btn">重试</button>
            </div>
        `;
    } finally {
        isLoading = false;
    }
}

// 加载平时模式内容（排行榜）
async function loadNormalModeContent(container) {
    try {
        // 显示加载状态
        showLoadingState(container, '正在加载排行榜数据...');
        
        // 使用数据缓存服务获取排行榜数据
        const response = await window.dataCacheService.getData(
            'rankings_all',
            () => apiRequest('/api/points/rankings/all'),
            {
                defaultTTL: 60000, // 1分钟缓存
                maxRetries: 3,
                enableOfflineMode: true
            }
        );
        
        // 检查是否使用了离线数据
        const isOfflineData = window.dataCacheService.getErrorState('rankings_all') !== null;
        const currentTime = new Date().toLocaleString('zh-CN');
        
        container.innerHTML = `
            <div class="rankings-header">
                <h2>积分排行榜${isOfflineData ? ' (离线数据)' : ''}</h2>
                <div class="last-update">最后更新: ${currentTime}</div>
                ${isOfflineData ? '<div class="offline-indicator">网络连接异常，显示缓存数据</div>' : ''}
            </div>
            <div class="rankings-container">
                <div class="ranking-section">
                    <h2>总积分排行</h2>
                    <ul class="ranking-list" id="totalRanking"></ul>
                </div>
                <div class="ranking-section">
                    <h2>日榜排行</h2>
                    <ul class="ranking-list" id="dailyRanking"></ul>
                </div>
                <div class="ranking-section">
                    <h2>周榜排行</h2>
                    <ul class="ranking-list" id="weeklyRanking"></ul>
                </div>
            </div>
        `;
        
        // 渲染排行榜数据
        const data = response.data || response;
        renderRanking('totalRanking', data.total || []);
        renderRanking('dailyRanking', data.daily || []);
        renderRanking('weeklyRanking', data.weekly || []);
        
        // 启动自动刷新（如果SSE不可用）
        if (!sseEnabled || !window.sseClient.isConnectedToServer()) {
            window.dataCacheService.startAutoRefresh(
                'rankings_all',
                () => apiRequest('/api/points/rankings/all'),
                {
                    refreshInterval: 30000, // 30秒刷新一次
                    enableOfflineMode: true
                }
            );
        }
        
    } catch (error) {
        console.error('加载排行榜失败:', error);
        showErrorState(container, '加载排行榜失败', error.message);
    }
}

// 加载上课模式内容（学生操作界面）
async function loadClassModeContent(container) {
    try {
        // 显示加载状态
        showLoadingState(container, '正在加载学生数据...');
        
        // 使用数据缓存服务获取学生数据
        const response = await window.dataCacheService.getData(
            'students_list',
            () => apiRequest('/api/students'),
            {
                defaultTTL: 300000, // 5分钟缓存
                maxRetries: 3,
                enableOfflineMode: true
            }
        );
        
        // 检查是否使用了离线数据
        const isOfflineData = window.dataCacheService.getErrorState('students_list') !== null;
        
        container.innerHTML = `
            <div class="class-mode">
                <div class="class-mode-header">
                    <h2>学生积分操作${isOfflineData ? ' (离线模式)' : ''}</h2>
                    <div class="operation-tips">
                        <span>${isOfflineData ? '网络连接异常，显示缓存数据' : '提示: 点击按钮为学生加分或减分'}</span>
                        <button onclick="refreshClassMode()" class="refresh-btn">${isOfflineData ? '重试连接' : '刷新'}</button>
                    </div>
                </div>
                <div class="student-grid" id="studentGrid"></div>
            </div>
        `;
        
        const students = response.students || response.data?.students || [];
        renderStudentGrid(students);
        
        // 启动自动刷新学生数据
        window.dataCacheService.startAutoRefresh(
            'students_list',
            () => apiRequest('/api/students'),
            {
                refreshInterval: 60000, // 1分钟刷新一次
                enableOfflineMode: true
            }
        );
        
    } catch (error) {
        console.error('加载学生数据失败:', error);
        showErrorState(container, '加载学生数据失败', error.message);
    }
}

// 渲染排行榜
function renderRanking(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = '<li class="no-data">暂无数据</li>';
        return;
    }
    
    // 确保数据按积分排序
    const sortedData = [...data].sort((a, b) => {
        const pointsA = a.points || a.balance || 0;
        const pointsB = b.points || b.balance || 0;
        return pointsB - pointsA;
    });
    
    container.innerHTML = sortedData.map((item, index) => {
        const rank = index + 1;
        const isTop3 = rank <= 3;
        const points = item.points || item.balance || 0;
        
        // 添加排名变化指示器（如果有的话）
        const changeIndicator = item.change ? 
            `<span class="rank-change ${item.change > 0 ? 'up' : 'down'}">
                ${item.change > 0 ? '↑' : '↓'}${Math.abs(item.change)}
            </span>` : '';
        
        return `
            <li class="ranking-item ${isTop3 ? 'top-3' : ''}" data-student-id="${item.id || item.studentId}">
                <div class="student-info">
                    <span class="rank-number">${rank}</span>
                    <span class="student-name">${item.name || item.studentName}(${item.id || item.studentId})</span>
                    ${changeIndicator}
                </div>
                <span class="points ${points < 0 ? 'negative' : ''}">${points}分</span>
            </li>
        `;
    }).join('');
    
    // 添加动画效果
    setTimeout(() => {
        container.querySelectorAll('.ranking-item').forEach((item, index) => {
            item.style.animationDelay = `${index * 0.1}s`;
            item.classList.add('fade-in');
        });
    }, 100);
}

// 渲染学生网格（上课模式）
function renderStudentGrid(students) {
    const container = document.getElementById('studentGrid');
    if (!container) return;
    
    if (!students || students.length === 0) {
        container.innerHTML = '<div class="no-students">暂无学生数据</div>';
        return;
    }
    
    // 按学号排序
    const sortedStudents = [...students].sort((a, b) => {
        // 确保学号按数字顺序排序
        const idA = String(a.id || '').padStart(10, '0');
        const idB = String(b.id || '').padStart(10, '0');
        return idA.localeCompare(idB);
    });
    
    container.innerHTML = sortedStudents.map(student => {
        const balance = student.balance || 0;
        const balanceClass = balance < 0 ? 'negative' : balance > 50 ? 'high' : '';
        
        return `
            <div class="student-card" data-student-id="${student.id}">
                <h3>${student.name}</h3>
                <div class="student-id">${student.id}</div>
                <div class="balance ${balanceClass}">${balance}分</div>
                <div class="point-controls">
                    <div class="control-group">
                        <button onclick="adjustPoints('${student.id}', 1)" class="add-btn small">+1</button>
                        <button onclick="adjustPoints('${student.id}', 5)" class="add-btn">+5</button>
                        <button onclick="adjustPoints('${student.id}', 10)" class="add-btn">+10</button>
                    </div>
                    <div class="control-group">
                        <button onclick="adjustPoints('${student.id}', -1)" class="subtract-btn small">-1</button>
                        <button onclick="adjustPoints('${student.id}', -5)" class="subtract-btn">-5</button>
                        <button onclick="adjustPoints('${student.id}', -10)" class="subtract-btn">-10</button>
                    </div>
                </div>
                <div class="last-operation" id="lastOp_${student.id}"></div>
            </div>
        `;
    }).join('');
    
    // 添加动画效果
    setTimeout(() => {
        container.querySelectorAll('.student-card').forEach((card, index) => {
            card.style.animationDelay = `${index * 0.05}s`;
            card.classList.add('slide-in');
        });
    }, 100);
}

// 调整积分（上课模式专用）
async function adjustPoints(studentId, points) {
    // 防止重复点击
    const buttons = document.querySelectorAll(`[data-student-id="${studentId}"] button`);
    buttons.forEach(btn => btn.disabled = true);
    
    try {
        const endpoint = points > 0 ? '/api/points/add' : '/api/points/subtract';
        const response = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({
                studentId: studentId,
                points: Math.abs(points),
                reason: points > 0 ? '课堂加分' : '课堂减分'
            })
        });
        
        // 调试：打印完整响应
        console.log('积分操作响应:', response);
        
        // 尝试从响应中获取newBalance
        let newBalance = response.data?.newBalance || response.newBalance;
        console.log('从响应获取的newBalance:', newBalance);
        
        // 如果无法从响应获取newBalance，手动计算
        if (newBalance === undefined || newBalance === null) {
            console.log('无法从响应获取newBalance，手动计算');
            const studentCard = document.querySelector(`[data-student-id="${studentId}"]`);
            if (studentCard) {
                const balanceEl = studentCard.querySelector('.balance');
                if (balanceEl) {
                    const currentBalanceText = balanceEl.textContent;
                    const currentBalance = parseInt(currentBalanceText.replace('分', '')) || 0;
                    newBalance = currentBalance + points;
                    console.log('手动计算的newBalance:', { currentBalance, points, newBalance });
                }
            }
        }
        
        if (newBalance !== undefined && newBalance !== null) {
            updateStudentBalance(studentId, newBalance);
        } else {
            console.error('无法获取或计算newBalance，重新加载学生数据');
            // 如果仍然无法获取newBalance，重新加载学生数据
            setTimeout(() => {
                if (currentMode === 'class') {
                    loadDisplayContent();
                }
            }, 1000);
        }
        
        // 显示操作记录
        const lastOpEl = document.getElementById(`lastOp_${studentId}`);
        if (lastOpEl) {
            lastOpEl.innerHTML = `
                <span class="${points > 0 ? 'add' : 'subtract'}">
                    ${points > 0 ? '+' : ''}${points}分
                </span>
            `;
            setTimeout(() => {
                lastOpEl.innerHTML = '';
            }, 3000);
        }
        
        showMessage(`${points > 0 ? '加分' : '减分'}操作成功`, 'success');
        
    } catch (error) {
        console.error('积分操作失败:', error);
        showMessage('积分操作失败，请重试', 'error');
    } finally {
        // 重新启用按钮
        setTimeout(() => {
            buttons.forEach(btn => btn.disabled = false);
        }, 1000);
    }
}

// 更新学生积分显示
function updateStudentBalance(studentId, newBalance) {
    const studentCard = document.querySelector(`[data-student-id="${studentId}"]`);
    if (studentCard) {
        const balanceEl = studentCard.querySelector('.balance');
        if (balanceEl && newBalance !== undefined && newBalance !== null) {
            balanceEl.textContent = `${newBalance}分`;
            balanceEl.className = `balance ${newBalance < 0 ? 'negative' : newBalance > 50 ? 'high' : ''}`;
            
            // 添加闪烁效果
            balanceEl.classList.add('updated');
            setTimeout(() => {
                balanceEl.classList.remove('updated');
            }, 1000);
        } else {
            console.error('无法更新学生积分显示:', { studentId, newBalance, balanceEl });
        }
    } else {
        console.error('找不到学生卡片:', studentId);
    }
}

// 刷新上课模式
async function refreshClassMode() {
    if (currentMode === 'class') {
        await loadDisplayContent();
    }
}

// 切换显示模式
async function toggleDisplayMode() {
    const newMode = currentMode === 'class' ? 'normal' : 'class';
    
    try {
        // 检查是否有教师权限
        const token = storage.get('teacherToken');
        if (!token) {
            // 如果没有token，显示登录弹窗
            if (typeof showTeacherLogin === 'function') {
                showTeacherLogin();
                return;
            } else {
                showMessage('需要教师权限才能切换模式', 'warning');
                return;
            }
        }
        
        // 调用API切换模式
        const response = await fetch('/api/config/mode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ mode: newMode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentMode = newMode;
            updateModeDisplay();
            await loadDisplayContent();
            showMessage(`已切换到${newMode === 'class' ? '上课' : '平时'}模式`, 'success');
        } else {
            throw new Error(data.message || '模式切换失败');
        }
        
    } catch (error) {
        console.error('切换模式失败:', error);
        showMessage('切换模式失败: ' + error.message, 'error');
    }
}

// 更新模式显示
function updateModeDisplay() {
    const modeIndicator = document.getElementById('modeIndicator');
    const modeToggle = document.getElementById('modeToggle');
    
    if (modeIndicator) {
        modeIndicator.textContent = currentMode === 'class' ? '上课模式' : '平时模式';
        modeIndicator.className = `mode-indicator ${currentMode}-mode`;
    }
    
    if (modeToggle) {
        modeToggle.textContent = currentMode === 'class' ? '切换到平时模式' : '切换到上课模式';
        modeToggle.className = `mode-toggle-btn ${currentMode}-mode`;
    }
}

// 开始自动刷新
function startAutoRefresh() {
    // 如果启用了SSE，减少自动刷新频率
    const interval = sseEnabled ? 60000 : 30000; // SSE启用时60秒，否则30秒
    
    refreshInterval = setInterval(async () => {
        try {
            // 如果SSE连接正常，只刷新模式，数据通过SSE更新
            if (sseEnabled && window.sseClient && window.sseClient.isConnectedToServer()) {
                await loadSystemMode();
                // 数据通过SSE实时更新，不需要重新加载
            } else {
                // SSE不可用时，完整刷新
                await loadSystemMode();
                await loadDisplayContent();
            }
            
            // 定期检查教师登录状态（每5分钟检查一次）
            if (currentMode === 'class' && Math.random() < 0.1) { // 约10%的概率检查，相当于每10次刷新检查一次
                const isTeacherLoggedIn = await checkTeacherLoginStatus();
                if (!isTeacherLoggedIn) {
                    console.log('定期检查发现教师登录已过期，切换到平时模式');
                    await switchToNormalMode();
                    currentMode = 'normal';
                    updateModeDisplay();
                    await loadDisplayContent();
                }
            }
        } catch (error) {
            console.error('自动刷新失败:', error);
        }
    }, interval);
}

// 停止自动刷新
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// 键盘快捷键处理
function handleKeyboardShortcuts(event) {
    // F5 或 Ctrl+R: 刷新数据
    if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
        event.preventDefault();
        loadDisplayContent();
        return;
    }
    
    // 空格键: 切换自动刷新
    if (event.code === 'Space' && !event.target.matches('input, textarea')) {
        event.preventDefault();
        toggleAutoRefresh();
        return;
    }
    
    // Esc键: 全屏切换
    if (event.key === 'Escape') {
        toggleFullscreen();
        return;
    }
}

// 切换自动刷新
function toggleAutoRefresh() {
    if (refreshInterval) {
        stopAutoRefresh();
        showMessage('自动刷新已暂停', 'info');
    } else {
        startAutoRefresh();
        showMessage('自动刷新已启用', 'success');
    }
}

// 全屏切换
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log('无法进入全屏模式:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// 页面可见性变化处理
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 页面隐藏时暂停自动刷新
        if (refreshInterval) {
            stopAutoRefresh();
            storage.set('wasAutoRefreshing', true);
        }
    } else {
        // 页面显示时恢复自动刷新
        if (storage.get('wasAutoRefreshing')) {
            startAutoRefresh();
            storage.remove('wasAutoRefreshing');
        }
        // 立即刷新一次数据
        loadDisplayContent();
    }
});

// SSE事件处理函数

/**
 * 处理积分更新事件
 */
function handlePointsUpdate(data) {
    // 如果是上课模式，更新学生卡片的积分显示
    if (currentMode === 'class') {
        updateStudentBalance(data.studentId, data.newBalance);
    }
    
    // 显示积分变化通知
    const pointsText = data.points > 0 ? `+${data.points}` : `${data.points}`;
    showMessage(`学生积分更新: ${pointsText}分`, 'info', 2000);
}

/**
 * 处理排行榜更新事件
 */
function handleRankingsUpdate(data) {
    // 如果是平时模式，更新排行榜显示
    if (currentMode === 'normal') {
        try {
            if (data.rankings.total) {
                renderRanking('totalRanking', data.rankings.total);
            }
            if (data.rankings.daily) {
                renderRanking('dailyRanking', data.rankings.daily);
            }
            if (data.rankings.weekly) {
                renderRanking('weeklyRanking', data.rankings.weekly);
            }
            
            // 更新最后更新时间
            const lastUpdateEl = document.querySelector('.last-update');
            if (lastUpdateEl) {
                lastUpdateEl.textContent = `最后更新: ${new Date().toLocaleString('zh-CN')}`;
            }
            
            // 保存数据到本地存储
            storage.set('rankingsData', data.rankings);
            
        } catch (error) {
            console.error('更新排行榜显示失败:', error);
        }
    }
}

/**
 * 处理模式变更事件
 */
function handleModeChange(data) {
    const oldMode = currentMode;
    currentMode = data.mode;
    
    // 更新模式指示器
    updateModeIndicator();
    
    // 如果模式发生变化，重新加载内容
    if (oldMode !== currentMode) {
        loadDisplayContent();
        showMessage(`系统已切换到${data.modeText}`, 'info');
    }
}

/**
 * 处理配置更新事件
 */
function handleConfigUpdate(data) {
    // 如果自动刷新间隔发生变化，重新设置定时器
    if (data.config && data.config.autoRefreshInterval) {
        stopAutoRefresh();
        startAutoRefresh();
    }
    
    showMessage('系统配置已更新', 'info');
}

/**
 * 处理数据重置事件
 */
function handleDataReset(data) {
    // 重新加载所有数据
    loadDisplayContent();
    showMessage(data.message || '数据已重置', 'warning');
}

// 显示加载状态
function showLoadingState(container, message = '正在加载数据...') {
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <div class="loading-message">${message}</div>
        </div>
    `;
}

// 显示错误状态
function showErrorState(container, title, message) {
    container.innerHTML = `
        <div class="error-state">
            <div class="error-icon">⚠️</div>
            <h3>${title}</h3>
            <p>${message}</p>
            <div class="error-actions">
                <button onclick="loadDisplayContent()" class="retry-btn">重试</button>
                <button onclick="useOfflineData()" class="offline-btn">使用离线数据</button>
            </div>
        </div>
    `;
}

// 使用离线数据
function useOfflineData() {
    if (currentMode === 'normal') {
        const cachedRankings = window.dataCacheService.getCachedData('rankings_all') || 
                              window.dataCacheService.restoreFromLocalStorage('rankings_all');
        if (cachedRankings) {
            const container = document.getElementById('displayContent');
            loadNormalModeContentFromCache(container, cachedRankings);
        } else {
            showMessage('没有可用的离线数据', 'warning');
        }
    } else {
        const cachedStudents = window.dataCacheService.getCachedData('students_list') || 
                              window.dataCacheService.restoreFromLocalStorage('students_list');
        if (cachedStudents) {
            const container = document.getElementById('displayContent');
            loadClassModeContentFromCache(container, cachedStudents);
        } else {
            showMessage('没有可用的离线数据', 'warning');
        }
    }
}

// 从缓存加载平时模式内容
function loadNormalModeContentFromCache(container, data) {
    const currentTime = new Date().toLocaleString('zh-CN');
    
    container.innerHTML = `
        <div class="rankings-header">
            <h2>积分排行榜 (离线数据)</h2>
            <div class="last-update">显示缓存数据 - ${currentTime}</div>
            <div class="offline-indicator">网络连接异常，显示本地缓存数据</div>
        </div>
        <div class="rankings-container">
            <div class="ranking-section">
                <h2>总积分排行</h2>
                <ul class="ranking-list" id="totalRanking"></ul>
            </div>
            <div class="ranking-section">
                <h2>日榜排行</h2>
                <ul class="ranking-list" id="dailyRanking"></ul>
            </div>
            <div class="ranking-section">
                <h2>周榜排行</h2>
                <ul class="ranking-list" id="weeklyRanking"></ul>
            </div>
        </div>
    `;
    
    const rankingsData = data.data || data;
    renderRanking('totalRanking', rankingsData.total || []);
    renderRanking('dailyRanking', rankingsData.daily || []);
    renderRanking('weeklyRanking', rankingsData.weekly || []);
}

// 从缓存加载上课模式内容
function loadClassModeContentFromCache(container, data) {
    container.innerHTML = `
        <div class="class-mode">
            <div class="class-mode-header">
                <h2>学生积分操作 (离线模式)</h2>
                <div class="operation-tips">
                    <span>网络连接异常，显示缓存数据，积分操作可能无法同步</span>
                    <button onclick="refreshClassMode()" class="refresh-btn">重试连接</button>
                </div>
            </div>
            <div class="student-grid" id="studentGrid"></div>
        </div>
    `;
    
    const students = data.students || data.data?.students || [];
    renderStudentGrid(students);
}

// 设置数据缓存服务事件监听器
function setupDataCacheHandlers() {
    if (!window.dataCacheService) {
        return;
    }

    // 数据更新事件
    window.dataCacheService.on('dataUpdated', (event) => {
        console.log('数据缓存更新:', event.key);
        
        // 根据数据类型更新界面
        if (event.key === 'rankings_all' && currentMode === 'normal') {
            handleRankingsUpdate({ rankings: event.data.data || event.data });
        } else if (event.key === 'students_list' && currentMode === 'class') {
            const students = event.data.students || event.data.data?.students || [];
            renderStudentGrid(students);
        }
    });

    // 加载状态变化事件
    window.dataCacheService.on('loadingStateChanged', (event) => {
        const indicator = document.querySelector('.loading-indicator');
        if (indicator) {
            indicator.style.display = event.isLoading ? 'block' : 'none';
        }
    });

    // 错误状态变化事件
    window.dataCacheService.on('errorStateChanged', (event) => {
        if (event.error) {
            console.error(`数据获取错误 (${event.key}):`, event.error);
        }
    });

    // 离线数据使用事件
    window.dataCacheService.on('offlineDataUsed', (event) => {
        showMessage('网络连接异常，使用离线数据', 'warning');
    });

    // 网络重连事件
    window.dataCacheService.on('networkReconnected', () => {
        showMessage('网络连接已恢复', 'success');
        // 重新加载数据
        loadDisplayContent();
    });

    // 网络断开事件
    window.dataCacheService.on('networkDisconnected', () => {
        showMessage('网络连接断开，将使用离线数据', 'warning');
    });
}

// 检查教师登录状态
async function checkTeacherLoginStatus() {
    try {
        const token = storage.get('teacherToken');
        if (!token) {
            return false;
        }
        
        // 验证token是否有效
        const response = await fetch('/api/auth/verify', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.success && data.data?.user?.userType === 'teacher';
        } else {
            // token无效，清除本地存储
            storage.remove('teacherToken');
            return false;
        }
    } catch (error) {
        console.error('检查教师登录状态失败:', error);
        return false;
    }
}

// 自动切换到平时模式
async function switchToNormalMode() {
    try {
        const response = await fetch('/api/config/mode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mode: 'normal' })
        });
        
        if (response.ok) {
            console.log('已自动切换到平时模式');
            showMessage('检测到教师未登录，已自动切换到平时模式', 'info');
        } else {
            console.error('自动切换到平时模式失败');
        }
    } catch (error) {
        console.error('自动切换到平时模式失败:', error);
    }
}

// 页面卸载时清理
window.addEventListener('beforeunload', function() {
    stopAutoRefresh();
    if (window.dataCacheService) {
        window.dataCacheService.cleanup();
    }
});