// 路径工具模块：提供常用的路径获取方法
import os from 'os';
import path from 'path';

/**
 * 获取当前用户的 home 目录
 * 跨平台兼容：macOS/Linux 返回 /home/user 或 /Users/user，Windows 返回 C:\Users\user
 * @returns {string} 用户 home 目录的绝对路径
 */
export function getUserHomeDir() {
  return os.homedir();
}

/**
 * 获取用户当前终端所在的工作目录
 * 即启动 Node.js 进程时所在的目录
 * @returns {string} 当前工作目录的绝对路径
 */
export function getCurrentWorkingDir() {
  return process.cwd();
}
