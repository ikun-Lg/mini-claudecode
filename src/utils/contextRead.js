// 上下文读取模块：加载系统提示词并替换模板变量
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { getCurrentWorkingDir, getUserHomeDir } from "./pathUtils.js";

/**
 * 获取系统信息描述字符串
 * @returns {string}
 */
function getSystemInfo() {
  const platform = process.platform;
  const arch = process.arch;
  const release = os.release();
  const platformName =
    platform === "darwin"
      ? "macOS"
      : platform === "win32"
        ? "Windows"
        : platform === "linux"
          ? "Linux"
          : platform;
  return `${platformName} ${release} (${arch})`;
}

/**
 * 读取系统提示词上下文
 *
 * 读取 src/docs/systemDoc.md 文件内容，替换其中的模板变量：
 *   - ${systemInfo} → 当前操作系统信息（如 "macOS 24.5.0 (arm64)"）
 *   - ${workPath}   → 用户当前的工作目录
 *
 * 读取失败时返回空字符串
 *
 * @returns {string} 替换后的系统提示词
 */
export function readSystemContext() {
  // 定位 src/docs/systemDoc.md
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const docPath = path.join(__dirname, "..", "docs", "systemDoc.md");

  try {
    let content = fs.readFileSync(docPath, "utf-8");
    // 替换模板变量
    content = content
      .replace(/\$\{systemInfo\}/g, getSystemInfo())
      .replace(/\$\{workPath\}/g, getCurrentWorkingDir());
    return content;
  } catch {
    return "";
  }
}

/**
 * 读取用户上下文
 *
 * 读取 src/docs/userContext.md 模板，然后：
 *   1. 读取用户 home 目录下 ~/.minicode/agent.md，替换 ${userPath} 和 ${userContent}
 *   2. 读取当前工作目录下 .minicode/agent.md，替换 ${projectPath} 和 ${projectContent}
 *
 * 如果对应文件不存在，则该组变量均替换为空字符串
 *
 * @returns {string} 替换后的用户上下文
 */
export function getUserContext() {
  // 定位 src/docs/userContext.md 模板
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const templatePath = path.join(__dirname, "..", "docs", "userContext.md");

  let template;
  try {
    template = fs.readFileSync(templatePath, "utf-8");
  } catch {
    return "";
  }

  // ── 读取用户级 agent.md (~/.minicode/agent.md) ──
  const userAgentPath = path.join(getUserHomeDir(), ".minicode", "agent.md");
  let userAgentPathStr = "";
  let userAgentContent = "";
  try {
    userAgentPathStr = userAgentPath;
    userAgentContent = fs.readFileSync(userAgentPath, "utf-8");
  } catch {
    // 文件不存在，保持空字符串
  }

  // ── 读取项目级 agent.md (<工作目录>/.minicode/agent.md) ──
  const projectAgentPath = path.join(
    getCurrentWorkingDir(),
    ".minicode",
    "agent.md",
  );
  let projectAgentPathStr = "";
  let projectAgentContent = "";
  try {
    projectAgentPathStr = projectAgentPath;
    projectAgentContent = fs.readFileSync(projectAgentPath, "utf-8");
  } catch {
    // 文件不存在，保持空字符串
  }

  // 替换模板变量
  return template
    .replace(/\$\{userPath\}/g, userAgentPathStr)
    .replace(/\$\{userContent\}/g, userAgentContent)
    .replace(/\$\{projectPath\}/g, projectAgentPathStr)
    .replace(/\$\{projectContent\}/g, projectAgentContent);
}
