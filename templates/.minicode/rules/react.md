---
paths:
  - "**/*.jsx"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.ts"
---

# React 开发规范

当编写 React 组件或处理 React 相关代码时，请严格遵循以下规范：

## 组件设计

1. **函数组件优先**：使用函数组件 + Hooks，不使用 Class 组件（除非需要错误边界且未引入 react-error-boundary）。
2. **单一职责**：一个组件只做一件事，复杂组件拆分为子组件。
3. **受控 vs 非受控**：表单输入优先使用受控组件，简单场景可用非受控 + `useRef`。
4. **组合优于继承**：通过 props 组合和 children 实现复用，不使用继承。

## Hooks 规范

1. **只在顶层调用**：不在循环、条件或嵌套函数中调用 Hooks。
2. **依赖数组**：`useEffect`、`useMemo`、`useCallback` 必须正确填写依赖数组，不省略依赖。
3. **自定义 Hook**：复用逻辑抽为自定义 Hook，命名以 `use` 开头，如 `useAuth`、`useDebounce`。
4. **避免内联函数**：事件处理函数尽量用 `useCallback` 包裹，避免子组件不必要的重渲染。

## 状态管理

1. **状态最小化**：能从已有状态推导出的值不存为独立状态，用 `useMemo` 计算。
2. **状态提升**：多个组件需要共享的状态，提升到最近的共同父组件。
3. **全局状态**：跨层级共享状态使用 Context 或状态管理库（Zustand / Redux Toolkit / Jotai）。
4. **不可变更新**：更新状态时返回新对象/数组，不直接修改：
   ```javascript
   // ✅ 正确
   setItems(prev => [...prev, newItem]);
   // ❌ 错误
   items.push(newItem);
   setItems(items);
   ```

## 性能优化

1. **memo**：纯展示组件用 `React.memo` 包裹，避免父组件重渲染时连带重渲染。
2. **useMemo**：昂贵计算用 `useMemo` 缓存，简单计算不需要。
3. **useCallback**：传递给被 memo 的子组件的回调函数用 `useCallback` 包裹。
4. **虚拟列表**：大列表（>100 项）使用虚拟滚动（react-window / react-virtuoso）。
5. **懒加载**：大组件或路由级组件用 `React.lazy` + `Suspense` 懒加载。
6. **key 稳定**：列表渲染的 `key` 使用稳定唯一值，不用数组索引。

## 样式方案

1. **一致性**：遵循项目现有样式方案（CSS Modules / styled-components / Tailwind / 普通 CSS），不混用。
2. **样式隔离**：组件样式要有作用域，避免全局污染（CSS Modules / scoped）。
3. **内联样式**：仅用于动态计算的样式，静态样式用 CSS 类。

## 事件处理

1. **事件命名**：以 `on` 开头，如 `onSubmit`、`onItemClick`。
2. **防抖节流**：频繁触发的事件（scroll、resize、input）做防抖/节流处理。
3. **清理副作用**：`useEffect` 中注册的事件监听、定时器、订阅必须在 cleanup 中清理。

## 目录结构

```
src/
  components/        # 通用组件
    Button/
      Button.jsx
      Button.module.css
      index.js
  pages/             # 页面组件
  hooks/             # 自定义 Hooks
  utils/             # 工具函数
  services/          # API 请求
  store/             # 全局状态
  types/             # 类型定义（TS）
```
