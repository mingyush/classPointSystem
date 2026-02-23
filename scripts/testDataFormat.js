#!/usr/bin/env node

/**
 * 测试SQLite数据格式转换修复
 */

const DataAccess = require('../utils/dataAccess');
const StudentService = require('../services/studentService');

async function testDataFormat() {
    console.log('🔍 测试SQLite数据格式转换...\n');
    
    try {
        // 测试DataAccess直接读取
        console.log('1. 测试DataAccess直接读取students.json:');
        const dataAccess = new DataAccess();
        const studentsData = await dataAccess.readFile('students.json', { students: [] });
        console.log('   数据结构:', typeof studentsData);
        console.log('   是否有students属性:', 'students' in studentsData);
        console.log('   students数组长度:', studentsData.students ? studentsData.students.length : 'undefined');
        
        if (studentsData.students && studentsData.students.length > 0) {
            console.log('   第一个学生:', studentsData.students[0]);
        }
        
        console.log('\n2. 测试StudentService.getAllStudents():');
        const studentService = new StudentService();
        const students = await studentService.getAllStudents();
        console.log('   返回的学生数量:', students.length);
        
        if (students.length > 0) {
            console.log('   第一个学生对象:', students[0]);
            console.log('   学生对象类型:', students[0].constructor.name);
        }
        
        console.log('\n✅ 数据格式测试完成');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
        console.error('错误堆栈:', error.stack);
    }
}

// 运行测试
testDataFormat().then(() => {
    console.log('\n测试结束');
    process.exit(0);
}).catch(error => {
    console.error('测试异常:', error);
    process.exit(1);
});