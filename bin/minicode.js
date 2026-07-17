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
const child = spawn("npx", ["tsx", appPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: resolve(__dirname, ".."),
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
