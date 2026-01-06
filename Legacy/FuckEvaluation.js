// ==UserScript==
// @name         FuckEvaluation
// @namespace    https://github.com/lcandy2/MyCOS-Auto-Review
// @version      0.3a
// @author       lcandy2;GuestRyan
// @description  一键评教，自动完成课程评价，支持单选、多选、文本评价。支持仅填充评价和填充并提交评价两种模式。新增一键差评。
// @license      MIT
// @icon         http://www.mycos.com.cn/Uploads/icopic/54a0fcc38f623.ico
// @match        *://*.edu.cn/*
// @match        *://*.mycospxk.com/*
// @require      https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
// @run-at       document-end  // 修改：延迟执行，确保DOM加载完成
// @downloadURL https://update.greasyfork.org/scripts/467357/%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99%EF%BC%9A%E9%80%82%E7%94%A8%E4%BA%8E%20MyCOS%20%20%E9%BA%A6%E5%8F%AF%E6%80%9D%20%E7%9A%84%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99%20MyCOS%20Auto%20Review.user.js
// @updateURL https://update.greasyfork.org/scripts/467357/%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99%EF%BC%9A%E9%80%82%E7%94%A8%E4%BA%8E%20MyCOS%20%20%E9%BA%A6%E5%8F%AF%E6%80%9D%20%E7%9A%84%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99%20MyCOS%20Auto%20Review.meta.js
// ==/UserScript==

(function ($) {
  'use strict';

  const config = {
    autoSubmit: false,
    fastCountdown: true,
    // 好评/差评默认选项索引（0=第一个；差评用 fallbackRadioIndex）
    radio: 0,
    fallbackRadioIndex: 4,
    checkbox: true,
    comment: "我对本课程非常满意。",
    reviewHref: "answer",
    reviewParentElement: "div.ant-tabs div.ant-tabs-bar div.ant-tabs-nav-container div.ant-tabs-nav-wrap div.ant-tabs-nav-scroll",
    reviewSubmitElement: ".ant-btn.ant-btn-primary:not(.--lcandy2-mycos-auto-review)"
  };

  // ===== 小工具：尽量做短、做稳 =====
  const visible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
    return true;
  };

  const clickLikeUser = (el) => {
    if (!el) return;
    const view = el.ownerDocument && el.ownerDocument.defaultView ? el.ownerDocument.defaultView : undefined;
    try { el.focus(); } catch (_) {}
    try { el.scrollIntoView({ block: "center", inline: "center" }); } catch (_) {}

    const fire = (type) => {
      try {
        if (type.startsWith("pointer") && typeof window.PointerEvent === "function") {
          el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, view }));
          return;
        }
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view }));
      } catch (_) {}
    };

    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(fire);
    try { el.click(); } catch (_) {}
  };

  const fillTextarea = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) {
      $(el).val(value);
      return;
    }
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  // 可选：倒计时“秒跳”（仅在确认弹窗倒计时阶段临时启用）
  const countdownSpeedup = (() => {
    const originalSetTimeout = window.setTimeout;
    let enabled = false;
    const enable = () => {
      if (enabled) return;
      enabled = true;
      window.setTimeout = function(callback, delay, ...args) {
        if (typeof delay === "number" && delay >= 1000 && delay <= 5005) {
          return originalSetTimeout(callback, 0, ...args);
        }
        return originalSetTimeout(callback, delay, ...args);
      };
    };
    const disable = () => {
      if (!enabled) return;
      enabled = false;
      window.setTimeout = originalSetTimeout;
    };
    return { enable, disable };
  })();

  const getVisibleModalWrap = () => {
    const wraps = Array.from(document.querySelectorAll("div.ant-modal-wrap"));
    const visibleWraps = wraps.filter(visible);
    return (visibleWraps.length ? visibleWraps : wraps).at(-1) || null;
  };

  const findVisibleButtonByText = (text) => {
    const candidates = Array.from(document.querySelectorAll("button, a"));
    for (let i = candidates.length - 1; i >= 0; i--) {
      const el = candidates[i];
      if (!visible(el)) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.includes(text)) return el;
    }
    return null;
  };

  const selectRadios = (targetIndex) => {
    $(".ant-radio-group").each((_, group) => {
      const options = $(group).find(".ant-radio-wrapper");
      if (!options.length) return;
      const $target = options.eq(targetIndex);
      if (!$target.length) return;
      const alreadyTarget = $target.find(".ant-radio-wrapper-checked, .ant-radio-checked").length > 0;
      if (!alreadyTarget) $target.trigger("click");
    });
  };

  const selectCheckboxes = () => {
    const groups = $(".ant-checkbox-group");
    if (!groups.length) return;
    groups.each((_, group) => {
      const inputs = $(group).find(".ant-checkbox-input");
      inputs.each((__, input) => {
        const checked = $(input).is(":checked");
        if (config.checkbox && !checked) $(input).trigger("click");
        if (!config.checkbox && checked) $(input).trigger("click");
      });
    });
  };

  const fillComments = () => {
    const inputs = $(".ant-input").filter("textarea, input[type='text']");
    inputs.each((_, el) => {
      const v = ($(el).val?.() ?? "").toString().trim();
      if (!v) fillTextarea(el, config.comment);
    });
  };

  const handleConfirmFlow = () => {
    const wrap = getVisibleModalWrap();
    const okBtn = wrap ? wrap.querySelector("button.ant-btn.ant-btn-primary") : null;
    if (okBtn) {
      const text = (okBtn.textContent || "").replace(/\s+/g, " ").trim();
      const hasCountdown = /\(\s*\d+\s*(s|秒)\s*\)/i.test(text);
      if (config.fastCountdown && hasCountdown) countdownSpeedup.enable();
      if (!hasCountdown) {
        if (config.fastCountdown) countdownSpeedup.disable();
        clickLikeUser(okBtn);
      }
      return;
    }

    const nextBtn = findVisibleButtonByText("下一门课程");
    if (nextBtn) {
      const disabled = nextBtn.disabled || nextBtn.getAttribute("aria-disabled") === "true";
      if (!disabled) clickLikeUser(nextBtn);
    }
  };

  const doWork = (judge) => {
    selectRadios(judge ? config.radio : config.fallbackRadioIndex);
    selectCheckboxes();
    fillComments();

    if (config.autoSubmit) {
      const $submitBtn = $(config.reviewSubmitElement);
      if ($submitBtn.length) {
        $submitBtn.trigger("click");
        // 提交后短延迟再跑一次确认处理（弹窗可能异步出现）
        setTimeout(handleConfirmFlow, 50);
      }
    }
  };

  // 添加评教按钮（修复：传递函数引用而非立即执行）
  const addReviewButton = (listener) => {
    if ($("button.--lcandy2-mycos-auto-review").length) return;

    const $parentElement = $(config.reviewParentElement);
    if (!$parentElement.length) {
      console.warn("评教按钮父元素未找到，无法添加按钮");
      return;
    }

    // 一键评教
    const $reviewButton = $(`<button type="button" class="ant-btn ant-btn-default --lcandy2-mycos-auto-review" style="margin-left: 8px;">一 键 评 教</button>`);
    $reviewButton.on("click", () => {
      config.autoSubmit = false;
      listener(true); // 传递judge=true（好评）
    });

    // 一键差评
    const $fuckButton = $(`<button type="button" class="ant-btn ant-btn-default --lcandy2-mycos-auto-review" style="margin-left: 8px;">一 键 差 评</button>`);
    $fuckButton.on("click", () => {
      config.autoSubmit = false;
      listener(false); // 传递judge=false（差评）
    });

    // 评教并提交
    const $reviewAndSubmitButton = $(`<button type="button" class="ant-btn ant-btn-primary --lcandy2-mycos-auto-review" style="margin-left: 8px;">评 教 并 <b>提 交</b></button>`);
    $reviewAndSubmitButton.on("click", () => {
      config.autoSubmit = true;
      listener(true); // 提交默认好评，可根据需求修改
    });

    $parentElement.append($reviewButton);
    $parentElement.append($fuckButton);
    $parentElement.append($reviewAndSubmitButton);
    console.log("评教按钮已添加");
  };

  // 监听URL变化
  const watchUrlChange = (onChange) => {
    const originalPushState = history.pushState;
    history.pushState = function(state, title, url) {
      originalPushState.apply(this, arguments);
      onChange(url);
    };
    const originalReplaceState = history.replaceState;
    history.replaceState = function(state, title, url) {
      originalReplaceState.apply(this, arguments);
      onChange(url);
    };
    window.addEventListener("popstate", () => {
      onChange(document.location.href);
    });
  };

  // 提交评教（修复：动态等待元素加载）
  const submitReview = () => {
    // 轮询等待提交按钮出现，最多等待3秒
    const timer = setInterval(() => {
      const $submitBtn = $(config.reviewSubmitElement);
      if ($submitBtn.length) {
        clearInterval(timer);
        $submitBtn.trigger("click");
        console.log("评教已提交");

        // 提交后立刻尝试处理可能出现的确认弹窗（有些站点弹窗 DOM 不一定触发我们的 observer 条件）
        setTimeout(() => {
          removeModal();
        }, 50);
      }
    }, 200);
    // 超时停止
    setTimeout(() => clearInterval(timer), 3000);
  };

  // 执行评教（修复：参数传递 + 逻辑优化）
  const executeReview = (judge) => {
    // 先等待DOM稳定
    setTimeout(() => {
      doWork(judge);
      const $submitButton = $(config.reviewSubmitElement);
      if ($submitButton.length) {
        $submitButton.children().text("评价完成，点击提交");
      }
      if (config.autoSubmit) {
        submitReview();
        alert("评价完成，已自动提交。");
      } else {
        alert("评价内容已填充完成，请手动点击提交按钮。");
      }
    }, 300);
  };

  // 主函数（修复：传递函数引用）
  const main = () => {
    addReviewButton(executeReview); // 关键修复：传递函数引用，而非立即执行
  };

  // 监听DOM变化
  const observeDomChanges = (onReady, onModalReady) => {
    const domObserver = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.addedNodes.length) {
          const $topContent = $(config.reviewParentElement);
          const href = window.location.href;
          const hrefTest = href.includes(config.reviewHref);
          if ($topContent.length && hrefTest) {
            domObserver.disconnect();
            onReady();
            break;
          }
          if (getVisibleModalWrap() || findVisibleButtonByText("下一门课程")) onModalReady();
        }
      }
    });
    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // 入口函数（修复：await mycosTest()）
  $(async () => {
    observeDomChanges(main, handleConfirmFlow);
    watchUrlChange((newUrl) => {
      observeDomChanges(main, handleConfirmFlow);
    });
  });

})(jQuery);