// ==UserScript==
// @name         FuckEvaluation
// @namespace    https://github.com/lcandy2/MyCOS-Auto-Review
// @version      0.1
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

  // 选择复选框（修复：添加返回值）
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
      }
    }, 200);
    // 超时停止
    setTimeout(() => clearInterval(timer), 3000);
  };

  // 处理弹窗
  const removeModal = ($button) => {
    if (!$button.length) return;
    $button.prop("disabled", false);
    setTimeout(() => $button.trigger("click"), 200); // 延迟点击避免冲突
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
          const $modalBody = $(config.reviewModalElement);
          const $button = $modalBody.find("button.ant-btn-primary");
          if ($modalBody.length && $button.length) {
            domObserver.disconnect();
            onModalReady($button);
            console.log("已处理评价弹窗");
            break;
          }
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
    // 关键修复：await验证MyCOS系统
    const isMyCOS = await isMycosSystem();
    if (!isMyCOS) {
      console.log("非MyCOS系统，脚本退出");
      return;
    }
    observeDomChanges(main, removeModal);
    watchUrlChange((newUrl) => {
      observeDomChanges(main, removeModal);
    });
  });

})(jQuery);