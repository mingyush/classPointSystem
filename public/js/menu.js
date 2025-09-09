// 通用菜单组件

class MenuSystem {
    constructor() {
        this.isOpen = false;
        this.init();
    }

    init() {
        this.createMenuHTML();
        this.setupEventListeners();
        this.updateMenuItems();
    }

    createMenuHTML() {
        // 创建菜单按钮
        const menuButton = document.createElement('button');
        menuButton.id = 'menuButton';
        menuButton.className = 'menu-button';
        menuButton.innerHTML = `
            <div class="menu-icon">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;

        // 创建菜单覆盖层
        const menuOverlay = document.createElement('div');
        menuOverlay.id = 'menuOverlay';
        menuOverlay.className = 'menu-overlay';

        // 创建菜单面板
        const menuPanel = document.createElement('div');
        menuPanel.id = 'menuPanel';
        menuPanel.className = 'menu-panel';
        menuPanel.innerHTML = `
            <div class="menu-header">
                <h3 id="menuTitle">班级积分管理系统</h3>
                <button class="menu-close" id="menuClose">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <nav class="menu-nav">
                <div class="menu-section">
                    <h4>主要功能</h4>
                    <a href="/" class="menu-item" data-page="home">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                            <polyline points="9,22 9,12 15,12 15,22"></polyline>
                        </svg>
                        <span>首页</span>
                    </a>
                    <a href="/display" class="menu-item" data-page="display">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                            <line x1="8" y1="21" x2="16" y2="21"></line>
                            <line x1="12" y1="17" x2="12" y2="21"></line>
                        </svg>
                        <span>大屏展示</span>
                    </a>
                    <a href="/teacher" class="menu-item" data-page="teacher">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        <span>教师管理</span>
                    </a>
                    <a href="/student" class="menu-item" data-page="student">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="m22 21-3-3m0 0a5 5 0 1 0-7-7 5 5 0 0 0 7 7z"></path>
                        </svg>
                        <span>学生查询</span>
                    </a>
                </div>
                <div class="menu-section">
                    <h4>测试工具</h4>
                    <a href="/test-login.html" class="menu-item" data-page="test">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 12l2 2 4-4"></path>
                            <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
                            <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"></path>
                            <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"></path>
                            <path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"></path>
                        </svg>
                        <span>登录测试</span>
                    </a>
                    <a href="/test-points.html" class="menu-item" data-page="test">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"></polyline>
                        </svg>
                        <span>积分测试</span>
                    </a>
                </div>
                <div class="menu-section" id="userSection" style="display: none;">
                    <h4>用户信息</h4>
                    <div class="user-info-panel" id="userInfoPanel">
                        <!-- 用户信息将在这里动态显示 -->
                    </div>
                    <button class="menu-item logout-item" id="menuLogout" style="display: none;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16,17 21,12 16,7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span>退出登录</span>
                    </button>
                </div>
            </nav>
        `;

        // 添加到页面
        document.body.appendChild(menuButton);
        document.body.appendChild(menuOverlay);
        document.body.appendChild(menuPanel);
    }

    setupEventListeners() {
        const menuButton = document.getElementById('menuButton');
        const menuClose = document.getElementById('menuClose');
        const menuOverlay = document.getElementById('menuOverlay');
        const menuLogout = document.getElementById('menuLogout');

        // 打开菜单
        menuButton.addEventListener('click', () => this.openMenu());
        
        // 关闭菜单
        menuClose.addEventListener('click', () => this.closeMenu());
        menuOverlay.addEventListener('click', () => this.closeMenu());
        
        // 退出登录
        if (menuLogout) {
            menuLogout.addEventListener('click', () => this.handleLogout());
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.closeMenu();
            }
            if (e.key === 'm' && e.ctrlKey) {
                e.preventDefault();
                this.toggleMenu();
            }
        });

        // 点击菜单项时关闭菜单
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                if (!item.classList.contains('logout-item')) {
                    this.closeMenu();
                }
            });
        });
    }

    openMenu() {
        this.isOpen = true;
        document.getElementById('menuOverlay').classList.add('active');
        document.getElementById('menuPanel').classList.add('active');
        document.getElementById('menuButton').classList.add('active');
        document.body.classList.add('menu-open');
        
        // 更新用户信息和系统信息
        this.updateUserInfo();
        this.updateSystemInfo();
    }

    closeMenu() {
        this.isOpen = false;
        document.getElementById('menuOverlay').classList.remove('active');
        document.getElementById('menuPanel').classList.remove('active');
        document.getElementById('menuButton').classList.remove('active');
        document.body.classList.remove('menu-open');
    }

    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    updateMenuItems() {
        // 高亮当前页面
        const currentPath = window.location.pathname;
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            const href = item.getAttribute('href');
            if (href === currentPath || (currentPath === '/' && href === '/')) {
                item.classList.add('active');
            }
        });
    }

    updateUserInfo() {
        const userSection = document.getElementById('userSection');
        const userInfoPanel = document.getElementById('userInfoPanel');
        const menuLogout = document.getElementById('menuLogout');
        
        // 检查教师登录状态
        const teacherToken = storage?.get('teacherToken');
        const currentTeacher = storage?.get('currentTeacher');
        
        // 检查学生登录状态
        const currentStudent = storage?.get('currentStudent');
        
        if (teacherToken && currentTeacher) {
            // 教师已登录
            userSection.style.display = 'block';
            userInfoPanel.innerHTML = `
                <div class="user-card teacher">
                    <div class="user-avatar">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <div class="user-details">
                        <div class="user-name">${currentTeacher.name}</div>
                        <div class="user-role">教师 (${currentTeacher.id})</div>
                    </div>
                </div>
            `;
            menuLogout.style.display = 'flex';
        } else if (currentStudent) {
            // 学生已登录
            userSection.style.display = 'block';
            userInfoPanel.innerHTML = `
                <div class="user-card student">
                    <div class="user-avatar">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                        </svg>
                    </div>
                    <div class="user-details">
                        <div class="user-name">${currentStudent.name}</div>
                        <div class="user-role">学生 (${currentStudent.id})</div>
                        <div class="user-balance">${currentStudent.balance || 0}分</div>
                    </div>
                </div>
            `;
            menuLogout.style.display = 'flex';
        } else {
            // 未登录
            userSection.style.display = 'none';
        }
    }

    updateSystemInfo() {
        // 更新菜单标题
        const menuTitle = document.getElementById('menuTitle');
        if (menuTitle) {
            const className = storage?.get('systemClassName') || '花儿起舞';
            menuTitle.textContent = `${className}班级积分管理系统`;
        }
    }

    handleLogout() {
        const confirmed = confirm('确定要退出登录吗？');
        if (confirmed) {
            // 清除所有登录信息
            if (storage) {
                storage.remove('teacherToken');
                storage.remove('currentTeacher');
                storage.remove('currentStudent');
                storage.remove('systemMode');
            }
            
            this.closeMenu();
            
            // 显示退出消息
            if (typeof showMessage === 'function') {
                showMessage('已退出登录', 'info');
            }
            
            // 重新加载页面
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }
}

// 页面加载完成后初始化菜单
document.addEventListener('DOMContentLoaded', function() {
    // 确保storage已加载
    if (typeof storage !== 'undefined') {
        window.menuSystem = new MenuSystem();
    } else {
        // 延迟初始化，等待storage加载
        setTimeout(() => {
            window.menuSystem = new MenuSystem();
        }, 100);
    }
});