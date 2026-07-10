// 大模型请求模块：封装与 OpenAI 接口的通信
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { getUserHomeDir, getCurrentWorkingDir } from "../utils/pathUtils.js";
import {
  readSystemContext,
  getUserContext,
  readRules,
  getSkillHeaders,
} from "../utils/contextRead.js";

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
 * 流式调用大模型进行对话
 *
 * 发送给大模型的消息结构（不影响对话历史记录）：
 *   [0] system     — 系统提示词（readSystemContext，启动时读取一次）
 *   [1] user       — 用户上下文（getUserContext，启动时读取一次）
 *   [2] user       — skill 头部信息（getSkillHeaders，启动时读取一次）
 *   [3..] 对话历史  — 用户实际的 user/assistant 消息
 *
 * system 和 user 上下文消息仅存在于本次请求的 apiMessages 中，
 * 不会被保存到 App.jsx 的 messages state，因此不会写入对话历史
 *
 * @param {Array<{role: 'user' | 'assistant', content: string}>} messages - 对话历史
 * @yields {string} 大模型返回的文本片段
 */
export async function* chatWithLLM(messages) {
  // 构造发送给大模型的消息列表
  const apiMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    // 用户上下文（agent.md），仅在有内容时插入
    ...(USER_CONTEXT ? [{ role: "user", content: USER_CONTEXT }] : []),
    // skill 头部信息，仅在有内容时插入
    ...(SKILL_HEADERS ? [{ role: "user", content: SKILL_HEADERS }] : []),
    ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
  ];

  try {
    const client = createClient();
    const stream = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: apiMessages,
      // 启用深度思考模式
      //   thinking: { type: 'enabled' },
      // 推理努力程度
      //   reasoning_effort: 'high',
      // 流式输出
      stream: true,
    });

    // 逐块读取流式响应
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  } catch (error) {
    // 捕获并包装错误，返回友好的提示信息
    const errMsg = error?.message || String(error);
    yield `请求大模型失败：${errMsg}`;
  }
}
