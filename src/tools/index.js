//把本地和mcp合并成一个最终的
import { linkMcpAndListTool } from "./mcp/index.js";
import getLocalTool from "./local/index.js";
const { localTools, localMap } = getLocalTool();

//初始只有本地的工具（同步加载，立即可用）
const tools = [...localTools];
const toolNameMap = {
  ...localMap,
};

// MCP工具异步加载，不阻塞启动
// linkMcpAndListTool 会往同一个 tools 数组和 toolNameMap 中 push
// 加载完成后后续请求自动就能拿到 MCP 工具
linkMcpAndListTool(tools, toolNameMap).catch(() => {
  // MCP 加载失败不影响本地工具使用
});

/**
 * 执行工具调用
 * 不需要 await initDone —— 如果工具在 tools 列表中，
 * 它的 client 必然已在 toolNameMap 中（两者同步写入）
 */
export async function excuteTool(name, args) {
  const result = await toolNameMap[name].callTool({
    name: name,
    arguments: args,
  });
  //返回文本出去
  return result.content[0].text;
}

/**
 * 获取当前已加载的工具列表
 * 直接返回可变数组引用，MCP 工具加载完后会自动追加
 */
export function getTools() {
  return tools;
}

export function getToolNameMap() {
  return toolNameMap;
}

export default {
  tools,
  toolNameMap,
};
