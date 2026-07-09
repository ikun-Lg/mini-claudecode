// 文件系统操作模块：提供文件读写等工具方法
import fs from 'fs';
import path from 'path';
import { getCurrentWorkingDir, getUserHomeDir } from './pathUtils.js';

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
 * 获取所有历史对话列表
 * 读取 .minicode/history/ 目录下的所有 JSON 文件，按保存时间倒序排列
 * @returns {Array<{ filename: string, savedAt: string, messageCount: number, preview: string }>}
 */
export function getHistoryList() {
  const baseDir = path.join(getCurrentWorkingDir(), MINICODE_DIR_NAME, HISTORY_DIR_NAME);

  let files;
  try {
    files = fs.readdirSync(baseDir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  const histories = files
    .map((filename) => {
      try {
        const filePath = path.join(baseDir, filename);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        // 提取第一条用户消息作为预览
        const firstUserMsg = (data.messages || []).find(
          (m) => m.role === 'user',
        );
        const preview = firstUserMsg
          ? firstUserMsg.content.slice(0, 60).replace(/\n/g, ' ')
          : '(空对话)';
        return {
          filename,
          savedAt: data.savedAt || '',
          messageCount: data.messageCount || (data.messages || []).length,
          preview,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  // 按保存时间倒序
  histories.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

  return histories;
}

/**
 * 加载指定的历史对话
 * @param {string} filename - 历史文件名
 * @returns {{ success: boolean, messages: Array | null, error: string | null }}
 */
export function loadHistory(filename) {
  const baseDir = path.join(getCurrentWorkingDir(), MINICODE_DIR_NAME, HISTORY_DIR_NAME);
  const filePath = path.join(baseDir, filename);

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return { success: true, messages: data.messages || [], error: null };
  } catch (error) {
    return {
      success: false,
      messages: null,
      error: error?.message || String(error),
    };
  }
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

// ── 自定义指令 ──────────────────────────────────────────
// commands 目录名
const COMMANDS_DIR_NAME = 'commands';

/**
 * 扫描单个 commands 目录，收集所有自定义指令
 *
 * 目录结构规则：
 *   commands/
 *     <组名>/
 *       <指令名>.md   →  指令名 /<组名>:<指令名>
 *
 * 例如 commands/a/c.md 会产生指令 /a:c
 *
 * @param {string} commandsDir - commands 目录的绝对路径
 * @returns {Array<{ name: string, description: string, type: string, execute: Function }>}
 *   自定义指令对象数组（已包含 execute 函数）
 */
function scanCustomCommandsDir(commandsDir) {
  const results = [];

  let groupEntries;
  try {
    groupEntries = fs.readdirSync(commandsDir, { withFileTypes: true });
  } catch {
    // 目录不存在或不可读，返回空
    return results;
  }

  for (const groupEntry of groupEntries) {
    // 只处理子文件夹（每个子文件夹是一个指令组）
    if (!groupEntry.isDirectory()) continue;

    const groupName = groupEntry.name;
    const groupPath = path.join(commandsDir, groupName);

    let mdEntries;
    try {
      mdEntries = fs.readdirSync(groupPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const mdEntry of mdEntries) {
      // 只处理 .md 文件
      if (!mdEntry.isFile()) continue;
      if (!mdEntry.name.endsWith('.md')) continue;

      const cmdName = mdEntry.name.slice(0, -3); // 去掉 .md 后缀
      const filePath = path.join(groupPath, mdEntry.name);
      const commandName = `/${groupName}:${cmdName}`;

      // 尝试读取 md 文件第一行作为描述
      let description = '自定义指令';
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const firstLine = content.split('\n').find((line) => line.trim());
        if (firstLine && firstLine.startsWith('#')) {
          // 如果第一行是 Markdown 标题，取标题文本
          description = firstLine.replace(/^#+\s*/, '').trim();
        } else if (firstLine) {
          // 否则取第一行的前 50 个字符
          description = firstLine.trim().slice(0, 50);
        }
      } catch {
        // 读取失败时使用默认描述
      }

      // 构建指令对象：自定义指令均为非阻断类型
      // execute 读取对应 md 文件内容作为上下文返回
      // 使用闭包捕获 filePath
      results.push({
        name: commandName,
        description,
        type: 'non-blocking',
        execute: () => {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return { context: content };
          } catch (error) {
            return {
              context: `(读取指令文件失败: ${error?.message || String(error)})`,
            };
          }
        },
      });
    }
  }

  return results;
}

/**
 * 加载所有自定义指令
 *
 * 从两个位置读取：
 *   1. 用户 home 目录：~/.minicode/commands/
 *   2. 当前项目目录：  .minicode/commands/
 *
 * 当两个位置存在同名指令时，项目级指令优先（覆盖用户级）
 *
 * @returns {Array<{ name: string, description: string, type: string, execute: Function }>}
 */
export function loadCustomCommands() {
  const userCommandsDir = path.join(
    getUserHomeDir(),
    MINICODE_DIR_NAME,
    COMMANDS_DIR_NAME,
  );
  const projectCommandsDir = path.join(
    getCurrentWorkingDir(),
    MINICODE_DIR_NAME,
    COMMANDS_DIR_NAME,
  );

  // 先加载用户级，再加载项目级（项目级覆盖同名）
  const userCommands = scanCustomCommandsDir(userCommandsDir);
  const projectCommands = scanCustomCommandsDir(projectCommandsDir);

  // 使用 Map 合并：后插入的项目级覆盖先插入的用户级
  const commandMap = new Map();
  for (const cmd of userCommands) {
    commandMap.set(cmd.name, cmd);
  }
  for (const cmd of projectCommands) {
    commandMap.set(cmd.name, cmd);
  }

  return Array.from(commandMap.values());
}
