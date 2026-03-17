/**
 * tts-provider.js — TTS 服务提供者
 *
 * 导出：
 *   VoiceVoxProvider   使用 deprecatedapis.tts.quest（VoiceVox）
 *   AzureProvider      使用 Azure Cognitive Services TTS
 *
 * 两者都实现统一接口：
 *   synthesize(speechText, signal): Promise<Blob>   返回 MP3 Blob
 *   checkKey?(signal): Promise<{valid, error?}>      可选的 key 校验
 */

"use strict";

import { AudioConverter } from "./utils.js";

// ============ VoiceVox Provider ============

export class VoiceVoxProvider {
  static #KEYS = ["t127g0112270q_0", "J492I153g8Z6308"];
  static #API_KEY =
    VoiceVoxProvider.#KEYS[
      Math.floor(Math.random() * VoiceVoxProvider.#KEYS.length)
    ];
  static #BASE = "https://deprecatedapis.tts.quest/v2";

  async checkKey(signal) {
    const res = await fetch(
      `${VoiceVoxProvider.#BASE}/api/?key=${VoiceVoxProvider.#API_KEY}`,
      { signal },
    );
    const { errorMessage } = await res.json();
    return errorMessage
      ? { valid: false, error: errorMessage }
      : { valid: true };
  }

  async synthesize(speechText, signal) {
    const url =
      `${VoiceVoxProvider.#BASE}/voicevox/audio/?key=${VoiceVoxProvider.#API_KEY}` +
      `&speaker=2&pitch=0&intonationScale=1&speed=1` +
      `&text=${encodeURIComponent(speechText)}`;

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`VoiceVox fetch failed: ${res.status}`);

    const buffer = await AudioConverter.decode(await res.blob());
    return AudioConverter.toMp3(buffer);
  }
}

// ============ Azure Provider ============

/**
 * Azure Cognitive Services TTS Provider
 *
 * 配置示例：
 *   new AzureProvider({
 *     subscriptionKey : "YOUR_AZURE_SUBSCRIPTION_KEY",
 *     region          : "eastasia",
 *     voice           : "ja-JP-Nanami:DragonHDOmniLatestNeural",
 *   })
 *
 * 语音名称格式：
 *   普通 Neural  →  "ja-JP-NanamiNeural"
 *   DragonHD     →  "ja-JP-Nanami:DragonHDLatestNeural"
 *   DragonHDOmni →  "ja-JP-Nanami:DragonHDOmniLatestNeural"   ← 推荐
 *
 * DragonHD 系列特点：
 *   - 语音名中含冒号，如 "ja-JP-Nanami:DragonHDOmniLatestNeural"
 *   - SSML 必须声明 xmlns:mstts 命名空间，否则服务端返回 400
 *   - 直接返回 MP3，无需转码（outputFormat 使用 mp3 格式即可）
 */
export class AzureProvider {
  static #OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

  // 语音名含 ":Dragon" 即为 HD 系列
  static #isHdVoice(voice) {
    return voice.includes(":Dragon");
  }

  #subscriptionKey;
  #region;
  #voice;
  #outputFormat;
  #tokenEndpoint;
  #ttsEndpoint;
  #cachedToken = null;
  #tokenExpiresAt = 0;

  constructor({
    subscriptionKey,
    region,
    voice = "ja-JP-Nanami:DragonHDOmniLatestNeural",
    outputFormat,
  } = {}) {
    if (!subscriptionKey || !region) {
      throw new Error("AzureProvider: subscriptionKey 和 region 为必填项");
    }
    this.#subscriptionKey = subscriptionKey;
    this.#region = region;
    this.#voice = voice;
    this.#outputFormat = outputFormat ?? AzureProvider.#OUTPUT_FORMAT;
    this.#tokenEndpoint = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;
    this.#ttsEndpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  }

  /** Token 缓存 9 分钟（有效期 10 分钟，提前 1 分钟刷新） */
  async #getToken(signal) {
    if (this.#cachedToken && Date.now() < this.#tokenExpiresAt)
      return this.#cachedToken;
    const res = await fetch(this.#tokenEndpoint, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": this.#subscriptionKey },
      signal,
    });
    if (!res.ok) throw new Error(`Azure token fetch failed: ${res.status}`);
    this.#cachedToken = await res.text();
    this.#tokenExpiresAt = Date.now() + 9 * 60 * 1000;
    return this.#cachedToken;
  }

  /**
   * 构建 SSML
   * DragonHD Omni 要求必须声明 xmlns:mstts，否则返回 400
   */
  #toSsml(text) {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const msttsNs = AzureProvider.#isHdVoice(this.#voice)
      ? ` xmlns:mstts="http://www.w3.org/2001/mstts"`
      : "";

    return (
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"${msttsNs} xml:lang="ja-JP">` +
      `<voice name="${this.#voice}">${escaped}</voice>` +
      `</speak>`
    );
  }

  async synthesize(speechText, signal) {
    const token = await this.#getToken(signal);
    const res = await fetch(this.#ttsEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": this.#outputFormat,
        "User-Agent": "AnkiTTS",
      },
      body: this.#toSsml(speechText),
      signal,
    });
    if (!res.ok) throw new Error(`Azure TTS failed: ${res.status}`);
    return res.blob(); // Azure 直接返回 MP3，无需转码
  }
}

// ============ ElevenLabs Provider ============

/**
 * ElevenLabs TTS Provider
 *
 * 配置示例：
 *   new ElevenLabsProvider({
 *     apiKey  : "sk_xxxx",
 *     voiceId : "EkK6wL8GaH8IgBZTTDGJ",
 *     modelId : "eleven_multilingual_v2",  // 可选
 *   })
 *
 * 特性：
 *   - 按文本内容缓存音频 URL，同一文本不重复请求（节省 quota）
 *   - 直接返回 MP3，无需转码
 *   - 支持所有 ElevenLabs voice_settings 参数
 */
export class ElevenLabsProvider {
  static #BASE = "https://api.elevenlabs.io/v1";

  #apiKey;
  #voiceId;
  #modelId;
  #voiceSettings;

  // 按 speechText 缓存 ObjectURL，页面生命周期内有效
  #cache = new Map();

  constructor({
    apiKey,
    voiceId,
    modelId = "eleven_multilingual_v2",
    voiceSettings = { stability: 0.5, similarity_boost: 0.5 },
  } = {}) {
    if (!apiKey || !voiceId) {
      throw new Error("ElevenLabsProvider: apiKey 和 voiceId 为必填项");
    }
    this.#apiKey = apiKey;
    this.#voiceId = voiceId;
    this.#modelId = modelId;
    this.#voiceSettings = voiceSettings;
  }

  async synthesize(speechText, signal) {
    // 命中缓存时直接构造一个指向同一 ObjectURL 的空 Blob 包装返回
    // 实际播放由 tts.js 通过 URL.createObjectURL(blob) 处理，
    // 所以这里返回已有 URL 对应的 Blob 引用即可
    if (this.#cache.has(speechText)) {
      return fetch(this.#cache.get(speechText), { signal }).then((r) =>
        r.blob(),
      );
    }

    const res = await fetch(
      `${ElevenLabsProvider.#BASE}/text-to-speech/${this.#voiceId}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": this.#apiKey,
        },
        body: JSON.stringify({
          text: speechText,
          model_id: this.#modelId,
          voice_settings: this.#voiceSettings,
        }),
        signal,
      },
    );

    if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`);

    const blob = await res.blob();
    // 缓存 ObjectURL 供后续命中复用
    this.#cache.set(speechText, URL.createObjectURL(blob));
    return blob;
  }
}
