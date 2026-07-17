# 生成 Git 提交信息

请帮我生成符合 Conventional Commits 规范的 Git 提交信息。

## 要求

1. 先用 `bash` 工具执行 `git status` 和 `git diff --cached` 查看暂存区的变更内容。如果没有暂存内容，先用 `git add` 添加相关文件。
2. 分析变更内容，确定 `type`：
   - `feat` — 新功能
   - `fix` — Bug 修复
   - `docs` — 文档变更
   - `style` — 代码格式调整（不影响功能）
   - `refactor` — 重构
   - `perf` — 性能优化
   - `test` — 新增/修改测试
   - `chore` — 构建/工具链/依赖变更
3. 生成提交信息，格式为 `<type>(<scope>): <subject>`：
   - `scope` 为影响范围（模块名/组件名），可选
   - `subject` 简明描述变更内容，不超过 50 字符，中文描述，不以句号结尾
4. 如果变更较复杂，补充 `body` 说明变更原因
5. 生成后，用 `confirm` 工具向用户确认是否执行提交
6. 用户确认后，用 `bash` 工具执行 `git commit`

## 示例

```
feat(chat): 添加流式输出支持

使用 OpenAI Streaming API 实现逐字输出效果，
提升用户交互体验。
```

```
fix(auth): 修复 Token 过期后未自动刷新的问题
```
