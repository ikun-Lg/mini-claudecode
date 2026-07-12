import fs from 'fs';
import path from 'path';
import { minimatch } from 'minimatch';
import { walkDir, isTextFile } from './fileWalk.js';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_MATCHES = 200;   // 从 100 提升到 200
const MAX_FILES = 1000;    // 从 500 提升到 1000

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
    define: {
        name: "grep",
        description: "在项目中全局搜索文件内容，基于 Node.js 实现，跨平台兼容（支持 Windows / macOS / Linux）。支持正则或字符串匹配，可按 glob 过滤文件类型，可控制上下文行数，自动跳过 node_modules、.git、二进制文件等。本工具只用于搜索代码内容，不要用 bash 命令替代。",
        inputSchema: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "搜索的正则表达式或普通字符串"
                },
                path: {
                    type: "string",
                    description: "搜索的根目录，默认为当前工作目录"
                },
                glob: {
                    type: "string",
                    description: "文件过滤模式，例如 '*.js' 或 'src/**/*.ts'，可选"
                },
                output_mode: {
                    type: "string",
                    enum: ["files_with_matches", "content"],
                    description: "files_with_matches: 仅返回匹配的文件路径；content: 返回匹配行及前后上下文（默认）"
                },
                context_lines: {
                    type: "integer",
                    description: "匹配行前后各显示多少行上下文，默认 1。设为 0 则只显示匹配行",
                    default: 1
                },
                case_insensitive: {
                    type: "boolean",
                    description: "是否忽略大小写，默认 false",
                    default: false
                }
            },
            required: ["pattern"]
        }
    },
    handle({ pattern, path: searchPath, glob, output_mode = "content", context_lines = 1, case_insensitive = false }) {
        const root = searchPath ? path.resolve(searchPath) : process.cwd();

        if (!fs.existsSync(root)) {
            return `搜索路径不存在: ${root}`;
        }

        // 构建正则
        const flags = case_insensitive ? 'gmi' : 'gm';
        let regex;
        try {
            regex = new RegExp(pattern, flags);
        } catch {
            regex = new RegExp(escapeRegExp(pattern), flags);
        }

        const matches = [];
        let filesScanned = 0;
        const contextRadius = Math.max(0, context_lines);

        try {
            for (const filePath of walkDir(root)) {
                if (filesScanned >= MAX_FILES) break;

                if (!isTextFile(filePath)) continue;
                if (glob && !minimatch(filePath, glob, { matchBase: true })) continue;

                const stat = fs.statSync(filePath);
                if (stat.size > MAX_FILE_SIZE) continue;

                filesScanned++;
                const content = fs.readFileSync(filePath, 'utf-8');
                const relativePath = path.relative(root, filePath);

                if (output_mode === "files_with_matches") {
                    regex.lastIndex = 0;
                    if (regex.test(content)) {
                        matches.push(relativePath);
                        if (matches.length >= MAX_MATCHES) break;
                    }
                } else {
                    const lines = content.split(/\r?\n/);
                    const matchedLines = [];
                    for (let i = 0; i < lines.length; i++) {
                        regex.lastIndex = 0;
                        if (regex.test(lines[i])) {
                            const start = Math.max(0, i - contextRadius);
                            const end = Math.min(lines.length, i + contextRadius + 1);
                            const contextLines = [];
                            for (let j = start; j < end; j++) {
                                contextLines.push({
                                    lineNo: j + 1,
                                    content: lines[j],
                                    isMatch: j === i
                                });
                            }
                            matchedLines.push({
                                line: i + 1,
                                context: contextLines
                            });
                        }
                    }
                    if (matchedLines.length > 0) {
                        matches.push({ file: relativePath, lines: matchedLines });
                        if (matches.length >= MAX_MATCHES) break;
                    }
                }
            }
        } catch (err) {
            return `搜索出错: ${err.message}`;
        }

        if (matches.length === 0) {
            return `未找到匹配项（已扫描 ${filesScanned} 个文件）。`;
        }

        if (output_mode === "files_with_matches") {
            return `找到 ${matches.length} 个匹配文件（已扫描 ${filesScanned} 个文件）：\n${matches.join('\n')}`;
        }

        // 格式化 content 模式输出
        const parts = [];
        parts.push(`找到 ${matches.length} 个文件包含匹配（已扫描 ${filesScanned} 个文件）：`);
        for (const m of matches) {
            parts.push(`\n--- ${m.file} ---`);
            for (const l of m.lines) {
                for (const cl of l.context) {
                    const marker = cl.isMatch ? '>>>' : '   ';
                    parts.push(`${marker} ${cl.lineNo}: ${cl.content}`);
                }
                parts.push(''); // 匹配之间空一行
            }
        }
        return parts.join('\n');
    }
};
