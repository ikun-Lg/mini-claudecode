/**
 * 交互桥接模块
 *
 * 让工具层（confirm/select 等）能够请求 UI 层（Ink 组件）进行交互。
 *
 * 工作流程：
 *   1. App.jsx 启动时通过 setInteractionHandler 注册一个处理器
 *   2. 工具的 handle() 调用 requestInteraction('confirm', data)
 *   3. 该调用创建一个 Promise，并通过 handler 通知 UI 层
 *   4. UI 层渲染对应的 Ink 交互组件
 *   5. 用户操作后，UI 层调用 resolve(result) 解决 Promise
 *   6. 工具获得结果，继续执行
 *
 * 由于工具的 handle() 是 async，在 await requestInteraction() 时会暂停，
 * getAIResponse 生成器也随之暂停，不会继续 yield 事件。
 * 这给了 React 充足的时间渲染交互组件。
 */

let interactionHandler = null;

/**
 * 注册交互处理器（由 App.jsx 调用）
 * @param {(request: { type: string, data: Object, resolve: Function }) => void} handler
 */
export function setInteractionHandler(handler) {
    interactionHandler = handler;
}

/**
 * 请求交互（由工具调用）
 * @param {'confirm' | 'select'} type - 交互类型
 * @param {Object} data - 交互数据（confirm: {message, default}, select: {message, choices}）
 * @returns {Promise<any>} 用户的选择结果
 */
export function requestInteraction(type, data) {
    return new Promise((resolve) => {
        if (interactionHandler) {
            interactionHandler({ type, data, resolve });
        } else {
            // 兜底：没有注册 handler 时自动返回默认值，避免卡死
            if (type === 'confirm') {
                resolve(false);
            } else if (type === 'select') {
                resolve(data.choices?.[0]?.value ?? '');
            } else {
                resolve(null);
            }
        }
    });
}
