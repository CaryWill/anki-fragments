/**
 * 集成 JLPT 过滤的点击查词功能
 * 在原有的点击查词功能基础上，增加 JLPT N1/N2 级别过滤
 * 
 * 使用方法：
 * 1. 在 build.mjs 中添加此文件的构建配置
 * 2. 在 Anki 卡片模板中引入编译后的文件
 * 3. 在设置中启用 "仅显示 N1/N2 词汇" 选项
 */

import jlptChecker from './jlpt-checker.js';

// 扩展默认配置，添加 JLPT 过滤选项
const defaultConfig = {
  enabled: true,
  onlyKanji: false,
  onlyN1N2: false,  // 新增：仅显示 N1/N2 词汇
  ttsProvider: "google",
  font: "default",
};

/**
 * 判断词性是否需要添加点击查词（增强版，支持 JLPT 过滤）
 * @param {string} pos - 词性
 * @param {string} surface - 表面形（用于过滤单字符和 JLPT 检查）
 * @param {object} config - 当前配置
 * @returns {boolean}
 */
function isLookupablePOS(pos, surface, config) {
  // 如果功能被禁用，直接返回 false
  if (!config.enabled) {
    return false;
  }

  // 单字符不添加点击查词
  if (!surface) {
    return false;
  }
  const charCount = Array.from(surface).length;
  if (charCount <= 1) {
    return false;
  }

  // 如果只处理汉字，检查是否包含汉字
  if (config.onlyKanji && !containsKanji(surface)) {
    return false;
  }

  // 检查词性
  const isValidPOS = (
    pos === "動詞" ||
    pos === "形容詞" ||
    pos === "形容動詞" ||
    pos === "名詞" ||
    pos === "副詞"
  );

  if (!isValidPOS) {
    return false;
  }

  // 如果启用了 JLPT N1/N2 过滤
  if (config.onlyN1N2) {
    // 检查是否为 N1 或 N2 词汇
    return jlptChecker.isN1OrN2(surface);
  }

  return true;
}

/**
 * 判断是否包含汉字
 * @param {string} text - 文本
 * @returns {boolean}
 */
function containsKanji(text) {
  return /[\u4e00-\u9faf]/.test(text);
}

/**
 * 获取 JLPT 级别标签（用于显示）
 * @param {string} word - 单词
 * @returns {string} 级别标签，如 "N1" 或 "N2"，如果不是则返回空字符串
 */
function getJLPTLevelTag(word) {
  const level = jlptChecker.getLevel(word);
  return level ? ` [${level}]` : '';
}

/**
 * 处理单个文本节点，将可点击词汇包装成 span（增强版）
 * @param {Text} textNode - 文本节点
 * @param {object} tokenizer - kuromoji 分词器
 * @param {object} config - 当前配置
 */
function processTextNodeWithJLPT(textNode, tokenizer, config) {
  if (!tokenizer) {
    return;
  }

  const text = textNode.textContent;
  if (!text.trim()) {
    return;
  }

  try {
    const tokens = tokenizer.tokenize(text);
    const parent = textNode.parentNode;
    
    if (!parent || parent._clickLookupProcessed) {
      return;
    }

    let currentIndex = 0;
    const fragment = document.createDocumentFragment();

    tokens.forEach((token) => {
      const surface = token.surface_form;
      const pos = token.pos;

      const tokenIndex = text.indexOf(surface, currentIndex);
      if (tokenIndex === -1) {
        return;
      }

      // 添加 token 前的普通文本
      if (tokenIndex > currentIndex) {
        const normalText = text.substring(currentIndex, tokenIndex);
        fragment.appendChild(document.createTextNode(normalText));
      }

      // 创建可点击的词元素（使用增强的判断函数）
      if (isLookupablePOS(pos, surface, config)) {
        const span = document.createElement("span");
        span.textContent = surface;
        span.className = "click-lookup-word";
        span.setAttribute("data-pos", pos);
        span.setAttribute("data-lemma", token.basic_form || surface);
        
        // 添加 JLPT 级别信息到 title
        const jlptTag = getJLPTLevelTag(surface);
        span.title = `${surface}${jlptTag} [${pos}] 点击查看释义`;
        
        // 如果是 N1/N2 词汇，添加额外的 class 用于样式区分
        if (jlptTag) {
          span.classList.add(`jlpt-${jlptTag.replace(/[\[\]]/g, '').toLowerCase()}`);
        }
        
        span._lookupHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          lookupWord(token.basic_form || surface);
        };
        span.addEventListener("click", span._lookupHandler);
        
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(surface));
      }

      currentIndex = tokenIndex + surface.length;
    });

    // 添加剩余文本
    if (currentIndex < text.length) {
      const remainingText = text.substring(currentIndex);
      fragment.appendChild(document.createTextNode(remainingText));
    }

    parent._clickLookupProcessed = true;
    parent.replaceChild(fragment, textNode);
  } catch (err) {
    console.warn("[click-lookup-jlpt] 处理文本节点失败:", err);
  }
}

/**
 * 通过 URL Scheme 打开外部 App
 * @param {string} url - URL Scheme
 */
function lookupWord(text) {
  if (!text || text.trim() === "") {
    return;
  }
  const encodedText = encodeURIComponent(text.trim());
  const scheme = `mkdictionaries:///?text=${encodedText}`;
  
  const a = document.createElement("a");
  a.href = scheme;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.log("[click-lookup-jlpt] 跳转 URL:", scheme);
}

/**
 * 添加 JLPT 相关的 CSS 样式
 */
function addJLPTStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* JLPT N1 词汇 - 使用更深的颜色和实线下划线 */
    .click-lookup-word.jlpt-n1 {
      text-decoration: underline solid rgba(231, 76, 60, 0.7);
      text-decoration-thickness: 2px;
    }
    .click-lookup-word.jlpt-n1:hover {
      background-color: #fdeaea;
      text-decoration: underline solid rgba(231, 76, 60, 0.9);
    }
    
    /* JLPT N2 词汇 - 使用中等颜色和实线下划线 */
    .click-lookup-word.jlpt-n2 {
      text-decoration: underline solid rgba(52, 152, 219, 0.7);
      text-decoration-thickness: 2px;
    }
    .click-lookup-word.jlpt-n2:hover {
      background-color: #ebf5fb;
      text-decoration: underline solid rgba(52, 152, 219, 0.9);
    }
    
    /* 非 N1/N2 词汇保持原有的波浪线样式（透明度更低） */
    .click-lookup-word:not(.jlpt-n1):not(.jlpt-n2) {
      text-decoration: underline wavy rgba(0, 122, 204, 0.3);
    }
  `;
  document.head.appendChild(style);
}

// 导出增强的函数供外部使用
export {
  defaultConfig,
  isLookupablePOS,
  processTextNodeWithJLPT,
  addJLPTStyles,
  getJLPTLevelTag,
};
