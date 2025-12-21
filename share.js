/**
 * 分享功能模块
 * 用于创建和管理文本分享功能
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

  // 挂载到 window 对象
  window.AnkiShare = {
    init: initShareButton,
  };
})();
