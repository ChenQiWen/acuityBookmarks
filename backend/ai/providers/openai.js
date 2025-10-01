// Generic OpenAI-compatible provider (OpenAI, Groq, DeepSeek, AI Gateway)

function resolveBaseAndKey(provider) {
  // Priority: provider-specific envs -> gateway -> generic
  if (provider === 'groq') {
    return {
      base: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      key: process.env.GROQ_API_KEY
    };
  }
  if (provider === 'deepseek') {
    return {
      base: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      key: process.env.DEEPSEEK_API_KEY
    };
  }
  if (provider === 'gateway') {
    return {
      base: process.env.AI_GATEWAY_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      key: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY
    };
  }
  // default: openai
  return {
    base: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    key: process.env.OPENAI_API_KEY
  };
}

export async function runChatOpenAI({ provider = 'openai', model, prompt, messages, temperature, max_tokens }) {
  const { base, key } = resolveBaseAndKey(provider);
  if (!key) throw new Error('Missing API key for OpenAI-compatible provider');

  const url = `${base.replace(/\/$/, '')}/chat/completions`;
  const payload = {
    model,
    messages: Array.isArray(messages) && messages.length > 0 ? messages : [{ role: 'user', content: prompt || '' }],
    temperature,
    max_tokens
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`OpenAI-compatible HTTP ${resp.status}: ${text}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { response: text };
  }
  const content = data?.choices?.[0]?.message?.content ?? data;
  return { response: content, raw: data };
}

export async function runEmbeddingOpenAI({ provider = 'openai', model, text }) {
  const { base, key } = resolveBaseAndKey(provider);
  if (!key) throw new Error('Missing API key for OpenAI-compatible provider');

  const url = `${base.replace(/\/$/, '')}/embeddings`;
  const payload = { model, input: text };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const textResp = await resp.text();
  if (!resp.ok) throw new Error(`OpenAI-compatible HTTP ${resp.status}: ${textResp}`);
  let data;
  try {
    data = JSON.parse(textResp);
  } catch {
    return { vector: textResp };
  }
  const embedding = data?.data?.[0]?.embedding ?? null;
  return { embedding, raw: data };
}
