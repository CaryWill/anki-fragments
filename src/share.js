/**
 * 分享按钮功能模块
 * 自动初始化，无需手动调用
 */

(function () {
  "use strict";

  /**
   * 初始化分享按钮
   * @param {HTMLElement} container - 容器元素
   * @param {string} frontText - 正面文本
   * @returns {HTMLElement} 分享按钮元素
   */
  function initShareButton(container, frontText) {
    // 用于保存选中文本的变量
    let savedSelection = null;

    // 创建分享按钮
    const shareBtn = document.createElement("button");
    shareBtn.textContent = "分享";
    shareBtn.setAttribute("style", "margin-left: 10px; display: inline-block;");

    // 在鼠标按下时保存当前选中的文本
    shareBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      savedSelection = window.getSelection().toString().trim();
      console.log("保存的选中文本:", savedSelection);
    });

    // 分享按钮点击事件
    shareBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!navigator.share) {
        alert("当前浏览器不支持分享功能");
        return;
      }

      try {
        let textToShare = "";
        console.log("savedSelection:", savedSelection);

        if (savedSelection) {
          textToShare = savedSelection;
          console.log("使用保存的选中文本");
        } else {
          textToShare = frontText;
          console.log("使用全文");
        }

        if (!textToShare) {
          alert("没有可分享的内容");
          return;
        }

        await navigator.share({
          title: "分享文本",
          text: textToShare,
        });

        console.log("分享成功");
        savedSelection = null;
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("分享失败:", error);
          alert("分享失败: " + error.message);
        } else {
          console.log("用户取消分享");
        }
        savedSelection = null;
      }
    });

    container.appendChild(shareBtn);
    return shareBtn;
  }

  // 挂载到 window 对象（供外部调用）
  window.AnkiShare = {
    init: initShareButton,
  };

  // ============ 自动初始化 ============

  (function autoInit() {
    // 等待 DOM 加载完成
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

      // 初始化分享按钮
      initShareButton(container, frontText);
      console.log("分享按钮已自动初始化");
    };

    // 如果 DOM 已加载，立即执行
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
