// 统一调色板 — 参考 CodeWhale 的深色调色板设计
// 所有颜色集中管理，便于全局调整主题

export const COLORS = {
  // ── 强调色 ──
  accentPrimary: '#4A9EFF', // 亮蓝色 — 主强调
  accentSecondary: '#7B68EE', // 紫色 — 次强调
  accentSuccess: '#50C878', // 绿色 — 成功/用户
  accentWarning: '#FFB347', // 橙色 — 警告
  accentError: '#FF6B6B', // 红色 — 错误
  accentInfo: '#5BC0DE', // 青色 — 信息

  // ── 文本色 ──
  textPrimary: '#E8E8E8', // 近白 — 正文
  textSoft: '#C8C8C8', // 浅灰 — 次要正文
  textMuted: '#909090', // 中灰 — 次要信息
  textDim: '#606060', // 暗灰 — 提示/导轨
  textHint: '#757575', // 暗灰 — 占位符

  // ── 角色色 ──
  userAccent: '#50C878', // 绿色 — 用户消息
  userBg: '#1A2B1A', // 深绿背景 — 用户消息高亮
  assistantAccent: '#4A9EFF', // 蓝色 — 助手消息
  assistantDim: '#2A5A9F', // 暗蓝 — 助手导轨

  // ── 边框/面板 ──
  border: '#2A4A7F',
  borderDim: '#1E2D4A',
  borderBright: '#4A6FA5',

  // ── Markdown ──
  codeBg: '#1C1C2E',
  codeBorder: '#333355',
  codeText: '#A0D0FF',
  inlineCode: '#FFB347',
  heading: '#7B68EE',
  link: '#4A9EFF',
  quoteText: '#909090',
  quoteBorder: '#555555',
};

// 消息角色符号 — 参考 CodeWhale 的字符设计
export const GLYPHS = {
  user: '\u{258E}', // ▎ — 左1/4实心竖条
  assistant: '\u{25CF}', // ● — 实心圆点
  rail: '\u{258F}', // ▏ — 左1/8实心块（续行导轨）
  arrow: '\u{276F}', // ❯ — 右尖括号
  dot: '\u{2022}', // • — 项目符号
  diamond: '\u{25C6}', // ◆ — 实心菱形
  checkmark: '\u{2713}', // ✓ — 对勾
  cross: '\u{2717}', // ✗ — 叉号
  star: '\u{2605}', // ★ — 星号
};
