// Cloudflare Workers AI provider (v4 REST API)
export async function runChatCF({ model, prompt, messages, temperature, max_tokens }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || process.env.CF_ACCOUNT || process.env.CLOUDFLARE_ACCOUNT;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_TOKEN;
  if (!accountId || !apiToken) throw new Error('Cloudflare credentials missing');

  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodeURIComponent(model)}`;
  const body = messages && messages.length > 0
    ? { messages, temperature, max_tokens }
    : { prompt, temperature, max_tokens };

  const resp = await fetch(cfUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await resp.text();
  if (!resp.ok) throw new Error(`Cloudflare AI HTTP ${resp.status}: ${text}`);
  try {
    const json = JSON.parse(text);
    return json.result ?? json;
  } catch {
    return { response: text };
  }
}

export async function runEmbeddingCF({ model, text }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || process.env.CF_ACCOUNT || process.env.CLOUDFLARE_ACCOUNT;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN || process.env.CLOUDFLARE_TOKEN;
  if (!accountId || !apiToken) throw new Error('Cloudflare credentials missing');

  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodeURIComponent(model)}`;
  const resp = await fetch(cfUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });

  const textResp = await resp.text();
  if (!resp.ok) throw new Error(`Cloudflare AI HTTP ${resp.status}: ${textResp}`);
  try {
    const json = JSON.parse(textResp);
    return json.result ?? json;
  } catch {
    return { vector: textResp };
  }
}
