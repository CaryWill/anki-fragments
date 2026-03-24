# JLPT 词汇下划线样式说明

## 功能概述

现在点击查词功能已经集成了 JLPT 级别检测，并根据词汇的 JLPT 级别使用不同的下划线样式：

- **N1 词汇**：使用 **波浪下划线（wavy）** - 红色系
- **其他词汇**：使用 **虚线下划线（dashed）** - 根据词性区分颜色

## 样式规则

### N1 词汇（波浪下划线）
```css
.click-lookup-word[data-jlpt="N1"] {
  text-decoration: underline wavy rgba(231, 76, 60, 0.7);  /* 红色波浪线 */
  text-decoration-thickness: 1.5px;
}
```

**特点**：
- 波浪下划线，视觉上更突出
- 红色系，表示高级词汇
- 悬停时背景色变为浅红色

### N2 词汇（虚线下划线）
```css
.click-lookup-word[data-jlpt="N2"] {
  text-decoration: underline dashed rgba(52, 152, 219, 0.6);  /* 蓝色虚线 */
  text-decoration-thickness: 1.5px;
}
```

**特点**：
- 虚线下划线
- 蓝色系
- 悬停时背景色变为浅蓝色

### 非 N1/N2 词汇（虚线下划线 + 词性颜色）

默认使用虚线下划线，颜色根据词性区分：

| 词性 | 颜色 | 悬停背景色 |
|------|------|-----------|
| 動詞（动词） | 红色系 `rgba(231, 76, 60, 0.5)` | 浅红色 `#fdeaea` |
| 形容詞/形容動詞（形容词） | 绿色系 `rgba(39, 174, 96, 0.5)` | 浅绿色 `#eafaf1` |
| 名詞（名词） | 紫色系 `rgba(142, 68, 173, 0.5)` | 浅紫色 `#f5eef8` |
| 副詞（副词） | 橙色系 `rgba(243, 156, 18, 0.5)` | 浅橙色 `#fef5e7` |

## 视觉效果示例

```
N1 词汇：  相対 ～～～～（红色波浪线）
N2 词汇：  愛想 - - - -（蓝色虚线）
其他动词： 食べる - - - -（红色虚线）
其他名词： 学校 - - - -（紫色虚线）
```

## 技术实现

### 1. JLPT 级别检测

在 `processTextNode` 函数中，为每个词汇添加 JLPT 级别标记：

```javascript
// 检查 JLPT 级别并添加标记
if (jlptReady && jlptChecker) {
  const level = jlptChecker.getLevel(surface);
  if (level) {
    span.setAttribute("data-jlpt", level);
    span.title = `${surface} [${pos}] [${level}] 点击查看释义`;
  }
}
```

### 2. CSS 样式优先级

CSS 选择器的优先级确保了正确的样式应用：

1. **最高优先级**：`[data-jlpt="N1"]` - N1 词汇的波浪线
2. **次优先级**：`[data-jlpt="N2"]` - N2 词汇的虚线
3. **默认优先级**：`[data-pos="動詞"]:not([data-jlpt])` - 非 N1/N2 词汇按词性着色

### 3. 数据加载

系统会并行加载 kuromoji 分词器和 JLPT Checker：

```javascript
await Promise.all([
  initTokenizer(),      // 加载 kuromoji 分词器
  initJLPTChecker()     // 加载 JLPT 数据
]);
```

## 数据来源

JLPT 数据来自 [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab)：
- 基于 JMdict 词典
- 与 kuromoji 使用相同的数据源
- 包含 N1: 3,214 词，N2: 1,856 词

## 用户体验

### 优势

1. **视觉层次清晰**
   - N1 高级词汇用波浪线突出显示
   - 其他词汇用虚线，视觉上更柔和

2. **信息丰富**
   - 悬停时显示词汇、词性和 JLPT 级别
   - 例如：`相対 [名詞] [N1] 点击查看释义`

3. **性能优化**
   - JLPT 数据只加载一次
   - 使用 Map 数据结构，查询时间 O(1)
   - 并行加载，不阻塞页面渲染

### 使用场景

- **学习 N1 词汇**：波浪线让高级词汇一目了然
- **复习巩固**：虚线标记其他需要学习的词汇
- **快速查词**：点击任何标记的词汇即可查看释义

## 自定义配置

如果需要调整样式，可以修改 `addStyles()` 函数中的 CSS：

```javascript
// 修改 N1 波浪线颜色
.click-lookup-word[data-jlpt="N1"] {
  text-decoration-color: rgba(231, 76, 60, 0.7);  // 改为你喜欢的颜色
}

// 修改虚线样式
.click-lookup-word {
  text-decoration: underline dashed;  // 可改为 dotted（点线）
}
```

## 构建和部署

```bash
# 构建项目
npm run build

# 开发模式
npm run watch
```

构建后，所有文件会自动部署到 Anki media 目录，包括：
- `click-lookup.bundle.js` - 点击查词功能（已包含样式）
- `jlpt-checker.js` - JLPT 检查器
- `term_meta_bank_*.json` - JLPT 数据文件（5 个）

## 故障排除

### JLPT 数据未加载

如果词汇没有显示 JLPT 级别标记：

1. 检查浏览器控制台是否有错误
2. 确认 `jlpt-checker.js` 和 `term_meta_bank_*.json` 已部署到 Anki media
3. 检查 `window.jlptChecker` 是否已定义

### 样式未生效

1. 清除浏览器缓存
2. 重新构建项目：`npm run build`
3. 检查 CSS 是否被其他样式覆盖

---

**更新时间**: 2026-03-24  
**版本**: 1.0.0  
**数据版本**: stephenmk/yomitan-jlpt-vocab 2025.08.01.0
