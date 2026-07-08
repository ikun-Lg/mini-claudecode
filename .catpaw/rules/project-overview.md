---
ruleType: Manual
description: mini-claudecode 项目结构与开发规范，指导 AI 理解项目架构、目录职责和编码约定
globs:
---

rule编写规则: https://catpaw.meituan.com/guides/settings/rules

# 项目概览

mini-claudecode 是一个类似 Claude Code 的最小化 CLI 助手实现。该项目运行后，可在终端启动，辅助用户进行代码开发。项目

## 项目技术栈

- **ES Modules**：通过 `import/export` 语法，而非 `require/module.exports`
- **pnpm**：安装依赖时使用 `pnpm install`
- **JavaScript**：使用JavaScript语言进行开发
- **node**：使用 nodejs配合node的一些库进行开发
- **openai**: 请求大模型接口用的是openai

## 入口文件

项目启动入口为 [src/app.js](md:src/app.js)。

## 目录结构

项目源码位于 `src/` 目录下，各子目录职责如下：

| 目录           | 职责                                                    |
| -------------- | ------------------------------------------------------- |
| `src/`         | 项目根源码目录，项目的代码存放处，包含入口文件 `app.js` |
| `app.js`       | 项目的启动文件，通过运行该文件启动项目                  |
| `src/doc/`     | 项目携带给大模型接口的文档模板放在这里                  |
| `src/request/` | API 请求处理（如与 LLM 服务的通信）                     |
| `src/tool/`    | 工具实现（如文件读写、命令执行等 Agent 工具）           |
| `src/utils/`   | 项目代码中需要使用的通用工具函数                        |

## 编码约定

- 使用 **ES Modules**：通过 `import/export` 语法，而非 `require/module.exports`
- 包管理器为 **pnpm**（`packageManager: pnpm@10.30.0`），安装依赖时使用 `pnpm install`
- JavaScript 文件使用 `.js` 扩展名
- 代码注释使用中文
- 请注意扫描`package.json`,如果没有安装的包，使用pnpm install安装
