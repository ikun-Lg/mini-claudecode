---
paths:
  - "**/.gitignore"
  - "**/.git/**"
  - "**/.gitattributes"
  - "**/COMMIT_EDITMSG"
---

# Git 提交规范

当执行 Git 提交、分支操作或编写 commit message 时，请严格遵循以下规范：

## Commit Message 格式

使用 Conventional Commits 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type 类型

| type     | 说明                           |
| -------- | ------------------------------ |
| `feat`   | 新功能                         |
| `fix`    | 修复 Bug                       |
| `docs`   | 文档变更                       |
| `style`  | 代码格式调整（不影响功能）     |
| `refactor` | 重构（既不是新增功能也不是修复 Bug） |
| `perf`   | 性能优化                       |
| `test`   | 新增 / 修改测试                |
| `chore`  | 构建 / 工具链 / 依赖变更       |
| `ci`     | CI/CD 配置变更                 |
| `revert` | 回滚提交                       |

### scope（可选）

影响范围，如模块名、组件名。例如：`feat(auth): 添加 OAuth 登录`。

### subject

- 简明描述变更内容，不超过 50 字符。
- 使用中文描述。
- 不以句号结尾。

### body（可选）

- 详细说明变更原因和内容，每行不超过 72 字符。
- 解释「为什么」而非「做了什么」。

### footer（可选）

- 标注关联的 Issue：`Closes #123`、`Fixes #456`。
- 标注 BREAKING CHANGE：`BREAKING CHANGE: 用户认证接口参数变更`。

## 示例

```
feat(chat): 添加流式输出支持

使用 OpenAI Streaming API 实现逐字输出效果，
提升用户交互体验。移除了原有的完整响应等待逻辑。

Closes #42
```

```
fix(auth): 修复 Token 过期后未自动刷新的问题

Token 过期后请求会直接失败，现在添加了 401 自动刷新逻辑。
```

## 分支命名

- 功能分支：`feat/<描述>`，如 `feat/streaming-output`
- 修复分支：`fix/<描述>`，如 `fix/token-refresh`
- 热修分支：`hotfix/<描述>`，如 `hotfix/crash-on-startup`
- 发布分支：`release/<版本号>`，如 `release/v1.2.0`
