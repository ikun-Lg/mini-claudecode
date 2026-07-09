import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Banner from './Banner.jsx';
import MessageBubble from './MessageBubble.jsx';
import StatusBar from './StatusBar.jsx';
import SuggestionList from './SuggestionList.jsx';
import { COLORS, GLYPHS } from './theme.js';
import { chatWithLLM, DEFAULT_MODEL } from '../request/llm.js';
import { cacheMessages, loadHistory } from '../utils/fsHandle.js';
import {
  filterCommands,
  parseCommand,
  executeCommand,
  getCommandType,
} from '../commands/index.js';
import {
  getAllFiles,
  filterFiles,
  readFileContent,
} from '../utils/fileSearch.js';

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

  // ── 建议列表状态 ──
  // null | 'command' | 'file' | 'history'
  const [suggestionMode, setSuggestionMode] = useState(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  // 历史对话列表（/history 指令触发时填充）
  const [historyList, setHistoryList] = useState([]);

  // TextInput 的 key，每次通过建议列表选择后递增，强制 TextInput 重新挂载
  // 这样内部 cursorOffset 会重新初始化为新值的末尾
  const [textInputKey, setTextInputKey] = useState(0);

  // 每次渲染时将最新消息缓存到模块级变量，供 app.js 退出时使用
  cacheMessages(messages);

  // ── 计算过滤后的建议列表 ──
  const suggestions = useMemo(() => {
    if (suggestionMode === 'command') {
      // 输入以 / 开头，取 / 后面的部分作为查询
      const query = input.startsWith('/') ? input.slice(1) : '';
      return filterCommands(query);
    }
    if (suggestionMode === 'file') {
      // 最后一个以 @ 开头的词中，@ 后面的部分作为查询
      const atMatch = input.match(/(?:^|\s)@([^@\s]*)$/);
      const query = atMatch ? atMatch[1] : '';
      return filterFiles(getAllFiles(), query);
    }
    if (suggestionMode === 'history') {
      return historyList;
    }
    return [];
  }, [suggestionMode, input, historyList]);

  // ── 输入变化时检测建议模式 ──
  const handleChange = useCallback((value) => {
    setInput(value);

    // 检测指令模式：输入以 / 开头且不含空格
    if (value.startsWith('/') && !value.includes(' ')) {
      setSuggestionMode('command');
      setSuggestionIndex(0);
      return;
    }

    // 检测文件模式：最后一个词以 @ 开头（@ 在行首或空格之后）
    const atMatch = value.match(/(?:^|\s)@([^@\s]*)$/);
    if (atMatch) {
      setSuggestionMode('file');
      setSuggestionIndex(0);
      return;
    }

    // 无匹配，关闭建议
    setSuggestionMode(null);
  }, []);

  // ── 确认选择（Tab 和 Enter 共用） ──
  // 返回 true 表示成功选择了某项，false 表示无项可选
  const performSelection = useCallback(() => {
    const idx = Math.min(suggestionIndex, suggestions.length - 1);
    const selected = suggestions[idx];
    if (!selected) return false;

    if (suggestionMode === 'command') {
      // 指令模式：直接替换整个输入
      setInput(selected.name);
      setSuggestionMode(null);
      // 强制 TextInput 重新挂载，使光标移到末尾
      setTextInputKey((k) => k + 1);
    } else if (suggestionMode === 'file') {
      // 文件模式：替换 @ 后面的查询部分为选中的文件路径
      const filePath =
        typeof selected === 'string' ? selected : selected.name;
      const newValue = input.replace(
        /(^|\s)@([^@\s]*)$/,
        (_match, prefix) => `${prefix}@${filePath} `,
      );
      setInput(newValue);
      setSuggestionMode(null);
      // 强制 TextInput 重新挂载，使光标移到末尾
      setTextInputKey((k) => k + 1);
    } else if (suggestionMode === 'history') {
      // 历史模式：加载选中的历史对话
      const result = loadHistory(selected.filename);
      if (result.success && result.messages) {
        // 为加载的消息重新分配 ID
        const restoredMessages = result.messages.map((msg) => ({
          ...msg,
          id: ++messageId,
        }));
        setMessages(restoredMessages);
        process.stdout.write('\x1b[2J\x1b[H');
      }
      setSuggestionMode(null);
      setInput('');
      setTextInputKey((k) => k + 1);
    }
    return true;
  }, [suggestionIndex, suggestions, suggestionMode, input]);

  // ── 键盘导航：上下键选择 + Tab 确认 + Esc 取消 ──
  // 注意：Enter 不在此处处理，而是统一在 handleSubmit 中处理，避免竞态
  useInput(
    (_char, key) => {
      if (!suggestionMode || suggestions.length === 0) return;

      if (key.upArrow) {
        setSuggestionIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1,
        );
      } else if (key.downArrow) {
        setSuggestionIndex((prev) =>
          prev >= suggestions.length - 1 ? 0 : prev + 1,
        );
      } else if (key.tab) {
        // Tab 确认选择
        performSelection();
      } else if (key.escape) {
        setSuggestionMode(null);
      }
    },
    { isActive: !isThinking && suggestionMode !== null },
  );

  // ── 处理提交 ──
  const handleSubmit = useCallback(
    async (value) => {
      // 如果建议列表处于打开状态，Enter 的作用是确认选择而非提交
      if (suggestionMode && suggestions.length > 0) {
        if (performSelection()) return;
      }

      const trimmed = value.trim();

      // 关闭建议列表
      setSuggestionMode(null);

      // 跳过空消息
      if (trimmed === '') {
        return;
      }

      // ── 解析并执行指令 ──
      const { command, remainingText } = parseCommand(trimmed);
      let currentMessages = messages;
      // 非阻断类指令返回的上下文字符串
      let commandContext = '';

      if (command) {
        const cmdType = getCommandType(command);
        const result = executeCommand(command, {
          remainingText,
          messages,
          exit,
          model: CURRENT_MODEL,
        });

        if (!result) {
          // 未知指令，当作普通文本处理
          currentMessages = messages;
        } else if (cmdType === 'blocking') {
          // ── 阻断类指令：执行后不发送请求给大模型 ──
          if (result.action === 'exit') {
            exit();
            return;
          }
          if (result.action === 'select-history') {
            // 进入历史选择模式
            setHistoryList(result.histories);
            setSuggestionMode('history');
            setSuggestionIndex(0);
            setInput('');
            return;
          }
          // action === 'done'
          // 为指令产生的助手消息分配 ID
          if (result.messages) {
            const newMsgs = result.messages.slice(messages.length);
            for (const msg of newMsgs) {
              msg.id = ++messageId;
            }
            setMessages(result.messages);
          }
          // 需要清屏（如 /clear）
          if (result.clearScreen) {
            process.stdout.write('\x1b[2J\x1b[H');
          }
          setInput('');
          return; // 阻断类指令到此结束，不发送 LLM 请求
        } else if (cmdType === 'non-blocking') {
          // ── 非阻断类指令：返回上下文字符串，与用户文本组合后发送给大模型 ──
          commandContext = result.context || '';
          // 更新消息列表（如果有）
          if (result.messages) {
            currentMessages = result.messages;
            const newMsgs = result.messages.slice(messages.length);
            for (const msg of newMsgs) {
              msg.id = ++messageId;
            }
            setMessages(result.messages);
          }
        }
      }

      // ── 组合指令上下文 + 用户剩余文本，作为提问发送给大模型 ──
      let userQuestion = remainingText;
      // 如果有非阻断指令返回的上下文，拼接到前面
      if (commandContext) {
        userQuestion = userQuestion
          ? `${commandContext}\n\n用户问题：${userQuestion}`
          : commandContext;
      }

      // 如果既没有指令上下文也没有用户输入，跳过
      if (!userQuestion) {
        setInput('');
        return;
      }

      // ── 解析 @文件引用 ──
      // 显示内容：仅将 @filepath 美化为 `filepath`，不附带文件内容
      // 发送内容：在末尾附带文件内容作为上下文供大模型使用
      const fileRefs = userQuestion.match(/@([^\s@]+)/g) || [];
      let displayContent = userQuestion;
      let llmContent = userQuestion;

      if (fileRefs.length > 0) {
        const fileContexts = [];
        for (const ref of fileRefs) {
          const filePath = ref.slice(1); // 去掉 @ 前缀
          const result = readFileContent(filePath);
          if (result.success && result.content !== null) {
            fileContexts.push(
              `--- 文件: ${filePath} ---\n\`\`\`\n${result.content}\n\`\`\``,
            );
          } else {
            fileContexts.push(
              `--- 文件: ${filePath} (读取失败: ${result.error}) ---`,
            );
          }
        }
        // 显示内容：将 @filepath 替换为 `filepath` 以美化显示
        displayContent = userQuestion.replace(/@([^\s@]+)/g, '`$1`');
        // 发送内容：在用户问题后附带文件上下文
        llmContent =
          `${userQuestion}\n\n**附带的文件上下文：**\n\n${fileContexts.join('\n\n')}`;
      }

      // 添加用户消息（仅显示引用的文件名，不显示文件内容）
      const userMsg = {
        id: ++messageId,
        role: 'user',
        content: displayContent,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsThinking(true);

      // 构造对话历史（使用完整内容发送给大模型，含文件上下文）
      const conversationMessages = [
        ...currentMessages,
        { role: 'user', content: llmContent },
      ];

      // 流式接收大模型回复，逐块更新助手消息内容
      const assistantId = ++messageId;
      let fullContent = '';
      let isFirstChunk = true;

      for await (const chunk of chatWithLLM(conversationMessages)) {
        fullContent += chunk;
        if (isFirstChunk) {
          isFirstChunk = false;
          setIsThinking(false);
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: fullContent },
          ]);
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantId
                ? { ...msg, content: fullContent }
                : msg,
            ),
          );
        }
      }

      // 如果没有收到任何片段，补充一条提示
      if (isFirstChunk) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: '（大模型未返回有效内容）',
          },
        ]);
      }

      setIsThinking(false);
    },
    [exit, messages, suggestionMode, suggestions, performSelection],
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
              {' assistant 正在思考'}
            </Text>
            <Text color={COLORS.textDim}>
              {' · '}
              <Spinner type="dots" />
            </Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color={COLORS.accentPrimary} bold>
              {`${GLYPHS.arrow} `}
            </Text>
            <TextInput
              key={textInputKey}
              value={input}
              onChange={handleChange}
              onSubmit={handleSubmit}
              placeholder="输入消息，按 Enter 发送... (输入 / 查看指令，输入 @ 引用文件)"
            />
          </Box>
          {/* 指令/文件建议列表 */}
          {suggestionMode && (
            <SuggestionList
              items={suggestions}
              selectedIndex={Math.min(
                suggestionIndex,
                suggestions.length - 1,
              )}
              mode={suggestionMode}
            />
          )}
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
