#!/usr/bin/env node

// minicode CLI 入口
// 使用 tsx 运行 app.js，以支持 JSX 和 ESM 语法
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appPath = resolve(__dirname, "../src/app.js");

// 使用 tsx 运行主应用
// Windows 上 npx 是 npx.cmd，spawn 默认不经过 shell，无法找到 .cmd 文件，
// 会报 spawn npx ENOENT。因此 Windows 下需要 shell: true。
const child = spawn("npx", ["tsx", appPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: resolve(__dirname, ".."),
  shell: process.platform === "win32",
});

// 监听 spawn 错误（如 npx 不存在），避免抛出 unhandled error 事件
child.on("error", (err) => {
  console.error(`\x1b[31m✗ 启动失败\x1b[0m：${err.message}`);
  console.error(
    `\x1b[90m请确认 npx 可用（通常随 npm 自带）。可运行 \x1b36mnpx --version\x1b[0m \x1b[90m检查。\x1b[0m`
  );
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
