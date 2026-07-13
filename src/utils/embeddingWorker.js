/**
 * Embedding Worker — 在子线程中运行本地向量模型
 *
 * 主线程通过 postMessage 发送 { id, text, isQuery }，
 * worker 计算完成后回传 { id, result } 或 { id, error }。
 *
 * 模型只在首次消息时加载，后续复用 pipeline 实例。
 *
 * 模型加载策略（按优先级）：
 *   1. 项目内置模型：models/multilingual-e5-small/（打包后无需下载）
 *   2. 用户缓存目录：~/.minicode/transformers-cache/（首次使用后自动缓存）
 *   3. 远程下载：从镜像站 hf-mirror.com 下载量化版模型
 */
import { parentPort } from "worker_threads";
import path from "path";
import os from "os";
import fs from "fs";

const LOCAL_MODEL_NAME = "Xenova/multilingual-e5-small";

let pipeline = null;
let modelLoading = null;

/**
 * 获取项目内置模型目录的绝对路径
 * 打包后此目录跟随产物分发，无需联网下载
 * @returns {string|null} 内置模型目录路径，不存在时返回 null
 */
function getBundledModelPath() {
  // import.meta.url 在 Worker 中形如 file:///path/to/embeddingWorker.js
  const workerDir = path.dirname(new URL(import.meta.url).pathname);
  // 从 src/utils/ 向上两级到项目根目录，再进入 models/
  const bundledDir = path.join(workerDir, "..", "..", "models", "multilingual-e5-small");

  // 检查是否包含量化模型权重文件
  const quantizedPath = path.join(bundledDir, "onnx", "model_quantized.onnx");
  if (fs.existsSync(quantizedPath)) {
    return bundledDir;
  }

  return null;
}

/**
 * 加载本地向量模型（只加载一次）
 *
 * 优先从项目内置路径加载量化版模型（打包后免下载），
 * 如果内置路径不存在则回退到远程下载（缓存在用户目录）。
 */
async function ensureModel() {
  if (pipeline) return;
  if (modelLoading) {
    await modelLoading;
    return;
  }

  modelLoading = (async () => {
    const transformers = await import("@huggingface/transformers");

    // 检查是否有项目内置模型
    const bundledPath = getBundledModelPath();

    if (bundledPath) {
      // 从内置路径加载，无需联网
      console.log("[embeddingWorker] 从项目内置路径加载量化模型...");
      pipeline = await transformers.pipeline(
        "feature-extraction",
        bundledPath,
        { dtype: "q8" },
      );
      console.log("[embeddingWorker] 模型加载完成（内置量化版）");
    } else {
      // 回退：从远程下载量化版模型，缓存到用户目录
      console.log(
        "[embeddingWorker] 未找到内置模型，正在下载量化版模型（约 120MB）...",
      );
      transformers.env.cacheDir = path.join(
        os.homedir(),
        ".minicode",
        "transformers-cache",
      );
      transformers.env.remoteHost = "https://hf-mirror.com";
      pipeline = await transformers.pipeline(
        "feature-extraction",
        LOCAL_MODEL_NAME,
        { dtype: "q8" },
      );
      console.log("[embeddingWorker] 模型加载完成（远程下载量化版）");
    }
  })();

  await modelLoading;
}

/**
 * 计算单条文本的向量
 * multilingual-e5 模型要求输入文本带前缀以区分查询和文档
 */
async function computeEmbedding(text, isQuery) {
  await ensureModel();
  const prefix = isQuery ? "query: " : "passage: ";
  const output = await pipeline(`${prefix}${text}`, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data);
}

// 监听主线程消息，计算向量后回传
parentPort.on("message", async ({ id, text, isQuery }) => {
  try {
    const result = await computeEmbedding(text, isQuery);
    parentPort.postMessage({ id, result });
  } catch (error) {
    parentPort.postMessage({ id, error: error.message });
  }
});
