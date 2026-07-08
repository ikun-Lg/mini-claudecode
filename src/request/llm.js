// 大模型请求模块：封装与 OpenAI 接口的通信
import 'dotenv/config';
import OpenAI from 'openai';

/**
 * 创建 OpenAI 客户端实例
 * @returns {OpenAI} OpenAI 客户端实例
 */
export function createClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

// 默认使用的模型
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// 系统提示词，定义助手的人设
const SYSTEM_PROMPT =
  '你是 mini-claudecode，一个运行在终端中的智能编程助手。' +
  '你可以帮助用户解答编程问题、分析代码、提供建议。' +
  '请用简洁清晰的中文进行回答。';

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
