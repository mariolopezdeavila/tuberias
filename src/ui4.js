  /* Tuberías — UI part 4: online rooms (one editor, many viewers) */
  const ME_ID = (() => { try { let v = sessionStorage.getItem(LS_NS + 'me'); if (!v) { v = uid('u'); sessionStorage.setItem(LS_NS + 'me', v); } return v; } catch (e) { return uid('u'); } })();
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS_NS + k)); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(LS_NS + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };
  function canEdit() { return !room || room.role === 'editor'; }
  const baseUrl = () => location.href.split('#')[0];
  const roomLink = (code, key) => baseUrl() + '#room=' + code + (key ? '&key=' + key : '');
  const me = () => ({ id: ME_ID, role: room ? room.role : 'viewer' });
  const scenarioTitle = id => (scenarioLoc(SCENARIOS.find(s => s.id === id)) || {}).title || (id === 'custom' ? t('Custom scenario') : t('No scenario'));
  function ago(iso) { const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? t('just now') : s < 3600 ? t('{n} min ago', { n: Math.floor(s / 60) }) : s < 86400 ? t('{n} h ago', { n: Math.floor(s / 3600) }) : t('{n} d ago', { n: Math.floor(s / 86400) }); }

  function parseHash() {
    const h = new URLSearchParams(location.hash.replace(/^#/, ''));
    const code = (h.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return code.length === 6 ? { code, key: h.get('key') || null } : null;
  }
  const getKeys = () => lsGet('keys', {});
  function setKey(code, key) { const k = getKeys(); if (key) k[code] = key; else delete k[code]; lsSet('keys', k); }
  function remember(code, role, name) { const r = lsGet('recent', []).filter(x => x.code !== code); r.unshift({ code, role, name: name || '', at: Date.now() }); lsSet('recent', r.slice(0, 12)); }

  async function openRoom(code, keyFromLink) {
    closeLanding(); toast(t('Opening room {code}…', { code }));
    try {
      if (keyFromLink) {
        if (await Backend.checkKey(code, keyFromLink)) { setKey(code, keyFromLink); toast(t('Editor link accepted: you can edit this room.')); }
        else toast(t('That editor link is not valid. Opening the room as a viewer.'));
      }
      const remote = await Backend.getRoom(code);
      if (!remote) { toast(t('Room {code} not found.', { code })); history.replaceState(null, '', baseUrl()); openLanding(); return; }
      leaveRoom(true);
      const key = getKeys()[code] || null;
      room = { code, key, role: key ? 'editor' : 'viewer', conn: null, pending: false, dirty: false, timer: null, status: 'connecting', save: 'saved', peers: [], poll: null, lastMsg: Date.now() };
      let st = remote.state || {};
      if (room.role === 'editor') { const cached = lsGet('room:' + code, null); if (cached && (cached.rev || 0) > (st.rev || 0)) { st = cached; room.pending = true; } }
      S = Object.assign(newState(), st); undoStack = []; redoStack = []; ui.sel = null; ui.stages = new Set();
      history.replaceState(null, '', roomLink(code));
      room.conn = Backend.join(code, me(), {
        onState: () => scheduleFetch(),
        onPeers: p => { if (room) { room.peers = p; renderRoomHeader(); } },
        onStatus: s => { if (room) { room.status = s; renderRoomHeader(); } },
      });
      room.poll = setInterval(pollRoom, 10000);
      remember(code, room.role, S.name);
      render(); fitView();
      toast(room.role === 'editor' ? t('Room {code}: you are the editor. Share the code so others can watch.', { code }) : t('Room {code}: viewing. Only the editor can change it.', { code }));
      if (room.pending) { room.dirty = true; schedulePush(0); }
    } catch (e) { toast(t('Could not open the room: {err}', { err: e.message })); openLanding(); }
  }

  function leaveRoom(silent) {
    if (!room) return;
    clearInterval(room.poll); clearTimeout(room.timer); clearTimeout(room.fetchT);
    if (room.conn) room.conn.leave();
    room = null;
    if (!silent) { S = load() || newState(); undoStack = []; redoStack = []; history.replaceState(null, '', baseUrl()); render(); fitView(); }
  }

  // Broadcasts only announce "there is a new version". Public channels accept messages from anyone,
  // so the state itself is always read from the database, which only edit-key holders can write.
  function scheduleFetch() {
    if (!room) return;
    room.lastMsg = Date.now();
    clearTimeout(room.fetchT);
    room.fetchT = setTimeout(async () => { try { const r = await Backend.getRoom(room.code); if (r) applyRemote(r.state); } catch (e) { /* the poll will retry */ } }, 120);
  }
  function applyRemote(st) {
    if (!room || !st || typeof st !== 'object') return;
    const remoteRev = st.rev || 0, localRev = S.rev || 0;
    if (remoteRev === localRev) return;
    if (room.role === 'editor' && (room.pending || remoteRev < localRev)) return;
    S = Object.assign(newState(), st);
    if (room.role === 'editor') lsSet('room:' + room.code, S);
    if (room.role === 'viewer' && $('#dlg').open) return void renderBoard();
    render();
  }

  async function pollRoom() {
    if (!room || room.pending) return;
    if (room.status === 'live' && Date.now() - room.lastMsg < 9000 && room.role === 'editor') return;
    try { const r = await Backend.getRoom(room.code); if (r) applyRemote(r.state); if (room && room.status !== 'live') { room.status = 'live'; renderRoomHeader(); } }
    catch (e) { if (room) { room.status = 'error'; renderRoomHeader(); } }
  }

  // Called by save() when the editor changes something.
  function roomSaved() {
    if (!room || room.role !== 'editor') return;
    lsSet('room:' + room.code, S);
    room.pending = true; room.dirty = true; schedulePush(350);
  }
  function schedulePush(ms) { if (!room) return; clearTimeout(room.timer); room.save = 'saving'; renderRoomHeader(); room.timer = setTimeout(pushRoom, ms); }
  async function pushRoom() {
    const r = room; if (!r || r.role !== 'editor') return;
    r.dirty = false;
    S.rev = Math.max(Date.now(), (S.rev || 0) + 1);
    const snap = JSON.parse(JSON.stringify(S));
    try {
      await Backend.saveRoom(r.code, r.key, snap);
      if (room !== r) return;
      lsSet('room:' + r.code, snap);
      if (r.conn) r.conn.send({ rev: snap.rev });
      if (!r.dirty) { r.pending = false; r.save = 'saved'; }
      renderRoomHeader();
    } catch (e) {
      if (room !== r) return;
      if (/not allowed/i.test(e.message)) {
        setKey(r.code, null); r.role = 'viewer'; r.key = null; r.pending = false;
        if (r.conn) r.conn.setMe(me());
        toast(t('Your edit access to this room is no longer valid. You are now viewing it.'));
        render(); return;
      }
      r.save = 'error'; renderRoomHeader();
      r.timer = setTimeout(pushRoom, 4000);
    }
  }

  function renderRoomHeader() {
    if (!room) return;
    $('#roomChip').textContent = '🔗 ' + t('Room {code}', { code: room.code });
    const rb = $('#roleBadge'); rb.textContent = room.role === 'editor' ? '✏️ ' + t('Editor') : '👁 ' + t('Viewing'); rb.className = 'badge room-only ' + room.role;
    const peers = room.peers.length ? room.peers : [me()];
    const pb = $('#peersBadge'); pb.textContent = '👥 ' + peers.length;
    pb.title = t('{n} connected · {e} editor(s)', { n: peers.length, e: peers.filter(p => p.role === 'editor').length });
    const sb = $('#syncBadge');
    let txt = '● ' + t('Live'), cls = 'ok';
    if (room.status !== 'live') { txt = room.status === 'connecting' ? t('Connecting…') : '⚠ ' + t('Reconnecting'); cls = 'warn'; }
    if (room.role === 'editor' && room.save === 'saving') { txt = t('Saving…'); cls = 'warn'; }
    if (room.role === 'editor' && room.save === 'error') { txt = '⚠ ' + t('Not saved, retrying'); cls = 'bad'; }
    sb.textContent = txt; sb.className = 'badge room-only sync ' + cls;
  }

  // ---------- Landing: create / join / lobby ----------
  function openLanding() {
    closeLanding();
    const offlineHas = (() => { const l = load(); return l && l.stages && l.stages.length ? l : null; })();
    const name = el('input', { class: 'inp', placeholder: t('Pipeline name, e.g. "Support agent v1"') });
    const team = el('input', { class: 'inp', placeholder: t('Team name (optional)') });
    const fromOffline = offlineHas ? el('input', { type: 'checkbox' }) : null;
    const code = el('input', { class: 'inp code-in', placeholder: 'ABC123', maxlength: '7', autocomplete: 'off', spellcheck: 'false' });
    code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
    const lobby = el('div', { class: 'lobby' }, el('p', { class: 'muted' }, t('Loading…')));
    const create = el('button', { class: 'btn primary', onclick: async () => {
      create.disabled = true; create.textContent = t('Creating…');
      try {
        const st = fromOffline && fromOffline.checked ? JSON.parse(JSON.stringify(offlineHas)) : newState();
        st.name = name.value.trim() || st.name || t('Untitled pipeline'); st.team = team.value.trim() || st.team || '';
        st.revealed = false; st.listed = false; st.rev = Date.now();
        const r = await Backend.createRoom(st);
        setKey(r.code, r.key); await openRoom(r.code);
      } catch (e) { toast(t('Could not create the room: {err}', { err: e.message })); create.disabled = false; create.textContent = t('Create room'); }
    } }, t('Create room'));
    const join = () => { if (code.value.length !== 6) { code.focus(); toast(t('A room code has 6 characters.')); return; } openRoom(code.value); };
    code.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    const recent = lsGet('recent', []);
    const box = el('div', { id: 'landing', class: 'landing' }, el('div', { class: 'lcard' },
      el('div', { class: 'lhead row', style: 'justify-content:space-between;align-items:flex-start' }, el('div', {}, el('h1', {}, 'Tuberías'), el('p', {}, t('Design Continuous Delivery pipelines together · AI Engineering extension'))), langSeg()),
      el('div', { class: 'lgrid' },
        el('section', {}, el('h3', {}, t('Create a room')), el('p', { class: 'muted' }, t('You will be the editor. Share the code so others can watch live.')),
          name, team,
          fromOffline ? el('label', { class: 'chk' }, fromOffline, ' ' + t('Start from my offline pipeline ({n} stages)', { n: offlineHas.stages.length })) : null,
          create),
        el('section', {}, el('h3', {}, t('Join a room')), el('p', { class: 'muted' }, t('Enter the code the editor shared with you. You will watch in real time.')),
          code, el('button', { class: 'btn primary', onclick: join }, t('Join')))),
      el('section', {}, el('div', { class: 'row', style: 'justify-content:space-between' }, el('h3', {}, 'Lobby'),
        el('button', { class: 'btn', onclick: () => loadLobby(lobby) }, t('↻ Refresh'))),
        el('p', { class: 'muted' }, t('Rooms whose editor chose "Show in lobby" (active in the last 3 days).')), lobby),
      recent.length ? el('section', {}, el('h3', {}, t('Your recent rooms')),
        el('div', { class: 'lobby' }, recent.map(r => el('div', { class: 'lrow' },
          el('span', { class: 'lcode' }, r.code), el('span', { class: 'lname' }, r.name || '—'), el('span', { class: 'muted' }, (r.role === 'editor' && getKeys()[r.code] ? '✏️ ' + t('editor') : '👁 ' + t('viewer')) + ' · ' + ago(new Date(r.at).toISOString())),
          el('button', { class: 'btn', onclick: () => openRoom(r.code) }, t('Open')))))) : null,
      el('div', { class: 'lfoot' },
        el('button', { class: 'btn', onclick: () => { closeLanding(); if (room) return; toast(t('Offline mode: your pipeline stays in this browser.')); } }, room ? t('Back to room') : t('Work offline in this browser')),
        el('span', { class: 'muted' }, t('Free software (GPLv3) · based on "Pipeline" by Eficode')))));
    document.body.append(box);
    loadLobby(lobby);
    setTimeout(() => name.focus(), 50);
  }
  function closeLanding() { const l = $('#landing'); if (l) l.remove(); }
  async function loadLobby(target) {
    target.innerHTML = ''; target.append(el('p', { class: 'muted' }, t('Loading…')));
    try {
      const rooms = await Backend.listRooms();
      target.innerHTML = '';
      if (!rooms.length) { target.append(el('p', { class: 'muted' }, t('No rooms in the lobby yet.'))); return; }
      for (const r of rooms) target.append(el('div', { class: 'lrow' },
        el('span', { class: 'lcode' }, r.code), el('span', { class: 'lname' }, (r.name || t('Untitled')) + (r.team ? ' · ' + r.team : '')),
        el('span', { class: 'muted' }, scenarioTitle(r.scenarioId) + ' · ' + ago(r.updatedAt)),
        el('button', { class: 'btn', onclick: () => openRoom(r.code) }, t('Open'))));
    } catch (e) { target.innerHTML = ''; target.append(el('p', { class: 'muted' }, t('Could not load the lobby: {err}', { err: e.message }))); }
  }

  // ---------- Share dialog ----------
  function copyText(text, input) {
    const done = () => toast(t('Copied to the clipboard.'));
    const fallback = () => { if (input) { input.focus(); input.select(); } try { document.execCommand('copy') ? done() : toast(t('Select the link and copy it.')); } catch (e) { toast(t('Select the link and copy it.')); } };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  function linkRow(label, url, note) {
    const inp = el('input', { class: 'inp', value: url, readonly: true });
    return el('div', {}, el('label', { class: 'f' }, label), el('div', { class: 'row' }, inp, el('button', { class: 'btn', onclick: () => copyText(url, inp) }, t('Copy'))), note ? el('div', { class: 'ref' }, note) : null);
  }
  function openShare() {
    if (!room) return;
    const dlg = $('#dlg'); dlg.innerHTML = '';
    const ed = room.role === 'editor';
    const listed = el('input', { type: 'checkbox', checked: !!S.listed, onchange: e => mutate(() => { S.listed = e.target.checked; }) });
    dlg.append(el('div', { class: 'dlg' },
      el('div', { class: 'sub' }, t('Share this room')),
      el('div', { class: 'bigcode', title: t('Read it aloud: people join with this code') }, room.code),
      el('p', { class: 'muted', style: 'text-align:center;margin-top:0' }, t('Others open Tuberías, choose "Join a room" and type this code.')),
      linkRow(t('Viewer link'), roomLink(room.code), t('Anyone with this link or code can watch, but not edit.')),
      ed ? linkRow(t('Editor link'), roomLink(room.code, room.key), '⚠ ' + t('Anyone with this link can edit. Use it to continue from another laptop or to hand over editing. If two people edit at the same time, the last change wins.')) : null,
      ed ? el('label', { class: 'chk', style: 'margin-top:12px' }, listed, ' ' + t('Show this room in the lobby (other teams can find it without the code)')) : null,
      el('div', { class: 'acts' },
        el('button', { class: 'btn', style: 'margin-right:auto', onclick: () => { dlg.close(); leaveRoom(false); openLanding(); } }, t('Leave room')),
        !ed ? el('button', { class: 'btn', onclick: () => { dlg.close(); makeCopy(); } }, t('Make my own copy')) : null,
        el('button', { class: 'btn primary', onclick: () => dlg.close() }, t('Close')))));
    dlg.showModal();
  }
  async function makeCopy() {
    if (!Backend) return;
    try {
      const st = JSON.parse(JSON.stringify(S));
      st.name = (st.name || 'Pipeline') + ' ' + t('(copy)'); st.listed = false; st.rev = Date.now();
      const r = await Backend.createRoom(st);
      setKey(r.code, r.key); await openRoom(r.code);
    } catch (e) { toast(t('Could not copy the room: {err}', { err: e.message })); }
  }

  function roomsInit() {
    if (!Backend) return;
    $('#roomChip').addEventListener('click', openShare);
    window.addEventListener('hashchange', () => { const h = parseHash(); if (h && (!room || room.code !== h.code || h.key)) openRoom(h.code, h.key); });
    window.addEventListener('beforeunload', e => { if (room && room.pending) { e.preventDefault(); e.returnValue = ''; } });
    const h = parseHash();
    if (h) openRoom(h.code, h.key); else openLanding();
  }
