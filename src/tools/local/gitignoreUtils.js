// .gitignore 集成模块（#7）
//
// 读取项目根目录下的 .gitignore 文件，判断文件是否被忽略。
// 支持基本的 .gitignore 语法：通配符、目录匹配、取反 (!)。
// 缓存解析结果避免重复读取。

import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';

// 缓存：rootDir → { patterns: string[], mtime: number }
const cache = new Map();

/**
 * 读取并解析指定目录下的 .gitignore
 * 结果会缓存，按文件 mtime 失效
 * @param {string} rootDir - 项目根目录
 * @returns {string[]} 解析后的 pattern 数组
 */
function loadGitignorePatterns(rootDir) {
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) return [];

  try {
    const stat = fs.statSync(gitignorePath);
    const cached = cache.get(rootDir);

    // mtime 未变，使用缓存
    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.patterns;
    }

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    const patterns = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    cache.set(rootDir, { patterns, mtime: stat.mtimeMs });
    return patterns;
  } catch {
    return [];
  }
}

/**
 * 判断文件是否被 .gitignore 忽略
 * @param {string} relativePath - 相对于项目根目录的路径
 * @param {string} rootDir - 项目根目录
 * @returns {boolean} true 表示被忽略
 */
export function isIgnoredByGitignore(relativePath, rootDir) {
  const patterns = loadGitignorePatterns(rootDir);
  if (patterns.length === 0) return false;

  let ignored = false;
  const normalizedPath = relativePath.replace(/\\/g, '/');

  for (const pattern of patterns) {
    // 取反规则：取消忽略
    if (pattern.startsWith('!')) {
      const negPattern = pattern.slice(1);
      if (minimatch(normalizedPath, negPattern, { matchBase: true, dot: true })) {
        ignored = false;
      }
    } else {
      // 普通忽略规则
      if (minimatch(normalizedPath, pattern, { matchBase: true, dot: true })) {
        ignored = true;
      }
      // 目录匹配：pattern 以 / 结尾时，匹配目录及其下所有文件
      if (pattern.endsWith('/') && !pattern.startsWith('!')) {
        const dirPattern = pattern + '**';
        if (minimatch(normalizedPath, dirPattern, { matchBase: true, dot: true })) {
          ignored = true;
        }
      }
    }
  }

  return ignored;
}

/**
 * 清除缓存（配置变更或手动刷新时调用）
 */
export function clearGitignoreCache() {
  cache.clear();
}
