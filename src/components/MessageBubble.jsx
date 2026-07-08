import React from 'react';
import { Box, Text } from 'ink';

/**
 * 消息气泡组件
 * 以带边框的样式展示用户或助手的消息
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const color = isUser ? 'green' : 'blue';
  const icon = isUser ? '🧑' : '🤖';
  const label = isUser ? 'user' : 'assistant';
  const lines = message.content.split('\n');

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={color} bold>
        {`┌─ ${icon} ${label}`}
      </Text>
      {lines.map((line, i) => (
        <Text key={i}>
          <Text color={color}>{'│ '}</Text>
          <Text>{line}</Text>
        </Text>
      ))}
      <Text color={color}>└</Text>
    </Box>
  );
}
