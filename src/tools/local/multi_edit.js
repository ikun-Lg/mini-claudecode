import fs from 'fs';
import path from 'path';
import {
  checkWorkDirBoundary,
  createBackup,
  cleanupBackup,
  rollbackFromBackup,
} from './securityUtils.js';

export default {
    define: {
        name: "multi_edit",
        description: "对同一个文件进行多处编辑：按顺序执行多组 old_string→new_string 替换。所有编辑原子化操作——任一编辑失败则全部不生效。适合需要修改同一文件多个位置的场景，避免多次调用 edit_file 产生的竞态问题。",
        inputSchema: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "要编辑的文件路径（绝对路径或相对路径）"
                },
                edits: {
                    type: "array",
                    description: "编辑操作列表，按顺序执行。每个编辑操作包含 old_string 和 new_string",
                    items: {
                        type: "object",
                        properties: {
                            old_string: {
                                type: "string",
                                description: "要查找并替换的原始文本"
                            },
                            new_string: {
                                type: "string",
                                description: "替换后的新文本"
                            },
                            replace_all: {
                                type: "boolean",
                                description: "是否替换该组的所有匹配项，默认 false",
                                default: false
                            }
                        },
                        required: ["old_string", "new_string"]
                    }
                }
            },
            required: ["file_path", "edits"]
        }
    },
    handle({ file_path, edits }) {
        // #6 工作目录安全限制
        const boundary = checkWorkDirBoundary(file_path);
        if (!boundary.safe) {
            return boundary.message;
        }
        const resolvedPath = boundary.resolvedPath;

        if (!fs.existsSync(resolvedPath)) {
            return `文件不存在: ${resolvedPath}`;
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            return `路径不是文件: ${resolvedPath}`;
        }

        if (!edits || edits.length === 0) {
            return `没有提供编辑操作。`;
        }

        try {
            let content = fs.readFileSync(resolvedPath, 'utf-8');
            const results = [];

            // 先在副本上验证所有编辑，全部通过后再写入
            let workingContent = content;

            for (let i = 0; i < edits.length; i++) {
                const edit = edits[i];
                const { old_string, new_string, replace_all = false } = edit;

                if (old_string === new_string) {
                    results.push(`  [${i + 1}] 跳过：old_string 和 new_string 相同`);
                    continue;
                }

                // 统计匹配次数
                let matchCount = 0;
                let searchPos = 0;
                while (true) {
                    const idx = workingContent.indexOf(old_string, searchPos);
                    if (idx === -1) break;
                    matchCount++;
                    searchPos = idx + old_string.length;
                }

                if (matchCount === 0) {
                    // 编辑失败，整个操作回滚
                    return `编辑失败（原子操作回滚）：\n  [${i + 1}] 在文件中未找到 old_string，请检查内容是否精确匹配。\n文件: ${resolvedPath}`;
                }

                if (!replace_all && matchCount > 1) {
                    return `编辑失败（原子操作回滚）：\n  [${i + 1}] old_string 出现了 ${matchCount} 次，不是唯一的。请提供更多上下文或设置 replace_all=true。\n文件: ${resolvedPath}`;
                }

                // 执行替换
                if (replace_all) {
                    workingContent = workingContent.split(old_string).join(new_string);
                } else {
                    const idx = workingContent.indexOf(old_string);
                    workingContent = workingContent.slice(0, idx) + new_string + workingContent.slice(idx + old_string.length);
                }

                results.push(`  [${i + 1}] 替换了 ${replace_all ? matchCount : 1} 处匹配`);
            }

            // 所有编辑验证通过，写入文件
            // #9 写入前备份，失败时回滚
            const backupPath = createBackup(resolvedPath);
            try {
                fs.writeFileSync(resolvedPath, workingContent, 'utf-8');
                cleanupBackup(backupPath);
            } catch (writeErr) {
                rollbackFromBackup(resolvedPath, backupPath);
                return `文件批量编辑失败，已回滚: ${writeErr.message}`;
            }

            return `文件批量编辑成功: ${resolvedPath}\n${results.join('\n')}`;
        } catch (err) {
            return `文件批量编辑失败: ${err.message}`;
        }
    }
};
