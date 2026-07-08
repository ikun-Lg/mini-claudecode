import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Banner from './Banner.jsx';
import MessageBubble from './MessageBubble.jsx';
import StatusBar from './StatusBar.jsx';
import { COLORS, GLYPHS } from './theme.js';
import { chatWithLLM, DEFAULT_MODEL } from '../request/llm.js';

const CURRENT_MODEL = DEFAULT_MODEL;

// 消息自增 ID
let messageId = 0;

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

      // 构造对话历史（包含本次用户提问），发送给大模型
      const conversationMessages = [
        ...messages,
        { role: 'user', content: trimmed },
      ];

      // 流式接收大模型回复，逐块更新助手消息内容
      const assistantId = ++messageId;
      let fullContent = '';
      let isFirstChunk = true;

      for await (const chunk of chatWithLLM(conversationMessages)) {
        fullContent += chunk;
        if (isFirstChunk) {
          // 首个片段到达：创建助手消息并关闭思考状态
          isFirstChunk = false;
          setIsThinking(false);
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: fullContent },
          ]);
        } else {
          // 后续片段：追加更新助手消息内容
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId ? { ...msg, content: fullContent } : msg,
            ),
          );
        }
      }

      // 如果没有收到任何片段，补充一条提示
      if (isFirstChunk) {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '（大模型未返回有效内容）' },
        ]);
      }

      setIsThinking(false);
    },
    [exit, messages],
  );

  return (
    <Box flexDirection="column">
      <Banner model={CURRENT_MODEL} />

      {/* 对话消息列表 */}
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* 思考中或输入框 */}
      {isThinking ? (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color={COLORS.assistantAccent} bold>
              {`${GLYPHS.assistant} `}
            </Text>
            <Text color={COLORS.accentPrimary}>
              <Spinner type="dots" />
            </Text>
            <Text color={COLORS.textMuted}>
              {` assistant 正在思考`}
            </Text>
            <Text color={COLORS.textDim}>
              {' · '}
              <Spinner type="dots" />
            </Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color={COLORS.accentPrimary} bold>
            {`${GLYPHS.arrow} `}
          </Text>
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="输入消息，按 Enter 发送..."
          />
        </Box>
      )}

      {/* 底部状态栏 */}
      <StatusBar
        model={CURRENT_MODEL}
        messageCount={messages.length}
        isThinking={isThinking}
      />
    </Box>
  );
}
