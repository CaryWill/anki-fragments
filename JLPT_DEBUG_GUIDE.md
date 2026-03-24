# JLPT 功能调试指南

## 问题描述

用户反馈："間柄" 这个 N1 词汇没有显示波浪下划线。

## 已验证的信息

### 1. 数据完整性 ✅

```bash
# 验证 "間柄" 在 JLPT 数据中
grep "間柄" src/jlpt-data/term_meta_bank_1.json
```

**结果**：
```json
["間柄", "freq", {"reading": "あいだがら", "frequency": {"value": -1, "displayValue": "N1"}}]
```

✅ 数据存在且正确标记为 N1

### 2. 文件部署 ✅

所有文件已正确部署到 Anki media 目录：
- `jlpt-checker.js` ✅
- `term_meta_bank_1.json` ~ `term_meta_bank_5.json` ✅
- `click-lookup.bundle.js` ✅

### 3. 代码修复 ✅

已修复的问题：
1. **模块加载问题**：移除了 `type="module"`，改为普通脚本加载
2. **错误处理**：添加了详细的错误日志和异常捕获
3. **调试日志**：添加了 JLPT 级别检测的日志输出

## 如何在 Anki 中调试

### 步骤 1: 打开浏览器开发者工具

在 Anki 中查看卡片时：
- **macOS**: `Cmd + Shift + I`
- **Windows/Linux**: `Ctrl + Shift + I`

### 步骤 2: 查看控制台日志

在控制台中应该看到以下日志：

```javascript
// 成功加载的日志
[click-lookup] jlpt-checker.js 脚本加载完成
[click-lookup] JLPT Checker 加载成功，N1词汇数: 3214
[click-lookup] kuromoji 词典加载成功
[click-lookup] 点击查词功能已启用

// 词汇检测日志（如果检测到 N1 词汇）
[click-lookup] 检测到 N1 词汇: 間柄
```

### 步骤 3: 检查 DOM 元素

在开发者工具的 Elements 面板中，找到 "間柄" 这个词，检查其 HTML：

**正确的 HTML 应该是**：
```html
<span class="click-lookup-word" 
      data-pos="名詞" 
      data-jlpt="N1" 
      data-lemma="間柄" 
      title="間柄 [名詞] [N1] 点击查看释义">
  間柄
</span>
```

**关键属性**：
- `data-jlpt="N1"` - 必须存在
- `class="click-lookup-word"` - 必须存在

### 步骤 4: 检查 CSS 样式

在开发者工具中选中 "間柄" 元素，查看 Computed 样式：

**应该看到**：
- `text-decoration: underline wavy rgba(231, 76, 60, 0.7)`
- `text-decoration-thickness: 1.5px`

## 常见问题排查

### 问题 1: 没有任何下划线

**可能原因**：
- 点击查词功能未启用
- kuromoji 分词器加载失败

**解决方法**：
1. 检查控制台是否有错误
2. 确认 `kuromoji.js` 和词典文件已部署
3. 检查配置：点击设置按钮，确认"启用点击查词"已开启

### 问题 2: 有虚线但不是波浪线

**可能原因**：
- JLPT Checker 未加载
- `data-jlpt` 属性未设置

**解决方法**：
1. 检查控制台日志，确认 JLPT Checker 加载成功
2. 检查 DOM 元素是否有 `data-jlpt="N1"` 属性
3. 确认 `jlpt-checker.js` 和 JSON 数据文件已部署

### 问题 3: window.jlptChecker 未定义

**可能原因**：
- `jlpt-checker.js` 未正确加载
- 脚本执行顺序问题

**解决方法**：
1. 在控制台手动检查：
```javascript
console.log(window.jlptChecker);
console.log(window.jlptChecker?.isLoaded);
```

2. 手动加载并测试：
```javascript
// 手动加载 JLPT Checker
const script = document.createElement('script');
script.src = 'jlpt-checker.js';
document.head.appendChild(script);

// 等待加载后测试
setTimeout(async () => {
  await window.jlptChecker.load();
  console.log('N1词汇数:', window.jlptChecker.n1Words.size);
  console.log('間柄的级别:', window.jlptChecker.getLevel('間柄'));
}, 1000);
```

### 问题 4: 数据加载失败

**可能原因**：
- JSON 文件路径错误
- 文件未部署到 Anki media

**解决方法**：
1. 检查文件是否存在：
```javascript
fetch('term_meta_bank_1.json')
  .then(r => r.json())
  .then(data => console.log('数据加载成功，条目数:', data.length))
  .catch(err => console.error('数据加载失败:', err));
```

2. 确认文件路径：
```bash
ls -la "/Users/cary/Library/Application Support/Anki2/User 1/collection.media/term_meta_bank_"*.json
```

## 手动测试脚本

在 Anki 卡片的控制台中运行以下脚本进行完整测试：

```javascript
(async function testJLPT() {
  console.log('=== JLPT 功能测试 ===');
  
  // 1. 检查 jlptChecker 是否存在
  if (typeof window.jlptChecker === 'undefined') {
    console.error('❌ window.jlptChecker 未定义');
    return;
  }
  console.log('✅ window.jlptChecker 已定义');
  
  // 2. 检查是否已加载
  if (!window.jlptChecker.isLoaded) {
    console.log('⏳ 正在加载 JLPT 数据...');
    await window.jlptChecker.load();
  }
  console.log('✅ JLPT 数据已加载');
  
  // 3. 检查数据量
  console.log('📊 N1 词汇数:', window.jlptChecker.n1Words.size);
  console.log('📊 N2 词汇数:', window.jlptChecker.n2Words.size);
  
  // 4. 测试 "間柄"
  const testWord = '間柄';
  const level = window.jlptChecker.getLevel(testWord);
  console.log(`🔍 "${testWord}" 的级别:`, level);
  
  if (level === 'N1') {
    console.log('✅ "間柄" 正确识别为 N1 词汇');
  } else {
    console.error('❌ "間柄" 未被识别为 N1 词汇');
  }
  
  // 5. 检查 DOM 元素
  const elements = document.querySelectorAll('.click-lookup-word');
  console.log('📝 找到', elements.length, '个可点击词汇');
  
  const targetElement = Array.from(elements).find(el => el.textContent === testWord);
  if (targetElement) {
    console.log('✅ 找到 "間柄" 元素');
    console.log('   - data-jlpt:', targetElement.getAttribute('data-jlpt'));
    console.log('   - data-pos:', targetElement.getAttribute('data-pos'));
    console.log('   - title:', targetElement.title);
    
    const styles = window.getComputedStyle(targetElement);
    console.log('   - text-decoration:', styles.textDecoration);
  } else {
    console.error('❌ 未找到 "間柄" 元素');
  }
  
  console.log('=== 测试完成 ===');
})();
```

## 预期输出

如果一切正常，应该看到：

```
=== JLPT 功能测试 ===
✅ window.jlptChecker 已定义
✅ JLPT 数据已加载
📊 N1 词汇数: 3214
📊 N2 词汇数: 1856
🔍 "間柄" 的级别: N1
✅ "間柄" 正确识别为 N1 词汇
📝 找到 X 个可点击词汇
✅ 找到 "間柄" 元素
   - data-jlpt: N1
   - data-pos: 名詞
   - title: 間柄 [名詞] [N1] 点击查看释义
   - text-decoration: underline wavy rgba(231, 76, 60, 0.7)
=== 测试完成 ===
```

## 最新修复

### 修复内容 (2026-03-24)

1. **移除 `type="module"`**
   - 问题：模块作用域导致 `window.jlptChecker` 无法访问
   - 解决：改为普通脚本加载，直接挂载到 window 对象

2. **增强错误处理**
   - 添加详细的错误日志
   - 添加 try-catch 包裹 JLPT 级别检测

3. **添加调试日志**
   - 记录 N1 词汇检测结果
   - 记录 JLPT Checker 加载状态

4. **延长等待时间**
   - 从 100ms 增加到 200ms，确保脚本完全执行

## 下一步

如果问题仍然存在，请：

1. 在 Anki 中打开开发者工具
2. 运行上面的测试脚本
3. 将控制台输出截图或复制给我
4. 我会根据具体错误信息进一步排查

---

**更新时间**: 2026-03-24 12:30  
**版本**: 1.1.0
