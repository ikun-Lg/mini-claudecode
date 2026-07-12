import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Banner from './Banner.jsx';
import MessageBubble from './MessageBubble.jsx';
import StatusBar from './StatusBar.jsx';
import SuggestionList from './SuggestionList.jsx';
import ConfirmInput from './ConfirmInput.jsx';
import SelectInput from './SelectInput.jsx';
import { COLORS, GLYPHS } from './theme.js';
import { getAIResponse, DEFAULT_MODEL, RULES_MAP } from '../request/llm.js';
import { cacheMessages, loadHistory } from '../utils/fsHandle.js';
import { matchRules } from '../utils/contextRead.js';
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
import { setInteractionHandler } from '../tools/local/interactionBridge.js';

const CURRENT_MODEL = DEFAULT_MODEL;

// 消息自增 ID
let messageId = 0;

// ── 工具显示辅助函数 ──

/**
 * 每个工具对应的图标
 */
const TOOL_ICONS = {
  bash: '⚡',
  read_file: '📖',
  write_file: '📝',
  edit_file: '✏️',
  multi_edit: '📋',
  glob: '🔍',
  grep: '🔎',
  list_dir: '📂',
  confirm: '❓',
  select: '🎯',
  todo_write: '📌',
  skill: '🧩',
};

/**
 * 需要截断的长参数字段
 */
const LONG_ARG_KEYS = new Set(['content', 'old_string', 'new_string', 'command']);

/**
 * 格式化工具参数用于显示：截断过长的参数值
 */
function formatToolArgs(args) {
  if (!args || Object.keys(args).length === 0) return '';
  const formatted = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && LONG_ARG_KEYS.has(key)) {
      // 长参数截断到 80 字符
      if (value.length > 80) {
        formatted[key] = value.slice(0, 80) + '...';
      } else {
        formatted[key] = value;
      }
    } else if (typeof value === 'string') {
      formatted[key] = value.length > 120 ? value.slice(0, 120) + '...' : value;
    } else if (Array.isArray(value)) {
      formatted[key] = `[${value.length} 项]`;
    } else {
      formatted[key] = value;
    }
  }
  return JSON.stringify(formatted);
}

/**
 * 获取工具图标
 */
function getToolIcon(name) {
  return TOOL_ICONS[name] || '🔧';
}

/**
 * 主对话应用组件
 */
export default function App() {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isToolRunning, setIsToolRunning] = useState(false);
  const [currentToolName, setCurrentToolName] = useState('');

  // ── 交互状态 ──
  // 当 confirm/select 工具请求用户交互时，此状态保存交互请求
  // { type: 'confirm'|'select', data: {...}, resolve: Function }
  const [interaction, setInteraction] = useState(null);

  // 注册交互处理器：工具层通过 interactionBridge 请求交互时，
  // 设置 interaction 状态，触发 React 渲染对应的交互组件
  useEffect(() => {
    setInteractionHandler(({ type, data, resolve }) => {
      setInteraction({ type, data, resolve });
    });
  }, []);

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
    { isActive: !isThinking && !interaction && suggestionMode !== null },
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
        const filePaths = [];
        for (const ref of fileRefs) {
          const filePath = ref.slice(1); // 去掉 @ 前缀
          filePaths.push(filePath);
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

        // ── 匹配规则 ──
        // 根据用户 @ 引用的文件路径，匹配 rulesMap 中的规则
        // 匹配上的规则 content 会作为 user 消息追加到 llmContent 中
        if (RULES_MAP.size > 0) {
          const { matchedContents, matchedRuleNames } = matchRules(RULES_MAP, filePaths);
          if (matchedRuleNames.length > 0) {
            // 在发送内容中追加规则上下文
            llmContent += `\n\n**适用的规则：**\n\n${matchedContents}`;
            // 在显示内容中追加已应用的规则提示
            displayContent += `\n\n📎 已应用规则: ${matchedRuleNames.join(', ')}`;
          }
        }
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
      // getAIResponse 会自动处理工具调用循环：有 tool_calls 时执行工具，
      // 将结果 push 到 conversationMessages，然后递归调用大模型继续回复
      const assistantId = ++messageId;
      let fullContent = '';
      let hasContent = false;

      for await (const event of getAIResponse(conversationMessages)) {
        if (event.type === 'text') {
          fullContent += event.content;
        } else if (event.type === 'tool_start') {
          // 工具开始：显示工具名和参数（参数截断防止刷屏）
          const icon = getToolIcon(event.name);
          const argsStr = formatToolArgs(event.args);
          fullContent += `\n\n${icon} ${event.name}${argsStr ? `(${argsStr})` : ''}\n`;
          // 标记工具正在执行，隐藏 TextInput（避免与 confirm/select 等交互工具冲突）
          setIsToolRunning(true);
          setCurrentToolName(event.name);
        } else if (event.type === 'tool_end') {
          // 工具结束：显示返回结果（截断过长的结果）
          const resultStr = event.result || '(无返回)';
          const truncated = resultStr.length > 2000
            ? resultStr.slice(0, 2000) + '...(已截断)'
            : resultStr;
          fullContent += `✅ ${event.name} 返回:\n\`\`\`\n${truncated}\n\`\`\`\n`;
          // 工具执行完毕，恢复输入框
          setIsToolRunning(false);
          setCurrentToolName('');
        }

        // 第一次收到任何内容时，创建助手消息并停止 thinking 动画
        if (!hasContent) {
          hasContent = true;
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

      // 如果没有收到任何内容，补充一条提示
      if (!hasContent) {
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

      {/* 思考中 / 工具执行中 / 输入框 */}
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
      ) : interaction ? (
        // ── 交互组件（confirm/select）──
        // 优先级高于 isToolRunning：工具执行中需要用户交互时显示
        interaction.type === 'confirm' ? (
          <ConfirmInput
            message={interaction.data.message}
            defaultValue={interaction.data.default}
            onConfirm={(result) => {
              interaction.resolve(result);
              setInteraction(null);
            }}
          />
        ) : interaction.type === 'select' ? (
          <SelectInput
            message={interaction.data.message}
            choices={interaction.data.choices}
            onSelect={(result) => {
              interaction.resolve(result);
              setInteraction(null);
            }}
          />
        ) : null
      ) : isToolRunning ? (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color={COLORS.accentWarning} bold>
              {`${getToolIcon(currentToolName)} `}
            </Text>
            <Text color={COLORS.accentWarning}>
              <Spinner type="dots" />
            </Text>
            <Text color={COLORS.textMuted}>
              {` 正在执行 ${currentToolName}...`}
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
        isToolRunning={isToolRunning}
        currentToolName={currentToolName}
      />
    </Box>
  );
}
