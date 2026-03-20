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

// ============ Provider 工厂（在此切换 TTS 服务） ============

function createProvider() {
  // ── 使用 VoiceVox（无需配置） ──
  // return new VoiceVoxProvider();

  // ── 使用 Azure ──
  return new AzureProvider({
    subscriptionKey: ENV.azure.subscriptionKey,
    region: ENV.azure.region,
    voice: ENV.azure.voice,
  });

  // ── 使用 ElevenLabs ──
  // return new ElevenLabsProvider({
  //   apiKey  : ENV.elevenLabs.apiKey,
  //   voiceId : ENV.elevenLabs.voiceId,
  // });
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

      // 按句号（全角和半角）拆分文本
      const sentences = speechText.split(/[。.]/).filter((s) => s.trim());
      const audioElements = [];

      // 为每个句子生成音频
      for (let i = 0; i < sentences.length; i++) {
        this.#checkAborted();
        const sentence = sentences[i];
        const mp3Blob = await this.#provider.synthesize(sentence, this.#signal);
        this.#checkAborted();

        const audio = DomHelper.createAudioEl(
          URL.createObjectURL(mp3Blob),
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
            nextAudio.play().catch(() => {});
          }
        });
      }

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

      this.#container.prepend(DomHelper.createPlayButton(play, pause));

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
    provider: createProvider(),
  });

  await ctrl.run({ speechText, contentKey, cardSide, shouldAutoPlay });
})();
