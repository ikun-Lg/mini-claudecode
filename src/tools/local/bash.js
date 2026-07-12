import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

const getPlatform = () => {
    return os.platform() === 'win32' ? 'windows' : 'others';
};

// 默认超时 30 秒
const DEFAULT_TIMEOUT = 30000;
// 输出最大长度（字符数），超出截断
const MAX_OUTPUT_LENGTH = 20000;

/**
 * 截断过长的输出
 */
function truncateOutput(text) {
    if (text.length <= MAX_OUTPUT_LENGTH) return text;
    const half = MAX_OUTPUT_LENGTH / 2;
    const head = text.slice(0, half);
    const tail = text.slice(-half);
    const omitted = text.length - MAX_OUTPUT_LENGTH;
    return `${head}\n\n...（已省略 ${omitted} 字符）...\n\n${tail}`;
}

export default {
    define: {
        name: "bash",
        description: "执行 Bash/Shell 命令。当需要做一些不能通过其他工具完成的事情时使用此工具。Windows 系统会使用 PowerShell 执行，其他系统直接执行。支持设置超时、工作目录。注意：能用 read_file、write_file、edit_file、grep、glob 等专用工具完成的操作，不要用此工具。",
        inputSchema: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "要执行的具体 Bash 指令，注意区分用户的操作系统"
                },
                timeout: {
                    type: "integer",
                    description: "命令执行超时时间（毫秒），默认 30000（30秒）。长耗时操作可适当增大，如 npm install 可设为 120000",
                    default: 30000
                },
                cwd: {
                    type: "string",
                    description: "命令执行的工作目录（绝对路径），默认为当前工作目录"
                }
            },
            required: ["command"]
        }
    },

    async handle({ command, timeout = DEFAULT_TIMEOUT, cwd }) {
        const platform = getPlatform();
        let finalCommand = command;

        if (platform === 'windows') {
            finalCommand = `chcp 65001 >nul && powershell -Command "${command}"`;
        }

        const execOptions = {
            encoding: 'utf8',
            timeout,
            maxBuffer: 1024 * 1024, // 1MB buffer 上限
        };
        if (cwd) {
            execOptions.cwd = cwd;
        }

        try {
            const { stdout, stderr } = await execAsync(finalCommand, execOptions);

            // 合并 stdout 和 stderr，并截断
            let combined = stdout;
            if (stderr) {
                combined += (combined ? '\n' : '') + `[stderr]\n${stderr}`;
            }

            const truncated = truncateOutput(combined);
            const truncationNote = truncated !== combined
                ? '\n\n⚠️ 输出过长，已截断。'
                : '';

            return `执行成功:\n${truncated}${truncationNote}`;
        } catch (error) {
            // 超时错误
            if (error.killed === true || error.signal === 'SIGTERM') {
                return `执行超时：命令在 ${timeout}ms 后被终止。\n${error.stdout ? '部分输出:\n' + truncateOutput(error.stdout) : ''}`;
            }
            // 命令执行失败（非零退出码），但仍可能有输出
            let errMsg = `执行失败: ${error.message}`;
            if (error.stdout) {
                errMsg += `\n[stdout]\n${truncateOutput(error.stdout)}`;
            }
            if (error.stderr) {
                errMsg += `\n[stderr]\n${truncateOutput(error.stderr)}`;
            }
            return errMsg;
        }
    }
};
