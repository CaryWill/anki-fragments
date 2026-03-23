/**
 * 点击查词功能模块
 * 自动为页面中的日语词汇添加点击查词功能
 * 支持动词、形容词、名词、副词
 */

(function () {
  "use strict";

  // kuromoji 加载状态
  let tokenizer = null;
  let tokenizerReady = false;
  let isProcessing = false;

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
   * 判断词性是否需要添加点击查词
   * @param {string} pos - 词性
   * @param {string} surface - 表面形（用于过滤单字符）
   * @returns {boolean}
   */
  function isLookupablePOS(pos, surface) {
    // 单字符不添加点击查词（包括平假名、片假名、汉字等）
    if (!surface) {
      return false;
    }
    // 使用实际字符数判断（正确处理 Unicode）
    const charCount = Array.from(surface).length;
    if (charCount <= 1) {
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
          const span = document.createElement("span");
          span.textContent = surface;
          span.className = "click-lookup-word";
          span.setAttribute("data-pos", pos);
          span.setAttribute("data-lemma", token.basic_form || surface);
          span.title = `${surface} [${pos}] 点击查看释义`;
          
          // 使用事件委托，存储引用便于清理
          span._lookupHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            lookupWord(token.basic_form || surface);
          };
          span.addEventListener("click", span._lookupHandler);
          
          fragment.appendChild(span);
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
      // 等待分词器就绪
      await initTokenizer();

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
   * 文字颜色保持默认，仅下划线颜色区分词性
   */
  function addStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .click-lookup-word {
        cursor: pointer;
        text-decoration: underline wavy #007acc;
        transition: background-color 0.2s;
      }
      .click-lookup-word:hover {
        background-color: #e6f3ff;
      }
      .click-lookup-word[data-pos="動詞"] {
        text-decoration: underline wavy #e74c3c;
      }
      .click-lookup-word[data-pos="動詞"]:hover {
        background-color: #fdeaea;
      }
      .click-lookup-word[data-pos="形容詞"],
      .click-lookup-word[data-pos="形容動詞"] {
        text-decoration: underline wavy #27ae60;
      }
      .click-lookup-word[data-pos="形容詞"]:hover,
      .click-lookup-word[data-pos="形容動詞"]:hover {
        background-color: #eafaf1;
      }
      .click-lookup-word[data-pos="名詞"] {
        text-decoration: underline wavy #8e44ad;
      }
      .click-lookup-word[data-pos="名詞"]:hover {
        background-color: #f5eef8;
      }
      .click-lookup-word[data-pos="副詞"] {
        text-decoration: underline wavy #f39c12;
      }
      .click-lookup-word[data-pos="副詞"]:hover {
        background-color: #fef5e7;
      }
    `;
    document.head.appendChild(style);
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
  };

  // ============ 自动初始化 ============
  (function autoInit() {
    const init = () => {
      addStyles();

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
