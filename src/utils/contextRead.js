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

/**
 * 解析 .md 文件中的 YAML frontmatter，提取匹配规则和正文内容
 *
 * frontmatter 格式示例（paths 字段为 glob 匹配规则数组）：
 *   以 --- 开始和结束，中间每行一个路径匹配项
 *
 * @param {string} raw - 文件原始内容
 * @returns {{ rules: string[], content: string }}
 *   rules 为匹配规则数组（无 frontmatter 时为空数组），content 为正文内容
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { rules: [], content: raw };
  }

  const frontmatter = match[1];
  const content = match[2];

  // 简易解析 paths 字段（不引入额外 YAML 库）
  const rules = [];
  const lines = frontmatter.split("\n");
  let inPaths = false;
  for (const line of lines) {
    // 匹配 paths: 行
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      continue;
    }
    // 在 paths 块中，匹配列表项
    if (inPaths) {
      const itemMatch = line.match(/^\s+-\s+['"]?(.*?)['"]?\s*$/);
      if (itemMatch) {
        rules.push(itemMatch[1]);
      } else {
        // 非列表项，paths 块结束
        inPaths = false;
      }
    }
  }

  return { rules, content };
}

/**
 * 扫描指定 rules 目录下的所有 .md 文件
 *
 * @param {string} rulesDir - rules 目录的绝对路径
 * @returns {Map<string, { rules: string[], content: string }>}
 *   文件名（不含扩展名）→ { rules: 匹配规则, content: 正文内容 } 的映射
 */
function scanRulesDir(rulesDir) {
  const map = new Map();

  let entries;
  try {
    entries = fs.readdirSync(rulesDir, { withFileTypes: true });
  } catch {
    // 目录不存在或不可读，返回空 Map
    return map;
  }

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".md")) continue;

    const ruleName = entry.name.slice(0, -3); // 去掉 .md 后缀
    const filePath = path.join(rulesDir, entry.name);

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const { rules, content } = parseFrontmatter(raw);
      map.set(ruleName, { rules, content });
    } catch {
      // 读取失败，跳过该文件
    }
  }

  return map;
}

/**
 * 读取所有规则文件
 *
 * 从两个位置加载 rules 目录下的 .md 文件：
 *   1. 用户 home 目录：~/.minicode/rules/
 *   2. 当前项目目录：  .minicode/rules/
 *
 * 返回一个 Map 对象，key 为文件名（不含 .md 扩展名），
 * value 为 { rules: string[], content: string }。
 * 当两个位置存在同名文件时，项目级规则覆盖用户级规则。
 *
 * @returns {Map<string, { rules: string[], content: string }>}
 *   规则名 → { rules: 匹配规则数组, content: 正文内容 }
 */
export function readRules() {
  const userRulesDir = path.join(getUserHomeDir(), ".minicode", "rules");
  const projectRulesDir = path.join(
    getCurrentWorkingDir(),
    ".minicode",
    "rules",
  );

  // 先加载用户级规则，再加载项目级规则（项目级覆盖同名）
  const userRules = scanRulesDir(userRulesDir);
  const projectRules = scanRulesDir(projectRulesDir);

  // 合并：项目级覆盖用户级同名规则
  const merged = new Map(userRules);
  for (const [name, value] of projectRules) {
    merged.set(name, value);
  }

  return merged;
}

/**
 * 将 glob 模式转换为正则表达式
 *
 * 支持的通配符：
 *   双星号 — 匹配任意层级的目录（包括零层）
 *   单星号 — 匹配单层内的任意字符（不含路径分隔符）
 *   问号  — 匹配单个字符（不含路径分隔符）
 *
 * @param {string} pattern - glob 模式字符串
 * @returns {RegExp} 对应的正则表达式
 */
function globToRegex(pattern) {
  let regex = "";
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      i += 2;
      if (pattern[i] === "/") {
        // **/ → (?:.*/)?  匹配零或多个目录层级
        regex += "(?:.*/)?";
        i++;
      } else {
        // ** → .*  匹配任意内容
        regex += ".*";
      }
    } else if (char === "*") {
      // * → [^/]*  匹配单层内的任意字符
      regex += "[^/]*";
      i++;
    } else if (char === "?") {
      regex += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(char)) {
      regex += "\\" + char;
      i++;
    } else {
      regex += char;
      i++;
    }
  }
  return new RegExp("^" + regex + "$");
}

/**
 * 根据用户 @ 引用的文件路径列表，匹配 rulesMap 中的规则
 *
 * 遍历 rulesMap，对每个规则检查其 rules 数组中的 glob 模式是否能匹配
 * 任意一个用户引用的文件路径。匹配上的规则的 content 会被合并返回。
 *
 * @param {Map<string, { rules: string[], content: string }>} rulesMap
 *   规则映射表（由 readRules() 返回）
 * @param {string[]} filePaths - 用户 @ 引用的文件路径列表
 * @returns {{ matchedContents: string, matchedRuleNames: string[] }}
 *   matchedContents 为匹配上的规则内容合并字符串，matchedRuleNames 为匹配上的规则名列表
 */
export function matchRules(rulesMap, filePaths) {
  const matchedRuleNames = [];
  const matchedContents = [];

  for (const [ruleName, ruleData] of rulesMap) {
    const { rules, content } = ruleData;
    if (!rules || rules.length === 0) continue;

    // 预编译该规则的所有 glob 模式为正则
    const regexes = rules.map((p) => globToRegex(p));

    // 检查是否有任一文件路径匹配该规则的任一模式
    const isMatched = filePaths.some((filePath) =>
      regexes.some((re) => re.test(filePath)),
    );

    if (isMatched) {
      matchedRuleNames.push(ruleName);
      matchedContents.push(`--- 规则: ${ruleName} ---\n${content}`);
    }
  }

  return {
    matchedContents: matchedContents.join("\n\n"),
    matchedRuleNames,
  };
}
