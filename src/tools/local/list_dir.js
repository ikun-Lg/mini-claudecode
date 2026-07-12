import fs from 'fs';
import path from 'path';

const MAX_ENTRIES = 500;

export default {
    define: {
        name: "list_dir",
        description: "列出指定目录下的文件和子目录，返回结构化信息（名称、类型、大小）。当你需要了解项目结构、查看目录内容时使用此工具，不要用 bash 的 ls 命令。",
        inputSchema: {
            type: "object",
            properties: {
                directory: {
                    type: "string",
                    description: "要列出的目录路径（绝对路径或相对路径），默认为当前工作目录"
                },
                ignore: {
                    type: "array",
                    items: { type: "string" },
                    description: "要忽略的目录或文件名列表，例如 [\"node_modules\", \".git\"]",
                }
            }
        }
    },
    handle({ directory, ignore = [] }) {
        const root = directory ? path.resolve(directory) : process.cwd();

        if (!fs.existsSync(root)) {
            return `目录不存在: ${root}`;
        }

        const stat = fs.statSync(root);
        if (!stat.isDirectory()) {
            return `路径不是目录: ${root}`;
        }

        const ignoreSet = new Set(ignore);

        try {
            const entries = fs.readdirSync(root, { withFileTypes: true });
            const items = [];

            for (const entry of entries) {
                if (ignoreSet.has(entry.name)) continue;

                const fullPath = path.join(root, entry.name);
                let type, size;

                if (entry.isDirectory()) {
                    type = 'dir';
                    size = '-';
                } else if (entry.isSymbolicLink()) {
                    type = 'link';
                    try {
                        const target = fs.statSync(fullPath);
                        size = target.isFile() ? `${target.size}` : '-';
                        if (target.isDirectory()) type = 'dir';
                    } catch {
                        size = '-';
                    }
                } else if (entry.isFile()) {
                    type = 'file';
                    const s = fs.statSync(fullPath);
                    size = `${s.size}`;
                } else {
                    type = 'other';
                    size = '-';
                }

                items.push({ name: entry.name, type, size });

                if (items.length >= MAX_ENTRIES) break;
            }

            // 排序：目录在前，文件在后，各自按名称排序
            items.sort((a, b) => {
                if (a.type === 'dir' && b.type !== 'dir') return -1;
                if (a.type !== 'dir' && b.type === 'dir') return 1;
                return a.name.localeCompare(b.name);
            });

            // 格式化输出
            const lines = items.map(item => {
                const typeLabel = item.type === 'dir' ? '📁' : item.type === 'link' ? '🔗' : item.type === 'file' ? '📄' : '❓';
                return `${typeLabel} ${item.name}${item.type === 'dir' ? '/' : ''}\t(${item.size} bytes)`;
            });

            const truncated = items.length >= MAX_ENTRIES ? `\n（结果已截断，最多返回 ${MAX_ENTRIES} 条）` : '';
            return `目录: ${root}\n共 ${items.length} 项${truncated}：\n${lines.join('\n')}`;
        } catch (err) {
            return `列目录失败: ${err.message}`;
        }
    }
};
