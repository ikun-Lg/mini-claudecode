
import LocalClient from './LocalClient.js';
import skill from './skill.js';


export default function getLocalTool() {
    const localClient = new LocalClient();
    localClient.registerTool(skill);


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