/*
 * Tuberías — backend adapters for online rooms. GPLv3.
 * Backend = Supabase (configured in window.TUBERIAS_CONFIG), a local mock (?backend=mock, for tests),
 * or null (offline mode: the app works in this browser only).
 * Interface:
 *   createRoom(state) -> {code, key}     getRoom(code) -> {code, state, updatedAt} | null
 *   saveRoom(code, key, state)           checkKey(code, key) -> boolean
 *   listRooms() -> [{code, name, team, scenarioId, updatedAt}]
 *   join(code, me, {onState, onPeers, onStatus}) -> {send(payload), setMe(me), leave()}
 */
const Backend = (function () {
  'use strict';
  let qs; try { qs = new URLSearchParams(location.search); } catch (e) { qs = new URLSearchParams(''); }
  const cfg = (typeof window !== 'undefined' && window.TUBERIAS_CONFIG) || {};
  const one = d => (Array.isArray(d) ? d[0] : d) || null;

  function makeSupabase() {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase || !window.supabase.createClient) return null;
    const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const rpc = async (fn, args) => { const { data, error } = await client.rpc(fn, args); if (error) throw new Error(error.message || String(error)); return data; };
    return {
      kind: 'supabase',
      async createRoom(state) { const r = one(await rpc('tuberias_create_room', { p_state: state })); return { code: r.room_code, key: r.edit_key }; },
      async getRoom(code) { const r = one(await rpc('tuberias_get_room', { p_code: code })); return r ? { code: r.room_code, state: r.state, updatedAt: r.updated_at } : null; },
      async saveRoom(code, key, state) { return rpc('tuberias_save_room', { p_code: code, p_key: key, p_state: state }); },
      async checkKey(code, key) { return !!(await rpc('tuberias_check_key', { p_code: code, p_key: key })); },
      async listRooms() { return ((await rpc('tuberias_list_rooms', {})) || []).map(r => ({ code: r.room_code, name: r.name, team: r.team, scenarioId: r.scenario_id, updatedAt: r.updated_at })); },
      join(code, me, h) {
        const ch = client.channel('tuberias-' + code, { config: { broadcast: { self: false }, presence: { key: me.id } } });
        ch.on('broadcast', { event: 'state' }, msg => h.onState && h.onState(msg.payload));
        ch.on('presence', { event: 'sync' }, () => {
          const st = ch.presenceState();
          h.onPeers && h.onPeers(Object.values(st).map(a => a && a[0]).filter(Boolean));
        });
        ch.subscribe(async status => {
          h.onStatus && h.onStatus(status === 'SUBSCRIBED' ? 'live' : status === 'CLOSED' ? 'closed' : 'error');
          if (status === 'SUBSCRIBED') { try { await ch.track(me); } catch (e) { /* presence is optional */ } }
        });
        return {
          send(payload) { return ch.send({ type: 'broadcast', event: 'state', payload }).catch(() => 'error'); },
          async setMe(m) { me = m; try { await ch.track(m); } catch (e) { /* ignore */ } },
          leave() { try { client.removeChannel(ch); } catch (e) { /* ignore */ } },
        };
      },
    };
  }

  // Mock backend: shares a "database" through localStorage and messages through BroadcastChannel.
  // Only for local tests with several tabs of the same browser.
  function makeMock() {
    const DB = 'tuberias:mockdb';
    const read = () => { try { return JSON.parse(localStorage.getItem(DB)) || { rooms: {} }; } catch (e) { return { rooms: {} }; } };
    const write = db => localStorage.setItem(DB, JSON.stringify(db));
    const delay = v => new Promise(r => setTimeout(() => r(v), 40));
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return {
      kind: 'mock',
      async createRoom(state) {
        const db = read(); let code;
        do { code = Array.from({ length: 6 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (db.rooms[code]);
        const key = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        db.rooms[code] = { key, state, updatedAt: new Date().toISOString() }; write(db);
        return delay({ code, key });
      },
      async getRoom(code) { const r = read().rooms[String(code).toUpperCase()]; return delay(r ? { code: String(code).toUpperCase(), state: r.state, updatedAt: r.updatedAt } : null); },
      async saveRoom(code, key, state) {
        const db = read(), r = db.rooms[String(code).toUpperCase()];
        if (!r || r.key !== key) throw new Error('not allowed: wrong room code or edit key');
        r.state = state; r.updatedAt = new Date().toISOString(); write(db); return delay(r.updatedAt);
      },
      async checkKey(code, key) { const r = read().rooms[String(code).toUpperCase()]; return delay(!!r && r.key === key); },
      async listRooms() {
        const rooms = read().rooms;
        return delay(Object.entries(rooms).filter(([, r]) => r.state && r.state.listed).map(([code, r]) => ({ code, name: r.state.name, team: r.state.team, scenarioId: r.state.scenarioId, updatedAt: r.updatedAt })));
      },
      join(code, me, h) {
        const bc = new BroadcastChannel('tuberias-mock-' + code), peers = {};
        const emitPeers = () => { const now = Date.now(); for (const k in peers) if (now - peers[k].t > 6000) delete peers[k]; h.onPeers && h.onPeers([me, ...Object.values(peers).map(p => p.me)]); };
        bc.onmessage = e => {
          const m = e.data;
          if (m.type === 'state') h.onState && h.onState(m.payload);
          else if (m.type === 'hello') { peers[m.me.id] = { me: m.me, t: Date.now() }; emitPeers(); }
          else if (m.type === 'bye') { delete peers[m.id]; emitPeers(); }
        };
        const hb = setInterval(() => { bc.postMessage({ type: 'hello', me }); emitPeers(); }, 1500);
        setTimeout(() => { h.onStatus && h.onStatus('live'); bc.postMessage({ type: 'hello', me }); emitPeers(); }, 30);
        return {
          send(payload) { bc.postMessage({ type: 'state', payload }); return Promise.resolve('ok'); },
          async setMe(m) { me = m; bc.postMessage({ type: 'hello', me }); emitPeers(); },
          leave() { clearInterval(hb); try { bc.postMessage({ type: 'bye', id: me.id }); bc.close(); } catch (e) { /* ignore */ } },
        };
      },
    };
  }

  if (qs.get('backend') === 'mock') return makeMock();
  if (qs.get('backend') === 'offline') return null;
  try { return makeSupabase(); } catch (e) { console.warn('Tuberías: online rooms unavailable', e); return null; }
})();

// Namespace for local storage, so several test "profiles" can share one browser.
const LS_NS = (function () { try { const p = new URLSearchParams(location.search).get('profile'); return p ? 'tuberias@' + p + ':' : 'tuberias:'; } catch (e) { return 'tuberias:'; } })();
