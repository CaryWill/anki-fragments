/**
 * 查词按钮功能模块
 * 自动初始化，无需手动调用
 * 支持日语辞书型（lemma）转换
 */

(function () {
  "use strict";

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

  // kuromoji 加载状态
  let tokenizer = null;
  let tokenizerReady = false;

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
          console.warn("[lookup] kuromoji.js 加载失败，将使用原始文本查词");
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
        console.warn("[lookup] 词典加载失败:", err);
        reject(err);
        return;
      }
      tokenizer = t;
      tokenizerReady = true;
      console.log("[lookup] kuromoji 词典加载成功");
      resolve(tokenizer);
    });
  }

  /**
   * 将日语文本转换为辞书型（lemma）
   * 提取第一个动词/形容词的基本形，或返回原始文本
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
        // 只处理动词、形容词、形容动词
        const pos = token.pos || "";
        if (pos === "動詞" || pos === "形容詞" || pos === "形容動詞") {
          // 如果有基本形（辞书形），使用基本形
          if (token.basic_form && token.basic_form !== "*") {
            console.log("[lookup] 辞书型转换:", text, "→", token.basic_form);
            return token.basic_form;
          }
        }
      }
      
      // 如果没有找到动词/形容词，返回原始文本
      console.log("[lookup] 无需转换:", text);
      return text;
    } catch (err) {
      console.warn("[lookup] 辞书型转换失败:", err);
      return text;
    }
  }

  /**
   * 通过 URL Scheme 打开外部 App
   * @param {string} url - URL Scheme
   */
  function openScheme(url) {
    // 方法一：创建隐藏 <a> 标签并模拟点击（最兼容）
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log("方法一（<a> 点击）已触发:", url);
  }

  /**
   * 初始化查词按钮
   * @param {HTMLElement} container - 容器元素
   * @param {string} frontText - 正面文本
   * @returns {HTMLElement} 查词按钮元素
   */
  function initLookupButton(container, frontText) {
    // 用于保存选中文本的变量
    let savedSelection = null;

    // 创建查词按钮
    const lookupBtn = document.createElement("button");
    lookupBtn.textContent = "查词";
    lookupBtn.setAttribute(
      "style",
      "margin-left: 10px; display: inline-block;",
    );

    // 在鼠标按下时保存当前选中的文本
    lookupBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      savedSelection = window.getSelection().toString().trim();
      console.log("保存的选中文本:", savedSelection);
    });

    // 查词按钮点击事件
    lookupBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      let textToLookup = "";

      if (savedSelection) {
        textToLookup = savedSelection;
        console.log("使用保存的选中文本");
      } else {
        textToLookup = frontText;
        console.log("使用全文");
      }

      if (!textToLookup) {
        alert("没有可查询的内容");
        return;
      }

      // 尝试初始化分词器并转换为辞书型
      try {
        await initTokenizer();
      } catch (err) {
        // 分词器加载失败，继续使用原始文本
        console.log("[lookup] 使用原始文本查询");
      }

      // 转换为辞书型
      const dictionaryForm = toDictionaryForm(textToLookup);
      
      const encodedText = encodeURIComponent(dictionaryForm);
      const scheme = `mkdictionaries:///?text=${encodedText}`;

      console.log("跳转 URL:", scheme);
      openScheme(scheme);

      savedSelection = null;
    });

    lookupBtn.setAttribute("data-order", "5");
    container.appendChild(lookupBtn);
    sortButtons(container);
    return lookupBtn;
  }

  // 挂载到 window 对象（供外部调用）
  window.AnkiLookup = {
    init: initLookupButton,
  };

  // ============ 自动初始化 ============

  (function autoInit() {
    const init = () => {
      const container = document.getElementById("button-container");
      const frontElement = document.getElementById("front");

      if (!container) {
        console.warn("未找到 button-container 元素");
        return;
      }

      if (!frontElement) {
        console.warn("未找到 front 元素");
        return;
      }

      const frontText = frontElement.textContent.trim();

      if (!frontText) {
        console.warn("front 元素内容为空");
        return;
      }

      initLookupButton(container, frontText);
      console.log("查词按钮已自动初始化");
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();