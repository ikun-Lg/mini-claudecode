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

const SETTINGS_FILENAME = ".minicode/settings.json";

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

// 合并后的配置（模块加载时读取一次）
const settings = loadSettings();

// 默认使用的模型
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

/**
 * 创建 OpenAI 客户端实例
 * 配置来源：当前终端目录下的 .mincode/settings.json（优先）
 *          或用户 home 目录下的 .mincode/settings.json
 * @returns {OpenAI} OpenAI 客户端实例
 */
export function createClient() {
  return new OpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseURL || undefined,
  });
}

/**
 * 构建发送给大模型的消息列表
 * 在对话历史前插入 system prompt、用户上下文、skill 头部信息、RAG 检索上下文
 * 同时正确处理 tool 角色消息和带 tool_calls 的 assistant 消息
 *
 * @param {Array} messages - 对话历史（可能包含 tool 消息和 tool_calls）
 * @param {string} [ragContext=""] - RAG 检索到的参考资料上下文（已填充模板）
 * @returns {Array} 发送给大模型的完整消息列表
 */
function buildApiMessages(messages, ragContext = "") {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...(USER_CONTEXT ? [{ role: "user", content: USER_CONTEXT }] : []),
    ...(SKILL_HEADERS ? [{ role: "user", content: SKILL_HEADERS }] : []),
    ...(ragContext ? [{ role: "user", content: ragContext }] : []),
    ...messages.map((msg) => {
      // tool 角色的消息需要带上 tool_call_id
      if (msg.role === "tool") {
        return {
          role: "tool",
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        };
      }
      // assistant 消息可能带 tool_calls
      if (msg.role === "assistant" && msg.tool_calls) {
        return {
          role: "assistant",
          content: msg.content || "",
          tool_calls: msg.tool_calls,
        };
      }
      return { role: msg.role, content: msg.content };
    }),
  ];
}

/**
 * 流式调用大模型，支持工具调用循环（递归）
 *
 * 流程：
 *   1. 流式发送 messages 给大模型，逐块 yield 文本内容
 *   2. 同时累积 tool_calls deltas
 *   3. 流结束后，将 assistant 消息 push 到 messages（利用引用类型特性）
 *   4. 如果有 tool_calls，依次执行工具，push 工具结果到 messages
 *   5. 递归调用自身，让大模型基于工具结果继续回复
 *   6. 没有工具调用时，循环结束
 *
 * @param {Array} messages - 对话历史（可变数组，函数会向其中 push 消息）
 * @param {Object} [options={}] - 可选配置
 * @param {Function} [options.toolFilter] - 工具过滤函数，传入后只保留返回 true 的工具
 * @yields {{type: 'text', content: string} | {type: 'tool_start', name: string} | {type: 'tool_end', name: string, result: string}}
 */
export async function* getAIResponse(messages, options = {}) {
  try {
    // 获取当前已加载的工具列表（本地工具立即可用，MCP工具后台异步加载）
    const allTools = getTools();
    // 如果提供了 toolFilter，则只保留过滤后的工具（如 /memory 指令只需 memorySave）
    const tools = options.toolFilter
      ? allTools.filter(options.toolFilter)
      : allTools;

    // ── RAG 检索：用户发送提问时，搜索本地向量库获取相关参考资料 ──
    // 仅在最后一条消息是用户消息时执行（递归调用时最后一条是 tool 结果，跳过）
    let ragContext = "";
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "user" && RAG_TEMPLATE) {
      try {
        const ragResults = await searchLocalVector(lastMsg.content);
        if (ragResults && ragResults.length > 0) {
          ragContext = RAG_TEMPLATE.replace(
            /\$\{ragContent\}/g,
            ragResults.join("\n\n"),
          );
        }
      } catch {
        // RAG 检索失败，不阻断主流程，继续无上下文对话
      }
    }

    const apiMessages = buildApiMessages(messages, ragContext);
    const client = createClient();

    const stream = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: apiMessages,
      temperature: 0.7,
      tools: transformToOpenAi(tools),
      stream: true,
    });

    let fullContent = "";
    // 工具调用 deltas 可能分多个 chunk 到达，需要按 index 累积
    let toolCalls = [];

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      // 处理文本内容
      if (delta.content) {
        fullContent += delta.content;
        yield { type: "text", content: delta.content };
      }

      // 累积工具调用 deltas
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCalls[idx]) {
            toolCalls[idx] = {
              id: tc.id,
              type: "function",
              function: { name: "", arguments: "" },
            };
          }
          if (tc.function?.name) {
            toolCalls[idx].function.name += tc.function.name;
          }
          if (tc.function?.arguments) {
            toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }
    }

    // 过滤掉无效的工具调用（没有 id 的）
    toolCalls = toolCalls.filter((tc) => tc && tc.id);

    // 将 assistant 消息推入 messages（利用引用类型特性，外部也能看到）
    const aiMessage = {
      role: "assistant",
      content: fullContent,
    };
    if (toolCalls.length > 0) {
      aiMessage.tool_calls = toolCalls;
    }
    messages.push(aiMessage);

    // 如果有工具调用，执行并递归
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs = {};
        try {
          functionArgs = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          // JSON 解析失败时用空对象
        }

        yield { type: "tool_start", name: functionName, args: functionArgs };

        const excuteResult = await excuteTool(functionName, functionArgs);

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: excuteResult,
        });

        yield { type: "tool_end", name: functionName, result: excuteResult };
      }

      // 递归调用，让大模型基于工具结果继续回复
      yield* getAIResponse(messages);
    }
  } catch (error) {
    const errMsg = error?.message || String(error);
    yield { type: "text", content: `\n请求大模型失败：${errMsg}` };
  }
}
