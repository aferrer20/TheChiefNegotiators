// Netlify Function: storage for the Exchange floor (lots + open requirements).
// Served at /.netlify/functions/exchange
//
//   GET                      -> public: { lots, requirements, updated_at }
//   POST {action:'check'}    -> admin: verifies the password
//   POST {action:'save', data:{lots, requirements}, base}
//                            -> admin: replaces the floor. `base` is the
//                               updated_at the console loaded; a mismatch
//                               means someone else saved first (409).
//
// Admin requests send the password in the x-admin-password header.
// Netlify -> Site configuration -> Environment variables:
//   EXCHANGE_ADMIN_PASSWORD  (required for editing) a long password
//
// Data lives in Netlify Blobs (store "exchange", key "floor"); no other service needed.

import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

const KEY = 'floor';
const MAX_ITEMS = 500;

const LOT_FIELDS = {
  ref: 'str', kind: 'kind', model: 'str', config: 'str', gpu_count: 'num', condition: 'str',
  region: 'str', available: 'str', price: 'num', price_unit: 'str', term_months: 'num',
  deposit_pct: 'num', min_commit: 'num', featured: 'bool', status: 'status', notes: 'text',
  created_at: 'str',
};
const REQ_FIELDS = { id: 'str', kind: 'kind', model: 'str', gpu_count: 'num', region: 'str', timeline: 'str', status: 'status', created_at: 'str' };

function clean(o, fields) {
  const out = {};
  for (const [k, t] of Object.entries(fields)) {
    let v = o[k];
    if (v === undefined || v === null || v === '') { out[k] = t === 'bool' ? false : null; continue; }
    if (t === 'num') { v = Number(v); out[k] = Number.isFinite(v) ? v : null; }
    else if (t === 'bool') out[k] = v === true || v === 'true';
    else if (t === 'kind') out[k] = ['gpuaas', 'hardware', 'either'].includes(v) ? v : 'hardware';
    else if (t === 'status') out[k] = ['live', 'reserved', 'hidden', 'open', 'closed'].includes(v) ? v : 'live';
    else out[k] = String(v).slice(0, t === 'text' ? 2000 : 200);
  }
  return out;
}

function sameSecret(a, b) {
  const h = (s) => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(a), h(b));
}

// Pages on these origins may call this function from the browser, so the
// exchange and console work wherever the HTML itself is served from.
const ORIGINS = [
  /^https:\/\/((www|portal|www\.portal)\.)?thechiefnegotiators\.com$/,
  /^https:\/\/([a-z0-9-]+--)?chiefnegotiators\.netlify\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const cors = ORIGINS.some((r) => r.test(origin)) ? {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, x-admin-password',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'origin',
  } : { vary: 'origin' };
  const json = (status, body) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const store = getStore({ name: 'exchange', consistency: 'strong' });
  const read = async () => (await store.get(KEY, { type: 'json' })) || { lots: [], requirements: [], updated_at: null };

  if (req.method === 'GET') {
    const d = await read();
    return json(200, {
      lots: d.lots.filter((l) => l.status !== 'hidden'),
      requirements: d.requirements.filter((r) => r.status === 'open'),
      updated_at: d.updated_at,
    });
  }
  if (req.method !== 'POST') return json(405, { error: 'GET or POST only' });

  const pass = process.env.EXCHANGE_ADMIN_PASSWORD;
  if (!pass) return json(503, { error: 'Set EXCHANGE_ADMIN_PASSWORD in Netlify environment variables, then redeploy.' });
  if (!sameSecret(req.headers.get('x-admin-password') || '', pass)) return json(401, { error: 'Wrong password.' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }

  if (body.action === 'check' || body.action === 'load') return json(200, await read());

  if (body.action === 'save') {
    const d = body.data || {};
    if (!Array.isArray(d.lots) || !Array.isArray(d.requirements)) return json(400, { error: 'Expected { lots: [], requirements: [] }' });
    if (d.lots.length > MAX_ITEMS || d.requirements.length > MAX_ITEMS) return json(400, { error: 'Too many items' });
    const cur = await read();
    if (body.base !== undefined && cur.updated_at && body.base !== cur.updated_at) {
      return json(409, { error: 'The floor was changed somewhere else. Reload and try again.', current: cur });
    }
    const next = {
      lots: d.lots.map((l) => clean(l, LOT_FIELDS)).map((l) => ({ ...l, status: ['reserved', 'hidden'].includes(l.status) ? l.status : 'live' })).filter((l) => l.ref && l.model && l.gpu_count),
      requirements: d.requirements.map((r) => clean(r, REQ_FIELDS)).map((r) => ({ ...r, status: r.status === 'closed' ? 'closed' : 'open' })).filter((r) => r.id && r.model && r.gpu_count),
      updated_at: new Date().toISOString(),
    };
    await store.setJSON(KEY, next);
    return json(200, next);
  }
  return json(400, { error: 'Unknown action' });
};
