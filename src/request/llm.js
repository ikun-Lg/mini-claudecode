// 大模型请求模块：封装与 OpenAI 接口的通信
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { getUserHomeDir, getCurrentWorkingDir } from '../utils/pathUtils.js';

const SETTINGS_FILENAME = '.mincode/settings.json';

/**
 * 从指定目录读取 .mincode/settings.json 配置文件
 * @param {string} dir - 基准目录
 * @returns {Object} 解析后的配置对象，读取失败则返回空对象
 */
function readSettings(dir) {
  const filePath = path.join(dir, SETTINGS_FILENAME);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
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
export const DEFAULT_MODEL = settings.model || 'gpt-4o-mini';

// 系统提示词，定义助手的人设
const SYSTEM_PROMPT =
  '你是 mini-claudecode，一个运行在终端中的智能编程助手。' +
  '你可以帮助用户解答编程问题、分析代码、提供建议。' +
  '请用简洁清晰的中文进行回答。';

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
 * @param {Array<{role: 'user' | 'assistant', content: string}>} messages - 对话历史
 * @yields {string} 大模型返回的文本片段
 */
export async function* chatWithLLM(messages) {
  // 构造发送给大模型的消息列表（在开头插入系统提示）
  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
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
