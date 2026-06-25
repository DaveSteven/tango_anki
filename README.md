# Tango Anki

日语 N2 三圆词汇卡片应用。词库来自项目根目录的两份讲义，学习进度保存在浏览器 `localStorage` 中。

```bash
npm install
npm run dev
```

按空格翻面，按数字 `1`—`4` 选择“重来 / 困难 / 良好 / 简单”。重新提取词库可运行：

```bash
python3 scripts/extract_vocab.py
```
