/**
 * JLPT 词汇级别检查模块
 * 用于判断日语单词是否属于 JLPT N1 或 N2 级别
 * 数据来源：https://github.com/stephenmk/yomitan-jlpt-vocab
 * 基于 JMdict 词典，与 kuromoji 使用相同的数据源
 */

class JLPTChecker {
  constructor() {
    // 使用 Map 存储词汇和读音的映射，提高匹配准确度
    // key: 词汇表面形，value: Set of readings
    this.n1Words = new Map();
    this.n2Words = new Map();
    this.isLoaded = false;
    this.loadPromise = null;
  }

  /**
   * 加载 JLPT 词汇数据
   * 数据来源：https://github.com/stephenmk/yomitan-jlpt-vocab
   */
  async load() {
    if (this.isLoaded) {
      return;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this._loadData();
    await this.loadPromise;
    this.isLoaded = true;
  }

  async _loadData() {
    try {
      // 加载所有 5 个 JSON 文件
      const loadPromises = [];
      for (let i = 1; i <= 5; i++) {
        loadPromises.push(
          fetch(`term_meta_bank_${i}.json`)
            .then(res => res.json())
        );
      }

      const allData = await Promise.all(loadPromises);
      
      // 解析所有数据
      for (const data of allData) {
        this._parseJSON(data);
      }
      
      console.log(`[JLPT Checker] 加载完成: N1=${this.n1Words.size} 词, N2=${this.n2Words.size} 词`);
    } catch (error) {
      console.error('[JLPT Checker] 加载失败:', error);
      // 加载失败时使用空集合，不影响其他功能
    }
  }

  /**
   * 解析 JSON 数据
   * 数据格式: [word, "freq", {reading: "...", frequency: {displayValue: "N1"}}]
   */
  _parseJSON(data) {
    for (const entry of data) {
      if (entry.length < 3) continue;
      
      const word = entry[0];
      const metadata = entry[2];
      const reading = metadata.reading;
      const level = metadata.frequency?.displayValue;

      if (level === 'N1') {
        if (!this.n1Words.has(word)) {
          this.n1Words.set(word, new Set());
        }
        this.n1Words.get(word).add(reading);
      } else if (level === 'N2') {
        if (!this.n2Words.has(word)) {
          this.n2Words.set(word, new Set());
        }
        this.n2Words.get(word).add(reading);
      }
    }
  }

  /**
   * 检查单词是否属于 N1 或 N2 级别
   * @param {string} word - 要检查的日语单词
   * @param {string} [reading] - 可选的读音，用于更精确的匹配
   * @returns {boolean} 如果是 N1 或 N2 词汇返回 true
   */
  isN1OrN2(word, reading = null) {
    if (!this.isLoaded) {
      console.warn('[JLPT Checker] 数据尚未加载');
      return false;
    }

    // 如果提供了读音，进行精确匹配
    if (reading) {
      const n1Readings = this.n1Words.get(word);
      const n2Readings = this.n2Words.get(word);
      
      if (n1Readings && n1Readings.has(reading)) {
        return true;
      }
      if (n2Readings && n2Readings.has(reading)) {
        return true;
      }
      return false;
    }

    // 没有读音时，只检查词汇是否存在
    return this.n1Words.has(word) || this.n2Words.has(word);
  }

  /**
   * 获取单词的 JLPT 级别
   * @param {string} word - 要检查的日语单词
   * @param {string} [reading] - 可选的读音，用于更精确的匹配
   * @returns {'N1'|'N2'|null} 返回级别或 null
   */
  getLevel(word, reading = null) {
    if (!this.isLoaded) {
      return null;
    }

    // 如果提供了读音，进行精确匹配
    if (reading) {
      const n1Readings = this.n1Words.get(word);
      if (n1Readings && n1Readings.has(reading)) {
        return 'N1';
      }
      
      const n2Readings = this.n2Words.get(word);
      if (n2Readings && n2Readings.has(reading)) {
        return 'N2';
      }
      
      return null;
    }

    // 没有读音时，只检查词汇是否存在
    if (this.n1Words.has(word)) {
      return 'N1';
    } else if (this.n2Words.has(word)) {
      return 'N2';
    }
    return null;
  }

  /**
   * 批量检查多个单词
   * @param {Array<{word: string, reading?: string}>} words - 单词数组
   * @returns {Map<string, 'N1'|'N2'|null>} 单词到级别的映射
   */
  checkBatch(words) {
    const result = new Map();
    for (const item of words) {
      const word = typeof item === 'string' ? item : item.word;
      const reading = typeof item === 'object' ? item.reading : null;
      result.set(word, this.getLevel(word, reading));
    }
    return result;
  }

  /**
   * 获取所有 N1 词汇
   * @returns {Array<string>} N1 词汇数组
   */
  getAllN1Words() {
    return Array.from(this.n1Words.keys());
  }

  /**
   * 获取所有 N2 词汇
   * @returns {Array<string>} N2 词汇数组
   */
  getAllN2Words() {
    return Array.from(this.n2Words.keys());
  }
}

// 创建全局单例
const jlptChecker = new JLPTChecker();

// 在浏览器环境中挂载到 window 对象
if (typeof window !== 'undefined') {
  window.jlptChecker = jlptChecker;
  window.JLPTChecker = JLPTChecker;
}

// 导出（用于模块化环境）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = jlptChecker;
  module.exports.JLPTChecker = JLPTChecker;
}
