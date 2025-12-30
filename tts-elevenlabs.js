/**
 * TTS 播放功能模块 - ElevenLabs版本
 * 自动初始化，无需手动调用
 * 支持检测卡片翻转（front <-> back）
 */

(function () {
  "use strict";

  // ============ 配置 ============

  /**
   * ElevenLabs API 配置
   */
  const ELEVENLABS_API_KEY =
    "sk_9b792f2b4ff0546e4c7c65e2a6d2972f74eb1fd04cff96e5";
  const VOICE_ID = "EkK6wL8GaH8IgBZTTDGJ"; // 日语语音ID
  const MODEL_ID = "eleven_flash_v2_5";

  // ============ 工具函数 ============

  /**
   * 初始化全局音频管理器
   */
  function initAudioManager() {
    if (!window.ankiAudioManager) {
      window.ankiAudioManager = {
        currentAudio: null,
        currentCardText: null,
        currentCardSide: null,
        stopAll: function () {
          if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
          }
          this.currentCardText = null;
          this.currentCardSide = null;
        },
      };
    }
  }

  /**
   * 检测当前卡片面（front 或 back）
   */
  function detectCardSide() {
    const backElement = document.getElementById("back");
    return backElement ? "back" : "front";
  }

  /**
   * 使用 ElevenLabs API 获取音频
   */
  async function fetchElevenLabsAudio(text) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ElevenLabs API error: ${response.status} - ${errorText}`,
      );
    }

    return await response.blob();
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
    const fullText = exampleText ? `${frontText}\n${exampleText}` : frontText;
    const currentCardText = frontText;
    const currentCardSide = detectCardSide();

    if (!frontText) return;

    // 初始化音频管理器
    initAudioManager();

    // 检查卡片内容或卡片面是否变化
    const isNewCard =
      window.ankiAudioManager.currentCardText !== currentCardText;
    const isCardFlippedToBack =
      window.ankiAudioManager.currentCardSide === "front" &&
      currentCardSide === "back";

    if (isNewCard) {
      console.log("Card text changed, stopping previous audio");
      window.ankiAudioManager.stopAll();
      window.ankiAudioManager.currentCardText = currentCardText;
      window.ankiAudioManager.currentCardSide = currentCardSide;
    } else if (isCardFlippedToBack) {
      console.log("Card flipped to back, stopping previous audio");
      window.ankiAudioManager.stopAll();
      window.ankiAudioManager.currentCardSide = currentCardSide;
    }

    // 生成唯一标识符用于跟踪当前卡片
    const cardId = `card-${Date.now()}-${Math.random()}`;
    container.dataset.cardId = cardId;
    container.dataset.cardSide = currentCardSide;

    // 检测是否是当前卡片且在同一面
    function isCurrentCard() {
      const currentFront = document.getElementById("front")?.textContent.trim();
      const currentSide = detectCardSide();
      return (
        currentFront === currentCardText &&
        container.dataset.cardId === cardId &&
        container.dataset.cardSide === currentSide
      );
    }

    const loading = document.createElement("div");
    loading.textContent = "正在生成音频...";
    container.insertBefore(loading, container.firstChild);

    try {
      // 使用 ElevenLabs API 获取音频
      const audioBlob = await fetchElevenLabsAudio(fullText);

      if (!isCurrentCard()) {
        console.log("Card changed during fetch, aborting");
        return;
      }

      loading.remove();

      // 创建音频元素
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.style.marginTop = "10px";
      audio.style.display = "none";
      audio.src = URL.createObjectURL(audioBlob);
      audio.addEventListener("click", (e) => e.stopPropagation());

      audio.addEventListener("play", () => {
        if (!isCurrentCard()) {
          audio.pause();
          audio.currentTime = 0;
          return;
        }
        window.ankiAudioManager.currentAudio = audio;
        window.ankiAudioManager.currentCardSide = currentCardSide;
      });

      audio.addEventListener("playing", () => {
        if (!isCurrentCard()) {
          audio.pause();
          audio.currentTime = 0;
        }
      });

      // 清理URL
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(audio.src);
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
          console.log("Card changed or flipped, not playing");
          return;
        }
        window.ankiAudioManager.stopAll();
        audio.currentTime = 0;
        audio.play();
        window.ankiAudioManager.currentAudio = audio;
        window.ankiAudioManager.currentCardText = currentCardText;
        window.ankiAudioManager.currentCardSide = currentCardSide;
      };

      playBtn.addEventListener("click", playAudio);

      playBtn.addEventListener("dblclick", () => {
        audio.pause();
        audio.currentTime = 0;
        if (window.ankiAudioManager.currentAudio === audio) {
          window.ankiAudioManager.currentAudio = null;
        }
      });

      // 只在新卡片、翻转到back面、或在 front 面且不包含特定字符时自动播放
      const shouldAutoPlay =
        (isNewCard &&
          currentCardSide === "front" &&
          !frontText.includes(',"')) ||
        isCardFlippedToBack;

      if (shouldAutoPlay && isCurrentCard()) {
        playAudio();
      }
    } catch (err) {
      loading.textContent = `错误: ${err.message}`;
      console.error("ElevenLabs TTS Error:", err);
    }
  })();
})();
