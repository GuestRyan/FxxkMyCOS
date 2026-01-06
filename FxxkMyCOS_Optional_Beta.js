// ==UserScript==
// @name         FxxkMyCOS_Optional
// @namespace    https://github.com/GuestRyan/FxxkMyCOS
// @version      o1.0
// @author       GuestRyan
// @description  深圳技术大学教评半自动版：一键好评/差评/好评并提交
// @license      MIT
// @icon         http://www.mycos.com.cn/Uploads/icopic/54a0fcc38f623.ico
// @match        *://*.sztu.edu.cn/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @run-at       document-start
// @grant        none
// ==/UserScript==
// positive || negative: [0:"同意", 1:"大体同意", 2:"基本同意", 3:"不大同意", 4:"不同意"]，comment：可自定义评论
const config = { positive: 0, negative: 4, check: true, comment: "满意" };

// 跳过定时器（必须在最开头）
(function() {
    const originalSetTimeout = window.setTimeout;
    window.setTimeout = function(callback, delay) {
        if (delay >= 1000 && delay <= 5000) return originalSetTimeout(callback, 0);
        else return originalSetTimeout(callback, delay);
    };
})();

(function ($) {
    'use strict';
    // 辅助函数
    const isVisible = (el) => el && getComputedStyle(el).display !== 'none';
    const click = (el) => el && el.click();
    const fillInput = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        if (setter) {
            setter.call(element, value);
            element.dispatchEvent(new Event("input", { bubbles: true }));
        }
    };

    const fillForm = (good) => {
        $('.ant-radio-group').each((_, group) => $(group).find('.ant-radio-wrapper').eq(good ? config.positive : config.negative).click());
        $(`.ant-checkbox-input:${config.check ? 'not(:checked)' : ':checked'}`).click();
        $('.ant-input').filter('textarea, input[type="text"]').each((_, el) => fillInput(el, config.comment));
    };

    const handleModal = () => {
        const wrap = [...document.querySelectorAll('div.ant-modal-wrap')].filter(isVisible).pop();
        const okBtn = wrap?.querySelector('button.ant-btn-primary');
        if (okBtn) click(okBtn);
    };

    const addButtons = () => {
        if (!location.href.includes('answer') || $('button.--mini').length) return;
        const $parent = $('div.ant-tabs div.ant-tabs-bar');

        const add = (text, good, auto, style) => $(
            `<button class="ant-btn --mini" style="margin-left:8px;${style || ''}">${text}</button>`
        ).click(() => {
            fillForm(good);
            if (auto) submit();
        }).appendTo($parent);

        add('一键好评', true, false, 'background:#52c41a;border-color:#52c41a;color:#fff;');
        add('一键差评', false, false, 'background:#ff4d4f;border-color:#ff4d4f;color:#fff;');
        add('一键好评且自动提交', true, true, 'background:#1677ff;border-color:#1677ff;color:#fff;font-weight:700;');
    };

    const submit = () => {
        const timer = setInterval(() => {
            const $btn = $('button.ant-btn-primary:not(.--mini)');
            if ($btn.length) {
                $btn.click();
                setTimeout(handleModal, 50);
                clearInterval(timer);
            }
        }, 200);
    };

    // 使用 MutationObserver 监控 DOM 变化（document-start 下需要等 body 就绪）
    let throttle = null;
    const observer = new MutationObserver(() => {
        if (throttle) return;
        throttle = setTimeout(() => {
            addButtons();
            throttle = null;
        }, 300);
    });

    const init = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            addButtons();
        } else {
            setTimeout(init, 100);
        }
    };

    init();

})(jQuery);