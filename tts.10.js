/**
 * TTS 播放功能模块
 * 自动初始化，无需手动调用
 * 支持检测卡片翻转（front <-> back）
 * 修改：从 front 切换到 back 时自动播放，即使文本内容相同
 */

(function () {
  "use strict";

  // ============ 配置 ============

  /**
   * API 密钥配置
   * 在这里修改你的 API 密钥
   */
  // 可能会用完 可以切换用
  const API_KEYS = ["t127g0112270q_0", "J492I153g8Z6308"];

  /**
   * 随机选择一个 API 密钥
   */
  function getRandomApiKey() {
    return API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
  }

  const API_KEY = getRandomApiKey();

  // ============ 工具函数 ============

  /**
   * 初始化全局音频管理器
   */
  function initAudioManager() {
    if (!window.ankiAudioManager) {
      window.ankiAudioManager = {
        currentAudio: null,
        currentContentKey: null,
        currentCardSide: null, // 新增：跟踪当前卡片面
        currentAbortController: null,
        stopAll: function () {
          if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
          }
          if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
          }
          this.currentContentKey = null;
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
   * 生成内容唯一标识
   * 基于实际要播放的文本内容
   */
  function generateContentKey(frontText, exampleText, defText) {
    let fullText = frontText;
    if (exampleText) {
      fullText += "|" + exampleText;
    }
    if (defText) {
      fullText += "|" + defText;
    }
    return fullText;
  }

  /**
   * 检查 API 密钥状态
   */
  async function checkApiKey(signal) {
    try {
      const response = await fetch(
        `https://deprecatedapis.tts.quest/v2/api/?key=${API_KEY}`,
        { signal },
      );
      const data = await response.json();

      if (data.errorMessage) {
        return { valid: false, error: data.errorMessage };
      }

      return { valid: true };
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("API key check aborted");
        throw error;
      }
      console.error("API key check error:", error);
      return { valid: true }; // Continue if check fails
    }
  }

  /**
   * 获取 WAV 音频
   */
  async function fetchWavBlob(frontText, exampleText, defText, signal) {
    // 拼接所有文本内容
    let fullText = frontText;
    if (exampleText) {
      fullText += " \n " + exampleText;
    }
    if (defText) {
      fullText += " \n " + defText;
    }

    const url =
      `https://deprecatedapis.tts.quest/v2/voicevox/audio/?key=${API_KEY}&speaker=2&pitch=0&intonationScale=1&speed=1&text=` +
      encodeURIComponent(fullText);

    const res = await fetch(url, { signal });
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
    if (!container) {
      console.log("No button-container found");
      return;
    }

    // 初始化音频管理器
    initAudioManager();

    // 获取文本内容
    const frontElement = document.getElementById("front");
    const exampleElement = document.getElementById("example");
    const definitionElement = document.getElementById("def");

    if (!frontElement) {
      console.log("No front element found");
      return;
    }

    const frontText = frontElement.textContent.trim();
    const exampleText = exampleElement ? exampleElement.textContent.trim() : "";
    const defText = definitionElement
      ? definitionElement.textContent.trim()
      : "";

    if (!frontText) {
      console.log("No front text found");
      return;
    }

    // 生成当前内容的唯一标识
    const currentContentKey = generateContentKey(
      frontText,
      exampleText,
      defText,
    );
    const currentCardSide = detectCardSide();

    console.log("Current content key:", currentContentKey);
    console.log(
      "Previous content key:",
      window.ankiAudioManager.currentContentKey,
    );
    console.log("Current card side:", currentCardSide);
    console.log("Previous card side:", window.ankiAudioManager.currentCardSide);

    // 检查是否已经处理过这个内容和卡片面的组合
    const combinedKey = currentContentKey + "|" + currentCardSide;
    if (container.dataset.contentKey === combinedKey) {
      console.log("Content and card side already loaded, skipping");
      return;
    }

    // 检查内容是否变化
    const isContentChanged =
      window.ankiAudioManager.currentContentKey !== currentContentKey;

    // 检查卡片面是否变化（从 front 切换到 back）
    const isSideChanged =
      window.ankiAudioManager.currentCardSide !== currentCardSide;
    const isFlippedToBack =
      window.ankiAudioManager.currentCardSide === "front" &&
      currentCardSide === "back";

    // 如果内容变化了或者从front翻到back，停止之前的音频和所有正在进行的操作
    let shouldAutoPlay = false;
    if (isContentChanged) {
      console.log("Content changed, will auto-play new content");
      window.ankiAudioManager.stopAll();
      shouldAutoPlay = true;
    } else if (isFlippedToBack) {
      console.log("Flipped from front to back, will auto-play");
      window.ankiAudioManager.stopAll();
      shouldAutoPlay = true;
    }

    // 额外判断：front面且包含特定字符时不自动播放
    if (currentCardSide === "front" && frontText.includes(',"')) {
      console.log("Front side with special character, skipping auto-play");
      shouldAutoPlay = false;
    }

    // 只删除TTS脚本创建的元素（带有特定标记的）
    const ttsElements = container.querySelectorAll('[data-tts-element="true"]');
    ttsElements.forEach((el) => el.remove());

    // 标记当前内容和卡片面
    container.dataset.contentKey = combinedKey;

    // 创建新的AbortController用于当前操作
    const abortController = new AbortController();
    window.ankiAudioManager.currentAbortController = abortController;
    const signal = abortController.signal;

    // 检查是否被取消
    const checkAborted = () => {
      if (signal.aborted) {
        console.log("Operation aborted");
        throw new DOMException("Aborted", "AbortError");
      }
      // 也检查内容是否已经变化
      if (container.dataset.contentKey !== combinedKey) {
        console.log("Content changed, aborting");
        throw new DOMException("Content changed", "AbortError");
      }
    };

    const loading = document.createElement("div");
    loading.textContent = "";
    loading.setAttribute("data-tts-element", "true"); // 标记为TTS元素
    container.insertBefore(loading, container.firstChild);

    try {
      // 检查 API 密钥
      const apiKeyStatus = await checkApiKey(signal);
      checkAborted();

      if (!apiKeyStatus.valid) {
        console.log("API key invalid:", apiKeyStatus.error);
        loading.remove();
        const errorBtn = document.createElement("button");
        errorBtn.textContent = `Error: ${apiKeyStatus.error}`;
        errorBtn.style.cssText =
          "background-color: #dc3545; color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: not-allowed;";
        errorBtn.disabled = true;
        errorBtn.setAttribute("data-tts-element", "true"); // 标记为TTS元素
        container.insertBefore(errorBtn, container.firstChild);
        return;
      }

      console.log("Fetching audio...");
      const wavBlob = await fetchWavBlob(
        frontText,
        exampleText,
        defText,
        signal,
      );
      checkAborted();

      console.log("Decoding audio...");
      const audioBuffer = await decodeWavBlob(wavBlob);
      checkAborted();

      console.log("Converting to MP3...");
      const mp3Blob = audioBufferToMp3(audioBuffer);
      checkAborted();

      loading.remove();

      // 创建音频元素
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.style.marginTop = "10px";
      audio.style.display = "none";
      audio.src = URL.createObjectURL(mp3Blob);
      audio.setAttribute("data-tts-element", "true"); // 标记为TTS元素
      audio.addEventListener("click", (e) => e.stopPropagation());

      audio.addEventListener("play", () => {
        console.log("Audio started playing");
        window.ankiAudioManager.currentAudio = audio;
        window.ankiAudioManager.currentContentKey = currentContentKey;
        window.ankiAudioManager.currentCardSide = currentCardSide;
      });

      audio.addEventListener("ended", () => {
        console.log("Audio playback ended");
      });

      container.appendChild(audio);

      // 创建播放按钮
      const playBtn = document.createElement("button");
      playBtn.textContent = "播放";
      playBtn.setAttribute("data-tts-element", "true"); // 标记为TTS元素
      playBtn.setAttribute(
        "style",
        "user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; -webkit-touch-callout: none; display: inline-block;",
      );
      playBtn.setAttribute("unselectable", "on");
      playBtn.onselectstart = () => false;

      container.insertBefore(playBtn, container.firstChild);

      const playAudio = () => {
        console.log("Playing audio manually or auto");
        // 只停止音频播放，不取消当前的AbortController
        if (
          window.ankiAudioManager.currentAudio &&
          window.ankiAudioManager.currentAudio !== audio
        ) {
          window.ankiAudioManager.currentAudio.pause();
          window.ankiAudioManager.currentAudio.currentTime = 0;
        }
        audio.currentTime = 0;
        audio.play().catch((e) => console.error("Play failed:", e));
        window.ankiAudioManager.currentAudio = audio;
        window.ankiAudioManager.currentContentKey = currentContentKey;
        window.ankiAudioManager.currentCardSide = currentCardSide;
      };

      playBtn.addEventListener("click", playAudio);

      playBtn.addEventListener("dblclick", () => {
        console.log("Double-click: pausing audio");
        audio.pause();
        audio.currentTime = 0;
        if (window.ankiAudioManager.currentAudio === audio) {
          window.ankiAudioManager.currentAudio = null;
        }
      });

      // 如果需要自动播放
      if (shouldAutoPlay) {
        console.log("Auto-playing audio");
        setTimeout(() => {
          // 再次检查是否已被取消
          if (!signal.aborted && container.dataset.contentKey === combinedKey) {
            playAudio();
          }
        }, 100); // 添加小延迟确保音频元素就绪
      } else {
        console.log("Not auto-playing (shouldAutoPlay=false)");
      }
    } catch (err) {
      if (err.name === "AbortError") {
        console.log("Operation was aborted, cleaning up");
        loading.remove();
        return;
      }
      loading.remove();
      const errorDiv = document.createElement("div");
      errorDiv.textContent = "";
      errorDiv.setAttribute("data-tts-element", "true");
      container.insertBefore(errorDiv, container.firstChild);
      console.error("TTS Error:", err);
    }
  })();
})();
