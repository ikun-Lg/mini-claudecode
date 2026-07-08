import React from 'react';
import { Box, Text } from 'ink';

/**
 * 欢迎横幅组件
 */
export default function Banner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="cyan">
          🤖 mini-claudecode
        </Text>
        <Text color="gray">一个最小化的 Claude Code CLI 实现</Text>
      </Box>
      <Text color="gray">
        {'  提示: 输入 '}
        <Text color="yellow">/exit</Text>
        {' 退出对话'}
      </Text>
      <Text color="gray">
        {'        输入 '}
        <Text color="yellow">/clear</Text>
        {' 清空历史'}
      </Text>
    </Box>
  );
}
