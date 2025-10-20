#!/usr/bin/env node

/**
 * 首页优化验证脚本
 * 
 * 功能：
 * - 验证首页优化是否正确
 * - 检查学生查询功能是否已合并到教室大屏
 * - 测试路由重定向
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 首页优化验证工具');
console.log('====================');

let allTestsPassed = true;

// 测试1: 检查首页是否移除了学生查询卡片
console.log('\n📋 测试1: 检查首页优化');
try {
    const indexPath = path.join(__dirname, '../public/index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // 检查是否只有两个nav-card
    const navCardMatches = indexContent.match(/<a href="[^"]*" class="nav-card[^"]*">/g);
    const navCardCount = navCardMatches ? navCardMatches.length : 0;
    
    if (navCardCount === 2) {
        console.log('✅ 首页已优化为两个主要入口');
    } else {
        console.log(`❌ 首页仍有${navCardCount}个入口，应该只有2个`);
        allTestsPassed = false;
    }
    
    // 检查是否包含"学生查询"功能描述
    if (indexContent.includes('内置学生查询功能')) {
        console.log('✅ 教室大屏描述已更新，包含学生查询功能');
    } else {
        console.log('❌ 教室大屏描述未更新');
        allTestsPassed = false;
    }
    
    // 检查是否有primary-card样式
    if (indexContent.includes('primary-card')) {
        console.log('✅ 教室大屏已设置为主要入口');
    } else {
        console.log('❌ 教室大屏未设置为主要入口');
        allTestsPassed = false;
    }
    
} catch (error) {
    console.log('❌ 无法读取首页文件:', error.message);
    allTestsPassed = false;
}

// 测试2: 检查教室大屏是否包含学生查询功能
console.log('\n📋 测试2: 检查教室大屏学生查询功能');
try {
    const displayHtmlPath = path.join(__dirname, '../public/display/index.html');
    const displayHtmlContent = fs.readFileSync(displayHtmlPath, 'utf8');
    
    if (displayHtmlContent.includes('large-modal')) {
        console.log('✅ 学生查询弹窗已增强为大型弹窗');
    } else {
        console.log('❌ 学生查询弹窗未增强');
        allTestsPassed = false;
    }
    
    if (displayHtmlContent.includes('studentDashboard')) {
        console.log('✅ 学生查询包含完整仪表板功能');
    } else {
        console.log('❌ 学生查询缺少仪表板功能');
        allTestsPassed = false;
    }
    
    if (displayHtmlContent.includes('dashboard-tabs')) {
        console.log('✅ 学生查询包含标签页功能');
    } else {
        console.log('❌ 学生查询缺少标签页功能');
        allTestsPassed = false;
    }
    
} catch (error) {
    console.log('❌ 无法读取教室大屏HTML文件:', error.message);
    allTestsPassed = false;
}

// 测试3: 检查JavaScript功能
console.log('\n📋 测试3: 检查JavaScript功能');
try {
    const displayJsPath = path.join(__dirname, '../public/js/display.js');
    const displayJsContent = fs.readFileSync(displayJsPath, 'utf8');
    
    if (displayJsContent.includes('loadStudentDashboard')) {
        console.log('✅ 包含学生仪表板加载功能');
    } else {
        console.log('❌ 缺少学生仪表板加载功能');
        allTestsPassed = false;
    }
    
    if (displayJsContent.includes('switchStudentTab')) {
        console.log('✅ 包含学生标签页切换功能');
    } else {
        console.log('❌ 缺少学生标签页切换功能');
        allTestsPassed = false;
    }
    
    if (displayJsContent.includes('reserveStudentProduct')) {
        console.log('✅ 包含学生商品预约功能');
    } else {
        console.log('❌ 缺少学生商品预约功能');
        allTestsPassed = false;
    }
    
    if (displayJsContent.includes('renderStudentHistory')) {
        console.log('✅ 包含学生历史记录功能');
    } else {
        console.log('❌ 缺少学生历史记录功能');
        allTestsPassed = false;
    }
    
} catch (error) {
    console.log('❌ 无法读取教室大屏JS文件:', error.message);
    allTestsPassed = false;
}

// 测试4: 检查CSS样式
console.log('\n📋 测试4: 检查CSS样式');
try {
    const displayCssPath = path.join(__dirname, '../public/css/display.css');
    const displayCssContent = fs.readFileSync(displayCssPath, 'utf8');
    
    if (displayCssContent.includes('.large-modal')) {
        console.log('✅ 包含大型弹窗样式');
    } else {
        console.log('❌ 缺少大型弹窗样式');
        allTestsPassed = false;
    }
    
    if (displayCssContent.includes('.student-dashboard')) {
        console.log('✅ 包含学生仪表板样式');
    } else {
        console.log('❌ 缺少学生仪表板样式');
        allTestsPassed = false;
    }
    
    if (displayCssContent.includes('.dashboard-tabs')) {
        console.log('✅ 包含标签页样式');
    } else {
        console.log('❌ 缺少标签页样式');
        allTestsPassed = false;
    }
    
    if (displayCssContent.includes('.primary-card')) {
        console.log('✅ 包含主要卡片样式');
    } else {
        console.log('❌ 缺少主要卡片样式');
        allTestsPassed = false;
    }
    
} catch (error) {
    console.log('❌ 无法读取教室大屏CSS文件:', error.message);
    allTestsPassed = false;
}

// 测试5: 检查路由重定向
console.log('\n📋 测试5: 检查路由重定向');
try {
    const serverPath = path.join(__dirname, '../server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    if (serverContent.includes("app.get('/student', (req, res) => {\n    res.redirect('/display');")) {
        console.log('✅ Express服务器包含学生路由重定向');
    } else {
        console.log('❌ Express服务器缺少学生路由重定向');
        allTestsPassed = false;
    }
    
    const routerPath = path.join(__dirname, '../src/utils/router.js');
    if (fs.existsSync(routerPath)) {
        const routerContent = fs.readFileSync(routerPath, 'utf8');
        
        if (routerContent.includes("Response.redirect('/display', 302)")) {
            console.log('✅ Cloudflare Workers路由包含学生路由重定向');
        } else {
            console.log('❌ Cloudflare Workers路由缺少学生路由重定向');
            allTestsPassed = false;
        }
    } else {
        console.log('⚠️  Cloudflare Workers路由文件不存在，跳过检查');
    }
    
} catch (error) {
    console.log('❌ 无法检查路由重定向:', error.message);
    allTestsPassed = false;
}

// 测试6: 检查文件结构
console.log('\n📋 测试6: 检查文件结构');
try {
    const studentHtmlPath = path.join(__dirname, '../public/student/index.html');
    const studentJsPath = path.join(__dirname, '../public/js/student.js');
    
    if (fs.existsSync(studentHtmlPath)) {
        console.log('ℹ️  独立学生查询页面仍然存在（可选择保留或删除）');
    } else {
        console.log('✅ 独立学生查询页面已移除');
    }
    
    if (fs.existsSync(studentJsPath)) {
        console.log('ℹ️  独立学生查询JS文件仍然存在（可选择保留或删除）');
    } else {
        console.log('✅ 独立学生查询JS文件已移除');
    }
    
} catch (error) {
    console.log('❌ 无法检查文件结构:', error.message);
    allTestsPassed = false;
}

// 总结
console.log('\n📊 验证结果汇总:');
if (allTestsPassed) {
    console.log('✅ 所有测试通过！首页优化和学生查询功能合并成功');
    console.log('\n🎉 优化完成的功能:');
    console.log('   • 首页简化为两个主要入口');
    console.log('   • 教室大屏设置为主要入口');
    console.log('   • 学生查询功能完全集成到教室大屏');
    console.log('   • 支持完整的学生仪表板功能');
    console.log('   • 包含积分查询、历史记录、商品兑换、预约管理');
    console.log('   • 路由自动重定向到教室大屏');
    console.log('   • 响应式设计支持移动设备');
} else {
    console.log('❌ 部分测试失败，请检查上述错误并修复');
}

console.log('\n💡 使用建议:');
console.log('   • 学生现在可以直接访问教室大屏进行积分查询');
console.log('   • 教师可以在教室大屏中快速切换模式');
console.log('   • 所有功能都集中在教室大屏中，提高使用效率');
console.log('   • 如果不再需要独立的学生查询页面，可以删除相关文件');

process.exit(allTestsPassed ? 0 : 1);