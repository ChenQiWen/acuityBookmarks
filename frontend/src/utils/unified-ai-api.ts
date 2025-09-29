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
  raw?: unknown; // 保留原始返回，便于调试
}

export interface AiResponse {
  text: string;
  meta?: AiResponseMeta;
}

function getBaseUrl(): string {
  // 优先使用 Worker Base URL（如 http://localhost:8787）
  const workerBase = (import.meta as any)?.env?.VITE_WORKER_BASE_URL as string | undefined;
  if (workerBase) return workerBase;
  // 其次使用通用 API Base URL（如 http://localhost:3000）
  const apiBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (apiBase) return apiBase;
  // 最后回退到同源（部署到同域时生效）
  return '';
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
      raw: answer
    }
  };
}

export class UnifiedAIAPI {
  static async complete(prompt: string, options: AiCompleteOptions = {}): Promise<AiResponse> {
    if (!prompt || !prompt.trim()) {
      throw new Error('prompt 不能为空');
    }
    const base = getBaseUrl();
    const url = `${base}/api/ai/complete`;
    const body = {
      prompt,
      model: options.model ?? '@cf/meta/llama-3.1-8b-instruct',
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 256,
      stream: options.stream === true ? true : false
    };
    // 目前不支持前端SSE解析，若要求 stream=true，则由后端直接返回流。
    // 这里统一走非流式，以保证稳健性。
    const answer = await safeFetchJson(url, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: options.signal
    });
    return parseAiAnswer(answer);
  }

  static async chat(messages: AiMessage[], options: AiChatOptions = {}): Promise<AiResponse> {
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('messages 不能为空');
    }
    const base = getBaseUrl();
    const url = `${base}/api/ai/complete`;
    const body = {
      messages,
      model: options.model ?? '@cf/meta/llama-3.1-8b-instruct',
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 256,
      stream: options.stream === true ? true : false
    };
    const answer = await safeFetchJson(url, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: options.signal
    });
    return parseAiAnswer(answer);
  }
}

export default UnifiedAIAPI;