/**
 * TTS 播放功能模块 - ElevenLabs版本（带缓存）
 * 自动初始化，无需手动调用
 * 支持音频缓存，避免重复请求
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
   * 初始化全局音频管理器和缓存
   */
  function initAudioManager() {
    if (!window.ankiAudioManager) {
      window.ankiAudioManager = {
        currentAudio: null,
        currentCardText: null,
        currentCardSide: null,
        audioCache: new Map(), // 音频缓存：key = text, value = blob
        stopAll: function () {
          if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
          }
          this.currentCardText = null;
          this.currentCardSide = null;
        },
        getCachedAudio: function (text) {
          return this.audioCache.get(text);
        },
        setCachedAudio: function (text, blob) {
          this.audioCache.set(text, blob);
          console.log(`Audio cached. Cache size: ${this.audioCache.size}`);
        },
        clearCache: function () {
          this.audioCache.clear();
          console.log("Audio cache cleared");
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
   * 使用 ElevenLabs API 获取音频（带缓存）
   */
  async function fetchElevenLabsAudio(text) {
    // 检查缓存
    const cachedBlob = window.ankiAudioManager.getCachedAudio(text);
    if (cachedBlob) {
      console.log("Using cached audio");
      return cachedBlob;
    }

    console.log("Fetching new audio from API");
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

    const blob = await response.blob();

    // 缓存音频
    window.ankiAudioManager.setCachedAudio(text, blob);

    return blob;
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
      console.log("New card detected");
      window.ankiAudioManager.stopAll();
      window.ankiAudioManager.currentCardText = currentCardText;
      window.ankiAudioManager.currentCardSide = currentCardSide;
    } else if (isCardFlippedToBack) {
      console.log("Card flipped to back");
      window.ankiAudioManager.stopAll();
      window.ankiAudioManager.currentCardSide = currentCardSide;
    } else if (
      !isNewCard &&
      currentCardSide === window.ankiAudioManager.currentCardSide
    ) {
      // 同一张卡片，同一面，不重新加载UI
      console.log("Same card, same side, skipping UI reload");
      return;
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

    // 创建播放按钮
    const playBtn = document.createElement("button");
    playBtn.textContent = "播放";
    playBtn.setAttribute(
      "style",
      "user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; -webkit-touch-callout: none; display: inline-block; padding: 5px 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;",
    );
    playBtn.setAttribute("unselectable", "on");
    playBtn.onselectstart = () => false;

    container.insertBefore(playBtn, container.firstChild);

    // 音频元素（延迟创建）
    let audio = null;
    let audioLoaded = false;
    let isLoading = false;

    const playAudio = async () => {
      if (!isCurrentCard()) {
        console.log("Card changed, not playing");
        return;
      }

      // 如果正在加载，忽略点击
      if (isLoading) {
        console.log("Already loading, ignoring click");
        return;
      }

      // 如果音频已经加载，直接播放
      if (audioLoaded && audio) {
        console.log("Playing existing audio");
        window.ankiAudioManager.stopAll();
        audio.currentTime = 0;
        try {
          await audio.play();
          window.ankiAudioManager.currentAudio = audio;
        } catch (error) {
          console.error("Play error:", error);
        }
        return;
      }

      // 标记为正在加载
      isLoading = true;

      try {
        console.log("Fetching audio...");

        // 获取音频（可能从缓存）
        const audioBlob = await fetchElevenLabsAudio(fullText);

        if (!isCurrentCard()) {
          console.log("Card changed during fetch, aborting");
          isLoading = false;
          return;
        }

        // 创建音频元素
        audio = document.createElement("audio");
        audio.preload = "auto";
        audio.src = URL.createObjectURL(audioBlob);

        audio.addEventListener("play", () => {
          if (!isCurrentCard()) {
            audio.pause();
            audio.currentTime = 0;
            return;
          }
          window.ankiAudioManager.currentAudio = audio;
          window.ankiAudioManager.currentCardSide = currentCardSide;
        });

        audio.addEventListener("ended", () => {
          // 注意：不清理 URL，因为可能会重复播放
        });

        audio.addEventListener("error", (e) => {
          console.error("Audio error:", e);
        });

        audioLoaded = true;
        isLoading = false;

        // 播放音频
        window.ankiAudioManager.stopAll();
        audio.currentTime = 0;
        await audio.play();
        window.ankiAudioManager.currentAudio = audio;
        window.ankiAudioManager.currentCardText = currentCardText;
        window.ankiAudioManager.currentCardSide = currentCardSide;

        console.log("Audio playing");
      } catch (err) {
        console.error("Error:", err);
        isLoading = false;
      }
    };

    playBtn.addEventListener("click", playAudio);

    // 双击停止
    playBtn.addEventListener("dblclick", () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        if (window.ankiAudioManager.currentAudio === audio) {
          window.ankiAudioManager.currentAudio = null;
        }
      }
    });
  })();
})();
