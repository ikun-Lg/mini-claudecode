---
paths:
  - "**/*.js"
  - "**/*.ts"
  - "**/*.mjs"
  - "**/*.cjs"
---

# Node.js 开发规范

当编写 Node.js 后端代码或工具脚本时，请严格遵循以下规范：

## 模块系统

1. **ESM 优先**：新项目使用 ESM（`import/export`），`package.json` 设置 `"type": "module"`。
2. **不混用**：同一项目不混用 ESM 和 CommonJS，如需兼容用 `.mjs`/`.cjs` 扩展名区分。
3. **绝对路径**：import 路径不带扩展名时注意 ESM 要求带扩展名（`.js`/`.jsx`），或使用构建工具处理。

## 异步编程

1. **async/await 优先**：不使用 `.then().catch()` 链，用 `async/await` + `try/catch`。
2. **不阻塞事件循环**：CPU 密集型任务用 `worker_threads` 或拆分为异步块。
3. **并行执行**：无依赖的异步操作用 `Promise.all` 并行，不串行 await：
   ```javascript
   // ✅ 并行
   const [users, posts] = await Promise.all([fetchUsers(), fetchPosts()]);
   // ❌ 串行
   const users = await fetchUsers();
   const posts = await fetchPosts();
   ```
4. **错误传播**：async 函数中的错误会自动变成 rejected Promise，确保上层有 catch。

## 文件操作

1. **异步 I/O 优先**：使用 `fs/promises`（`fs.readFile`）而非同步方法（`fs.readFileSync`），除非在启动阶段。
2. **流式处理**：大文件用 Stream 处理，避免一次性读入内存：
   ```javascript
   const readStream = fs.createReadStream('large.json');
   const writeStream = fs.createWriteStream('output.json');
   readStream.pipe(writeStream);
   ```
3. **路径拼接**：使用 `path.join()` / `path.resolve()`，不手动拼接字符串。
4. **目录创建**：写入文件前用 `fs.mkdir(dir, { recursive: true })` 确保目录存在。

## 环境变量

1. **不硬编码**：端口、数据库连接、API Key 等通过环境变量管理。
2. **`.env` 文件**：使用 `dotenv` 加载 `.env` 文件，`.env` 加入 `.gitignore`。
3. **提供模板**：提供 `.env.example` 列出所有需要的环境变量。
4. **类型转换**：环境变量是字符串，数字需要 `parseInt`/`Number` 转换：
   ```javascript
   const port = parseInt(process.env.PORT, 10) || 3000;
   ```

## 错误处理

1. **全局兜底**：
   ```javascript
   process.on('unhandledRejection', (err) => {
     console.error('Unhandled Rejection:', err);
   });
   process.on('uncaughtException', (err) => {
     console.error('Uncaught Exception:', err);
     process.exit(1);
   });
   ```
2. **中间件错误处理**：Express/Koa 中间件用专门的错误处理中间件捕获错误。
3. **错误分类**：区分客户端错误（4xx）和服务端错误（5xx），返回合适的 HTTP 状态码。
4. **不暴露内部错误**：生产环境不把堆栈信息返回给客户端。

## 安全规范

1. **依赖审计**：定期 `npm audit` 检查已知漏洞。
2. **输入校验**：使用 `zod` / `joi` / `express-validator` 校验请求参数。
3. ** Helmet**：Web 服务使用 `helmet` 设置安全 HTTP 头。
4. **CORS**：明确指定允许的来源，不使用 `*`。
5. **限流**：API 接口使用 `express-rate-limit` 等做限流防刷。

## 日志

1. **不用 console**：生产环境使用日志库（`pino` / `winston`），不用 `console.log`。
2. **分级日志**：使用 `debug` / `info` / `warn` / `error` 级别。
3. **结构化日志**：输出 JSON 格式日志，便于日志系统采集和分析。
4. **请求日志**：记录请求方法、路径、状态码、耗时，不记录敏感信息。
