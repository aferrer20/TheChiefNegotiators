// Netlify Function: server-side AI for the Prospect Desk.
// Keeps the Anthropic API key off the browser.
//
// Netlify -> Site configuration -> Environment variables:
//   ANTHROPIC_API_KEY  (required)  your key from console.anthropic.com
//   ANTHROPIC_MODEL    (optional)  defaults to claude-sonnet-5-5
//   DESK_KEY           (optional)  shared secret; enter the same value in
//                                  Prospect Desk -> Desk settings -> Desk key
//   ALLOWED_ORIGIN     (optional)  e.g. https://thechiefnegotiators.com

const MAX_TOKENS = 3000;

export default async (req) => {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  const cors = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'content-type, x-desk-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(500, { error: 'ANTHROPIC_API_KEY is not set on Netlify.' });
  if (process.env.DESK_KEY && req.headers.get('x-desk-key') !== process.env.DESK_KEY) {
    return json(401, { error: 'Desk key does not match. Set it in Desk settings.' });
  }

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
  const { system, messages } = body || {};
  if (typeof system !== 'string' || !Array.isArray(messages) || !messages.length) {
    return json(400, { error: 'Expected { system, messages }' });
  }

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: Math.min(Number(body.max_tokens) || 2400, MAX_TOKENS),
      system,
      messages: messages.slice(-20).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 40000) })),
    }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json(r.status, { error: (data.error && data.error.message) || 'Anthropic API error' });
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return json(200, { text });
};
