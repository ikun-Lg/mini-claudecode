// 模块级存储，在同一会话中持久
let todoStore = [];

const VALID_STATUS = ['pending', 'in_progress', 'completed', 'cancelled'];

export default {
    define: {
        name: "todo_write",
        description: "管理任务列表（TODO List），用于规划和跟踪多步骤任务。支持创建、更新、查看和清除任务。在处理复杂任务（3步以上）时优先使用此工具，帮助跟踪进度并展示给用户。",
        inputSchema: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["create", "update", "list", "clear"],
                    description: "操作类型：create=创建/替换整个列表，update=更新单个任务状态，list=查看当前列表，clear=清空列表"
                },
                todos: {
                    type: "array",
                    description: "action=create 时的任务列表",
                    items: {
                        type: "object",
                        properties: {
                            id: {
                                type: "string",
                                description: "任务唯一标识"
                            },
                            content: {
                                type: "string",
                                description: "任务描述"
                            },
                            status: {
                                type: "string",
                                enum: ["pending", "in_progress", "completed", "cancelled"],
                                description: "任务状态"
                            }
                        },
                        required: ["id", "content", "status"]
                    }
                },
                id: {
                    type: "string",
                    description: "action=update 时要更新的任务 ID"
                },
                status: {
                    type: "string",
                    enum: ["pending", "in_progress", "completed", "cancelled"],
                    description: "action=update 时设置的新状态"
                }
            },
            required: ["action"]
        }
    },
    handle({ action, todos, id, status }) {
        switch (action) {
            case 'create': {
                if (!todos || todos.length === 0) {
                    return `创建失败：todos 列表不能为空`;
                }
                // 验证每个 todo
                for (const todo of todos) {
                    if (!todo.id || !todo.content || !todo.status) {
                        return `创建失败：每个 todo 必须包含 id, content, status`;
                    }
                    if (!VALID_STATUS.includes(todo.status)) {
                        return `创建失败：无效状态 "${todo.status}"，有效值: ${VALID_STATUS.join(', ')}`;
                    }
                }
                todoStore = todos.map(t => ({ ...t }));
                return formatTodoList('任务列表已创建');
            }

            case 'update': {
                if (!id) {
                    return `更新失败：缺少 id 参数`;
                }
                if (!status) {
                    return `更新失败：缺少 status 参数`;
                }
                if (!VALID_STATUS.includes(status)) {
                    return `更新失败：无效状态 "${status}"，有效值: ${VALID_STATUS.join(', ')}`;
                }
                const todo = todoStore.find(t => t.id === id);
                if (!todo) {
                    return `更新失败：未找到 ID 为 "${id}" 的任务`;
                }
                todo.status = status;
                return formatTodoList(`任务 "${id}" 已更新为 ${status}`);
            }

            case 'list': {
                if (todoStore.length === 0) {
                    return `当前没有任务。使用 action=create 创建任务列表。`;
                }
                return formatTodoList('当前任务列表');
            }

            case 'clear': {
                const count = todoStore.length;
                todoStore = [];
                return `已清空任务列表（共 ${count} 项）`;
            }

            default:
                return `未知操作: ${action}`;
        }
    }
};

function formatTodoList(title) {
    const lines = [`📋 ${title}（共 ${todoStore.length} 项）：`];
    for (const todo of todoStore) {
        const statusIcon = {
            pending: '⬜',
            in_progress: '🔄',
            completed: '✅',
            cancelled: '❌'
        }[todo.status] || '⬜';
        lines.push(`  ${statusIcon} [${todo.id}] ${todo.content} (${todo.status})`);
    }
    return lines.join('\n');
}
