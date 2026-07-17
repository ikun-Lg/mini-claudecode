# 生成 JSDoc 注释

请帮我为指定的代码生成 JSDoc 注释。生成时遵循以下规范：

## JSDoc 规范

1. **函数注释**：标注 `@param` 和 `@returns`
2. **类型准确**：参数和返回值的类型描述必须与实际一致
3. **描述有意义**：描述函数的作用，而非重复函数名
4. **可选参数**：使用 `[参数名]` 标注可选参数，并说明默认值

## 格式模板

### 普通函数

```javascript
/**
 * 根据用户 ID 查询用户信息
 * @param {string} userId - 用户唯一标识
 * @param {Object} [options] - 查询选项
 * @param {boolean} [options.includeDeleted=false] - 是否包含已删除的用户
 * @returns {Promise<User|null>} 用户信息对象，不存在时返回 null
 * @throws {Error} 当 userId 为空时抛出错误
 */
async function getUserById(userId, options = {}) {
  // ...
}
```

### 类

```javascript
/**
 * 用户管理服务
 * @class UserService
 */
class UserService {
  /**
   * 创建新用户
   * @param {Object} userData - 用户数据
   * @param {string} userData.name - 用户名
   * @param {string} userData.email - 邮箱
   * @returns {Promise<User>} 创建的用户对象
   */
  async create(userData) {
    // ...
  }
}
```

### 模块

```javascript
/**
 * 文件系统操作模块
 * @module fsHandle
 */
```

## 执行步骤

1. 用 `read_file` 阅读目标代码
2. 分析每个函数/类的参数、返回值和作用
3. 生成 JSDoc 注释，插入到函数/类声明上方
4. 用 `edit_file` 工具将注释写入代码
5. 确保注释格式统一，缩进与代码一致
