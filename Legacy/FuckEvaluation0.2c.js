// ==UserScript==
// @name         FuckEvaluation (0.2c)
// @namespace    https://github.com/lcandy2/MyCOS-Auto-Review
// @version      0.2c10
// @author       lcandy2;GuestRyan
// @description  更激进更短：一键评教/差评/评教并提交；支持单选、多选、文本；保留 0.2 的弹窗倒计时处理（确定→下一门课程）与B模式自动点击 primary。
// @license      MIT
// @icon         http://www.mycos.com.cn/Uploads/icopic/54a0fcc38f623.ico
// @match        *://*.edu.cn/*
// @match        *://*.mycospxk.com/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @run-at       document-end
// ==/UserScript==

(function ($) {
  'use strict';

  const RE_COUNTDOWN = /\(\s*\d+\s*(s|秒)\s*\)/i;
  const SEL_PRIMARY = 'button.ant-btn.ant-btn-primary';
  const SEL_MODAL_WRAP = 'div.ant-modal-wrap';

  const config = {
    debug: true,
    autoSubmit: false,
    radio: 0,
    fallbackRadioIndex: 4,
    checkbox: true,
    comment: '我对本课程非常满意。',
    reviewHref: 'answer',
    reviewParentElement: 'div.ant-tabs div.ant-tabs-bar div.ant-tabs-nav-container div.ant-tabs-nav-wrap div.ant-tabs-nav-scroll',
    reviewSubmitElement: '.ant-btn.ant-btn-primary:not(.--lcandy2-mycos-auto-review)'
  };

  const log = (...args) => {
    if (!config.debug) return;
    console.log('[0.2c]', ...args);
  };

  const visible = (el) => {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return !(s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0');
  };

  const clickLikeUser = (el) => {
    if (!el) return;
    const view = el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : undefined;
    try { el.focus(); } catch (_) {}
    try { el.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}

    const fire = (type) => {
      try {
        if (type.startsWith('pointer') && typeof window.PointerEvent === 'function') {
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, view }));
          return;
        }
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view }));
      } catch (_) {}
    };

    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(fire);
    try { el.click(); } catch (_) {}
  };

  const fillTextarea = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      $(el).val(value);
    }
  };

  const getVisibleModalWrap = () => {
    const wraps = Array.from(document.querySelectorAll(SEL_MODAL_WRAP));
    const vs = wraps.filter(visible);
    return (vs.length ? vs : wraps).at(-1) || null;
  };

  const getModalButtons = (wrap) => {
    if (!wrap) return [];
    const footer = wrap.querySelector('.ant-modal-footer');
    const btns = Array.from((footer || wrap).querySelectorAll('button.ant-btn'));
    return btns.filter(visible);
  };

  const doWork = (judge) => {
    if (!window.location.href.includes(config.reviewHref)) return;
    const idx = judge ? config.radio : config.fallbackRadioIndex;

  log('开始填写', { judge, idx });

    $('.ant-radio-group').each((_, group) => {
      const $opts = $(group).find('.ant-radio-wrapper');
      if ($opts.length) {
        log('单选：选择选项', { idx, options: $opts.length });
        $opts.eq(idx).trigger('click');
      }
    });

    $('.ant-checkbox-group').each((_, group) => {
      $(group).find('.ant-checkbox-input').each((__, input) => {
        const checked = $(input).is(':checked');
        if (config.checkbox && !checked) $(input).trigger('click');
        if (!config.checkbox && checked) $(input).trigger('click');
      });
      log('多选：设置为', { value: config.checkbox });
    });

    const $text = $('.ant-input').filter('textarea, input[type="text"]');
    log('文本：填写评语', { count: $text.length });
    $text.each((_, el) => fillTextarea(el, config.comment));
  };

  const removeModal = () => {
    if (removeModal._running) return;
    removeModal._running = true;

  log('弹窗处理：开始');

    const startTime = Date.now();
    const timer = setInterval(() => {
      const wrap = getVisibleModalWrap();
      const okBtn = wrap ? wrap.querySelector(SEL_PRIMARY) : null;

      if (!wrap || !okBtn) {
        if (Date.now() - startTime > 12000) {
          clearInterval(timer);
          removeModal._running = false;
        }
        return;
      }

      const text = (okBtn.textContent || '').replace(/\s+/g, ' ').trim();
      const hasCountdown = RE_COUNTDOWN.test(text);

  log('弹窗处理：轮询', { text, hasCountdown });

      if (!hasCountdown) {
  log('弹窗处理：点击确定');
        clickLikeUser(okBtn);

        const nextStart = Date.now();
        const nextTimer = setInterval(() => {
          const btns = getModalButtons(wrap);
          const nextBtn = btns.find((b) => b !== okBtn && !b.classList.contains('ant-btn-primary')) || null;
          if (nextBtn && !nextBtn.disabled && nextBtn.getAttribute('aria-disabled') !== 'true') {
            log('弹窗处理：点击下一门课程');
            clickLikeUser(nextBtn);
            clearInterval(nextTimer);
            clearInterval(timer);
            removeModal._running = false;
          }
          if (Date.now() - nextStart > 2000) {
            clearInterval(nextTimer);
            clearInterval(timer);
            removeModal._running = false;
          }
        }, 500);

        return;
      }

      if (Date.now() - startTime > 12000) {
        clearInterval(timer);
        removeModal._running = false;
      }
    }, 500);
  };

  const submitReview = () => {
    if (!window.location.href.includes(config.reviewHref)) return;
    log('提交：开始轮询提交按钮');
    config.autoSubmit = false;
    const start = Date.now();
    const timer = setInterval(() => {
      const $btn = $(config.reviewSubmitElement);
      if ($btn.length) {
        log('提交：点击提交按钮', { count: $btn.length, text: ($btn.first().text() || '').trim() });
        clearInterval(timer);
        $btn.first().trigger('click');
        setTimeout(removeModal, 50);
      }
      if (Date.now() - start > 2000) clearInterval(timer);
    }, 500);
  };

  const executeReview = (judge) => {
    setTimeout(() => {
      log('执行：按钮触发', { judge, autoSubmit: config.autoSubmit });
      doWork(judge);
      if (config.autoSubmit) submitReview();
    }, 300);
  };

  const addReviewButton = (listener) => {
    if ($('button.--lcandy2-mycos-auto-review').length) return;

    const $parent = $(config.reviewParentElement);
    if (!$parent.length) return;

    const btn = (cls, html, onClick) => {
      const $b = $(`<button type="button" class="ant-btn ${cls} --lcandy2-mycos-auto-review" style="margin-left: 8px;">${html}</button>`);
      $b.on('click', onClick);
      return $b;
    };

    $parent.append(
      btn('ant-btn-default', '一键好评', () => { config.autoSubmit = false; listener(true); }),
      btn('ant-btn-default', '一键差评（注意！！！）', () => { config.autoSubmit = false; listener(false); }),
      btn('ant-btn-primary', '评 教 并 <b>提 交</b>', () => { config.autoSubmit = true; listener(true); })
    );
  };

  const watchUrlChange = (onChange) => {
    const p = history.pushState;
    history.pushState = function () {
      p.apply(this, arguments);
      log('路由：pushState', arguments[2]);
      onChange(arguments[2]);
    };
    const r = history.replaceState;
    history.replaceState = function () {
      r.apply(this, arguments);
      log('路由：replaceState', arguments[2]);
      onChange(arguments[2]);
    };
    window.addEventListener('popstate', () => {
      log('路由：popstate(前进/后退)');
      onChange(document.location.href);
    });
  };

  const observeDomChanges = (onReady, onModalReady) => {
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (!m.addedNodes.length) continue;

        const hrefOk = window.location.href.includes(config.reviewHref);
        if (hrefOk && $(config.reviewParentElement).length) {
          log('评教页就绪：注入按钮');
          obs.disconnect();
          onReady();
          break;
        }
        if (getVisibleModalWrap()) {
          log('检测到弹窗：启动弹窗处理');
          onModalReady();
        }
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
  };

  const main = () => addReviewButton(executeReview);

  $(() => {
    observeDomChanges(main, removeModal);
    watchUrlChange(() => observeDomChanges(main, removeModal));
  });

})(jQuery);
