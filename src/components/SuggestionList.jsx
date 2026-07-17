import React from 'react';
import { Box, Text } from 'ink';
import { COLORS } from './theme.js';

// 最大显示的列表项数量
const MAX_VISIBLE = 8;

/**
 * 指令/文件/历史建议列表组件
 * 支持上下键导航和 Tab/Enter 确认
 *
 * @param {Object} props
 * @param {Array} props.items - 建议项列表
 * @param {number} props.selectedIndex - 当前选中索引
 * @param {'command' | 'file' | 'image' | 'history'} props.mode - 建议模式
 */
export default function SuggestionList({ items, selectedIndex, mode }) {
  if (items.length === 0) {
    return (
      <Box paddingLeft={2} marginTop={0}>
        <Text color={COLORS.textDim}>  ╶ 无匹配结果</Text>
      </Box>
    );
  }

  // 计算可见窗口的起始索引（滚动效果）
  let startIndex = 0;
  if (selectedIndex >= MAX_VISIBLE) {
    startIndex = selectedIndex - MAX_VISIBLE + 1;
  }
  const visibleItems = items.slice(startIndex, startIndex + MAX_VISIBLE);

  // 标题文字
  const title =
    mode === 'command'
      ? '  ┄ 可用指令'
      : mode === 'file'
        ? '  ┄ 项目文件'
        : mode === 'image'
          ? '  ┄ 设计图片'
          : '  ┄ 历史对话';

  return (
    <Box flexDirection="column" paddingLeft={2} marginTop={0}>
      {/* 列表标题 */}
      <Text color={COLORS.textDim}>
        {title}
        {items.length > MAX_VISIBLE ? ` (${items.length})` : ''}
      </Text>

      {/* 列表项 */}
      {visibleItems.map((item, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === selectedIndex;

        // ── 指令模式 ──
        if (mode === 'command') {
          return (
            <Box key={item.name}>
              <Text color={isSelected ? COLORS.accentPrimary : COLORS.textDim}>
                {isSelected ? '▶ ' : '  '}
              </Text>
              <Text
                color={isSelected ? COLORS.accentPrimary : COLORS.textSoft}
                bold={isSelected}
              >
                {item.name}
              </Text>
              <Text color={COLORS.textDim}> {item.description}</Text>
            </Box>
          );
        }

        // ── 历史模式 ──
        if (mode === 'history') {
          const date = item.savedAt
            ? new Date(item.savedAt).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '未知';
          return (
            <Box key={item.filename}>
              <Text
                color={isSelected ? COLORS.accentSecondary : COLORS.textDim}
              >
                {isSelected ? '▶ ' : '  '}
              </Text>
              <Text
                color={isSelected ? COLORS.accentSecondary : COLORS.textSoft}
                bold={isSelected}
              >
                {date}
              </Text>
              <Text color={COLORS.textDim}> · {item.messageCount}条 · </Text>
              <Text color={COLORS.textMuted}>{item.preview}</Text>
            </Box>
          );
        }

        // ── 图片模式 ──
        if (mode === 'image') {
          const imagePath = typeof item === 'string' ? item : item.name;
          return (
            <Box key={imagePath}>
              <Text
                color={isSelected ? COLORS.accentSecondary : COLORS.textDim}
              >
                {isSelected ? '▶ ' : '  '}
              </Text>
              <Text color={isSelected ? COLORS.accentWarning : COLORS.textDim}>
                {'🖼️ '}
              </Text>
              <Text
                color={isSelected ? COLORS.accentSecondary : COLORS.textSoft}
                bold={isSelected}
              >
                {imagePath}
              </Text>
            </Box>
          );
        }

        // ── 文件模式 ──
        const filePath = typeof item === 'string' ? item : item.name;
        return (
          <Box key={filePath}>
            <Text
              color={isSelected ? COLORS.accentSecondary : COLORS.textDim}
            >
              {isSelected ? '▶ ' : '  '}
            </Text>
            <Text
              color={isSelected ? COLORS.accentSecondary : COLORS.textSoft}
              bold={isSelected}
            >
              {filePath}
            </Text>
          </Box>
        );
      })}

      {/* 操作提示 */}
      <Text color={COLORS.textDim}>  ↑↓ 选择 · Tab/Enter 确认 · Esc 取消</Text>
    </Box>
  );
}
