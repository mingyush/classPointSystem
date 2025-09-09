// 表单验证和实时反馈系统

class FormValidator {
    constructor() {
        this.validators = new Map();
        this.validationRules = new Map();
        this.setupDefaultRules();
        this.setupGlobalValidation();
    }

    // 设置默认验证规则
    setupDefaultRules() {
        // 学号验证
        this.addRule('studentId', {
            required: true,
            pattern: /^\d{6,10}$/,
            message: '学号必须是6-10位数字'
        });

        // 姓名验证
        this.addRule('studentName', {
            required: true,
            minLength: 2,
            maxLength: 10,
            pattern: /^[\u4e00-\u9fa5a-zA-Z\s]+$/,
            message: '姓名必须是2-10个字符，只能包含中文、英文和空格'
        });

        // 积分验证
        this.addRule('points', {
            required: true,
            type: 'number',
            min: 1,
            max: 1000,
            message: '积分必须是1-1000之间的数字'
        });

        // 商品名称验证
        this.addRule('productName', {
            required: true,
            minLength: 1,
            maxLength: 50,
            message: '商品名称必须是1-50个字符'
        });

        // 商品价格验证
        this.addRule('productPrice', {
            required: true,
            type: 'number',
            min: 1,
            max: 10000,
            message: '商品价格必须是1-10000之间的数字'
        });

        // 库存验证
        this.addRule('productStock', {
            required: true,
            type: 'number',
            min: 0,
            max: 9999,
            message: '库存数量必须是0-9999之间的数字'
        });

        // 原因验证
        this.addRule('reason', {
            required: true,
            minLength: 2,
            maxLength: 100,
            message: '操作原因必须是2-100个字符'
        });

        // 密码验证
        this.addRule('password', {
            required: true,
            minLength: 6,
            maxLength: 20,
            message: '密码必须是6-20个字符'
        });

        // 邮箱验证
        this.addRule('email', {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: '请输入有效的邮箱地址'
        });

        // 手机号验证
        this.addRule('phone', {
            pattern: /^1[3-9]\d{9}$/,
            message: '请输入有效的手机号码'
        });
    }

    // 设置全局表单验证
    setupGlobalValidation() {
        // 监听所有表单提交
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (form.tagName === 'FORM' && !form.hasAttribute('novalidate')) {
                if (!this.validateForm(form)) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        });

        // 监听输入字段的实时验证
        document.addEventListener('input', (event) => {
            const field = event.target;
            if (this.shouldValidateField(field)) {
                this.validateField(field, { showSuccess: false });
            }
        });

        // 监听字段失去焦点时的验证
        document.addEventListener('blur', (event) => {
            const field = event.target;
            if (this.shouldValidateField(field)) {
                this.validateField(field, { showSuccess: true });
            }
        }, true);

        // 监听字段获得焦点时清除错误状态
        document.addEventListener('focus', (event) => {
            const field = event.target;
            if (this.shouldValidateField(field)) {
                this.clearFieldError(field);
            }
        }, true);
    }

    // 判断是否应该验证字段
    shouldValidateField(field) {
        return field.tagName === 'INPUT' || field.tagName === 'TEXTAREA' || field.tagName === 'SELECT';
    }

    // 添加验证规则
    addRule(name, rule) {
        this.validationRules.set(name, rule);
    }

    // 获取验证规则
    getRule(name) {
        return this.validationRules.get(name);
    }

    // 验证表单
    validateForm(form) {
        let isValid = true;
        const fields = form.querySelectorAll('input, textarea, select');
        const errors = [];

        fields.forEach(field => {
            const fieldValid = this.validateField(field, { showSuccess: false });
            if (!fieldValid) {
                isValid = false;
                errors.push({
                    field: field.name || field.id,
                    message: this.getFieldErrorMessage(field)
                });
            }
        });

        // 显示表单级别的错误摘要
        if (!isValid) {
            this.showFormErrors(form, errors);
        } else {
            this.clearFormErrors(form);
        }

        return isValid;
    }

    // 验证单个字段
    validateField(field, options = {}) {
        const { showSuccess = true, showError = true } = options;
        
        // 获取字段的验证规则
        const rules = this.getFieldRules(field);
        if (!rules || rules.length === 0) {
            return true;
        }

        // 执行验证
        const value = this.getFieldValue(field);
        const validationResult = this.executeValidation(value, rules, field);

        // 更新字段状态
        if (validationResult.isValid) {
            if (showSuccess) {
                this.showFieldSuccess(field);
            } else {
                this.clearFieldError(field);
            }
            return true;
        } else {
            if (showError) {
                this.showFieldError(field, validationResult.message);
            }
            return false;
        }
    }

    // 获取字段的验证规则
    getFieldRules(field) {
        const rules = [];

        // 从data-validate属性获取规则
        const validateAttr = field.getAttribute('data-validate');
        if (validateAttr) {
            const ruleNames = validateAttr.split(',').map(name => name.trim());
            ruleNames.forEach(ruleName => {
                const rule = this.getRule(ruleName);
                if (rule) {
                    rules.push(rule);
                }
            });
        }

        // 从字段名称获取默认规则
        const fieldName = field.name || field.id;
        const defaultRule = this.getRule(fieldName);
        if (defaultRule && !rules.some(r => r === defaultRule)) {
            rules.push(defaultRule);
        }

        // 从HTML5属性获取规则
        const html5Rules = this.extractHTML5Rules(field);
        rules.push(...html5Rules);

        return rules;
    }

    // 提取HTML5验证规则
    extractHTML5Rules(field) {
        const rules = [];

        // required属性
        if (field.hasAttribute('required')) {
            rules.push({
                required: true,
                message: '此字段为必填项'
            });
        }

        // pattern属性
        const pattern = field.getAttribute('pattern');
        if (pattern) {
            rules.push({
                pattern: new RegExp(pattern),
                message: field.getAttribute('title') || '格式不正确'
            });
        }

        // min/max属性
        const min = field.getAttribute('min');
        const max = field.getAttribute('max');
        if (min !== null || max !== null) {
            const rule = { type: 'number' };
            if (min !== null) rule.min = parseFloat(min);
            if (max !== null) rule.max = parseFloat(max);
            rule.message = `数值必须在${min || ''}${min && max ? '-' : ''}${max || ''}范围内`;
            rules.push(rule);
        }

        // minlength/maxlength属性
        const minLength = field.getAttribute('minlength');
        const maxLength = field.getAttribute('maxlength');
        if (minLength !== null || maxLength !== null) {
            const rule = {};
            if (minLength !== null) rule.minLength = parseInt(minLength);
            if (maxLength !== null) rule.maxLength = parseInt(maxLength);
            rule.message = `长度必须在${minLength || ''}${minLength && maxLength ? '-' : ''}${maxLength || ''}字符之间`;
            rules.push(rule);
        }

        // type属性
        const type = field.getAttribute('type');
        if (type === 'email') {
            rules.push({
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: '请输入有效的邮箱地址'
            });
        } else if (type === 'url') {
            rules.push({
                pattern: /^https?:\/\/.+/,
                message: '请输入有效的URL地址'
            });
        } else if (type === 'tel') {
            rules.push({
                pattern: /^1[3-9]\d{9}$/,
                message: '请输入有效的手机号码'
            });
        }

        return rules;
    }

    // 获取字段值
    getFieldValue(field) {
        if (field.type === 'checkbox') {
            return field.checked;
        } else if (field.type === 'radio') {
            const form = field.closest('form');
            const radioGroup = form ? form.querySelectorAll(`input[name="${field.name}"]`) : [field];
            const checked = Array.from(radioGroup).find(radio => radio.checked);
            return checked ? checked.value : '';
        } else {
            return field.value.trim();
        }
    }

    // 执行验证
    executeValidation(value, rules, field) {
        for (const rule of rules) {
            const result = this.validateAgainstRule(value, rule, field);
            if (!result.isValid) {
                return result;
            }
        }
        return { isValid: true };
    }

    // 根据规则验证值
    validateAgainstRule(value, rule, field) {
        // 必填验证
        if (rule.required && (!value || value === '')) {
            return {
                isValid: false,
                message: rule.message || '此字段为必填项'
            };
        }

        // 如果值为空且不是必填，跳过其他验证
        if (!value || value === '') {
            return { isValid: true };
        }

        // 类型验证
        if (rule.type === 'number') {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return {
                    isValid: false,
                    message: rule.message || '必须是有效的数字'
                };
            }

            // 数值范围验证
            if (rule.min !== undefined && numValue < rule.min) {
                return {
                    isValid: false,
                    message: rule.message || `数值不能小于${rule.min}`
                };
            }
            if (rule.max !== undefined && numValue > rule.max) {
                return {
                    isValid: false,
                    message: rule.message || `数值不能大于${rule.max}`
                };
            }
        }

        // 长度验证
        if (rule.minLength !== undefined && value.length < rule.minLength) {
            return {
                isValid: false,
                message: rule.message || `长度不能少于${rule.minLength}个字符`
            };
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
            return {
                isValid: false,
                message: rule.message || `长度不能超过${rule.maxLength}个字符`
            };
        }

        // 正则表达式验证
        if (rule.pattern && !rule.pattern.test(value)) {
            return {
                isValid: false,
                message: rule.message || '格式不正确'
            };
        }

        // 自定义验证函数
        if (rule.validator && typeof rule.validator === 'function') {
            const result = rule.validator(value, field);
            if (result !== true) {
                return {
                    isValid: false,
                    message: typeof result === 'string' ? result : rule.message || '验证失败'
                };
            }
        }

        return { isValid: true };
    }

    // 显示字段错误
    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('error-field');
        field.setAttribute('aria-invalid', 'true');

        // 创建错误消息元素
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error-message';
        errorElement.textContent = message;
        errorElement.setAttribute('role', 'alert');
        errorElement.setAttribute('aria-live', 'polite');

        // 插入错误消息
        const container = this.getFieldContainer(field);
        container.appendChild(errorElement);

        // 设置字段的aria-describedby属性
        const errorId = `error-${field.name || field.id || Date.now()}`;
        errorElement.id = errorId;
        field.setAttribute('aria-describedby', errorId);
    }

    // 显示字段成功状态
    showFieldSuccess(field) {
        this.clearFieldError(field);
        
        field.classList.add('success-field');
        field.setAttribute('aria-invalid', 'false');

        // 创建成功图标
        const successElement = document.createElement('div');
        successElement.className = 'field-success-icon';
        successElement.innerHTML = '✓';
        successElement.setAttribute('aria-hidden', 'true');

        // 插入成功图标
        const container = this.getFieldContainer(field);
        container.appendChild(successElement);

        // 3秒后移除成功状态
        setTimeout(() => {
            field.classList.remove('success-field');
            const successIcon = container.querySelector('.field-success-icon');
            if (successIcon) {
                successIcon.remove();
            }
        }, 3000);
    }

    // 清除字段错误
    clearFieldError(field) {
        field.classList.remove('error-field', 'success-field');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');

        const container = this.getFieldContainer(field);
        const errorMessage = container.querySelector('.field-error-message');
        const successIcon = container.querySelector('.field-success-icon');
        
        if (errorMessage) {
            errorMessage.remove();
        }
        if (successIcon) {
            successIcon.remove();
        }
    }

    // 获取字段容器
    getFieldContainer(field) {
        // 查找最近的表单组容器
        let container = field.closest('.form-group, .input-group, .field-container');
        if (!container) {
            // 如果没有找到容器，创建一个
            container = document.createElement('div');
            container.className = 'field-container';
            field.parentNode.insertBefore(container, field);
            container.appendChild(field);
        }
        return container;
    }

    // 获取字段错误消息
    getFieldErrorMessage(field) {
        const container = this.getFieldContainer(field);
        const errorMessage = container.querySelector('.field-error-message');
        return errorMessage ? errorMessage.textContent : '';
    }

    // 显示表单错误摘要
    showFormErrors(form, errors) {
        this.clearFormErrors(form);

        const errorSummary = document.createElement('div');
        errorSummary.className = 'form-error-summary';
        errorSummary.setAttribute('role', 'alert');
        errorSummary.setAttribute('aria-live', 'polite');

        const title = document.createElement('h4');
        title.textContent = '请修正以下错误：';
        errorSummary.appendChild(title);

        const errorList = document.createElement('ul');
        errors.forEach(error => {
            const listItem = document.createElement('li');
            listItem.textContent = error.message;
            errorList.appendChild(listItem);
        });
        errorSummary.appendChild(errorList);

        // 插入到表单顶部
        form.insertBefore(errorSummary, form.firstChild);

        // 滚动到错误摘要
        errorSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 清除表单错误摘要
    clearFormErrors(form) {
        const errorSummary = form.querySelector('.form-error-summary');
        if (errorSummary) {
            errorSummary.remove();
        }
    }

    // 添加自定义验证器
    addCustomValidator(name, validator) {
        this.validators.set(name, validator);
    }

    // 验证特定字段
    validateSpecificField(fieldSelector, rules) {
        const field = document.querySelector(fieldSelector);
        if (!field) {
            return false;
        }

        const value = this.getFieldValue(field);
        const validationResult = this.executeValidation(value, rules, field);

        if (validationResult.isValid) {
            this.showFieldSuccess(field);
            return true;
        } else {
            this.showFieldError(field, validationResult.message);
            return false;
        }
    }

    // 重置表单验证状态
    resetFormValidation(form) {
        const fields = form.querySelectorAll('input, textarea, select');
        fields.forEach(field => {
            this.clearFieldError(field);
        });
        this.clearFormErrors(form);
    }

    // 获取表单验证状态
    getFormValidationState(form) {
        const fields = form.querySelectorAll('input, textarea, select');
        const state = {
            isValid: true,
            errors: [],
            validFields: 0,
            totalFields: fields.length
        };

        fields.forEach(field => {
            const isValid = this.validateField(field, { showSuccess: false, showError: false });
            if (isValid) {
                state.validFields++;
            } else {
                state.isValid = false;
                state.errors.push({
                    field: field.name || field.id,
                    message: this.getFieldErrorMessage(field) || '验证失败'
                });
            }
        });

        return state;
    }
}

// 创建全局表单验证器实例
window.formValidator = new FormValidator();

// 导出验证函数供其他模块使用
window.validateForm = (form) => window.formValidator.validateForm(form);
window.validateField = (field, options) => window.formValidator.validateField(field, options);
window.addValidationRule = (name, rule) => window.formValidator.addRule(name, rule);