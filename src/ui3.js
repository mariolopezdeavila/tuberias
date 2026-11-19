  /* Tuberías — UI part 3: board operations, export, timer, wiring */
  const clearDrop = () => document.querySelectorAll('.stage.drop').forEach(n => n.classList.remove('drop'));
  const toWorld = (cx, cy) => { const r = $('#viewport').getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }; };
  const snap = v => Math.round(v / 10) * 10;
  function insertIndex(body, clientY) { const kids = [...body.querySelectorAll('.card')]; for (let i = 0; i < kids.length; i++) { const r = kids[i].getBoundingClientRect(); if (clientY < r.top + r.height / 2) return i; } return kids.length; }
  const newInst = cardId => ({ uid: uid('c'), cardId });
  function takeCard(cardUid) { const s = stageOf(cardUid); const i = s.cards.findIndex(c => c.uid === cardUid); const [c] = s.cards.splice(i, 1); return { c, from: s, i }; }
  function pruneEmpty() { const empty = new Set(S.stages.filter(s => !s.cards.length).map(s => s.id)); if (!empty.size) return; S.stages = S.stages.filter(s => !empty.has(s.id)); S.edges = S.edges.filter(e => !empty.has(e.from) && !empty.has(e.to)); }

  function dropOnStage(stageId, idx) {
    clearDrop(); if (!drag) return; const d = drag; drag = null;
    mutate(() => {
      const target = S.stages.find(s => s.id === stageId);
      if (d.kind === 'new') target.cards.splice(idx, 0, newInst(d.cardId));
      else { const t = takeCard(d.uid); if (t.from === target && t.i < idx) idx--; target.cards.splice(idx, 0, t.c); pruneEmpty(); }
    });
  }
  function dropOnBoard(clientX, clientY) {
    clearDrop(); if (!drag) return; const d = drag; drag = null;
    const p = toWorld(clientX, clientY);
    mutate(() => {
      const c = d.kind === 'new' ? newInst(d.cardId) : takeCard(d.uid).c;
      S.stages.push({ id: uid('s'), x: snap(p.x - STAGE_W / 2), y: snap(p.y - 20), label: '', mode: 'parallel', cards: [c] });
      pruneEmpty();
    });
  }
  function addCardQuick(cardId) {
    if (ui.stages.size === 1) { const id = [...ui.stages][0]; const st = S.stages.find(s => s.id === id); if (st) { mutate(() => st.cards.push(newInst(cardId))); return; } }
    const r = $('#viewport').getBoundingClientRect();
    const p = toWorld(r.left + r.width / 2, r.top + r.height / 2);
    let x = snap(p.x - STAGE_W / 2), y = snap(p.y - 40);
    while (S.stages.some(s => Math.abs(s.x - x) < 40 && Math.abs(s.y - y) < 40)) { x += 30; y += 30; }
    mutate(() => S.stages.push({ id: uid('s'), x, y, label: '', mode: 'parallel', cards: [newInst(cardId)] }));
  }
  function removeCard(cardUid) { mutate(() => { takeCard(cardUid); pruneEmpty(); if (ui.sel && ui.sel.uid === cardUid) ui.sel = null; }); }
  function deleteStage(id) { deleteStages([id]); }
  function deleteStages(ids) { const del = new Set(ids); mutate(() => { S.stages = S.stages.filter(s => !del.has(s.id)); S.edges = S.edges.filter(e => !del.has(e.from) && !del.has(e.to)); ui.sel = null; ui.stages = new Set(); }); }
  function selectStage(id, additive) {
    ui.sel = null;
    if (additive) { const n = new Set(ui.stages); n.has(id) ? n.delete(id) : n.add(id); ui.stages = n; } else ui.stages = new Set([id]);
    renderBoard();
  }
  function deleteEdge(key) { mutate(() => { S.edges = S.edges.filter(e => e.from + '>' + e.to !== key); ui.sel = null; }); }
  function renameStage(id, lblEl) {
    if (!canEdit()) return;
    const s = S.stages.find(x => x.id === id);
    const inp = el('input', { class: 'inp', value: s.label || '', style: 'height:22px;padding:1px 4px;font-size:12px' });
    lblEl.replaceWith(inp); inp.focus(); inp.select();
    let done = false;
    const finish = () => { if (done) return; done = true; const v = inp.value.trim(); if (v !== (s.label || '')) mutate(() => { s.label = v; }); else renderBoard(); };
    inp.addEventListener('blur', finish);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { inp.value = s.label || ''; inp.blur(); } e.stopPropagation(); });
    inp.addEventListener('pointerdown', e => e.stopPropagation());
  }

  function startStageDrag(e, s) {
    if (e.button !== 0 || e.target.closest('button,input') || !canEdit()) return;
    e.stopPropagation(); e.preventDefault();
    if (e.shiftKey || e.metaKey || e.ctrlKey) { selectStage(s.id, true); return; }
    if (!ui.stages.has(s.id)) { ui.stages = new Set([s.id]); ui.sel = null; }
    const group = S.stages.filter(x => ui.stages.has(x.id)).map(x => ({ s: x, ox: x.x, oy: x.y, node: document.querySelector(`.stage[data-id="${x.id}"]`) }));
    const start = toWorld(e.clientX, e.clientY); let moved = false;
    const before = JSON.stringify(S);
    group.forEach(g => g.node && g.node.classList.add('sel'));
    const mv = ev => { const p = toWorld(ev.clientX, ev.clientY), dx = p.x - start.x, dy = p.y - start.y; if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      const sdx = snap(dx), sdy = snap(dy); for (const g of group) { g.s.x = g.ox + sdx; g.s.y = g.oy + sdy; if (g.node) { g.node.style.left = g.s.x + 'px'; g.node.style.top = g.s.y + 'px'; } } renderEdges(); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      if (moved) { undoStack.push(before); redoStack = []; save(); } renderBoard(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function startConnect(e, s) {
    if (!canEdit()) return;
    e.stopPropagation(); e.preventDefault();
    const a = portPos(s, 'out');
    const mv = ev => renderEdges({ a, b: toWorld(ev.clientX, ev.clientY) });
    const up = ev => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up);
      const tgt = document.elementFromPoint(ev.clientX, ev.clientY), node = tgt && tgt.closest('.stage');
      if (node && node.dataset.id !== s.id) connect(s.id, node.dataset.id); else renderEdges();
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function connect(from, to) {
    if (S.edges.some(e => e.from === from && e.to === to)) { toast(t('Already connected.')); renderEdges(); return; }
    if (wouldCycle(S, from, to)) { toast(t('That arrow would create a loop: a pipeline must flow forward.')); renderEdges(); return; }
    mutate(() => S.edges.push({ from, to }));
  }

  function autoLayout() {
    if (!S.stages.length) return;
    mutate(() => {
      const pred = {}; S.stages.forEach(s => { pred[s.id] = []; }); S.edges.forEach(e => pred[e.to] && pred[e.to].push(e.from));
      const lvl = {}, visiting = new Set();
      const L = id => { if (lvl[id] != null) return lvl[id]; if (visiting.has(id)) return 0; visiting.add(id); lvl[id] = pred[id].length ? Math.max(...pred[id].map(L)) + 1 : 0; return lvl[id]; };
      S.stages.forEach(s => L(s.id));
      const cols = {}; S.stages.slice().sort((a, b) => a.y - b.y).forEach(s => (cols[lvl[s.id]] = cols[lvl[s.id]] || []).push(s));
      const tallest = Math.max(...Object.values(cols).map(list => list.reduce((a, s) => a + stageH(s.cards.length) + 30, -30)));
      for (const [l, list] of Object.entries(cols)) {
        const colH = list.reduce((a, s) => a + stageH(s.cards.length) + 30, -30);
        let y = 40 + (tallest - colH) / 2;
        for (const s of list) { s.x = 40 + l * (STAGE_W + 70); s.y = snap(y); y += stageH(s.cards.length) + 30; }
      }
    });
    fitView();
  }
  function fitView() {
    const r = $('#viewport').getBoundingClientRect();
    if (!S.stages.length) { view = { x: 60, y: 60, k: 1 }; renderBoard(); return; }
    const minX = Math.min(...S.stages.map(s => s.x)), minY = Math.min(...S.stages.map(s => s.y));
    const maxX = Math.max(...S.stages.map(s => s.x + STAGE_W)), maxY = Math.max(...S.stages.map(s => s.y + stageH(s.cards.length)));
    // Never shrink below a readable zoom; if the pipeline is wider, align it to the left (pan to see the rest).
    const k = Math.min(1.1, Math.max(0.75, Math.min((r.width - 80) / (maxX - minX + 20), (r.height - 100) / (maxY - minY + 20))));
    const fitsW = (maxX - minX) * k <= r.width - 40;
    view = { k, x: fitsW ? (r.width - (maxX - minX) * k) / 2 - minX * k : 30 - minX * k, y: Math.max(20, (r.height - (maxY - minY) * k) / 2) - minY * k };
    renderBoard();
  }
  function zoomAt(f, cx, cy) {
    const r = $('#viewport').getBoundingClientRect(); cx = cx ?? r.left + r.width / 2; cy = cy ?? r.top + r.height / 2;
    const k = Math.min(2, Math.max(0.2, view.k * f)), px = cx - r.left, py = cy - r.top;
    view.x = px - (px - view.x) * (k / view.k); view.y = py - (py - view.y) * (k / view.k); view.k = k; setWorld();
  }

  function loadExample() {
    let n = 0; const st = (x, y, ids, label = '', mode = 'parallel') => ({ id: 'ex' + (++n), x, y, label, mode, cards: ids.map(id => newInst(id)) });
    const g = STAGE_W + 70;
    const stages = [
      st(40, 200, ['ai-coding-agent'], 'Authoring'),
      st(40 + g, 180, ['commit', 'ai-versioning'], 'Commit', 'sequential'),
      st(40 + 2 * g, 120, ['lint', 'unit', 'sast', 'ai-smoke-evals'], 'PR checks'),
      st(40 + 3 * g, 200, ['code-review']),
      st(40 + 4 * g, 180, ['merge-trunk', 'build-rc'], 'Build', 'sequential'),
      st(40 + 5 * g, 200, ['deploy-test1']),
      st(40 + 6 * g, 140, ['functional', 'ai-regression-evals', 'ai-redteam-auto'], 'Pre-release'),
      st(40 + 7 * g, 200, ['go-nogo']),
      st(40 + 8 * g, 200, ['deploy-prod']),
      st(40 + 9 * g, 160, ['ai-online-evals'], 'Production'),
    ];
    const edges = []; for (let i = 2; i < stages.length; i++) edges.push({ from: stages[i - 1].id, to: stages[i].id });
    mutate(() => { S.stages = stages; S.edges = edges; S.scenarioId = 's-ai-bank'; S.name = t('Example: support agent pipeline'); });
    fitView(); toast(t('Example loaded. Press Review to evaluate it.'));
  }

  // ---------- Export / import ----------
  function download(name, blob) { const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  const slug = () => (S.name || 'pipeline').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pipeline';
  function exportJSON() {
    const out = JSON.parse(JSON.stringify(S));
    out.exportedAt = new Date().toISOString();
    out.evaluation = R.leadTime == null ? null : {
      leadTime: R.leadTime, processTime: R.processTime, waitTime: R.waitTime, flowEfficiency: R.flowEfficiency, firstPassYield: R.firstPassYield,
      manualEffort: R.manualEffort, doraBand: R.band.label, bottleneck: R.bottleneck ? R.bottleneck.title : null, criticalPath: R.cpStages,
      rules: Object.fromEntries(R.rules.map(r => [r.id, r.status])), findings: R.findings.map(f => f.text) };
    download(`tuberias-${slug()}.json`, new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  }
  function importJSON(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const j = JSON.parse(rd.result);
        if (j.app !== 'tuberias' || !Array.isArray(j.stages)) throw new Error(t('not a Tuberías file'));
        delete j.evaluation; delete j.exportedAt;
        mutate(() => { S = Object.assign(newState(), j); }); fitView(); toast(t('Pipeline imported.'));
      } catch (e) { toast(t('Could not import: {err}', { err: e.message })); }
    };
    rd.readAsText(file);
  }

  function exportPNG(returnCanvas) {
    if (!S.stages.length) { toast(t('The board is empty.')); return; }
    const ev = showEval(), sc = 2, pad = 40;
    const minX = Math.min(...S.stages.map(s => s.x)), minY = Math.min(...S.stages.map(s => s.y));
    const maxX = Math.max(...S.stages.map(s => s.x + STAGE_W)), maxY = Math.max(...S.stages.map(s => s.y + stageH(s.cards.length)));
    const headH = ev && R.leadTime != null ? 124 : 84, footH = 44;
    const Wd = Math.max(1000, maxX - minX + 2 * pad), Ht = maxY - minY + 2 * pad + headH + footH;
    const cv = document.createElement('canvas'); cv.width = Wd * sc; cv.height = Ht * sc;
    const g = cv.getContext('2d'); g.scale(sc, sc);
    const F = (w, s) => `${w} ${s}px system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    g.fillStyle = '#F6F7F9'; g.fillRect(0, 0, Wd, Ht);
    g.fillStyle = '#0F172A'; g.font = F(800, 22); g.fillText('Tuberías · ' + (S.name || 'Pipeline'), pad, 40);
    g.font = F(400, 13); g.fillStyle = '#475569';
    g.fillText(`${t('Scenario')}: ${R.scenario ? R.scenario.title : '—'}${S.team ? '   ·   ' + t('Team') + ': ' + S.team : ''}   ·   ${new Date().toLocaleDateString(getLang())}`, pad, 62);
    if (ev && R.leadTime != null) {
      const items = [['Lead time', fmtDuration(R.leadTime) + '  (DORA ' + R.band.label + ')'], ['Process / wait', fmtDuration(R.processTime) + ' / ' + fmtDuration(R.waitTime)],
        ['Flow efficiency', Math.round(R.flowEfficiency * 100) + '%'], ['First-pass yield', Math.round(R.firstPassYield * 100) + '%'], ['Bottleneck', R.bottleneck ? R.bottleneck.title : '—']];
      let x = pad;
      for (const [k, v] of items) { g.font = F(600, 10); g.fillStyle = '#64748B'; g.fillText(k.toUpperCase(), x, 90); g.font = F(700, 15); g.fillStyle = k === 'Bottleneck' ? '#DC2626' : '#0F172A'; g.fillText(v, x, 110); x += Math.max(150, g.measureText(v).width + 34); }
    }
    const ox = pad - minX, oy = pad + headH - minY;
    const byId = Object.fromEntries(S.stages.map(s => [s.id, s]));
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    for (const e of S.edges) {
      const a = byId[e.from], b = byId[e.to]; if (!a || !b) continue;
      const crit = ev && R.cpEdges.includes(e.from + '>' + e.to);
      const p1 = portPos(a, 'out'), p2 = portPos(b, 'in'); p2.x -= 7;
      const x1 = p1.x + ox, y1 = p1.y + oy, x2 = p2.x + ox, y2 = p2.y + oy, dx = Math.max(40, Math.abs(x2 - x1) / 2);
      g.strokeStyle = crit ? '#EA580C' : '#64748B'; g.lineWidth = crit ? 3.5 : 2;
      g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2); g.stroke();
      g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(x2 + 7, y2); g.lineTo(x2 - 4, y2 - 6); g.lineTo(x2 - 4, y2 + 6); g.closePath(); g.fill();
    }
    const wrapT = (text, maxW) => { const words = text.split(' '), lines = []; let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; } if (line) lines.push(line); return lines; };
    for (const s of S.stages) {
      const ps = R.perStage[s.id] || {}, n = s.cards.length, x = s.x + ox, y = s.y + oy, h = stageH(n);
      if (n > 1) { rr(x, y, STAGE_W, h, 10); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill(); g.strokeStyle = ev && ps.critical ? '#EA580C' : '#CBD5E1'; g.lineWidth = 1.5; g.stroke(); }
      g.font = F(700, 12); g.fillStyle = '#475569';
      g.fillText((s.label || (n > 1 ? t('Stage') : '')) + (n > 1 ? '  ' + (s.mode === 'sequential' ? t('→ seq') : t('∥ par')) : ''), x + 9, y + 20);
      if (ev && ps.inScope) { const tx = '⏱ ' + fmtDuration(ps.dur); g.font = F(600, 11); g.fillStyle = ps.critical ? '#9A3412' : '#475569'; g.fillText(tx, x + STAGE_W - 10 - g.measureText(tx).width, y + 20); }
      s.cards.forEach((c, i) => {
        const e = effective(c, CAT), pc = R.perCard[c.uid] || {};
        const cx = x + 9.5, cy = y + 1.5 + HDR + i * (CARD_H + GAP);
        const bn = ev && pc.bottleneck, cr = ev && pc.critical;
        rr(cx, cy, CARD_W, CARD_H, 7); g.fillStyle = bn ? '#FEF2F2' : (e.tags.includes('nocount') || e.tags.includes('pre-commit')) ? '#F8FAFC' : '#fff'; g.fill();
        g.strokeStyle = bn ? '#DC2626' : cr ? '#EA580C' : '#CBD5E1'; g.lineWidth = bn ? 3 : cr ? 2 : 1; g.stroke();
        g.save(); rr(cx, cy, CARD_W, CARD_H, 7); g.clip(); g.fillStyle = (CATEGORIES[e.def.cat] || CATEGORIES.custom).color; g.fillRect(cx, cy, 6, CARD_H); g.restore();
        g.font = F(650, 12.5); g.fillStyle = '#0F172A';
        wrapT((e.def.deck === 'ai' ? '[AI] ' : '') + e.title, CARD_W - 26).slice(0, 2).forEach((l, j) => g.fillText(l, cx + 13, cy + 19 + j * 15));
        g.font = F(400, 11); g.fillStyle = '#475569'; g.fillText(cardMeta(e), cx + 13, cy + 55);
        if (bn) { g.font = F(800, 9); const tx = 'BOTTLENECK', tw = g.measureText(tx).width + 10; g.fillStyle = '#DC2626'; rr(cx + CARD_W - tw - 8, cy - 8, tw, 14, 3); g.fill(); g.fillStyle = '#fff'; g.fillText(tx, cx + CARD_W - tw - 3, cy + 2.5); }
        if (pc.violations && pc.violations.length) { g.font = F(700, 11); g.fillStyle = '#B45309'; const tx = '⚠ ' + pc.violations.join(','); g.fillText(tx, cx + CARD_W - 8 - g.measureText(tx).width, cy + 55); }
      });
    }
    g.font = F(400, 11); g.fillStyle = '#94A3B8';
    g.fillText(t('Tuberías — free software (GPLv3), based on "Pipeline" by Eficode. Card defaults are illustrative.') + (ev ? '   ' + t('Orange: critical path · Red: bottleneck.') : ''), pad, Ht - 18);
    if (returnCanvas === true) return cv;
    cv.toBlob(b => download(`tuberias-${slug()}.png`, b), 'image/png');
  }

  // ---------- Timer ----------
  const timer = { total: 45 * 60, left: 45 * 60, running: false, h: null };
  function drawTimer() { const b = $('#timerBtn'); const m = Math.floor(timer.left / 60), s = timer.left % 60; b.textContent = '⏱ ' + m + ':' + String(s).padStart(2, '0'); b.classList.toggle('ended', timer.left === 0); b.classList.toggle('on', timer.running); }
  function timerStart() { if (timer.running || timer.left === 0) return; timer.running = true; timer.h = setInterval(() => { timer.left = Math.max(0, timer.left - 1); drawTimer(); if (!timer.left) { timerPause(); toast(t("Time's up! Press Review.")); } }, 1000); drawTimer(); }
  function timerPause() { timer.running = false; clearInterval(timer.h); drawTimer(); }
  function timerSet(min) { timerPause(); timer.total = timer.left = min * 60; drawTimer(); }

  function openAbout() {
    const dlg = $('#dlg'); dlg.innerHTML = '';
    const p = (t, st) => el('p', { style: st || 'font-size:13px;line-height:1.5;color:#475569' }, t);
    dlg.append(el('div', { class: 'dlg' }, el('h3', {}, t('About Tuberías {v}', { v: '2.1' })),
      p(t('A game to design Continuous Delivery pipelines collaboratively, extended with AI Engineering practices: evals as quality gates, AI artifact versioning, red teaming, eval-gated canaries and production feedback loops.')),
      p(t('Based on "Pipeline: the game that delivers" by Eficode (github.com/eficode/pipeline-the-game). Core card and scenario texts come from that project. Tuberías is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License, version 3. It comes with no warranty.')),
      getLang() === 'es' ? p(t('Spanish translation of the core card and scenario texts: Tuberías authors.')) : null,
      p(t('References: DORA 2024 lead-time clusters; code review waiting times (industry median time-to-first-review about one day); Value Stream Mapping metrics (Martin & Osterling). Card defaults are illustrative.'), 'font-size:12px;line-height:1.5;color:#94A3B8'),
      el('div', { class: 'acts' }, el('button', { class: 'btn primary', onclick: () => dlg.close() }, t('Close')))));
    dlg.showModal();
  }

  function startMarquee(e) {
    e.preventDefault();
    const vp = $('#viewport'), r = vp.getBoundingClientRect();
    const box = el('div', { class: 'marquee' }); vp.append(box);
    const base = new Set(ui.stages); ui.sel = null;
    const sx = e.clientX, sy = e.clientY;
    const mv = ev => {
      const x1 = Math.min(sx, ev.clientX), y1 = Math.min(sy, ev.clientY), x2 = Math.max(sx, ev.clientX), y2 = Math.max(sy, ev.clientY);
      box.style.cssText = `left:${x1 - r.left}px;top:${y1 - r.top}px;width:${x2 - x1}px;height:${y2 - y1}px`;
      const a = toWorld(x1, y1), b = toWorld(x2, y2), sel = new Set(base);
      for (const s of S.stages) { const h = stageH(s.cards.length); if (s.x < b.x && s.x + STAGE_W > a.x && s.y < b.y && s.y + h > a.y) sel.add(s.id); }
      ui.stages = sel;
      document.querySelectorAll('.stage').forEach(n => n.classList.toggle('sel', sel.has(n.dataset.id)));
    };
    const up = () => { box.remove(); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); renderBoard(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  // ---------- Wiring ----------
  function init() {
    $('#pname').addEventListener('change', e => mutate(() => { S.name = e.target.value; }));
    $('#pteam').addEventListener('change', e => mutate(() => { S.team = e.target.value; }));
    $('#scChip').addEventListener('click', () => { ui.tab = 'scenario'; renderPanel(); const s = $('#scenarioSel'); if (s) s.focus(); });
    document.querySelectorAll('#modeSeg button').forEach(b => b.addEventListener('click', () => { if (S.mode === b.dataset.m) return; mutate(() => { S.mode = b.dataset.m; }); if (S.mode === 'modeling') { ui.tab = 'review'; renderPanel(); } }));
    $('#btnReview').addEventListener('click', () => { mutate(() => { S.revealed = !S.revealed; }); if (S.revealed) { ui.tab = 'review'; renderPanel(); } });
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { ui.tab = b.dataset.t; renderPanel(); }));
    $('#deckSearch').addEventListener('input', e => { ui.q = e.target.value; renderDeck(); });
    document.querySelectorAll('#deckChips .chip').forEach(c => c.addEventListener('click', () => { ui.filter = c.dataset.f; renderDeck(); }));
    $('#btnCustom').addEventListener('click', () => openCustomCardEditor(null));
    document.querySelectorAll('.menu > .hbtn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); const m = b.parentElement, was = m.classList.contains('open'); document.querySelectorAll('.menu').forEach(x => x.classList.remove('open')); if (!was) m.classList.add('open'); }));
    document.addEventListener('click', () => document.querySelectorAll('.menu').forEach(x => x.classList.remove('open')));
    const act = {
      new: () => { if (S.stages.length && !confirm(t('Start a new, empty pipeline? You can undo this.'))) return; mutate(() => { const keep = S.customCards; S = newState(); S.customCards = keep; }); fitView(); },
      rooms: () => { if (Backend) openLanding(); }, share: openShare, copy: makeCopy,
      example: loadExample, json: exportJSON, png: exportPNG, import: () => $('#fileIn').click(), layout: autoLayout, fit: fitView, about: openAbout,
      t30: () => timerSet(30), t45: () => timerSet(45), t60: () => timerSet(60), tstart: timerStart, tpause: timerPause, treset: () => timerSet(timer.total / 60) };
    document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => act[b.dataset.act]()));
    $('#fileIn').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
    $('#btnUndo').addEventListener('click', undo); $('#btnRedo').addEventListener('click', redo);
    $('#zin').addEventListener('click', () => zoomAt(1.2)); $('#zout').addEventListener('click', () => zoomAt(1 / 1.2)); $('#zfit').addEventListener('click', fitView);

    const vp = $('#viewport');
    vp.addEventListener('dragover', e => { if (drag) { e.preventDefault(); clearDrop(); } });
    vp.addEventListener('drop', e => { e.preventDefault(); dropOnBoard(e.clientX, e.clientY); });
    vp.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.shiftKey) { view.x -= e.deltaY || e.deltaX; setWorld(); }
      else zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });
    vp.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('.stage,.zoom,.legend,.edel') || e.target.classList.contains('hit')) return;
      if (e.shiftKey) { startMarquee(e); return; }
      if (ui.sel || ui.stages.size) { ui.sel = null; ui.stages = new Set(); renderBoard(); }
      const sx = e.clientX, sy = e.clientY, ox = view.x, oy = view.y; vp.classList.add('panning');
      const mv = ev => { view.x = ox + ev.clientX - sx; view.y = oy + ev.clientY - sy; setWorld(); };
      const up = () => { vp.classList.remove('panning'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
      window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    });
    document.addEventListener('keydown', e => {
      if (e.target.closest('input,textarea,select') || $('#dlg').open) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); ui.sel = null; ui.stages = new Set(S.stages.map(s => s.id)); renderBoard(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && (ui.sel || ui.stages.size)) {
        e.preventDefault();
        if (ui.stages.size) deleteStages([...ui.stages]);
        else if (ui.sel.type === 'edge') deleteEdge(ui.sel.key); else if (ui.sel.type === 'card') removeCard(ui.sel.uid);
      }
      if (e.key === 'Escape' && (ui.sel || ui.stages.size)) { ui.sel = null; ui.stages = new Set(); renderBoard(); }
    });
    document.querySelectorAll('#langSeg button').forEach(b => b.addEventListener('click', () => switchLang(b.dataset.l)));
    applyStatic(); drawTimer(); render(); roomsInit();
    if (S.stages.length && !room) setTimeout(fitView, 0);
  }

