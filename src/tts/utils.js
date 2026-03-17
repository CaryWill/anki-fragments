/**
 * utils.js — 公共工具模块
 *
 * 导出：
 *   TextProcessor   文本处理（定义过滤、「」替换、拼接语音文本）
 *   AudioConverter  WAV 解码 → MP3 编码
 *   DomHelper       DOM 快捷操作
 *   AudioManager    全局音频播放状态管理
 */

("use strict");

// ============ 文本处理 ============

export class TextProcessor {
  /**
   * 处理定义文本：
   *   1. 过滤开头的词性标记〘xx〙和数字序号
   *   2. 替换「」内的 ― 为正面单词（支持 ―・xxx 模式去重后缀）
   */
  static process(defText, frontText) {
    if (!defText || !frontText) return defText ?? "";

    const filtered = /\d/.test(defText)
      ? defText.replace(/^[\s\S]*?\d/, "")
      : /〘[^〙]*〙/.test(defText)
        ? defText.replace(/^(?:〘[^〙]*〙\s*)*/, "")
        : defText;

    return filtered.replace(/「([^」]*)」/g, (_, content) => {
      if (content.includes("―・")) {
        const [, suffix] = content.match(/―・(.+)/) ?? [];
        if (suffix) {
          const maxLen = Math.min(frontText.length, suffix.length);
          const matchLen =
            Array.from({ length: maxLen }, (_, i) => i + 1)
              .reverse()
              .find((n) => frontText.slice(-n) === suffix.slice(0, n)) ?? 0;
          return `「${content.replace(/―・.+/, frontText + suffix.slice(matchLen))}」`;
        }
      }
      return `「${content.replace(/―/g, frontText)}」`;
    });
  }

  /**
   * 拼接语音朗读文本，去除发音符号
   * @param {...string} parts
   */
  static buildSpeechText(...parts) {
    return parts.filter(Boolean).join(" \n ").replace(/[–・]/g, "");
  }
}

// ============ 音频转换 ============

export class AudioConverter {
  /** WAV Blob → AudioBuffer */
  static async decode(blob) {
    const arrayBuf = await blob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx.decodeAudioData(arrayBuf);
  }

  /** Float32Array → Int16Array（PCM） */
  static #toPcm(f32) {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      i16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return i16;
  }

  /** AudioBuffer → MP3 Blob（依赖全局 lamejs） */
  static toMp3(audioBuffer) {
    const { numberOfChannels: ch, sampleRate } = audioBuffer;
    const encoder = new lamejs.Mp3Encoder(ch, sampleRate, 128);
    const FRAME = 1152;
    const mp3Parts = [];

    const left = AudioConverter.#toPcm(audioBuffer.getChannelData(0));
    const right =
      ch > 1 ? AudioConverter.#toPcm(audioBuffer.getChannelData(1)) : null;

    for (let i = 0; i < left.length; i += FRAME) {
      const end = Math.min(FRAME, left.length - i);
      const lSlice = left.subarray(i, i + end);
      const chunk = right
        ? encoder.encodeBuffer(lSlice, right.subarray(i, i + end))
        : encoder.encodeBuffer(lSlice);
      if (chunk.length) mp3Parts.push(chunk);
    }

    const tail = encoder.flush();
    if (tail.length) mp3Parts.push(tail);

    return new Blob(mp3Parts, { type: "audio/mpeg" });
  }
}

// ============ DOM 工具 ============

export class DomHelper {
  /** 读取指定 id 元素的 textContent，找不到返回空字符串 */
  static text(id) {
    return document.getElementById(id)?.textContent.trim() ?? "";
  }

  /** 创建带 data-tts-element 标记的元素，支持传入初始属性 */
  static ttsEl(tag, props = {}) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    el.dataset.ttsElement = "true";
    return el;
  }

  /** 删除 container 内所有 TTS 创建的元素 */
  static clearTtsElements(container) {
    container
      .querySelectorAll("[data-tts-element]")
      .forEach((el) => el.remove());
  }

  /** 创建隐藏的 <audio controls> 元素 */
  static createAudioEl(src, onPlay) {
    const audio = DomHelper.ttsEl("audio");
    audio.controls = true;
    audio.style.cssText = "margin-top:10px;display:none;";
    audio.src = src;
    audio.addEventListener("click", (e) => e.stopPropagation());
    audio.addEventListener("play", onPlay);
    return audio;
  }

  /** 创建播放按钮（单击播放，双击暂停） */
  static createPlayButton(onClick, onDblClick) {
    const btn = DomHelper.ttsEl("button", { textContent: "播放" });
    btn.style.cssText =
      "user-select:none;-webkit-user-select:none;display:inline-block;";
    btn.setAttribute("unselectable", "on");
    btn.onselectstart = () => false;
    btn.addEventListener("click", onClick);
    btn.addEventListener("dblclick", onDblClick);
    return btn;
  }
}

// ============ 全局音频状态管理 ============

export class AudioManager {
  #audio = null;
  #contentKey = null;
  #cardSide = null;
  #abortController = null;

  get contentKey() {
    return this.#contentKey;
  }
  get cardSide() {
    return this.#cardSide;
  }

  set abortController(ctrl) {
    this.#abortController = ctrl;
  }

  /** 停止当前音频并中止所有进行中的请求 */
  stopAll() {
    if (this.#audio) {
      this.#audio.pause();
      this.#audio.currentTime = 0;
      this.#audio = null;
    }
    this.#abortController?.abort();
    this.#abortController = null;
    this.#contentKey = null;
    this.#cardSide = null;
  }

  /** 停止"其他"音频（不影响自身） */
  stopOther(audio) {
    if (this.#audio && this.#audio !== audio) {
      this.#audio.pause();
      this.#audio.currentTime = 0;
    }
  }

  /** 记录正在播放的音频及上下文 */
  setPlaying(audio, contentKey, cardSide) {
    this.#audio = audio;
    this.#contentKey = contentKey;
    this.#cardSide = cardSide;
  }

  /** 若 audio 正是当前播放项则清除引用 */
  clearAudio(audio) {
    if (this.#audio === audio) this.#audio = null;
  }
}
