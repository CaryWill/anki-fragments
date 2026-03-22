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
      // VoiceVox 有 key 校验步骤；Azure 无需此步骤
      if (this.#provider.checkKey) {
        const { valid, error } = await this.#provider.checkKey(this.#signal);
        this.#checkAborted();
        if (!valid) {
          loading.remove();
          this.#container.prepend(
            DomHelper.ttsEl("div", { textContent: `Error: ${error}` }),
          );
          return;
        }
      }

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

      // 创建第一个音频元素
      const firstAudio = DomHelper.createAudioEl(
        URL.createObjectURL(audioBlobs[0]),
        () =>
          this.#manager.setPlaying(audioElements[0], contentKey, cardSide),
      );
      this.#container.appendChild(firstAudio);
      audioElements.push(firstAudio);

      // 为第一个音频元素添加播放结束事件，自动播放下一个
      firstAudio.addEventListener("ended", () => {
        const currentIndex = audioElements.indexOf(firstAudio);
        if (currentIndex < audioElements.length - 1) {
          const nextAudio = audioElements[currentIndex + 1];
          // 减少停顿时间，立即播放下一个
          nextAudio.play().catch(() => {});
        }
      });
      
      // 添加 timeupdate 事件作为备用方案（解决某些音频文件 ended 事件不触发的问题）
      firstAudio.addEventListener("timeupdate", () => {
        const currentIndex = audioElements.indexOf(firstAudio);
        if (currentIndex < audioElements.length - 1) {
          const nextAudio = audioElements[currentIndex + 1];
          // 如果当前音频播放到接近结束（剩余时间小于 0.1 秒），自动播放下一个
          if (firstAudio.duration > 0 && firstAudio.currentTime >= firstAudio.duration - 0.1) {
            // 确保下一个音频还没开始播放
            if (nextAudio.paused) {
              nextAudio.play().catch(() => {});
            }
          }
        }
      });

      loading.remove();

      // 使用第一个音频元素作为主控制
      const mainAudio = audioElements[0];

      const play = () => {
        this.#manager.stopOther(mainAudio);
        // 从头开始播放
        audioElements.forEach((audio) => {
          audio.currentTime = 0;
        });
        mainAudio.play().catch(() => {});
        this.#manager.setPlaying(mainAudio, contentKey, cardSide);
      };

      const pause = () => {
        audioElements.forEach((audio) => {
          audio.pause();
          audio.currentTime = 0;
        });
        this.#manager.clearAudio(mainAudio);
      };

      const playBtn = DomHelper.createPlayButton(play, pause);
      playBtn.setAttribute("data-order", "1");
      this.#container.appendChild(playBtn);
      sortButtons(this.#container);

      // 预加载剩余的句子（在后台进行）
      const preloadNext = async (index) => {
        if (index >= sentences.length) return;
        
        try {
          this.#checkAborted();
          // alert(`正在请求 TTS 接口：第 ${index + 1} 句\n句子内容：${sentences[index]}`);
          const blob = await this.#provider.synthesize(sentences[index], this.#signal);
          this.#checkAborted();
          
          audioBlobs[index] = blob;
          
          // 创建音频元素
          const audio = DomHelper.createAudioEl(
            URL.createObjectURL(blob),
            () =>
              this.#manager.setPlaying(audioElements[0], contentKey, cardSide),
          );
          this.#container.appendChild(audio);
          audioElements.push(audio);

          // 为每个音频元素添加播放结束事件，自动播放下一个
          audio.addEventListener("ended", () => {
            const currentIndex = audioElements.indexOf(audio);
            if (currentIndex < audioElements.length - 1) {
              const nextAudio = audioElements[currentIndex + 1];
              // 减少停顿时间，立即播放下一个
              nextAudio.play().catch(() => {});
            }
          });
          
          // 添加 timeupdate 事件作为备用方案（解决某些音频文件 ended 事件不触发的问题）
          audio.addEventListener("timeupdate", () => {
            const currentIndex = audioElements.indexOf(audio);
            if (currentIndex < audioElements.length - 1) {
              const nextAudio = audioElements[currentIndex + 1];
              // 如果当前音频播放到接近结束（剩余时间小于 0.1 秒），自动播放下一个
              if (audio.duration > 0 && audio.currentTime >= audio.duration - 0.1) {
                // 确保下一个音频还没开始播放
                if (nextAudio.paused) {
                  nextAudio.play().catch(() => {});
                }
              }
            }
          });

          // 继续预加载下一个
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