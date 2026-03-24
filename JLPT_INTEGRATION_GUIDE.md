# JLPT 词汇过滤集成指南

## 概述

本指南介绍如何在 Anki 卡片中集成 JLPT N1/N2 词汇过滤功能，减少下划线显示的单词数量。

## 方案说明

### 数据来源
- 使用 [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list) 提供的 JLPT 词汇数据
- 数据包含 N5 到 N1 的完整词汇列表（约 8000 个词汇）
- 数据格式：CSV（expression, reading, meaning, tags）

### 核心模块

1. **jlpt-checker.js** - JLPT 词汇检查器
   - 从 GitHub 加载词汇数据
   - 提供词汇级别判断功能
   - 支持批量检查

2. **click-lookup-with-jlpt-filter.jsx** - 集成示例
   - 展示如何在点击查词功能中使用 JLPT 过滤
   - 提供增强的样式（N1/N2 词汇使用不同颜色）

## 快速开始

### 方法一：修改现有的 click-lookup-with-settings.jsx

在现有文件中添加 JLPT 过滤功能：

#### 1. 导入 JLPT 检查器

在文件开头添加：

```javascript
import jlptChecker from './jlpt-checker.js';
```

#### 2. 扩展配置

修改 `defaultConfig`：

```javascript
const defaultConfig = {
  enabled: true,
  onlyKanji: false,
  onlyN1N2: false,  // 新增：仅显示 N1/N2 词汇
  ttsProvider: "google",
  font: "default",
};
```

#### 3. 修改 isLookupablePOS 函数

在函数末尾添加 JLPT 检查：

```javascript
function isLookupablePOS(pos, surface) {
  // ... 现有的检查逻辑 ...
  
  // 如果启用了 JLPT N1/N2 过滤
  if (currentConfig.onlyN1N2) {
    return jlptChecker.isN1OrN2(surface);
  }
  
  return true;
}
```

#### 4. 在 enableClickLookup 函数开始处加载 JLPT 数据

```javascript
async function enableClickLookup() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    // 等待分词器就绪
    await initTokenizer();
    
    // 如果启用了 JLPT 过滤，加载 JLPT 数据
    if (currentConfig.onlyN1N2) {
      await jlptChecker.load();
    }
    
    // ... 其余代码 ...
  }
}
```

#### 5. 在设置界面添加开关

在 `ClickLookupSettingsComponent` 的 `List` 中添加：

```javascript
<List.Item
  style={{ 
    paddingLeft: "12px",
    paddingRight: "12px",
  }}
  extra={
    <Switch
      checked={config.onlyN1N2}
      onChange={(checked) => {
        setConfig({ ...config, onlyN1N2: checked });
      }}
    />
  }
>
  <div style={{ fontSize: "15px" }}>
    仅显示 N1/N2 词汇
  </div>
</List.Item>
```

#### 6. 添加 JLPT 样式（可选）

在 `addStyles()` 函数中添加：

```javascript
function addStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* 原有样式 ... */
    
    /* JLPT N1 词汇 - 红色实线 */
    .click-lookup-word.jlpt-n1 {
      text-decoration: underline solid rgba(231, 76, 60, 0.7);
      text-decoration-thickness: 2px;
    }
    
    /* JLPT N2 词汇 - 蓝色实线 */
    .click-lookup-word.jlpt-n2 {
      text-decoration: underline solid rgba(52, 152, 219, 0.7);
      text-decoration-thickness: 2px;
    }
  `;
  document.head.appendChild(style);
}
```

### 方法二：使用提供的集成示例

直接使用 `click-lookup-with-jlpt-filter.jsx` 中的代码替换现有实现。

## 构建配置

在 `build.mjs` 中添加 JLPT 检查器的构建配置：

```javascript
// 构建 JLPT 检查器
await esbuild.build({
  entryPoints: ['src/jlpt-checker.js'],
  bundle: true,
  format: 'iife',
  globalName: 'JLPTChecker',
  outfile: 'jlpt-checker.5.js',
  minify: !isDev,
});
```

## 使用效果

启用 "仅显示 N1/N2 词汇" 后：

- ✅ 只有 JLPT N1 和 N2 级别的词汇会显示下划线
- ✅ N1 词汇使用红色实线下划线
- ✅ N2 词汇使用蓝色实线下划线
- ✅ 其他词汇不显示下划线，减少视觉干扰
- ✅ 鼠标悬停时显示词汇的 JLPT 级别

## 性能优化

1. **延迟加载**：JLPT 数据仅在启用过滤时才加载
2. **Set 查找**：使用 Set 数据结构，O(1) 时间复杂度
3. **缓存机制**：数据加载后缓存在内存中
4. **异步加载**：不阻塞页面渲染

## 数据更新

如果需要更新 JLPT 词汇数据：

1. 访问 https://github.com/elzup/jlpt-word-list
2. 检查是否有新版本
3. 数据会自动从 GitHub 加载最新版本

## 故障排除

### 问题：JLPT 过滤不生效

**解决方案**：
1. 检查浏览器控制台是否有错误
2. 确认 JLPT 数据是否加载成功（查看日志）
3. 检查网络连接（需要访问 GitHub）

### 问题：加载速度慢

**解决方案**：
1. JLPT 数据约 500KB，首次加载需要几秒钟
2. 数据加载后会缓存，后续使用无需重新加载
3. 可以考虑将数据文件下载到本地，修改 `jlpt-checker.js` 中的 URL

### 问题：某些词汇没有被识别

**原因**：
- JLPT 词汇表可能不完整
- 词汇的表面形与数据库中的表达式不匹配

**解决方案**：
- 使用 kuromoji 的基本形（辞书形）进行匹配
- 考虑添加词形变化的处理逻辑

## 技术细节

### CSV 解析

使用正则表达式正确处理包含逗号的字段：

```javascript
const csvRegex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
```

### 词汇匹配策略

1. 优先使用 kuromoji 的基本形（basic_form）
2. 如果基本形不存在，使用表面形（surface_form）
3. 支持动词、形容词的活用形匹配

## 扩展功能建议

1. **离线支持**：将 JLPT 数据打包到 Anki 媒体文件中
2. **自定义级别**：支持选择显示 N3、N4、N5 词汇
3. **词频过滤**：结合词频数据，只显示高频词汇
4. **学习进度**：标记已掌握的词汇，不再显示下划线

## 许可证

- JLPT 词汇数据来自 [elzup/jlpt-word-list](https://github.com/elzup/jlpt-word-list)
- 原始数据来自 [tanos.co.uk](http://www.tanos.co.uk/)

## 参考资源

- [JLPT 官方网站](https://www.jlpt.jp/)
- [kuromoji.js 文档](https://github.com/takuyaa/kuromoji.js)
- [Anki 开发文档](https://docs.ankiweb.net/)
