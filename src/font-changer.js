/**
 * 字体切换器（原生 JS）
 * - 支持 2 种字体时显示 toggle 按钮
 * - 支持 3 种及以上字体时显示 select 下拉框
 * - 使用 localStorage 缓存选择
 * - 使用 MutationObserver 监听 DOM 变化自动应用字体
 */

(function () {
  "use strict";

  const STORAGE_KEY = "anki_font_pref_v1";
  const BUTTON_CLASS = "font-switcher-button"; // 标记按钮，避免被字体样式影响

  // 排序按钮函数
  function sortButtons(container) {
    const buttons = Array.from(container.children);
    buttons.sort((a, b) => {
      const orderA = parseInt(a.getAttribute("data-order") || "99", 10);
      const orderB = parseInt(b.getAttribute("data-order") || "99", 10);
      return orderA - orderB;
    });
    buttons.forEach((btn) => container.appendChild(btn));
  }

  // ===== 配置区：在这里添加/删除字体 =====
  const FONTS = [
    {
      id: "wenkai",
      name: "霞鹜文楷",
      family: "LXGWWenKai-Regular",
    },
    {
      id: "neoxihei",
      name: "霞鹜新晰黑",
      family: "LXGWNeoXiHeiScreenFull",
    },
  ];
  // ===== 配置区结束 =====

  let currentFont = null;
  let observer = null;

  /**
   * 检查元素是否应该被排除（如按钮等控件）
   */
  function shouldExcludeElement(element) {
    // 检查是否是字体切换按钮或其子元素
    if (element.classList && element.classList.contains(BUTTON_CLASS)) {
      return true;
    }
    if (element.closest && element.closest(`.${BUTTON_CLASS}`)) {
      return true;
    }
    // 检查是否有 data 属性标记
    if (element.hasAttribute && element.hasAttribute("data-font-switcher")) {
      return true;
    }
    // 检查是否是 #button-container 中的 button 或 select
    if (element.tagName === "BUTTON" || element.tagName === "SELECT") {
      const container = element.closest("#button-container");
      if (container) {
        return true;
      }
    }
    return false;
  }

  /**
   * 应用字体到所有元素（排除按钮）
   */
  function applyFontToAll(fontFamily) {
    document.querySelectorAll("*").forEach((el) => {
      if (!shouldExcludeElement(el)) {
        el.style.setProperty("font-family", fontFamily, "important");
      }
    });
  }

  /**
   * 应用字体到新添加的元素
   */
  function applyFontToElement(element, fontFamily) {
    if (shouldExcludeElement(element)) {
      return;
    }
    element.style.setProperty("font-family", fontFamily, "important");
    element.querySelectorAll("*").forEach((child) => {
      if (!shouldExcludeElement(child)) {
        child.style.setProperty("font-family", fontFamily, "important");
      }
    });
  }

  /**
   * 根据字体配置应用样式
   */
  function applyFont(font) {
    currentFont = font;
    applyFontToAll(font.family);
    console.log(`✅ 字体已切换到: ${font.name}`);
  }

  /**
   * 启动 MutationObserver 监听 DOM 变化
   */
  function startObserver() {
    // 如果已有 observer，先断开
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      if (!currentFont) return;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            applyFontToElement(node, currentFont.family);
          }
        });
      });
    });

    // 开始监听整个 body 的变化
    observer.observe(document.body, {
      childList: true, // 监听子节点的添加和删除
      subtree: true, // 监听所有后代节点
    });

    console.log("🔍 MutationObserver 已启动");
  }

  /**
   * 根据 ID 获取字体配置
   */
  function getFontById(id) {
    return FONTS.find((f) => f.id === id) || FONTS[0];
  }

  function getSavedFontId() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return FONTS.some((f) => f.id === saved) ? saved : FONTS[0].id;
  }

  function saveFontId(id) {
    localStorage.setItem(STORAGE_KEY, id);
  }

  /**
   * 创建 Toggle 按钮（2种字体时使用）
   */
  function createToggleButton(container) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = BUTTON_CLASS; // 添加标记类
    btn.setAttribute("data-font-switcher", "true"); // 额外标记

    let currentFontId = getSavedFontId();

    const render = () => {
      const font = getFontById(currentFontId);
      btn.textContent = `${font.name}`;
    };

    render();

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log("🖱️ 按钮被点击");

      // Toggle 到下一个字体
      const currentIndex = FONTS.findIndex((f) => f.id === currentFontId);
      const nextIndex = (currentIndex + 1) % FONTS.length;
      currentFontId = FONTS[nextIndex].id;

      console.log(`🔄 切换到: ${currentFontId}`);

      applyFont(getFontById(currentFontId));
      saveFontId(currentFontId);
      render();
    });

    // 确保按钮可点击
    btn.style.pointerEvents = "auto";
    btn.style.cursor = "pointer";

    btn.setAttribute("data-order", "3");
    container.appendChild(btn);
    sortButtons(container);

    console.log("✨ 按钮已创建并添加到页面");
  }

  /**
   * 创建 Select 下拉框（3种及以上字体时使用）
   */
  function createSelectDropdown(container) {
    const wrapper = document.createElement("span");
    wrapper.style.marginRight = "8px";
    wrapper.style.display = "inline-block";
    wrapper.className = BUTTON_CLASS; // 添加标记类
    wrapper.setAttribute("data-font-switcher", "true");

    const label = document.createElement("label");
    label.textContent = "";
    label.style.marginRight = "4px";
    label.setAttribute("data-font-switcher", "true");

    const select = document.createElement("select");
    select.className = BUTTON_CLASS; // 添加标记类
    select.setAttribute("data-font-switcher", "true");

    // 添加选项
    FONTS.forEach((font) => {
      const option = document.createElement("option");
      option.value = font.id;
      option.textContent = font.name;
      option.setAttribute("data-font-switcher", "true");
      select.appendChild(option);
    });

    // 设置初始值
    const currentFontId = getSavedFontId();
    select.value = currentFontId;

    // 监听变化
    select.addEventListener("change", (e) => {
      console.log("🖱️ 下拉框被改变");
      const fontId = e.target.value;
      console.log(`🔄 切换到: ${fontId}`);
      applyFont(getFontById(fontId));
      saveFontId(fontId);
    });

    // 确保下拉框可点击
    select.style.pointerEvents = "auto";
    select.style.cursor = "pointer";

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    wrapper.setAttribute("data-order", "3");
    container.appendChild(wrapper);
    sortButtons(container);

    console.log("✨ 下拉框已创建并添加到页面");
  }

  /**
   * 初始化字体切换器
   */
  function initFontSwitcher(container) {
    if (FONTS.length === 0) {
      console.warn("没有配置任何字体");
      return;
    }

    // 先创建 UI 控件（在应用字体之前）
    if (FONTS.length === 2) {
      createToggleButton(container);
    } else if (FONTS.length > 2) {
      createSelectDropdown(container);
    }

    // 然后应用保存的字体（此时按钮已存在，会被排除）
    if (FONTS.length > 1) {
      const savedFontId = getSavedFontId();
      applyFont(getFontById(savedFontId));
    } else {
      // 只有一种字体
      applyFont(FONTS[0]);
    }

    // 启动 Observer
    startObserver();
  }

  /**
   * 自动初始化
   */
  (function autoInit() {
    const init = () => {
      const container = document.getElementById("button-container");
      if (!container) {
        console.warn("找不到 #button-container");
        // 即使找不到容器，也应用保存的字体
        const savedFontId = getSavedFontId();
        applyFont(getFontById(savedFontId));
        startObserver();
        return;
      }

      initFontSwitcher(container);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      // 使用 setTimeout 确保 DOM 完全准备好
      setTimeout(init, 0);
    }
  })();
})();