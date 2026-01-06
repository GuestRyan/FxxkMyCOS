// ==UserScript==
// @name         FuckEvaluation (0.2b)
// @namespace    https://github.com/lcandy2/MyCOS-Auto-Review
// @version      0.2b
// @author       lcandy2;GuestRyan
// @description  精简版：一键评教/差评/评教并提交；支持单选、多选、文本；保留 0.2 的弹窗倒计时处理（确定→下一门课程）与倒计时秒跳。
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
  const SEL_WANG_EDITOR = '.w-e-text-container, .w-e-toolbar, .w-e-panel-container';

  const config = {
    autoSubmit: false,
    // B：激进模式（按你的要求）：只要页面上出现可见且可点的 primary 按钮就点
    autoNext: true,
    radio: 0,
    fallbackRadioIndex: 4,
    checkbox: true,
    comment: '我对本课程非常满意。',
    reviewHref: 'answer',
    reviewParentElement: 'div.ant-tabs div.ant-tabs-bar div.ant-tabs-nav-container div.ant-tabs-nav-wrap div.ant-tabs-nav-scroll',
    reviewSubmitElement: '.ant-btn.ant-btn-primary:not(.--lcandy2-mycos-auto-review)'
  };

  // 只有“进入评教流程/处理过弹窗”后才放开B模式全局点 primary，避免刚进页面就误点
  const state = {
    autoNextArmed: false
  };

  const visible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
    return true;
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
    if (!setter) {
      $(el).val(value);
      return;
    }
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const getVisibleModalWrap = () => {
    const wraps = Array.from(document.querySelectorAll(SEL_MODAL_WRAP));
    const visibleWraps = wraps.filter(visible);
    return (visibleWraps.length ? visibleWraps : wraps).at(-1) || null;
  };

  const findVisibleButtonByText = (text) => {
    const nodes = Array.from(document.querySelectorAll('button, a'));
    for (let i = nodes.length - 1; i >= 0; i--) {
      const el = nodes[i];
      if (!visible(el)) continue;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.includes(text)) return el;
    }
    return null;
  };

  const isClickable = (el) => {
    if (!el || !visible(el)) return false;
    if (el.disabled) return false;
    if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return false;
    return true;
  };

  const isCountdownText = (el) => RE_COUNTDOWN.test((el?.textContent || '').replace(/\s+/g, ' ').trim());

  // 避免误点“提交/保存/发布”等动作按钮（B模式的最低限度安全闸）
  const isDangerPrimaryText = (el) => {
    const t = ((el?.textContent || '').replace(/\s+/g, ' ').trim()).toLowerCase();
    return /提交|确认提交|保存|发布|确定提交|提交评价/.test(t);
  };

  const inWangEditor = (el) => {
    try {
      return !!(el && el.closest && el.closest(SEL_WANG_EDITOR));
    } catch (_) {
      return false;
    }
  };

  const isUserTyping = () => {
    const a = document.activeElement;
    if (!a) return false;
    const tag = (a.tagName || '').toLowerCase();
    return tag === 'textarea' || (tag === 'input' && (a.type || '').toLowerCase() === 'text') || a.isContentEditable;
  };


  const selectRadios = (targetIndex) => {
    $('.ant-radio-group').each((_, group) => {
      const options = $(group).find('.ant-radio-wrapper');
      if (!options.length) return;
      const $target = options.eq(targetIndex);
      if ($target.length) $target.trigger('click');
    });
  };

  const selectCheckboxes = () => {
    const groups = $('.ant-checkbox-group');
    if (!groups.length) return;
    groups.each((_, group) => {
      const inputs = $(group).find('.ant-checkbox-input');
      inputs.each((__, input) => {
        const checked = $(input).is(':checked');
        if (config.checkbox && !checked) $(input).trigger('click');
        if (!config.checkbox && checked) $(input).trigger('click');
      });
    });
  };

  const fillComments = () => {
    const inputs = $('.ant-input').filter('textarea, input[type="text"]');
    inputs.each((_, el) => {
      fillTextarea(el, config.comment);
    });
  };

  const doWork = (judge) => {
    selectRadios(judge ? config.radio : config.fallbackRadioIndex);
    selectCheckboxes();
    fillComments();
  };

  const removeModal = () => {
    if (removeModal._running) return;
    removeModal._running = true;

    const startTime = Date.now();
    const timer = setInterval(() => {
      const wrap = getVisibleModalWrap();
      const okBtn = wrap ? wrap.querySelector(SEL_PRIMARY) : null;

      // 弹窗DOM在渲染/关闭过程中可能短暂不存在按钮，避免空指针
      if (!wrap || !okBtn) {
        if (Date.now() - startTime > 12000) {
          clearInterval(timer);
          removeModal._running = false;
        }
        return;
      }

      const text = (okBtn.textContent || '').replace(/\s+/g, ' ').trim();
      const hasCountdown = RE_COUNTDOWN.test(text);

      // 倒计时结束：点“确定”，然后继续等待“下一门课程”出现并点击
      if (!hasCountdown) {
        // 明确到了“倒计时跳过结束”的阶段：允许后续B模式工作
        state.autoNextArmed = true;
        clickLikeUser(okBtn);

        const nextStart = Date.now();
        const nextTimer = setInterval(() => {
          const nextBtn = findVisibleButtonByText('下一门课程');
          if (nextBtn) {
            const disabled = nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true';
            if (!disabled) {
              clickLikeUser(nextBtn);
              clearInterval(nextTimer);
              clearInterval(timer);
              removeModal._running = false;
            }
          }

          if (Date.now() - nextStart > 2000) {
            clearInterval(nextTimer);
            clearInterval(timer);
            removeModal._running = false;
          }
        }, 200);

        return;
      }

      if (Date.now() - startTime > 12000) {
        clearInterval(timer);
        removeModal._running = false;
      }
    }, 500);
  };

  const autoClickPrimary = (() => {
    const cooldown = new WeakMap();
    let throttle = null;

    const tick = () => {
      if (!config.autoNext) return;
      if (isUserTyping()) return;

      // 排除“提交”按钮：避免新页面/切页时误触发提交
      const submitBtn = document.querySelector(config.reviewSubmitElement);

      // 关键闸：没进入提交流程/没处理过倒计时弹窗之前，不做“全局 primary 自动点击”
      // 但弹窗内按钮（例如“确定”）仍允许点击（因为wrap存在时我们会优先处理）
      const wrap = getVisibleModalWrap();
      if (!state.autoNextArmed && !wrap) return;

      const hrefOk = window.location.href.includes(config.reviewHref);
      if (!hrefOk && !wrap) return;

      // 优先点击可见弹窗内的 primary（更像“确定/下一步”），减少误点页面主按钮
      if (wrap) {
        const modalBtns = Array.from(wrap.querySelectorAll(SEL_PRIMARY));
        for (let i = modalBtns.length - 1; i >= 0; i--) {
          const btn = modalBtns[i];
          if (!isClickable(btn)) continue;
          if (isCountdownText(btn)) continue;
          if (inWangEditor(btn)) continue;
          if (isDangerPrimaryText(btn)) continue;
          clickLikeUser(btn);
          return;
        }
      }

      // 非评教页：到这里说明没有可见弹窗，直接退出，避免扫描全局 primary 误点
      if (!hrefOk) return;

      const btns = Array.from(document.querySelectorAll(SEL_PRIMARY));
      for (let i = btns.length - 1; i >= 0; i--) {
        const btn = btns[i];
        if (!isClickable(btn)) continue;
        if (isCountdownText(btn)) continue;
        if (inWangEditor(btn)) continue;
        if (isDangerPrimaryText(btn)) continue;
        if (submitBtn && btn === submitBtn) continue;

        const now = Date.now();
        const last = cooldown.get(btn) || 0;
        if (now - last < 800) continue;
        cooldown.set(btn, now);

        clickLikeUser(btn);
        break;
      }
    };

    return () => {
      if (throttle) return;
      throttle = setTimeout(() => {
        tick();
        throttle = null;
      }, 300);
    };
  })();

  const submitReview = () => {
    const start = Date.now();
    const timer = setInterval(() => {
      const $btn = $(config.reviewSubmitElement);
      if ($btn.length) {
        clearInterval(timer);
        $btn.trigger('click');
        setTimeout(removeModal, 50);
      }
      if (Date.now() - start > 3000) clearInterval(timer);
    }, 200);
  };

  const executeReview = (judge) => {
    setTimeout(() => {
      doWork(judge);
      if (config.autoSubmit) {
        submitReview();
      }
    }, 300);
  };

  const addReviewButton = (listener) => {
    if ($('button.--lcandy2-mycos-auto-review').length) return;

    const $parent = $(config.reviewParentElement);
    if (!$parent.length) return;

    const $good = $(`<button type="button" class="ant-btn ant-btn-default --lcandy2-mycos-auto-review" style="margin-left: 8px;">一 键 评 教</button>`);
    $good.on('click', () => {
      config.autoSubmit = false;
      listener(true);
    });

    const $bad = $(`<button type="button" class="ant-btn ant-btn-default --lcandy2-mycos-auto-review" style="margin-left: 8px;">一 键 差 评</button>`);
    $bad.on('click', () => {
      config.autoSubmit = false;
      listener(false);
    });

    const $goodSubmit = $(`<button type="button" class="ant-btn ant-btn-primary --lcandy2-mycos-auto-review" style="margin-left: 8px;">评 教 并 <b>提 交</b></button>`);
    $goodSubmit.on('click', () => {
      config.autoSubmit = true;
      listener(true);
    });

    $parent.append($good, $bad, $goodSubmit);
  };

  const watchUrlChange = (onChange) => {
    const originalPushState = history.pushState;
    history.pushState = function (state, title, url) {
      originalPushState.apply(this, arguments);
      // 进入新页面先上锁，避免B模式在新页面误点提交/下一步
      state.autoNextArmed = false;
      onChange(url);
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function (state, title, url) {
      originalReplaceState.apply(this, arguments);
      state.autoNextArmed = false;
      onChange(url);
    };
    window.addEventListener('popstate', () => {
      state.autoNextArmed = false;
      onChange(document.location.href);
    });
  };

  const observeDomChanges = (onReady, onModalReady) => {
    const obs = new MutationObserver((mutations) => {
      autoClickPrimary();
      for (const m of mutations) {
        if (!m.addedNodes.length) continue;

        const hrefOk = window.location.href.includes(config.reviewHref);
        if (hrefOk && $(config.reviewParentElement).length) {
          obs.disconnect();
          onReady();
          break;
        }
        if (getVisibleModalWrap() || findVisibleButtonByText('下一门课程')) onModalReady();
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
  };

  const main = () => addReviewButton(executeReview);

  $(async () => {
    observeDomChanges(main, removeModal);
    watchUrlChange(() => observeDomChanges(main, removeModal));
  });

})(jQuery);
