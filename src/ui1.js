/* Tuberías — UI part 1: state & board rendering. GPLv3. Depends on data.js and engine.js */
(function () {
  'use strict';
  setBands(DORA_BANDS);
  const CARD_W = 210, CARD_H = 64, GAP = 6, HDR = 30, PADB = 8, STAGE_W = 229, BORDER = 3;
  const stageH = n => BORDER + HDR + n * CARD_H + Math.max(0, n - 1) * GAP + PADB;
  const KEY = LS_NS + 'v1';
  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
    return e;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const catLabel = cat => tc('category', (CATEGORIES[cat] || CATEGORIES.custom).label);

  // ---------- Language (static HTML) ----------
  // Elements marked data-i18n / data-i18n-html, and every static title and placeholder, keep their
  // English text as the key; applyStatic() rewrites them in the current language.
  let STATIC = null;
  function captureStatic() {
    STATIC = { text: [], html: [], title: [], ph: [] };
    document.querySelectorAll('[data-i18n]').forEach(n => STATIC.text.push([n, n.textContent]));
    document.querySelectorAll('[data-i18n-html]').forEach(n => STATIC.html.push([n, n.innerHTML]));
    document.querySelectorAll('#app [title]').forEach(n => STATIC.title.push([n, n.getAttribute('title')]));
    document.querySelectorAll('#app [placeholder]').forEach(n => STATIC.ph.push([n, n.getAttribute('placeholder')]));
  }
  function applyStatic() {
    if (!STATIC) captureStatic();
    STATIC.text.forEach(([n, k]) => { n.textContent = t(k); });
    STATIC.html.forEach(([n, k]) => { n.innerHTML = t(k); });
    STATIC.title.forEach(([n, k]) => { n.setAttribute('title', t(k)); });
    STATIC.ph.forEach(([n, k]) => { n.setAttribute('placeholder', t(k)); });
    document.documentElement.lang = getLang();
    document.title = t('Tuberías — pipeline design game');
    document.querySelectorAll('.langseg button').forEach(b => b.classList.toggle('on', b.dataset.l === getLang()));
  }
  function switchLang(l) {
    if (l === getLang()) return;
    setLang(l); applyStatic();
    if ($('#dlg').open) $('#dlg').close();
    const landing = !!$('#landing');
    render();
    if (landing) openLanding();
  }
  const langSeg = () => el('div', { class: 'seg langseg light', title: 'Language / Idioma' },
    LANGS.map(l => el('button', { type: 'button', class: l === getLang() ? 'on' : '', title: l === 'es' ? 'Español' : 'English', onclick: () => switchLang(l) }, l.toUpperCase())));

  const newState = () => ({
    app: 'tuberias', version: 1, name: t('Untitled pipeline'), team: '', scenarioId: 'none', mode: 'game', revealed: false,
    customScenario: { title: t('Custom scenario'), text: '', competitor: '', competitorLeadTime: D, flags: { llm: false } },
    stages: [], edges: [], customCards: [],
  });
  let S = load() || newState();
  let view = { x: 60, y: 60, k: 1 };
  const ui = { tab: 'scenario', sel: null, stages: new Set(), filter: 'all', q: '' };
  let undoStack = [], redoStack = [], R = null, CAT = {}, drag = null, room = null;

  function load() { try { const j = JSON.parse(localStorage.getItem(KEY)); return j && j.app === 'tuberias' ? j : null; } catch (e) { return null; } }
  function save() { if (room) { roomSaved(); return; } try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function snapshot() { undoStack.push(JSON.stringify(S)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; }
  function mutate(fn) { if (!canEdit()) { toast(t('View only: only the editor of this room can change it.')); render(); return; } snapshot(); fn(); save(); render(); }
  function undo() { if (!canEdit() || !undoStack.length) return; redoStack.push(JSON.stringify(S)); S = JSON.parse(undoStack.pop()); save(); render(); }
  function redo() { if (!canEdit() || !redoStack.length) return; undoStack.push(JSON.stringify(S)); S = JSON.parse(redoStack.pop()); save(); render(); }
  const showEval = () => S.mode === 'modeling' || S.revealed;
  const stageOf = cardUid => S.stages.find(s => s.cards.some(c => c.uid === cardUid));
  const instOf = cardUid => { const s = stageOf(cardUid); return s && s.cards.find(c => c.uid === cardUid); };
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); }
  const setWorld = () => { $('#world').style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; };

  function render() {
    CAT = makeCatalog(CARDS, S.customCards);
    R = evaluate(S, CARDS, SCENARIOS);
    document.body.classList.toggle('readonly', !canEdit()); document.body.classList.toggle('inroom', !!room); document.body.classList.toggle('nobackend', !Backend);
    renderHeader(); renderDeck(); renderBoard(); renderPanel();
  }

  function renderHeader() {
    if (document.activeElement !== $('#pname')) $('#pname').value = S.name || '';
    if (document.activeElement !== $('#pteam')) $('#pteam').value = S.team || '';
    $('#pname').readOnly = $('#pteam').readOnly = !canEdit();
    renderRoomHeader();
    document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === S.mode));
    const sc = R.scenario, chip = $('#scChip');
    chip.textContent = sc ? (sc.flags && sc.flags.llm ? '🤖 ' : '') + sc.title : t('No scenario');
    chip.title = sc ? (sc.flags && sc.flags.llm ? t('Scenario: {title} (product with LLM features: rule A1 applies). Click to change.', { title: sc.title }) : t('Scenario: {title}. Click to change.', { title: sc.title })) : t('Free design, no scenario. Click to choose one.');
    chip.classList.toggle('none', !sc);
    const rb = $('#btnReview');
    rb.style.display = S.mode === 'game' ? '' : 'none';
    rb.classList.toggle('on', !!S.revealed);
    rb.textContent = S.revealed ? t('Review: on') : t('Review');
  }

  function cardMeta(e, short) {
    if (e.tags.includes('nocount') || e.tags.includes('pre-commit')) return (e.manual ? '✋ ' : '⚙ ') + (e.process ? fmtDuration(e.process) + ' · ' : '') + t('not counted');
    let s = (e.manual ? '✋ ' : '⚙ ') + fmtDuration(e.process);
    if (e.wait) s += ' · ⏳ ' + fmtDuration(e.wait);
    if (!short && S.mode === 'modeling') s += ' · ' + e.pca + '%';
    return s;
  }

  function renderDeck() {
    const list = $('#deckList'); list.innerHTML = '';
    const q = ui.q.trim().toLowerCase();
    document.querySelectorAll('#deckChips .chip').forEach(c => c.classList.toggle('on', c.dataset.f === ui.filter));
    const all = Object.values(CAT).filter(c => (ui.filter === 'all' || c.deck === ui.filter) && (!q || (c.title + ' ' + c.text + ' ' + cardText(c)).toLowerCase().includes(q)));
    const order = ['delivery', 'build', 'test', 'security', 'deploy', 'ai', 'custom'];
    for (const [deck, label] of [['core', t('Core deck')], ['ai', t('AI Engineering extension')], ['custom', t('Custom cards')]]) {
      const items = all.filter(c => c.deck === deck).sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
      if (!items.length) continue;
      list.append(el('div', { class: 'grp' }, label));
      for (const c of items) {
        const e = effective({ cardId: c.id }, CAT);
        const item = el('div', { class: 'ditem', draggable: 'true', title: cardText(c) + (c.deck === 'custom' ? '\n' + t('Double-click to edit.') : ''), style: `--c:${(CATEGORIES[c.cat] || CATEGORIES.custom).color}` },
          el('span', { class: 't' }, c.deck === 'ai' ? el('span', { class: 'badge-ai' }, 'AI') : null, c.deck === 'ai' ? ' ' : null, c.title,
            el('span', { class: 'm' }, catLabel(c.cat) + ' · ' + cardMeta(e, true))),
          el('button', { title: t('Add to board (or to the selected stage)'), onclick: ev => { ev.stopPropagation(); addCardQuick(c.id); } }, '+'));
        item.addEventListener('dragstart', ev => { drag = { kind: 'new', cardId: c.id }; ev.dataTransfer.setData('text/plain', c.id); ev.dataTransfer.effectAllowed = 'copy'; });
        item.addEventListener('dragend', () => { drag = null; clearDrop(); });
        item.addEventListener('dblclick', () => { if (c.deck === 'custom') openCustomCardEditor(c.id); });
        list.append(item);
      }
    }
    if (!list.children.length) list.append(el('p', { style: 'font-size:13px;color:#94A3B8' }, t('No cards match.')));
  }

  function renderBoard() {
    const world = $('#world');
    setWorld();
    world.querySelectorAll('.stage').forEach(n => n.remove());
    const ev = showEval();
    for (const s of S.stages) {
      const ps = R.perStage[s.id] || {};
      const n = s.cards.length, h = stageH(n);
      const cls = ['stage', n <= 1 ? 'single' : '', ev && ps.critical ? 'crit' : '', ui.stages.has(s.id) ? 'sel' : '', ev && !ps.inScope && R.cpStages.length ? 'out' : ''].join(' ');
      const node = el('div', { class: cls, 'data-id': s.id, style: `left:${s.x}px;top:${s.y}px;height:${h}px` });
      const lbl = el('span', { class: 'lbl' + (s.label ? '' : ' ph'), title: t('Double-click to rename') }, s.label || (n > 1 ? t('Stage') : ''));
      lbl.addEventListener('dblclick', e => { e.stopPropagation(); renameStage(s.id, lbl); });
      const head = el('div', { class: 'shead' }, lbl,
        ev && ps.inScope ? el('span', { class: 'dur', title: t('Starts at +{start} · ends at +{end}', { start: fmtDuration(ps.es), end: fmtDuration(ps.ef) }) }, '⏱ ' + fmtDuration(ps.dur)) : null,
        n > 1 ? el('button', { class: 'sbtn', title: s.mode === 'sequential' ? t('Cards run in sequence (times add up). Click to run them in parallel.') : t('Cards run in parallel (slowest one counts). Click to run them in sequence.'), onclick: e => { e.stopPropagation(); mutate(() => { s.mode = s.mode === 'sequential' ? 'parallel' : 'sequential'; }); } }, s.mode === 'sequential' ? t('→ seq') : t('∥ par')) : null,
        el('button', { class: 'sbtn del', title: t('Delete stage'), onclick: e => { e.stopPropagation(); deleteStage(s.id); } }, '×'));
      head.addEventListener('pointerdown', e => startStageDrag(e, s));
      node.append(head);
      const body = el('div', { class: 'cards' + (s.mode === 'sequential' && n > 1 ? ' seq' : '') });
      for (const c of s.cards) body.append(renderCard(c, ev));
      node.append(body);
      const port = el('div', { class: 'port', title: t('Drag to another stage to connect'), style: `top:${h / 2 - 8}px` });
      port.addEventListener('pointerdown', e => startConnect(e, s));
      node.append(port, el('div', { class: 'pin', style: `top:${h / 2 - 5}px` }));
      node.addEventListener('dragover', e => { if (!drag) return; e.preventDefault(); e.stopPropagation(); clearDrop(); node.classList.add('drop'); });
      node.addEventListener('dragleave', () => node.classList.remove('drop'));
      node.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); dropOnStage(s.id, insertIndex(body, e.clientY)); });
      node.addEventListener('pointerdown', e => { if (e.target === node) { e.stopPropagation(); selectStage(s.id, e.shiftKey || e.metaKey || e.ctrlKey); } });
      world.append(node);
    }
    renderEdges();
    $('#selInfo').textContent = ui.stages.size > 1 ? t('{n} stages selected · drag one to move them · Delete to remove', { n: ui.stages.size }) : '';
    $('#selInfo').style.display = ui.stages.size > 1 ? '' : 'none';
    $('#hint').style.display = S.stages.length ? 'none' : '';
    $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length;
    $('#legend').style.display = ev && S.stages.length ? '' : 'none';
  }

  function renderCard(c, ev) {
    const e = effective(c, CAT), pc = R.perCard[c.uid] || {};
    const color = (CATEGORIES[e.def.cat] || CATEGORIES.custom).color;
    const nocount = e.tags.includes('nocount') || e.tags.includes('pre-commit');
    const viol = pc.violations && pc.violations.length;
    const cls = ['card', ev && pc.critical ? 'crit' : '', ev && pc.bottleneck ? 'bottleneck' : '', viol ? 'viol' : '', nocount ? 'nocount' : '', ui.sel && ui.sel.type === 'card' && ui.sel.uid === c.uid ? 'sel' : ''].join(' ');
    const tip = `${e.title}\n${cardText(e.def)}${c.note ? '\n' + t('Note: {note}', { note: c.note }) : ''}${viol ? '\n⚠ ' + t('Breaks rule {ids}', { ids: pc.violations.join(', ') }) : ''}\n${t('Double-click to edit.')}`;
    const card = el('div', { class: cls, draggable: canEdit() ? 'true' : 'false', 'data-uid': c.uid, title: tip, style: `--c:${color}` },
      el('div', { class: 'ct' }, e.def.deck === 'ai' ? el('span', { class: 'badge-ai' }, 'AI') : null, e.def.deck === 'ai' ? ' ' : null, e.title),
      el('div', { class: 'cm' }, cardMeta(e)),
      el('button', { class: 'cx', title: t('Remove card'), onclick: ev2 => { ev2.stopPropagation(); removeCard(c.uid); } }, '×'),
      viol ? el('span', { class: 'flag', title: t('Breaks rule {ids}', { ids: pc.violations.join(', ') }) }, '⚠️') : (c.note ? el('span', { class: 'flag', title: c.note }, '📝') : null));
    card.addEventListener('dragstart', ev2 => { ev2.stopPropagation(); drag = { kind: 'move', uid: c.uid }; ev2.dataTransfer.setData('text/plain', c.uid); ev2.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend', () => { drag = null; clearDrop(); });
    card.addEventListener('dblclick', ev2 => { ev2.stopPropagation(); openCardEditor(c.uid); });
    card.addEventListener('click', ev2 => { ev2.stopPropagation(); const st = stageOf(c.uid); if (ev2.shiftKey || ev2.metaKey || ev2.ctrlKey) { selectStage(st.id, true); return; } ui.stages = new Set(); ui.sel = { type: 'card', uid: c.uid }; renderBoard(); });
    card.addEventListener('pointerdown', ev2 => ev2.stopPropagation());
    return card;
  }

  function portPos(s, side) { const h = stageH(s.cards.length); return { x: side === 'out' ? s.x + STAGE_W : s.x, y: s.y + h / 2 }; }
  const curve = (a, b) => { const dx = Math.max(40, Math.abs(b.x - a.x) / 2); return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`; };

  function renderEdges(tmp) {
    const svg = $('#edges'), ev = showEval();
    const byId = Object.fromEntries(S.stages.map(s => [s.id, s]));
    const mk = (id, c, s) => `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="${s}" markerHeight="${s}" orient="auto"><path d="M0,0 L10,5 L0,10z" fill="${c}"/></marker>`;
    let html = `<defs>${mk('ah', '#64748B', 7)}${mk('ahc', '#EA580C', 6)}${mk('ahs', '#2563EB', 6)}</defs>`;
    for (const e of S.edges) {
      const a = byId[e.from], b = byId[e.to]; if (!a || !b) continue;
      const key = e.from + '>' + e.to;
      const crit = ev && R.cpEdges.includes(key), sel = ui.sel && ui.sel.type === 'edge' && ui.sel.key === key;
      const p1 = portPos(a, 'out'), p2 = portPos(b, 'in'); p2.x -= 7;
      const d = curve(p1, p2);
      html += `<path class="e${crit ? ' crit' : ''}${sel ? ' sel' : ''}" d="${d}" marker-end="url(#${sel ? 'ahs' : crit ? 'ahc' : 'ah'})"/><path class="hit" data-key="${esc(key)}" d="${d}"/>`;
      if (sel) { const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2; html += `<g class="edel" data-del="${esc(key)}"><circle cx="${mx}" cy="${my}" r="10" fill="#2563EB"/><text x="${mx}" y="${my + 4.5}" text-anchor="middle" font-size="14" fill="#fff" font-weight="700">×</text></g>`; }
    }
    if (tmp) html += `<path class="e tmp" d="${curve(tmp.a, tmp.b)}"/>`;
    svg.innerHTML = html;
    svg.querySelectorAll('path.hit').forEach(p => p.addEventListener('pointerdown', ev2 => { ev2.stopPropagation(); ui.stages = new Set(); ui.sel = { type: 'edge', key: p.dataset.key }; renderBoard(); }));
    svg.querySelectorAll('.edel').forEach(g => g.addEventListener('pointerdown', ev2 => { ev2.stopPropagation(); deleteEdge(g.dataset.del); }));
  }
