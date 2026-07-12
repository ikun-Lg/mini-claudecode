import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { COLORS } from './theme.js';

/**
 * Ink 确认组件 — Yes/No 选择
 *
 * 交互方式：
 *   - ← → 或 y/n 切换选项
 *   - Enter 确认当前选中项
 *   - Esc 取消（等同于 No）
 *
 * @param {Object} props
 * @param {string} props.message - 提示文本
 * @param {boolean} props.defaultValue - 默认选中项（true=Yes, false=No）
 * @param {(result: boolean) => void} props.onConfirm - 用户确认后的回调
 */
export default function ConfirmInput({ message, defaultValue = false, onConfirm }) {
  // 0 = Yes, 1 = No
  const [selected, setSelected] = useState(defaultValue ? 0 : 1);

  useInput((char, key) => {
    if (key.leftArrow || key.rightArrow) {
      setSelected((prev) => (prev === 0 ? 1 : 0));
    } else if (key.return) {
      onConfirm(selected === 0);
    } else if (char === 'y' || char === 'Y') {
      onConfirm(true);
    } else if (char === 'n' || char === 'N') {
      onConfirm(false);
    } else if (key.escape) {
      onConfirm(false);
    }
  });

  const yesSelected = selected === 0;
  const noSelected = selected === 1;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* 提示文本 */}
      <Box>
        <Text color={COLORS.accentWarning} bold>
          {'❓ '}
        </Text>
        <Text color={COLORS.textPrimary}>{message}</Text>
      </Box>

      {/* Yes / No 选项 */}
      <Box marginTop={0}>
        <Text color={yesSelected ? COLORS.accentSuccess : COLORS.textDim}>
          {yesSelected ? '▶ ' : '  '}
          {yesSelected ? '◉' : '○'}
          {' Yes'}
        </Text>
        <Text color={COLORS.textDim}>{'    '}</Text>
        <Text color={noSelected ? COLORS.accentError : COLORS.textDim}>
          {noSelected ? '▶ ' : '  '}
          {noSelected ? '◉' : '○'}
          {' No'}
        </Text>
      </Box>

      {/* 操作提示 */}
      <Text color={COLORS.textDim}>
        {'  ← → 切换 · Enter 确认 · Esc 取消'}
      </Text>
    </Box>
  );
}
