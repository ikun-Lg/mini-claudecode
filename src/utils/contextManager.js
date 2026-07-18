// 上下文管理模块（#4）
//
// 提供滑动窗口截断、token 估算、工具结果压缩等能力，
// 防止长对话超出模型 context window。
//
// 策略：
//   1. 粗略估算 token 数（不需要精确，用于判断是否需要截断）
//   2. 保留首条用户消息（任务目标）+ 最近 N 轮对话
//   3. 中间消息被截断，插入一条摘要提示
//   4. 工具结果超长时自动截断（保留首尾）

// 粗略估算：英文约 4 字符/token，中文约 2 字符/token，取 3
const CHARS_PER_TOKEN = 3;
// 每条消息的结构开销（role、分隔符等）约 4 token
const MSG_OVERHEAD_TOKENS = 4;

// 默认上下文窗口大小（token），适配大多数模型
// gpt-4o 128k、claude 200k，留出 8k 给 completion + 工具结果
const DEFAULT_MAX_CONTEXT_TOKENS = 120000;
// 保留的最近消息轮数（每轮 ≈ user + assistant）
const DEFAULT_KEEP_RECENT_TURNS = 12;
// 工具结果最大字符数，超出则截断
const MAX_TOOL_RESULT_CHARS = 2000;

/**
 * 粗略估算文本的 token 数
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(str.length / CHARS_PER_TOKEN);
}

/**
 * 估算单条消息的 token 数（含结构开销）
 * @param {Object} msg
 * @returns {number}
 */
export function estimateMessageTokens(msg) {
  let total = MSG_OVERHEAD_TOKENS;
  if (typeof msg.content === 'string') {
    total += estimateTokens(msg.content);
  } else if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part.text) total += estimateTokens(part.text);
    }
  }
  if (msg.tool_calls) {
    total += estimateTokens(JSON.stringify(msg.tool_calls));
  }
  return total;
}

/**
 * 估算消息列表的总 token 数
 * @param {Array} messages
 * @returns {number}
 */
export function estimateMessagesTokens(messages) {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

/**
 * 截断过长的工具结果（保留首尾，中间省略）
 * @param {string} text - 工具返回的原始结果
 * @param {number} [maxChars=2000] - 最大字符数
 * @returns {string}
 */
export function truncateToolResult(text, maxChars = MAX_TOOL_RESULT_CHARS) {
  if (!text || text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  const head = text.slice(0, half);
  const tail = text.slice(-half);
  const omitted = text.length - maxChars;
  return `${head}\n\n...（已省略 ${omitted} 字符）...\n\n${tail}`;
}

/**
 * 滑动窗口截断：保留首条用户消息 + 最近 N 轮对话
 *
 * 当对话总 token 数接近上限时，从早期消息开始截断，
 * 但始终保留：
 *   - 第一条用户消息（任务目标 / 上下文）
 *   - 最近的 N 轮对话（DEFAULT_KEEP_RECENT_TURNS）
 * 被截断的中间消息用一条 system 提示替代。
 *
 * @param {Array} messages - 对话历史
 * @param {Object} [options]
 * @param {number} [options.maxTokens=DEFAULT_MAX_CONTEXT_TOKENS] - 上下文窗口上限
 * @param {number} [options.keepRecentTurns=DEFAULT_KEEP_RECENT_TURNS] - 保留最近轮数
 * @returns {{ messages: Array, truncated: boolean, removedCount: number, estimatedTokens: number }}
 */
export function applySlidingWindow(messages, options = {}) {
  const maxTokens = options.maxTokens || DEFAULT_MAX_CONTEXT_TOKENS;
  const keepRecentTurns = options.keepRecentTurns || DEFAULT_KEEP_RECENT_TURNS;

  const estimatedTokens = estimateMessagesTokens(messages);

  // 未超限，直接返回
  if (estimatedTokens <= maxTokens) {
    return { messages, truncated: false, removedCount: 0, estimatedTokens };
  }

  // 找到第一条用户消息的索引
  const firstUserIdx = messages.findIndex((m) => m.role === 'user');
  // 最近 N 轮 = N * 2 条消息（user + assistant），从末尾往前数
  const recentCount = keepRecentTurns * 2;
  const recentStart = Math.max(0, messages.length - recentCount);

  // 确保保留区间不与首条用户消息重叠
  const keepStart = Math.max(firstUserIdx >= 0 ? firstUserIdx + 1 : 0, recentStart);
  const removedCount = keepStart - (firstUserIdx >= 0 ? firstUserIdx + 1 : 0);

  // 构建截断后的消息列表
  const result = [];
  // 保留首条用户消息
  if (firstUserIdx >= 0) {
    result.push(messages[firstUserIdx]);
  }
  // 插入截断提示
  if (removedCount > 0) {
    result.push({
      role: 'system',
      content: `[上下文管理] 已省略 ${removedCount} 条早期对话以控制 token 用量。如需查看完整历史，请使用 /history 指令。`,
    });
  }
  // 保留最近的对话
  result.push(...messages.slice(recentStart));

  return {
    messages: result,
    truncated: true,
    removedCount,
    estimatedTokens: estimateMessagesTokens(result),
  };
}
