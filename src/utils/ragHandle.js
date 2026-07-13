import fs from "fs";
import path from "path";
import { Worker } from "worker_threads";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import mammoth from "mammoth";
import * as lancedb from "@lancedb/lancedb";
import { createClient } from "../request/llm.js";
import { getUserHomeDir, getCurrentWorkingDir } from "./pathUtils.js";

// ── 本地向量模型降级方案 ──────────────────────────────
// 当远程向量模型（text-embedding-v4）额度耗尽或不可用时，
// 自动切换到本地向量模型（Xenova/multilingual-e5-small），
// 使用 Transformers.js 在 worker_threads 子线程中运行嵌入模型，
// 避免 CPU 密集型推理阻塞主线程（终端 UI、流式对话等）。

let useLocalEmbedding = false; // 是否使用本地向量模型
let localRebuildAttempted = false; // 防止搜索时重复触发自动重建
let remoteFailNoticePrinted = false; // 远程失败提示是否已打印（避免并行调用重复打印）

// ── Worker 管理 ──────────────────────────────────────
// 持久 worker 实例：模型在子线程中加载一次，后续请求复用。
// 主线程通过 postMessage 发送计算请求，worker 回传结果。

let workerInstance = null; // Worker 实例
let workerRequestId = 0; // 请求自增 ID
const workerPending = new Map(); // id -> { resolve, reject }

/**
 * 初始化 embedding worker（懒加载，首次调用本地向量时才创建）
 */
function initWorker() {
  if (workerInstance) return;

  workerInstance = new Worker(new URL("./embeddingWorker.js", import.meta.url));

  // 接收 worker 的响应消息
  workerInstance.on("message", ({ id, result, error }) => {
    const handler = workerPending.get(id);
    if (handler) {
      workerPending.delete(id);
      if (error) {
        handler.reject(new Error(error));
      } else {
        handler.resolve(result);
      }
    }
  });

  // worker 异常退出时，reject 所有 pending 请求并允许重建
  workerInstance.on("error", (err) => {
    for (const [, handler] of workerPending) {
      handler.reject(err);
    }
    workerPending.clear();
    workerInstance = null;
  });

  // 进程退出时清理 worker
  process.on("exit", () => {
    if (workerInstance) {
      workerInstance.terminate();
      workerInstance = null;
    }
  });
}

/**
 * 通过 worker 子线程计算单条文本的向量
 * 模型加载和 CPU 推理都在子线程完成，不阻塞主线程事件循环。
 * @param {string} text - 要向量化的文本
 * @param {boolean} isQuery - 是否为查询文本（true 加 "query:" 前缀，false 加 "passage:" 前缀）
 * @returns {Promise<number[]>} 向量数组
 */
async function getLocalEmbeddings(text, isQuery = false) {
  initWorker();

  const id = ++workerRequestId;

  return new Promise((resolve, reject) => {
    workerPending.set(id, { resolve, reject });
    workerInstance.postMessage({ id, text, isQuery });
  });
}

/**
 * 获取当前使用的 LanceDB 表名
 * 远程模式使用 "doc-table"，本地模式使用 "doc-table-local"，
 * 避免不同维度的向量混在同一张表中导致搜索失败。
 * @returns {string} 表名
 */
function getTableName() {
  return useLocalEmbedding ? "doc-table-local" : "doc-table";
}

/**
 * 手动设置是否使用本地向量模型
 * @param {boolean} force - true 强制使用本地模型，false 使用远程优先
 */
export function setLocalEmbeddingMode(force) {
  useLocalEmbedding = force;
}

// 支持的文档扩展名，仅允许文本类文件,也就是只允许用的文档用这些格式
const ALLOWED_EXTENSIONS = [".md", ".txt", ".docx"];

// 获取到目录下的所有文件，比如我们这样调用它 getFilesFromDir("user/.minicode/doc")
//就会获取到user目录下，.minicode下doc里的所有文件组成的数组
//比如
// [C:\Users\Administrator\.minicode\doc\公司门店.txt,C:\Users\Administrator\.minicode\doc\考勤制度.docx]
export function getFilesFromDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) =>
      ALLOWED_EXTENSIONS.includes(path.extname(name).toLowerCase()),
    )
    .map((name) => path.join(dir, name));
}
/**
 * 读取一个或多个文件的内容
 * @param {string|string[]} filePaths - 文件路径，可以是单个路径字符串或路径数组
 * @returns {Promise<{path: string, content: string}[]>} 返回一个Promise，resolve为对象数组，每个对象包含 path（文件路径）和 content（文件内容）
 * @example
 * // 比如
 * const result = await readFileContent(["C:/docs/a.md", "C:/docs/b.docx"]);
 * // result: [
 * //   { path: "C:/docs/a.md", content: "# 标题\n正文..." },
 * //   { path: "C:/docs/b.docx", content: "docx文档提取的纯文本..." }
 * // ]
 */
export async function readFileContent(filePaths) {
  //检测是否是数组
  if (!Array.isArray(filePaths)) filePaths = [filePaths];
  return Promise.all(
    filePaths.map(async (filePath) => {
      //并发读取文件，避免串行一个个读耗时太久
      const ext = path.extname(filePath).toLowerCase();
      let content;
      if (ext === ".docx") {
        // 检查文件是否为空，避免 JSZip 报 "Corrupted zip" 错误
        const stat = fs.statSync(filePath);
        if (stat.size === 0) {
          console.warn(`[ragHandle] 文件为空，跳过: ${filePath}`);
          return { path: filePath, content: "" };
        }
        try {
          const result = await mammoth.extractRawText({ path: filePath });
          content = result.value;
        } catch (err) {
          console.warn(
            `[ragHandle] docx 文件读取失败，跳过: ${filePath}`,
            err.message,
          );
          return { path: filePath, content: "" };
        }
      } else {
        content = fs.readFileSync(filePath, "utf-8");
      }
      //最终每一个文件读取后，返回路径和内容，外层
      return { path: filePath, content };
    }),
  );
}

/**
 * 调用大模型接口将文本转为向量
 * 优先使用远程 API（text-embedding-v4），失败时自动降级到本地向量模型
 * 注意：降级是单向的，一旦切换到本地模式就不会再尝试远程
 * @param {string} text - 要向量化的文本
 * @param {boolean} isQuery - 是否为查询文本（本地模式生效，控制 e5 前缀）
 * @returns {Promise<number[]>} 向量数组
 */
export async function getEmbeddings(text, isQuery = false) {
  if (!text) return;

  // 已经切换到本地模式，直接使用本地模型
  if (useLocalEmbedding) {
    return await getLocalEmbeddings(text, isQuery);
  }

  // 优先尝试远程 API
  try {
    const openai = createClient();
    const response = await openai.embeddings.create({
      model: "text-embedding-v4",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    // 远程 API 不可用（额度耗尽、网络错误等），切换到本地向量模型
    // 并行调用时可能多个请求同时失败，这里用标志位确保只打印一次提示
    useLocalEmbedding = true;
    if (!remoteFailNoticePrinted) {
      remoteFailNoticePrinted = true;
      console.warn(
        `[ragHandle] 远程向量模型不可用，切换到本地向量模型: ${error.message}`,
      );
    }
    return await getLocalEmbeddings(text, isQuery);
  }
}

/**
 * 同步获取用户目录和当前工作目录下 .minicode/doc 中的文档文件列表（不读取内容）
 * 用于在展示文件列表时避免异步等待
 * @returns {{ userFiles: string[], currentDirFiles: string[] }}
 */
export function getRagFileListSync() {
  const userHomeDir = getUserHomeDir();
  const currentWorkingDir = getCurrentWorkingDir();
  const userDocDir = path.join(userHomeDir, ".minicode", "doc");
  const currentDirDocDir = path.join(currentWorkingDir, ".minicode", "doc");
  return {
    userFiles: getFilesFromDir(userDocDir),
    currentDirFiles: getFilesFromDir(currentDirDocDir),
  };
}

/**
 * 获取用户目录和当前工作目录下 .minicode/doc 文件夹中的所有文档内容
 *
 */
export async function getAllRagFile() {
  //获取user目录和当前工作目录
  const userHomeDir = getUserHomeDir();
  const currentWorkingDir = getCurrentWorkingDir();
  //获取user目录和当前工作目录下的.minicode下的doc，这里放着所有本地文档
  const userDocDir = path.join(userHomeDir, ".minicode", "doc");
  const currentDirDocDir = path.join(currentWorkingDir, ".minicode", "doc");
  //分别获取到user下的所有文件，以及当前目录下的所有文件
  const userFiles = getFilesFromDir(userDocDir);
  const currentDirFiles = getFilesFromDir(currentDirDocDir);

  //如果有文件则读取所有内容
  const userDocArr =
    userFiles.length > 0 ? await readFileContent(userFiles) : [];
  const currentDirDocArr =
    currentDirFiles.length > 0 ? await readFileContent(currentDirFiles) : [];
  //userDocArr-为读取到的所有user目录下的文档
  //currentDirDocArr-为读取到的当前目录下的所有文档
  return { userDocArr, currentDirDocArr };
}

/**
 * 将文件内容数组转为向量
 */
export async function filesToEmbedding(fileArr) {
  if (!Array.isArray(fileArr) || fileArr.length === 0) return [];
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 40,
    chunkOverlap: 20,
  });
  // 并行切割所有文档内容
  //会得到一个二维数组，
  //splitResults-[[a文件切割后的结果],[b文件切割后的结果]]
  const splitResults = await Promise.all(
    fileArr.map(async (file) => {
      const chunks = await splitter.splitText(file.content);
      return chunks.map((chunk) => ({
        text: chunk,
        path: file.path,
      }));
    }),
  );

  // 展平所有文本块，二维平整为一维
  const allChunks = splitResults.flat();

  // 串行将所有文本块转为向量
  // 串行确保远程 API 首次失败后立即切换本地模式，避免并行请求全部重复尝试远程
  // 本地模式下 embedding 在 worker 子线程执行，不阻塞主线程 UI
  const embeddings = [];
  for (const chunk of allChunks) {
    const embedding = await getEmbeddings(chunk.text);
    embeddings.push(embedding);
  }

  // 组装最终结果
  return allChunks.map((chunk, index) => ({
    vector: embeddings[index],
    text: chunk.text,
    path: chunk.path,
  }));
}

/**
 * 将向量结果数组存储到 LanceDB
 * @param {'user'|'current'} type - 存储类型，user 表示用户目录，current 表示当前项目目录
 * @param {Array<{vector: number[], text: string, path: string}>} vectors - 向量结果数组
 */
export async function storeIn(type, vectors) {
  if (!Array.isArray(vectors) || vectors.length === 0) return;
  //根据是user目录下的文档，还是当前项目下的文档，连接到不同位置
  //核心就是当前项目下的存到当前项目下的.minicode下的langce-db文件夹
  //user下的存到user下的.minicode下的langce-db文件夹
  let dbPath;
  if (type === "user") {
    dbPath = path.join(getUserHomeDir(), ".minicode", "langcedb-data");
  } else if (type === "current") {
    dbPath = path.join(getCurrentWorkingDir(), ".minicode", "langcedb-data");
  } else {
    throw new Error('type must be "user" or "current"');
  }

  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }
  //连接路径
  const db = await lancedb.connect(dbPath);
  //获取当前所有table
  const tableNames = await db.tableNames();
  const tableName = getTableName(); //根据向量模式选择table
  //检测是否table已经存在
  if (tableNames.includes(tableName)) {
    //存在则加入
    const table = await db.openTable(tableName);
    await table.add(vectors, { mode: "append" });
  } else {
    //不存在则创建
    await db.createTable(tableName, vectors);
  }
}

/**
 * 根据文件名在两个 doc 目录中查找文件，找到后读取、切割、向量化并存储
 * @param {string} fileName - 文件名（可带扩展名）
 */
export async function searchFileAndStoreIn(fileName) {
  const userHomeDir = getUserHomeDir();
  const currentWorkingDir = getCurrentWorkingDir();
  const userDocDir = path.join(userHomeDir, ".minicode", "doc");
  const currentDocDir = path.join(currentWorkingDir, ".minicode", "doc");

  const targets = [];

  // 在 user 目录下查找
  if (fs.existsSync(userDocDir)) {
    const userFilePath = path.join(userDocDir, fileName);
    if (fs.existsSync(userFilePath)) {
      targets.push({ type: "user", path: userFilePath });
    }
  }

  // 在当前项目目录下查找
  if (fs.existsSync(currentDocDir)) {
    const currentFilePath = path.join(currentDocDir, fileName);
    if (fs.existsSync(currentFilePath)) {
      targets.push({ type: "current", path: currentFilePath });
    }
  }

  if (targets.length === 0) return;

  // 读取 -> 切割 -> 向量化 -> 存储
  const fileContents = await readFileContent(targets.map((t) => t.path));
  const vectors = await filesToEmbedding(fileContents);

  // 按类型分组存储
  for (const target of targets) {
    const typeVectors = vectors.filter((v) => v.path === target.path);
    if (typeVectors.length > 0) {
      await storeIn(target.type, typeVectors);
    }
  }
}

/**
 * 读取所有文档并转为向量后存入 LanceDB
 */
export async function storeAllFilesIn() {
  //获取到user和当前目录下的所有文件
  const { userDocArr, currentDirDocArr } = await getAllRagFile();
  //确认有内容
  if (userDocArr.length > 0) {
    //把user的内容转化为向量，然后存入
    const userVectors = await filesToEmbedding(userDocArr);
    await storeIn("user", userVectors);
  }

  if (currentDirDocArr.length > 0) {
    const currentVectors = await filesToEmbedding(currentDirDocArr);
    await storeIn("current", currentVectors);
  }
}

/**
 * 在指定 LanceDB 路径中搜索相似文档
 * @param {string} dbPath - LanceDB 数据库路径
 * @param {string} tableName - 表名
 * @param {number[]} vector - 查询向量
 * @returns {Promise<Array>} 搜索结果数组
 */
async function searchInDb(dbPath, tableName, vector) {
  if (!fs.existsSync(dbPath)) return [];
  const db = await lancedb.connect(dbPath);
  const tableNames = await db.tableNames();
  if (!tableNames.includes(tableName)) return [];
  const table = await db.openTable(tableName);
  return await table.search(vector).limit(3).toArray();
}

/**
 * 接收查询字符串，转为向量后在 user 和当前项目目录的 LanceDB 中搜索相似文档
 * 远程模式搜索 "doc-table"，本地模式搜索 "doc-table-local"。
 * 本地模式下如果表不存在，会自动构建一次后重试。
 * @param {string} queryText - 查询文本
 * @returns {Promise<string[]>} 合并后的检索结果文本数组，最多6条
 */
export async function searchLocalVector(queryText) {
  if (!queryText || typeof queryText !== "string") return [];

  const vector = await getEmbeddings(queryText, true);
  if (!vector || !Array.isArray(vector)) return [];

  const tableName = getTableName();
  const userDbPath = path.join(getUserHomeDir(), ".minicode", "langcedb-data");
  const currentDbPath = path.join(
    getCurrentWorkingDir(),
    ".minicode",
    "langcedb-data",
  );

  let userResults = await searchInDb(userDbPath, tableName, vector);
  let currentResults = await searchInDb(currentDbPath, tableName, vector);

  // 本地模式下，如果完全没有结果且尚未尝试过重建，自动构建向量库后重试
  if (
    useLocalEmbedding &&
    !localRebuildAttempted &&
    userResults.length === 0 &&
    currentResults.length === 0
  ) {
    localRebuildAttempted = true;
    console.log("[ragHandle] 本地向量库为空，正在自动构建...");
    await storeAllFilesIn();
    // 重新搜索
    userResults = await searchInDb(userDbPath, tableName, vector);
    currentResults = await searchInDb(currentDbPath, tableName, vector);
  }

  return [...userResults, ...currentResults].map((r) => r.text);
}

// 以下为本地调试代码，仅在直接运行此文件时执行，不会在 import 时触发
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(import.meta.url.replace("file://", ""))
) {
  //   const { userDocArr, currentDirDocArr } = await getAllRagFile();
  // 调试用：读取所有文档并写入 files.json
  //   const result = await filesToEmbedding(currentDirDocArr);
  //   fs.writeFileSync("./files.json", JSON.stringify(result));
  //   console.log("文档读取完成:", result);

  console.log(searchLocalVector("LG-cli"));

  // 调试用：搜索测试
  // console.log(await searchLocalVector("病假"));
}
