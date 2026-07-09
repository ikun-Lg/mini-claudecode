// 文件扫描模块：递归扫描项目目录，提供文件列表和文件读取功能
import fs from 'fs';
import path from 'path';
import { getCurrentWorkingDir } from './pathUtils.js';

// 忽略的目录名
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.minicode',
  '.catpaw',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.vscode',
  '.idea',
  '__pycache__',
  '.DS_Store',
]);

// 忽略的文件扩展名（二进制/媒体/压缩等）
const IGNORE_EXTENSIONS = new Set([
  '.lock',
  '.bin',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.rar',
  '.7z',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.wav',
  '.flv',
  '.swf',
  '.class',
  '.jar',
  '.war',
]);

// 最大返回文件数
const MAX_FILES = 200;
// 单文件最大读取大小（1MB）
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * 递归扫描目录，收集所有文件路径（相对路径）
 * @param {string} dir - 当前扫描的绝对路径
 * @param {string} basePath - 相对路径前缀
 * @param {string[]} results - 累积的结果数组
 * @returns {string[]} 文件相对路径列表
 */
function scanDir(dir, basePath = '', results = []) {
  if (results.length >= MAX_FILES) return results;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (results.length >= MAX_FILES) break;

    const relativePath = basePath
      ? `${basePath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      // 跳过忽略的目录
      if (IGNORE_DIRS.has(entry.name)) continue;
      scanDir(path.join(dir, entry.name), relativePath, results);
    } else if (entry.isFile()) {
      // 跳过忽略的扩展名
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORE_EXTENSIONS.has(ext)) continue;
      // 跳过点文件（如 .DS_Store, .eslintrc 等隐藏文件）
      if (entry.name.startsWith('.')) continue;
      results.push(relativePath);
    }
  }

  return results;
}

/**
 * 获取项目中所有文件列表（相对路径）
 * 结果会缓存在模块级别，避免重复扫描
 * @returns {string[]} 文件相对路径列表
 */
let _cachedFiles = null;

export function getAllFiles() {
  if (_cachedFiles) return _cachedFiles;
  const cwd = getCurrentWorkingDir();
  _cachedFiles = scanDir(cwd);
  return _cachedFiles;
}

/**
 * 根据查询字符串筛选文件
 * @param {string[]} files - 文件列表
 * @param {string} query - 查询字符串
 * @returns {string[]} 匹配的文件列表
 */
export function filterFiles(files, query) {
  if (!query) return files;
  const lowerQuery = query.toLowerCase();
  return files.filter((f) => f.toLowerCase().includes(lowerQuery));
}

/**
 * 读取文件内容
 * @param {string} filePath - 相对于项目根目录的文件路径
 * @returns {{success: boolean, content: string | null, error: string | null}}
 */
export function readFileContent(filePath) {
  const cwd = getCurrentWorkingDir();
  const fullPath = path.join(cwd, filePath);

  try {
    // 检查文件大小，避免读取过大的文件
    const stat = fs.statSync(fullPath);
    if (stat.size > MAX_FILE_SIZE) {
      return {
        success: false,
        content: null,
        error: `文件过大 (${(stat.size / 1024).toFixed(1)}KB)，跳过读取`,
      };
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, content, error: null };
  } catch (error) {
    return {
      success: false,
      content: null,
      error: error?.message || String(error),
    };
  }
}
