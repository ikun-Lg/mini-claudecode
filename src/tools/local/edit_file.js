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
        name: "edit_file",
        description: "对文件进行局部编辑：在文件中查找 old_string 并替换为 new_string。当 replace_all 为 false 时，old_string 必须在文件中唯一出现，否则报错。优先使用此工具修改文件而非 write_file，以避免重写整个文件。如果要创建新文件请用 write_file。",
        inputSchema: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "要编辑的文件路径（绝对路径或相对路径）"
                },
                old_string: {
                    type: "string",
                    description: "要在文件中查找并替换的原始文本（必须精确匹配文件内容，包括缩进和换行）"
                },
                new_string: {
                    type: "string",
                    description: "替换后的新文本"
                },
                replace_all: {
                    type: "boolean",
                    description: "是否替换所有匹配项。false 时 old_string 必须唯一，否则报错。默认 false",
                    default: false
                }
            },
            required: ["file_path", "old_string", "new_string"]
        }
    },
    handle({ file_path, old_string, new_string, replace_all = false }) {
        // #6 工作目录安全限制
        const boundary = checkWorkDirBoundary(file_path);
        if (!boundary.safe) {
            return boundary.message;
        }
        const resolvedPath = boundary.resolvedPath;

        // 检查文件是否存在
        if (!fs.existsSync(resolvedPath)) {
            return `文件不存在: ${resolvedPath}`;
        }

        const stat = fs.statSync(resolvedPath);
        if (!stat.isFile()) {
            return `路径不是文件: ${resolvedPath}`;
        }

        // old_string 和 new_string 相同，无需操作
        if (old_string === new_string) {
            return `old_string 和 new_string 相同，无需修改: ${resolvedPath}`;
        }

        try {
            const content = fs.readFileSync(resolvedPath, 'utf-8');

            // 统计匹配次数
            let matchCount = 0;
            let searchPos = 0;
            while (true) {
                const idx = content.indexOf(old_string, searchPos);
                if (idx === -1) break;
                matchCount++;
                searchPos = idx + old_string.length;
            }

            if (matchCount === 0) {
                // 提供一些上下文帮助 AI 定位问题
                return `在文件中未找到指定的 old_string，请检查内容是否精确匹配（包括缩进和换行）。\n文件: ${resolvedPath}`;
            }

            if (!replace_all && matchCount > 1) {
                return `old_string 在文件中出现了 ${matchCount} 次，不是唯一的。请提供更多上下文使其唯一，或设置 replace_all=true 替换所有匹配项。\n文件: ${resolvedPath}`;
            }

            // 执行替换
            let newContent;
            if (replace_all) {
                newContent = content.split(old_string).join(new_string);
            } else {
                const idx = content.indexOf(old_string);
                newContent = content.slice(0, idx) + new_string + content.slice(idx + old_string.length);
            }

            // #9 写入前备份，失败时回滚
            const backupPath = createBackup(resolvedPath);
            try {
                fs.writeFileSync(resolvedPath, newContent, 'utf-8');
                cleanupBackup(backupPath); // 成功后清理备份
            } catch (writeErr) {
                rollbackFromBackup(resolvedPath, backupPath);
                return `文件写入失败，已回滚: ${writeErr.message}`;
            }

            const replacedCount = replace_all ? matchCount : 1;
            return `文件编辑成功: ${resolvedPath}\n替换了 ${replacedCount} 处匹配。`;
        } catch (err) {
            return `文件编辑失败: ${err.message}`;
        }
    }
};
