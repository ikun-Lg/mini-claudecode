---
paths:
  - "**/*"
---

# 文件命名规范

当创建新文件或重命名文件时，请严格遵循以下规范：

## 基本原则

- 文件名使用小写字母，单词间用连字符 `-` 分隔（kebab-case）。
- 不使用中文、空格、大写字母（除特定框架约定外）。
- 文件名应能表达文件内容或用途，避免使用 `util`、`helper`、`common` 等模糊名称，除非确实是通用工具集合。

## 前端文件

| 类型         | 命名规则          | 示例                    |
| ------------ | ----------------- | ----------------------- |
| React 组件   | `PascalCase.jsx`  | `MessageBubble.jsx`     |
| 组件目录     | `kebab-case/`     | `user-profile/`         |
| 样式文件     | `kebab-case.css`  | `message-bubble.css`    |
| 工具函数     | `camelCase.js`    | `fsHandle.js`           |
| 常量文件     | `kebab-case.js`   | `api-endpoints.js`      |
| 类型定义     | `kebab-case.d.ts` | `user-types.d.ts`       |
| 页面 / 路由  | `kebab-case.jsx`  | `user-settings.jsx`     |
| Hook         | `useXxx.js`       | `useAuth.js`            |

## 后端文件

| 类型         | 命名规则           | 示例                    |
| ------------ | ------------------ | ----------------------- |
| 控制器       | `xxxController.js` | `userController.js`     |
| 服务层       | `xxxService.js`    | `authService.js`       |
| 路由         | `xxxRoutes.js`     | `userRoutes.js`        |
| 中间件       | `xxxMiddleware.js` | `authMiddleware.js`    |
| 数据模型     | `xxxModel.js`      | `userModel.js`         |
| 配置文件     | `kebab-case.js`    | `database-config.js`   |

## 其他语言

| 语言     | 命名规则               | 示例                    |
| -------- | ---------------------- | ----------------------- |
| Python   | `snake_case.py`        | `user_service.py`       |
| Go       | `snake_case.go`        | `user_service.go`       |
| Rust     | `snake_case.rs`        | `user_service.rs`       |
| Java     | `PascalCase.java`      | `UserService.java`      |

## 目录命名

- 目录名使用 `kebab-case`，如 `components/`、`user-profile/`、`api-middlewares/`。
- 目录名使用名词或名词短语，不使用动词。
- 避免超过 3 层的目录嵌套。

## 特殊文件

| 文件                  | 说明                          |
| --------------------- | ----------------------------- |
| `index.js`            | 目录入口文件，只做导出        |
| `README.md`           | 目录 / 项目说明文档           |
| `.env.example`        | 环境变量模板                  |
| `.gitignore`          | Git 忽略规则                  |
| `package.json`        | 项目配置                      |
