import React from 'react';
import { Box, Text } from 'ink';
import { COLORS, GLYPHS } from './theme.js';

// ASCII 艺术字 "MINI" — 使用 figlet 的 "Banner" 字体风格
const LOGO_LINES = [
  '███╗   ███╗██╗███╗   ██╗ █████╗ ██╗  ██╗',
  '████╗ ████║██║████╗  ██║██╔══██╗╚██╗██╔╝',
  '██╔████╔██║██║██╔██╗ ██║███████║ ╚███╔╝ ',
  '██║╚██╔╝██║██║██║╚██╗██║██╔══██║ ██╔██╗ ',
  '██║ ╚═╝ ██║██║██║ ╚████║╚██████╔╝██╔╝ ██╗',
  '╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝',
];

// 每行使用不同的蓝色渐变，模拟渐变效果
const LOGO_GRADIENTS = [
  '#2A4A7F',
  '#3A6AEF',
  '#4A9EFF',
  '#5BA9FF',
  '#6BB9FF',
  '#7BC9FF',
];

/**
 * 欢迎横幅组件 — ASCII 艺术字 + 渐变色 + 信息面板
 */
export default function Banner({ model }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* ASCII 艺术字 Logo */}
      <Box flexDirection="column" paddingLeft={1}>
        {LOGO_LINES.map((line, i) => (
          <Text key={i} color={LOGO_GRADIENTS[i]} bold>
            {line}
          </Text>
        ))}
      </Box>

      {/* 信息面板 */}
      <Box flexDirection="column" paddingLeft={1} marginTop={0}>
        <Text>
          <Text color={COLORS.accentSecondary} bold>
            {' claudecode '}
          </Text>
          <Text color={COLORS.textDim}>{' · '}</Text>
          <Text color={COLORS.textSoft}>Terminal AI Coding Assistant</Text>
        </Text>
        <Text color={COLORS.textMuted}>
          {`  ${GLYPHS.star} 模型: `}
          <Text color={COLORS.accentInfo} bold>
            {model || 'gpt-4o-mini'}
          </Text>
        </Text>
      </Box>

      {/* 分隔线 */}
      <Box paddingLeft={1} marginTop={0}>
        <Text color={COLORS.borderDim}>
          {'─'.repeat(42)}
        </Text>
      </Box>

      {/* 命令提示 */}
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={COLORS.textHint}>
          {`  ${GLYPHS.diamond} /exit  `}
          <Text color={COLORS.textMuted}>退出对话</Text>
        </Text>
        <Text color={COLORS.textHint}>
          {`  ${GLYPHS.diamond} /clear `}
          <Text color={COLORS.textMuted}>清空历史</Text>
        </Text>
      </Box>
    </Box>
  );
}
