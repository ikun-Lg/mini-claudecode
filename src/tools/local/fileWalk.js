import fs from 'fs';
import path from 'path';

/**
 * 默认忽略的目录
 */
export const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '.output'
]);

/**
 * 二进制文件扩展名集合
 */
const BINARY_EXTS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.exe', '.dll', '.so', '.dylib',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.woff', '.woff2', '.ttf', '.eot',
    '.lock', '.sum'
]);

/**
 * 判断文件是否为文本文件
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isTextFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return !BINARY_EXTS.has(ext);
}

/**
 * 递归遍历目录，生成所有文件的路径
 * 自动跳过 IGNORE_DIRS 中的目录和隐藏目录（以 . 开头）
 * @param {string} dir - 要遍历的根目录
 * @param {Object} [options] - 可选配置
 * @param {Set<string>} [options.ignoreDirs] - 额外忽略的目录名
 * @returns {Generator<string>} 文件绝对路径
 */
export function* walkDir(dir, options = {}) {
    const ignoreSet = options.ignoreDirs
        ? new Set([...IGNORE_DIRS, ...options.ignoreDirs])
        : IGNORE_DIRS;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (!ignoreSet.has(entry.name) && !entry.name.startsWith('.')) {
                yield* walkDir(path.join(dir, entry.name), { ignoreDirs: ignoreSet });
            }
        } else if (entry.isFile()) {
            yield path.join(dir, entry.name);
        }
    }
}
