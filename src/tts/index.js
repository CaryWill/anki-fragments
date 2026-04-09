/**
 * tts.js — TTS 主模块（入口）
 * 自动初始化，无需手动调用
 *
 * 切换 provider：修改 createProvider() 的返回值即可
 */

"use strict";

import { TextProcessor, DomHelper, AudioManager } from "./utils.js";
import {
  VoiceVoxProvider,
  AzureProvider,
  ElevenLabsProvider,
} from "./tts-provider.js";
import { ENV } from "./env.js";

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

// ============ Provider 工厂（在此切换 TTS 服务） ============

function createProvider(providerType = null) {
  // 如果没有指定 providerType，从 localStorage 读取
  if (!providerType) {
    const stored = localStorage.getItem("tts_provider");
    providerType = (stored === "azure" || stored === "voicevox") ? stored : "voicevox";
  }
  
  if (providerType === "azure") {
    return new AzureProvider({
      subscriptionKey: ENV.azure.subscriptionKey,
      region: ENV.azure.region,
      voice: ENV.azure.voice,
    });
  } else {
    // 默认使用 VoiceVox
    return new VoiceVoxProvider();
  }
}

// ============ TTS 控制器 ============

class TtsController {
  #manager;
  #container;
  #combinedKey;
  #signal;
  #provider;

  constructor({ manager, container, combinedKey, signal, provider }) {
    this.#manager = manager;
    this.#container = container;
    this.#combinedKey = combinedKey;
    this.#signal = signal;
    this.#provider = provider;
  }

  #checkAborted() {
    if (
      this.#signal.aborted ||
      this.#container.dataset.contentKey !== this.#combinedKey
    ) {
      throw new DOMException("Aborted", "AbortError");
    }
  }

  async run({ speechText, contentKey, cardSide, shouldAutoPlay }) {
    const loading = DomHelper.ttsEl("div", { textContent: "" });
    this.#container.prepend(loading);

    try {
      // 按句号（全角和半角）和顿号（全角和半角）拆分文本
      // 支持中文、日文、英文的标点符号
      const rawSentences = speechText.split(/([。.、,])/).filter((s) => s.trim());
      
      // 合并短句子（小于25字）与下一句，保留标点符号
      const sentences = [];
      let currentSentence = "";
      
      for (let i = 0; i < rawSentences.length; i++) {
        const part = rawSentences[i];
        const isPunctuation = /[。.、,]/.test(part);
        
        if (isPunctuation) {
          currentSentence += part;
          // 检查当前句子长度，如果小于25字，继续合并下一句
          if (currentSentence.length < 25) {
            continue;
          } else {
            sentences.push(currentSentence);
            currentSentence = "";
          }
        } else {
          currentSentence += part;
        }
      }
      
      // 添加剩余的句子
      if (currentSentence.trim()) {
        sentences.push(currentSentence);
      }
      
      const audioElements = [];
      const audioBlobs = new Array(sentences.length).fill(null);

      // 预加载第一个句子
      // alert(`正在请求 TTS 接口：第 1 句\n句子内容：${sentences[0]}`);
      audioBlobs[0] = await this.#provider.synthesize(sentences[0], this.#signal);
      this.#checkAborted();

      // 记录所有创建的 ObjectURL，便于统一释放
      const objectUrls = [];

      // 为音频元素绑定自动连播事件（ended + timeupdate 双保险）
      const bindAutoPlayNext = (audio) => {
        audio.addEventListener("ended", () => {
          const currentIndex = audioElements.indexOf(audio);
          if (currentIndex < audioElements.length - 1) {
            audioElements[currentIndex + 1].play().catch(() => {});
          }
        });

        audio.addEventListener("timeupdate", () => {
          if (audio.duration <= 0) return;
          if (audio.currentTime < audio.duration - 0.1) return;
          const currentIndex = audioElements.indexOf(audio);
          if (currentIndex < audioElements.length - 1) {
            const nextAudio = audioElements[currentIndex + 1];
            if (nextAudio.paused) {
              nextAudio.play().catch(() => {});
            }
          }
        });
      };

      // 创建音频元素的统一方法
      const createAudio = (blob) => {
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        const audio = DomHelper.createAudioEl(
          url,
          () => this.#manager.setPlaying(audioElements, contentKey, cardSide),
        );
        this.#container.appendChild(audio);
        audioElements.push(audio);
        bindAutoPlayNext(audio);
        return audio;
      };

      // 创建第一个音频元素
      createAudio(audioBlobs[0]);

      loading.remove();

      let playTimer = null;

      const play = () => {
        this.#manager.stopOther(audioElements);
        // 先停止当前组内所有音频，再从头播放
        audioElements.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
        audioElements[0].play().catch(() => {});
        this.#manager.setPlaying(audioElements, contentKey, cardSide);
      };

      const pause = () => {
        audioElements.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
        this.#manager.clearAudio();
      };

      // 用延时区分单击（播放）和双击（暂停），避免双击时先触发一次播放
      const handleClick = () => {
        if (playTimer) {
          clearTimeout(playTimer);
          playTimer = null;
          pause();
          return;
        }
        playTimer = setTimeout(() => {
          playTimer = null;
          play();
        }, 250);
      };

      const playBtn = DomHelper.createPlayButton(handleClick);
      playBtn.setAttribute("data-order", "1");
      this.#container.appendChild(playBtn);
      sortButtons(this.#container);

      // 页面卸载时释放 ObjectURL
      const revokeUrls = () => {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        objectUrls.length = 0;
      };
      window.addEventListener("pagehide", revokeUrls, { once: true });

      // 预加载剩余的句子（在后台进行）
      const preloadNext = async (index) => {
        if (index >= sentences.length) return;

        try {
          this.#checkAborted();
          const blob = await this.#provider.synthesize(sentences[index], this.#signal);
          this.#checkAborted();

          audioBlobs[index] = blob;
          createAudio(blob);

          preloadNext(index + 1);
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error(`预加载第 ${index + 1} 句失败:`, err);
          }
        }
      };

      // 开始预加载剩余句子
      preloadNext(1);

      if (shouldAutoPlay) {
        setTimeout(() => {
          if (
            !this.#signal.aborted &&
            this.#container.dataset.contentKey === this.#combinedKey
          ) {
            play();
          }
        }, 100);
      }
    } catch (err) {
      loading.remove();
      if (err.name !== "AbortError") {
        this.#container.prepend(DomHelper.ttsEl("div", { textContent: "" }));
      }
    }
  }
}

// ============ 初始化入口 ============

(async () => {
  const container = document.getElementById("button-container");
  if (!container) return;

  window.ankiAudioManager ??= new AudioManager();
  const manager = window.ankiAudioManager;

  const frontEl = document.getElementById("front");
  if (!frontEl) return;

  const frontText =
    DomHelper.text("pronunciation") || frontEl.textContent.trim();
  if (!frontText) return;

  const exampleText = DomHelper.text("example");
  const defText = TextProcessor.process(DomHelper.text("def"), frontText);
  const speechText = TextProcessor.buildSpeechText(
    frontText,
    exampleText,
    defText,
  );

  const contentKey = [frontText, exampleText, defText]
    .filter(Boolean)
    .join("|");
  const cardSide = document.getElementById("back") ? "back" : "front";
  const combinedKey = `${contentKey}|${cardSide}`;

  if (container.dataset.contentKey === combinedKey) return;

  const isContentChanged = manager.contentKey !== contentKey;
  const isFlippedToBack = manager.cardSide === "front" && cardSide === "back";

  let shouldAutoPlay = isContentChanged || isFlippedToBack;
  if (cardSide === "front" && frontText.includes(',"')) shouldAutoPlay = false;

  if (shouldAutoPlay) manager.stopAll();

  DomHelper.clearTtsElements(container);
  container.dataset.contentKey = combinedKey;

  const abortController = new AbortController();
  manager.abortController = abortController;

  const ctrl = new TtsController({
    manager,
    container,
    combinedKey,
    signal: abortController.signal,
    provider: createProvider(), // 从 localStorage 读取
  });

  await ctrl.run({ speechText, contentKey, cardSide, shouldAutoPlay });
})();