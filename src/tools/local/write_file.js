import fs from 'fs';
import path from 'path';

export default {
    define: {
        name: "write_file",
        description: "将内容写入到指定文件路径，如果文件已存在则覆盖，如果目录不存在则自动创建。适用于创建新文件或全量重写文件。如果要修改已有文件的部分内容，请使用 edit_file 或 multi_edit 工具。",
        inputSchema: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "要写入的文件路径（绝对路径或相对路径）"
                },
                content: {
                    type: "string",
                    description: "要写入文件的内容"
                }
            },
            required: ["file_path", "content"]
        }
    },
    handle({ file_path, content }) {
        const resolvedPath = path.resolve(file_path);

        try {
            const dir = path.dirname(resolvedPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const isExisting = fs.existsSync(resolvedPath);
            fs.writeFileSync(resolvedPath, content, 'utf-8');

            const lineCount = content.split(/\r?\n/).length;
            const byteSize = Buffer.byteLength(content, 'utf-8');
            const action = isExisting ? '覆盖' : '创建';

            return `文件${action}成功: ${resolvedPath}\n（${lineCount} 行，${byteSize} 字节）`;
        } catch (err) {
            return `文件写入失败: ${err.message}`;
        }
    }
};
