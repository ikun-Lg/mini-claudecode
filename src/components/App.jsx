import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Banner from './Banner.jsx';
import MessageBubble from './MessageBubble.jsx';

// 消息自增 ID
let messageId = 0;

/**
 * 生成占位回复（后续替换为真实的大模型接口调用）
 */
function generatePlaceholderResponse(userInput) {
  return (
    `收到你的消息："${userInput}"\n\n` +
    '这是 mini-claudecode 的占位回复，大模型接口尚未对接。\n' +
    '后续将在此处接入 LLM 服务，实现真正的智能对话。'
  );
}

/**
 * 主对话应用组件
 */
export default function App() {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const handleSubmit = useCallback(
    async (value) => {
      const trimmed = value.trim();

      // 处理退出命令
      if (trimmed === '/exit') {
        exit();
        return;
      }

      // 处理清空命令
      if (trimmed === '/clear') {
        setMessages([]);
        // 清除终端屏幕
        process.stdout.write('\x1b[2J\x1b[H');
        return;
      }

      // 跳过空消息
      if (trimmed === '') {
        return;
      }

      // 添加用户消息
      const userMsg = { id: ++messageId, role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsThinking(true);

      // 模拟回复延迟
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 生成并添加助手回复
      const response = generatePlaceholderResponse(trimmed);
      const assistantMsg = {
        id: ++messageId,
        role: 'assistant',
        content: response,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
    },
    [exit],
  );

  return (
    <Box flexDirection="column">
      <Banner />

      {/* 对话消息列表 */}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* 思考中或输入框 */}
      {isThinking ? (
        <Box marginBottom={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="gray">{' assistant 正在思考...'}</Text>
        </Box>
      ) : (
        <Box>
          <Text color="cyan" bold>
            {'❯ '}
          </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="输入消息..."
          />
        </Box>
      )}
    </Box>
  );
}
