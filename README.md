# mini-claudecode

> 一个最小化的 Claude Code CLI 实现 —— 运行在终端中的 AI 编程对话助手

基于 React + Ink 构建，接入 OpenAI 兼容 API，支持流式输出和终端 Markdown 渲染。

## ✨ 功能特性

- **流式对话** — 接入 OpenAI 兼容 API，逐字流式输出，实时感知回复进度
- **多轮上下文** — 自动携带对话历史，保持上下文连贯
- **终端 Markdown 渲染** — 支持标题、加粗、斜体、行内代码、代码块、列表、引用
- **渐变 Logo** — ASCII 艺术字 + 蓝色渐变效果
- **消息气泡** — 用户（▎绿色）与助手（●蓝色）角色区分，带续行导轨
- **状态栏** — 实时显示模型名、消息计数、工作目录、思考状态
- **灵活配置** — 通过 `.mincode/settings.json` 管理配置，支持工作目录级与用户级优先级
- **交互命令** — `/exit` 退出，`/clear` 清空历史

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 10

### 安装

```bash
git clone https://github.com/ikun-Lg/mini-claudecode.git
cd mini-claudecode
pnpm install
```

### 配置

在项目根目录或用户 Home 目录下创建 `.mincode/settings.json`：

```json
{
  "apiKey": "your-api-key",
  "baseURL": "https://api.deepseek.com",
  "model": "deepseek-v4-flash"
}
```

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `apiKey` | API 密钥（必填） | — |
| `baseURL` | API 地址，兼容 OpenAI 接口的服务均可使用 | OpenAI 官方地址 |
| `model` | 模型名称 | `gpt-4o-mini` |

> **配置优先级**：当前工作目录 > 用户 Home 目录。在项目目录下放置配置可覆盖全局设置，实现多项目隔离。

### 运行

```bash
pnpm start
```

启动后将看到欢迎横幅，直接输入消息按 Enter 即可开始对话。

## 🎮 使用方式

| 命令 | 说明 |
| --- | --- |
| `输入文本 + Enter` | 发送消息 |
| `/exit` | 退出对话 |
| `/clear` | 清空对话历史并清除屏幕 |

## 🏗️ 项目结构

```
mini-claudecode/
├── src/
│   ├── app.js                      # 应用入口，挂载 Ink 应用
│   ├── components/
│   │   ├── App.jsx                 # 主对话组件（状态管理 + 流式接收）
│   │   ├── Banner.jsx              # 欢迎横幅（ASCII Logo + 命令提示）
│   │   ├── MessageBubble.jsx       # 消息气泡（Markdown 解析与渲染）
│   │   ├── StatusBar.jsx           # 底部状态栏
│   │   └── theme.js                # 统一调色板 & 字符符号
│   ├── request/
│   │   └── llm.js                  # 大模型请求模块（客户端工厂 + 流式对话）
│   └── utils/
│       └── pathUtils.js            # 路径工具（Home 目录 / 工作目录）
├── .mincode/
│   └── settings.json               # 本地配置文件
└── package.json
```

## 🛠️ 技术栈

| 技术 | 用途 |
| --- | --- |
| [React](https://react.dev/) + [Ink](https://github.com/vadimdemedes/ink) | 终端 UI 框架 |
| [OpenAI SDK](https://github.com/openai/openai-node) | 大模型 API 调用 |
| [ink-text-input](https://github.com/vadimdemedes/ink-text-input) | 终端文本输入 |
| [ink-spinner](https://github.com/vadimdemedes/ink-spinner) | 加载动画 |
| [tsx](https://github.com/privatenumber/tsx) | TypeScript / ESM 直接运行 |
| [pnpm](https://pnpm.io/) | 包管理 |

## 📄 License

ISC
