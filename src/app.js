// 整个项目的启动入口
import React from 'react';
import { render } from 'ink';
import App from './components/App.jsx';

// 渲染 Ink 应用
const instance = render(React.createElement(App));

// 应用退出后打印告别信息
instance.waitUntilExit().then(() => {
  console.log('\n  \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
  console.log('  \x1b[34m●\x1b[0m \x1b[90mmini-claudecode\x1b[0m \x1b[90m·\x1b[0m \x1b[32m再见！\x1b[0m \x1b[35m👋\x1b[0m\n');
  console.log('  \x1b[90m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n');
});
