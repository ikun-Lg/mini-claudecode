// 指令模块：集中管理所有斜杠指令的定义与执行逻辑
//
// 指令分为两类：
//   blocking（阻断类）     — 执行后不发送请求给大模型，指令自行处理一切
//   non-blocking（非阻断类）— 返回一个上下文字符串，与用户剩余文本组合后发送给大模型
//
// 每条指令包含：
//   name        — 指令名称（含 / 前缀）
//   description — 简短描述（用于列表展示）
//   type        — 'blocking' | 'non-blocking'
//   execute(ctx) — 执行函数
//
// ── ctx 上下文 ──
//   remainingText  — 指令后面的剩余文本（可能为空字符串）
//   messages       — 当前消息列表
//   exit           — ink 的 exit 函数
//   model          — 当前模型名
//
// ── blocking execute 返回值 ──
//   { action: 'exit' }                              — 退出应用
//   { action: 'done', messages: [...] }             — 更新消息，结束（不发 LLM）
//   { action: 'done', messages: [...], clearScreen: true } — 同上 + 清屏
//   { action: 'select-history', histories: [...] }  — 进入历史选择模式
//
// ── non-blocking execute 返回值 ──
//   { context: string, messages?: [...] }           — context 与 remainingText 组合后发 LLM

import { getHistoryList, loadCustomCommands } from '../utils/fsHandle.js';
import { storeAllFilesIn, getRagFileListSync } from '../utils/ragHandle.js';
import { getMemoryContent } from '../utils/memoryUtils.js';
import { getAIResponse } from '../request/llm.js';

/** @type {Array} */
const commandRegistry = [];

/**
 * 注册一条指令
 * @param {Object} cmd
 * @param {string} cmd.name
 * @param {string} cmd.description
 * @param {'blocking' | 'non-blocking'} cmd.type
 * @param {(ctx: Object) => Object} cmd.execute
 */
export function registerCommand(cmd) {
  commandRegistry.push(cmd);
}

// ── 阻断类指令 ────────────────────────────────────────

// /exit — 退出对话
registerCommand({
  name: '/exit',
  description: '退出对话',
  type: 'blocking',
  execute: () => ({ action: 'exit' }),
});

// /clear — 清空对话历史
registerCommand({
  name: '/clear',
  description: '清空对话历史',
  type: 'blocking',
  execute: () => ({ action: 'done', messages: [], clearScreen: true }),
});

// /help — 显示可用指令帮助
registerCommand({
  name: '/help',
  description: '显示可用指令帮助',
  type: 'blocking',
  execute: ({ messages }) => {
    const lines = [
      '**可用指令：**',
      '',
      ...commandRegistry.map(
        (cmd) => `- \`${cmd.name}\` — ${cmd.description} [${cmd.type === 'blocking' ? '阻断' : '非阻断'}]`,
      ),
      '',
      '**文件引用：**',
      '',
      '在输入中使用 `@文件路径` 可以将文件内容作为上下文发送给大模型。',
      '输入 `@` 后会弹出项目文件列表，可用 ↑↓ 选择、Tab/Enter 确认。',
      '',
      '示例：`请分析 @src/components/App.jsx 的代码结构`',
    ];
    return {
      action: 'done',
      messages: [...messages, { role: 'assistant', content: lines.join('\n') }],
    };
  },
});

// /model — 查看当前使用的模型
registerCommand({
  name: '/model',
  description: '查看当前使用的模型',
  type: 'blocking',
  execute: ({ messages, model }) => ({
    action: 'done',
    messages: [
      ...messages,
      { role: 'assistant', content: `当前使用的模型：**${model}**` },
    ],
  }),
});

// ── 非阻断类指令 ──────────────────────────────────────

// /code — 读取项目代码结构概览作为上下文
// 示例: /code 解释一下这个项目的架构
registerCommand({
  name: '/code',
  description: '附带项目结构概览作为上下文',
  type: 'non-blocking',
  execute: () => {
    const context =
      '以下是当前项目的文件结构概览，请基于此理解项目结构：\n' +
      '(项目文件树)';
    return { context };
  },
});

// /context — 显示当前上下文摘要
registerCommand({
  name: '/context',
  description: '显示当前上下文摘要',
  type: 'blocking',
  execute: ({ messages, model }) => {
    const userMsgs = messages.filter((m) => m.role === 'user');
    const assistantMsgs = messages.filter((m) => m.role === 'assistant');
    const firstUserMsg = userMsgs[0];
    const lastUserMsg = userMsgs[userMsgs.length - 1];

    const lines = [
      '**当前上下文摘要：**',
      '',
      `- **模型：** ${model}`,
      `- **消息总数：** ${messages.length} 条（用户 ${userMsgs.length} / 助手 ${assistantMsgs.length}）`,
    ];

    if (firstUserMsg) {
      const preview = firstUserMsg.content.slice(0, 80).replace(/\n/g, ' ');
      lines.push(`- **首个问题：** ${preview}${firstUserMsg.content.length > 80 ? '...' : ''}`);
    }
    if (lastUserMsg && lastUserMsg !== firstUserMsg) {
      const preview = lastUserMsg.content.slice(0, 80).replace(/\n/g, ' ');
      lines.push(`- **最近问题：** ${preview}${lastUserMsg.content.length > 80 ? '...' : ''}`);
    }

    if (messages.length === 0) {
      lines.push('', '*当前没有对话消息。*');
    }

    return {
      action: 'done',
      messages: [
        ...messages,
        { role: 'assistant', content: lines.join('\n') },
      ],
    };
  },
});

// /history — 显示所有历史对话，可选择切换
registerCommand({
  name: '/history',
  description: '查看并切换历史对话',
  type: 'blocking',
  execute: ({ messages }) => {
    const histories = getHistoryList();

    if (histories.length === 0) {
      return {
        action: 'done',
        messages: [
          ...messages,
          { role: 'assistant', content: '暂无历史对话记录。' },
        ],
      };
    }

    return { action: 'select-history', histories };
  },
});

// /vector — 将所有本地文档向量化并存入向量数据库
//
// 扫描 ~/.minicode/doc/ 和 .minicode/doc/ 下的 .md/.txt/.docx 文件，
// 切割后逐条调用 embedding 模型生成向量，存入 LanceDB。
//
// 由于 storeAllFilesIn 是异步且耗时操作，execute 返回一个 asyncTask，
// App.jsx 会在展示"正在处理"消息后执行该任务，完成后更新消息内容。
registerCommand({
  name: '/vector',
  description: '将本地文档向量化并存入数据库',
  type: 'blocking',
  execute: ({ messages }) => {
    // 先同步收集文件信息，用于展示
    const { userFiles, currentDirFiles } = getRagFileListSync();
    const totalFiles = userFiles.length + currentDirFiles.length;

    if (totalFiles === 0) {
      return {
        action: 'done',
        messages: [
          ...messages,
          {
            role: 'assistant',
            content:
              '**未找到可向量化的文档。**\n\n'
              + '请将文档放在以下目录之一：\n'
              + '- `~/.minicode/doc/`（用户级，所有项目共享）\n'
              + '- `.minicode/doc/`（项目级，当前项目专用）\n\n'
              + '支持的格式：`.md`、`.txt`、`.docx`',
          },
        ],
      };
    }

    // 构建文件列表摘要
    const fileList = [
      ...userFiles,
      ...currentDirFiles,
    ];
    const fileSummary = fileList.map((p) => `- \`${p}\``).join('\n');

    // 返回"正在处理"消息 + 异步任务
    const placeholderMsg = {
      role: 'assistant',
      content:
        `**正在向量化文档...**\n\n`
        + `共 **${totalFiles}** 个文件：\n${fileSummary}\n\n`
        + '⏳ 正在切割文本并生成向量，请稍候...',
    };

    return {
      action: 'done',
      messages: [...messages, placeholderMsg],
      asyncTask: async (updatedMessages) => {
        try {
          await storeAllFilesIn();

          // 构建成功消息
          const successContent =
            `**✅ 向量化完成！**\n\n`
            + `共处理 **${totalFiles}** 个文件：\n${fileSummary}\n\n`
            + '文档已存入 LanceDB 向量数据库，后续对话中会自动检索相关内容。';

          return { content: successContent };
        } catch (error) {
          return {
            content:
              `**❌ 向量化失败**\n\n错误信息：${error.message}\n\n`
              + '请检查文件格式和网络连接后重试。',
          };
        }
      },
    };
  },
});

// /memory — 调用大模型分析上下文并生成记忆
//
// 读取记忆模板（含当前记忆、上下文、对话历史），发送给大模型，
// 大模型仅可使用 memorySave 工具，分析后写入项目级和用户级记忆文件。
registerCommand({
  name: '/memory',
  description: '生成记忆 - 调用大模型分析上下文并写入记忆文件',
  type: 'blocking',
  execute: ({ messages }) => {
    // 先展示 placeholder 消息，后台异步执行记忆生成
    const placeholderMsg = {
      role: 'assistant',
      content:
        '**AI 正在生成记忆...**\n\n⏳ 正在分析上下文与对话历史，请稍候...',
    };

    return {
      action: 'done',
      messages: [...messages, placeholderMsg],
      asyncTask: async () => {
        try {
          // 1. 获取要发给大模型的记忆模板内容（含当前记忆、上下文、对话历史）
          const memoryContent = getMemoryContent();

          // 2. 构造消息：内容携带记忆模板
          const memoryMessages = [{ role: 'user', content: memoryContent }];

          // 3. 请求大模型接口，只携带 memorySave 工具
          //    大模型分析上下文后调用 memorySave 写入记忆文件
          let resultText = '';
          for await (const event of getAIResponse(memoryMessages, {
            toolFilter: (tool) => tool.name === 'memorySave',
          })) {
            if (event.type === 'text') {
              resultText += event.content;
            } else if (event.type === 'tool_start') {
              resultText += `\n\n📝 正在执行 ${event.name}...\n`;
            } else if (event.type === 'tool_end') {
              resultText += `✅ ${event.name} 返回: ${event.result}\n`;
            }
          }

          return {
            content:
              `**✅ 记忆生成完成！**\n\n`
              + (resultText || '大模型已完成记忆分析和写入。'),
          };
        } catch (error) {
          return {
            content:
              `**❌ 生成记忆失败**\n\n错误信息：${error.message}\n\n`
              + '请检查网络连接和大模型配置后重试。',
          };
        }
      },
    };
  },
});

// ── 自定义指令 ──────────────────────────────────────────
// 从用户 home 目录 (~/.minicode/commands/) 和项目目录 (.minicode/commands/) 加载
// 每个子文件夹为一个指令组，其中的 .md 文件为指令
// 例如 commands/a/c.md → 指令 /a:c
// 所有自定义指令均为非阻断类型，执行时读取对应 md 文件内容作为上下文
const customCommands = loadCustomCommands();
for (const cmd of customCommands) {
  registerCommand(cmd);
}

// ── 对外接口 ──────────────────────────────────────────

/**
 * 获取所有已注册的指令（用于列表展示）
 * @returns {Array}
 */
export function getCommands() {
  return commandRegistry;
}

/**
 * 根据查询字符串筛选匹配的指令
 * @param {string} query — 用户在 / 之后输入的文本
 * @returns {Array}
 */
export function filterCommands(query) {
  if (!query) return commandRegistry;
  const lowerQuery = query.toLowerCase();
  return commandRegistry.filter((cmd) =>
    cmd.name.toLowerCase().includes(lowerQuery),
  );
}

/**
 * 解析输入文本，提取指令名和剩余文本
 * @param {string} text — 用户输入的完整文本（已 trim）
 * @returns {{ command: string | null, remainingText: string }}
 */
export function parseCommand(text) {
  // 支持两种指令格式：
  //   /word         — 内置指令（如 /clear, /help）
  //   /word:word    — 自定义指令（如 /a:c，来自 commands/a/c.md）
  const match = text.match(/^(\/\w+(?::\w+)?)(?:\s+(.*))?$/s);
  if (!match) return { command: null, remainingText: text };
  return { command: match[1], remainingText: (match[2] || '').trim() };
}

/**
 * 执行指令
 * @param {string} commandName — 指令名（如 /clear）
 * @param {Object} ctx — 执行上下文
 * @returns {Object | null} 执行结果，指令不存在时返回 null
 */
export function executeCommand(commandName, ctx) {
  const cmd = commandRegistry.find((c) => c.name === commandName);
  if (!cmd) return null;
  return cmd.execute(ctx);
}

/**
 * 获取指令的类型
 * @param {string} commandName — 指令名
 * @returns {'blocking' | 'non-blocking' | null}
 */
export function getCommandType(commandName) {
  const cmd = commandRegistry.find((c) => c.name === commandName);
  return cmd ? cmd.type : null;
}
