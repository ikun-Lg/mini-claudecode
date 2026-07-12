import React from 'react';
import { Box, Text } from 'ink';
import { COLORS, GLYPHS } from './theme.js';

/**
 * 底部状态栏组件 — 显示模型名、消息计数、工作目录等信息
 */
export default function StatusBar({ model, messageCount, isThinking, isToolRunning, currentToolName }) {
  const cwd = process.cwd();
  const dirName = cwd.split('/').pop() || cwd;

  return (
    <Box flexDirection="column">
      {/* 分隔线 */}
      <Text color={COLORS.borderDim}>{'─'.repeat(48)}</Text>

      {/* 状态信息行 */}
      <Box>
        <Text color={COLORS.accentPrimary} bold>
          {` ${GLYPHS.diamond} `}
        </Text>
        <Text color={COLORS.textMuted}>model: </Text>
        <Text color={COLORS.accentInfo} bold>
          {model || 'gpt-4o-mini'}
        </Text>
        <Text color={COLORS.textDim}> {' | '} </Text>
        <Text color={COLORS.textMuted}>msgs: </Text>
        <Text color={COLORS.accentSuccess} bold>
          {messageCount}
        </Text>
        <Text color={COLORS.textDim}> {' | '} </Text>
        <Text color={COLORS.textMuted}>dir: </Text>
        <Text color={COLORS.textSoft}>
          {dirName}
        </Text>
        {isThinking && (
          <>
            <Text color={COLORS.textDim}> {' | '} </Text>
            <Text color={COLORS.accentWarning} bold>
              {' thinking...'}
            </Text>
          </>
        )}
        {isToolRunning && (
          <>
            <Text color={COLORS.textDim}> {' | '} </Text>
            <Text color={COLORS.accentWarning} bold>
              {` running ${currentToolName}...`}
            </Text>
          </>
        )}
      </Box>
    </Box>
  );
}
