// 整个项目的启动入口
import React from 'react';
import { render } from 'ink';
import App from './components/App.jsx';

// 渲染 Ink 应用
const instance = render(React.createElement(App));

// 应用退出后打印告别信息
instance.waitUntilExit().then(() => {
  console.log('\n  再见！👋\n');
});
