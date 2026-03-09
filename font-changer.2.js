/**
 * 字体切换器（原生 JS）
 * - 支持 2 种字体时显示 toggle 按钮
 * - 支持 3 种及以上字体时显示 select 下拉框
 * - 使用 localStorage 缓存选择
 * - 通过动态 CSS 实现，支持 DOM 动态更新
 */

(function () {
  "use strict";

  const STORAGE_KEY = "anki_font_pref_v1";
  const STYLE_ID = "anki-font-switcher-style";

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

  /**
   * 生成 CSS 规则字符串
   */
  function generateCSS(font) {
    if (font.isDefault) {
      // 默认字体：只应用到特定选择器及其子元素
      if (!font.targets || font.targets.length === 0) {
        return "";
      }

      const selectors = [];
      font.targets.forEach((target) => {
        selectors.push(target);
        selectors.push(`${target} *`);
      });

      return `
        ${selectors.join(",\n")} {
          font-family: ${font.family} !important;
        }
      `;
    } else {
      // 非默认字体：应用到所有元素
      return `
        * {
          font-family: ${font.family} !important;
        }
      `;
    }
  }

  /**
   * 应用字体样式（通过动态 style 标签）
   */
  function applyFont(font) {
    let styleEl = document.getElementById(STYLE_ID);

    // 如果不存在，创建 style 标签
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }

    // 更新 CSS 内容
    styleEl.textContent = generateCSS(font);
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
    btn.style.marginRight = "8px";
    btn.style.display = "inline-block";

    let currentFontId = getSavedFontId();

    const render = () => {
      const font = getFontById(currentFontId);
      btn.textContent = `字体：${font.name}`;
    };

    // 初次应用
    applyFont(getFontById(currentFontId));
    render();

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Toggle 到下一个字体
      const currentIndex = FONTS.findIndex((f) => f.id === currentFontId);
      const nextIndex = (currentIndex + 1) % FONTS.length;
      currentFontId = FONTS[nextIndex].id;

      applyFont(getFontById(currentFontId));
      saveFontId(currentFontId);
      render();
    });

    container.insertBefore(btn, container.firstChild);
  }

  /**
   * 创建 Select 下拉框（3种及以上字体时使用）
   */
  function createSelectDropdown(container) {
    const wrapper = document.createElement("span");
    wrapper.style.marginRight = "8px";
    wrapper.style.display = "inline-block";

    const label = document.createElement("label");
    label.textContent = "字体：";
    label.style.marginRight = "4px";

    const select = document.createElement("select");
    select.style.fontSize = "18px";
    select.style.padding = "3px 8px";
    select.style.border = "none";
    select.style.borderRadius = "3px";
    select.style.background = "#f0eeef";
    select.style.cursor = "pointer";

    // 添加选项
    FONTS.forEach((font) => {
      const option = document.createElement("option");
      option.value = font.id;
      option.textContent = font.name;
      select.appendChild(option);
    });

    // 设置初始值
    const currentFontId = getSavedFontId();
    select.value = currentFontId;
    applyFont(getFontById(currentFontId));

    // 监听变化
    select.addEventListener("change", (e) => {
      const fontId = e.target.value;
      applyFont(getFontById(fontId));
      saveFontId(fontId);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    container.insertBefore(wrapper, container.firstChild);
  }

  /**
   * 初始化字体切换器
   */
  function initFontSwitcher(container) {
    if (FONTS.length === 0) {
      console.warn("没有配置任何字体");
      return;
    }

    if (FONTS.length === 1) {
      // 只有一种字体，直接应用，不显示控件
      applyFont(FONTS[0]);
      return;
    }

    if (FONTS.length === 2) {
      createToggleButton(container);
    } else {
      createSelectDropdown(container);
    }
  }

  /**
   * 自动初始化
   */
  (function autoInit() {
    const init = () => {
      const container = document.getElementById("button-container");
      if (!container) return;
      initFontSwitcher(container);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
