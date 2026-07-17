#!/usr/bin/env node

/**
 * postinstall 脚本：将 templates/.minicode/ 中的 AI 增强内容
 * 复制到用户的 ~/.minicode/ 目录下。
 *
 * 特点：
 *   - 非破坏性：只复制不存在的文件，已存在的文件不会被覆盖
 *   - 安全：不会删除或修改用户已有的任何文件
 *   - 幂等：多次运行结果一致
 *
 * 用法：
 *   npm install @lggbond/mini-claudecode      → 自动执行
 *   node scripts/postinstall.js      → 手动执行
 *   node scripts/postinstall.js -f   → 强制覆盖（覆盖已有文件）
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模板源目录：<包根目录>/templates/.minicode/
const TEMPLATE_DIR = path.resolve(__dirname, '..', 'templates', '.minicode');
// 目标目录：~/.minicode/
const TARGET_DIR = path.join(os.homedir(), '.minicode');

// 是否强制覆盖（命令行参数 -f 或 --force）
const FORCE = process.argv.slice(2).some(
  (arg) => arg === '-f' || arg === '--force',
);

/**
 * 递归复制目录，非破坏性（默认不覆盖已有文件）
 * @param {string} src - 源目录
 * @param {string} dest - 目标目录
 * @param {boolean} force - 是否强制覆盖已有文件
 * @returns {{ copied: number, skipped: number, errors: string[] }}
 */
function copyDirRecursive(src, dest, force = false) {
  const stats = { copied: 0, skipped: 0, errors: [] };

  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (err) {
    stats.errors.push(`无法读取源目录 ${src}: ${err.message}`);
    return stats;
  }

  // 确保目标目录存在
  try {
    fs.mkdirSync(dest, { recursive: true });
  } catch (err) {
    stats.errors.push(`无法创建目标目录 ${dest}: ${err.message}`);
    return stats;
  }

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // 递归处理子目录
      const subStats = copyDirRecursive(srcPath, destPath, force);
      stats.copied += subStats.copied;
      stats.skipped += subStats.skipped;
      stats.errors.push(...subStats.errors);
    } else if (entry.isFile()) {
      // 检查目标文件是否已存在
      const exists = fs.existsSync(destPath);
      if (exists && !force) {
        stats.skipped++;
        continue;
      }

      try {
        fs.copyFileSync(srcPath, destPath);
        stats.copied++;
      } catch (err) {
        stats.errors.push(`复制失败 ${entry.name}: ${err.message}`);
      }
    }
  }

  return stats;
}

/**
 * 主函数
 */
function main() {
  // 检查模板目录是否存在
  if (!fs.existsSync(TEMPLATE_DIR)) {
    // 开发模式下 templates 可能不存在，静默退出
    return;
  }

  const stats = copyDirRecursive(TEMPLATE_DIR, TARGET_DIR, FORCE);

  // 只在有实际操作时输出信息
  if (stats.copied > 0 || stats.errors.length > 0) {
    console.log('');
    console.log('\x1b[34m●\x1b[0m \x1b[90mmini-claudecode\x1b[0m · AI 增强内容初始化');
    console.log('\x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');

    if (stats.copied > 0) {
      console.log(
        `\x1b[32m✓\x1b[0m 已安装 \x1b[1m${stats.copied}\x1b[0m 个文件到 \x1b[36m~/.minicode/\x1b[0m`,
      );
    }

    if (stats.skipped > 0) {
      console.log(
        `\x1b[33m○\x1b[0m 跳过 \x1b[1m${stats.skipped}\x1b[0m 个已存在的文件（使用 \x1b[36m-f\x1b[0m 强制覆盖）`,
      );
    }

    if (stats.errors.length > 0) {
      console.log('\x1b[31m✗\x1b[0m 以下错误需要关注：');
      for (const err of stats.errors) {
        console.log(`  \x1b[31m-\x1b[0m ${err}`);
      }
    }

    console.log('');
    console.log('  \x1b[90m已安装内容：\x1b[0m');
    console.log('  \x1b[90m├─ commands/\x1b[0m  斜杠指令模板（/commit:message、/review:code 等）');
    console.log('  \x1b[90m├─ skills/\x1b[0m    技能（code-review、mygit、refactor 等）');
    console.log('  \x1b[90m├─ rules/\x1b[0m     规则（code-style、css、security 等）');
    console.log('  \x1b[90m└─ agent.md\x1b[0m   项目自定义指令模板');
    console.log('');
    console.log(
      '  \x1b[90m配置 API Key：编辑 \x1b[36m~/.minicode/settings.json\x1b[0m\x1b[90m 或项目下 \x1b[36m.minicode/settings.json\x1b[0m',
    );
    console.log('');
  }
}

main();
