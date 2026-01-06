// ==UserScript==
// @name         FuckEvaluation
// @namespace    https://github.com/lcandy2/MyCOS-Auto-Review
// @version      0.2a
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
    debug: true,
    radio: 0,
    fallbackRadioIndex: 4,
    checkbox: true,
    comment: "我对本课程非常满意。",
    reviewHref: "answer",
    reviewParentElement: "div.ant-tabs div.ant-tabs-bar div.ant-tabs-nav-container div.ant-tabs-nav-wrap div.ant-tabs-nav-scroll",
    reviewRadioField: ["同意", "大体同意", "基本同意", "不大同意", "不同意"],
    reviewSubmitElement: ".ant-btn.ant-btn-primary:not(.--lcandy2-mycos-auto-review)",
    reviewModalElement: "div.ant-modal-body"
  };

  // ===== 调试工具（可通过 config.debug 开关） =====
  const debugLog = (...args) => {
    if (!config.debug) return;
    console.log(...args);
  };

  const debugWarn = (...args) => {
    if (!config.debug) return;
    console.warn(...args);
  };

  const createThrottledLogger = (key, intervalMs = 400) => {
    if (!createThrottledLogger._state) createThrottledLogger._state = {};
    const state = createThrottledLogger._state;
    if (!state[key]) state[key] = { lastTs: 0, lastSig: null };

    return (signature, ...args) => {
      if (!config.debug) return;
      const now = Date.now();
      const entry = state[key];
      const sig = signature ?? "";
      const shouldLog = sig !== entry.lastSig || now - entry.lastTs >= intervalMs;
      if (!shouldLog) return;
      entry.lastSig = sig;
      entry.lastTs = now;
      console.log(...args);
    };
  };

  // 填充文本框并触发input事件
  const fillInput = (element, value) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    const inputEvent = new Event("input", { bubbles: true });
    nativeInputValueSetter.call(element, value);
    element.dispatchEvent(inputEvent);
  };

  // 选择单选框（修复拼写和逻辑判断错误）
  const selectRadio = (selection, fixedTexts = ["同意", "大体同意", "基本同意", "不大同意", "不同意"]) => {
    let positions = new Array(5).fill(-1);
    let result = false;
    const targetIndex = selection;

    $(".ant-radio-group").each((groupIndex, element) => {
      const options = $(element).find(".ant-radio-wrapper");
      if (options.length === 0) return;

      positions = new Array(5).fill(-1);

      options.each((optionIndex, optionElement) => {
        const text = $(optionElement).text().trim();

        if (text.startsWith(fixedTexts[0])) {
          positions[0] = optionIndex;
        } else if (text.startsWith(fixedTexts[1])) {
          positions[1] = optionIndex;
        } else if (text.startsWith(fixedTexts[2])) {
          positions[2] = optionIndex;
        } else if (text.startsWith(fixedTexts[3])) {
          positions[3] = optionIndex;
        } else if (text.startsWith(fixedTexts[4])) {
          positions[4] = optionIndex;
        }
      });

      if (positions[targetIndex] !== -1) {
        options.eq(positions[targetIndex]).trigger("click");
        result = true;
        console.log(`[单选题] 第 ${groupIndex + 1} 题，固定选择第 ${targetIndex + 1} 个选项：${fixedTexts[targetIndex]}`);
      } else {
        console.warn(`[单选题] 第 ${groupIndex + 1} 题未找到目标选项（${fixedTexts[targetIndex]}），跳过`);
      }
    });
    return result;
  };

  // 填充文本评价（修复：添加返回值）
  const fillComments = (comment) => {
    let result = false;
    const textInputList = $(".ant-input").filter("textarea, input[type='text']");
    if (textInputList.length === 0) return result;

    for (let i = 0; i < textInputList.length; i++) {
      const textArea = textInputList[i];
      fillInput(textArea, comment);
    }
    result = true;
    console.log("[文本评价] 评价完成");
    return result;
  };

  // 选择复选框（恢复：多选逻辑）
  const selectCheckboxes = () => {
    let result = false;
    const checkboxList = $(".ant-checkbox-group");
    if (checkboxList.length === 0) return result;

    for (let i = 0; i < checkboxList.length; i++) {
      const checkboxItems = checkboxList[i].children;
      for (let j = 0; j < checkboxItems.length; j++) {
        const checkboxInput = $(checkboxList[i]).find(".ant-checkbox-input")[j];
        if (config.checkbox) {
          if (!$(checkboxInput).is(":checked")) $(checkboxInput).trigger("click");
        } else if ($(checkboxInput).is(":checked")) {
          $(checkboxInput).trigger("click");
        }
      }
    }

    result = true;
    console.log("[多选题] 评价完成");
    return result;
  };

  // 核心评教逻辑
  const runReview = (judge) => {
    const selectRadioResult = judge ? selectRadio(config.radio) : selectRadio(config.fallbackRadioIndex);
    console.log(selectRadioResult ? "[单选题] 评价完成" : "[单选题] 未找到单选题");

    const selectCheckboxResult = selectCheckboxes();
    console.log(selectCheckboxResult ? "[多选题] 评价完成" : "[多选题] 未找到多选题");

    const fillCommentsResult = fillComments(config.comment);
    console.log(fillCommentsResult ? "[文本评价] 评价完成" : "[文本评价] 未找到文本评价");

    console.log("[自动评教] 全部评教完成");
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

  // 验证是否为MyCOS系统（async函数）
  const isMycosSystem = async () => {
    const configJs = $("script").filter((index, element) => {
      const src = $(element).attr("src");
      return src && src.includes("config.js");
    });
    if (!configJs.length) return false;

    try {
      const response = await fetch(configJs.attr("src"));
      const responseText = await response.text();
      return responseText.includes("mycos");
    } catch (e) {
      console.error("验证MyCOS系统失败：", e);
      return false;
    }
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
          debugLog("[Submit] 已点击提交，主动尝试处理确认弹窗");
          removeModal();
        }, 50);
      }
    }, 200);
    // 超时停止
    setTimeout(() => clearInterval(timer), 3000);
  };

  // 处理弹窗：等待倒计时结束后再点“确定”（每次重查按钮，防止 DOM 被替换）
  const removeModal = () => {
    // 防抖：避免 observeDomChanges 在 DOM 频繁变化时重复启动多个定时器
    if (removeModal._running) return;
    removeModal._running = true;

    const logModal = createThrottledLogger("removeModal", 500);
    const clickLog = createThrottledLogger("removeModal-click", 0);
    debugLog("[Modal] removeModal 启动");

    const startTime = Date.now();
    const timer = setInterval(() => {
      // 根据你提供的 DOM 路径：div.ant-modal-wrap > div > div.ant-modal-content ... > button.ant-btn.ant-btn-primary
      // 避免使用 body > div:nth-child(x) 这种不稳定路径，改为：取最后一个 modal-wrap 内的 primary 按钮。
      const $wraps = $("div.ant-modal-wrap");
      const $visibleWraps = $wraps.filter((_, el) => {
        const style = window.getComputedStyle(el);
        // 兼容：display/visibility/opacity/aria-hidden 任意一种隐藏都过滤掉
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
        return true;
      });
      const $wrap = ($visibleWraps.length ? $visibleWraps : $wraps).last();
      const $button = $wrap.find("button.ant-btn.ant-btn-primary").last();
      if (!$button.length) {
        // modal 可能被卸载/隐藏了：及时结束本轮轮询
        if ($wraps.length === 0 || $visibleWraps.length === 0) {
          clearInterval(timer);
          removeModal._running = false;
          debugLog("[Modal] 未找到可见确认按钮，结束本轮 removeModal");
        }
        return;
      }

      const wrapEl = $wrap.get(0);
      const wrapStyle = wrapEl ? window.getComputedStyle(wrapEl) : null;
      const wrapZIndex = wrapStyle ? wrapStyle.zIndex : "";
      const wrapDisplay = wrapStyle ? wrapStyle.display : "";
      const wrapVisibility = wrapStyle ? wrapStyle.visibility : "";
      const wrapOpacity = wrapStyle ? wrapStyle.opacity : "";
      const wrapAriaHidden = wrapEl && wrapEl.getAttribute ? wrapEl.getAttribute("aria-hidden") : "";

      const text = $button.text().replace(/\s+/g, " ").trim();
      const hasCountdown = /\(\s*\d+\s*(s|秒)\s*\)/i.test(text);

      const disabledProp = $button.prop("disabled");
      const disabledAttr = $button.attr("disabled");
      const ariaDisabled = $button.attr("aria-disabled");
      const btnClass = $button.attr("class") || "";
      const btnStyle = $button.attr("style") || "";
      const sig = [
        `wraps:${$wraps.length}`,
        `visibleWraps:${$visibleWraps.length}`,
        `z:${wrapZIndex}`,
        `btn:${text}`,
        `countdown:${hasCountdown}`,
        `disabledProp:${disabledProp}`,
        `disabledAttr:${disabledAttr}`,
        `aria:${ariaDisabled}`
      ].join("|");

      logModal(
        sig,
        "[Modal] 状态:",
        {
          wraps: $wraps.length,
          visibleWraps: $visibleWraps.length,
          wrap: { zIndex: wrapZIndex, display: wrapDisplay, visibility: wrapVisibility, opacity: wrapOpacity, ariaHidden: wrapAriaHidden },
          button: { text, hasCountdown, disabledProp, disabledAttr, ariaDisabled, className: btnClass, style: btnStyle }
        }
      );

      // 仍在倒计时：提前 click 往往会被业务校验拦截，所以这里只做解锁尝试
      $button
        .prop("disabled", false)
        .removeAttr("disabled")
        .removeClass("ant-btn-disabled")
        .attr("aria-disabled", "false")
        .css("pointer-events", "auto");

      // 事件触发：AntD/React 有时需要完整的鼠标序列才能触发 onClick
      const domButton = $button.get(0);
      const fireReactClick = () => {
        if (!domButton) return;

        // 某些站点/userscript 沙箱下，直接传 { view: window } 可能不是原生 Window，导致：
        // Failed to read the 'view' property from 'UIEventInit'
        // 因此这里用 ownerDocument.defaultView，并且所有 dispatch 都做 try/catch，避免中断流程。
        const view = domButton.ownerDocument && domButton.ownerDocument.defaultView
          ? domButton.ownerDocument.defaultView
          : undefined;

        const dispatch = (type) => {
          try {
            // PointerEvent 在部分浏览器存在，优先用；否则回退 MouseEvent
            if (type.startsWith("pointer") && typeof window.PointerEvent === "function") {
              domButton.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, view }));
              return;
            }
            domButton.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view }));
          } catch (e) {
            // 不要让异常阻断后续的兜底 click
            debugWarn("[Modal] dispatchEvent 失败:", { type, error: e });
          }
        };

        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(dispatch);
      };

      // 倒计时结束：文本不含 (xs)/(x秒)，再点击确认
      if (!hasCountdown) {
        console.log("[Modal] 倒计时结束，点击确认：", text);
        // 解除禁用后再触发事件
        $button
          .prop("disabled", false)
          .removeAttr("disabled")
          .removeClass("ant-btn-disabled")
          .attr("aria-disabled", "false")
          .css("pointer-events", "auto");

        // 先尝试 React 事件链，再兜底原生 click
        clickLog(`click:${text}`, "[Modal] 点击尝试 ->", { text });
        fireReactClick();
        if (domButton) domButton.click();

        // 某些流程点击“确定”后，会出现“下一门课程”按钮（依然在 modal-wrap 或页面）。
        // 这里追加一次“下一门课程”自动点击：出现则点，否则短暂等待。
        const nextStartTime = Date.now();
        const nextTimer = setInterval(() => {
          // 优先在可见 modal-wrap 内找
          const $wraps2 = $("div.ant-modal-wrap");
          const $visibleWraps2 = $wraps2.filter((_, el) => {
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
            if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
            return true;
          });
          const $wrap2 = ($visibleWraps2.length ? $visibleWraps2 : $wraps2).last();

          // 兜底：全页面搜一次（避免它不在 modal 内）
          const $candidateButtons = $(
            "button.ant-btn.ant-btn-primary, a.ant-btn.ant-btn-primary, button.ant-btn, a.ant-btn"
          ).filter((_, el) => {
            const $el = $(el);
            const t = $el.text().replace(/\s+/g, " ").trim();
            if (!t.includes("下一门课程")) return false;
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
            if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
            return true;
          });

          const $nextBtnInWrap = $wrap2.find("button, a").filter((_, el) => {
            const t = $(el).text().replace(/\s+/g, " ").trim();
            return t.includes("下一门课程");
          }).last();

          const $nextBtn = ($nextBtnInWrap.length ? $nextBtnInWrap : $candidateButtons).last();
          if ($nextBtn.length) {
            const nextText = $nextBtn.text().replace(/\s+/g, " ").trim();
            const nextDisabled = $nextBtn.prop("disabled") || $nextBtn.attr("aria-disabled") === "true";
            debugLog("[Next] 检测到按钮:", { text: nextText, disabled: nextDisabled });

            if (!nextDisabled) {
              // 复用同样的事件链
              const nextDom = $nextBtn.get(0);
              if (nextDom) {
                try { nextDom.focus(); } catch (_) {}
                try { nextDom.scrollIntoView({ block: "center", inline: "center" }); } catch (_) {}
                ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
                  try {
                    const view2 = nextDom.ownerDocument && nextDom.ownerDocument.defaultView
                      ? nextDom.ownerDocument.defaultView
                      : undefined;
                    if (type.startsWith("pointer") && typeof window.PointerEvent === "function") {
                      nextDom.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, view: view2 }));
                      return;
                    }
                    nextDom.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: view2 }));
                  } catch (e) {
                    debugWarn("[Next] dispatchEvent 失败:", { type, error: e });
                  }
                });
                try { nextDom.click(); } catch (_) {}
              }

              console.log("[Next] 已点击：", nextText);
              clearInterval(nextTimer);

              // 处理完下一步后，debug 扫描器才停
              stopDebugModalScanner();

              clearInterval(timer);
              removeModal._running = false;
              return;
            }
          }

          // 最多等 8 秒给“下一门课程”出现
          if (Date.now() - nextStartTime > 2000) {
            clearInterval(nextTimer);
            debugWarn("[Next] 8秒内未找到可点击的‘下一门课程’，结束等待");
            stopDebugModalScanner();

            clearInterval(timer);
            removeModal._running = false;
          }
        }, 200);

        // 先结束当前“确定”分支的主体轮询，后续由 nextTimer 收尾
        return;
      }

      if (Date.now() - startTime > 12000) {
        clearInterval(timer);
        console.warn("[Modal] 12秒内仍未到可确认状态，停止自动确认：", text);
        removeModal._running = false;
      }
    }, 150);
  };

  // 执行评教（修复：参数传递 + 逻辑优化）
  const executeReview = (judge) => {
    // 先等待DOM稳定
    setTimeout(() => {
      runReview(judge);
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
    const logDom = createThrottledLogger("observer", 500);
    const domObserver = new MutationObserver((mutations) => {
      for (let mutation of mutations) {
        if (mutation.addedNodes.length) {
          // 轻量统计：本次 mutation 新增了多少节点；过多时说明 DOM 抖动明显
          const addedCount = mutation.addedNodes ? mutation.addedNodes.length : 0;
          logDom(`added:${addedCount}`, "[Observer] mutation addedNodes:", addedCount);

          const $topContent = $(config.reviewParentElement);
          const href = window.location.href;
          const hrefTest = href.includes(config.reviewHref);
          if ($topContent.length && hrefTest) {
            debugLog("[Observer] 命中评教页，准备注入按钮:", { href });
            domObserver.disconnect();
            onReady();
            break;
          }
          const $modalBody = $(config.reviewModalElement);
          const $button = $modalBody.find("button.ant-btn-primary");
          // 有些页面 modal-body 可能在 DOM 里早就存在/被复用，observer 只看 addedNodes 会漏；
          // 因此这里同时检查 modal-wrap 的可见性与 primary 按钮。
          const $wraps = $("div.ant-modal-wrap");
          const $visibleWraps = $wraps.filter((_, el) => {
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
            if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
            return true;
          });
          const $wrapPrimaryBtn = ($visibleWraps.length ? $visibleWraps : $wraps).last().find("button.ant-btn.ant-btn-primary");

          if (($modalBody.length && $button.length) || $wrapPrimaryBtn.length) {
            const btnText = $button.first().text().replace(/\s+/g, " ").trim();
            const btnDisabledProp = $button.first().prop("disabled");
            const btnDisabledAttr = $button.first().attr("disabled");
            const btnAriaDisabled = $button.first().attr("aria-disabled");
            const btnClass = $button.first().attr("class");

            const wrapBtnText = $wrapPrimaryBtn.first().text().replace(/\s+/g, " ").trim();
            const wrapBtnDisabledProp = $wrapPrimaryBtn.first().prop("disabled");
            const wrapBtnAriaDisabled = $wrapPrimaryBtn.first().attr("aria-disabled");
            logDom(
              `modal:${btnText || wrapBtnText}|dp:${btnDisabledProp ?? wrapBtnDisabledProp}|da:${btnDisabledAttr}|aria:${btnAriaDisabled || wrapBtnAriaDisabled}`,
              "[Observer] 检测到弹窗线索（modal-body 或 modal-wrap）:",
              {
                viaModalBody: { btnText, btnDisabledProp, btnDisabledAttr, btnAriaDisabled, btnClass },
                viaModalWrap: { wraps: $wraps.length, visibleWraps: $visibleWraps.length, btnText: wrapBtnText, disabledProp: wrapBtnDisabledProp, ariaDisabled: wrapBtnAriaDisabled }
              }
            );
            // 注意：倒计时按钮会在几秒内持续更新文本/disabled。
            // 这里不要 disconnect，让后续 DOM 变更仍然能被捕获（removeModal 内部也有 observer+兜底轮询）。
            onModalReady();
            console.log("已检测到评价弹窗，尝试自动确认");
          }
        }
      }
    });
    domObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  // debug: 定时扫一遍 modal 状态，确认“有弹窗但 observer 没命中”的情况（仅 debug=true 启用）
  const startDebugModalScanner = () => {
    if (!config.debug) return;
    if (startDebugModalScanner._started) return;
    startDebugModalScanner._started = true;

    // 允许在点击确认后主动停掉
    if (!startDebugModalScanner._controller) startDebugModalScanner._controller = {};

    const logScan = createThrottledLogger("modal-scan", 800);
    let invisibleStreak = 0;
    const intervalId = setInterval(() => {
      const $wraps = $("div.ant-modal-wrap");
      const $visibleWraps = $wraps.filter((_, el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
        if (el.getAttribute && el.getAttribute("aria-hidden") === "true") return false;
        return true;
      });

      const $wrap = ($visibleWraps.length ? $visibleWraps : $wraps).last();
      const $btn = $wrap.find("button.ant-btn.ant-btn-primary").last();
      const text = $btn.length ? $btn.text().replace(/\s+/g, " ").trim() : "";
      const disabled = $btn.length ? $btn.prop("disabled") : "";
      const aria = $btn.length ? $btn.attr("aria-disabled") : "";

      if ($visibleWraps.length === 0) {
        invisibleStreak += 1;
      } else {
        invisibleStreak = 0;
      }

      // 连续一段时间都没有可见弹窗，自动停掉扫描器（避免一直占用控制台/性能）
      if (invisibleStreak >= 25) { // 25 * 600ms ≈ 15s
        clearInterval(intervalId);
        startDebugModalScanner._started = false;
        debugLog("[ModalScan] 15秒未检测到可见弹窗，自动停止扫描");
        return;
      }

      logScan(
        `wraps:${$wraps.length}|visible:${$visibleWraps.length}|btn:${text}|disabled:${disabled}|aria:${aria}`,
        "[ModalScan]",
        { wraps: $wraps.length, visibleWraps: $visibleWraps.length, button: { text, disabled, ariaDisabled: aria } }
      );
    }, 600);

    startDebugModalScanner._controller.stop = () => {
      clearInterval(intervalId);
      startDebugModalScanner._started = false;
      debugLog("[ModalScan] 已手动停止扫描");
    };
  };

  const stopDebugModalScanner = () => {
    const controller = startDebugModalScanner._controller;
    if (controller && typeof controller.stop === "function") controller.stop();
  };

  // 入口函数（修复：await mycosTest()）
  $(async () => {
    // 关键修复：await验证MyCOS系统
    const isMyCOS = await isMycosSystem();
    if (!isMyCOS) {
      console.log("非MyCOS系统，脚本退出");
      return;
    }
    startDebugModalScanner();
    observeDomChanges(main, removeModal);
    watchUrlChange((newUrl) => {
      observeDomChanges(main, removeModal);
    });
  });

})(jQuery);