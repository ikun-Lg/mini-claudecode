// 大模型请求模块：封装与 OpenAI 接口的通信，支持工具调用循环
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import { getUserHomeDir, getCurrentWorkingDir } from "../utils/pathUtils.js";
import {
  readSystemContext,
  getUserContext,
  readRules,
  getSkillHeaders,
} from "../utils/contextRead.js";
import { excuteTool, getTools } from "../tools/index.js";
import { transformToOpenAi } from "../tools/util.js";
import { searchLocalVector } from "../utils/ragHandle.js";
import { applySlidingWindow, truncateToolResult } from "../utils/contextManager.js";

const SETTINGS_FILENAME = ".minicode/settings.json";

// 工具调用递归深度上限，防止模型陷入「调用-调用」循环导致 token 爆炸
const MAX_TOOL_ROUNDS = 20;

// 网络重试配置
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY = 1000; // 1s 起步，指数退避

/**
 * 从指定目录读取 .mincode/settings.json 配置文件
 * @param {string} dir - 基准目录
 * @returns {Object} 解析后的配置对象，读取失败则返回空对象
 */
function readSettings(dir) {
  const filePath = path.join(dir, SETTINGS_FILENAME);
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * 加载合并后的配置
 * 优先级：当前终端目录 > 用户 home 目录
 * @returns {Object} 合并后的配置对象
 */
function loadSettings() {
  const homeSettings = readSettings(getUserHomeDir());
  const localSettings = readSettings(getCurrentWorkingDir());
  return { ...homeSettings, ...localSettings };
}

// 合并后的配置（使用 let 以支持热加载）
let settings = loadSettings();

// 默认使用的模型（初始值，热加载后通过 getCurrentModel() 获取最新值）
export const DEFAULT_MODEL = settings.model || "gpt-4o-mini";

// ── 上下文预加载（项目启动时执行一次） ──────────────────
// system 消息和 user 上下文消息仅发送给大模型，不写入对话历史记录
const SYSTEM_PROMPT = readSystemContext();
const USER_CONTEXT = getUserContext();
const SKILL_HEADERS = getSkillHeaders();

// RAG 检索模板（启动时加载一次，用户提问时填充检索结果）
const RAG_TEMPLATE = (() => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templatePath = path.join(__dirname, "..", "docs", "ragTemplate.md");
  try {
    return fs.readFileSync(templatePath, "utf-8");
  } catch {
    return "";
  }
})();

// 规则映射表（启动时加载一次，供 App.jsx 匹配文件引用时使用）
export const RULES_MAP = readRules();

// ── 配置热加载（#12）──────────────────────────────────
let currentModel = settings.model || "gpt-4o-mini";

/**
 * 重新加载配置文件（settings.json 改动后无需重启）
 * 更新模块级 settings 和 currentModel
 * @returns {Object} 重新加载后的配置对象
 */
export function reloadSettings() {
  settings = loadSettings();
  currentModel = settings.model || "gpt-4o-mini";
  return getSettings();
}

/**
 * 获取当前配置的只读副本
 * @returns {Object} 配置对象副本
 */
export function getSettings() {
  return { ...settings };
}

/**
 * 获取当前使用的模型名（热加载后为最新值）
 * @returns {string}
 */
export function getCurrentModel() {
  return currentModel;
}

// ── API Key 配置校验（#10）────────────────────────────
/**
 * 校验配置是否可用（apiKey 是否存在）
 * @returns {{ valid: boolean, message: string }}
 */
export function validateConfig() {
  if (!settings.apiKey || settings.apiKey.trim() === "") {
    return {
      valid: false,
      message:
        "未配置 API Key。请在 ~/.minicode/settings.json 或项目目录 .minicode/settings.json 中设置 \"apiKey\" 字段。",
    };
  }
  return { valid: true, message: "" };
}

// ── token 用量统计（#5）────────────────────────────────
let tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, requestCount: 0, cachedTokens: 0 };

/**
 * 获取累计的 token 用量
 */
export function getTokenUsage() {
  return { ...tokenUsage };
}

/**
 * 获取缓存命中率（prompt cache hit rate）
 * @returns {{hitRate: number, cachedTokens: number, promptTokens: number}}
 */
export function getCacheHitRate() {
  if (tokenUsage.promptTokens === 0) return { hitRate: 0, cachedTokens: 0, promptTokens: 0 };
  return {
    hitRate: tokenUsage.cachedTokens / tokenUsage.promptTokens,
    cachedTokens: tokenUsage.cachedTokens,
    promptTokens: tokenUsage.promptTokens,
  };
}

/**
 * 重置 token 用量统计
 */
export function resetTokenUsage() {
  tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, requestCount: 0, cachedTokens: 0 };
}

// ── 流式生成中断（#3）──────────────────────────────────
let currentAbortController = null;

/**
 * 中断当前正在进行的 LLM 请求
 * @returns {boolean} 是否成功中断
 */
export function abortCurrentRequest() {
  if (currentAbortController) {
    currentAbortController.abort();
    return true;
  }
  return false;
}

// ── 网络重试（#2）──────────────────────────────────────
/**
 * 判断错误是否可重试（限流 429、服务端 5xx、网络超时）
 */
function isRetryableError(error) {
  const status = error?.status || error?.response?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  const code = error?.code || "";
  if (["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND"].includes(code)) return true;
  if (error?.message?.toLowerCase().includes("timeout")) return true;
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建 OpenAI 客户端实例
 */
export function createClient() {
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL || undefined,
  });
}

/**
 * 构建发送给大模型的消息列表
 */
function buildApiMessages(messages, ragContext = "") {
  // #4 滑动窗口：防止长对话超出模型 context window
  const { messages: windowedMessages, truncated, removedCount } = applySlidingWindow(messages);

  const result = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(USER_CONTEXT ? [{ role: "user", content: USER_CONTEXT }] : []),
    ...(SKILL_HEADERS ? [{ role: "user", content: SKILL_HEADERS }] : []),
    ...(ragContext ? [{ role: "user", content: ragContext }] : []),
  ];

  for (const msg of windowedMessages) {
    if (msg.role === "tool") {
      result.push({ role: "tool", content: msg.content, tool_call_id: msg.tool_call_id });
    } else if (msg.role === "assistant" && msg.tool_calls) {
      result.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });
    } else {
      result.push({ role: msg.role, content: msg.content });
    }
  }

  return result;
}

/**
 * 流式调用大模型，支持工具调用循环（递归）
 *
 * 新增能力：
 *   - #1 工具调用递归深度限制（MAX_TOOL_ROUNDS=20）
 *   - #2 网络重试与限流处理（429/5xx 指数退避）
 *   - #3 流式生成中断（通过 abortCurrentRequest()）
 *   - #5 token 用量统计
 */
export async function* getAIResponse(messages, options = {}) {
  const depth = options._depth || 0;

  // #1 递归深度限制
  if (depth >= MAX_TOOL_ROUNDS) {
    yield { type: "text", content: `\n⚠️ 已达到工具调用最大轮次（${MAX_TOOL_ROUNDS}），自动停止以防 token 爆炸。` };
    return;
  }

  try {
    const allTools = getTools();
    const tools = options.toolFilter ? allTools.filter(options.toolFilter) : allTools;

    // ── RAG 检索 ──
    let ragContext = "";
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "user" && RAG_TEMPLATE) {
      try {
        const searchText = typeof lastMsg.content === "string"
          ? lastMsg.content
          : Array.isArray(lastMsg.content)
            ? lastMsg.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")
            : String(lastMsg.content || "");
        const ragResults = await searchLocalVector(searchText);
        if (ragResults && ragResults.length > 0) {
          ragContext = RAG_TEMPLATE.replace(/\$\{ragContent\}/g, ragResults.join("\n\n"));
        }
      } catch { /* RAG 失败不阻断 */ }
    }

    const apiMessages = buildApiMessages(messages, ragContext);
    const client = createClient();

    // #3 流式中断：创建 AbortController
    currentAbortController = new AbortController();
    const { signal } = currentAbortController;

    // #2 网络重试
    let stream;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        stream = await client.chat.completions.create(
          { model: currentModel, messages: apiMessages, temperature: 0.7, tools: transformToOpenAi(tools), stream: true, stream_options: { include_usage: true } },
          { signal },
        );
        break;
      } catch (error) {
        if (signal.aborted) { currentAbortController = null; yield { type: "text", content: "\n⏹ 已中断生成。" }; return; }
        if (!isRetryableError(error) || attempt === MAX_RETRIES) { currentAbortController = null; throw error; }
        const delay = RETRY_BASE_DELAY * Math.pow(2, attempt);
        yield { type: "text", content: `\n🔄 请求失败（${error.message}），${delay / 1000}s 后重试（第 ${attempt + 1}/${MAX_RETRIES} 次）...` };
        await sleep(delay);
      }
    }
    currentAbortController = null;

    let fullContent = "";
    let toolCalls = [];

    for await (const chunk of stream) {
      // #5 token 统计：流式响应的最后一个 chunk 包含 usage
      if (chunk.usage) {
        tokenUsage.promptTokens += chunk.usage.prompt_tokens || 0;
        tokenUsage.completionTokens += chunk.usage.completion_tokens || 0;
        tokenUsage.totalTokens += chunk.usage.total_tokens || 0;
        tokenUsage.requestCount += 1;
        // 缓存命中统计：prompt_tokens_details.cached_tokens
        const cached = chunk.usage.prompt_tokens_details?.cached_tokens || 0;
        tokenUsage.cachedTokens += cached;
      }

      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        fullContent += delta.content;
        yield { type: "text", content: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCalls[idx]) {
            toolCalls[idx] = { id: tc.id, type: "function", function: { name: "", arguments: "" } };
          }
          if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
          if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
        }
      }
    }

    toolCalls = toolCalls.filter((tc) => tc && tc.id);

    const aiMessage = { role: "assistant", content: fullContent };
    if (toolCalls.length > 0) aiMessage.tool_calls = toolCalls;
    messages.push(aiMessage);

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs = {};
        try { functionArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { /* 解析失败用空对象 */ }

        yield { type: "tool_start", name: functionName, args: functionArgs };
        const excuteResult = await excuteTool(functionName, functionArgs);
        // #4 工具结果压缩：超长结果截断，避免吃满上下文
        const compressedResult = truncateToolResult(excuteResult);
        messages.push({ tool_call_id: toolCall.id, role: "tool", content: compressedResult });
        yield { type: "tool_end", name: functionName, result: excuteResult };
      }

      // 递归调用，传入递增的深度
      yield* getAIResponse(messages, { ...options, _depth: depth + 1 });
    }
  } catch (error) {
    // 用户中断时给出友好提示
    if (error?.name === "AbortError" || error?.message?.includes("abort")) {
      yield { type: "text", content: "\n⏹ 已中断生成。" };
      return;
    }
    const errMsg = error?.message || String(error);
    yield { type: "text", content: `\n请求大模型失败：${errMsg}` };
  }
}