/**
 * ElevenLabs TTS 播放功能模块
 * 自动初始化，无需手动调用
 * 支持音频缓存和卡片切换检测
 */

(function () {
  "use strict";

  // ============ 配置 ============

  /**
   * API 密钥配置
   * 在这里修改你的 API 密钥
   */
  const API_KEY = "sk_9b792f2b4ff0546e4c7c65e2a6d2972f74eb1fd04cff96e5";
  const VOICE_ID = "80H5qqdq3bIO8OjFE6ue";
  // const VOICE_ID = "EkK6wL8GaH8IgBZTTDGJ";

  // ============ 工具函数 ============

  /**
   * 初始化全局音频管理器和缓存
   */
  function initAudioManager() {
    if (!window.ankiAudioManager) {
      window.ankiAudioManager = {
        currentAudio: null,
        currentCardText: null,
        audioCache: new Map(), // 音频缓存
        stopAll: function () {
          if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
          }
          this.currentCardText = null;
        },
      };
    }
  }

  /**
   * 获取音频（带缓存）
   */
  async function fetchAudio(text) {
    const cache = window.ankiAudioManager.audioCache;

    // 检查缓存
    if (cache.has(text)) {
      console.log("Using cached audio");
      return cache.get(text);
    }

    console.log("Fetching new audio from ElevenLabs API");
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // 缓存音频URL
    cache.set(text, audioUrl);

    return audioUrl;
  }

  // ============ 自动初始化 ============

  (async () => {
    const container = document.getElementById("button-container");
    if (!container) return;

    // 获取文本内容
    const frontElement = document.getElementById("front");
    const exampleElement = document.getElementById("example");

    if (!frontElement) return;

    const frontText = frontElement.textContent.trim();
    const exampleText = exampleElement ? exampleElement.textContent.trim() : "";
    const fullText = frontText + (exampleText ? " \n " + exampleText : "");
    const currentCardText = frontText;

    if (!frontText) return;

    // 初始化音频管理器
    initAudioManager();

    // 检查卡片内容是否变化
    const isNewCard =
      window.ankiAudioManager.currentCardText !== currentCardText;

    if (isNewCard) {
      console.log("Card text changed, stopping previous audio");
      window.ankiAudioManager.stopAll();
      window.ankiAudioManager.currentCardText = currentCardText;
    }

    // 生成唯一标识符用于跟踪当前卡片
    const cardId = `card-${Date.now()}-${Math.random()}`;
    container.dataset.cardId = cardId;

    // 检测是否是当前卡片
    function isCurrentCard() {
      const currentFront = document.getElementById("front")?.textContent.trim();
      return (
        currentFront === currentCardText && container.dataset.cardId === cardId
      );
    }

    const loading = document.createElement("div");
    // loading.textContent = "加载中...";
    container.insertBefore(loading, container.firstChild);

    try {
      const audioUrl = await fetchAudio(fullText);

      if (!isCurrentCard()) {
        console.log("Card changed during fetch, aborting");
        loading.remove();
        return;
      }

      loading.remove();

      // 创建音频元素
      const audio = document.createElement("audio");
      audio.style.display = "none";
      audio.src = audioUrl;
      audio.addEventListener("click", (e) => e.stopPropagation());

      audio.addEventListener("play", () => {
        if (!isCurrentCard()) {
          audio.pause();
          audio.currentTime = 0;
          return;
        }
        window.ankiAudioManager.currentAudio = audio;
      });

      audio.addEventListener("playing", () => {
        if (!isCurrentCard()) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      container.appendChild(audio);

      // 创建播放按钮
      const playBtn = document.createElement("button");
      playBtn.textContent = "播放";
      playBtn.setAttribute(
        "style",
        "user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; -webkit-touch-callout: none; display: inline-block;",
      );
      playBtn.setAttribute("unselectable", "on");
      playBtn.onselectstart = () => false;

      container.insertBefore(playBtn, container.firstChild);

      const playAudio = () => {
        if (!isCurrentCard()) {
          console.log("Card changed, not playing");
          return;
        }
        window.ankiAudioManager.stopAll();
        audio.currentTime = 0;
        audio.play();
        window.ankiAudioManager.currentAudio = audio;
        window.ankiAudioManager.currentCardText = currentCardText;
      };

      playBtn.addEventListener("click", playAudio);

      playBtn.addEventListener("dblclick", () => {
        audio.pause();
        audio.currentTime = 0;
        if (window.ankiAudioManager.currentAudio === audio) {
          window.ankiAudioManager.currentAudio = null;
        }
      });

      // 自动播放（可选）
      // 只在新卡片且不包含特定字符时自动播放
      const shouldAutoPlay = isNewCard && !frontText.includes(',"');

      if (shouldAutoPlay && isCurrentCard()) {
        playAudio();
      }
    } catch (err) {
      loading.textContent = "加载失败";
      console.error("ElevenLabs TTS Error:", err);
    }
  })();
})();
