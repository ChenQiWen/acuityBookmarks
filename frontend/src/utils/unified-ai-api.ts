/**
 * 统一 AI Service
 * - 封装对 Cloudflare Worker /api/ai/complete 的调用
 * - 提供 completion（单轮）与 chat（多轮）两种接口
 * - 健壮的错误处理与超时控制
 */

export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiCompleteOptions {
  model?: string; // 默认: '@cf/meta/llama-3.1-8b-instruct'
  temperature?: number; // 默认: 0.6
  maxTokens?: number; // 默认: 256
  stream?: boolean; // 目前前端不处理SSE流, 建议 false
  signal?: AbortSignal;
}

export interface AiChatOptions extends AiCompleteOptions {}

export interface AiResponseMeta {
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  source?: 'chrome' | 'cloudflare';
  raw?: unknown; // 保留原始返回，便于调试
}

export interface AiResponse {
  text: string;
  meta?: AiResponseMeta;
}

import { API_CONFIG, AI_CONFIG } from '../config/constants';
import { logger } from './logger';

// 统一获取内置AI对象
function getChromeAI(): any | null {
  const w: any = (typeof window !== 'undefined') ? window : {};
  const c: any = (typeof chrome !== 'undefined') ? chrome : {};
  return w.ai || c.ai || null;
}

// 分发指标事件，便于UI显示延迟与token用量
function emitAIMetrics(detail: {
  provider: 'chrome' | 'cloudflare';
  model?: string;
  latencyMs?: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
}) {
  try {
    window.dispatchEvent(new CustomEvent('ai:metrics', { detail }));
  } catch {}
}

// 基于 Prompt API 的最佳实践：可用性检查 + 模型创建 + 复用会话
let chromeAISession: any | null = null;
async function ensureChromeSession(options: AiCompleteOptions = {}): Promise<any | null> {
  try {
    const ai: any = getChromeAI();
    if (!ai) return null;

    // 可用性检测（若支持）
    if (typeof ai.availability === 'function') {
      const status = await ai.availability();
      // Prompt API常见状态：'readily' | 'after_download' | 'unsupported'
      if (status !== 'readily') return null;
    }

    // 复用已有会话
    if (chromeAISession) return chromeAISession;

    // 创建语言模型会话（若支持）
    if (typeof ai.create === 'function') {
      const temperature = options.temperature ?? AI_CONFIG.DEFAULT_TEMPERATURE;
      const topK = AI_CONFIG.DEFAULT_TOP_K;
      const maxTokens = options.maxTokens ?? AI_CONFIG.DEFAULT_MAX_TOKENS;
      const params: any = {
        temperature,
        topK,
        // Prompt API通常使用 maxOutputTokens 命名
        maxOutputTokens: maxTokens,
        // 可选模型名称
        model: AI_CONFIG.CHROME_MODEL,
        // 初始提示（系统指令）
        initialPrompts: AI_CONFIG.INITIAL_PROMPTS
      };

      chromeAISession = await ai.create(params);
      try {
        const detail = { provider: 'chrome', model: AI_CONFIG.CHROME_MODEL };
        window.dispatchEvent(new CustomEvent('ai:providerChanged', { detail }));
      } catch {}
      return chromeAISession;
    }

    return null;
  } catch (err) {
    logger.warn('ensureChromeSession 创建会话失败:', err);
    return null;
  }
}

async function runSessionPrompt(session: any, text: string): Promise<string | null> {
  try {
    if (!session) return null;
    // 常见方法名兼容
    if (typeof session.prompt === 'function') {
      const res = await session.prompt(text);
      return (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '') || null;
    }
    if (typeof session.output === 'function') {
      const res = await session.output({ text });
      return (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '') || null;
    }
    if (typeof session.sendMessage === 'function') {
      const res = await session.sendMessage(text);
      return (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '') || null;
    }
    return null;
  } catch (err) {
    logger.warn('runSessionPrompt 执行失败:', err);
    return null;
  }
}

function getBaseUrl(): string {
  // 统一走全局 API 配置，避免环境变量键名不一致导致的回退到同源
  // API_CONFIG 会在生产环境优先使用 VITE_CLOUDFLARE_WORKER_URL，
  // 开发环境优先使用 VITE_API_BASE_URL 或 localhost
  return API_CONFIG.API_BASE || '';
}

async function safeFetchJson(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<any> {
  const { timeoutMs = 15000, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      ...rest,
      headers: {
        'content-type': 'application/json',
        ...(rest.headers || {})
      },
      signal: rest.signal ?? controller.signal
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`AI API HTTP ${resp.status}: ${text || resp.statusText}`);
    }
    return await resp.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseAiAnswer(answer: any): AiResponse {
  // Cloudflare Workers AI 文本模型通常返回 { response: string, ... }
  let text = '';
  if (typeof answer === 'string') {
    text = answer;
  } else if (typeof answer?.response === 'string') {
    text = answer.response;
  } else if (typeof answer?.output_text === 'string') {
    text = answer.output_text;
  } else if (Array.isArray(answer?.choices) && answer.choices.length > 0) {
    const choice = answer.choices[0];
    text = choice?.message?.content || choice?.text || '';
  } else {
    // 兜底：序列化为字符串便于展示
    text = JSON.stringify(answer);
  }

  const usage = answer?.usage || answer?.tokenUsage || undefined;
  const model = answer?.model || undefined;

  return {
    text,
    meta: {
      model,
      usage,
      source: 'cloudflare',
      raw: answer
    }
  };
}

function isChromeAIAvailable(): boolean {
  return !!getChromeAI();
}

async function callChromeComplete(prompt: string, options: AiCompleteOptions): Promise<AiResponse | null> {
  try {
    const ai: any = getChromeAI();
    if (!ai) return null;

    // 宽松适配多种可能的内置API命名
    const temperature = options.temperature ?? AI_CONFIG.DEFAULT_TEMPERATURE;
    const maxTokens = options.maxTokens ?? AI_CONFIG.DEFAULT_MAX_TOKENS;

    // 优先使用 Prompt API 会话
    const session = await ensureChromeSession(options);
    if (session) {
      const t0 = performance.now();
      const text = await runSessionPrompt(session, prompt);
      const latencyMs = performance.now() - t0;
      if (text != null) {
        emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs, usage: null });
        return { text, meta: { source: 'chrome', raw: { sessionUsed: true } } };
      }
    }

    let res: any;
    if (typeof ai.generateText === 'function') {
      const t0 = performance.now();
      res = await ai.generateText({ prompt, temperature, maxTokens });
      const text = (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '');
      emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs: performance.now() - t0, usage: null });
      return { text: text || '', meta: { source: 'chrome', raw: res } };
    }
    if (typeof ai.invoke === 'function') {
      const t0 = performance.now();
      res = await ai.invoke({ prompt, temperature, maxTokens });
      const text = (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '');
      emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs: performance.now() - t0, usage: null });
      return { text: text || '', meta: { source: 'chrome', raw: res } };
    }
    if (typeof ai.complete === 'function') {
      const t0 = performance.now();
      res = await ai.complete({ prompt, temperature, maxTokens });
      const text = (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '');
      emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs: performance.now() - t0, usage: null });
      return { text: text || '', meta: { source: 'chrome', raw: res } };
    }
    if (typeof ai.run === 'function') {
      const t0 = performance.now();
      res = await ai.run({ prompt, temperature, maxTokens });
      const text = (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '');
      emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs: performance.now() - t0, usage: null });
      return { text: text || '', meta: { source: 'chrome', raw: res } };
    }

    // Assistant风格会话（若可用）
    if (ai.assistant && typeof ai.assistant.create === 'function') {
      const session = await ai.assistant.create({ temperature });
      const output = await session.output({ text: prompt });
      const text = (typeof output === 'string') ? output : (output?.text ?? output?.response ?? '');
      return { text: text || '', meta: { source: 'chrome', raw: output } };
    }

    return null; // 未匹配到可用方法
  } catch (err) {
    logger.warn('Chrome内置AI调用失败，回退到Cloudflare:', err);
    return null;
  }
}

async function callCloudflareComplete(prompt: string, options: AiCompleteOptions): Promise<AiResponse> {
  const base = getBaseUrl();
  const url = `${base}/api/ai/complete`;
  const body = {
    prompt,
    model: options.model ?? AI_CONFIG.CLOUDFLARE_DEFAULT_MODEL,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.maxTokens ?? 256,
    stream: options.stream === true ? true : false
  };
  const t0 = performance.now();
  const answer = await safeFetchJson(url, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options.signal
  });
  const res = parseAiAnswer(answer);
  const latencyMs = performance.now() - t0;
  emitAIMetrics({ provider: 'cloudflare', model: res?.meta?.model || body.model, latencyMs, usage: res?.meta?.usage || null });
  return res;
}

async function callChromeChat(messages: AiMessage[], options: AiChatOptions): Promise<AiResponse | null> {
  try {
    const ai: any = getChromeAI();
    if (!ai) return null;

    const temperature = options.temperature ?? AI_CONFIG.DEFAULT_TEMPERATURE;
    const maxTokens = options.maxTokens ?? AI_CONFIG.DEFAULT_MAX_TOKENS;
    // 简化为拼接内容；会话已使用 initialPrompts 作为系统指令
    const userText = messages.map(m => m.content).join('\n');

    // 优先使用 Prompt API 会话
    const session = await ensureChromeSession(options);
    if (session) {
      const t0 = performance.now();
      const text = await runSessionPrompt(session, userText);
      const latencyMs = performance.now() - t0;
      if (text != null) {
        emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs, usage: null });
        return { text, meta: { source: 'chrome', raw: { sessionUsed: true } } };
      }
    }

    // 优先使用与complete相同的一组方法
    if (typeof ai.generateText === 'function') {
      const t0 = performance.now();
      const res = await ai.generateText({ prompt: userText, temperature, maxTokens });
      const text = (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '');
      emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs: performance.now() - t0, usage: null });
      return { text: text || '', meta: { source: 'chrome', raw: res } };
    }
    if (typeof ai.invoke === 'function') {
      const t0 = performance.now();
      const res = await ai.invoke({ prompt: userText, temperature, maxTokens });
      const text = (typeof res === 'string') ? res : (res?.text ?? res?.response ?? '');
      emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs: performance.now() - t0, usage: null });
      return { text: text || '', meta: { source: 'chrome', raw: res } };
    }
    if (ai.assistant && typeof ai.assistant.create === 'function') {
      const t0 = performance.now();
      const session = await ai.assistant.create({ temperature });
      const output = await session.output({ text: userText });
      const text = (typeof output === 'string') ? output : (output?.text ?? output?.response ?? '');
      emitAIMetrics({ provider: 'chrome', model: AI_CONFIG.CHROME_MODEL, latencyMs: performance.now() - t0, usage: null });
      return { text: text || '', meta: { source: 'chrome', raw: output } };
    }

    return null;
  } catch (err) {
    console.warn('Chrome内置AI聊天失败，回退到Cloudflare:', err);
    return null;
  }
}

async function callCloudflareChat(messages: AiMessage[], options: AiChatOptions): Promise<AiResponse> {
  const base = getBaseUrl();
  const url = `${base}/api/ai/complete`;
  const body = {
    messages,
    model: options.model ?? AI_CONFIG.CLOUDFLARE_DEFAULT_MODEL,
    temperature: options.temperature ?? 0.6,
    max_tokens: options.maxTokens ?? 256,
    stream: options.stream === true ? true : false
  };
  const t0 = performance.now();
  const answer = await safeFetchJson(url, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options.signal
  });
  const res = parseAiAnswer(answer);
  const latencyMs = performance.now() - t0;
  emitAIMetrics({ provider: 'cloudflare', model: res?.meta?.model || body.model, latencyMs, usage: res?.meta?.usage || null });
  return res;
}

export class UnifiedAIAPI {
  static async complete(prompt: string, options: AiCompleteOptions = {}): Promise<AiResponse> {
    if (!prompt || !prompt.trim()) {
      throw new Error('prompt 不能为空');
    }
    const mode = AI_CONFIG.PROVIDER;
    if (mode === 'chrome' || (mode === 'auto' && isChromeAIAvailable())) {
      const chromeRes = await callChromeComplete(prompt, options);
      if (chromeRes && chromeRes.text) {
        logger.info('AI', 'Provider: chrome');
        try {
          const detail = { provider: 'chrome', model: AI_CONFIG.CHROME_MODEL };
          window.dispatchEvent(new CustomEvent('ai:providerChanged', { detail }));
        } catch {}
        return chromeRes;
      }
    }
    logger.info('AI', 'Provider: cloudflare');
    const cfRes = await callCloudflareComplete(prompt, options);
    try {
      const detail = { provider: 'cloudflare', model: cfRes?.meta?.model || (options.model ?? '@cf/meta/llama-3.1-8b-instruct') };
      window.dispatchEvent(new CustomEvent('ai:providerChanged', { detail }));
    } catch {}
    return cfRes;
  }

  static async chat(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiResponse> {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages 不能为空');
    }
    const mode = AI_CONFIG.PROVIDER;
    if (mode === 'chrome' || (mode === 'auto' && isChromeAIAvailable())) {
      const chromeRes = await callChromeChat(messages, options);
      if (chromeRes && chromeRes.text) {
        logger.info('🧠 [AI] Provider: chrome');
        try {
          const detail = { provider: 'chrome', model: AI_CONFIG.CHROME_MODEL };
          window.dispatchEvent(new CustomEvent('ai:providerChanged', { detail }));
        } catch {}
        return chromeRes;
      }
    }
    logger.info('🧠 [AI] Provider: cloudflare');
    const cfRes = await callCloudflareChat(messages, options);
    try {
      const detail = { provider: 'cloudflare', model: cfRes?.meta?.model || (options.model ?? '@cf/meta/llama-3.1-8b-instruct') };
      window.dispatchEvent(new CustomEvent('ai:providerChanged', { detail }));
    } catch {}
    return cfRes;
  }

  // 生成文本嵌入向量（调用后端Cloudflare Worker端点）
  static async embedding(text: string, options: { model?: string; signal?: AbortSignal } = {}): Promise<number[]> {
    if (!text || !text.trim()) {
      return [];
    }
    const base = getBaseUrl();
    const url = `${base}/api/ai/embedding`;
    const body = {
      text,
      model: options.model ?? '@cf/baai/bge-m3'
    };
    const answer = await safeFetchJson(url, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: options.signal
    });
    // 兼容多种返回格式
    if (Array.isArray(answer)) return answer as number[];
    if (Array.isArray(answer?.data)) return answer.data as number[];
    if (Array.isArray(answer?.vector)) return answer.vector as number[];
    if (Array.isArray(answer?.response)) return answer.response as number[];
    if (Array.isArray(answer?.embeddings)) return answer.embeddings as number[];
    return [];
  }

  static async generateTags(title: string, content: string, options: AiCompleteOptions = {}): Promise<string[]> {
    if (!title && !content) {
      return [];
    }

    const prompt = `${AI_CONFIG.TAG_GENERATION_PROMPT}\n\nInput: "${title}", content: "${content.substring(0, 500)}..."`;

    try {
      const response = await this.complete(prompt, {
        ...options,
        temperature: 0.2, // Lower temperature for more deterministic output
        maxTokens: 64,    // Sufficient for a few tags
      });

      const text = response.text.trim();
      let tags: string[] = [];

      // Robustly parse the JSON array
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          tags = parsed.filter((tag: any) => typeof tag === 'string' && tag.length > 0);
        }
      } catch {
        // Fallback for non-JSON or malformed JSON responses
        tags = text.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      }

      return tags.slice(0, 3); // Limit to 3 tags
    } catch (error) {
      logger.error('Error generating tags:', error);
      return [];
    }
  }
}

export default UnifiedAIAPI;