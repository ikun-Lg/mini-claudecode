---
paths:
  - "**/*.test.js"
  - "**/*.test.jsx"
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.js"
  - "**/*.spec.jsx"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/__tests__/**"
  - "**/test/**"
  - "**/tests/**"
---

# 测试代码规范

当编写测试代码时，请严格遵循以下规范：

## 测试组织

1. **AAA 模式**：每个测试用例按 Arrange-Act-Assert 三段式组织，用空行或注释分隔。
2. **describe 分组**：按被测对象或功能模块用 `describe` 分组，嵌套不超过 3 层。
3. **单一断言**：每个 `it` 聚焦一个行为点，避免一个测试中堆砌过多断言。
4. **独立性**：测试之间不依赖执行顺序，不共享可变状态。每个测试自行准备和清理数据。

## 命名规范

- **文件名**：`<被测文件名>.test.js` 或 `<被测文件名>.spec.js`
- **describe**：用被测对象名，如 `describe('UserService', () => {})`
- **it/test**：用 `should + 预期行为 + 条件` 格式：
  ```javascript
  it('should return user when id exists', () => {});
  it('should throw error when id is negative', () => {});
  it('should return empty array when no results', () => {});
  ```

## 断言规范

1. **语义化断言**：使用语义化的断言方法，而非通用断言：
   ```javascript
   // ✅ 语义化
   expect(result).toBeNull();
   expect(array).toHaveLength(3);
   expect(fn).toThrow('Invalid input');

   // ❌ 通用
   expect(result === null).toBe(true);
   expect(array.length).toBe(3);
   ```
2. **断言消息**：复杂断言添加自定义消息便于定位失败原因。
3. **不测试实现细节**：测试公共 API 的行为，不测试私有函数和内部状态。

## Mock 规范

1. **Mock 边界**：Mock 外部依赖（网络、文件系统、数据库），不 Mock 被测代码。
2. **恢复 Mock**：每个测试后恢复 Mock，避免影响其他测试：
   ```javascript
   afterEach(() => {
     jest.restoreAllMocks();
     vi.restoreAllMocks();
   });
   ```
3. **Mock 贴近真实**：Mock 返回值尽量贴近真实数据结构，避免 Mock 导致测试无效。
4. **避免过度 Mock**：如果 Mock 太多，说明被测代码耦合度过高，考虑先重构。

## 测试数据

1. **工厂函数**：用工厂函数生成测试数据，避免每个测试重复构造：
   ```javascript
   function createUser(overrides = {}) {
     return { id: 1, name: 'Alice', email: 'alice@test.com', ...overrides };
   }
   ```
2. **有意义的数据**：测试数据用有意义的值，不用 `test`、`foo`、`123` 等无意义值。
3. **不依赖随机**：测试不用 `Math.random()` 或 `Date.now()` 生成数据，保持确定性。

## 异步测试

1. **async/await**：异步测试用 `async/await`，不用回调或 `.then()`。
2. **超时设置**：长时间运行的测试设置合理的超时时间。
3. ** rejection 测试**：
   ```javascript
   it('should throw on invalid input', async () => {
     await expect(fn(-1)).rejects.toThrow('Invalid input');
   });
   ```

## 测试覆盖

| 维度       | 必须覆盖                     |
| ---------- | ---------------------------- |
| 正常路径   | ✅ 典型输入的正确输出        |
| 边界值     | ✅ 空值、零值、最大/最小值   |
| 异常输入   | ✅ 非法类型、格式错误        |
| 错误处理   | ✅ 错误是否正确抛出          |
| 副作用     | ✅ 对外部状态的影响          |
