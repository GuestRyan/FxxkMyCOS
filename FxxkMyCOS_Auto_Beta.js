// ==UserScript==
// @name         FxxkMyCOS_Auto
// @namespace    https://github.com/GuestRyan/FxxkMyCOS
// @version      a1.0
// @author       para-lyze
// @description  深圳技术大学教评全自动版：一键完成
// @license      MIT
// @icon         http://www.mycos.com.cn/Uploads/icopic/54a0fcc38f623.ico
// @match        *://*.sztu.edu.cn/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
//  level: [0:"同意", 1:"大体同意", 2:"基本同意", 3:"不大同意", 4:"不同意"]，comment：自定义评论内容
//  reviewHref: 评价页面 URL 关键字，autoSubmit: 是否自动提交，autoNext: 是否自动跳转下一项
const config = {
        level: 0, comment: "满意",
        reviewHref: "answer", autoSubmit: true, autoNext: true
    };

// 跳过定时器（必须在最开头）
(function() {
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function(callback, delay) {
        if (delay >= 1000 && delay <= 5000) return originalSetTimeout(callback, 0);
        else return originalSetTimeout(callback, delay);
    };
})();

// --- 核心自动填写、提交、切换逻辑 ---
(function ($) {
    'use strict';
    // 模拟原生输入，绕过框架拦截
    const fillInput = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        if (setter) {
            setter.call(element, value);
            element.dispatchEvent(new Event("input", { bubbles: true }));
        }
    };

    const doWork = () => {
        // 1. 只有在评价页面才执行填写逻辑
        if (window.location.href.includes(config.reviewHref)) {

            // A. 自动填充单选
            const unfilledRadios = $(".ant-radio-group").filter((i, el) => {
                return $(el).find(".ant-radio-wrapper-checked, .ant-radio-checked").length === 0;
            });
            unfilledRadios.each((i, group) => {
                const options = $(group).find(".ant-radio-wrapper");
                const target = config.level;
                if (options.eq(target).length) options.eq(target).trigger("click");
            });

            // B. 自动填充多选
            $(".ant-checkbox-group").find(".ant-checkbox:not(.ant-checkbox-checked)").each((i, el) => {
                $(el).find(".ant-checkbox-input").trigger("click");
            });

            // C. 自动填充文本框
            $(".ant-input").each((i, el) => {
                if ($(el).val().trim() === "") fillInput(el, config.comment);
            });

            // D. 自动点击“提交”按钮
            if (config.autoSubmit) {
                const submitBtn = $('.ant-btn-primary').filter((i, el) => {
                    const text = $(el).text();
                    return text.includes("提 交") || text.includes("确 定") || text.includes("确定");
                });
                if (submitBtn.length > 0 && !submitBtn.prop('disabled')) {
                    submitBtn.trigger('click');
                }
            }
        }

        // 2. 无论是否在评价页，都实时监控并点击“跳转”按钮
        if (config.autoNext) {
            // 查找所有可能的跳转按钮：下一位教师、下一门课程、返回列表、确定（成功弹窗）
            const nextBtn = $('.ant-btn, .ant-btn-primary').filter((i, el) => {
                const txt = $(el).text();
                return txt.includes("下一位教师") ||
                       txt.includes("下一门课程") ||
                       txt.includes("下一门") ||
                       txt.includes("返回列表");
            });

            if (nextBtn.length > 0) {
                console.log(`[全自动评教] 检测到跳转按钮: ${nextBtn.text()}，正在自动点击...`);
                nextBtn.trigger('click');
            }
        }
    };

    // 使用 MutationObserver 监控 DOM 变化
    let throttle = null;
    const observer = new MutationObserver(() => {
        if (throttle) return;
        throttle = setTimeout(() => {
            doWork();
            throttle = null;
        }, 500); // 0.5秒节流，平衡速度与稳定性
    });

    const init = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            doWork();
        } else {
            setTimeout(init, 100);
        }
    };

    init();

})(jQuery);