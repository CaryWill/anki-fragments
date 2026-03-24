/**
 * JLPT Checker 使用示例
 * 
 * 这个文件展示了如何在你的项目中使用基于 stephenmk/yomitan-jlpt-vocab 的 JLPT 检查器
 * 数据来源：https://github.com/stephenmk/yomitan-jlpt-vocab
 * 基于 JMdict 词典，与 kuromoji 使用相同的数据源
 */

// ============================================
// 示例 1: 基本使用 - 检查单词是否为 N1/N2
// ============================================

async function example1_basicUsage() {
  // 导入 JLPT Checker（在实际使用时需要根据你的模块系统调整）
  const { default: jlptChecker } = await import('./jlpt-checker.js');
  
  // 加载 JLPT 数据（只需加载一次）
  await jlptChecker.load();
  
  // 检查单词是否为 N1 或 N2
  console.log(jlptChecker.isN1OrN2('相対'));  // true (N1)
  console.log(jlptChecker.isN1OrN2('愛想'));  // true (N1)
  console.log(jlptChecker.isN1OrN2('猫'));    // false (N5)
  
  // 获取具体级别
  console.log(jlptChecker.getLevel('相対'));  // 'N1'
  console.log(jlptChecker.getLevel('愛想'));  // 'N1'
  console.log(jlptChecker.getLevel('猫'));    // null
}

// ============================================
// 示例 2: 带读音的精确匹配
// ============================================

async function example2_withReading() {
  const { default: jlptChecker } = await import('./jlpt-checker.js');
  await jlptChecker.load();
  
  // 某些汉字有多个读音，可以通过读音进行精确匹配
  console.log(jlptChecker.isN1OrN2('相', 'あい'));      // true
  console.log(jlptChecker.getLevel('相対', 'あいたい')); // 'N1'
}

// ============================================
// 示例 3: 批量检查多个单词
// ============================================

async function example3_batchCheck() {
  const { default: jlptChecker } = await import('./jlpt-checker.js');
  await jlptChecker.load();
  
  const words = [
    { word: '相対', reading: 'あいたい' },
    { word: '愛想', reading: 'あいそ' },
    { word: '猫' }
  ];
  
  const results = jlptChecker.checkBatch(words);
  
  for (const [word, level] of results) {
    console.log(`${word}: ${level || '不在 N1/N2 范围内'}`);
  }
}

// ============================================
// 示例 4: 在点击查词功能中集成 JLPT 过滤
// ============================================

async function example4_clickLookupIntegration() {
  const { default: jlptChecker } = await import('./jlpt-checker.js');
  await jlptChecker.load();
  
  // 假设这是 kuromoji 分词后的 token
  const token = {
    surface_form: '相対',
    pos: '名詞',
    basic_form: '相対',
    reading: 'アイタイ'
  };
  
  // 判断是否应该添加下划线（只对 N1/N2 词汇添加）
  function shouldUnderline(token) {
    const surface = token.surface_form;
    const pos = token.pos;
    
    // 检查词性
    const isValidPOS = (
      pos === '動詞' ||
      pos === '形容詞' ||
      pos === '形容動詞' ||
      pos === '名詞' ||
      pos === '副詞'
    );
    
    if (!isValidPOS) {
      return false;
    }
    
    // 检查是否为 N1/N2 词汇
    return jlptChecker.isN1OrN2(surface);
  }
  
  console.log(shouldUnderline(token)); // true
}

// ============================================
// 示例 5: 获取所有 N1/N2 词汇列表
// ============================================

async function example5_getAllWords() {
  const { default: jlptChecker } = await import('./jlpt-checker.js');
  await jlptChecker.load();
  
  const n1Words = jlptChecker.getAllN1Words();
  const n2Words = jlptChecker.getAllN2Words();
  
  console.log(`N1 词汇总数: ${n1Words.length}`); // 3214
  console.log(`N2 词汇总数: ${n2Words.length}`); // 1856
  
  // 显示前 10 个 N1 词汇
  console.log('前 10 个 N1 词汇:', n1Words.slice(0, 10));
}

// ============================================
// 示例 6: 在 Anki 卡片中使用
// ============================================

// 在 Anki 卡片的前端模板中：
/*
<script src="jlpt-checker.js"></script>
<script src="kuromoji.js"></script>
<script>
(async function() {
  // 加载 JLPT 数据
  await jlptChecker.load();
  
  // 加载 kuromoji 分词器
  const tokenizer = await new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: "" }).build((err, t) => {
      if (err) reject(err);
      else resolve(t);
    });
  });
  
  // 获取卡片正面文本
  const frontText = document.getElementById('front').textContent;
  
  // 分词
  const tokens = tokenizer.tokenize(frontText);
  
  // 只为 N1/N2 词汇添加下划线
  tokens.forEach(token => {
    const surface = token.surface_form;
    const pos = token.pos;
    
    // 检查词性和 JLPT 级别
    const isValidPOS = ['動詞', '形容詞', '形容動詞', '名詞', '副詞'].includes(pos);
    const isN1N2 = jlptChecker.isN1OrN2(surface);
    
    if (isValidPOS && isN1N2) {
      // 添加下划线样式
      const level = jlptChecker.getLevel(surface);
      console.log(`${surface} [${level}]`);
    }
  });
})();
</script>
*/

// ============================================
// 数据统计信息
// ============================================

/*
JLPT 词汇数量统计（基于 stephenmk/yomitan-jlpt-vocab）：
- N1: 3214 词
- N2: 1856 词
- N3: 1695 词
- N4: 643 词
- N5: 705 词
- 总计: 8113 词

数据特点：
1. 基于 JMdict 词典，与 kuromoji 使用相同的数据源
2. 经过人工校正，修正了罕见拼写（如：歯磨 → 歯磨き）
3. 包含读音信息，可以进行更精确的匹配
4. 数据来源于 Jonathan Waller 的 JLPT Resources，与 jisho.org 使用相同的数据源
*/
