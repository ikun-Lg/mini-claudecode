
import LocalClient from './LocalClient.js';
import skill from './skill.js';
import bash from './bash.js';
import confirm from './confirm.js';
import edit_file from './edit_file.js';
import glob from './glob.js';
import grep from './grep.js';
import list_dir from './list_dir.js';
import multi_edit from './multi_edit.js';
import read_file from './read_file.js';
import select from './select.js';
import todo_write from './todo_write.js';
import write_file from './write_file.js';


export default function getLocalTool() {
    const localClient = new LocalClient();
    localClient.registerTool(skill);
    localClient.registerTool(bash);
    localClient.registerTool(confirm);
    localClient.registerTool(edit_file);
    localClient.registerTool(glob);
    localClient.registerTool(grep);
    localClient.registerTool(list_dir);
    localClient.registerTool(multi_edit);
    localClient.registerTool(read_file);
    localClient.registerTool(select);
    localClient.registerTool(todo_write);
    localClient.registerTool(write_file);


    const localTools = localClient.listTools();
    //遍历localTools形成map映射
    const localMap = {};
    localTools.tools.forEach((tool) => {
        localMap[tool.name] = localClient
    })
    return {
        localTools: localTools.tools,
        localMap
    }
}
