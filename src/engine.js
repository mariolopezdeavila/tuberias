/*
 * Tuberías — evaluation engine (pure functions, no DOM). GPLv3.
 * Model: a pipeline is a DAG of STAGES. A stage holds one or more cards that run
 * in parallel (stage time = max of its cards) or in sequence (stage time = sum).
 * Card time = wait (queue) + process (execution). Lead time = longest path
 * (critical path) from a start card to "Deploy to Production".
 */

if (typeof module !== 'undefined' && typeof window === 'undefined') require('./i18n.js'); // Node: t(), scenarioLoc()

function fmtDuration(min) {
  if (min == null || !isFinite(min)) return '—';
  min = Math.round(min);
  if (min < 60) return min + 'm';
  const D = 1440, W = 10080;
  if (min < D) { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h ${m}m` : `${h}h`; }
  if (min < W) { const th = Math.round(min / 60), d = Math.floor(th / 24), h = th % 24; return h ? `${d}d ${h}h` : `${d}d`; }
  const td = Math.round(min / D), w = Math.floor(td / 7), d = td % 7, wk = getLang() === 'es' ? ' sem' : 'w';
  return d ? `${w}${wk} ${d}d` : `${w}${wk}`;
}

// Cards removed from the decks. Not shown in the palette; kept so saved boards that use them still load.
const RETIRED_CARDS = [
  { id: 'ai-tracing', deck: 'retired', cat: 'ai', title: 'Agent Tracing & LLM Observability', tags: ['post-prod', 'nocount'],
    text: 'Capture trajectories: steps, tool calls, decisions, tokens and latency (e.g. OpenTelemetry GenAI conventions). After production: not counted.',
    d: { process: 0, wait: 0, pca: 100, manual: false } },
  { id: 'ai-failure-triage', deck: 'retired', cat: 'ai', title: 'Agentic Failure Triage', tags: ['nocount'],
    text: 'Cross-cutting: when a step fails, an agent diagnoses the cause and proposes a fix. Advisory → blocking → autonomous, based on measured reliability. Not counted in lead time.',
    d: { process: 0, wait: 0, pca: 100, manual: false } },
];

function makeCatalog(baseCards, customCards) {
  const map = {};
  for (const c of RETIRED_CARDS) map[c.id] = c;
  for (const c of baseCards) map[c.id] = c;
  for (const c of customCards || []) map[c.id] = { ...c, deck: 'custom', tags: c.tags || [] };
  return map;
}

function effective(inst, catalog) {
  const def = catalog[inst.cardId] || { title: t('Unknown card'), tags: [], d: { process: 0, wait: 0, pca: 100, manual: false } };
  const o = inst.o || {};
  return {
    def,
    title: inst.title || def.title,
    process: o.process ?? def.d.process,
    wait: o.wait ?? def.d.wait,
    pca: o.pca ?? def.d.pca,
    manual: o.manual ?? def.d.manual,
    tags: def.tags || [],
  };
}

const hasTag = (e, t) => e.tags.includes(t);
const counts = e => !hasTag(e, 'nocount') && !hasTag(e, 'pre-commit');

function evaluate(state, catalogCards, scenarios) {
  const catalog = makeCatalog(catalogCards, state.customCards);
  const scenario = getScenario(state, scenarios);
  const stages = state.stages || [];
  const byId = Object.fromEntries(stages.map(s => [s.id, s]));
  const edges = (state.edges || []).filter(e => byId[e.from] && byId[e.to]);
  const succ = {}, pred = {};
  for (const s of stages) { succ[s.id] = []; pred[s.id] = []; }
  for (const e of edges) { succ[e.from].push(e.to); pred[e.to].push(e.from); }

  // Card index
  const cards = [];
  for (const s of stages) s.cards.forEach((c, idx) => cards.push({ uid: c.uid, stage: s, idx, inst: c, e: effective(c, catalog) }));
  const cardByUid = Object.fromEntries(cards.map(c => [c.uid, c]));

  // Reachability (ancestors) over the whole graph
  const topo = topoSort(stages, succ, pred);
  const cyclic = topo === null;
  const anc = {};
  if (!cyclic) for (const id of topo) { anc[id] = new Set(); for (const p of pred[id]) { anc[id].add(p); anc[p].forEach(x => anc[id].add(x)); } }
  const before = (a, b) => { // card a happens before card b
    if (a.stage.id === b.stage.id) return a.stage.mode === 'sequential' && a.idx < b.idx;
    return !cyclic && anc[b.stage.id].has(a.stage.id);
  };
  const withTag = t => cards.filter(c => hasTag(c.e, t));

  const result = { cyclic, problems: [], rules: [], findings: [], perStage: {}, perCard: {}, cpStages: [], cpEdges: [], scenario };
  if (cyclic) result.problems.push(t('The pipeline contains a cycle. Remove an arrow to evaluate it.'));

  // ---------- Scope & timing ----------
  const startCards = withTag('start'), endCards = withTag('deploy-prod');
  const startStages = new Set(startCards.map(c => c.stage.id));
  const endStages = new Set(endCards.map(c => c.stage.id));
  let inScope = new Set(), preStart = new Set();
  const walk = (ids, nxt, set) => { const st = [...ids]; while (st.length) { const x = st.pop(); if (set.has(x)) continue; set.add(x); nxt[x].forEach(y => st.push(y)); } };
  if (!cyclic && startStages.size) { walk(startStages, pred, preStart); startStages.forEach(id => preStart.delete(id)); }
  if (!cyclic && startStages.size && endStages.size) {
    const fwd = new Set(), bwd = new Set();
    walk(startStages, succ, fwd); walk(endStages, pred, bwd);
    inScope = new Set([...fwd].filter(x => bwd.has(x)));
  }

  // counted cards of a stage (trim before start / after end inside sequential stages)
  const countedCards = s => {
    let list = s.cards.map((c, idx) => ({ ...cardByUid[c.uid], idx }));
    if (s.mode === 'sequential') {
      const si = list.findIndex(c => hasTag(c.e, 'start'));
      if (si > 0 && startStages.has(s.id)) list = list.slice(si);
      const ei = list.findIndex(c => hasTag(c.e, 'deploy-prod'));
      if (ei >= 0 && ei < list.length - 1) list = list.slice(0, ei + 1);
    }
    return list.filter(c => counts(c.e));
  };

  for (const s of stages) {
    const cc = countedCards(s);
    let dur = 0, det = [];
    if (s.mode === 'sequential') { dur = cc.reduce((a, c) => a + c.e.wait + c.e.process, 0); det = cc; }
    else if (cc.length) { const m = cc.reduce((a, c) => (c.e.wait + c.e.process > a.e.wait + a.e.process ? c : a)); dur = m.e.wait + m.e.process; det = [m]; }
    result.perStage[s.id] = { dur, inScope: inScope.has(s.id), critical: false, det: det.map(c => c.uid), es: 0, ef: 0 };
  }
  for (const c of cards) result.perCard[c.uid] = { dur: c.e.wait + c.e.process, inScope: inScope.has(c.stage.id) && counts(c.e), critical: false, bottleneck: false, violations: [] };

  const outside = cards.filter(c => !inScope.has(c.stage.id) && !hasTag(c.e, 'post-prod') && !hasTag(c.e, 'pre-commit') && !hasTag(c.e, 'nocount'));
  result.preCommit = outside.filter(c => preStart.has(c.stage.id)).length;
  result.unconnected = outside.length - result.preCommit;

  if (inScope.size) {
    const order = topo.filter(id => inScope.has(id));
    const ef = {}, via = {};
    for (const id of order) {
      let es = 0, from = null;
      for (const p of pred[id]) if (inScope.has(p) && (from === null || ef[p] > es)) { es = ef[p]; from = p; }
      ef[id] = es + result.perStage[id].dur; via[id] = from;
      result.perStage[id].es = es; result.perStage[id].ef = ef[id];
    }
    let end = null;
    for (const id of endStages) if (inScope.has(id) && (end === null || ef[id] > ef[end])) end = id;
    const cp = []; let x = end; while (x !== null) { cp.unshift(x); x = via[x]; }
    result.cpStages = cp;
    for (let i = 1; i < cp.length; i++) result.cpEdges.push(cp[i - 1] + '>' + cp[i]);
    result.leadTime = ef[end];

    let process = 0, wait = 0; const critCards = [];
    for (const id of cp) {
      result.perStage[id].critical = true;
      for (const uid of result.perStage[id].det) { const c = cardByUid[uid]; process += c.e.process; wait += c.e.wait; critCards.push(c); result.perCard[uid].critical = true; }
    }
    result.processTime = process; result.waitTime = wait;
    result.flowEfficiency = result.leadTime > 0 ? process / result.leadTime : null;

    const scoped = cards.filter(c => result.perCard[c.uid].inScope);
    result.firstPassYield = scoped.reduce((a, c) => a * c.e.pca / 100, 1);
    result.manualEffort = scoped.filter(c => c.e.manual).reduce((a, c) => a + c.e.process, 0);
    result.manualOnCP = critCards.filter(c => c.e.manual && c.e.wait + c.e.process > 0);
    result.stepsInScope = scoped.length;
    result.automationRate = scoped.length ? scoped.filter(c => !c.e.manual).length / scoped.length : null;

    if (critCards.length && result.leadTime > 0) {
      const b = critCards.reduce((a, c) => (c.e.wait + c.e.process > a.e.wait + a.e.process ? c : a));
      if (b.e.wait + b.e.process > 0) {
        result.bottleneck = { uid: b.uid, title: b.e.title, dur: b.e.wait + b.e.process, wait: b.e.wait, process: b.e.process, share: (b.e.wait + b.e.process) / result.leadTime };
        result.perCard[b.uid].bottleneck = true;
      }
    }
    result.band = DORA_BANDS_REF().find(b => result.leadTime < b.max);
    if (scenario && scenario.competitorLeadTime) result.competitorRatio = result.leadTime / scenario.competitorLeadTime;
  } else if (!cyclic) {
    if (!startCards.length) result.problems.push(t('Add a start card: "A Developer Commits Code" or a non-commit trigger.'));
    if (!endCards.length) result.problems.push(t('Add "Deploy to Production Environment".'));
    if (startCards.length && endCards.length) result.problems.push(t('Connect the start card to "Deploy to Production" with arrows.'));
  }

  // ---------- Rules ----------
  const rule = (id, applicable, violators, msgOk, msgFail) => {
    const r = { id, status: !applicable ? 'na' : violators.length ? 'fail' : 'pass', msg: !applicable ? t('Not applicable yet.') : violators.length ? msgFail(violators) : msgOk };
    if (applicable) for (const v of violators) result.perCard[v.uid] && result.perCard[v.uid].violations.push(id);
    result.rules.push(r);
  };
  const names = vs => vs.map(v => `"${v.e.title}"`).filter((x, i, a) => a.indexOf(x) === i).join(', ');
  const needBefore = (targets, reqTag) => targets.filter(t => !withTag(reqTag).some(r => r.uid !== t.uid && before(r, t)));

  rule('R1', true, [], t('Start and end are connected.'), () => '');
  { const r1 = result.rules[result.rules.length - 1];
    if (!startCards.length || !endCards.length || !inScope.size) { r1.status = 'fail'; r1.msg = !startCards.length ? t('Missing a start card.') : !endCards.length ? t('Missing "Deploy to Production".') : t('Start and production are not connected.'); } }
  rule('R2', endCards.length > 0, needBefore(endCards, 'rc'), t('A Release Candidate is built before production.'), v => t('{cards} has no Release Candidate before it.', { cards: names(v) }));
  const rcs = withTag('rc');
  rule('R3', rcs.length > 0, needBefore(rcs, 'merge'), t('Code is merged before building the Release Candidate.'), v => t('{cards} has no merge to trunk before it.', { cards: names(v) }));
  const sys = withTag('system-test');
  rule('R4', sys.length > 0, needBefore(sys, 'deploy-step'), t('Every system test runs on a deployed system.'), v => t('No deployment before {cards}.', { cards: names(v) }));
  const deps = withTag('deploy-step');
  rule('R5', deps.length > 0, needBefore(deps, 'package'), t('Every deployment has a package to deploy.'), v => t('No build/package before {cards}.', { cards: names(v) }));
  const llm = !!(scenario && scenario.flags && scenario.flags.llm);
  const evals = withTag('eval-gate');
  rule('A1', llm && endCards.length > 0, endCards.filter(t => !evals.some(e => before(e, t))), t('An eval gate protects production.'), () => t('The scenario\'s product has LLM features ("{scenario}"): any change can alter its behavior, so an eval gate must come before "Deploy to Production". AI tools used by the pipeline itself (e.g. AI Code Review) do not trigger this rule.', { scenario: scenario.title }));
  if (!llm) { const a1 = result.rules[result.rules.length - 1]; a1.msg = t('Not applicable: the scenario\'s product has no LLM features.'); }
  rule('A2', evals.length > 0, needBefore(evals, 'ai-versioning'), t('Eval gates run against versioned AI artifacts.'), v => t('{cards} runs without "Version AI Artifacts" before it.', { cards: names(v) }));
  rule('A3', evals.length > 0 && withTag('rag-index').length > 0, needBefore(evals, 'rag-index'), t('The RAG index is built before evaluating.'), v => t('{cards} runs before the RAG index is built.', { cards: names(v) }));
  const post = withTag('post-prod');
  rule('A4', post.length > 0, needBefore(post, 'deploy-prod'), t('Production feedback steps come after production.'), v => t('{cards} must come after "Deploy to Production".', { cards: names(v) }));
  const pre = withTag('pre-commit');
  rule('A5', pre.length > 0, pre.filter(p => startCards.some(s => before(s, p))), t('Agent work happens before the commit.'), v => t('{cards} is placed after the start of the pipeline.', { cards: names(v) }));

  // ---------- Heuristic findings ----------
  const F = (level, text) => result.findings.push({ level, text });
  if (result.leadTime != null) {
    const b = result.bottleneck;
    if (b) {
      F('bad', t('Bottleneck: "{card}" takes {dur}, {pct}% of the lead time.', { card: b.title, dur: fmtDuration(b.dur), pct: Math.round(b.share * 100) }));
      F('info', b.wait > b.process
        ? t('Most of the bottleneck is waiting ({dur}). Look at queues, approvals and people\'s availability before speeding up execution.', { dur: fmtDuration(b.wait) })
        : t('Most of the bottleneck is execution ({dur}). Consider parallelizing, splitting the suite, or running a fast subset earlier.', { dur: fmtDuration(b.process) }));
    }
    if (result.waitTime / Math.max(result.leadTime, 1) > 0.5) F('warn', t('{pct}% of the lead time is waiting, not working.', { pct: Math.round(result.waitTime / result.leadTime * 100) }));
    if (result.manualOnCP.length) F('warn', t('Manual steps on the critical path: {cards}.', { cards: result.manualOnCP.map(c => c.e.title).join(', ') }));
    for (const id of result.cpStages) {
      const s = byId[id];
      if (s.mode === 'sequential') {
        const auto = countedCards(s).filter(c => !c.e.manual && !hasTag(c.e, 'start') && !hasTag(c.e, 'deploy-prod') && !hasTag(c.e, 'deploy-step') && !hasTag(c.e, 'package'));
        if (auto.length >= 2) {
          const sum = auto.reduce((a, c) => a + c.e.process + c.e.wait, 0), mx = Math.max(...auto.map(c => c.e.process + c.e.wait));
          if (sum - mx >= 5) F('info', t('Stage "{stage}" runs {n} automated checks in sequence; running them in parallel could save about {dur}.', { stage: s.label || t('untitled'), n: auto.length, dur: fmtDuration(sum - mx) }));
        }
      }
    }
    if (result.firstPassYield < 0.5) {
      const low = cards.filter(c => result.perCard[c.uid].inScope).sort((a, z) => a.e.pca - z.e.pca)[0];
      F('warn', t('Only {pct}% of changes pass every step first time: expect rework loops. Lowest %C&A: "{card}" ({pca}%).', { pct: Math.round(result.firstPassYield * 100), card: low.e.title, pca: low.e.pca }));
    }
    const cheap = ['lint', 'unit', 'static-analysis', 'sast', 'ai-smoke-evals', 'ai-slopsquatting', 'ai-permission-scan'];
    const slow = cards.filter(c => result.perCard[c.uid].inScope && !c.e.manual && c.e.process >= 30);
    const late = cards.filter(c => result.perCard[c.uid].inScope && cheap.includes(c.inst.cardId) && slow.some(s => before(s, c)));
    if (late.length) F('info', t('Fail fast: cheap checks ({cards}) run after slow ones. Move them earlier for faster feedback.', { cards: names(late) }));
  }
  if (result.preCommit) F('info', t('{n} card(s) run before the commit (local / pre-commit checks): fast feedback for the developer, but they do not count towards lead time.', { n: result.preCommit }));
  if (result.unconnected) F('info', t('{n} card(s) are not connected on a path from the start card to production and are not counted.', { n: result.unconnected }));
  const present = id => cards.some(c => c.inst.cardId === id);
  if (llm) {
    if (!present('ai-redteam-auto') && !present('ai-redteam-manual')) F('warn', t('LLM system without red teaming or safety evals (prompt injection, data exfiltration, tool misuse).'));
    if (!present('ai-online-evals')) F('warn', t('No production feedback loop: add Post-Release Online Evals after production.'));
    if (!present('ai-cost-gate')) F('info', t('No cost gate: token cost per request is not controlled by the pipeline.'));
    if (evals.length && !present('ai-golden-feedback')) F('info', t('Evals without production feedback: the golden dataset will go stale.'));
  }
  const policyChecks = cards.filter(c => c.inst.cardId === 'ai-release-policy');
  if (policyChecks.length && endCards.length && policyChecks.some(p => !endCards.every(t => before(p, t)))) F('warn', t('"Automated Release Policy Check" must come before "Deploy to Production": it decides whether the release may go out.'));
  if (present('ai-coding-agent') && !present('ai-provenance')) F('info', t('Agent-authored changes without provenance attestation: you cannot tell human from agent changes later.'));
  if (present('ai-code-review') && present('code-review')) {
    const hr = cards.find(c => c.inst.cardId === 'code-review');
    if (result.perCard[hr.uid] && result.perCard[hr.uid].bottleneck) F('info', t('Human code review is the bottleneck even with AI review: consider making AI review a pre-filter and keeping PRs small.'));
  }
  return result;
}

let _bands = null;
function DORA_BANDS_REF() { return _bands || (typeof DORA_BANDS !== 'undefined' ? DORA_BANDS : []); }
function setBands(b) { _bands = b; }

function getScenario(state, scenarios) {
  if (!state.scenarioId || state.scenarioId === 'none') return null;
  if (state.scenarioId === 'custom') return state.customScenario || null;
  return scenarioLoc((scenarios || []).find(s => s.id === state.scenarioId) || null);
}

function topoSort(stages, succ, pred) {
  const indeg = {}; for (const s of stages) indeg[s.id] = pred[s.id].length;
  const q = stages.filter(s => indeg[s.id] === 0).sort((a, b) => a.x - b.x).map(s => s.id), out = [];
  while (q.length) { const x = q.shift(); out.push(x); for (const y of succ[x]) if (--indeg[y] === 0) q.push(y); }
  return out.length === stages.length ? out : null;
}

function wouldCycle(state, from, to) {
  if (from === to) return true;
  const succ = {}; for (const s of state.stages) succ[s.id] = [];
  for (const e of state.edges) if (succ[e.from]) succ[e.from].push(e.to);
  const st = [to], seen = new Set();
  while (st.length) { const x = st.pop(); if (x === from) return true; if (seen.has(x)) continue; seen.add(x); (succ[x] || []).forEach(y => st.push(y)); }
  return false;
}

if (typeof module !== 'undefined') module.exports = { evaluate, fmtDuration, effective, makeCatalog, wouldCycle, setBands, topoSort, RETIRED_CARDS };
