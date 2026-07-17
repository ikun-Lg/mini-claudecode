# mini-claudecode

> 一个最小化的 Claude Code CLI 实现 —— 运行在终端中的 AI 编程助手

基于 React + Ink 构建，接入 OpenAI 兼容 API，支持流式输出、工具调用、文件引用、斜杠指令、技能系统、规则匹配、记忆系统和 RAG 知识库。

## ✨ 功能特性

### 核心能力
- **流式对话** — 接入 OpenAI 兼容 API，逐字流式输出，实时感知回复进度
- **工具调用** — 内置 16+ 工具（文件读写、搜索、编辑、命令执行、记忆管理等），支持 MCP 协议扩展
- **多轮上下文** — 自动携带对话历史，保持上下文连贯
- **终端 Markdown 渲染** — 支持标题、加粗、斜体、行内代码、代码块、列表、引用

### AI 增强系统
- **斜杠指令（Commands）** — 内置 + 自定义指令模板，快速注入上下文
- **技能系统（Skills）** — 可扩展的能力模块，按需加载
- **规则匹配（Rules）** — 根据文件类型自动匹配编码规范
- **记忆系统（Memory）** — 项目级 + 用户级记忆，跨会话保持上下文
- **RAG 知识库** — 本地文档向量化检索，提供精准参考资料
- **自定义指令（Agent.md）** — 项目级和用户级自定义提示词

### 交互体验
- **文件引用** — `@文件路径` 引用项目文件，自动附加内容
- **指令补全** — 输入 `/` 弹出指令列表，`@` 弹出文件列表
- **历史对话** — 保存和切换历史对话
- **确认/选择交互** — 危险操作前确认，多选项时提供选择

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 10（开发）或 npm（安装使用）

### 安装

#### 方式一：全局安装（推荐）

```bash
npm install -g mini-claudecode
```

安装后会自动将 AI 增强内容（commands、skills、rules 等）复制到 `~/.minicode/` 目录。

#### 方式二：从源码安装

```bash
git clone https://github.com/ikun-Lg/mini-claudecode.git
cd mini-claudecode
pnpm install
```

### 配置

在用户目录 `~/.minicode/settings.json` 或项目目录 `.minicode/settings.json` 中配置：

```json
{
  "apiKey": "your-api-key",
  "baseURL": "https://api.openai.com/v1",
  "model": "gpt-4o-mini",
  "mcpServers": {}
}
```

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `apiKey` | API 密钥（必填） | — |
| `baseURL` | API 地址，兼容 OpenAI 接口的服务均可使用 | OpenAI 官方地址 |
| `model` | 模型名称 | `gpt-4o-mini` |
| `mcpServers` | MCP 服务器配置 | `{}` |

> **配置优先级**：项目目录 > 用户 Home 目录。在项目目录下放置配置可覆盖全局设置。

### 运行

```bash
# 全局安装后直接使用
minicode

# 从源码运行
pnpm start
```

## 🎮 使用方式

### 基本操作

| 操作 | 说明 |
| --- | --- |
| `输入文本 + Enter` | 发送消息 |
| `/` + `Tab` | 弹出指令列表 |
| `@文件路径` | 引用项目文件 |
| `↑↓` + `Enter` | 导航并选择建议项 |

### 内置指令

| 指令 | 说明 |
| --- | --- |
| `/help` | 显示可用指令帮助 |
| `/clear` | 清空对话历史 |
| `/model` | 查看当前使用的模型 |
| `/context` | 显示当前上下文摘要 |
| `/history` | 查看并切换历史对话 |
| `/code` | 附带项目结构概览作为上下文 |
| `/memory` | 生成记忆 — 调用大模型分析上下文并写入记忆 |
| `/vector` | 将本地文档向量化存入数据库 |
| `/exit` | 退出对话 |

### 自定义指令（斜杠指令）

在 `~/.minicode/commands/`（用户级）或 `.minicode/commands/`（项目级）下创建指令文件：

```
commands/
  commit/
    message.md      →  指令 /commit:message
  review/
    code.md         →  指令 /review:code
```

每个 `.md` 文件的内容会作为上下文注入到对话中。已内置的指令：

| 指令 | 说明 |
| --- | --- |
| `/commit:message` | 生成符合 Conventional Commits 规范的提交信息 |
| `/review:code` | 代码审查 — 按检查清单全面审查 |
| `/refactor:code` | 代码重构 — 安全地重构代码 |
| `/test:generate` | 生成测试代码 |
| `/doc:jsdoc` | 生成 JSDoc 注释 |
| `/debug:analyze` | Bug 分析与调试 |
| `/optimize:performance` | 性能优化分析 |
| `/explain:code` | 代码解释 |

### 技能系统（Skills）

在 `~/.minicode/skills/` 或 `.minicode/skills/` 下创建技能：

```
skills/
  code-review/
    SKILL.md         →  代码审查技能
  mygit/
    SKILL.md         →  Git 操作技能
```

每个 `SKILL.md` 包含 YAML frontmatter（`name`、`description`）和技能内容。AI 会根据用户意图自动匹配并加载技能。已内置的技能：

| 技能 | 说明 |
| --- | --- |
| `code-review` | 代码审查 — 按检查清单全面审查 |
| `mygit` | Git 操作 — 提交、分支、合并 |
| `refactor` | 代码重构 — 安全重构流程 |
| `testing` | 测试编写 — 测试设计和编写规范 |
| `debugging` | 调试 — 系统化 Bug 排查流程 |
| `documentation` | 文档编写 — README、API 文档、注释规范 |

### 规则匹配（Rules）

在 `~/.minicode/rules/` 或 `.minicode/rules/` 下创建规则文件，通过 YAML frontmatter 的 `paths` 字段匹配文件类型：

```yaml
---
paths:
  - "**/*.jsx"
  - "**/*.tsx"
---
# React 开发规范
...
```

当用户通过 `@` 引用文件时，匹配的规则会自动作为上下文注入。已内置的规则：

| 规则 | 匹配范围 |
| --- | --- |
| `code-style` | 所有代码文件 |
| `css` | CSS/Less/Sass 文件 |
| `git-convention` | Git 相关文件 |
| `naming` | 所有文件 |
| `security` | 代码和配置文件 |
| `react` | React/JSX/TSX 文件 |
| `nodejs` | JS/TS/MJS/CJS 文件 |
| `testing` | 测试文件 |

### 记忆系统

- **项目级记忆**：`.minicode/memory/memory.md` — 当前项目专属
- **用户级记忆**：`~/.minicode/memory/memory.md` — 所有项目共享
- 使用 `/memory` 指令让 AI 自动分析对话并更新记忆

### RAG 知识库

1. 将文档放在 `~/.minicode/doc/`（用户级）或 `.minicode/doc/`（项目级）
2. 支持 `.md`、`.txt`、`.docx` 格式
3. 执行 `/vector` 指令进行向量化
4. 后续对话中自动检索相关内容作为参考

## 📁 目录结构

### 项目目录

```
mini-claudecode/
├── bin/
│   └── minicode.js              # CLI 入口
├── src/
│   ├── app.js                   # 应用入口
│   ├── commands/index.js        # 斜杠指令注册与执行
│   ├── components/              # 终端 UI 组件（React + Ink）
│   ├── docs/                    # 系统提示词模板
│   ├── request/llm.js           # 大模型请求封装
│   ├── tools/                   # 工具模块（本地 + MCP）
│   └── utils/                   # 工具函数
├── scripts/
│   └── postinstall.js           # 安装后初始化脚本
├── templates/
│   └── .minicode/               # 可分发的 AI 增强内容
│       ├── commands/            # 斜杠指令模板
│       ├── skills/              # 技能模板
│       ├── rules/               # 规则模板
│       ├── agent.md             # 自定义指令模板
│       └── settings.example.json# 配置模板
├── models/                      # 内置 embedding 模型
└── package.json
```

### 用户目录（`~/.minicode/`）

安装后自动创建，用户可自由修改：

```
~/.minicode/
├── settings.json                # 用户级配置（API Key 等）
├── agent.md                     # 用户级自定义指令
├── commands/                    # 用户级斜杠指令
├── skills/                      # 用户级技能
├── rules/                       # 用户级规则
├── memory/
│   └── memory.md                # 用户级记忆
├── doc/                         # 用户级 RAG 文档
└── history/                     # 对话历史
```

### 项目级目录（`.minicode/`）

在项目根目录下创建，优先级高于用户级：

```
.minicode/
├── settings.json                # 项目级配置
├── agent.md                     # 项目级自定义指令
├── commands/                    # 项目级斜杠指令
├── skills/                      # 项目级技能
├── rules/                       # 项目级规则
├── memory/
│   └── memory.md                # 项目级记忆
└── doc/                         # 项目级 RAG 文档
```

## 🛠️ 技术栈

| 技术 | 用途 |
| --- | --- |
| [React](https://react.dev/) + [Ink](https://github.com/vadimdemedes/ink) | 终端 UI 框架 |
| [OpenAI SDK](https://github.com/openai/openai-node) | 大模型 API 调用 |
| [Model Context Protocol](https://modelcontextprotocol.io/) | MCP 工具协议 |
| [@huggingface/transformers](https://github.com/huggingface/transformers.js) | 本地 Embedding 模型 |
| [LanceDB](https://lancedb.github.io/lancedb/) | 向量数据库 |
| [Playwright](https://playwright.dev/) | 浏览器调试与截图 |
| [tsx](https://github.com/privatenumber/tsx) | ESM / JSX 直接运行 |

## 📦 发布

```bash
# 1. 更新版本号
npm version patch  # 或 minor / major

# 2. 发布到 npm
npm publish
```

发布后，用户通过 `npm install -g mini-claudecode` 安装时，`postinstall` 脚本会自动将 `templates/.minicode/` 中的 AI 增强内容复制到 `~/.minicode/`。

**非破坏性安装**：已存在的文件不会被覆盖。如需强制更新，可手动执行：

```bash
node node_modules/mini-claudecode/scripts/postinstall.js -f
```

## 📄 License

ISC
