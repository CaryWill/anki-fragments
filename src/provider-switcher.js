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

// 自动初始化：在 button-container 中添加切换按钮
(function init() {
  const container = document.getElementById("button-container");
  if (!container) return;
  
  const btn = createSwitchButton();
  container.appendChild(btn);
})();

// 导出函数供其他模块使用（如果需要）
window.TtsProviderSwitcher = {
  getCurrentProvider,
  setCurrentProvider,
  createSwitchButton,
};
