import { runChatCF, runEmbeddingCF } from './providers/cloudflare.js';
import { runChatOpenAI, runEmbeddingOpenAI } from './providers/openai.js';
import { aiCache, buildCacheKey } from '../utils/ai-cache.js';
import { canProceedCall, recordCall } from '../utils/ai-budget.js';

const DEFAULT_PROVIDER = (process.env.AI_PROVIDER || 'cloudflare').toLowerCase();
const MAX_OUTPUT_TOKENS = parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '512', 10);
const CACHE_TTL_MS = parseInt(process.env.AI_CACHE_TTL_SECONDS || '3600', 10) * 1000;
const EMBED_CACHE_TTL_MS = parseInt(process.env.AI_EMBED_CACHE_TTL_SECONDS || '604800', 10) * 1000; // 7d

function resolveProvider(explicit) {
  const p = (explicit || DEFAULT_PROVIDER).toLowerCase();
  if (['cloudflare', 'cf'].includes(p)) return 'cloudflare';
  if (['openai', 'gateway', 'groq', 'deepseek'].includes(p)) return p; // handled by openai-compatible impl
  return 'cloudflare';
}

export async function runChat({ provider, model, prompt, messages, temperature, max_tokens }) {
  const p = resolveProvider(provider);
  const finalMaxTokens = Math.min(parseInt(max_tokens || MAX_OUTPUT_TOKENS, 10), MAX_OUTPUT_TOKENS);

  // Budget guardrail
  if (!canProceedCall()) {
    throw new Error('AI daily budget exceeded');
  }

  // Cache lookup
  const key = buildCacheKey({ t: 'chat', p, model, prompt, messages, temperature, max_tokens: finalMaxTokens });
  const cached = aiCache.get(key);
  if (cached) return cached;

  let res;
  if (p === 'cloudflare') {
    res = await runChatCF({ model, prompt, messages, temperature, max_tokens: finalMaxTokens });
  } else {
    // OpenAI-compatible providers
    res = await runChatOpenAI({ provider: p, model, prompt, messages, temperature, max_tokens: finalMaxTokens });
  }
  recordCall();
  aiCache.set(key, res, CACHE_TTL_MS);
  return res;
}

export async function runEmbedding({ provider, model, text }) {
  const p = resolveProvider(provider);
  // Prefer cache, embeddings are deterministic for given model+input
  const key = buildCacheKey({ t: 'embed', p, model, text });
  const cached = aiCache.get(key);
  if (cached) return cached;

  // Budget guardrail (count embeddings too)
  if (!canProceedCall()) {
    throw new Error('AI daily budget exceeded');
  }

  let res;
  if (p === 'cloudflare') {
    res = await runEmbeddingCF({ model, text });
  } else {
    res = await runEmbeddingOpenAI({ provider: p, model, text });
  }
  recordCall();
  aiCache.set(key, res, EMBED_CACHE_TTL_MS);
  return res;
}
