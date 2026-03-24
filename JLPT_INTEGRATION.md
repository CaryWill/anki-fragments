# JLPT 词汇级别检查器集成指南

## 概述

本项目已集成基于 [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab) 的 JLPT 词汇级别检查器。

### 数据来源特点

- ✅ **基于 JMdict 词典** - 与 kuromoji 使用相同的数据源，兼容性好
- ✅ **数据准确** - 经过人工校正，修正了罕见拼写（如：歯磨 → 歯磨き）
- ✅ **包含读音信息** - 支持更精确的词汇匹配
- ✅ **与 jisho.org 一致** - 使用相同的 Jonathan Waller's JLPT Resources

### 词汇数量统计

| 级别 | 词汇数量 |
|------|---------|
| N1   | 3,214   |
| N2   | 1,856   |
| N3   | 1,695   |
| N4   | 643     |
| N5   | 705     |
| **总计** | **8,113** |

## 文件结构

```
src/
├── jlpt-checker.js              # JLPT 检查器核心模块
├── jlpt-data/                   # JLPT 词汇数据
│   ├── term_meta_bank_1.json   # N1 词汇数据
│   ├── term_meta_bank_2.json   # N2 词汇数据
│   ├── term_meta_bank_3.json   # N3 词汇数据
│   ├── term_meta_bank_4.json   # N4 词汇数据
│   └── term_meta_bank_5.json   # N5 词汇数据
├── click-lookup-with-jlpt-filter.jsx  # 带 JLPT 过滤的点击查词组件
└── jlpt-usage-example.js       # 使用示例

dist/                            # 构建输出（自动生成）
└── term_meta_bank_*.json        # 复制到这里

Anki media/                      # 部署目标（自动复制）
└── term_meta_bank_*.json        # 最终部署位置
```

## 使用方法

### 1. 基本使用

```javascript
// 导入 JLPT Checker
import jlptChecker from './jlpt-checker.js';

// 加载数据（只需加载一次）
await jlptChecker.load();

// 检查单词是否为 N1 或 N2
console.log(jlptChecker.isN1OrN2('相対'));  // true (N1)
console.log(jlptChecker.isN1OrN2('猫'));    // false (N5)

// 获取具体级别
console.log(jlptChecker.getLevel('相対'));  // 'N1'
console.log(jlptChecker.getLevel('猫'));    // null
```

### 2. 带读音的精确匹配

```javascript
// 某些汉字有多个读音，可以通过读音进行精确匹配
console.log(jlptChecker.isN1OrN2('相', 'あい'));      // true
console.log(jlptChecker.getLevel('相対', 'あいたい')); // 'N1'
```

### 3. 在点击查词功能中使用

```javascript
// 在 click-lookup-with-settings.jsx 中集成
function isLookupablePOS(pos, surface, config) {
  // ... 其他检查 ...
  
  // 如果启用了 JLPT N1/N2 过滤
  if (config.onlyN1N2) {
    return jlptChecker.isN1OrN2(surface);
  }
  
  return true;
}
```

### 4. 在 Anki 卡片中使用

在 Anki 卡片的前端模板中：

```html
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
    const isN1N2 = jlptChecker.isN1OrN2(surface);
    
    if (isN1N2) {
      const level = jlptChecker.getLevel(surface);
      console.log(`${surface} [${level}]`);
    }
  });
})();
</script>
```

## API 文档

### `jlptChecker.load()`

加载 JLPT 词汇数据。

- **返回**: `Promise<void>`
- **说明**: 只需调用一次，会自动缓存数据

### `jlptChecker.isN1OrN2(word, reading?)`

检查单词是否属于 N1 或 N2 级别。

- **参数**:
  - `word` (string): 要检查的日语单词
  - `reading` (string, 可选): 读音，用于更精确的匹配
- **返回**: `boolean`

### `jlptChecker.getLevel(word, reading?)`

获取单词的 JLPT 级别。

- **参数**:
  - `word` (string): 要检查的日语单词
  - `reading` (string, 可选): 读音，用于更精确的匹配
- **返回**: `'N1' | 'N2' | null`

### `jlptChecker.checkBatch(words)`

批量检查多个单词。

- **参数**:
  - `words` (Array): 单词数组，可以是字符串数组或对象数组 `{word, reading?}`
- **返回**: `Map<string, 'N1'|'N2'|null>`

### `jlptChecker.getAllN1Words()`

获取所有 N1 词汇。

- **返回**: `Array<string>`

### `jlptChecker.getAllN2Words()`

获取所有 N2 词汇。

- **返回**: `Array<string>`

## 构建和部署

### 构建项目

```bash
npm run build
```

构建过程会自动：
1. 复制 JLPT 数据文件到 `dist/` 目录
2. 将所有文件部署到 Anki media 目录

### 开发模式

```bash
npm run watch
```

监听文件变化并自动重新构建。

## 数据更新

如果需要更新 JLPT 数据：

1. 下载最新的数据：
```bash
curl -L "https://github.com/stephenmk/yomichan-jlpt-vocab/releases/latest/download/jlpt.zip" -o jlpt.zip
unzip jlpt.zip
```

2. 复制数据文件到项目：
```bash
cp term_meta_bank_*.json src/jlpt-data/
```

3. 重新构建：
```bash
npm run build
```

## 性能优化

- 数据加载是异步的，不会阻塞页面渲染
- 使用 Map 数据结构，查询时间复杂度为 O(1)
- 数据只加载一次，后续查询直接使用缓存
- 总数据大小约 800KB，压缩后更小

## 许可证

JLPT 数据来源于 [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab)，遵循 CC BY-SA 4.0 许可证。

原始数据来源于 [Jonathan Waller's JLPT Resources](http://www.tanos.co.uk/jlpt/)，遵循 Creative Commons BY 许可证。

## 参考资料

- [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab)
- [Jonathan Waller's JLPT Resources](http://www.tanos.co.uk/jlpt/)
- [JMdict](https://www.edrdg.org/jmdict/j_jmdict.html)
- [JLPT Official Website](https://www.jlpt.jp/e/)
