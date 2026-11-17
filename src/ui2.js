  /* Tuberías — UI part 2: side panel and editors */
  function renderPanel() {
    const fails = R.rules.filter(r => r.status === 'fail').length;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === ui.tab));
    $('#tabRulesCnt').textContent = fails || ''; $('#tabRulesCnt').style.display = fails ? '' : 'none';
    const body = $('#panelBody'); body.innerHTML = '';
    if (ui.tab === 'scenario') renderScenarioTab(body);
    else if (ui.tab === 'rules') renderRulesTab(body);
    else renderReviewTab(body);
    if (!canEdit()) body.querySelectorAll('input,select,textarea').forEach(x => { x.disabled = true; });
  }

  function renderScenarioTab(body) {
    const sel = el('select', { class: 'inp', id: 'scenarioSel', onchange: e => mutate(() => { S.scenarioId = e.target.value; }) });
    const og1 = el('optgroup', { label: 'Core scenarios' }), og2 = el('optgroup', { label: 'AI Engineering scenarios' });
    for (const s of SCENARIOS) (s.deck === 'ai' ? og2 : og1).append(el('option', { value: s.id, selected: s.id === S.scenarioId }, s.title));
    sel.prepend(el('option', { value: 'none', selected: !S.scenarioId || S.scenarioId === 'none' }, '— No scenario (free design) —'));
    sel.append(og1, og2, el('option', { value: 'custom', selected: S.scenarioId === 'custom' }, '✎ Custom scenario…'));
    body.append(el('label', { class: 'f', style: 'margin-top:0' }, 'Scenario'), sel);
    const sc = R.scenario;
    if (S.scenarioId === 'custom') {
      const cs = S.customScenario;
      const upd = (k, v) => mutate(() => { cs[k] = v; });
      body.append(
        el('label', { class: 'f' }, 'Title'), el('input', { class: 'inp', value: cs.title, onchange: e => upd('title', e.target.value) }),
        el('label', { class: 'f' }, 'Context, constraints and risks'), el('textarea', { class: 'inp', onchange: e => upd('text', e.target.value) }, cs.text),
        el('label', { class: 'f' }, 'Competitor or reference'), el('input', { class: 'inp', value: cs.competitor, placeholder: 'e.g. Our current pipeline', onchange: e => upd('competitor', e.target.value) }),
        el('label', { class: 'f' }, 'Reference lead time'), durInput(cs.competitorLeadTime, v => upd('competitorLeadTime', v)),
        el('label', { class: 'f' }, el('input', { type: 'checkbox', checked: cs.flags.llm, onchange: e => mutate(() => { cs.flags.llm = e.target.checked; }) }), ' The system has LLM or agent features (enables rule A1)'));
    } else if (!sc) {
      body.append(el('p', {}, 'Free design: no competitor to compare with, and rule A1 does not apply. Choose a scenario to play with context, risks and a competitor lead time.'));
    } else if (sc) {
      body.append(el('h3', { style: 'margin-top:14px' }, sc.title, sc.deck === 'ai' ? el('span', { class: 'badge-ai', style: 'margin-left:6px' }, 'AI') : null),
        el('div', { class: 'sctext' }, sc.text.split('\n').map(l => '• ' + l).join('\n')),
        el('div', { class: 'comp' }, sc.competitor + ' Their deployment lead time is ', el('b', {}, fmtDuration(sc.competitorLeadTime)), '.'),
        el('p', { style: 'font-size:12px' }, sc.flags && sc.flags.llm ? '🤖 The product has LLM/agent features: rule A1 (eval gate before production) applies.' : 'The product has no LLM features: rule A1 does not apply, even if the pipeline uses AI tools such as AI Code Review.'));
    }
    body.append(el('details', { open: !S.stages.length },
      el('summary', {}, 'How to play'),
      el('ol', { style: 'padding-left:18px' },
        el('li', {}, 'Read the scenario. Discuss which risks you need to mitigate.'),
        el('li', {}, 'Drag cards from the deck onto the board. Drop a card on a stage to run it alongside the others; toggle ∥ / → to run them in parallel or in sequence.'),
        el('li', {}, 'Connect stages with arrows: drag from the ○ port on the right edge. Branches run in parallel.'),
        el('li', {}, 'To move several stages with their arrows: Shift + drag on an empty area (or Shift + click stages), then drag any of them. Ctrl/⌘ + A selects all. Undo: ↶ or Ctrl/⌘ + Z.'),
        el('li', {}, 'Double-click a card to adjust its execution and waiting time. Defaults are illustrative: change them when your context differs.'),
        el('li', {}, 'Check the Rules tab. When the timebox ends, press Review to see lead time, bottleneck and findings.'))));
  }

  function renderRulesTab(body) {
    for (const [deck, title] of [['core', 'Core rules'], ['ai', 'AI Engineering rules']]) {
      body.append(el('h3', { style: 'margin-top:8px' }, title));
      for (const rd of RULES.filter(r => r.deck === deck)) {
        const r = R.rules.find(x => x.id === rd.id) || { status: 'na', msg: '' };
        body.append(el('div', { class: 'rule' }, el('span', { class: 'st ' + r.status }, r.status === 'pass' ? '✓' : r.status === 'fail' ? '!' : '–'),
          el('div', {}, el('b', {}, rd.id + ' · ' + rd.title), el('div', { class: 'rt' }, rd.text),
            r.status !== 'na' ? el('div', { class: 'msg', style: r.status === 'fail' ? 'color:#B91C1C' : '' }, r.msg) : null)));
      }
    }
  }

  const tile = (k, v, s) => el('div', { class: 'tile' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, v), el('div', { class: 's' }, s));
  function renderReviewTab(body) {
    if (!showEval()) {
      body.append(el('div', { class: 'reveal' }, el('div', { class: 'big' }, '🔒'), el('h3', {}, 'Design phase'),
        el('p', {}, canEdit() ? 'Metrics stay hidden so the team focuses on the conversation. Press Review when the timebox ends.' : 'Metrics stay hidden until the editor of this room starts the review.'),
        canEdit() ? el('button', { class: 'btn primary', onclick: () => mutate(() => { S.revealed = true; }) }, 'Start review') : null));
      return;
    }
    if (R.problems.length) body.append(el('div', { class: 'problems' }, R.problems.map(p => el('div', {}, '• ' + p))));
    if (R.leadTime != null) {
      const sc = R.scenario, b = R.band;
      const cmp = R.competitorRatio != null && sc ? (R.competitorRatio <= 1 ? `${(1 / R.competitorRatio).toFixed(1)}× faster than the competitor (${fmtDuration(sc.competitorLeadTime)})` : `${R.competitorRatio.toFixed(1)}× slower than the competitor (${fmtDuration(sc.competitorLeadTime)})`) : '';
      const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
      body.append(el('div', { class: 'tiles' },
        el('div', { class: 'tile big' }, el('div', {}, el('div', { class: 'k' }, 'Lead time for changes'), el('div', { class: 'v', id: 'ltValue' }, fmtDuration(R.leadTime)), el('div', { class: 's' }, cmp)),
          el('span', { class: 'band', style: `background:${b.color}`, title: 'DORA 2024 cluster for lead time' }, b.label)),
        tile('Process time', fmtDuration(R.processTime), 'executing, critical path'),
        tile('Wait time', fmtDuration(R.waitTime), 'in queues, critical path'),
        tile('Flow efficiency', pct(R.flowEfficiency), 'process ÷ lead time'),
        tile('First-pass yield', pct(R.firstPassYield), 'rolled %C&A'),
        tile('Manual effort', fmtDuration(R.manualEffort), 'per change, manual steps'),
        tile('Automation', pct(R.automationRate), `${R.stepsInScope} counted steps`)));
      body.append(el('div', { class: 'bandbar' }, DORA_BANDS.slice(0, 4).map(x => el('div', { class: x.label === b.label ? 'on' : '', style: `background:${x.color}` }, x.label))),
        el('div', { class: 'bandcap' }, el('span', {}, '< 1 day'), el('span', {}, '1 d – 1 w'), el('span', {}, '1 w – 1 m'), el('span', {}, '1 – 6 m')));
    }
    body.append(el('h3', { style: 'margin-top:16px' }, 'Findings'));
    if (!R.findings.length) body.append(el('p', {}, 'No findings yet.'));
    for (const f of R.findings) body.append(el('div', { class: 'finding' }, el('span', { class: 'dot ' + f.level }), el('span', {}, f.text)));
    const fails = R.rules.filter(r => r.status === 'fail');
    if (fails.length) body.append(el('p', { style: 'color:#B91C1C' }, `⚠ ${fails.length} rule(s) broken: ${fails.map(r => r.id).join(', ')}. See the Rules tab.`));
    body.append(el('details', {}, el('summary', {}, 'How is this calculated?'), el('ul', { style: 'padding-left:18px' },
      el('li', {}, el('b', {}, 'Lead time for changes'), ': longest path (critical path) from the start card to "Deploy to Production" (DORA: commit → running in production). Each card adds waiting + execution time. Cards in a parallel stage count as the slowest one; sequential cards add up; parallel branches count as the longest branch.'),
      el('li', {}, el('b', {}, 'Bottleneck'), ': the card on the critical path that contributes most time. Speeding up anything else does not reduce lead time (Theory of Constraints).'),
      el('li', {}, el('b', {}, 'Process time, wait time, flow efficiency, %C&A'), ': Value Stream Mapping metrics (Martin & Osterling). First-pass yield = product of the %C&A of every counted step.'),
      el('li', {}, el('b', {}, 'Cycle time'), ' has competing definitions; here "process time" is the time spent actually executing.'),
      el('li', {}, el('b', {}, 'DORA band'), ': 2024 clusters for lead time (Elite < 1 day; High 1 day–1 week; Medium 1 week–1 month; Low 1–6 months).'),
      el('li', {}, el('b', {}, 'Defaults'), ' are illustrative values for discussion, not benchmarks. Findings are heuristics from Lean/VSM and Continuous Delivery practice.'))));
  }

  // ---------- Duration input ----------
  const UNITS = [['m', 1], ['h', H], ['d', D], ['w', W]];
  function splitDur(min) {
    for (let i = UNITS.length - 1; i > 0; i--) { const f = UNITS[i][1]; const v = min / f; if (min >= f && Math.abs(v * 4 - Math.round(v * 4)) < 1e-9) return [v, UNITS[i][0]]; }
    return [min, 'm'];
  }
  function durInput(min, onchange, presets) {
    const [v, u] = splitDur(min || 0);
    const num = el('input', { class: 'inp', type: 'number', min: '0', step: 'any', value: v });
    const unit = el('select', { class: 'inp', style: 'width:110px' }, UNITS.map(([k]) => el('option', { value: k, selected: k === u }, { m: 'minutes', h: 'hours', d: 'days', w: 'weeks' }[k])));
    const get = () => Math.max(0, Math.round((parseFloat(num.value) || 0) * UNITS.find(x => x[0] === unit.value)[1]));
    num.addEventListener('change', () => onchange(get())); unit.addEventListener('change', () => onchange(get()));
    const wrap = el('div', {}, el('div', { class: 'dur-in' }, num, unit));
    wrap.getValue = get;
    wrap.setValue = m => { const [a, b] = splitDur(m); num.value = a; unit.value = b; };
    if (presets) wrap.append(el('div', { class: 'presets' }, presets.map(p => el('button', { type: 'button', onclick: () => { wrap.setValue(p); onchange(p); } }, fmtDuration(p)))));
    return wrap;
  }
  function toggleMA(get, set) {
    const tog = el('div', { class: 'toggle' });
    const draw = () => { tog.innerHTML = ''; tog.append(el('button', { type: 'button', class: !get() ? 'on' : '', onclick: () => { set(false); draw(); } }, '⚙ Automated'), el('button', { type: 'button', class: get() ? 'on' : '', onclick: () => { set(true); draw(); } }, '✋ Manual')); };
    draw(); return tog;
  }

  // ---------- Card editor ----------
  function openCardEditor(cardUid) {
    const inst = instOf(cardUid); if (!inst) return;
    const e = effective(inst, CAT), def = e.def, dlg = $('#dlg');
    const o = {}; let manual = e.manual;
    const proc = durInput(e.process, () => {}, [1, 5, 15, 60, 4 * H, D]);
    const wait = durInput(e.wait, () => {}, [0, 30, 4 * H, D, 3 * D, W]);
    const pca = el('input', { type: 'range', min: '0', max: '100', value: e.pca, style: 'width:100%' });
    const pcaV = el('span', { class: 'def' }, e.pca + '%');
    pca.addEventListener('input', () => { pcaV.textContent = pca.value + '%'; });
    const editable = def.deck === 'custom' || def.id === 'blank';
    const title = el('input', { class: 'inp', value: inst.title || (def.id === 'blank' ? '' : def.title), placeholder: 'Step name' });
    const note = el('textarea', { class: 'inp', style: 'min-height:54px', placeholder: 'Optional: assumptions, tools, owners…' }, inst.note || '');
    const advanced = el('div', {}, el('label', { class: 'f' }, '%C&A (percent complete & accurate)', pcaV, el('span', { class: 'def' }, `default ${def.d.pca}%`)), pca,
      el('div', { class: 'ref' }, 'Share of runs that pass without rework. Used for first-pass yield.'));
    dlg.innerHTML = '';
    dlg.append(el('div', { class: 'dlg' },
      el('div', { class: 'sub' }, (CATEGORIES[def.cat] || CATEGORIES.custom).label + (def.deck === 'ai' ? ' · AI Engineering extension' : '')),
      editable ? el('div', {}, el('label', { class: 'f' }, 'Step name'), title) : el('h3', {}, def.title),
      el('div', { class: 'desc' }, def.text, def.ref ? el('div', { class: 'ref' }, 'Reference: ' + def.ref) : null),
      el('div', { class: 'row', style: 'justify-content:space-between' }, toggleMA(() => manual, v => { manual = v; }), el('span', { class: 'def' }, `default ${def.d.manual ? 'manual' : 'automated'}`)),
      el('label', { class: 'f' }, 'Execution time', el('span', { class: 'def' }, 'default ' + fmtDuration(def.d.process))), proc,
      el('label', { class: 'f' }, 'Waiting time before it starts', el('span', { class: 'def' }, 'default ' + fmtDuration(def.d.wait))), wait,
      S.mode === 'modeling' ? advanced : el('details', {}, el('summary', {}, 'Advanced (%C&A)'), advanced),
      el('label', { class: 'f' }, 'Note'), note,
      el('div', { class: 'acts' },
        el('button', { class: 'btn', id: 'dlgReset', style: 'margin-right:auto', onclick: () => { mutate(() => { inst.o = {}; }); dlg.close(); } }, 'Reset to defaults'),
        el('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        el('button', { class: 'btn primary', id: 'dlgSave', onclick: () => {
          o.process = proc.getValue(); o.wait = wait.getValue(); o.pca = +pca.value; o.manual = manual;
          mutate(() => {
            const clean = {};
            for (const k of ['process', 'wait', 'pca', 'manual']) if (o[k] !== def.d[k]) clean[k] = o[k];
            inst.o = clean; inst.note = note.value.trim() || undefined;
            if (editable) inst.title = title.value.trim() || undefined;
          }); dlg.close();
        } }, 'Save'))));
    if (!canEdit()) { dlg.querySelectorAll('input,textarea,.presets button,.toggle button').forEach(x => { x.disabled = true; }); $('#dlgSave').remove(); $('#dlgReset').remove(); }
    dlg.showModal();
  }

  function openCustomCardEditor(id) {
    const dlg = $('#dlg'), existing = S.customCards.find(c => c.id === id);
    const c = existing ? JSON.parse(JSON.stringify(existing)) : { id: uid('x-'), cat: 'custom', title: '', text: '', tags: [], d: { process: 10, wait: 0, pca: 95, manual: false } };
    const title = el('input', { class: 'inp', value: c.title, placeholder: 'e.g. Accessibility audit (axe)' });
    const text = el('textarea', { class: 'inp', placeholder: 'What happens in this step?' }, c.text);
    const cat = el('select', { class: 'inp' }, Object.entries(CATEGORIES).map(([k, v]) => el('option', { value: k, selected: k === c.cat }, v.label)));
    const TAGS = [['system-test', 'System test (needs a deployment before it)'], ['deploy-step', 'Deployment step (needs a package before it)'], ['package', 'Builds a package'], ['eval-gate', 'Eval gate (AI)'], ['post-prod', 'After production (not counted)']];
    const boxes = TAGS.map(([t, l]) => { const b = el('input', { type: 'checkbox', checked: c.tags.includes(t) }); b.dataset.t = t; return { b, lab: el('label', { style: 'display:block;font-size:12.5px;margin:3px 0' }, b, ' ', l) }; });
    let manual = c.d.manual;
    const proc = durInput(c.d.process, () => {}), wait = durInput(c.d.wait, () => {});
    const pca = el('input', { class: 'inp', type: 'number', min: 0, max: 100, value: c.d.pca, style: 'width:90px' });
    dlg.innerHTML = '';
    dlg.append(el('div', { class: 'dlg' }, el('h3', {}, existing ? 'Edit custom card' : 'New custom card'),
      el('label', { class: 'f' }, 'Title'), title, el('label', { class: 'f' }, 'Category'), cat, el('label', { class: 'f' }, 'Description'), text,
      el('label', { class: 'f' }, 'Behaviour for the rules'), boxes.map(x => x.lab),
      el('div', { style: 'margin-top:10px' }, toggleMA(() => manual, v => { manual = v; })),
      el('label', { class: 'f' }, 'Default execution time'), proc, el('label', { class: 'f' }, 'Default waiting time'), wait,
      el('label', { class: 'f' }, 'Default %C&A'), pca,
      el('div', { class: 'acts' },
        existing ? el('button', { class: 'btn danger', style: 'margin-right:auto', onclick: () => {
          if (S.stages.some(s => s.cards.some(x => x.cardId === c.id))) { toast('Remove this card from the board first.'); return; }
          mutate(() => { S.customCards = S.customCards.filter(x => x.id !== c.id); }); dlg.close(); } }, 'Delete') : null,
        el('button', { class: 'btn', onclick: () => dlg.close() }, 'Cancel'),
        el('button', { class: 'btn primary', onclick: () => {
          if (!title.value.trim()) { title.focus(); return; }
          c.title = title.value.trim(); c.text = text.value.trim(); c.cat = cat.value; c.deck = 'custom';
          c.tags = boxes.filter(x => x.b.checked).map(x => x.b.dataset.t);
          if (c.tags.includes('post-prod')) c.tags.push('nocount');
          c.d = { process: proc.getValue(), wait: wait.getValue(), pca: Math.min(100, Math.max(0, +pca.value || 0)), manual };
          mutate(() => { if (existing) Object.assign(existing, c); else S.customCards.push(c); });
          dlg.close(); if (!existing) toast('Card added to the deck under "Custom cards".');
        } }, existing ? 'Save' : 'Add to deck'))));
    dlg.showModal();
  }
