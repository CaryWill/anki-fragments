/**
 * 点击查词功能模块 (包含 React 设置组件)
 * 自动为页面中的日语词汇添加点击查词功能
 * 支持动词、形容词、名词、副词
 */

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { createPortal } from "react-dom";
import { Modal, Switch, List, Button, Toast } from "antd-mobile";
import { SetOutline } from "antd-mobile-icons";
import antdMobileStyles from "antd-mobile/bundle/style.css";

// ==================== React 设置组件部分 ====================

// 配置存储键
const CONFIG_KEY = "anki_click_lookup_config";
const TTS_PROVIDER_KEY = "tts_provider";
const FONT_KEY = "anki_font_pref_v1";

// TTS Providers
const TTS_PROVIDERS = [
  { id: "azure", name: "Azure" },
  { id: "voicevox", name: "VoiceVox" },
];

// 字体配置
const FONTS = [
  { id: "wenkai", name: "霞鹜文楷", family: "LXGWWenKai-Regular" },
  { id: "neoxihei", name: "霞鹜新晰黑", family: "LXGWNeoXiHeiScreenFull" },
];

// 默认配置 - 默认不解析任何 JLPT 等级
const defaultConfig = {
  enabled: true,
  onlyKanji: false,
  showJlptTag: true,  // 是否显示 JLPT 标签
  jlptLevels: [],  // 默认不解析任何等级，用户需要在设置中手动勾选
  ttsProvider: "voicevox",
  font: "wenkai",
};

/**
 * 从 localStorage 加载配置
 */
function loadConfig() {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    const ttsProvider = localStorage.getItem(TTS_PROVIDER_KEY) || defaultConfig.ttsProvider;
    const font = localStorage.getItem(FONT_KEY) || defaultConfig.font;
    
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log("[click-lookup] 从 localStorage 加载配置:", parsed);
      const config = { 
        ...defaultConfig, 
        ...parsed,
        ttsProvider,
        font,
      };
      console.log("[click-lookup] 合并后配置:", config);
      return config;
    }
    console.log("[click-lookup] 使用默认配置:", defaultConfig);
    return { ...defaultConfig, ttsProvider, font };
  } catch (e) {
    console.warn("[click-lookup] 配置加载失败:", e);
  }
  return { ...defaultConfig };
}

/**
 * 保存配置到 localStorage
 */
function saveConfig(config) {
  try {
    // 保存点击查词配置
    const clickLookupConfig = {
      enabled: config.enabled,
      onlyKanji: config.onlyKanji,
      showJlptTag: config.showJlptTag,
      jlptLevels: config.jlptLevels,
    };
    console.log("[click-lookup] 保存配置到 localStorage:", clickLookupConfig);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(clickLookupConfig));
    
    // 保存 TTS Provider
    localStorage.setItem(TTS_PROVIDER_KEY, config.ttsProvider);
    
    // 保存字体
    localStorage.setItem(FONT_KEY, config.font);
    
    return true;
  } catch (e) {
    console.warn("[click-lookup] 配置保存失败:", e);
    return false;
  }
}

/**
 * 设置按钮和弹窗组件
 */
function ClickLookupSettingsComponent() {
  const [config, setConfig] = useState(defaultConfig);
  const [isOpen, setIsOpen] = useState(false);

  // 加载配置
  useEffect(() => {
    const savedConfig = loadConfig();
    setConfig(savedConfig);
  }, []);

  // 切换启用状态
  const toggleEnabled = (checked) => {
    setConfig((prev) => ({ ...prev, enabled: checked }));
  };

  // 切换只处理汉字
  const toggleOnlyKanji = (checked) => {
    setConfig((prev) => ({ ...prev, onlyKanji: checked }));
  };

  // 切换显示 JLPT 标签
  const toggleShowJlptTag = (checked) => {
    setConfig((prev) => ({ ...prev, showJlptTag: checked }));
  };

  // 切换 JLPT 等级
  const toggleJlptLevel = (level, checked) => {
    setConfig((prev) => {
      const levels = prev.jlptLevels || [];
      if (checked) {
        // 添加等级，并按 N1, N2, N3, N4, N5 排序
        const newLevels = [...levels, level].sort((a, b) => {
          return parseInt(a.replace('N', '')) - parseInt(b.replace('N', ''));
        });
        return { ...prev, jlptLevels: newLevels };
      } else {
        // 移除等级
        return { ...prev, jlptLevels: levels.filter(l => l !== level) };
      }
    });
  };

  // 切换 TTS Provider
  const changeTtsProvider = (provider) => {
    setConfig((prev) => ({ ...prev, ttsProvider: provider }));
  };

  // 切换字体
  const changeFont = (font) => {
    setConfig((prev) => ({ ...prev, font: font }));
  };

  // 打开弹窗
  const handleOpen = () => {
    setIsOpen(true);
  };

  // 关闭弹窗
  const handleClose = () => {
    setIsOpen(false);
  };

  // 保存配置
  const handleSave = () => {
    const success = saveConfig(config);
    if (success) {
      // 更新全局配置
      window.AnkiClickLookup?.updateConfig?.(config);
      Toast.show({
        icon: "success",
        content: "配置已保存",
      });
      setIsOpen(false);
      // 刷新页面以应用新配置
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      Toast.show({
        icon: "fail",
        content: "配置保存失败",
      });
    }
  };

  const visible = isOpen;

  return (
    <>
      {/* 设置按钮 - 放在 button-container 中，data-order="5" 确保在分享按钮(4)后面 */}
      <button
        className="click-lookup-settings-btn-react"
        onClick={handleOpen}
        data-order="5"
        title="点击查词设置"
      >
        <SetOutline />
      </button>

      {/* 使用 Portal 将弹窗渲染到 body，避免被父容器样式影响 */}
      {createPortal(
        <Modal
          visible={visible}
          onClose={handleClose}
          title="点击查词设置"
          content={
            <div style={{ padding: "12px 0", minWidth: "300px" }}>
              <List style={{ 
                "--border-top": "none",
                "--border-bottom": "none",
              }}>
                <List.Item
                  style={{ 
                    paddingLeft: "12px",
                    paddingRight: "12px",
                  }}
                  extra={
                    <Switch
                      checked={config.enabled}
                      onChange={toggleEnabled}
                    />
                  }
                >
                  <div style={{ fontSize: "15px" }}>启用点击查词</div>
                </List.Item>
                <List.Item
                  style={{ 
                    paddingLeft: "12px",
                    paddingRight: "12px",
                  }}
                  extra={
                    <Switch
                      checked={config.onlyKanji}
                      onChange={toggleOnlyKanji}
                    />
                  }
                >
                  <div style={{ fontSize: "15px", whiteSpace: "nowrap" }}>
                    只处理含汉字的词汇
                  </div>
                </List.Item>
                <List.Item
                  style={{ 
                    paddingLeft: "12px",
                    paddingRight: "12px",
                  }}
                  extra={
                    <Switch
                      checked={config.showJlptTag}
                      onChange={toggleShowJlptTag}
                    />
                  }
                >
                  <div style={{ fontSize: "15px", whiteSpace: "nowrap" }}>
                    显示 JLPT 等级标签
                  </div>
                </List.Item>
                {config.showJlptTag && (
                  <List.Item
                    style={{ 
                      paddingLeft: "12px",
                      paddingRight: "12px",
                    }}
                  >
                    <div style={{ fontSize: "15px", marginBottom: "8px" }}>
                      显示等级
                    </div>
                    <div style={{ 
                      display: "flex", 
                      gap: "12px", 
                      flexWrap: "wrap",
                      marginTop: "8px"
                    }}>
                      {['N1', 'N2', 'N3', 'N4', 'N5'].map(level => (
                        <label 
                          key={level}
                          style={{ 
                            display: "flex", 
                            alignItems: "center",
                            gap: "4px",
                            cursor: "pointer",
                            fontSize: "14px"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={config.jlptLevels?.includes(level) || false}
                            onChange={(e) => toggleJlptLevel(level, e.target.checked)}
                            style={{ cursor: "pointer" }}
                          />
                          <span>{level}</span>
                        </label>
                      ))}
                    </div>
                  </List.Item>
                )}
                <List.Item
                  style={{ 
                    paddingLeft: "12px",
                    paddingRight: "12px",
                  }}
                  extra={
                    <select
                      value={config.ttsProvider}
                      onChange={(e) => changeTtsProvider(e.target.value)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #d9d9d9",
                        fontSize: "14px",
                      }}
                    >
                      {TTS_PROVIDERS.map(provider => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                  }
                >
                  <div style={{ fontSize: "15px" }}>TTS 语音引擎</div>
                </List.Item>
                <List.Item
                  style={{ 
                    paddingLeft: "12px",
                    paddingRight: "12px",
                  }}
                  extra={
                    <select
                      value={config.font}
                      onChange={(e) => changeFont(e.target.value)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        border: "1px solid #d9d9d9",
                        fontSize: "14px",
                      }}
                    >
                      {FONTS.map(font => (
                        <option key={font.id} value={font.id}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                  }
                >
                  <div style={{ fontSize: "15px" }}>字体</div>
                </List.Item>
              </List>
            </div>
          }
          closeOnAction
          actions={[
            {
              key: "cancel",
              text: "取消",
              onClick: handleClose,
            },
            {
              key: "save",
              text: "保存",
              primary: true,
              onClick: handleSave,
            },
          ]}
        />,
        document.body
      )}
    </>
  );
}

/**
 * 排序按钮函数（与 share.js 保持一致）
 */
function sortButtons(container) {
  const buttons = Array.from(container.children);
  buttons.sort((a, b) => {
    const orderA = parseInt(a.getAttribute("data-order") || "99", 10);
    const orderB = parseInt(b.getAttribute("data-order") || "99", 10);
    return orderA - orderB;
  });
  buttons.forEach((btn) => container.appendChild(btn));
}

/**
 * 渲染设置按钮到指定容器
 */
function renderSettingsButton(container) {
  if (!container) {
    console.warn("[click-lookup] 未找到容器元素");
    return;
  }

  console.log("[click-lookup] 开始渲染设置按钮到 button-container");

  // 创建容器元素
  const settingsContainer = document.createElement("span");
  settingsContainer.className = "click-lookup-settings-container";
  settingsContainer.setAttribute("data-order", "5");
  
  // 插入到容器末尾
  container.appendChild(settingsContainer);
  
  console.log("[click-lookup] 设置按钮容器已添加，data-order=5");

  // 使用 React 18 的 createRoot
  const root = ReactDOM.createRoot(settingsContainer);
  root.render(<ClickLookupSettingsComponent />);

  // 渲染后排序按钮
  setTimeout(() => {
    sortButtons(container);
    console.log("[click-lookup] 按钮已重新排序");
  }, 100);

  return root;
}

/**
 * 添加必要的 CSS 样式
 */
function addSettingsStyles() {
  // 添加 Ant Design Mobile 样式
  const antdStyle = document.createElement("style");
  antdStyle.setAttribute("data-antd-mobile", "true");
  antdStyle.textContent = antdMobileStyles;
  document.head.appendChild(antdStyle);
  
  // 添加自定义样式
  const customStyle = document.createElement("style");
  customStyle.textContent = `
    .click-lookup-settings-btn-react {
      /* 继承 default.css 中的 button 样式，只覆盖必要的属性 */
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      vertical-align: middle !important;
    }
    
    .click-lookup-settings-btn-react svg {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    
    .click-lookup-settings-btn-react:hover {
      border: none !important;
      background: #f0eeef !important;
      opacity: 0.8;
    }
    
    /* 精确覆盖 default.css 中影响弹窗的样式 */
    
    /* 1. 覆盖 .card * { line-height: 1.5 !important; } */
    .adm-modal *,
    .adm-center-popup-wrap *,
    .adm-mask * {
      line-height: initial !important;
    }
    
    /* 2. 覆盖 :is(div, span):empty { display: none !important; } */
    .adm-switch div:empty,
    .adm-switch span:empty,
    .adm-modal div:empty,
    .adm-modal span:empty {
      display: block !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    
    /* 3. 覆盖 button 样式 */
    .adm-modal button,
    .adm-center-popup-wrap button {
      font-size: initial !important;
      box-shadow: initial !important;
      border-radius: initial !important;
      color: initial !important;
      padding: initial !important;
      border: initial !important;
      margin: initial !important;
      background: initial !important;
    }
    
    /* 4. 弹窗内容使用与 #def 一致的字体 */
    .adm-modal,
    .adm-modal *,
    .adm-center-popup-wrap,
    .adm-center-popup-wrap * {
      font-family: "LXGWWenKai-Regular", -apple-system, BlinkMacSystemFont, system-ui, sans-serif !important;
    }
    
    /* Ant Design Mobile 样式覆盖 */
    .adm-modal-wrap {
      z-index: 10000 !important;
    }
    
    .adm-toast-mask {
      z-index: 10001 !important;
    }
    
    .adm-modal {
      --z-index: 10000;
    }
    
    .adm-center-popup-wrap {
      z-index: 10000 !important;
    }
  `;
  document.head.appendChild(customStyle);
}

// ==================== 点击查词功能部分 ====================

(function () {
  "use strict";

  // kuromoji 加载状态
  let tokenizer = null;
  let tokenizerReady = false;
  let isProcessing = false;

  // JLPT Checker 加载状态
  let jlptChecker = null;
  let jlptReady = false;

  // 当前配置 - 从 localStorage 加载
  let currentConfig = loadConfig();

  /**
   * 初始化 JLPT Checker
   */
  async function initJLPTChecker() {
    if (jlptReady && jlptChecker) {
      return jlptChecker;
    }

    try {
      // 检查是否已经加载
      if (typeof window.jlptChecker !== "undefined") {
        jlptChecker = window.jlptChecker;
        await jlptChecker.load();
        jlptReady = true;
        console.log("[click-lookup] JLPT Checker 已存在，直接使用");
        return jlptChecker;
      }

      // 动态加载 jlpt-checker.js（作为普通脚本，不是模块）
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "jlpt-checker.js";
        // 不设置 type="module"，让它作为普通脚本加载
        script.onload = () => {
          console.log("[click-lookup] jlpt-checker.js 脚本加载完成");
          resolve();
        };
        script.onerror = (err) => {
          console.error("[click-lookup] jlpt-checker.js 加载失败:", err);
          reject(err);
        };
        document.head.appendChild(script);
      });

      // 等待一小段时间确保脚本执行完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 获取全局 jlptChecker 对象
      jlptChecker = window.jlptChecker;
      
      if (!jlptChecker) {
        throw new Error("window.jlptChecker 未定义");
      }

      // 加载 JLPT 数据
      await jlptChecker.load();
      jlptReady = true;
      console.log("[click-lookup] JLPT Checker 加载成功，N1词汇数:", jlptChecker.n1Words?.size || 0);
      
      return jlptChecker;
    } catch (err) {
      console.error("[click-lookup] JLPT Checker 初始化失败:", err);
      jlptReady = false;
      jlptChecker = null;
      return null;
    }
  }

  /**
   * 初始化 kuromoji 分词器
   * 从 Anki media 目录加载词典文件（扁平化路径）
   */
  function initTokenizer() {
    return new Promise((resolve, reject) => {
      if (tokenizerReady) {
        resolve(tokenizer);
        return;
      }

      // Anki 环境下使用扁平化路径加载词典
      // 词典文件直接放在根目录，使用空路径
      const dicPath = "";

      // 动态加载 kuromoji
      if (typeof kuromoji === "undefined") {
        // 如果 kuromoji 未加载，创建一个简单的加载脚本
        const script = document.createElement("script");
        script.src = "kuromoji.js";
        script.onload = () => {
          buildTokenizer(dicPath, resolve, reject);
        };
        script.onerror = () => {
          console.warn("[click-lookup] kuromoji.js 加载失败");
          reject(new Error("kuromoji load failed"));
        };
        document.head.appendChild(script);
      } else {
        buildTokenizer(dicPath, resolve, reject);
      }
    });
  }

  /**
   * 构建分词器
   */
  function buildTokenizer(dicPath, resolve, reject) {
    kuromoji.builder({ dicPath: dicPath }).build((err, t) => {
      if (err) {
        console.warn("[click-lookup] 词典加载失败:", err);
        reject(err);
        return;
      }
      tokenizer = t;
      tokenizerReady = true;
      console.log("[click-lookup] kuromoji 词典加载成功");
      resolve(tokenizer);
    });
  }

  /**
   * 将日语文本转换为辞书型（lemma）
   * @param {string} text - 输入文本
   * @returns {string} 辞书型文本
   */
  function toDictionaryForm(text) {
    if (!tokenizerReady || !tokenizer) {
      return text;
    }

    try {
      const tokens = tokenizer.tokenize(text);

      // 查找第一个有基本形的动词或形容词 token
      for (const token of tokens) {
        const pos = token.pos || "";
        if (pos === "動詞" || pos === "形容詞" || pos === "形容動詞") {
          if (token.basic_form && token.basic_form !== "*") {
            return token.basic_form;
          }
        }
      }

      return text;
    } catch (err) {
      console.warn("[click-lookup] 辞书型转换失败:", err);
      return text;
    }
  }

  /**
   * 通过 URL Scheme 打开外部 App
   * @param {string} url - URL Scheme
   */
  function openScheme(url) {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log("[click-lookup] 跳转 URL:", url);
  }

  /**
   * 执行查词
   * @param {string} text - 要查询的文本
   */
  async function lookupWord(text) {
    if (!text || text.trim() === "") {
      return;
    }

    const trimmedText = text.trim();

    // 尝试初始化分词器并转换为辞书型
    try {
      await initTokenizer();
    } catch (err) {
      console.log("[click-lookup] 使用原始文本查询");
    }

    // 转换为辞书型
    const dictionaryForm = toDictionaryForm(trimmedText);
    const encodedText = encodeURIComponent(dictionaryForm);
    const scheme = `mkdictionaries:///?text=${encodedText}`;

    openScheme(scheme);
  }

  /**
   * 判断是否包含汉字
   * @param {string} text - 文本
   * @returns {boolean}
   */
  function containsKanji(text) {
    // 匹配汉字范围：\u4e00-\u9faf
    return /[\u4e00-\u9faf]/.test(text);
  }

  /**
   * 判断是否为纯数字、标点符号或特殊字符
   * @param {string} text - 文本
   * @returns {boolean}
   */
  function isPunctuationOrNumber(text) {
    // 匹配数字、标点符号、空白字符、特殊符号等
    // 包括：数字、英文标点、日文标点、中文标点、圆圈数字、括号等
    return /^[\d\s\p{P}\p{S}○◎●◇◆□■△▲▽▼※〒々〆〇〈〉《》「」『』【】〔〕〖〗〘〙〚〛〝〞〟]+$/u.test(text);
  }

  /**
   * 判断词性是否需要添加点击查词
   * @param {string} pos - 词性
   * @param {string} surface - 表面形（用于过滤单字符）
   * @returns {boolean}
   */
  function isLookupablePOS(pos, surface) {
    // 如果功能被禁用，直接返回 false
    if (!currentConfig.enabled) {
      return false;
    }

    // 单字符不添加点击查词（包括平假名、片假名、汉字等）
    if (!surface) {
      return false;
    }
    
    // 使用实际字符数判断（正确处理 Unicode）
    const charCount = Array.from(surface).length;
    if (charCount <= 1) {
      return false;
    }

    // 过滤纯数字、标点符号、特殊字符
    if (isPunctuationOrNumber(surface)) {
      return false;
    }

    // 如果只处理汉字，检查是否包含汉字
    if (currentConfig.onlyKanji && !containsKanji(surface)) {
      return false;
    }

    // 动词、形容词、形容動詞、名詞、副詞
    return (
      pos === "動詞" ||
      pos === "形容詞" ||
      pos === "形容動詞" ||
      pos === "名詞" ||
      pos === "副詞"
    );
  }

  /**
   * 检查元素是否在排除区域内（笔记或答案）
   * @param {HTMLElement} element - 元素
   * @returns {boolean}
   */
  function isInExcludedArea(element) {
    // 排除笔记(#note)和答案(#back)区域
    const excludedSelectors = ["#note", "#back", ".note", ".back"];
    for (const selector of excludedSelectors) {
      if (element.closest(selector)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取需要处理的文本节点
   * @param {HTMLElement} element - 根元素
   * @returns {Array<Text>} 文本节点数组
   */
  function getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      // 跳过空白节点和脚本/样式内容
      if (
        !node.textContent.trim() ||
        node.parentElement.tagName === "SCRIPT" ||
        node.parentElement.tagName === "STYLE" ||
        node.parentElement.tagName === "BUTTON"
      ) {
        continue;
      }
      
      // 跳过已经处理过的节点或位于可点击词内部的节点
      if (node.parentElement.closest(".click-lookup-word")) {
        continue;
      }
      
      // 跳过已经处理过的父节点下的文本节点
      if (node.parentElement._clickLookupProcessed) {
        continue;
      }

      // 跳过笔记和答案区域内的节点
      if (isInExcludedArea(node.parentElement)) {
        continue;
      }

      textNodes.push(node);
    }

    return textNodes;
  }

  /**
   * 处理单个文本节点，将可点击词汇包装成 span
   * @param {Text} textNode - 文本节点
   */
  function processTextNode(textNode) {
    if (!tokenizerReady || !tokenizer) {
      return;
    }

    const text = textNode.textContent;
    if (!text.trim()) {
      return;
    }

    try {
      const tokens = tokenizer.tokenize(text);
      const parent = textNode.parentNode;
      
      // 如果没有父节点或父节点已被处理，跳过
      if (!parent) {
        return;
      }

      // 检查父节点是否已经被处理过（避免重复处理）
      if (parent._clickLookupProcessed) {
        return;
      }

      let currentIndex = 0;
      const fragment = document.createDocumentFragment();

      tokens.forEach((token) => {
        const surface = token.surface_form;
        const pos = token.pos;

        // 找到 token 在原文中的位置
        const tokenIndex = text.indexOf(surface, currentIndex);
        if (tokenIndex === -1) {
          return;
        }

        // 添加 token 前的普通文本
        if (tokenIndex > currentIndex) {
          const normalText = text.substring(currentIndex, tokenIndex);
          fragment.appendChild(document.createTextNode(normalText));
        }

        // 创建可点击的词元素
        if (isLookupablePOS(pos, surface)) {
          // 先查询该词的 JLPT 等级
          let jlptLevel = null;
          if (jlptReady && jlptChecker) {
            try {
              jlptLevel = jlptChecker.getLevel(surface);
            } catch (err) {
              console.warn(`[click-lookup] 检查 JLPT 级别失败 (${surface}):`, err);
            }
          }

          // 检查该词的 JLPT 等级是否在用户勾选的列表中
          // 如果 jlptLevels 为空，或该词不属于任何已勾选的等级，则不处理（保持普通文本）
          const enabledLevels = currentConfig.jlptLevels || [];
          const isJlptLevelEnabled = jlptLevel && enabledLevels.includes(jlptLevel);

          if (!isJlptLevelEnabled) {
            // 该词不在勾选的 JLPT 等级中，保持普通文本
            fragment.appendChild(document.createTextNode(surface));
          } else {
            // 该词在勾选的 JLPT 等级中，创建可点击 span
            const span = document.createElement("span");
            span.className = "click-lookup-word";
            span.setAttribute("data-pos", pos);
            span.setAttribute("data-lemma", token.basic_form || surface);
            span.setAttribute("data-jlpt", jlptLevel);
            span.title = `${surface} [${pos}] [${jlptLevel}] 点击查看释义`;

            // 创建词汇文本节点
            const wordTextNode = document.createTextNode(surface);
            span.appendChild(wordTextNode);

            // 如果配置允许显示 JLPT 标签，则添加标签（外层正方形 + 内层数字）
            if (currentConfig.showJlptTag) {
              const tagOuter = document.createElement("div");
              tagOuter.className = "jlpt-tag";
              tagOuter.setAttribute("data-level", jlptLevel);
              
              const tagInner = document.createElement("div");
              tagInner.className = "jlpt-tag-inner";
              // 使用数字表示等级：N1→1, N2→2, N3→3, N4→4, N5→5
              tagInner.textContent = jlptLevel.replace('N', '');
              
              tagOuter.appendChild(tagInner);
              span.appendChild(tagOuter);
            }

            // 存储事件处理器引用便于清理
            span._lookupHandler = (e) => {
              e.preventDefault();
              e.stopPropagation();
              lookupWord(token.basic_form || surface);
            };
            span.addEventListener("click", span._lookupHandler);

            fragment.appendChild(span);
          }
        } else {
          // 非目标词性，保持普通文本
          fragment.appendChild(document.createTextNode(surface));
        }

        currentIndex = tokenIndex + surface.length;
      });

      // 添加剩余文本
      if (currentIndex < text.length) {
        const remainingText = text.substring(currentIndex);
        fragment.appendChild(document.createTextNode(remainingText));
      }

      // 标记父节点已处理
      parent._clickLookupProcessed = true;
      
      // 替换原始文本节点
      parent.replaceChild(fragment, textNode);
    } catch (err) {
      console.warn("[click-lookup] 处理文本节点失败:", err);
    }
  }

  /**
   * 为 body 内容添加点击查词功能
   */
  async function enableClickLookup() {
    if (isProcessing) {
      return;
    }

    isProcessing = true;

    try {
      // 并行加载分词器和 JLPT Checker
      await Promise.all([
        initTokenizer(),
        initJLPTChecker()
      ]);

      const body = document.body;
      if (!body) {
        console.warn("[click-lookup] 未找到 body 元素");
        return;
      }

      // 获取所有文本节点
      const textNodes = getTextNodes(body);

      // 处理每个文本节点
      textNodes.forEach((node) => {
        processTextNode(node);
      });

      console.log("[click-lookup] 点击查词功能已启用");
    } catch (err) {
      console.error("[click-lookup] 启用失败:", err);
    } finally {
      isProcessing = false;
    }
  }

  /**
   * 添加必要的 CSS 样式
   * N1 词汇使用波浪下划线，其他词汇使用虚线下划线
   * 添加 JLPT 等级标签样式
   */
  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      /* 默认样式：虚线下划线（非 JLPT 词汇） */
      .click-lookup-word {
        cursor: pointer;
        text-decoration: underline dashed rgba(0, 122, 204, 0.6);
        text-decoration-thickness: 1.5px;
        text-underline-offset: 2px;
        transition: background-color 0.2s;
        position: relative;
        display: inline-block;
      }
      .click-lookup-word:hover {
        background-color: #e6f3ff;
      }
      
      /* JLPT 词汇：统一使用波浪下划线（红色系）- 强制覆盖其他样式 */
      .click-lookup-word[data-jlpt],
      .click-lookup-word[data-jlpt="N1"],
      .click-lookup-word[data-jlpt="N2"],
      .click-lookup-word[data-jlpt="N3"],
      .click-lookup-word[data-jlpt="N4"],
      .click-lookup-word[data-jlpt="N5"] {
        text-decoration: underline wavy rgba(231, 76, 60, 0.7) !important;
        text-decoration-thickness: 1.5px !important;
      }
      .click-lookup-word[data-jlpt]:hover,
      .click-lookup-word[data-jlpt="N1"]:hover,
      .click-lookup-word[data-jlpt="N2"]:hover,
      .click-lookup-word[data-jlpt="N3"]:hover,
      .click-lookup-word[data-jlpt="N4"]:hover,
      .click-lookup-word[data-jlpt="N5"]:hover {
        background-color: #fdeaea;
      }
      
      /* JLPT 等级标签样式 - 绝对定位右上角，外层固定尺寸正方形 */
      .jlpt-tag {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 10px;
        height: 10px;
        border-radius: 2px;
        opacity: 0.85;
        transition: opacity 0.2s;
        z-index: 1;
        background: rgba(0, 0, 0, 0.75);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      /* 内层数字容器 - 用 scale 缩小数字，不影响外层正方形 */
      .jlpt-tag-inner {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
        font-size: 16px;
        font-weight: 700;
        line-height: 1;
        color: white;
        transform: scale(0.5);
        transform-origin: center;
        width: 100%;
        height: 100%;
      }
      
      .click-lookup-word:hover .jlpt-tag {
        opacity: 1;
      }
      
      /* 按词性区分颜色（仅用于非 JLPT 词汇） */
      .click-lookup-word[data-pos="動詞"]:not([data-jlpt]) {
        text-decoration-color: rgba(231, 76, 60, 0.5);
      }
      .click-lookup-word[data-pos="動詞"]:not([data-jlpt]):hover {
        background-color: #fdeaea;
      }
      
      .click-lookup-word[data-pos="形容詞"]:not([data-jlpt]),
      .click-lookup-word[data-pos="形容動詞"]:not([data-jlpt]) {
        text-decoration-color: rgba(39, 174, 96, 0.5);
      }
      .click-lookup-word[data-pos="形容詞"]:not([data-jlpt]):hover,
      .click-lookup-word[data-pos="形容動詞"]:not([data-jlpt]):hover {
        background-color: #eafaf1;
      }
      
      .click-lookup-word[data-pos="名詞"]:not([data-jlpt]) {
        text-decoration-color: rgba(142, 68, 173, 0.5);
      }
      .click-lookup-word[data-pos="名詞"]:not([data-jlpt]):hover {
        background-color: #f5eef8;
      }
      
      .click-lookup-word[data-pos="副詞"]:not([data-jlpt]) {
        text-decoration-color: rgba(243, 156, 18, 0.5);
      }
      .click-lookup-word[data-pos="副詞"]:not([data-jlpt]):hover {
        background-color: #fef5e7;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 初始化 React 设置组件
   */
  function initReactSettings() {
    const container = document.getElementById("button-container");
    if (!container) {
      console.warn("[click-lookup] 未找到 button-container");
      return;
    }

    // 调用设置组件渲染函数
    try {
      renderSettingsButton(container);
      addSettingsStyles();
      console.log("[click-lookup] React 设置组件已初始化");
    } catch (err) {
      console.warn("[click-lookup] React 设置组件初始化失败:", err);
    }
  }

  /**
   * 清理函数 - 移除所有事件监听器和DOM引用
   */
  function cleanup() {
    const elements = document.querySelectorAll(".click-lookup-word");
    elements.forEach((el) => {
      if (el._lookupHandler) {
        el.removeEventListener("click", el._lookupHandler);
        delete el._lookupHandler;
      }
    });
    
    // 清理父节点的处理标记
    document.querySelectorAll("*").forEach((el) => {
      if (el._clickLookupProcessed) {
        delete el._clickLookupProcessed;
      }
    });
    
    console.log("[click-lookup] 已清理");
  }

  // 挂载到 window 对象（供外部调用）
  window.AnkiClickLookup = {
    enable: enableClickLookup,
    initTokenizer: initTokenizer,
    cleanup: cleanup,
    updateConfig: (newConfig) => {
      // 更新全局配置
      currentConfig = { ...currentConfig, ...newConfig };
      console.log("[click-lookup] 配置已更新:", currentConfig);
    },
  };

  // ============ 自动初始化 ============
  (function autoInit() {
    const init = () => {
      // 加载配置
      currentConfig = loadConfig();
      
      addStyles();

      // 初始化 React 设置组件（放到 button-container 中）
      initReactSettings();

      // 延迟执行，确保页面内容已加载
      setTimeout(() => {
        enableClickLookup();
      }, 100);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();

  // 页面卸载时清理资源
  window.addEventListener("beforeunload", cleanup);
})();
