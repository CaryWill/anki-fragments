/**
 * env.js — 从构建时注入的环境变量中读取配置
 *
 * esbuild 通过 --define 将 .env 中的值替换为字面量字符串，
 * 本文件只负责将它们组织成结构化对象供其他模块导入。
 *
 * 本文件本身可以安全地提交到 git —— 它不含任何真实密钥，
 * 所有 process.env.XXX 引用在构建时会被 esbuild 替换掉。
 */

"use strict";

export const ENV = {
  azure: {
    subscriptionKey: process.env.AZURE_SUBSCRIPTION_KEY,
    region: process.env.AZURE_REGION,
    voice: process.env.AZURE_VOICE,
  },
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
  },
};
