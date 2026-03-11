/**
 * 查词按钮功能模块
 * 自动初始化，无需手动调用
 */

(function () {
  "use strict";

  /**
   * 初始化查词按钮
   * @param {HTMLElement} container - 容器元素
   * @param {string} frontText - 正面文本
   * @returns {HTMLElement} 查词按钮元素
   */
  function initLookupButton(container, frontText) {
    // 用于保存选中文本的变量
    let savedSelection = null;

    // 创建查词按钮
    const lookupBtn = document.createElement("button");
    lookupBtn.textContent = "查词";
    lookupBtn.setAttribute(
      "style",
      "margin-left: 10px; display: inline-block;",
    );

    // 在鼠标按下时保存当前选中的文本
    lookupBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      savedSelection = window.getSelection().toString().trim();
      console.log("保存的选中文本:", savedSelection);
    });

    // 查词按钮点击事件
    lookupBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      let textToLookup = "";
      console.log("savedSelection:", savedSelection);

      if (savedSelection) {
        textToLookup = savedSelection;
        console.log("使用保存的选中文本");
      } else {
        textToLookup = frontText;
        console.log("使用全文");
      }

      if (!textToLookup) {
        alert("没有可查询的内容");
        return;
      }

      const encodedText = encodeURIComponent(textToLookup);
      const scheme = `mkdictionaries:///?text=${encodedText}`;

      console.log("跳转 URL:", scheme);
      window.location.href = scheme;

      savedSelection = null;
    });

    container.appendChild(lookupBtn);
    return lookupBtn;
  }

  // 挂载到 window 对象（供外部调用）
  window.AnkiLookup = {
    init: initLookupButton,
  };

  // ============ 自动初始化 ============

  (function autoInit() {
    const init = () => {
      const container = document.getElementById("button-container");
      const frontElement = document.getElementById("front");

      if (!container) {
        console.warn("未找到 button-container 元素");
        return;
      }

      if (!frontElement) {
        console.warn("未找到 front 元素");
        return;
      }

      const frontText = frontElement.textContent.trim();

      if (!frontText) {
        console.warn("front 元素内容为空");
        return;
      }

      // 初始化查词按钮
      initLookupButton(container, frontText);
      console.log("查词按钮已自动初始化");
    };

    // 如果 DOM 已加载，立即执行
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
