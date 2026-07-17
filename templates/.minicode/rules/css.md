---
paths:
  - "**/*.css"
  - "**/*.less"
  - "**/*.scss"
  - "**/*.sass"
  - "**/*.styl"
  - "**/*.module.css"
  - "**/*.module.less"
  - "**/*.module.scss"
---

# CSS 开发规范

当处理 CSS、Less、Sass 或组件样式时，请严格遵循以下规范：

## 通用原则

1. **一致性优先**：遵循项目现有的样式方案和命名约定，不混用不同的样式方案（如 BEM 和 CSS-in-JS 不混用）。
2. **简洁可维护**：避免冗余样式，复用公共类，保持选择器层级尽量扁平。
3. **移动优先**：响应式布局采用 Mobile First 策略，默认样式针对移动端，通过 `min-width` 媒体查询逐步增强。

## 命名规范

- **类名**：使用 `kebab-case`，如 `.user-profile`、`.message-bubble`。
- **BEM 命名**：如果项目使用 BEM，遵循 `block__element--modifier` 格式，如 `.card__title--large`。
- **CSS Modules**：如果项目使用 CSS Modules，类名使用 `camelCase`，如 `.userProfile`。
- **ID 选择器**：禁止使用 ID 选择器设置样式，ID 仅用于 JS 锚点。
- **命名前缀**：为避免冲突，组件样式可加项目前缀，如 `.mc-button`。

## 选择器

1. **避免深层嵌套**：选择器层级不超过 3 层，如 `.list .item .title` 是上限。
2. **避免通用选择器**：不使用 `*` 选择器，性能开销大。
3. **避免 `!important`**：除非覆盖第三方库样式且无其他方案，否则不使用 `!important`。
4. **不使用标签选择器**：用类选择器代替标签选择器，如用 `.nav-item` 而非 `li`。

## 属性顺序

按以下顺序分组书写属性，提高可读性：

1. **布局**：`position`、`display`、`flex`、`grid`、`float`、`clear`
2. **盒模型**：`width`、`height`、`margin`、`padding`、`border`
3. **排版**：`font`、`line-height`、`color`、`text-align`
4. **视觉**：`background`、`opacity`、`box-shadow`、`border-radius`
5. **动画**：`transition`、`animation`、`transform`

```css
.user-card {
  /* 布局 */
  position: relative;
  display: flex;
  flex-direction: column;

  /* 盒模型 */
  width: 200px;
  padding: 16px;
  border: 1px solid #e0e0e0;

  /* 排版 */
  font-size: 14px;
  color: #333;
  text-align: center;

  /* 视觉 */
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  /* 动画 */
  transition: all 0.3s ease;
}
```

## 值与单位

- **颜色**：使用 `hex` 格式（如 `#333`）或 `rgba`（需要透明度时）。不使用颜色英文名（如 `red`）。
- **单位**：字体用 `px` 或 `rem`，间距用 `px`，响应式比例用 `%` 或 `vw`/`vh`。不使用 `pt`、`cm` 等物理单位。
- **零值**：值为 `0` 时不带单位，如 `margin: 0;` 而非 `margin: 0px;`。
- **小数**：小数前省略前导零，如 `opacity: .8;` 而非 `opacity: 0.8;`（与项目现有风格保持一致）。

## 响应式

1. **断点**：使用项目定义的断点变量或媒体查询，不随意添加新的断点值。
2. **移动优先**：默认样式针对移动端，使用 `min-width` 逐步增强：
   ```css
   .container {
     width: 100%;
   }
   @media (min-width: 768px) {
     .container {
       width: 750px;
     }
   }
   ```
3. **不使用固定宽高**：移动端避免固定宽高，使用 `flex`、`grid`、`max-width` 等弹性布局。

## 变量与主题

1. **CSS 变量**：全局色彩、间距、字体大小使用 CSS 自定义属性统一管理：
   ```css
   :root {
     --color-primary: #1890ff;
     --color-text: #333;
     --spacing-base: 8px;
     --font-size-base: 14px;
   }
   ```
2. **不硬编码**：项目中已有变量的，不硬编码值，统一引用变量。
3. **主题切换**：通过切换 `data-theme` 属性或类名实现暗色 / 亮色主题。

## 浏览器兼容

1. **前缀**：不手动添加浏览器前缀（`-webkit-`、`-moz-` 等），交给 Autoprefixer 等工具处理。
2. **新特性**：使用 CSS 新特性（如 `gap`、`aspect-ratio`）时确认项目浏览器兼容范围。
3. **降级**：使用实验性属性时提供合理的降级方案。

## Less / Sass 预处理器

1. **嵌套**：嵌套不超过 3 层，避免生成的选择器过长。
2. **变量**：预处理器变量使用 `kebab-case`，如 `@primary-color`（Less）或 `$primary-color`（Sass）。
3. **Mixin**：复用的样式块抽为 Mixin，不复制粘贴样式代码。
4. **不滥用 @extend**：`@extend` 会生成复杂的选择器组，优先使用 Mixin 或独立的公共类。
