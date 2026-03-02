// 教师管理页面逻辑

let currentMode = "normal";
let selectedStudent = null;
let students = [];
let products = [];
let orders = [];

// 页面初始化
document.addEventListener("DOMContentLoaded", function () {
  console.log("教师页面DOM加载完成");

  // 确保common.js中的函数已加载
  if (
    typeof checkTeacherAuth === "function" &&
    typeof showTeacherLogin === "function"
  ) {
    console.log("common.js函数已加载，开始初始化");
    initTeacherPanel();
    setupEventListeners();
  } else {
    console.log("等待common.js加载完成...");
    // 延迟执行，等待common.js加载
    setTimeout(() => {
      console.log("延迟初始化教师面板");
      initTeacherPanel();
      setupEventListeners();
    }, 100);
  }
});

// 初始化教师面板
async function initTeacherPanel() {
  try {
    console.log("开始初始化教师面板");

    // 检查登录状态
    if (typeof checkTeacherAuth !== "function") {
      console.error("checkTeacherAuth函数未定义，可能common.js未正确加载");
      showMessage("系统加载失败，请刷新页面", "error");
      return;
    }

    if (!checkTeacherAuth()) {
      console.log("未登录，显示登录界面");
      showLoginRequiredState();
      return;
    }

    console.log("已登录，继续初始化");
    updateUserInfo(); // 更新用户信息显示
    await loadSystemMode();
    await loadInitialData();
    renderTeacherContent();
    enableAllControls(); // 启用所有控件
  } catch (error) {
    console.error("初始化失败:", error);
    document.getElementById("teacherContent").innerHTML =
      '<div class="error">系统初始化失败，请刷新页面重试</div>';
  }
}

// 设置事件监听器
function setupEventListeners() {
  const modeToggle = document.getElementById("modeToggle");
  if (modeToggle) {
    modeToggle.addEventListener("click", toggleSystemMode);
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }

  // 更新用户信息显示
  updateUserInfo();
}

// 加载系统模式
async function loadSystemMode() {
  try {
    const response = await apiRequest("/api/config/mode");
    currentMode = response.data?.mode || response.mode || "normal";
    updateModeToggle();
  } catch (error) {
    console.error("获取系统模式失败:", error);
    currentMode = storage.get("systemMode") || "normal";
    updateModeToggle();
  }
}

// 更新模式切换按钮
function updateModeToggle() {
  const modeToggle = document.getElementById("modeToggle");
  if (modeToggle) {
    modeToggle.textContent =
      currentMode === "class" ? "切换到平时模式" : "切换到上课模式";
    modeToggle.className = `mode-toggle ${currentMode}-mode`;
  }
}

// 更新用户信息显示
function updateUserInfo() {
  const userInfo = document.getElementById("userInfo");
  if (userInfo) {
    const teacher = storage.get("currentTeacher");
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
  const confirmed = confirm("确定要退出登录吗？");
  if (confirmed) {
    // 清除本地存储的登录信息
    storage.remove("teacherToken");
    storage.remove("currentTeacher");
    storage.remove("systemMode");

    // 显示退出消息
    showMessage("正在退出登录...", "info");

    // 立即显示退出状态界面
    showLogoutState();

    // 延迟显示登录弹窗，给用户时间看到退出状态
    setTimeout(() => {
      if (typeof showTeacherLogin === "function") {
        showTeacherLogin();
      } else {
        window.location.reload();
      }
    }, 1500);
  }
}

// 显示退出状态界面
function showLogoutState() {
  const container = document.getElementById("teacherContent");
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
  const newMode = currentMode === "class" ? "normal" : "class";

  try {
    const response = await apiRequest("/api/config/mode", {
      method: "POST",
      body: JSON.stringify({ mode: newMode }),
    });

    currentMode = response.data?.mode || newMode;
    storage.set("systemMode", currentMode);
    updateModeToggle();
    showMessage(
      `已切换到${currentMode === "class" ? "上课" : "平时"}模式`,
      "success",
    );
  } catch (error) {
    console.error("切换模式失败:", error);
    showMessage("切换模式失败，请重试", "error");
  }
}

// 加载初始数据
async function loadInitialData() {
  try {
    // 并行加载所有数据
    const [studentsResponse, productsResponse, ordersResponse] =
      await Promise.all([
        apiRequest("/api/students").catch(() => ({ students: [] })),
        apiRequest("/api/products").catch(() => ({ products: [] })),
        apiRequest("/api/orders/pending").catch(() => ({ orders: [] })),
      ]);

    students =
      studentsResponse.data?.students || studentsResponse.students || [];
    products =
      productsResponse.data?.products || productsResponse.products || [];
    orders = ordersResponse.data?.orders || ordersResponse.orders || [];

    // 保存到本地存储
    storage.set("teacherData", { students, products, orders });
  } catch (error) {
    console.error("加载数据失败:", error);
    // 尝试从本地存储恢复数据
    const cachedData = storage.get("teacherData");
    if (cachedData) {
      students = cachedData.students || [];
      products = cachedData.products || [];
      orders = cachedData.orders || [];
    }
  }
}

// 渲染教师内容
function renderTeacherContent() {
  const container = document.getElementById("teacherContent");

  container.innerHTML = `
        <div class="border-b-2 border-brand-200 mb-6 flex gap-4 overflow-x-auto pb-4 mt-2">
            <button class="tab-button active px-5 py-2.5 rounded-xl font-bold text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors focus:outline-none transition-all shadow-sm" onclick="switchTab('points')">积分管理</button>
            <button class="tab-button px-5 py-2.5 rounded-xl font-bold text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors focus:outline-none transition-all shadow-sm" onclick="switchTab('students')">学生管理</button>
            <button class="tab-button px-5 py-2.5 rounded-xl font-bold text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors focus:outline-none transition-all shadow-sm" onclick="switchTab('products')">商品管理</button>
            <button class="tab-button px-5 py-2.5 rounded-xl font-bold text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors focus:outline-none transition-all shadow-sm" onclick="switchTab('orders')">预约管理</button>
            <button class="tab-button px-5 py-2.5 rounded-xl font-bold text-brand-500 hover:bg-brand-100 hover:text-brand-800 transition-colors focus:outline-none transition-all shadow-sm" onclick="switchTab('system')">系统设置</button>
        </div>
        
        <div id="pointsTab" class="tab-content active transition-opacity duration-300">
            ${renderPointsManagement()}
        </div>

        <div id="studentsTab" class="tab-content transition-opacity duration-300">
            ${renderStudentsManagement()}
        </div>
        
        <div id="productsTab" class="tab-content transition-opacity duration-300">
            ${renderProductsManagement()}
        </div>
        
        <div id="ordersTab" class="tab-content transition-opacity duration-300">
            ${renderOrdersManagement()}
        </div>
        
        <div id="systemTab" class="tab-content transition-opacity duration-300">
            ${renderSystemSettings()}
        </div>
    `;

  // 初始化积分管理
  initPointsManagement();
}

// 切换标签页
function switchTab(tabName) {
  // 更新按钮状态
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(`switchTab('${tabName}')`)) {
      btn.classList.add("active");
    }
  });

  // 更新内容显示
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });
  const targetTab = document.getElementById(`${tabName}Tab`);
  if (targetTab) {
    targetTab.classList.add("active");
  }

  // 根据标签页执行特定初始化
  switch (tabName) {
    case "points":
      initPointsManagement();
      break;
    case "students":
      initStudentsManagement();
      break;
    case "products":
      initProductsManagement();
      break;
    case "orders":
      initOrdersManagement();
      break;
    case "system":
      initSystemSettings();
      break;
  }
}

// 渲染学生管理
function renderStudentsManagement() {
  return \`
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <div class="lg:col-span-4 clay-panel p-6 h-fit bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3" id="studentFormTitle">添加学生</h3>
                <form id="studentForm" onsubmit="saveStudent(event)" class="space-y-5">
                    <input type="hidden" id="studentEditMode" value="false">
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">学号</label>
                        <input type="text" id="studentIdInput" required class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">姓名</label>
                        <input type="text" id="studentNameInput" required class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">班级</label>
                        <input type="text" id="studentClassInput" required value="花儿起舞" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">初始积分</label>
                        <input type="number" id="studentBalanceInput" required value="0" min="0" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div class="flex gap-4 pt-4 border-t-4 border-brand-900/10">
                        <button type="button" onclick="resetStudentForm()" class="flex-1 py-3 rounded-lg bg-white hover:bg-brand-50 text-brand-900 border-4 border-brand-900 font-black transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1">返回/重置</button>
                        <button type="submit" id="saveStudentBtn" class="flex-1 py-3 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white border-4 border-brand-900 font-black transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 font-display tracking-widest uppercase">保存学生</button>
                    </div>
                </form>
            </div>
            
            <div class="lg:col-span-8 clay-panel p-6 flex flex-col h-[calc(100vh-14rem)] bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-4 border-b-4 border-brand-900 pb-3">学生列表管理</h3>
                <div class="mb-5">
                    <input type="text" id="adminStudentSearch" placeholder="搜索学生姓名或学号..." 
                           class="w-full bg-white border-4 border-brand-900 rounded-xl py-3 px-4 text-brand-900 placeholder-brand-900/50 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 text-sm transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] font-bold"
                           onkeyup="filterStudentsAdmin(this.value)">
                </div>
                <div id="adminStudentsList" class="flex-1 overflow-y-auto pr-3 custom-scrollbar grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
                    <!-- 学生管理列表动态生成 -->
                </div>
            </div>
        </div>
    \`;
}

// 渲染积分管理
function renderPointsManagement() {
  return `
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
            <div class="xl:col-span-4 clay-panel p-6 flex flex-col h-[calc(100vh-14rem)] bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-4 border-b-4 border-brand-900 pb-3">选择学生</h3>
                <div class="mb-5">
                    <input type="text" id="studentSearch" placeholder="搜索学生姓名或学号..." 
                           class="w-full bg-white border-4 border-brand-900 rounded-xl py-3 px-4 text-brand-900 placeholder-brand-900/50 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 text-sm transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] font-bold"
                           onkeyup="filterStudents(this.value)">
                </div>
                <div class="student-list flex-1 overflow-y-auto pr-3 space-y-3 custom-scrollbar" id="studentList">
                    <!-- 学生列表动态生成 -->
                </div>
            </div>
            
            <div class="xl:col-span-8 flex flex-col gap-6 lg:gap-8">
                <div class="clay-panel p-6 bg-[#ECFEFF]">
                    <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3">积分操作</h3>
                    <div id="selectedStudentInfo" class="mb-6 p-4 rounded-xl bg-white border-4 border-brand-900 text-center text-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)]">
                        <p>请先从左侧选择一个学生</p>
                    </div>
                    
                    <div class="operation-form" id="operationForm" style="display: none;">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 mb-8">
                            <div>
                                <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-3">积分数量 (点击快捷加减)</label>
                                <div class="flex gap-3">
                                    <input type="number" id="pointsInput" min="1" max="100" value="1" class="w-full max-w-[5rem] bg-white border-4 border-brand-900 rounded-xl px-3 py-2 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold text-center font-display shadow-[4px_4px_0px_rgba(22,78,99,1)]">
                                    <button onclick="quickSetPoints(1)" class="flex-1 py-2 rounded-lg bg-white hover:bg-brand-50 border-4 border-brand-900 text-brand-900 font-black transition-all text-sm font-display shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none">+1</button>
                                    <button onclick="quickSetPoints(5)" class="flex-1 py-2 rounded-lg bg-white hover:bg-brand-50 border-4 border-brand-900 text-brand-900 font-black transition-all text-sm font-display shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none">+5</button>
                                    <button onclick="quickSetPoints(10)" class="flex-1 py-2 rounded-lg bg-white hover:bg-brand-50 border-4 border-brand-900 text-brand-900 font-black transition-all text-sm font-display shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none">+10</button>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-3">操作原因</label>
                                <input type="text" id="reasonInput" placeholder="请输入原因 (如作业优秀)..." class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-2 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 placeholder-brand-900/50 transition-all font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)]">
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <button class="flex-1 py-4 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white border-4 border-brand-900 font-display font-black text-xl transition-all shadow-[6px_6px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-[2px_2px_0px_rgba(22,78,99,1)] hover:-translate-y-1 uppercase tracking-widest" onclick="adjustPoints(true)">确定加分</button>
                            <button class="flex-1 py-4 rounded-xl bg-[#F87171] hover:bg-[#EF4444] text-white border-4 border-brand-900 font-display font-black text-xl transition-all shadow-[6px_6px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-[2px_2px_0px_rgba(22,78,99,1)] hover:-translate-y-1 uppercase tracking-widest" onclick="adjustPoints(false)">确定减分</button>
                        </div>
                    </div>
                </div>
                
                <div class="clay-panel p-6 flex-1 h-[calc(100vh-34rem)] flex flex-col">
                    <h4 class="text-lg font-display font-bold text-brand-800 mb-4">最近操作</h4>
                    <div class="operations-list flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar text-sm" id="operationsList">
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
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <div class="lg:col-span-4 clay-panel p-6 h-fit bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3">添加/编辑商品</h3>
                <form id="productForm" onsubmit="saveProduct(event)" class="space-y-5">
                    <input type="hidden" id="productId">
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">商品名称</label>
                        <input type="text" id="productName" required class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">积分价格</label>
                        <input type="number" id="productPrice" min="1" required class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold font-display shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">库存数量</label>
                        <input type="number" id="productStock" min="0" required class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold font-display shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">商品描述</label>
                        <textarea id="productDescription" rows="3" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] resize-none transition-all"></textarea>
                    </div>
                    <div class="flex gap-4 pt-4 border-t-4 border-brand-900/10">
                        <button type="button" onclick="resetProductForm()" class="flex-1 py-3 rounded-lg bg-white hover:bg-brand-50 text-brand-900 border-4 border-brand-900 font-black transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1">重置</button>
                        <button type="submit" id="saveProductBtn" class="flex-1 py-3 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white border-4 border-brand-900 font-black transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 font-display tracking-widest uppercase">保存商品</button>
                    </div>
                </form>
            </div>
            
            <div class="lg:col-span-8 clay-panel p-6 flex flex-col h-[calc(100vh-14rem)] bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3">商品列表</h3>
                <div id="productsList" class="flex-1 overflow-y-auto pr-3 custom-scrollbar grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
                    <!-- 商品列表动态生成 -->
                </div>
            </div>
        </div>
    `;
}

// 渲染预约管理
function renderOrdersManagement() {
  return `
        <div class="clay-panel flex flex-col h-[calc(100vh-14rem)] p-6 bg-[#ECFEFF]">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b-4 border-brand-900 pb-4">
                <h3 class="text-xl font-display font-black text-brand-900">预约管理</h3>
                <div class="flex flex-wrap gap-4 w-full sm:w-auto">
                    <select id="orderStatusFilter" onchange="filterOrders()" class="bg-white border-4 border-brand-900 rounded-xl px-4 py-2 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] font-black shadow-[4px_4px_0px_rgba(22,78,99,1)] min-w-[120px] transition-all cursor-pointer hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(22,78,99,1)]">
                        <option value="">所有状态</option>
                        <option value="pending">待确认</option>
                        <option value="confirmed">已确认</option>
                        <option value="cancelled">已取消</option>
                    </select>
                    
                    <input type="text" id="orderStudentFilter" placeholder="搜索学生..." 
                           class="flex-1 sm:w-64 bg-white border-4 border-brand-900 rounded-xl px-4 py-2 text-brand-900 placeholder-brand-900/50 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] font-black shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all"
                           onkeyup="filterOrders()">
                </div>
            </div>
            
            <div class="orders-list flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-5" id="ordersList">
                <!-- 预约列表动态生成 -->
            </div>
        </div>
    `;
}

// 渲染系统设置
function renderSystemSettings() {
  return `
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
            <div class="clay-panel p-6 bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3 flex items-center gap-2">
                    <svg class="w-7 h-7 text-[#06B6D4]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    系统模式
                </h3>
                <div class="flex items-center justify-between p-5 rounded-xl bg-white border-4 border-brand-900 mb-4 shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    <div class="text-brand-900 font-bold text-sm uppercase tracking-wider">当前模式: <span id="currentModeDisplay" class="font-black text-brand-900 text-lg ml-2">\${currentMode === 'class' ? '上课模式' : '平时模式'}</span></div>
                    <button onclick="toggleSystemMode()" class="px-5 py-2.5 text-sm font-black uppercase rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white border-4 border-brand-900 shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all active:translate-y-1 active:shadow-[0px_0px_0px_rgba(22,78,99,1)] hover:-translate-y-1 focus:outline-none">
                        切换到\${currentMode === 'class' ? '平时' : '上课'}模式
                    </button>
                </div>
            </div>
            
            <div class="clay-panel p-6 lg:row-span-2 xl:col-span-1 bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3">系统参数设置</h3>
                <form id="configForm" onsubmit="saveSystemConfig(event)" class="space-y-5">
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">自动刷新间隔 (秒)</label>
                        <input type="number" id="autoRefreshInterval" min="5" max="300" value="30" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold font-display shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">单次操作最大积分</label>
                        <input type="number" id="maxPointsPerOperation" min="1" max="1000" value="100" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold font-display shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">学期开始日期</label>
                        <input type="date" id="semesterStartDate" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">班级名称</label>
                        <input type="text" id="className" placeholder="请输入班级名称" value="花儿起舞" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">作者</label>
                        <input type="text" id="author" placeholder="请输入作者名称" value="茗雨" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">版权信息</label>
                        <input type="text" id="copyright" placeholder="请输入版权信息" value="© 2025 花儿起舞班级积分管理系统 | 作者：茗雨" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold text-sm shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div class="pt-3">
                        <label class="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" id="pointsResetEnabled" class="w-6 h-6 rounded border-4 border-brand-900 bg-white text-[#F87171] focus:ring-[#F87171] focus:ring-offset-0">
                            <span class="text-brand-900 font-black text-sm uppercase tracking-wider group-hover:text-[#F87171] transition-colors">开启危险操作: 允许清零全部积分</span>
                        </label>
                    </div>
                    <div class="flex gap-4 pt-5 border-t-4 border-brand-900/10">
                        <button type="button" onclick="resetConfigForm()" class="flex-1 py-3 rounded-lg bg-white hover:bg-brand-50 text-brand-900 border-4 border-brand-900 font-black transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 uppercase tracking-widest">重置</button>
                        <button type="submit" class="flex-1 py-3 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white border-4 border-brand-900 font-black transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 font-display tracking-widest uppercase">保存配置</button>
                    </div>
                </form>
            </div>
            
            <div class="clay-panel p-6 xl:col-span-1 bg-[#ECFEFF]">
                <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3">修改当前教师密码</h3>
                <form id="changePasswordForm" onsubmit="changeTeacherPassword(event)" class="space-y-4 mb-6">
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">原密码</label>
                        <input type="password" id="oldPassword" required class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">新密码</label>
                        <input type="password" id="newPassword" required minlength="3" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div>
                        <label class="block text-sm font-black uppercase tracking-wider text-brand-900 mb-2">确认新密码</label>
                        <input type="password" id="confirmNewPassword" required minlength="3" class="w-full bg-white border-4 border-brand-900 rounded-xl px-4 py-3 text-brand-900 focus:outline-none focus:ring-4 focus:ring-[#67E8F9] focus:border-brand-900 font-bold shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all">
                    </div>
                    <div class="pt-3">
                        <button type="submit" class="w-full py-3 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-white border-4 border-brand-900 font-black transition-all shadow-[4px_4px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none hover:-translate-y-1 font-display tracking-widest uppercase">修改密码</button>
                    </div>
                </form>
            </div>
            
            <div class="clay-panel p-6 xl:col-span-1 bg-[#ECFEFF] h-fit">
                <h3 class="text-xl font-display font-black text-brand-900 mb-6 border-b-4 border-brand-900 pb-3">数据分析与管理</h3>
                <div class="grid grid-cols-2 gap-4 mb-8">
                    <button onclick="exportData()" class="py-3 px-4 rounded-lg bg-white hover:bg-brand-50 border-4 border-brand-900 text-brand-900 font-black uppercase tracking-wider shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none transition-all text-xs sm:text-sm">导出全量数据</button>
                    <button onclick="createBackup()" class="py-3 px-4 rounded-lg bg-white hover:bg-brand-50 border-4 border-brand-900 text-brand-900 font-black uppercase tracking-wider shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none transition-all text-xs sm:text-sm">创建云端备份</button>
                    <button onclick="showBackupManager()" class="py-3 px-4 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] border-4 border-brand-900 text-white font-black uppercase tracking-wider shadow-[4px_4px_0px_rgba(22,78,99,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none transition-all col-span-2 text-sm">打开备份管理台</button>
                    <button onclick="showResetConfirm()" class="py-3 px-4 rounded-lg bg-[#FCA5A5] border-4 border-[#7F1D1D] hover:bg-[#F87171] text-[#7F1D1D] font-black uppercase tracking-wider shadow-[4px_4px_0px_rgba(127,29,29,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(127,29,29,1)] active:translate-y-1 active:shadow-none transition-all col-span-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none text-sm" id="resetPointsBtn" disabled>⚠️ 危险：重置全班积分</button>
                </div>
                
                <h4 class="text-sm font-black text-brand-900 mb-4 border-t-4 border-brand-900/10 pt-5 uppercase tracking-widest">系统信息总览</h4>
                <div class="space-y-4 text-sm text-brand-900 font-bold">
                    <div class="flex justify-between items-center p-4 rounded-xl bg-white border-4 border-brand-900 shadow-[4px_4px_0px_rgba(22,78,99,1)] font-display uppercase"><span class="font-black">学生总数</span><span id="studentCount" class="text-brand-900 text-xl font-black bg-[#CFFAFE] px-3 py-1 rounded-lg border-2 border-brand-900">\${students.length}</span></div>
                    <div class="flex justify-between items-center p-4 rounded-xl bg-white border-4 border-brand-900 shadow-[4px_4px_0px_rgba(22,78,99,1)] font-display uppercase"><span class="font-black">商品总数</span><span id="productCount" class="text-brand-900 text-xl font-black bg-[#CFFAFE] px-3 py-1 rounded-lg border-2 border-brand-900">\${products.length}</span></div>
                    <div class="flex justify-between items-center p-4 rounded-xl bg-white border-4 border-brand-900 shadow-[4px_4px_0px_rgba(22,78,99,1)] font-display uppercase"><span class="font-black">待处理预约</span><span id="pendingOrderCount" class="text-[#16A34A] text-xl font-black bg-[#DCFCE7] px-3 py-1 rounded-lg border-2 border-[#16A34A]">\${orders.filter(o => o.status === 'pending').length}</span></div>
                    <div class="flex justify-between items-center p-4 rounded-xl bg-white border-4 border-brand-900 shadow-[4px_4px_0px_rgba(22,78,99,1)] font-display uppercase text-xs"><span>系统版本</span><span class="text-brand-900 font-bold bg-brand-50 px-2 py-1 rounded border border-brand-900">v1.0.0 Vibrant Edition</span></div>
                </div>
            </div>

            <div class="clay-panel p-6 lg:col-span-2 xl:col-span-3 border-4 border-brand-300" id="backupManagerSection" style="display: none;">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h3 class="text-xl font-display font-bold text-brand-800 flex items-center gap-2"><svg class="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg> 备份恢复与组件数据分导</h3>
                    <div class="flex flex-wrap gap-2">
                        <button onclick="refreshBackupList()" class="px-4 py-2 font-bold rounded-xl bg-white hover:bg-brand-50 border-2 border-brand-200 text-brand-700 transition-all shadow-sm">刷新列表</button>
                        <button onclick="cleanOldBackups()" class="px-4 py-2 font-bold rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-all border-2 border-red-200 shadow-sm">清理过旧备份</button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="text-sm font-bold text-brand-500 uppercase tracking-widest mb-3">备份快照列表</h4>
                        <div class="backup-list bg-brand-50 rounded-xl p-4 min-h-[12rem] max-h-[18rem] overflow-y-auto custom-scrollbar border-2 border-brand-100 shadow-inner" id="backupList">
                            <div class="text-brand-400 font-bold text-sm flex items-center justify-center gap-2 w-full h-full">加载中...</div>
                        </div>

                        <div class="mt-4 p-4 rounded-xl border-4 border-dashed border-brand-200 bg-white text-center hover:bg-brand-50 transition-colors">
                            <input type="file" id="restoreFileInput" accept=".zip" class="hidden" onchange="handleRestoreFile(event)">
                            <button onclick="document.getElementById('restoreFileInput').click()" class="text-sm text-brand-600 hover:text-brand-800 font-bold pb-1 border-b-2 border-brand-300">上传本地.zip完整备份恢复</button>
                        </div>
                    </div>

                    <div>
                        <h4 class="text-sm font-bold text-brand-500 uppercase tracking-widest mb-3">多格式数据导出与覆盖导入</h4>
                        <div class="space-y-3">
                            \${['students:学生数据', 'points:积分记录', 'products:商品数据', 'orders:预约数据', 'config:系统参数'].map(d => {
                                const [id, label] = d.split(':');
                                return \`
                                <div class="flex items-center justify-between p-3.5 rounded-xl bg-white border-2 border-brand-100 hover:border-brand-300 shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand-300">
                                    <span class="text-brand-800 font-bold">\${label}</span>
                                    <div class="flex gap-2">
                                        <button onclick="exportSingleData('\${id}')" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-brand-100 hover:bg-brand-200 text-brand-800 transition-colors">导出</button>
                                        <input type="file" id="import\${id.charAt(0).toUpperCase() + id.slice(1)}Input" accept=".json" class="hidden" onchange="importSingleData('\${id}', event)">
                                        <button onclick="document.getElementById('import\${id.charAt(0).toUpperCase() + id.slice(1)}Input').click()" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors">导入覆盖</button>
                                    </div>
                                </div>\`;
                            }).join('')}
                        </div>
                    </div>
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
  const container = document.getElementById("studentList");
  const studentsToShow = filteredStudents || students;

  if (studentsToShow.length === 0) {
    container.innerHTML = '<div class="no-data">暂无学生数据</div>';
    return;
  }

  // 按学号排序
  const sortedStudents = [...studentsToShow].sort((a, b) => {
    // 确保学号按数字顺序排序
    const idA = String(a.id || "").padStart(10, "0");
    const idB = String(b.id || "").padStart(10, "0");
    return idA.localeCompare(idB);
  });

  container.innerHTML = sortedStudents
    .map(
      (student) => `
        <div class="student-item cursor-pointer p-4 rounded-xl border-4 border-brand-900 bg-white hover:bg-[#CFFAFE] hover:-translate-y-1 hover:shadow-[4px_4px_0px_rgba(22,78,99,1)] transition-all flex justify-between items-center group [&.selected]:bg-[#22D3EE] [&.selected]:shadow-[4px_4px_0px_rgba(22,78,99,1)] [&.selected]:-translate-y-1" onclick="selectStudent('${student.id}')">
            <div class="flex flex-col">
                <div class="font-black uppercase tracking-wider font-display text-brand-900 transition-colors text-lg">${student.name}</div>
                <div class="text-xs text-brand-900/60 font-bold font-mono tracking-widest">${student.id}</div>
            </div>
            <div class="font-display text-2xl font-black px-3 py-1 rounded border-2 border-brand-900 bg-white ${student.balance < 0 ? "text-[#EF4444]" : "text-brand-900"}">${student.balance || 0}</div>
        </div>
    `,
    )
    .join("");
}

// 筛选学生
function filterStudents(searchTerm) {
  if (!searchTerm.trim()) {
    renderStudentList();
    return;
  }

  const filtered = students.filter(
    (student) =>
      student.name.includes(searchTerm) || student.id.includes(searchTerm),
  );

  renderStudentList(filtered);
}

// 筛选管理页面学生
function filterStudentsAdmin(searchTerm) {
  if (!searchTerm.trim()) {
    renderStudentsListAdmin();
    return;
  }

  const filtered = students.filter(
    (student) =>
      student.name.includes(searchTerm) || student.id.includes(searchTerm),
  );

  renderStudentsListAdmin(filtered);
}

// 获取学生列表 Admin
function initStudentsManagement() {
  renderStudentsListAdmin();
}

// 渲染学生管理列表
function renderStudentsListAdmin(filteredStudents = null) {
  const container = document.getElementById("adminStudentsList");
  const studentsToShow = filteredStudents || students;

  if (studentsToShow.length === 0) {
    container.innerHTML = '<div class="no-data col-span-2">暂无学生数据</div>';
    return;
  }

  // 按学号排序
  const sortedStudents = [...studentsToShow].sort((a, b) => {
    const idA = String(a.id || "").padStart(10, "0");
    const idB = String(b.id || "").padStart(10, "0");
    return idA.localeCompare(idB);
  });

  container.innerHTML = sortedStudents
    .map(
      (student) => \`
        <div class="student-item-admin p-5 rounded-2xl bg-white border-4 border-brand-900 hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(22,78,99,1)] shadow-[2px_2px_0px_rgba(22,78,99,1)] transition-all flex flex-col group">
            <div class="flex justify-between items-start mb-4 pb-3 border-b-4 border-brand-900/10">
                <div class="font-black uppercase tracking-wider font-display text-brand-900 text-xl">\${student.name} <span class="text-sm font-mono text-brand-900/50 ml-1">#\${student.id}</span></div>
                <div class="text-brand-900 bg-[#CFFAFE] border-2 border-brand-900 px-3 py-1 rounded font-display font-black text-xl">\${student.balance || 0}分</div>
            </div>
            <div class="text-sm font-bold text-brand-900/80 mb-4">班级: \${student.class || '未知'}</div>
            <div class="flex justify-end gap-3 mt-auto">
                <button class="px-4 py-2 text-sm font-black uppercase rounded-lg bg-white border-2 border-brand-900 hover:bg-[#67E8F9] text-brand-900 transition-all shadow-[2px_2px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none" onclick="editStudent('\${student.id}')">编辑</button>
                <button class="px-4 py-2 text-sm font-black uppercase rounded-lg bg-[#FCA5A5] border-2 border-[#7F1D1D] hover:bg-[#F87171] text-[#7F1D1D] transition-all shadow-[2px_2px_0px_rgba(127,29,29,1)] active:translate-y-1 active:shadow-none" onclick="deleteStudent('\${student.id}')">删除</button>
            </div>
        </div>
    \`,
    )
    .join("");
}

// 准备编辑学生
function editStudent(studentId) {
  const student = students.find((s) => s.id === studentId);
  if (!student) return;

  const idInput = document.getElementById("studentIdInput");
  idInput.value = student.id;
  idInput.disabled = true; // 不能修改学号
  idInput.classList.add("opacity-50", "cursor-not-allowed");

  document.getElementById("studentNameInput").value = student.name;
  document.getElementById("studentClassInput").value = student.class || "花儿起舞";
  document.getElementById("studentBalanceInput").value = student.balance || 0;
  
  document.getElementById("studentEditMode").value = "true";
  document.getElementById("studentFormTitle").textContent = "编辑学生";
  document.getElementById("saveStudentBtn").textContent = "更新学生";
}

// 保存/更新学生
async function saveStudent(event) {
  event.preventDefault();

  const id = document.getElementById("studentIdInput").value.trim();
  const name = document.getElementById("studentNameInput").value.trim();
  const className = document.getElementById("studentClassInput").value.trim();
  const balance = parseInt(document.getElementById("studentBalanceInput").value) || 0;
  const isEdit = document.getElementById("studentEditMode").value === "true";

  if (!id || !name || !className) {
    showMessage("请填写完整的学生信息", "warning");
    return;
  }

  try {
    const endpoint = isEdit ? \`/api/students/\${id}\` : "/api/students";
    const method = isEdit ? "PUT" : "POST";

    const response = await apiRequest(endpoint, {
      method: method,
      body: JSON.stringify({
        id: id,
        name: name,
        class: className,
        balance: balance
      }),
    });

    const studentData = response.student || response.data;
    
    if (isEdit) {
      const index = students.findIndex((s) => s.id === id);
      if (index !== -1) {
        students[index] = { ...students[index], ...studentData };
      }
    } else {
      students.push(studentData);
    }

    // 更新界面
    renderStudentsListAdmin();
    // 还需要更新积分面板的列表
    renderStudentList(null); 
    
    resetStudentForm();
    showMessage(\`学生\${isEdit ? "更新" : "添加"}成功\`, "success");
    
  } catch (error) {
    console.error("保存学生失败:", error);
    showMessage(\`保存失败: \${error.message}\`, "error");
  }
}

// 删除学生
async function deleteStudent(studentId) {
  if (!confirm(\`确定要删除学号为 \${studentId} 的学生吗？此操作不可恢复。\`)) return;

  try {
    await apiRequest(\`/api/students/\${studentId}\`, {
      method: "DELETE",
    });

    // 从本地数据移除
    students = students.filter((s) => s.id !== studentId);

    // 刷新显示
    renderStudentsListAdmin();
    renderStudentList(null);

    showMessage("学生删除成功", "success");
  } catch (error) {
    console.error("删除学生失败:", error);
    showMessage(\`删除失败: \${error.message}\`, "error");
  }
}

// 重置学生表单
function resetStudentForm() {
  document.getElementById("studentForm").reset();
  const idInput = document.getElementById("studentIdInput");
  idInput.disabled = false;
  idInput.classList.remove("opacity-50", "cursor-not-allowed");
  
  document.getElementById("studentEditMode").value = "false";
  document.getElementById("studentFormTitle").textContent = "添加学生";
  document.getElementById("saveStudentBtn").textContent = "保存学生";
}

// 选择学生
function selectStudent(studentId) {
  selectedStudent = students.find((s) => s.id === studentId);

  // 更新选中状态
  document.querySelectorAll(".student-item").forEach((item) => {
    item.classList.remove("selected");
  });
  event.currentTarget.classList.add("selected");

  // 显示学生信息和操作表单
  const infoContainer = document.getElementById("selectedStudentInfo");
  const formContainer = document.getElementById("operationForm");

  infoContainer.innerHTML = `
            <div class="flex justify-between items-center px-2 py-1">
                <div>
                    <h4 class="text-2xl font-black text-brand-900 border-l-8 border-[#06B6D4] pl-3 uppercase tracking-wider">${selectedStudent.name} <span class="text-sm font-bold text-brand-900/50 font-mono ml-2">ID: ${selectedStudent.id}</span></h4>
                </div>
                <div class="text-right flex items-center gap-3">
                    <p class="text-sm text-brand-900 font-black uppercase tracking-wider">当前积分</p>
                    <span class="text-3xl font-black font-mono px-4 py-1 rounded bg-[#CFFAFE] border-2 border-brand-900 ${selectedStudent.balance < 0 ? "text-[#EF4444]" : "text-brand-900"}">${selectedStudent.balance || 0}</span>
                </div>
            </div>
        `;
  formContainer.style.display = "block";

  // 清空输入框
  document.getElementById("pointsInput").value = "1";
  document.getElementById("reasonInput").value = "";
}

// 快速设置积分
function quickSetPoints(points) {
  document.getElementById("pointsInput").value = points;
}

// 调整积分
async function adjustPoints(isAdd) {
  if (!selectedStudent) {
    showMessage("请先选择一个学生", "warning");
    return;
  }

  const points = parseInt(document.getElementById("pointsInput").value);
  const reason = document.getElementById("reasonInput").value.trim();

  if (!points || points <= 0) {
    showMessage("请输入有效的积分数量", "warning");
    return;
  }

  if (!reason) {
    showMessage("请输入操作原因", "warning");
    return;
  }

  try {
    const endpoint = isAdd ? "/api/points/add" : "/api/points/subtract";
    const response = await apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify({
        studentId: selectedStudent.id,
        points: points,
        reason: reason,
      }),
    });

    // 更新本地学生数据
    selectedStudent.balance = response.newBalance;
    const studentIndex = students.findIndex((s) => s.id === selectedStudent.id);
    if (studentIndex !== -1) {
      students[studentIndex].balance = response.newBalance;
    }

    // 刷新显示
    renderStudentList();
    selectStudent(selectedStudent.id);
    loadRecentOperations();

    showMessage(`${isAdd ? "加分" : "减分"}操作成功`, "success");

    // 清空原因输入框
    document.getElementById("reasonInput").value = "";
  } catch (error) {
    console.error("积分操作失败:", error);
    showMessage("积分操作失败，请重试", "error");
  }
}

// 加载最近操作
async function loadRecentOperations() {
  try {
    // 这里应该调用获取最近操作的API
    // 暂时显示占位内容
    const container = document.getElementById("operationsList");
    container.innerHTML =
      '<div class="text-center text-brand-400 font-bold py-8">暂无最近操作记录</div>';
  } catch (error) {
    console.error("加载操作记录失败:", error);
  }
}

// 初始化商品管理
function initProductsManagement() {
  renderProductsList();
}

// 渲染商品列表
function renderProductsList() {
  const container = document.getElementById("productsList");

  if (products.length === 0) {
    container.innerHTML = '<div class="no-data">暂无商品数据</div>';
    return;
  }

  container.innerHTML = products
    .map(
      (product) => `
        <div class="product-item p-5 rounded-2xl bg-white border-4 border-brand-900 hover:-translate-y-1 hover:shadow-[6px_6px_0px_rgba(22,78,99,1)] shadow-[2px_2px_0px_rgba(22,78,99,1)] transition-all flex flex-col group">
            <div class="flex justify-between items-start mb-5 pb-3 border-b-4 border-brand-900/10">
                <div class="font-black uppercase tracking-wider font-display text-brand-900 text-xl">${product.name}</div>
                <div class="text-brand-900 bg-[#CFFAFE] border-2 border-brand-900 px-3 py-1 rounded font-display font-black text-xl">${product.price}分</div>
            </div>
            <div class="text-sm font-bold text-brand-900/80 mb-5 flex-1 p-3 bg-brand-50 rounded-lg border-2 border-brand-900/20">${product.description || "暂无描述"}</div>
            <div class="flex items-center justify-between pt-1">
                <div class="text-sm font-black uppercase tracking-wider text-brand-900">库存: <span class="font-mono font-black border-2 border-brand-900 px-2 py-0.5 rounded ${product.stock > 0 ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#FEE2E2] text-[#DC2626]"}">${product.stock}</span></div>
                <div class="flex gap-3">
                    <button class="px-4 py-2 text-sm font-black uppercase rounded-lg bg-white border-2 border-brand-900 hover:bg-[#67E8F9] text-brand-900 transition-all shadow-[2px_2px_0px_rgba(22,78,99,1)] active:translate-y-1 active:shadow-none" onclick="editProduct('${product.id}')">编辑</button>
                    <button class="px-4 py-2 text-sm font-black uppercase rounded-lg bg-[#FCA5A5] border-2 border-[#7F1D1D] hover:bg-[#F87171] text-[#7F1D1D] transition-all shadow-[2px_2px_0px_rgba(127,29,29,1)] active:translate-y-1 active:shadow-none" onclick="deleteProduct('${product.id}')">删除</button>
                </div>
            </div>
        </div>
    `,
    )
    .join("");
}

// 保存商品
async function saveProduct(event) {
  event.preventDefault();

  const productId = document.getElementById("productId").value;
  const name = document.getElementById("productName").value.trim();
  const price = parseInt(document.getElementById("productPrice").value);
  const stock = parseInt(document.getElementById("productStock").value);
  const description = document
    .getElementById("productDescription")
    .value.trim();

  if (!name || !price || price <= 0 || stock < 0) {
    showMessage("请填写有效的商品信息", "warning");
    return;
  }

  try {
    const isEdit = !!productId;
    const endpoint = isEdit ? `/api/products/${productId}` : "/api/products";
    const method = isEdit ? "PUT" : "POST";

    const response = await apiRequest(endpoint, {
      method: method,
      body: JSON.stringify({
        name: name,
        price: price,
        stock: stock,
        description: description,
      }),
    });

    // 更新本地数据
    const productData = response.data?.product || response.product;
    if (isEdit) {
      const index = products.findIndex((p) => p.id === productId);
      if (index !== -1) {
        products[index] = productData;
      }
    } else {
      products.push(productData);
    }

    // 刷新显示
    renderProductsList();
    resetProductForm();

    showMessage(`商品${isEdit ? "更新" : "添加"}成功`, "success");
  } catch (error) {
    console.error("保存商品失败:", error);
    showMessage("保存商品失败，请重试", "error");
  }
}

// 编辑商品
function editProduct(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  document.getElementById("productId").value = product.id;
  document.getElementById("productName").value = product.name;
  document.getElementById("productPrice").value = product.price;
  document.getElementById("productStock").value = product.stock;
  document.getElementById("productDescription").value =
    product.description || "";

  document.getElementById("saveProductBtn").textContent = "更新商品";
}

// 删除商品
async function deleteProduct(productId) {
  if (!confirm("确定要删除这个商品吗？")) return;

  try {
    await apiRequest(`/api/products/${productId}`, {
      method: "DELETE",
    });

    // 从本地数据中移除
    products = products.filter((p) => p.id !== productId);

    // 刷新显示
    renderProductsList();

    showMessage("商品删除成功", "success");
  } catch (error) {
    console.error("删除商品失败:", error);
    showMessage("删除商品失败，请重试", "error");
  }
}

// 修改教师当前登录账号密码
async function changeTeacherPassword(event) {
  event.preventDefault();

  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  if (!oldPassword || !newPassword || !confirmNewPassword) {
    showMessage("请填写所有密码字段", "warning");
    return;
  }

  if (newPassword !== confirmNewPassword) {
    showMessage("新密码和确认密码不一致", "warning");
    return;
  }

  if (newPassword.length < 3) {
    showMessage("新密码长度不能少于3个字符", "warning");
    return;
  }

  try {
    const response = await apiRequest("/api/auth/teacher/change-password", {
      method: "POST",
      body: JSON.stringify({
        oldPassword,
        newPassword,
      }),
    });

    showMessage(response.message || "密码修改成功，即将重新登录", "success");

    // 修改成功后清空表单并延时登出让用户重新登录
    document.getElementById("changePasswordForm").reset();

    setTimeout(() => {
      handleLogout();
    }, 1500);
  } catch (error) {
    console.error("修改密码失败:", error);
    showMessage(error.message || "修改密码失败，请验证原密码是否正确并重试", "error");
  }
}

// 重置商品表单
function resetProductForm() {
  document.getElementById("productForm").reset();
  document.getElementById("productId").value = "";
  document.getElementById("saveProductBtn").textContent = "保存商品";
}

// 初始化预约管理
function initOrdersManagement() {
  renderOrdersList();
}

// 渲染预约列表
function renderOrdersList(filteredOrders = null) {
  const container = document.getElementById("ordersList");
  const ordersToShow = filteredOrders || orders;

  if (ordersToShow.length === 0) {
    container.innerHTML =
      '<div class="text-center text-brand-400 font-bold py-8 clay-panel">暂无预约数据</div>';
    return;
  }

  container.innerHTML = ordersToShow
    .map((orderData) => {
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
        student = students.find((s) => s.id === order.studentId);
        product = products.find((p) => p.id === order.productId);
      }

      const statusColors = {
        pending: "text-orange-700 bg-orange-100 border-orange-200",
        confirmed: "text-accent-700 bg-accent-100 border-accent-200",
        cancelled: "text-gray-600 bg-gray-100 border-gray-200",
      };

      return `
            <div class="order-item p-5 rounded-2xl bg-white border-2 border-brand-100 hover:border-brand-300 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-all group">
                <div class="order-info flex-1 w-full">
                    <div class="flex justify-between items-center sm:justify-start sm:gap-4 mb-3">
                        <span class="font-display font-bold text-brand-900 group-hover:text-brand-600 transition-colors text-xl">${student?.name || "未知学生"} <span class="text-sm font-mono text-brand-400 ml-1">(${student?.id || order.studentId})</span></span>
                        <span class="px-3 py-1 rounded-full text-xs font-bold border-2 ${statusColors[order.status]}">${getStatusText(order.status)}</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm font-bold text-brand-600">
                        <div><strong class="text-brand-400 border-r-2 border-brand-100 pr-2 mr-2">商品</strong> <span class="text-brand-800 font-display">${product?.name || "未知商品"}</span></div>
                        <div><strong class="text-brand-400 border-r-2 border-brand-100 pr-2 mr-2">价格</strong> <span class="font-mono text-brand-800 font-bold text-lg">${product?.price || 0}分</span></div>
                        <div class="lg:col-span-2"><strong class="text-brand-400 border-r-2 border-brand-100 pr-2 mr-2">预约时间</strong> <span class="font-mono text-brand-700">${formatDate(order.reservedAt)}</span></div>
                        ${order.confirmedAt ? `<div class="lg:col-span-2"><strong class="text-brand-400 border-r-2 border-brand-100 pr-2 mr-2">确认时间</strong> <span class="font-mono text-brand-700">${formatDate(order.confirmedAt)}</span></div>` : ""}
                        ${order.cancelledAt ? `<div class="lg:col-span-2"><strong class="text-brand-400 border-r-2 border-brand-100 pr-2 mr-2">取消时间</strong> <span class="font-mono text-brand-700">${formatDate(order.cancelledAt)}</span></div>` : ""}
                    </div>
                </div>
                <div class="order-actions flex gap-2 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap border-t-2 sm:border-t-0 sm:border-l-2 border-brand-100 pt-4 sm:pt-0 sm:pl-5">
                    ${
                      order.status === "pending"
                        ? `
                        <button class="flex-1 sm:flex-none px-4 py-2 font-bold rounded-xl bg-accent-50 border-2 border-accent-200 hover:bg-accent-100 text-accent-700 transition-all shadow-sm" onclick="confirmOrder('${order.id}')">确认兑换</button>
                        <button class="flex-1 sm:flex-none px-4 py-2 font-bold rounded-xl bg-red-50 border-2 border-red-200 hover:bg-red-100 text-red-600 transition-all shadow-sm" onclick="cancelOrder('${order.id}')">取消预约</button>
                    `
                        : `
                        <span class="text-sm font-bold text-brand-400 w-full text-center sm:text-left">无可用操作</span>
                    `
                    }
                </div>
            </div>
        `;
    })
    .join("");
}

// 获取状态文本
function getStatusText(status) {
  const statusMap = {
    pending: "待确认",
    confirmed: "已确认",
    cancelled: "已取消",
  };
  return statusMap[status] || status;
}

// 筛选预约
function filterOrders() {
  const statusFilter = document.getElementById("orderStatusFilter").value;
  const studentFilter = document
    .getElementById("orderStudentFilter")
    .value.toLowerCase();

  let filtered = orders;

  if (statusFilter) {
    filtered = filtered.filter((orderData) => {
      const order = orderData.order || orderData;
      return order.status === statusFilter;
    });
  }

  if (studentFilter) {
    filtered = filtered.filter((orderData) => {
      let student;
      if (orderData.student) {
        // 来自API的详细数据
        student = orderData.student;
      } else {
        // 简单数据，需要查找
        const order = orderData;
        student = students.find((s) => s.id === order.studentId);
      }
      return (
        student &&
        (student.name.toLowerCase().includes(studentFilter) ||
          student.id.toLowerCase().includes(studentFilter))
      );
    });
  }

  renderOrdersList(filtered);
}

// 确认预约
async function confirmOrder(orderId) {
  try {
    const response = await apiRequest(`/api/orders/${orderId}/confirm`, {
      method: "POST",
    });

    // 更新本地数据
    const orderIndex = orders.findIndex((orderData) => {
      const order = orderData.order || orderData;
      return order.id === orderId;
    });

    if (orderIndex !== -1) {
      if (orders[orderIndex].order) {
        // 详细数据结构
        orders[orderIndex].order.status = "confirmed";
        orders[orderIndex].order.confirmedAt = new Date().toISOString();
      } else {
        // 简单数据结构
        orders[orderIndex].status = "confirmed";
        orders[orderIndex].confirmedAt = new Date().toISOString();
      }
    }

    // 刷新显示
    renderOrdersList();

    showMessage("预约确认成功", "success");
  } catch (error) {
    console.error("确认预约失败:", error);
    showMessage("确认预约失败，请重试", "error");
  }
}

// 取消预约
async function cancelOrder(orderId) {
  if (!confirm("确定要取消这个预约吗？")) return;

  try {
    const response = await apiRequest(`/api/orders/${orderId}/cancel`, {
      method: "POST",
    });

    // 更新本地数据
    const orderIndex = orders.findIndex((orderData) => {
      const order = orderData.order || orderData;
      return order.id === orderId;
    });

    if (orderIndex !== -1) {
      if (orders[orderIndex].order) {
        // 详细数据结构
        orders[orderIndex].order.status = "cancelled";
        orders[orderIndex].order.cancelledAt = new Date().toISOString();
      } else {
        // 简单数据结构
        orders[orderIndex].status = "cancelled";
        orders[orderIndex].cancelledAt = new Date().toISOString();
      }
    }

    // 刷新显示
    renderOrdersList();

    showMessage("预约取消成功", "success");
  } catch (error) {
    console.error("取消预约失败:", error);
    showMessage("取消预约失败，请重试", "error");
  }
}

// 初始化系统设置
async function initSystemSettings() {
  // 更新显示的统计信息
  document.getElementById("studentCount").textContent = students.length;
  document.getElementById("productCount").textContent = products.length;
  document.getElementById("pendingOrderCount").textContent = orders.filter(
    (o) => o.status === "pending",
  ).length;
  document.getElementById("currentModeDisplay").textContent =
    currentMode === "class" ? "上课模式" : "平时模式";

  // 加载系统配置
  await loadSystemConfig();
}

// 导出数据
function exportData() {
  const data = {
    students: students,
    products: products,
    orders: orders,
    exportTime: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `classroom-points-data-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showMessage("数据导出成功", "success");
}

// 备份数据
async function backupData() {
  try {
    await apiRequest("/api/config/backup", {
      method: "POST",
    });

    showMessage("数据备份成功", "success");
  } catch (error) {
    console.error("备份数据失败:", error);
    showMessage("备份数据失败，请重试", "error");
  }
}

// 显示重置确认
function showResetConfirm() {
  const confirmed = confirm(
    "警告：此操作将重置所有学生的积分为0，且无法撤销。确定要继续吗？",
  );
  if (confirmed) {
    const doubleConfirmed = confirm("请再次确认：您真的要重置所有积分吗？");
    if (doubleConfirmed) {
      resetAllPoints();
    }
  }
}

// 重置所有积分
async function resetAllPoints() {
  try {
    await apiRequest("/api/config/reset-points", {
      method: "POST",
    });

    // 更新本地数据
    students.forEach((student) => {
      student.balance = 0;
    });

    // 刷新显示
    if (document.getElementById("studentList")) {
      renderStudentList();
    }

    showMessage("积分重置成功", "success");
  } catch (error) {
    console.error("重置积分失败:", error);
    showMessage("重置积分失败，请重试", "error");
  }
}

// 加载系统配置
async function loadSystemConfig() {
  try {
    const response = await apiRequest("/api/config");
    const config = response.data;

    // 填充配置表单
    document.getElementById("autoRefreshInterval").value =
      config.autoRefreshInterval || 30;
    document.getElementById("maxPointsPerOperation").value =
      config.maxPointsPerOperation || 100;
    document.getElementById("pointsResetEnabled").checked =
      config.pointsResetEnabled || false;
    document.getElementById("className").value = config.className || "花儿起舞";
    document.getElementById("author").value = config.author || "茗雨";
    document.getElementById("copyright").value =
      config.copyright || "© 2025 花儿起舞班级积分管理系统 | 作者：茗雨";

    // 设置学期开始日期
    if (config.semesterStartDate) {
      const date = new Date(config.semesterStartDate);
      document.getElementById("semesterStartDate").value = date
        .toISOString()
        .split("T")[0];
    }

    // 更新系统信息显示
    const currentClassNameElement = document.getElementById("currentClassName");
    const currentAuthorElement = document.getElementById("currentAuthor");
    if (currentClassNameElement) {
      currentClassNameElement.textContent = config.className || "花儿起舞";
    }
    if (currentAuthorElement) {
      currentAuthorElement.textContent = config.author || "茗雨";
    }

    // 更新重置按钮状态
    const resetBtn = document.getElementById("resetPointsBtn");
    if (resetBtn) {
      resetBtn.disabled = !config.pointsResetEnabled;
    }

    // 更新最后更新时间
    const lastUpdateElement = document.getElementById("lastUpdateTime");
    if (lastUpdateElement) {
      lastUpdateElement.textContent = formatDate(new Date().toISOString());
    }
  } catch (error) {
    console.error("加载系统配置失败:", error);
    showMessage("加载系统配置失败", "warning");
  }
}

// 保存系统配置
async function saveSystemConfig(event) {
  event.preventDefault();

  const autoRefreshInterval = parseInt(
    document.getElementById("autoRefreshInterval").value,
  );
  const maxPointsPerOperation = parseInt(
    document.getElementById("maxPointsPerOperation").value,
  );
  const pointsResetEnabled =
    document.getElementById("pointsResetEnabled").checked;
  const semesterStartDate = document.getElementById("semesterStartDate").value;
  const className = document.getElementById("className").value.trim();
  const author = document.getElementById("author").value.trim();
  const copyright = document.getElementById("copyright").value.trim();

  // 参数验证
  if (autoRefreshInterval < 5 || autoRefreshInterval > 300) {
    showMessage("自动刷新间隔必须在5-300秒之间", "warning");
    return;
  }

  if (maxPointsPerOperation < 1 || maxPointsPerOperation > 1000) {
    showMessage("单次操作最大积分必须在1-1000之间", "warning");
    return;
  }

  if (!semesterStartDate) {
    showMessage("请选择学期开始日期", "warning");
    return;
  }

  if (!className) {
    showMessage("班级名称不能为空", "warning");
    return;
  }

  if (!author) {
    showMessage("作者名称不能为空", "warning");
    return;
  }

  if (!copyright) {
    showMessage("版权信息不能为空", "warning");
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
      copyright: copyright,
    };

    await apiRequest("/api/config", {
      method: "PUT",
      body: JSON.stringify(configData),
    });

    // 更新重置按钮状态
    const resetBtn = document.getElementById("resetPointsBtn");
    if (resetBtn) {
      resetBtn.disabled = !pointsResetEnabled;
    }

    // 更新最后更新时间
    const lastUpdateElement = document.getElementById("lastUpdateTime");
    if (lastUpdateElement) {
      lastUpdateElement.textContent = formatDate(new Date().toISOString());
    }

    // 更新系统信息显示
    const currentClassNameElement = document.getElementById("currentClassName");
    const currentAuthorElement = document.getElementById("currentAuthor");
    if (currentClassNameElement) {
      currentClassNameElement.textContent = className;
    }
    if (currentAuthorElement) {
      currentAuthorElement.textContent = author;
    }

    // 保存到本地存储，供其他页面使用
    storage.set("systemClassName", className);
    storage.set("systemAuthor", author);
    storage.set("systemCopyright", copyright);

    showMessage("系统配置保存成功", "success");
  } catch (error) {
    console.error("保存系统配置失败:", error);
    showMessage("保存系统配置失败，请重试", "error");
  }
}

// 重置配置表单
async function resetConfigForm() {
  if (confirm("确定要重置配置表单吗？这将恢复到当前保存的配置。")) {
    await loadSystemConfig();
    showMessage("配置表单已重置", "info");
  }
}

// === 备份管理功能 ===

// 创建系统备份
async function createBackup() {
  try {
    showMessage("正在创建系统备份...", "info");

    const response = await apiRequest("/api/backup/create", {
      method: "POST",
    });

    showMessage("系统备份创建成功", "success");

    // 如果备份管理器是打开的，刷新列表
    if (
      document.getElementById("backupManagerSection").style.display !== "none"
    ) {
      refreshBackupList();
    }
  } catch (error) {
    console.error("创建备份失败:", error);
    showMessage("创建备份失败，请重试", "error");
  }
}

// 显示备份管理器
async function showBackupManager() {
  const section = document.getElementById("backupManagerSection");
  const isVisible = section.style.display !== "none";

  if (isVisible) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  await refreshBackupList();
  await loadDataStatistics();
}

// 刷新备份列表
async function refreshBackupList() {
  const container = document.getElementById("backupList");
  container.innerHTML = '<div class="loading">正在加载备份列表...</div>';

  try {
    const response = await apiRequest("/api/backup/list");
    const backups = response.backups || [];

    if (backups.length === 0) {
      container.innerHTML = '<div class="no-data">暂无备份文件</div>';
      return;
    }

    container.innerHTML = `
            <div class="backup-list-header flex items-center text-brand-500 font-bold mb-3 pb-2 border-b-2 border-brand-200 uppercase tracking-wider text-xs px-2">
                <span class="flex-1">文件名</span>
                <span class="w-20 sm:w-24">大小</span>
                <span class="hidden sm:block w-40">创建时间</span>
                <span class="w-32 text-right">操作</span>
            </div>
            ${backups
              .map(
                (backup) => `
                <div class="backup-item p-3 mb-2 rounded-xl bg-white border-2 border-brand-100 hover:border-brand-300 hover:shadow-sm transition-all flex items-center justify-between group">
                    <div class="backup-filename flex-1 font-bold text-brand-900 truncate pr-2 sm:pr-4 group-hover:text-brand-600 transition-colors text-sm sm:text-base">${backup.filename}</div>
                    <div class="backup-size w-20 sm:w-24 font-mono font-bold text-brand-500 text-xs sm:text-sm">${backup.sizeFormatted}</div>
                    <div class="backup-date hidden sm:block w-40 font-mono text-xs text-brand-400 font-bold">${formatDate(backup.created)}</div>
                    <div class="backup-actions w-32 flex gap-2 justify-end">
                        <button onclick="downloadBackup('${backup.filename}')" class="px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg bg-white border-2 border-brand-200 hover:bg-brand-50 hover:border-brand-300 text-brand-700 transition-all shadow-sm">下载</button>
                        <button onclick="deleteBackup('${backup.filename}')" class="px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg bg-red-50 border-2 border-red-200 hover:bg-red-100 text-red-600 transition-all shadow-sm">删除</button>
                    </div>
                </div>
            `,
              )
              .join("")}
        `;
  } catch (error) {
    console.error("加载备份列表失败:", error);
    container.innerHTML =
      '<div class="text-red-500 font-bold text-center py-4">加载备份列表失败</div>';
  }
}

// 下载备份文件
function downloadBackup(filename) {
  const link = document.createElement("a");
  link.href = `/api/backup/download/${filename}`;
  link.download = filename;
  link.click();

  showMessage("备份文件下载开始", "success");
}

// 删除备份文件
async function deleteBackup(filename) {
  if (!confirm(`确定要删除备份文件 "${filename}" 吗？`)) return;

  try {
    await apiRequest(`/api/backup/${filename}`, {
      method: "DELETE",
    });

    showMessage("备份文件删除成功", "success");
    refreshBackupList();
  } catch (error) {
    console.error("删除备份文件失败:", error);
    showMessage("删除备份文件失败，请重试", "error");
  }
}

// 处理恢复文件选择
async function handleRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith(".zip")) {
    showMessage("请选择ZIP格式的备份文件", "warning");
    return;
  }

  const confirmed = confirm(
    `确定要从备份文件 "${file.name}" 恢复系统吗？\n\n警告：此操作将覆盖当前所有数据，建议先创建当前数据的备份。`,
  );
  if (!confirmed) return;

  try {
    showMessage("正在恢复系统，请稍候...", "info");

    const formData = new FormData();
    formData.append("backupFile", file);

    const response = await fetch("/api/backup/restore", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showMessage("系统恢复成功，页面将自动刷新", "success");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } else {
      throw new Error(result.message || "恢复失败");
    }
  } catch (error) {
    console.error("系统恢复失败:", error);
    showMessage("系统恢复失败：" + error.message, "error");
  } finally {
    // 清空文件输入
    event.target.value = "";
  }
}

// 清理旧备份
async function cleanOldBackups() {
  const keepCount = prompt("请输入要保留的备份文件数量（默认10个）:", "10");
  if (keepCount === null) return;

  const count = parseInt(keepCount);
  if (isNaN(count) || count < 1) {
    showMessage("请输入有效的数量", "warning");
    return;
  }

  try {
    const response = await apiRequest("/api/backup/cleanup", {
      method: "POST",
      body: JSON.stringify({ keepCount: count }),
    });

    showMessage(
      `清理完成，删除了${response.deletedCount}个旧备份文件`,
      "success",
    );
    refreshBackupList();
  } catch (error) {
    console.error("清理备份失败:", error);
    showMessage("清理备份失败，请重试", "error");
  }
}

// 导出单个数据文件
async function exportSingleData(dataType) {
  try {
    showMessage(`正在导出${getDataTypeName(dataType)}...`, "info");

    const response = await apiRequest(`/api/backup/export/${dataType}`, {
      method: "POST",
    });

    // 下载导出的文件
    const link = document.createElement("a");
    link.href = `/api/backup/download/${response.filename}`;
    link.download = response.filename;
    link.click();

    showMessage(`${getDataTypeName(dataType)}导出成功`, "success");
  } catch (error) {
    console.error("导出数据失败:", error);
    showMessage("导出数据失败，请重试", "error");
  }
}

// 导入单个数据文件
async function importSingleData(dataType, event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith(".json")) {
    showMessage("请选择JSON格式的数据文件", "warning");
    return;
  }

  const confirmed = confirm(
    `确定要导入${getDataTypeName(dataType)}吗？\n\n警告：此操作将覆盖当前的${getDataTypeName(dataType)}，建议先创建备份。`,
  );
  if (!confirmed) return;

  try {
    showMessage(`正在导入${getDataTypeName(dataType)}...`, "info");

    const formData = new FormData();
    formData.append("dataFile", file);

    const response = await fetch(`/api/backup/import/${dataType}`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showMessage(`${getDataTypeName(dataType)}导入成功`, "success");

      // 刷新相关数据
      await loadInitialData();

      // 根据当前标签页刷新显示
      const activeTab = document.querySelector(".tab-button.active");
      if (activeTab) {
        const tabName = activeTab.textContent.includes("积分")
          ? "points"
          : activeTab.textContent.includes("商品")
            ? "products"
            : activeTab.textContent.includes("预约")
              ? "orders"
              : "system";
        switchTab(tabName);
      }
    } else {
      throw new Error(result.message || "导入失败");
    }
  } catch (error) {
    console.error("导入数据失败:", error);
    showMessage("导入数据失败：" + error.message, "error");
  } finally {
    // 清空文件输入
    event.target.value = "";
  }
}

// 加载数据统计信息
async function loadDataStatistics() {
  const container = document.getElementById("dataStatistics");
  const statsDiv =
    container.querySelector(".stats-loading") ||
    container.querySelector(".stats-content");

  if (statsDiv) {
    statsDiv.innerHTML = "正在加载统计信息...";
  }

  try {
    const response = await apiRequest("/api/backup/statistics");
    const stats = response.statistics || {};

    const statsHtml = `
            <div class="stats-content">
                ${Object.entries(stats)
                  .map(
                    ([filename, stat]) => `
                    <div class="stat-item">
                        <div class="stat-name">${getDataTypeName(filename.replace(".json", ""))}</div>
                        <div class="stat-details">
                            记录数: ${stat.recordCount} | 
                            文件大小: ${formatFileSize(stat.size)} | 
                            最后修改: ${formatDate(stat.modified)}
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;

    if (statsDiv) {
      statsDiv.outerHTML = statsHtml;
    } else {
      container.innerHTML = `<h4>数据统计</h4>${statsHtml}`;
    }
  } catch (error) {
    console.error("加载数据统计失败:", error);
    if (statsDiv) {
      statsDiv.innerHTML = "加载统计信息失败";
    }
  }
}

// 获取数据类型中文名称
function getDataTypeName(dataType) {
  const typeNames = {
    students: "学生数据",
    points: "积分记录",
    products: "商品数据",
    orders: "预约订单",
    config: "系统配置",
  };
  return typeNames[dataType] || dataType;
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
//
显示需要登录的状态界面;
function showLoginRequiredState() {
  const container = document.getElementById("teacherContent");
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
    if (typeof showTeacherLogin === "function") {
      showTeacherLogin();
    }
  }, 1000);
}

// 禁用所有控件
function disableAllControls() {
  // 禁用模式切换按钮
  const modeToggle = document.getElementById("modeToggle");
  if (modeToggle) {
    modeToggle.disabled = true;
    modeToggle.style.opacity = "0.5";
    modeToggle.style.cursor = "not-allowed";
  }

  // 禁用所有标签按钮
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.disabled = true;
    btn.style.opacity = "0.5";
    btn.style.cursor = "not-allowed";
  });

  // 禁用所有表单元素
  document
    .querySelectorAll("input, button, select, textarea")
    .forEach((element) => {
      if (
        !element.classList.contains("login-btn") &&
        !element.classList.contains("login-again-btn") &&
        !element.id.includes("teacher")
      ) {
        element.disabled = true;
        element.style.opacity = "0.5";
      }
    });
}

// 启用所有控件
function enableAllControls() {
  // 启用模式切换按钮
  const modeToggle = document.getElementById("modeToggle");
  if (modeToggle) {
    modeToggle.disabled = false;
    modeToggle.style.opacity = "1";
    modeToggle.style.cursor = "pointer";
  }

  // 启用所有标签按钮
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.style.cursor = "pointer";
  });

  // 启用所有表单元素
  document
    .querySelectorAll("input, button, select, textarea")
    .forEach((element) => {
      element.disabled = false;
      element.style.opacity = "1";
    });
}
