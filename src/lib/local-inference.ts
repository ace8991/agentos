/**
 * Local LLM inference via WebLLM (in-browser, WebGPU)
 * and llama-cpp-python (backend).
 *
 * NOTE: @mlc-ai/web-llm is an optional peer dependency.
 * Install it with: npm install @mlc-ai/web-llm
 * The app works without it — WebLLM features will be disabled.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface LocalModel {
  id: string;
  name: string;
  size: string;
  source: 'webllm' | 'backend';
  status: 'available' | 'downloading' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

export interface DownloadProgress {
  modelId: string;
  progress: number;
  timeElapsed: number;
  text: string;
}

// ─── WebLLM Engine (lazy, no static import) ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let engine: any = null;
let currentLoadedModel: string | null = null;

const WEBLLM_MODELS: LocalModel[] = [
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',        name: 'SmolLM2 1.7B',    size: '~1 GB',    source: 'webllm', status: 'available' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',        name: 'Qwen2.5 1.5B',    size: '~1 GB',    source: 'webllm', status: 'available' },
  { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',        name: 'Llama 3.2 3B',    size: '~2 GB',    source: 'webllm', status: 'available' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',        name: 'Phi 3.5 Mini',    size: '~2.3 GB',  source: 'webllm', status: 'available' },
  { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',     name: 'Mistral 7B',      size: '~4 GB',    source: 'webllm', status: 'available' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC',               name: 'Gemma 2 2B',      size: '~1.4 GB',  source: 'webllm', status: 'available' },
  { id: 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC',    name: 'TinyLlama 1.1B',  size: '~700 MB',  source: 'webllm', status: 'available' },
  { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',          name: 'Qwen2.5 3B',      size: '~2 GB',    source: 'webllm', status: 'available' },
];

const LOCAL_MODELS_STORAGE_KEY = 'LOCAL_MODELS_STATE';

export function getAvailableWebLLMModels(): LocalModel[] {
  const saved = loadModelStates();
  return WEBLLM_MODELS.map((m) => ({
    ...m,
    status: saved[m.id] || m.status,
  }));
}

function loadModelStates(): Record<string, LocalModel['status']> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_MODELS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveModelState(modelId: string, status: LocalModel['status']) {
  const states = loadModelStates();
  states[modelId] = status;
  localStorage.setItem(LOCAL_MODELS_STORAGE_KEY, JSON.stringify(states));
}

export function isWebGPUSupported(): boolean {
  return 'gpu' in navigator;
}

export async function loadWebLLMModel(
  modelId: string,
  onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
  if (!isWebGPUSupported()) {
    throw new Error('WebGPU is not supported in this browser. Use Chrome 113+ or Edge 113+.');
  }
  if (currentLoadedModel === modelId && engine) return;

  saveModelState(modelId, 'downloading');
  const startTime = Date.now();

  try {
    // Dynamic import — avoids static reference to @mlc-ai/web-llm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webllm: any = await import(/* @vite-ignore */ '@mlc-ai/web-llm');
    engine = new webllm.MLCEngine();

    engine.setInitProgressCallback((report: { progress: number; text: string }) => {
      onProgress?.({
        modelId,
        progress: report.progress,
        timeElapsed: (Date.now() - startTime) / 1000,
        text: report.text,
      });
    });

    await engine.reload(modelId);
    currentLoadedModel = modelId;
    saveModelState(modelId, 'ready');
  } catch (err) {
    saveModelState(modelId, 'error');
    engine = null;
    currentLoadedModel = null;
    throw err;
  }
}

export async function chatWebLLM(
  messages: { role: string; content: string }[],
  modelId: string,
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
  onProgress?: (p: DownloadProgress) => void,
) {
  try {
    await loadWebLLMModel(modelId, onProgress);
    if (!engine) throw new Error('Engine not initialized');

    const reply = await engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.7,
    });

    for await (const chunk of reply) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) onToken(delta);
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : 'WebLLM inference failed');
  }
}

export function unloadWebLLMModel() {
  if (engine) {
    engine.unload();
    engine = null;
    currentLoadedModel = null;
  }
}

export function getCurrentLoadedModel(): string | null {
  return currentLoadedModel;
}

// ─── Backend llama.cpp inference ─────────────────────────────────────

const BACKEND_GGUF_MODELS_KEY = 'BACKEND_GGUF_MODELS';

export interface BackendGGUFModel {
  id: string;
  name: string;
  hfRepo: string;
  fileName: string;
  size: string;
  status: 'available' | 'downloading' | 'ready' | 'error';
}

const DEFAULT_BACKEND_MODELS: BackendGGUFModel[] = [
  { id: 'llama-3.2-1b',  name: 'Llama 3.2 1B',    hfRepo: 'bartowski/Llama-3.2-1B-Instruct-GGUF',        fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',        size: '~800 MB',  status: 'available' },
  { id: 'llama-3.2-3b',  name: 'Llama 3.2 3B',    hfRepo: 'bartowski/Llama-3.2-3B-Instruct-GGUF',        fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',        size: '~2 GB',    status: 'available' },
  { id: 'mistral-7b',    name: 'Mistral 7B v0.3', hfRepo: 'bartowski/Mistral-7B-Instruct-v0.3-GGUF',     fileName: 'Mistral-7B-Instruct-v0.3-Q4_K_M.gguf',     size: '~4 GB',    status: 'available' },
  { id: 'phi-3-mini',    name: 'Phi 3 Mini',      hfRepo: 'bartowski/Phi-3-mini-4k-instruct-GGUF',       fileName: 'Phi-3-mini-4k-instruct-Q4_K_M.gguf',       size: '~2.3 GB',  status: 'available' },
  { id: 'qwen2.5-3b',    name: 'Qwen2.5 3B',      hfRepo: 'Qwen/Qwen2.5-3B-Instruct-GGUF',               fileName: 'qwen2.5-3b-instruct-q4_k_m.gguf',           size: '~2 GB',    status: 'available' },
  { id: 'gemma-2-2b',    name: 'Gemma 2 2B',      hfRepo: 'bartowski/gemma-2-2b-it-GGUF',                fileName: 'gemma-2-2b-it-Q4_K_M.gguf',                size: '~1.4 GB',  status: 'available' },
];

export function getBackendGGUFModels(): BackendGGUFModel[] {
  try {
    const saved = JSON.parse(localStorage.getItem(BACKEND_GGUF_MODELS_KEY) || '[]');
    return saved.length > 0 ? saved : DEFAULT_BACKEND_MODELS;
  } catch {
    return DEFAULT_BACKEND_MODELS;
  }
}

export function saveBackendGGUFModels(models: BackendGGUFModel[]) {
  localStorage.setItem(BACKEND_GGUF_MODELS_KEY, JSON.stringify(models));
}

export function isLocalModel(modelId: string): boolean {
  return modelId.startsWith('local/') || modelId.startsWith('webllm/');
}

export function getLocalModelDisplayName(modelId: string): string {
  if (modelId.startsWith('webllm/')) {
    const id = modelId.replace('webllm/', '');
    return WEBLLM_MODELS.find((m) => m.id === id)?.name || id;
  }
  if (modelId.startsWith('local/')) {
    const id = modelId.replace('local/', '');
    return getBackendGGUFModels().find((m) => m.id === id)?.name || id;
  }
  return modelId;
}
