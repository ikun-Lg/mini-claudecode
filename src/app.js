#!/usr/bin/env node

// 整个项目的启动入口
import React from "react";
import { render } from "ink";
import App from "./components/App.jsx";
import { saveHistoryOnExit } from "./utils/fsHandle.js";
import { validateConfig } from "./request/llm.js";

// #10 启动时校验 API Key 配置，缺失时给出友好提示而非崩溃退出
const configCheck = validateConfig();
if (!configCheck.valid) {
  console.log("\n  \x1b[31m✗\x1b[0m \x1b[90mmini-claudecode\x1b[0m\n");
  console.log("  \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");
  console.log(`  \x1b[33m⚠ ${configCheck.message}\x1b[0m\n`);
  console.log("  \x1b[90m示例配置：\x1b[0m");
  console.log('  \x1b[90m{\n    "apiKey": "sk-xxx",\n    "baseURL": "https://api.openai.com/v1",\n    "model": "gpt-4o-mini"\n  }\x1b[0m\n');
  console.log("  \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");
  process.exit(1);
}

// 渲染 Ink 应用
const instance = render(React.createElement(App));

// 应用退出后：先保存对话历史，再打印告别信息
instance.waitUntilExit().then(() => {
  // Ink 已完全卸载，此时同步写入历史文件
  const result = saveHistoryOnExit();
  if (result.success) {
    console.log(`\n  \x1b[90m对话历史已保存: ${result.filePath}\x1b[0m`);
  }

  console.log("\n  \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");
  console.log(
    "  \x1b[34m●\x1b[0m \x1b[90mmini-claudecode\x1b[0m \x1b[90m·\x1b[0m \x1b[32m再见！\x1b[0m \x1b[35m👋\x1b[0m\n",
  );
  console.log("  \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");
});
