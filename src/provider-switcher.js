/**
 * provider-switcher.js — TTS Provider 切换按钮
 *
 * 功能：
 *   - 创建一个切换按钮，在 Azure 和 VoiceVox 之间切换
 *   - 将当前选择的 provider 存储到 localStorage
 *   - tts.js 会读取 localStorage 来决定使用哪个 provider
 */

"use strict";

const STORAGE_KEY = "tts_provider";
const PROVIDERS = ["azure", "voicevox"];

// 从 localStorage 获取当前 provider，默认为 voicevox
function getCurrentProvider() {
  const stored = localStorage.getItem(STORAGE_KEY);
  return PROVIDERS.includes(stored) ? stored : "voicevox";
}

// 保存 provider 到 localStorage
function setCurrentProvider(provider) {
  if (PROVIDERS.includes(provider)) {
    localStorage.setItem(STORAGE_KEY, provider);
  }
}

// 创建切换按钮
function createSwitchButton() {
  const btn = document.createElement("button");
  btn.textContent = getCurrentProvider() === "azure" ? "A" : "V";
  btn.style.cssText =
    "user-select:none;-webkit-user-select:none;display:inline-block;margin-bottom:40px;";
  btn.setAttribute("unselectable", "on");
  btn.onselectstart = () => false;
  
  btn.addEventListener("click", () => {
    const current = getCurrentProvider();
    const next = current === "azure" ? "voicevox" : "azure";
    setCurrentProvider(next);
    btn.textContent = next === "azure" ? "Azure" : "VoiceVox";
    
    // 触发自定义事件，通知 tts.js 重新加载
    window.dispatchEvent(new CustomEvent("ttsProviderChanged", { 
      detail: { provider: next } 
    }));
  });
  
  return btn;
}

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

// 自动初始化：在 button-container 中添加切换按钮
(function autoInit() {
  let observer = null;
  
  const init = () => {
    const container = document.getElementById("button-container");
    if (!container) {
      console.warn("[provider-switcher] 未找到 button-container 元素");
      return;
    }
    
    // 避免重复添加
    if (container.querySelector('[data-provider-switcher]')) {
      return;
    }
    
    const btn = createSwitchButton();
    btn.setAttribute("data-provider-switcher", "true");
    btn.setAttribute("data-order", "2");
    container.appendChild(btn);
    sortButtons(container);
    console.log("[provider-switcher] 切换按钮已初始化");
  };

  const startObserver = () => {
    if (observer) {
      observer.disconnect();
    }
    
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 检查是否是 button-container 被添加
            if (node.id === "button-container" || node.querySelector?.("#button-container")) {
              init();
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    console.log("[provider-switcher] MutationObserver 已启动");
  };

  // 等待 DOM 加载完成
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init();
      startObserver();
    });
  } else {
    // 使用 setTimeout 确保 DOM 完全准备好（适用于 Anki 动态加载场景）
    setTimeout(() => {
      init();
      startObserver();
    }, 0);
  }
})();

// 导出函数供其他模块使用（如果需要）
window.TtsProviderSwitcher = {
  getCurrentProvider,
  setCurrentProvider,
  createSwitchButton,
};