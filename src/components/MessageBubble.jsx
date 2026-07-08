import React from 'react';
import { Box, Text } from 'ink';
import { COLORS, GLYPHS } from './theme.js';

/**
 * 解析行内 Markdown 标记（加粗、行内代码），返回带样式的 Text 片段数组
 * @param {string} text - 单行文本
 * @param {string} baseColor - 基础文字颜色
 * @returns {Array} React Text 元素数组
 */
function parseInlineMarkdown(text, baseColor) {
  const parts = [];
  // 正则匹配: **bold** | `code` | *italic*
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // 匹配前的普通文本
    if (match.index > lastIndex) {
      parts.push(
        <Text key={key++} color={baseColor}>
          {text.slice(lastIndex, match.index)}
        </Text>,
      );
    }

    if (match[2] !== undefined) {
      // **bold**
      parts.push(
        <Text key={key++} color={baseColor} bold>
          {match[2]}
        </Text>,
      );
    } else if (match[3] !== undefined) {
      // `inline code`
      parts.push(
        <Text key={key++} color={COLORS.inlineCode} backgroundColor={COLORS.codeBg}>
          {` ${match[3]} `}
        </Text>,
      );
    } else if (match[4] !== undefined) {
      // *italic*
      parts.push(
        <Text key={key++} color={baseColor} italic>
          {match[4]}
        </Text>,
      );
    }

    lastIndex = regex.lastIndex;
  }

  // 尾部普通文本
  if (lastIndex < text.length) {
    parts.push(
      <Text key={key++} color={baseColor}>
        {text.slice(lastIndex)}
      </Text>,
    );
  }

  return parts.length > 0 ? parts : [<Text key={0} color={baseColor}>{text}</Text>];
}

/**
 * 渲染代码块
 * @param {Array<string>} codeLines - 代码行
 * @param {string} lang - 语言标识
 * @param {number} indent - 缩进宽度
 * @returns {React.Element} 代码块渲染
 */
function renderCodeBlock(codeLines, lang, indent) {
  const indentStr = ' '.repeat(indent + 1);
  return (
    <Box flexDirection="column" marginX={indent}>
      {/* 代码块顶部边框 */}
      <Text color={COLORS.codeBorder}>
        {`${indentStr}┌${'─'.repeat(2)}${lang ? ` ${lang} ` : ''}${'─'.repeat(Math.max(0, 36 - (lang ? lang.length + 2 : 0)))}┐`}
      </Text>
      {codeLines.map((line, i) => (
        <Text key={i}>
          <Text color={COLORS.codeBorder}>{`${indentStr}│ `}</Text>
          <Text color={COLORS.codeText} backgroundColor={COLORS.codeBg}>
            {line || ' '}
          </Text>
          <Text backgroundColor={COLORS.codeBg}>{' '}</Text>
          <Text color={COLORS.codeBorder}>{'│'}</Text>
        </Text>
      ))}
      {/* 代码块底部边框 */}
      <Text color={COLORS.codeBorder}>
        {`${indentStr}└${'─'.repeat(40)}┘`}
      </Text>
    </Box>
  );
}

/**
 * 渲染单行内容（带 Markdown 解析）
 * @param {string} line - 文本行
 * @param {string} color - 基础颜色
 * @param {string} glyph - 行首符号
 * @param {string} glyphColor - 符号颜色
 * @param {string} rail - 续行导轨
 * @param {boolean} isFirst - 是否首行
 * @param {number} glyphWidth - 符号宽度
 * @returns {React.Element} 渲染的行
 */
function renderLine(line, color, glyph, glyphColor, rail, isFirst, glyphWidth) {
  // 检测标题
  const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const headingColor = level === 1 ? COLORS.heading : level === 2 ? COLORS.accentSecondary : COLORS.accentPrimary;
    return (
      <Text>
        <Text color={glyphColor} bold>{isFirst ? glyph : rail}</Text>
        <Text>{' '}</Text>
        <Text color={headingColor} bold>{headingMatch[2]}</Text>
      </Text>
    );
  }

  // 检测列表项
  const listMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
  if (listMatch) {
    const indent = listMatch[1];
    const marker = listMatch[2];
    const content = listMatch[3];
    return (
      <Text>
        <Text color={glyphColor} bold>{isFirst ? glyph : rail}</Text>
        <Text>{' '}</Text>
        <Text color={COLORS.textDim}>{indent}</Text>
        <Text color={COLORS.accentWarning}>{`${marker} `}</Text>
        {parseInlineMarkdown(content, color)}
      </Text>
    );
  }

  // 检测引用
  const quoteMatch = line.match(/^>\s*(.*)/);
  if (quoteMatch) {
    return (
      <Text>
        <Text color={glyphColor} bold>{isFirst ? glyph : rail}</Text>
        <Text>{' '}</Text>
        <Text color={COLORS.quoteBorder}>{'▎ '}</Text>
        <Text color={COLORS.quoteText} italic>{quoteMatch[1]}</Text>
      </Text>
    );
  }

  // 普通文本
  return (
    <Text>
      <Text color={glyphColor} bold>{isFirst ? glyph : rail}</Text>
      <Text>{' '}</Text>
      {parseInlineMarkdown(line, color)}
    </Text>
  );
}

/**
 * 消息气泡组件 — 字符符号 + 导轨 + Markdown 渲染
 * 参考 CodeWhale 的 glyph 风格：
 *   用户消息: ▎ (实心竖条)  + 绿色
 *   助手消息: ● (实心圆点)  + 蓝色
 *   续行导轨: ▏ (暗色1/8块)
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const accentColor = isUser ? COLORS.userAccent : COLORS.assistantAccent;
  const glyph = isUser ? GLYPHS.user : GLYPHS.assistant;
  const rail = `${GLYPHS.rail} `;
  const glyphWidth = isUser ? 1 : 1;
  const bodyColor = COLORS.textPrimary;

  // 将内容拆分为代码块和普通文本段
  const segments = [];
  const rawLines = message.content.split('\n');
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = '';
  let textLines = [];

  const flushText = () => {
    if (textLines.length > 0) {
      segments.push({ type: 'text', lines: [...textLines] });
      textLines = [];
    }
  };

  const flushCode = () => {
    if (codeLines.length > 0) {
      segments.push({ type: 'code', lines: [...codeLines], lang: codeLang });
      codeLines = [];
      codeLang = '';
    }
  };

  for (const line of rawLines) {
    const codeBlockStart = line.match(/^```(\w*)/);
    if (codeBlockStart) {
      if (inCodeBlock) {
        // 代码块结束
        inCodeBlock = false;
        flushCode();
      } else {
        // 代码块开始
        inCodeBlock = true;
        codeLang = codeBlockStart[1] || '';
        flushText();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
    } else {
      textLines.push(line);
    }
  }

  // 处理未闭合的代码块
  if (inCodeBlock) {
    flushCode();
  }
  flushText();

  // 渲染所有段
  const renderedSegments = [];
  let lineIndex = 0;

  for (const seg of segments) {
    if (seg.type === 'code') {
      renderedSegments.push(
        <React.Fragment key={`seg-${lineIndex}`}>
          {renderCodeBlock(seg.lines, seg.lang, glyphWidth + 1)}
        </React.Fragment>,
      );
      lineIndex += seg.lines.length + 2; // +2 for borders
    } else {
      for (const line of seg.lines) {
        const isFirst = lineIndex === 0;
        renderedSegments.push(
          <React.Fragment key={`seg-${lineIndex}`}>
            {renderLine(line, bodyColor, glyph, accentColor, rail, isFirst, glyphWidth)}
          </React.Fragment>,
        );
        lineIndex++;
      }
    }
  }

  // 空消息处理
  if (renderedSegments.length === 0) {
    renderedSegments.push(
      <Text key="empty">
        <Text color={accentColor} bold>{glyph}</Text>
        <Text color={COLORS.textDim}>{' (空消息)'}</Text>
      </Text>,
    );
  }

  return (
    <Box flexDirection="column" marginBottom={0}>
      {renderedSegments}
      {/* 消息间分隔空行 */}
      <Text>{' '}</Text>
    </Box>
  );
}
