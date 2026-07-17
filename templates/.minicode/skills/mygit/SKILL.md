---
name: mygit-skill
description: 当用户让你进行 git 提交、分支管理等操作时，遵循此 skill 的规则
---

# Git 操作技能

当用户要求执行 Git 相关操作（提交、分支、合并等）时，严格按本技能执行。

## 提交流程

### 1. 查看变更
用 `bash` 工具执行以下命令，了解当前变更：
```bash
git status
git diff --cached --stat
```

### 2. 暂存文件
如果有未暂存的文件，用 `git add` 添加：
- 添加全部变更：`git add -A`
- 添加指定文件：`git add <文件路径>`
- 交互式添加：`git add -p`（不推荐在自动化中使用）

**注意**：检查是否有不应提交的文件（如 `.env`、`node_modules`、构建产物）。如果有，提醒用户先加入 `.gitignore`。

### 3. 生成提交信息
分析 `git diff --cached` 的内容，生成符合 Conventional Commits 规范的提交信息：

格式：`<type>(<scope>): <subject>`

**type 选择**：
| type       | 使用场景                         |
| ---------- | -------------------------------- |
| `feat`     | 新增功能                         |
| `fix`      | 修复 Bug                         |
| `docs`     | 文档变更（README、注释等）       |
| `style`    | 代码格式调整（不影响功能）       |
| `refactor` | 重构（不改功能也不修 Bug）       |
| `perf`     | 性能优化                         |
| `test`     | 新增或修改测试                   |
| `chore`    | 构建、工具链、依赖变更           |
| `ci`       | CI/CD 配置变更                   |
| `revert`   | 回滚之前的提交                   |

**规则**：
- `subject` 用中文描述，不超过 50 字符，不以句号结尾
- 变更较复杂时补充 `body`，每行不超过 72 字符
- 有关联 Issue 时在 `footer` 标注：`Closes #123`

### 4. 确认并提交
- 用 `confirm` 工具向用户展示生成的提交信息，等待确认
- 用户确认后执行 `git commit -m "<信息>"`
- 提交后用 `git log -1 --oneline` 确认提交成功

## 分支操作

### 创建分支
```
功能分支：feat/<描述>     如 feat/streaming-output
修复分支：fix/<描述>      如 fix/token-refresh
热修分支：hotfix/<描述>   如 hotfix/crash-on-startup
```

### 合并分支
1. 先切换到目标分支：`git checkout main`
2. 拉取最新代码：`git pull`
3. 合并：`git merge --no-ff <分支名>`（保留合并记录）
4. 如有冲突，逐一解决后 `git add` + `git commit`

## 禁止事项

- ❌ 不提交 `.env`、密钥文件、Token 等敏感信息
- ❌ 不提交 `node_modules`、构建产物、临时文件
- ❌ 不使用 `git push --force` 到主分支（main/master）
- ❌ 不在提交信息中使用模糊描述（如 "update"、"fix bug"、"修改"）
