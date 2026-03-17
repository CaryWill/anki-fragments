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

  // ===== 配置区：在这里添加/删除字体 =====
  const FONTS = [
    {
      id: "mincho",
      name: "明朝",
      family: "HinaMincho-Regular",
      isDefault: true, // 默认字体，只应用到特定元素
      targets: [".listenOnlyIndicator", "#front", "#example", "#def"],
    },
    {
      id: "wenkai",
      name: "文楷",
      family: "LXGWWenKai-Regular",
      isDefault: false, // 非默认字体，应用到所有元素
    },
    // 可以继续添加更多字体
    // {
    //   id: "huiwen",
    //   name: "惠文",
    //   family: "Huiwen Mincho Font",
    //   isDefault: false,
    // },
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
   * 应用默认字体（只针对特定选择器，其他元素移除 inline style）
   */
  function applyDefaultFont(font) {
    // 1. 先清除所有元素的 inline font-family（排除按钮）
    document.querySelectorAll("*").forEach((el) => {
      if (!shouldExcludeElement(el)) {
        el.style.removeProperty("font-family");
      }
    });

    // 2. 只给目标元素应用该字体
    if (font.targets && font.targets.length > 0) {
      font.targets.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (!shouldExcludeElement(el)) {
            el.style.setProperty("font-family", font.family, "important");
            // 同时应用到子元素
            el.querySelectorAll("*").forEach((child) => {
              if (!shouldExcludeElement(child)) {
                child.style.setProperty(
                  "font-family",
                  font.family,
                  "important",
                );
              }
            });
          }
        });
      });
    }
  }

  /**
   * 应用字体到新添加的元素
   */
  function applyFontToElement(element, font) {
    // 跳过按钮等控件
    if (shouldExcludeElement(element)) {
      return;
    }

    if (font.isDefault) {
      // 默认字体模式：检查元素是否在目标选择器内
      const isInTarget = font.targets.some((selector) => {
        return element.matches(selector) || element.closest(selector);
      });

      if (isInTarget) {
        element.style.setProperty("font-family", font.family, "important");
        // 应用到其子元素
        element.querySelectorAll("*").forEach((child) => {
          if (!shouldExcludeElement(child)) {
            child.style.setProperty("font-family", font.family, "important");
          }
        });
      }
    } else {
      // 非默认字体：应用到所有元素
      element.style.setProperty("font-family", font.family, "important");
      element.querySelectorAll("*").forEach((child) => {
        if (!shouldExcludeElement(child)) {
          child.style.setProperty("font-family", font.family, "important");
        }
      });
    }
  }

  /**
   * 根据字体配置应用样式
   */
  function applyFont(font) {
    currentFont = font;

    if (font.isDefault) {
      applyDefaultFont(font);
    } else {
      applyFontToAll(font.family);
    }

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
        // 处理新添加的节点
        mutation.addedNodes.forEach((node) => {
          // 只处理元素节点
          if (node.nodeType === Node.ELEMENT_NODE) {
            applyFontToElement(node, currentFont);
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
      btn.textContent = `字体：${font.name}`;
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

    container.insertBefore(btn, container.firstChild);

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
    label.textContent = "字体：";
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
    container.insertBefore(wrapper, container.firstChild);

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
