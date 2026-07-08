// 文件系统操作模块：提供文件读写等工具方法
import fs from 'fs';
import path from 'path';
import { getCurrentWorkingDir } from './pathUtils.js';

// .minicode 目录名
const MINICODE_DIR_NAME = '.minicode';
// history 目录名
const HISTORY_DIR_NAME = 'history';

// 模块级缓存：存储最新的对话消息，供退出时同步写入
let _cachedMessages = null;

/**
 * 更新缓存的对话消息（组件每次渲染时调用）
 * @param {Array} messages - 当前的消息列表
 */
export function cacheMessages(messages) {
  _cachedMessages = messages;
}

/**
 * 获取当前缓存的消息（供 app.js 退出时读取）
 * @returns {Array|null} 缓存的消息列表
 */
export function getCachedMessages() {
  return _cachedMessages;
}

/**
 * 将缓存的消息以 JSON 格式保存到 .minicode/history/<uuid>.json
 * 每次退出生成一个独立文件，文件名为 UUID
 * 在应用退出后由 app.js 调用
 * @returns {{ success: boolean, filePath: string | null, error: string | null }} 操作结果
 */
export function saveHistoryOnExit() {
  if (!_cachedMessages || _cachedMessages.length === 0) {
    return { success: false, filePath: null, error: 'No messages to save' };
  }
  // 用 UUID 作为文件名，格式：a1b2c3d4-e5f6-7890-abcd-ef1234567890.json
  const uuid = crypto.randomUUID() + '.json';
  return saveToProjectHistory(
    {
      messages: _cachedMessages,
      savedAt: new Date().toISOString(),
      messageCount: _cachedMessages.length,
    },
    uuid,
  );
}

/**
 * 将数据以 JSON 格式写入当前项目目录下 .minicode/history/ 文件夹中
 *
 * 工作流程：
 *   1. 获取当前工作目录（cwd），拼接 .minicode/history 路径
 *   2. 如果 .minicode 或 history 目录不存在，则递归创建
 *   3. 将参数序列化为 JSON（带格式化缩进）并写入该目录
 *
 * @param {*} data - 要写入的数据，会被序列化为 JSON
 * @param {string} [filename='data.json'] - 写入的文件名，默认为 data.json
 * @returns {{ success: boolean, filePath: string | null, error: string | null }} 操作结果
 */
export function saveToProjectHistory(data, filename = 'data.json') {
  // 1. 构建基础路径：<项目目录>/.minicode/history/
  const baseDir = path.join(getCurrentWorkingDir(), MINICODE_DIR_NAME, HISTORY_DIR_NAME);

  try {
    // 2. 递归创建所有不存在的目录（.minicode -> history）
    fs.mkdirSync(baseDir, { recursive: true });

    // 3. 拼接最终文件路径并写入 JSON
    const filePath = path.join(baseDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return {
      success: true,
      filePath,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      filePath: null,
      error: error?.message || String(error),
    };
  }
}
