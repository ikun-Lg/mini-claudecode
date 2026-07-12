import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { COLORS } from './theme.js';

const MAX_VISIBLE = 8;

/**
 * Ink 选择组件 — 列表选择
 *
 * 交互方式：
 *   - ↑ ↓ 导航选项
 *   - Enter 确认选择
 *   - Esc 取消（选择第一项）
 *
 * @param {Object} props
 * @param {string} props.message - 提示文本
 * @param {Array<{name: string, value: string}>} props.choices - 选项列表
 * @param {(result: string) => void} props.onSelect - 用户选择后的回调
 */
export default function SelectInput({ message, choices, onSelect }) {
  const [index, setIndex] = useState(0);

  useInput((_char, key) => {
    if (key.upArrow) {
      setIndex((prev) => (prev <= 0 ? choices.length - 1 : prev - 1));
    } else if (key.downArrow) {
      setIndex((prev) => (prev >= choices.length - 1 ? 0 : prev + 1));
    } else if (key.return) {
      onSelect(choices[index]?.value ?? '');
    } else if (key.escape) {
      // Esc 取消，选择第一项作为默认
      onSelect(choices[0]?.value ?? '');
    }
  });

  // 计算可见窗口（滚动效果）
  let startIndex = 0;
  if (index >= MAX_VISIBLE) {
    startIndex = index - MAX_VISIBLE + 1;
  }
  const visible = choices.slice(startIndex, startIndex + MAX_VISIBLE);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* 提示文本 */}
      <Box>
        <Text color={COLORS.accentWarning} bold>
          {'🎯 '}
        </Text>
        <Text color={COLORS.textPrimary}>{message}</Text>
      </Box>

      {/* 选项列表 */}
      {visible.map((choice, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === index;
        return (
          <Box key={choice.value || i}>
            <Text color={isSelected ? COLORS.accentPrimary : COLORS.textDim}>
              {isSelected ? '▶ ' : '  '}
            </Text>
            <Text
              color={isSelected ? COLORS.accentPrimary : COLORS.textSoft}
              bold={isSelected}
            >
              {choice.name}
            </Text>
          </Box>
        );
      })}

      {/* 操作提示 */}
      <Text color={COLORS.textDim}>
        {`  ↑↓ 选择 · Enter 确认 · Esc 取消`}
        {choices.length > MAX_VISIBLE ? ` (${choices.length} 项)` : ''}
      </Text>
    </Box>
  );
}
