/**
 * TTS 播放功能模块
 * 自动初始化，无需手动调用
 */

(function () {
  "use strict";

  // ============ 配置 ============

  /**
   * API 密钥配置
   * 在这里修改你的 API 密钥
   */
  const API_KEY = "J492I153g8Z6308";

  // ============ 工具函数 ============

  /**
   * 初始化全局音频管理器
   */
  function initAudioManager() {
    if (!window.ankiAudioManager) {
      window.ankiAudioManager = {
        currentAudio: null,
        currentCardText: null,
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
   * 检查 API 密钥状态
   */
  async function checkApiKey() {
    try {
      const response = await fetch(
        `https://deprecatedapis.tts.quest/v2/api/?key=${API_KEY}`,
      );
      const data = await response.json();

      if (data.errorMessage) {
        return { valid: false, error: data.errorMessage };
      }

      return { valid: true };
    } catch (error) {
      console.error("API key check error:", error);
      return { valid: true }; // Continue if check fails
    }
  }

  /**
   * 获取 WAV 音频
   */
  async function fetchWavBlob(frontText, exampleText) {
    const url =
      `https://deprecatedapis.tts.quest/v2/voicevox/audio/?key=${API_KEY}&speaker=2&pitch=0&intonationScale=1&speed=1&text=` +
      encodeURIComponent(frontText + " \n " + exampleText);

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch audio");
    return await res.blob();
  }

  /**
   * 解码 WAV 音频
   */
  async function decodeWavBlob(blob) {
    const buf = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return await audioCtx.decodeAudioData(buf);
  }

  /**
   * 转换浮点数组为 16位 PCM
   */
  function floatTo16BitPCM(float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  /**
   * 转换 AudioBuffer 为 MP3
   */
  function audioBufferToMp3(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
    const mp3Data = [];
    const samplesPerFrame = 1152;

    if (numChannels === 1) {
      const data = floatTo16BitPCM(audioBuffer.getChannelData(0));
      for (let i = 0; i < data.length; i += samplesPerFrame) {
        const chunk = data.subarray(
          i,
          i + Math.min(samplesPerFrame, data.length - i),
        );
        const mp3buf = mp3encoder.encodeBuffer(chunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
    } else {
      const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
      const right = floatTo16BitPCM(audioBuffer.getChannelData(1));
      for (let i = 0; i < left.length; i += samplesPerFrame) {
        const leftChunk = left.subarray(
          i,
          i + Math.min(samplesPerFrame, left.length - i),
        );
        const rightChunk = right.subarray(
          i,
          i + Math.min(samplesPerFrame, right.length - i),
        );
        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) mp3Data.push(mp3buf);
      }
    }

    const end = mp3encoder.flush();
    if (end.length > 0) mp3Data.push(end);
    return new Blob(mp3Data, { type: "audio/mpeg" });
  }

  // ============ 自动初始化 ============

  (async () => {
    const container = document.getElementById("button-container");
    if (!container) return;

    // 检查 API 密钥
    const apiKeyStatus = await checkApiKey();

    if (!apiKeyStatus.valid) {
      // 显示错误按钮
      const errorBtn = document.createElement("button");
      errorBtn.textContent = `Error: ${apiKeyStatus.error}`;
      errorBtn.style.cssText =
        "background-color: #dc3545; color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: not-allowed;";
      errorBtn.disabled = true;
      container.insertBefore(errorBtn, container.firstChild);
      return;
    }

    // 获取文本内容
    const frontElement = document.getElementById("front");
    const exampleElement = document.getElementById("example");

    if (!frontElement) return;

    const frontText = frontElement.textContent.trim();
    const exampleText = exampleElement ? exampleElement.textContent.trim() : "";
    const currentCardText = frontText;

    if (!frontText) return;

    // 初始化音频管理器
    initAudioManager();

    // 检查卡片内容是否变化
    if (window.ankiAudioManager.currentCardText !== currentCardText) {
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
    loading.textContent = "";
    container.insertBefore(loading, container.firstChild);

    try {
      const wavBlob = await fetchWavBlob(frontText, exampleText);

      if (!isCurrentCard()) {
        console.log("Card changed during fetch, aborting");
        return;
      }

      const audioBuffer = await decodeWavBlob(wavBlob);

      if (!isCurrentCard()) {
        console.log("Card changed during decode, aborting");
        return;
      }

      const mp3Blob = audioBufferToMp3(audioBuffer);

      if (!isCurrentCard()) {
        console.log("Card changed during conversion, aborting");
        return;
      }

      loading.remove();

      // 创建音频元素
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.style.marginTop = "10px";
      audio.style.display = "none";
      audio.src = URL.createObjectURL(mp3Blob);
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

      // 默认播放（如果不包含特定字符）
      if (!frontText.includes(',"') && isCurrentCard()) {
        playAudio();
      }
    } catch (err) {
      loading.textContent = "";
      console.error("TTS Error:", err);
    }
  })();
})();
