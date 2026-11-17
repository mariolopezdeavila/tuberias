"""Exercise the Supabase adapter (sync.js) against a stub of supabase-js that mimics PostgREST return shapes."""
from pathlib import Path
from playwright.sync_api import sync_playwright
base = (Path(__file__).resolve().parent.parent / "dist" / "index.html").as_uri()
STUB = r"""
(() => {
  const DB = () => JSON.parse(localStorage.getItem('stubdb') || '{}'), W = d => localStorage.setItem('stubdb', JSON.stringify(d));
  window.__calls = [];
  const client = {
    async rpc(fn, a) {
      window.__calls.push(fn); const d = DB();
      if (fn === 'tuberias_create_room') { const code = 'STUB' + String(Object.keys(d).length).padStart(2, '0'); d[code] = { key: 'k' + code, state: a.p_state, at: new Date().toISOString() }; W(d); return { data: [{ room_code: code, edit_key: 'k' + code }], error: null }; }
      if (fn === 'tuberias_get_room') { const r = d[a.p_code.toUpperCase()]; return { data: r ? [{ room_code: a.p_code.toUpperCase(), state: r.state, listed: !!r.state.listed, updated_at: r.at }] : [], error: null }; }
      if (fn === 'tuberias_save_room') { const r = d[a.p_code]; if (!r || r.key !== a.p_key) return { data: null, error: { message: 'not allowed: wrong room code or edit key' } }; r.state = a.p_state; r.at = new Date().toISOString(); W(d); return { data: r.at, error: null }; }
      if (fn === 'tuberias_check_key') { const r = d[a.p_code]; return { data: !!r && r.key === a.p_key, error: null }; }
      if (fn === 'tuberias_list_rooms') return { data: Object.entries(d).filter(([, r]) => r.state.listed).map(([c, r]) => ({ room_code: c, name: r.state.name, team: r.state.team, scenario_id: r.state.scenarioId, updated_at: r.at })), error: null };
      return { data: null, error: { message: 'unknown fn ' + fn } };
    },
    channel(name, opts) {
      const bc = new BroadcastChannel('stub-' + name), hs = {}; let me = null;
      const ch = {
        on(type, filter, cb) { (hs[type + ':' + (filter.event || '')] = cb); return ch; },
        subscribe(cb) { bc.onmessage = e => { const f = hs['broadcast:' + e.data.event]; f && f({ payload: e.data.payload }); }; setTimeout(() => { cb('SUBSCRIBED'); const p = hs['presence:sync']; p && p(); }, 20); return ch; },
        presenceState() { return me ? { [me.id]: [me] } : {}; },
        async track(m) { me = m; const p = hs['presence:sync']; p && p(); return 'ok'; },
        async send(m) { bc.postMessage({ event: m.event, payload: m.payload }); return 'ok'; },
      };
      return ch;
    },
    removeChannel() {},
  };
  const api = { createClient: (url, key, o) => { window.__created = { url, key }; return client; } };
  Object.defineProperty(window, 'supabase', { configurable: false, get: () => api, set: () => {} });
  Object.defineProperty(window, 'TUBERIAS_CONFIG', { configurable: false, get: () => ({ supabaseUrl: 'https://stub.supabase.co', supabaseAnonKey: 'sb_publishable_stub' }), set: () => {} });
})();
"""
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(); ctx.add_init_script(STUB)
    A, B = ctx.new_page(), ctx.new_page()
    for pg in (A, B): pg.on("pageerror", lambda e: errors.append(str(e)))
    A.goto(base + "?profile=A"); A.wait_for_selector("#landing")
    assert A.evaluate("window.__created.key") == "sb_publishable_stub"
    A.fill("#landing input[placeholder^='Pipeline name']", "Stub test"); A.click("#landing button:has-text('Create room')")
    A.wait_for_function("window.__tuberias.room && window.__tuberias.room.role==='editor'")
    code = A.evaluate("window.__tuberias.room.code")
    A.click("text=File ▾"); A.click("button[data-act=example]"); A.wait_for_function("window.__tuberias.room.save==='saved'")
    B.goto(base + "?profile=B#room=" + code); B.wait_for_function("window.__tuberias.room && window.__tuberias.state.stages.length===10")
    A.click("#btnReview"); B.wait_for_function("window.__tuberias.state.revealed === true")
    print("calls:", sorted(set(A.evaluate("window.__calls") + B.evaluate("window.__calls"))))
    b.close()
print("errors:", errors); assert not errors
print("SUPABASE ADAPTER TEST PASSED")
