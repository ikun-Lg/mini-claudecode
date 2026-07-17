// 工具安全工具模块（#6 工作目录限制）
//
// 提供工作目录边界检查，防止 AI 误改 cwd 之外的文件。
// 默认禁止写入工作目录之外，除非通过 confirm 工具获得用户确认。

import path from 'path';
import fs from 'fs';

/**
 * 检查目标路径是否在工作目录内
 * @param {string} targetPath - 要检查的绝对路径
 * @param {string} [cwd] - 工作目录，默认为 process.cwd()
 * @returns {boolean} true 表示在工作目录内
 */
export function isWithinWorkDir(targetPath, cwd = process.cwd()) {
  const resolved = path.resolve(targetPath);
  const normalizedCwd = path.resolve(cwd);
  // 确保 cwd 以分隔符结尾，避免 /home/user 被 /home/usertmp 匹配
  const cwdWithSep = normalizedCwd.endsWith(path.sep)
    ? normalizedCwd
    : normalizedCwd + path.sep;
  return resolved === normalizedCwd || resolved.startsWith(cwdWithSep);
}

/**
 * 检查工作目录边界，返回安全检查结果
 * @param {string} filePath - 用户指定的文件路径
 * @returns {{ safe: boolean, resolvedPath: string, message?: string }}
 */
export function checkWorkDirBoundary(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!isWithinWorkDir(resolvedPath)) {
    return {
      safe: false,
      resolvedPath,
      message: `⚠️ 安全限制：文件路径不在当前工作目录内。\n路径: ${resolvedPath}\n工作目录: ${process.cwd()}\n如需操作工作目录外的文件，请通过 bash 工具手动执行。`,
    };
  }
  return { safe: true, resolvedPath };
}

/**
 * #9 备份文件内容（写入前调用）
 * 将原文件内容保存到 .bak 文件，供回滚使用
 * @param {string} filePath - 原文件路径
 * @returns {string|null} 备份文件路径，文件不存在时返回 null
 */
export function createBackup(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const backupPath = filePath + '.bak';
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

/**
 * #9 从备份回滚文件
 * @param {string} filePath - 原文件路径
 * @param {string} backupPath - 备份文件路径
 * @returns {boolean} 是否回滚成功
 */
export function rollbackFromBackup(filePath, backupPath) {
  try {
    if (backupPath && fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
      return true;
    }
  } catch {
    // 回滚失败
  }
  return false;
}

/**
 * #9 清理备份文件（写入成功后调用）
 * @param {string} backupPath - 备份文件路径
 */
export function cleanupBackup(backupPath) {
  try {
    if (backupPath && fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  } catch {
    // 清理失败不影响主流程
  }
}
