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

  const FONT_MINCHO = "HinaMincho-Regular";
  const FONT_WENKAI = "LXGWWenKai-Regular";

  const TARGETS = [".listenOnlyIndicator", "#front", "#example", "#def"];

  function applyFontImportant(fontFamily) {
    TARGETS.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        // 覆盖本元素（带 !important）
        el.style.setProperty("font-family", fontFamily, "important");
        // 覆盖其所有子元素（因为你 CSS 里也对 * 写死了）
        el.querySelectorAll("*").forEach((child) => {
          child.style.setProperty("font-family", fontFamily, "important");
        });
      });
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
    btn.type = "button";
    btn.style.marginRight = "8px";
    btn.style.display = "inline-block";

    let currentFont = getSavedFont();

    const render = () => {
      btn.textContent =
        currentFont === FONT_WENKAI ? "字体：文楷" : "字体：明朝";
    };

    // 初次应用
    applyFontImportant(currentFont);
    render();

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      currentFont = currentFont === FONT_WENKAI ? FONT_MINCHO : FONT_WENKAI;
      applyFontImportant(currentFont);
      saveFont(currentFont);
      render();
    });

    // 放最前面
    container.insertBefore(btn, container.firstChild);
  }

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
