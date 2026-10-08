// The Chief Negotiators — shared app logic
(function () {
  'use strict';

  // Fallback config in case config.js failed to load
  const CFG = window.TCN_CONFIG || { formspree: {}, inventorySheetCsvUrl: '', inventoryRefreshMs: 60000 };

  // ---------- Local storage layer (used as fallback / for admin) ----------
  const STORE_KEY = 'tcn_inventory_v1';
  const RES_KEY = 'tcn_reservations_v1';
  const WTB_KEY = 'tcn_wtb_v1';
  const SYNC_KEY = 'tcn_last_sync_v1';
  const SHEET_CACHE_KEY = 'tcn_sheet_cache_v1';

  function readStore(k, fallback) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function writeStore(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  const LocalInventory = {
    all() { return readStore(STORE_KEY, []); },
    set(list) { writeStore(STORE_KEY, list); writeStore(SYNC_KEY, Date.now()); },
    add(item) {
      const list = this.all();
      item.id = 'sku_' + Math.random().toString(36).slice(2, 9);
      item.updated = item.updated || Date.now();
      list.unshift(item); this.set(list); return item;
    },
    update(id, patch) {
      const list = this.all().map(it => it.id === id ? { ...it, ...patch, updated: Date.now() } : it);
      this.set(list);
    },
    remove(id) { this.set(this.all().filter(it => it.id !== id)); },
    clear() { this.set([]); },
    lastSync() { return readStore(SYNC_KEY, null); },
  };

  const Reservations = {
    all() { return readStore(RES_KEY, []); },
    add(item) {
      const list = this.all();
      item.id = 'res_' + Math.random().toString(36).slice(2, 9);
      item.created = Date.now();
      list.unshift(item); writeStore(RES_KEY, list); return item;
    },
  };
  const WTB = {
    all() { return readStore(WTB_KEY, []); },
    add(item) {
      const list = this.all();
      item.id = 'wtb_' + Math.random().toString(36).slice(2, 9);
      item.created = Date.now();
      list.unshift(item); writeStore(WTB_KEY, list); return item;
    },
  };

  // ---------- BOM / Quote store ----------
  // BOMs are keyed by a listing signature (model|formFactor|region) so they
  // survive sheet-row id churn. Each entry stores line items + quote meta.
  const BOM_KEY = 'tcn_boms_v1';
  const QSEQ_KEY = 'tcn_quote_seq_v1';
  function bomKey(it) {
    return [it.model || '', it.formFactor || '', it.region || '']
      .map(s => String(s).trim().toLowerCase()).join('|');
  }
  const BOMs = {
    all() { return readStore(BOM_KEY, {}); },
    get(key) { return this.all()[key] || null; },
    set(key, bom) { const m = this.all(); m[key] = { ...bom, updated: Date.now() }; writeStore(BOM_KEY, m); },
    remove(key) { const m = this.all(); delete m[key]; writeStore(BOM_KEY, m); },
    key: bomKey,
  };
  function nextQuoteNo() {
    const n = (readStore(QSEQ_KEY, 1042) || 1042) + 1;
    writeStore(QSEQ_KEY, n);
    return n;
  }

  // ---------- CSV parser (handles quoted fields & embedded commas/quotes) ----------
  function parseCSV(text) {
    const rows = [];
    let cur = [], val = '', q = false, i = 0;
    while (i < text.length) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i+1] === '"') { val += '"'; i += 2; continue; }
        if (c === '"') { q = false; i++; continue; }
        val += c; i++;
      } else {
        if (c === '"') { q = true; i++; continue; }
        if (c === ',') { cur.push(val); val = ''; i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { cur.push(val); rows.push(cur); cur = []; val = ''; i++; continue; }
        val += c; i++;
      }
    }
    if (val.length || cur.length) { cur.push(val); rows.push(cur); }
    return rows.filter(r => r.length && r.some(v => v && v.length));
  }

  function normalizeKey(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  const FIELD_MAP = {
    model: 'model',
    formfactor: 'formFactor',
    ff: 'formFactor',
    qty: 'qty', quantity: 'qty', units: 'qty',
    condition: 'condition',
    leaddays: 'leadDays', lead: 'leadDays', leadtimedays: 'leadDays',
    leadtext: 'leadText', leadtime: 'leadText',
    region: 'region', location: 'region',
    price: 'price',
    notes: 'notes',
    updated: 'updated', updatedat: 'updated', date: 'updated',
    status: 'status', active: 'status',
    id: 'id', sku: 'id',
    bomlink: 'bomLink', bom: 'bomLink', bomurl: 'bomLink',
  };

  function rowsToObjects(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => FIELD_MAP[normalizeKey(h)] || normalizeKey(h));
    return rows.slice(1).map((r, idx) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] || '').trim(); });
      // Normalize types
      if (o.qty !== undefined && o.qty !== '') o.qty = parseInt(o.qty, 10);
      if (o.leadDays !== undefined && o.leadDays !== '') o.leadDays = parseInt(o.leadDays, 10);
      // Parse Updated as timestamp; otherwise treat as now
      if (o.updated) {
        const t = Date.parse(o.updated);
        o.updated = isNaN(t) ? Date.now() : t;
      } else {
        o.updated = Date.now();
      }
      // Status filter
      o.status = (o.status || '').toLowerCase();
      // Synthetic id if missing
      if (!o.id) o.id = 'row_' + idx;
      return o;
    }).filter(o => o.model && o.status !== 'inactive' && o.status !== 'hidden' && o.status !== 'no');
  }

  // ---------- Sheet fetcher with cache ----------
  const Sheet = {
    inflight: null,
    async fetch() {
      const url = (CFG.inventorySheetCsvUrl || '').trim();
      if (!url) return { ok: false, reason: 'no-url' };
      if (this.inflight) return this.inflight;
      this.inflight = (async () => {
        try {
          const resp = await fetch(url, { cache: 'no-store' });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const text = await resp.text();
          const rows = parseCSV(text);
          const items = rowsToObjects(rows);
          writeStore(SHEET_CACHE_KEY, { items, fetchedAt: Date.now() });
          writeStore(SYNC_KEY, Date.now());
          return { ok: true, items };
        } catch (e) {
          return { ok: false, reason: 'fetch-error', error: String(e.message || e) };
        } finally {
          this.inflight = null;
        }
      })();
      return this.inflight;
    },
    cached() {
      const c = readStore(SHEET_CACHE_KEY, null);
      return c ? c.items : null;
    },
    cacheTime() {
      const c = readStore(SHEET_CACHE_KEY, null);
      return c ? c.fetchedAt : null;
    },
    isConfigured() { return !!(CFG.inventorySheetCsvUrl || '').trim(); },
  };

  // ---------- Unified Inventory facade ----------
  // If sheet is configured, prefer sheet data. Otherwise fall back to local admin data.
  const Inventory = {
    isLive() { return Sheet.isConfigured(); },
    all() {
      if (Sheet.isConfigured()) {
        return Sheet.cached() || [];
      }
      return LocalInventory.all();
    },
    lastSync() {
      if (Sheet.isConfigured()) return Sheet.cacheTime();
      return LocalInventory.lastSync();
    },
    async refresh() {
      if (Sheet.isConfigured()) {
        return await Sheet.fetch();
      }
      return { ok: true, items: LocalInventory.all() };
    },
    // Pass-through for admin (always operates on local)
    addLocal(it) { return LocalInventory.add(it); },
    updateLocal(id, patch) { return LocalInventory.update(id, patch); },
    removeLocal(id) { return LocalInventory.remove(id); },
    setLocal(list) { LocalInventory.set(list); },
    clearLocal() { LocalInventory.clear(); },
    localAll() { return LocalInventory.all(); },
  };

  // ---------- Formspree submitter ----------
  async function submitFormspree(kind, payload) {
    const endpoint = (CFG.formspree && CFG.formspree[kind]) || '';
    if (!endpoint) {
      return { ok: false, reason: 'not-configured' };
    }
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        let msg = 'HTTP ' + resp.status;
        try { const j = await resp.json(); if (j.error) msg = j.error; } catch(e){}
        return { ok: false, reason: 'http', message: msg };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: 'network', message: String(e.message || e) };
    }
  }

  // ---------- Format helpers ----------
  function fmtRelative(ts) {
    if (!ts) return 'never';
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' hr ago';
    const d = Math.floor(h / 24);
    return d + ' day' + (d === 1 ? '' : 's') + ' ago';
  }
  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  // ---------- Nav highlight + mobile toggle ----------
  function setupNav() {
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path) a.classList.add('active');
    });
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  // ---------- Toast ----------
  function toast(title, body) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="t-title">${title}</div>${body ? `<div class="t-body">${body}</div>` : ''}`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 220); }, 3800);
  }

  // ---------- Live clock ----------
  function setupClock() {
    const elDate = document.querySelector('[data-clock-date]');
    const elTime = document.querySelector('[data-clock-time]');
    if (!elDate && !elTime) return;
    function tick() {
      const now = Date.now();
      if (elDate) elDate.textContent = fmtDate(now);
      if (elTime) elTime.textContent = fmtTime(now) + ' UTC' + (-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : '') + (-new Date().getTimezoneOffset() / 60);
    }
    tick();
    setInterval(tick, 1000);
  }

  // ---------- Last sync display ----------
  function setupLastSync() {
    const el = document.querySelector('[data-last-sync]');
    if (!el) return;
    function tick() {
      const ts = Inventory.lastSync();
      el.textContent = ts ? fmtRelative(ts) : 'no data';
    }
    tick();
    setInterval(tick, 30000);
  }

  // Expose
  window.TCN = {
    Inventory, LocalInventory, Sheet, Reservations, WTB, BOMs, nextQuoteNo,
    submitFormspree,
    fmtRelative, fmtDate, fmtTime, toast,
    config: CFG,
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupNav();
    setupClock();
    setupLastSync();
  });
})();
