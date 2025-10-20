// 大屏展示页面逻辑

let currentMode = 'normal';
let currentTeacher = null;
let sessionStartTime = null;
let autoSwitchTimer = null;
let selectedStudent = null;
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
    startFooterClock();
    
    // 添加键盘快捷键支持
    document.addEventListener('keydown', handleKeyboardShortcuts);
});

// 设置事件监听器
function setupEventListeners() {
    const modeToggle = document.getElementById('modeToggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', handleModeToggle);
    }

    // 学生查询输入框回车事件
    const studentInput = document.getElementById('studentNumberInput');
    if (studentInput) {
        studentInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                queryStudent();
            }
        });
    }

    // 点击模态框外部关闭
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeAllModals();
        }
    });
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
        const response = await apiRequest('/api/system/state');
        const data = response.data || response;
        
        currentMode = data.mode || 'normal';
        currentTeacher = data.currentTeacher || null;
        
        if (data.sessionStartTime) {
            sessionStartTime = new Date(data.sessionStartTime);
            if (currentMode === 'class') {
                startAutoSwitchTimer();
            }
        }
        
        console.log('加载的系统状态:', { currentMode, currentTeacher, sessionStartTime });
        updateModeDisplay();
        storage.set('systemMode', currentMode);
        
    } catch (error) {
        console.error('获取系统状态失败:', error);
        // 使用本地存储的模式或默认模式
        currentMode = storage.get('systemMode') || 'normal';
        currentTeacher = null;
        sessionStartTime = null;
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
        showLoadingState(container, '正在加载学生数据和奖惩项...');
        
        // 并行获取学生数据和奖惩项数据
        const [studentsResponse, rewardPenaltyResponse] = await Promise.all([
            window.dataCacheService.getData(
                'students_list',
                () => apiRequest('/api/students'),
                {
                    defaultTTL: 300000, // 5分钟缓存
                    maxRetries: 3,
                    enableOfflineMode: true
                }
            ),
            window.dataCacheService.getData(
                'reward_penalty_items',
                () => apiRequest('/api/reward-penalty'),
                {
                    defaultTTL: 600000, // 10分钟缓存
                    maxRetries: 3,
                    enableOfflineMode: true
                }
            )
        ]);
        
        // 检查是否使用了离线数据
        const isOfflineData = window.dataCacheService.getErrorState('students_list') !== null ||
                             window.dataCacheService.getErrorState('reward_penalty_items') !== null;
        
        container.innerHTML = `
            <div class="class-mode">
                <div class="class-mode-header">
                    <h2>学生积分操作${isOfflineData ? ' (离线模式)' : ''}</h2>
                    <div class="operation-tips">
                        <span>${isOfflineData ? '网络连接异常，显示缓存数据' : '提示: 先选择学生，再点击奖惩项按钮'}</span>
                        <button onclick="refreshClassMode()" class="refresh-btn">${isOfflineData ? '重试连接' : '刷新'}</button>
                    </div>
                </div>
                
                <div class="operation-hint" id="operationHint">
                    请先选择一个学生，然后点击相应的奖惩项按钮
                </div>
                
                <div class="student-grid" id="studentGrid"></div>
                
                <div class="reward-penalty-section">
                    <h3>常用奖惩项</h3>
                    <div class="reward-penalty-grid" id="rewardPenaltyGrid"></div>
                </div>
            </div>
        `;
        
        const students = studentsResponse.students || studentsResponse.data?.students || [];
        const rewardPenaltyItems = rewardPenaltyResponse.items || rewardPenaltyResponse.data?.items || [];
        
        renderStudentGrid(students);
        renderRewardPenaltyGrid(rewardPenaltyItems);
        
        // 启动自动刷新
        if (!sseEnabled || !window.sseClient.isConnectedToServer()) {
            window.dataCacheService.startAutoRefresh(
                'students_list',
                () => apiRequest('/api/students'),
                {
                    refreshInterval: 60000, // 1分钟刷新一次
                    enableOfflineMode: true
                }
            );
        }
        
    } catch (error) {
        console.error('加载上课模式数据失败:', error);
        showErrorState(container, '加载上课模式数据失败', error.message);
    }
}

// 渲染排行榜
function renderRanking(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // 增强数据验证
    if (!data || !Array.isArray(data) || data.length === 0) {
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
                    <span class="student-name">${item.student.name }(${item.student.classStudentNumber || item.student.studentNumber})</span>
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
            <div class="student-card" data-student-id="${student.id}" onclick="selectStudent('${student.id}')">
                <h3>${student.name}</h3>
                <div class="student-id">${student.id}</div>
                <div class="balance ${balanceClass}">${balance}分</div>
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

// 渲染奖惩项网格
function renderRewardPenaltyGrid(items) {
    const container = document.getElementById('rewardPenaltyGrid');
    if (!container) return;
    
    if (!items || items.length === 0) {
        container.innerHTML = '<div class="no-data">暂无奖惩项数据</div>';
        return;
    }
    
    // 按排序字段和类型排序
    const sortedItems = [...items]
        .filter(item => item.isActive !== false)
        .sort((a, b) => {
            // 先按类型排序（奖励在前）
            if (a.type !== b.type) {
                return a.type === 'reward' ? -1 : 1;
            }
            // 再按排序字段排序
            return (a.sortOrder || 0) - (b.sortOrder || 0);
        });
    
    container.innerHTML = sortedItems.map(item => {
        const typeClass = item.type === 'reward' ? 'reward' : 'penalty';
        const pointsText = item.points > 0 ? `+${item.points}` : `${item.points}`;
        
        return `
            <button class="reward-penalty-btn ${typeClass}" 
                    onclick="applyRewardPenalty('${item.id}', ${item.points}, '${item.name}')"
                    data-item-id="${item.id}">
                <div class="btn-name">${item.name}</div>
                <div class="btn-points">${pointsText}分</div>
            </button>
        `;
    }).join('');
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

// 旧版本的切换显示模式函数（保留兼容性）
async function toggleDisplayMode() {
    await handleModeToggle();
}

// 旧版本的更新模式显示函数已被新版本替换

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

// 处理模式切换按钮点击
async function handleModeToggle() {
    if (currentMode === 'normal') {
        // 切换到上课模式，需要选择教师
        showTeacherSelect();
    } else {
        // 切换到平时模式
        await switchToNormalMode();
    }
}

// 显示教师选择弹窗
async function showTeacherSelect() {
    try {
        const response = await apiRequest('/api/display/teachers');
        const teachers = response.data || response.teachers || [];
        
        const teacherList = document.getElementById('teacherList');
        if (teachers.length === 0) {
            teacherList.innerHTML = '<div class="no-data">暂无教师数据</div>';
        } else {
            teacherList.innerHTML = teachers.map(teacher => `
                <div class="teacher-item" onclick="selectTeacher('${teacher.id}', '${teacher.name}')">
                    <h4>${teacher.name}</h4>
                    <div class="teacher-role">${teacher.role === 'admin' ? '班主任' : '任课教师'}</div>
                </div>
            `).join('');
        }
        
        document.getElementById('teacherSelectModal').style.display = 'flex';
    } catch (error) {
        console.error('获取教师列表失败:', error);
        showMessage('获取教师列表失败: ' + error.message, 'error');
    }
}

// 选择教师并切换到上课模式
async function selectTeacher(teacherId, teacherName) {
    try {
        closeTeacherSelect();
        
        const response = await apiRequest('/api/system/switch-mode', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'class',
                teacherId: teacherId
            })
        });
        
        if (response.success) {
            currentMode = 'class';
            currentTeacher = teacherName;
            sessionStartTime = new Date();
            
            updateModeDisplay();
            await loadDisplayContent();
            startAutoSwitchTimer();
            
            showMessage(`已切换到上课模式，当前教师：${teacherName}`, 'success');
        } else {
            throw new Error(response.message || '切换模式失败');
        }
    } catch (error) {
        console.error('切换到上课模式失败:', error);
        showMessage('切换到上课模式失败: ' + error.message, 'error');
    }
}

// 切换到平时模式
async function switchToNormalMode() {
    try {
        const response = await apiRequest('/api/system/switch-mode', {
            method: 'POST',
            body: JSON.stringify({
                mode: 'normal'
            })
        });
        
        if (response.success) {
            currentMode = 'normal';
            currentTeacher = null;
            sessionStartTime = null;
            selectedStudent = null;
            
            clearAutoSwitchTimer();
            updateModeDisplay();
            await loadDisplayContent();
            
            showMessage('已切换到平时模式', 'success');
        } else {
            throw new Error(response.message || '切换模式失败');
        }
    } catch (error) {
        console.error('切换到平时模式失败:', error);
        showMessage('切换到平时模式失败: ' + error.message, 'error');
    }
}

// 启动自动切换定时器（2小时后自动切换到平时模式）
function startAutoSwitchTimer() {
    clearAutoSwitchTimer();
    
    autoSwitchTimer = setTimeout(async () => {
        console.log('上课模式超时，自动切换到平时模式');
        await switchToNormalMode();
        showMessage('上课模式已超时，自动切换到平时模式', 'info');
    }, 2 * 60 * 60 * 1000); // 2小时
}

// 清除自动切换定时器
function clearAutoSwitchTimer() {
    if (autoSwitchTimer) {
        clearTimeout(autoSwitchTimer);
        autoSwitchTimer = null;
    }
}

// 显示学生查询弹窗
function showStudentQuery() {
    if (currentMode === 'class') {
        showMessage('上课模式下不可使用学生查询功能', 'warning');
        return;
    }
    
    const modal = document.getElementById('studentQueryModal');
    modal.style.display = 'flex';
    
    // 重置表单
    document.getElementById('studentNumberInput').value = '';
    document.getElementById('studentLoginForm').style.display = 'block';
    document.getElementById('studentDashboard').style.display = 'none';
    
    // 自动聚焦到输入框
    setTimeout(() => {
        document.getElementById('studentNumberInput').focus();
    }, 100);
}

// 查询学生积分信息
async function queryStudent() {
    const studentNumber = document.getElementById('studentNumberInput').value.trim();
    const resultContainer = document.getElementById('queryResult');
    
    if (!studentNumber) {
        resultContainer.innerHTML = '<div class="error-message">请输入学号</div>';
        return;
    }
    
    try {
        resultContainer.innerHTML = '<div class="loading">正在查询...</div>';
        
        const response = await apiRequest(`/api/points/student/${encodeURIComponent(studentNumber)}`);
        const data = response.data || response;
        
        if (!data.student) {
            resultContainer.innerHTML = '<div class="error-message">未找到该学号的学生</div>';
            return;
        }
        
        const student = data.student;
        const records = data.weeklyRecords || [];
        const ranking = data.ranking || 0;
        
        resultContainer.innerHTML = `
            <div class="student-info-card">
                <h4>${student.name} (${student.id})</h4>
                <div class="balance ${student.balance < 0 ? 'negative' : ''}">${student.balance}分</div>
                <div class="ranking">班级排名：第 ${ranking} 名</div>
                
                <div class="recent-records">
                    <h5>本周积分记录</h5>
                    ${records.length === 0 ? 
                        '<div class="no-data">本周暂无积分记录</div>' :
                        records.map(record => `
                            <div class="record-item">
                                <span class="record-reason">${record.reason}</span>
                                <span class="record-points ${record.amount > 0 ? 'positive' : 'negative'}">
                                    ${record.amount > 0 ? '+' : ''}${record.amount}分
                                </span>
                                <span class="record-time">${formatDateTime(record.createdAt)}</span>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('查询学生信息失败:', error);
        resultContainer.innerHTML = '<div class="error-message">查询失败，请重试</div>';
    }
}

// 选择学生（上课模式）
function selectStudent(studentId) {
    // 清除之前的选择
    document.querySelectorAll('.student-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // 选择当前学生
    const studentCard = document.querySelector(`[data-student-id="${studentId}"]`);
    if (studentCard) {
        studentCard.classList.add('selected');
        selectedStudent = studentId;
        
        // 更新操作提示
        const hint = document.getElementById('operationHint');
        if (hint) {
            const studentName = studentCard.querySelector('h3').textContent;
            hint.innerHTML = `已选择学生：${studentName}，请点击奖惩项按钮进行操作`;
            hint.style.background = 'rgba(78, 205, 196, 0.2)';
            hint.style.borderColor = 'rgba(78, 205, 196, 0.4)';
            hint.style.color = '#4ecdc4';
        }
    }
}

// 应用奖惩项
async function applyRewardPenalty(itemId, points, itemName) {
    if (!selectedStudent) {
        showMessage('请先选择一个学生', 'warning');
        return;
    }
    
    try {
        // 禁用所有奖惩项按钮
        document.querySelectorAll('.reward-penalty-btn').forEach(btn => {
            btn.disabled = true;
        });
        
        const response = await apiRequest('/api/points/reward-penalty', {
            method: 'POST',
            body: JSON.stringify({
                studentId: selectedStudent,
                itemId: itemId,
                teacherId: currentTeacher,
                points: points,
                reason: itemName
            })
        });
        
        if (response.success) {
            // 更新学生积分显示
            const newBalance = response.data?.newBalance || response.newBalance;
            if (newBalance !== undefined) {
                updateStudentBalance(selectedStudent, newBalance);
            }
            
            // 显示操作记录
            const lastOpEl = document.getElementById(`lastOp_${selectedStudent}`);
            if (lastOpEl) {
                lastOpEl.innerHTML = `
                    <span class="${points > 0 ? 'add' : 'subtract'}">
                        ${itemName}: ${points > 0 ? '+' : ''}${points}分
                    </span>
                `;
                setTimeout(() => {
                    lastOpEl.innerHTML = '';
                }, 5000);
            }
            
            showMessage(`${itemName} 操作成功`, 'success');
            
            // 清除学生选择
            setTimeout(() => {
                clearStudentSelection();
            }, 2000);
            
        } else {
            throw new Error(response.message || '操作失败');
        }
        
    } catch (error) {
        console.error('奖惩项操作失败:', error);
        showMessage('操作失败: ' + error.message, 'error');
    } finally {
        // 重新启用奖惩项按钮
        setTimeout(() => {
            document.querySelectorAll('.reward-penalty-btn').forEach(btn => {
                btn.disabled = false;
            });
        }, 1000);
    }
}

// 清除学生选择
function clearStudentSelection() {
    document.querySelectorAll('.student-card').forEach(card => {
        card.classList.remove('selected');
    });
    selectedStudent = null;
    
    const hint = document.getElementById('operationHint');
    if (hint) {
        hint.innerHTML = '请先选择一个学生，然后点击相应的奖惩项按钮';
        hint.style.background = 'rgba(255, 193, 7, 0.2)';
        hint.style.borderColor = 'rgba(255, 193, 7, 0.4)';
        hint.style.color = '#ffd700';
    }
}

// 关闭学生查询弹窗
function closeStudentQuery() {
    document.getElementById('studentQueryModal').style.display = 'none';
}

// 关闭教师选择弹窗
function closeTeacherSelect() {
    document.getElementById('teacherSelectModal').style.display = 'none';
}

// 关闭所有弹窗
function closeAllModals() {
    closeStudentQuery();
    closeTeacherSelect();
}

// 启动底部时钟
function startFooterClock() {
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const footerTime = document.getElementById('footerTime');
        if (footerTime) {
            footerTime.textContent = timeString;
        }
        
        // 更新会话时间显示
        if (currentMode === 'class' && sessionStartTime) {
            const sessionDuration = Math.floor((now - sessionStartTime) / 1000 / 60); // 分钟
            const sessionTimeEl = document.getElementById('sessionTime');
            if (sessionTimeEl) {
                sessionTimeEl.textContent = `上课时长: ${sessionDuration}分钟`;
            }
        }
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

// 更新模式显示
function updateModeDisplay() {
    const modeIndicator = document.getElementById('modeIndicator');
    const modeToggle = document.getElementById('modeToggle');
    const headerTitle = document.getElementById('headerTitle');
    const sessionInfo = document.getElementById('sessionInfo');
    const currentTeacherEl = document.getElementById('currentTeacher');
    const displayFooter = document.getElementById('displayFooter');
    const container = document.querySelector('.display-container');
    
    if (currentMode === 'class') {
        // 上课模式
        if (modeIndicator) {
            modeIndicator.textContent = '上课模式';
            modeIndicator.className = 'mode-indicator class-mode';
        }
        
        if (modeToggle) {
            modeToggle.textContent = '切换到平时模式';
            modeToggle.className = 'mode-toggle-btn class-mode';
        }
        
        if (headerTitle) {
            headerTitle.textContent = '学生积分操作';
        }
        
        if (sessionInfo && currentTeacher) {
            sessionInfo.style.display = 'flex';
            if (currentTeacherEl) {
                currentTeacherEl.textContent = `当前教师: ${currentTeacher}`;
            }
        }
        
        if (displayFooter) {
            displayFooter.style.display = 'none';
        }
        
        if (container) {
            container.classList.add('class-mode');
            container.classList.remove('normal-mode');
        }
        
    } else {
        // 平时模式
        if (modeIndicator) {
            modeIndicator.textContent = '平时模式';
            modeIndicator.className = 'mode-indicator normal-mode';
        }
        
        if (modeToggle) {
            modeToggle.textContent = '切换到上课模式';
            modeToggle.className = 'mode-toggle-btn normal-mode';
        }
        
        if (headerTitle) {
            headerTitle.textContent = '班级积分排行榜';
        }
        
        if (sessionInfo) {
            sessionInfo.style.display = 'none';
        }
        
        if (displayFooter) {
            displayFooter.style.display = 'block';
        }
        
        if (container) {
            container.classList.add('normal-mode');
            container.classList.remove('class-mode');
        }
    }
}

// 格式化日期时间
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 页面卸载时清理定时器
window.addEventListener('beforeunload', function() {
    clearAutoSwitchTimer();
    stopAutoRefresh();
    if (window.dataCacheService) {
        window.dataCacheService.cleanup();
    }
});
// ==================== 学生查询功能 ====================

let currentQueryStudent = null;
let studentHistory = [];
let studentProducts = [];
let studentOrders = [];



// 关闭学生查询弹窗
function closeStudentQuery() {
    const modal = document.getElementById('studentQueryModal');
    modal.style.display = 'none';
    
    // 清理数据
    currentQueryStudent = null;
    studentHistory = [];
    studentProducts = [];
    studentOrders = [];
}

// 查询学生信息
async function queryStudent() {
    const input = document.getElementById('studentNumberInput');
    const button = document.querySelector('.query-btn');
    const studentId = input.value.trim();

    if (!studentId) {
        showMessage('请输入学号', 'warning');
        input.focus();
        return;
    }

    // 禁用按钮防止重复点击
    button.disabled = true;
    button.textContent = '查询中...';

    try {
        // 学生登录验证
        const response = await apiRequest('/api/auth/student-login', {
            method: 'POST',
            body: JSON.stringify({ studentId: studentId })
        });

        if (response.success && response.data && response.data.student) {
            currentQueryStudent = response.data.student;
            
            // 保存学生token（临时）
            if (response.data.token) {
                storage.set('tempStudentToken', response.data.token);
            }
            
            showMessage('登录成功', 'success');
            await loadStudentDashboard();
        } else {
            throw new Error('学号不存在或登录失败');
        }

    } catch (error) {
        console.error('学生查询失败:', error);
        showMessage(error.message || '查询失败，请检查学号是否正确', 'error');

        // 重新启用按钮
        button.disabled = false;
        button.textContent = '查询';
        input.focus();
        input.select();
    }
}

// 加载学生仪表板
async function loadStudentDashboard() {
    try {
        // 显示仪表板，隐藏登录表单
        document.getElementById('studentLoginForm').style.display = 'none';
        document.getElementById('studentDashboard').style.display = 'block';
        
        // 更新学生信息显示
        document.getElementById('studentName').textContent = currentQueryStudent.name;
        document.getElementById('studentNumber').textContent = `学号：${currentQueryStudent.id}`;
        
        // 并行加载所有数据
        await Promise.allSettled([
            loadStudentInfo(),
            loadStudentHistory(),
            loadStudentProducts(),
            loadStudentOrders()
        ]);

        // 渲染默认标签页（概览）
        renderStudentOverview();

    } catch (error) {
        console.error('加载学生数据失败:', error);
        showMessage('加载数据失败，请重试', 'error');
    }
}

// 加载学生信息
async function loadStudentInfo() {
    try {
        const response = await apiRequest(`/api/students/${currentQueryStudent.id}`);
        if (response.data) {
            // 更新当前学生信息
            currentQueryStudent = { ...currentQueryStudent, ...response.data };
        }
    } catch (error) {
        console.error('加载学生信息失败:', error);
    }
}

// 加载学生历史记录
async function loadStudentHistory() {
    try {
        const response = await apiRequest(`/api/points/history/${currentQueryStudent.id}`);
        studentHistory = response.data?.records || response.records || [];
    } catch (error) {
        console.error('加载历史记录失败:', error);
        studentHistory = [];
    }
}

// 加载商品列表
async function loadStudentProducts() {
    try {
        const response = await apiRequest('/api/products?active=true');
        if (response.success && response.data && response.data.products) {
            studentProducts = response.data.products;
        } else {
            studentProducts = [];
        }
    } catch (error) {
        console.error('加载商品失败:', error);
        studentProducts = [];
    }
}

// 加载学生预约
async function loadStudentOrders() {
    try {
        const response = await apiRequest(`/api/orders?studentId=${currentQueryStudent.id}`);
        studentOrders = response.data?.orders || response.orders || [];
    } catch (error) {
        console.error('加载预约记录失败:', error);
        studentOrders = [];
    }
}

// 切换学生标签页
function switchStudentTab(tabName, buttonElement) {
    // 更新按钮状态
    document.querySelectorAll('#studentQueryModal .tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (buttonElement) {
        buttonElement.classList.add('active');
    }

    // 更新内容显示
    document.querySelectorAll('#studentQueryModal .dashboard-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`student${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // 根据标签页渲染内容
    switch (tabName) {
        case 'overview':
            renderStudentOverview();
            break;
        case 'history':
            renderStudentHistory();
            break;
        case 'products':
            renderStudentProducts();
            break;
        case 'orders':
            renderStudentOrders();
            break;
    }
}

// 渲染学生概览
function renderStudentOverview() {
    const container = document.getElementById('studentOverviewTab');
    const balance = currentQueryStudent.balance || 0;
    const recentHistory = studentHistory.slice(0, 5);

    container.innerHTML = `
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
            
            <div class="info-card stats-card">
                <h3>统计信息</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${studentHistory.filter(r => r.amount > 0).length}</div>
                        <div class="stat-label">获得加分次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${studentHistory.filter(r => r.amount < 0).length}</div>
                        <div class="stat-label">被减分次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${studentOrders.length}</div>
                        <div class="stat-label">预约次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${studentOrders.filter(o => o.status === 'completed').length}</div>
                        <div class="stat-label">成功兑换</div>
                    </div>
                </div>
            </div>
            
            <div class="info-card recent-card">
                <h3>最近记录</h3>
                <div class="recent-history">
                    ${recentHistory.length > 0 ?
                        recentHistory.map(record => `
                            <div class="recent-item">
                                <span class="recent-reason">${record.reason}</span>
                                <span class="recent-points ${record.amount > 0 ? 'positive' : 'negative'}">
                                    ${record.amount > 0 ? '+' : ''}${record.amount}分
                                </span>
                            </div>
                        `).join('') :
                        '<div class="no-data">暂无记录</div>'
                    }
                </div>
                ${recentHistory.length > 0 ? '<button onclick="switchStudentTab(\'history\')" class="view-all-btn">查看全部</button>' : ''}
            </div>
        </div>
    `;
}

// 渲染学生历史记录
function renderStudentHistory() {
    const container = document.getElementById('studentHistoryTab');
    
    container.innerHTML = `
        <div class="history-section">
            <div class="history-header">
                <h3>积分变动记录</h3>
                <div class="history-filter">
                    <select id="studentHistoryFilter" onchange="filterStudentHistory()">
                        <option value="">全部记录</option>
                        <option value="positive">加分记录</option>
                        <option value="negative">减分记录</option>
                        <option value="purchase">消费记录</option>
                    </select>
                </div>
            </div>
            
            <div class="history-list" id="studentHistoryList">
                ${renderStudentHistoryList(studentHistory)}
            </div>
        </div>
    `;
}

// 渲染学生历史记录列表
function renderStudentHistoryList(history) {
    if (!history || history.length === 0) {
        return '<div class="no-data">暂无积分记录</div>';
    }

    return history.map(record => {
        const isPositive = record.amount > 0;
        const typeClass = record.type || (isPositive ? 'reward' : 'penalty');

        return `
            <div class="history-item ${isPositive ? 'positive' : 'negative'}">
                <div class="history-info">
                    <div class="history-reason">${record.reason}</div>
                    <div class="history-time">${formatDate(record.created_at)}</div>
                    <div class="history-type">${getStudentTypeText(typeClass)}</div>
                </div>
                <div class="history-points ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${record.amount}分
                </div>
            </div>
        `;
    }).join('');
}

// 渲染学生商品页面
function renderStudentProducts() {
    const container = document.getElementById('studentProductsTab');
    
    container.innerHTML = `
        <div class="products-section">
            <div class="products-header">
                <h3>商品兑换</h3>
                <div class="products-info">
                    <span>当前积分：<strong>${currentQueryStudent.balance || 0}分</strong></span>
                </div>
            </div>
            
            <div class="products-grid" id="studentProductsGrid">
                ${renderStudentProductsGrid(studentProducts)}
            </div>
        </div>
    `;
}

// 渲染学生商品网格
function renderStudentProductsGrid(productList) {
    if (!productList || productList.length === 0) {
        return '<div class="no-data">暂无可兑换商品</div>';
    }

    return productList.map(product => {
        const canAfford = (currentQueryStudent.balance || 0) >= product.price;
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
                        onclick="reserveStudentProduct('${product.id}')" 
                        ${!canReserve ? 'disabled' : ''}>
                    ${!canAfford ? '积分不足' : !inStock ? '暂时缺货' : '立即预约'}
                </button>
            </div>
        `;
    }).join('');
}

// 渲染学生预约页面
function renderStudentOrders() {
    const container = document.getElementById('studentOrdersTab');
    
    container.innerHTML = `
        <div class="orders-section">
            <div class="orders-header">
                <h3>我的预约</h3>
                <div class="orders-filter">
                    <select id="studentOrdersFilter" onchange="filterStudentOrders()">
                        <option value="">全部预约</option>
                        <option value="pending">待确认</option>
                        <option value="confirmed">已确认</option>
                        <option value="completed">已完成</option>
                        <option value="cancelled">已取消</option>
                    </select>
                </div>
            </div>
            
            <div class="orders-list" id="studentOrdersList">
                ${renderStudentOrdersList(studentOrders)}
            </div>
        </div>
    `;
}

// 渲染学生预约列表
function renderStudentOrdersList(orderList) {
    if (!orderList || orderList.length === 0) {
        return '<div class="no-data">暂无预约记录</div>';
    }

    return orderList.map(order => {
        const product = studentProducts.find(p => p.id === order.product_id);
        const statusText = getStudentOrderStatusText(order.status);

        return `
            <div class="order-item">
                <div class="order-info">
                    <div class="order-product">${product?.name || order.product_name || '未知商品'}</div>
                    <div class="order-price">${order.total_price || product?.price || 0}分</div>
                    <div class="order-time">预约时间：${formatDate(order.created_at)}</div>
                    ${order.confirmed_at ? `<div class="order-confirmed">确认时间：${formatDate(order.confirmed_at)}</div>` : ''}
                </div>
                <div class="order-status">
                    <span class="status-badge status-${order.status}">${statusText}</span>
                    ${order.status === 'pending' ?
                        `<button class="cancel-order-btn" onclick="cancelStudentOrder('${order.id}')">取消预约</button>` :
                        ''
                    }
                </div>
            </div>
        `;
    }).join('');
}

// 预约商品
async function reserveStudentProduct(productId) {
    const product = studentProducts.find(p => p.id === productId);
    if (!product) {
        showMessage('商品不存在', 'error');
        return;
    }

    if ((currentQueryStudent.balance || 0) < product.price) {
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
        const response = await apiRequest('/api/orders', {
            method: 'POST',
            body: JSON.stringify({
                studentId: currentQueryStudent.id,
                productId: productId,
                quantity: 1
            })
        });

        if (response.success) {
            showMessage('预约成功！请联系老师确认兑换', 'success');

            // 重新加载预约数据
            await loadStudentOrders();
            
            // 如果当前在预约标签页，刷新显示
            if (document.getElementById('studentOrdersTab').classList.contains('active')) {
                renderStudentOrders();
            }
        }

    } catch (error) {
        console.error('预约失败:', error);
        showMessage(error.message || '预约失败，请重试', 'error');
    }
}

// 取消预约
async function cancelStudentOrder(orderId) {
    const confirmed = confirm('确定要取消这个预约吗？');
    if (!confirmed) return;

    try {
        const response = await apiRequest(`/api/orders/${orderId}/cancel`, {
            method: 'POST'
        });

        if (response.success) {
            showMessage('预约已取消', 'success');

            // 重新加载预约数据
            await loadStudentOrders();
            
            // 刷新显示
            if (document.getElementById('studentOrdersTab').classList.contains('active')) {
                renderStudentOrders();
            }
        }

    } catch (error) {
        console.error('取消预约失败:', error);
        showMessage(error.message || '取消预约失败，请重试', 'error');
    }
}

// 筛选学生历史记录
function filterStudentHistory() {
    const filter = document.getElementById('studentHistoryFilter').value;
    let filteredHistory = studentHistory;

    if (filter) {
        filteredHistory = studentHistory.filter(record => {
            switch (filter) {
                case 'positive':
                    return record.amount > 0;
                case 'negative':
                    return record.amount < 0;
                case 'purchase':
                    return record.type === 'purchase';
                default:
                    return true;
            }
        });
    }

    document.getElementById('studentHistoryList').innerHTML = renderStudentHistoryList(filteredHistory);
}

// 筛选学生预约记录
function filterStudentOrders() {
    const filter = document.getElementById('studentOrdersFilter').value;
    let filteredOrders = studentOrders;

    if (filter) {
        filteredOrders = studentOrders.filter(order => order.status === filter);
    }

    document.getElementById('studentOrdersList').innerHTML = renderStudentOrdersList(filteredOrders);
}

// 刷新学生数据
async function refreshStudentData() {
    try {
        showMessage('正在刷新数据...', 'info');
        await loadStudentDashboard();
        showMessage('数据刷新成功', 'success');
    } catch (error) {
        console.error('刷新数据失败:', error);
        showMessage('刷新数据失败', 'error');
    }
}

// 学生退出登录
function logoutStudent() {
    // 重置状态
    currentQueryStudent = null;
    studentHistory = [];
    studentProducts = [];
    studentOrders = [];
    
    // 清除临时token
    storage.remove('tempStudentToken');
    
    // 显示登录表单，隐藏仪表板
    document.getElementById('studentLoginForm').style.display = 'block';
    document.getElementById('studentDashboard').style.display = 'none';
    
    // 重置输入框
    const input = document.getElementById('studentNumberInput');
    const button = document.querySelector('.query-btn');
    if (input) {
        input.value = '';
        input.focus();
    }
    if (button) {
        button.disabled = false;
        button.textContent = '查询';
    }
}

// 工具函数
function getStudentTypeText(type) {
    const typeMap = {
        'reward': '奖励',
        'penalty': '惩罚',
        'purchase': '消费',
        'manual': '手动调整'
    };
    return typeMap[type] || '其他';
}

function getStudentOrderStatusText(status) {
    const statusMap = {
        'pending': '待确认',
        'confirmed': '已确认',
        'completed': '已完成',
        'cancelled': '已取消'
    };
    return statusMap[status] || status;
}

// 关闭所有弹窗
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
    
    // 清理学生查询状态
    if (currentQueryStudent) {
        logoutStudent();
    }
}

// 增强键盘事件处理，支持学生查询弹窗
document.addEventListener('keydown', function(event) {
    // ESC键关闭弹窗
    if (event.key === 'Escape') {
        const modal = document.getElementById('studentQueryModal');
        if (modal && modal.style.display === 'block') {
            closeStudentQuery();
            return;
        }
    }
    
    // 在学生查询输入框中按回车
    if (event.key === 'Enter' && event.target.id === 'studentNumberInput') {
        queryStudent();
        return;
    }
});