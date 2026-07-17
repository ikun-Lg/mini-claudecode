// bash 工具（#8 改造：流式输出 + Windows 命令安全）
//
// 改进点：
//   1. 用 spawn 替代 exec，实现 stdout/stderr 实时流式输出
//   2. Windows 下不再用字符串拼接 PowerShell 命令（避免注入），
//      改用 -EncodedCommand 传递 Base64 编码的 UTF-16LE 命令
//   3. 保留超时、输出截断等原有逻辑
import { spawn } from 'child_process';
import os from 'os';

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

/**
 * #8 Windows 下将 PowerShell 命令编码为 Base64（UTF-16LE），
 * 避免字符串拼接导致的引号嵌套注入问题
 */
function encodePowerShellCommand(command) {
    const buf = Buffer.from(command, 'utf16le');
    return buf.toString('base64');
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

        const execOptions = {
            encoding: 'utf8',
            timeout,
            // 使用 pipe 而非 ignore，确保能拿到输出
            stdio: ['pipe', 'pipe', 'pipe'],
        };
        if (cwd) {
            execOptions.cwd = cwd;
        }

        return new Promise((resolve) => {
            let child;
            let stdout = '';
            let stderr = '';

            if (platform === 'windows') {
                // #8 Windows: 用 -EncodedCommand 传递 Base64 编码命令，避免注入
                const encoded = encodePowerShellCommand(command);
                child = spawn(
                    'powershell.exe',
                    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
                    execOptions
                );
            } else {
                // macOS/Linux: 通过 shell 执行
                child = spawn('sh', ['-c', command], execOptions);
            }

            // #8 流式收集 stdout/stderr
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            // 超时处理
            const timer = setTimeout(() => {
                try { child.kill('SIGTERM'); } catch { /* 已退出 */ }
            }, timeout);

            child.on('error', (err) => {
                clearTimeout(timer);
                resolve(`执行失败: ${err.message}`);
            });

            child.on('close', (code) => {
                clearTimeout(timer);

                // 合并 stdout 和 stderr，并截断
                let combined = stdout;
                if (stderr) {
                    combined += (combined ? '\n' : '') + `[stderr]\n${stderr}`;
                }

                const truncated = truncateOutput(combined);
                const truncationNote = truncated !== combined
                    ? '\n\n⚠️ 输出过长，已截断。'
                    : '';

                if (code === 0) {
                    resolve(`执行成功:\n${truncated}${truncationNote}`);
                } else if (code === null || child.killed) {
                    // 被信号终止（超时）
                    resolve(`执行超时：命令在 ${timeout}ms 后被终止。\n${stdout ? '部分输出:\n' + truncateOutput(stdout) : ''}`);
                } else {
                    let errMsg = `执行失败（退出码 ${code}）`;
                    if (truncated) {
                        errMsg += `\n${truncated}`;
                    }
                    resolve(errMsg + truncationNote);
                }
            });
        });
    }
};
