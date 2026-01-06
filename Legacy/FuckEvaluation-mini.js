// ==UserScript==
// @name         FuckEvaluation (0.2c-mini)
// @namespace    https://github.com/lcandy2/MyCOS-Auto-Review
// @version      0.2-mini
// @author       lcandy2;GuestRyan
// @description  极致精简版：一键评教/差评/评教并提交
// @license      MIT
// @icon         http://www.mycos.com.cn/Uploads/icopic/54a0fcc38f623.ico
// @match        *://*.edu.cn/*
// @match        *://*.mycospxk.com/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @run-at       document-end
// ==/UserScript==

(function ($) {
    'use strict';

    const config = { radio: 0, fallback: 4, check: true, comment: '满意' };

    const isVisible = (el) => el && getComputedStyle(el).display !== 'none';
    const click = (el) => el && el.click();
    const fillInput = (el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const fillForm = (good) => {
        $('.ant-radio-group').each((_, group) => $(group).find('.ant-radio-wrapper').eq(good ? config.radio : config.fallback).click());
        $(`.ant-checkbox-input:${config.check ? 'not(:checked)' : ':checked'}`).click();
        $('.ant-input').filter('textarea, input[type="text"]').each((_, el) => fillInput(el, config.comment));
    };

    const handleModal = () => {
        if (handleModal.running) return;
        handleModal.running = true;

        const timer = setInterval(() => {
            const wrap = [...document.querySelectorAll('div.ant-modal-wrap')].filter(isVisible).pop();
            const okBtn = wrap?.querySelector('button.ant-btn-primary');
            if (!okBtn) return;

            if (!/\(\s*\d+\s*s\s*\)/i.test(okBtn.textContent)) {
                click(okBtn);
                const timer2 = setInterval(() => {
                    const nextBtn = [...document.querySelectorAll('button, a')].find((el) => isVisible(el) && el.textContent.includes('下一门课程') && !el.disabled);
                    if (nextBtn) {
                        click(nextBtn);
                        clearInterval(timer2);
                        clearInterval(timer);
                        handleModal.running = false;
                    }
                }, 200);
            }
        }, 300);
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

    const addButtons = () => {
        if ($('button.--mini').length) return;
        const $parent = $('div.ant-tabs div.ant-tabs-nav-scroll');
        if (!$parent.length) return;

        const add = (text, good, auto) => $(
            `<button class="ant-btn --mini" style="margin-left:8px">${text}</button>`
        ).click(() => {
            fillForm(good);
            if (auto) submit();
        }).appendTo($parent);

        add('一键好评', true, false);
        add('一键差评', false, false);
        add('评教提交', true, true);
    };

    new MutationObserver(() => {
        if (location.href.includes('answer') && $('div.ant-tabs-nav-scroll').length) addButtons();
    }).observe(document.body, { childList: true, subtree: true });

})(jQuery);