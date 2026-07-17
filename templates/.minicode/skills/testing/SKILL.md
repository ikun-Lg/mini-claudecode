---
name: testing-skill
description: 当用户要求编写测试、生成测试用例时，遵循此 skill 的规则
---

# 测试编写技能

当用户要求编写测试时，严格按本技能执行，确保测试质量。

## 前置检查

1. **确认测试框架**：查看 `package.json` 的 `devDependencies`，使用项目已有的测试框架
   - Jest / Vitest / Mocha+Chai / Node.js 内置 `node:test`
2. **确认测试目录**：检查项目现有的测试文件位置
   - `test/` / `tests/` / `__tests__/` / `src/**/*.test.js` / `src/**/*.spec.js`
3. **确认测试命令**：查看 `package.json` 的 `scripts.test`

## 测试设计

### 测试金字塔
```
        /\
       /E2E\         少量，验证完整业务流程
      /------\
     / 集成测试 \     适中，验证模块间协作
    /------------\
   /   单元测试    \   大量，验证单个函数/组件
  /----------------\
```
优先编写单元测试，其次是集成测试，E2E 测试按需补充。

### 用例覆盖维度

| 维度       | 说明                                     | 示例                           |
| ---------- | ---------------------------------------- | ------------------------------ |
| 正常路径   | 典型输入下的正确输出                     | `add(1, 2)` → `3`              |
| 边界值     | 空值、零值、最大/最小值                  | `add(0, 0)` → `0`              |
| 异常输入   | 非法类型、格式错误                       | `add(null, 2)` → 抛出错误      |
| 错误处理   | 验证错误是否正确抛出                     | `add('a', 'b')` → `TypeError`  |
| 副作用     | 验证对外部状态的影响                     | 写文件后文件内容正确           |

### 命名规范

```javascript
describe('UserService', () => {
  describe('create', () => {
    it('should create user with valid data', () => {});
    it('should throw error when email is invalid', () => {});
    it('should return null when user not found', () => {});
  });
});
```

- `describe` 用被测对象名
- `it` 用 `should + 预期行为 + 条件` 格式

## 编写规范

### Arrange-Act-Assert
```javascript
it('should calculate total price', () => {
  // Arrange
  const items = [
    { name: 'book', price: 10, qty: 2 },
    { name: 'pen', price: 5, qty: 3 },
  ];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(35);
});
```

### Mock 规范
- Mock 外部依赖（网络请求、文件系统、数据库），不 Mock 被测代码本身
- Mock 尽量贴近真实行为
- 每个测试后恢复 Mock（`afterEach(() => jest.restoreAllMocks())`）

### 异步测试
```javascript
// Promise
it('should fetch user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
});

// 异常
it('should throw on invalid id', async () => {
  await expect(fetchUser(-1)).rejects.toThrow('Invalid id');
});
```

## 执行步骤

1. 阅读被测代码，理解功能和接口
2. 设计测试用例清单（正常/边界/异常）
3. 编写测试代码
4. 用 `confirm` 确认后写入文件
5. 用 `bash` 运行测试，确保全部通过
6. 如有失败，分析原因并修复（修测试或修代码）
