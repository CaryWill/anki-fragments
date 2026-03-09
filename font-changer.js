/**
 * 字体切换按钮（原生 JS）
 * - 在 #button-container 里插入一个按钮（放最前面）
 * - 作用范围：.listenOnlyIndicator, #front, #example, #def
 * - 默认字体：HinaMincho-Regular.ttf
 * - 可切换字体：LXGWWenKai-Regular.ttf
 * - 使用 localStorage 缓存选择
 *
 * 说明：确保这两个字体在 Anki 的 media collection 中，并且 CSS 里已 @font-face 命名为
 * "HinaMincho-Regular" / "LXGWWenKai-Regular"（或按你的实际 font-family 名称改下面常量）
 */
(function () {
  "use strict";

  const STORAGE_KEY = "anki_font_pref_v1";

  // 按你的 @font-face 的 font-family 名称修改这里
  const FONT_MINCHO = "HinaMincho-Regular";
  const FONT_WENKAI = "LXGWWenKai-Regular";

  const TARGET_SELECTOR = ".listenOnlyIndicator, #front, #example, #def";

  function applyFont(fontFamily) {
    document.querySelectorAll(TARGET_SELECTOR).forEach((el) => {
      el.style.fontFamily = fontFamily;
    });
  }

  function getSavedFont() {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === FONT_WENKAI || v === FONT_MINCHO ? v : FONT_MINCHO;
  }

  function saveFont(fontFamily) {
    localStorage.setItem(STORAGE_KEY, fontFamily);
  }

  function initFontToggleButton(container) {
    const btn = document.createElement("button");
    btn.setAttribute("type", "button");
    btn.setAttribute("style", "margin-right: 10px; display: inline-block;");
    btn.setAttribute("aria-label", "切换字体");

    const renderText = (currentFont) => {
      btn.textContent =
        currentFont === FONT_WENKAI ? "字体：文楷" : "字体：明朝";
    };

    // 初始应用（从缓存读）
    let currentFont = getSavedFont();
    applyFont(currentFont);
    renderText(currentFont);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      currentFont = currentFont === FONT_WENKAI ? FONT_MINCHO : FONT_WENKAI;
      applyFont(currentFont);
      saveFont(currentFont);
      renderText(currentFont);
    });

    // 放到最前面
    container.insertBefore(btn, container.firstChild);
    return btn;
  }

  // 自动初始化
  (function autoInit() {
    const init = () => {
      const container = document.getElementById("button-container");
      if (!container) return;

      initFontToggleButton(container);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
