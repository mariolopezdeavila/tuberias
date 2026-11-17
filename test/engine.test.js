const assert = require('assert');
const data = require('../src/data.js');
const eng = require('../src/engine.js');
eng.setBands(data.DORA_BANDS);

let n = 0; const uid = () => 'c' + (++n);
const st = (id, x, cards, mode = 'parallel') => ({ id, x, y: 0, label: id, mode, cards: cards.map(c => typeof c === 'string' ? { uid: uid(), cardId: c } : { uid: uid(), ...c }) });

// Example: commit -> [lint || unit] -> review -> merge -> rc -> deploy-test1 -> [smoke || functional] -> prod
const state = {
  scenarioId: 's-ai-bank',
  stages: [
    st('s1', 0, ['commit']),
    st('s2', 1, ['lint', 'unit', 'sast']),
    st('s3', 2, ['code-review']),
    st('s4', 3, ['merge-trunk', 'build-rc', 'ai-versioning'], 'sequential'),
    st('s5', 4, ['deploy-test1']),
    st('s6', 5, ['smoke', 'functional', 'ai-regression-evals']),
    st('s7', 6, ['deploy-prod']),
    st('s8', 7, ['ai-online-evals']),
    st('sX', 9, ['pentest']),
  ],
  edges: [['s1','s2'],['s2','s3'],['s3','s4'],['s4','s5'],['s5','s6'],['s6','s7'],['s7','s8']].map(([from,to]) => ({ from, to })),
};
const r = eng.evaluate(state, data.CARDS, data.SCENARIOS);
console.log('lead', eng.fmtDuration(r.leadTime), 'process', eng.fmtDuration(r.processTime), 'wait', eng.fmtDuration(r.waitTime),
  'FE', (r.flowEfficiency*100).toFixed(1)+'%', 'FPY', (r.firstPassYield*100).toFixed(1)+'%', 'band', r.band.label, 'vs comp', r.competitorRatio.toFixed(3));
console.log('bottleneck', r.bottleneck.title, Math.round(r.bottleneck.share*100)+'%');
console.log(r.rules.map(x => x.id + ':' + x.status).join(' '));
r.findings.forEach(f => console.log(' -', f.level, f.text));

// expected: s2 max(1,5,10)=10 ; s3 510 ; s4 1+10+1=12 ; s5 15 ; s6 max(2,20,45)=45 ; s7 15 => 607
assert.strictEqual(r.leadTime, 0 + 10 + 510 + 12 + 15 + 45 + 15);
assert.strictEqual(r.bottleneck.title, 'Code Review');
assert.deepStrictEqual(r.cpStages, ['s1','s2','s3','s4','s5','s6','s7']);
assert.strictEqual(r.rules.find(x => x.id === 'A1').status, 'pass');
assert.strictEqual(r.rules.find(x => x.id === 'R4').status, 'fail'); // pentest unconnected has no deploy before
assert.strictEqual(r.unconnected, 1);

// Parallel branches with different length: critical path picks the longest
const s2 = {
  scenarioId: 's-social',
  stages: [st('a',0,['commit']), st('b',1,['unit']), st('c',1,['ui-tests']), st('d',2,['merge-trunk','build-rc'],'sequential'), st('e',3,['deploy-prod'])],
  edges: [['a','b'],['a','c'],['b','d'],['c','d'],['d','e']].map(([from,to]) => ({ from, to })),
};
const r2 = eng.evaluate(s2, data.CARDS, data.SCENARIOS);
assert.strictEqual(r2.leadTime, 45 + 11 + 15);
assert.deepStrictEqual(r2.cpStages, ['a','c','d','e']);
assert.strictEqual(r2.rules.find(x => x.id === 'A1').status, 'na');
// cycle detection
assert.strictEqual(eng.wouldCycle(s2, 'e', 'a'), true);
assert.strictEqual(eng.wouldCycle(s2, 'b', 'c'), false);
// empty
const r3 = eng.evaluate({ stages: [], edges: [] }, data.CARDS, data.SCENARIOS);
assert.ok(r3.problems.length === 2 && r3.leadTime == null);
// User case: checks before commit + AI code review, no LLM scenario
// (test/user-case.json was missing from the v0.4 source package; this block runs only if it is present)
const userCasePath = __dirname + '/user-case.json';
if (require('fs').existsSync(userCasePath)) {
  const user = JSON.parse(require('fs').readFileSync(userCasePath, 'utf8'));
  let ru = eng.evaluate(user, data.CARDS, data.SCENARIOS);
  assert.strictEqual(ru.rules.find(x => x.id === 'A1').status, 'fail'); // was in s-ai-bank
  assert.strictEqual(ru.preCommit, 4); assert.strictEqual(ru.unconnected, 0);
  user.scenarioId = 'none'; ru = eng.evaluate(user, data.CARDS, data.SCENARIOS);
  assert.strictEqual(ru.rules.find(x => x.id === 'A1').status, 'na');
  assert.strictEqual(ru.competitorRatio, undefined);
  console.log('user case:', eng.fmtDuration(ru.leadTime), ru.findings.map(f => f.text).join(' | '));
} else console.log('user case: skipped (test/user-case.json not present)');

// v2.0 AI deck review
const aiIds = data.CARDS.filter(c => c.deck === 'ai').map(c => c.id);
assert.strictEqual(aiIds.length, 23);
for (const id of ['ai-tracing', 'ai-failure-triage']) assert.ok(!aiIds.includes(id), id + ' should be retired');
for (const id of ['ai-permission-scan', 'ai-release-policy', 'ai-mutation-testing']) assert.ok(aiIds.includes(id), id + ' missing');
assert.strictEqual(data.CARDS.find(c => c.id === 'ai-online-evals').title, 'Post-Release Online Evals');
assert.ok(!/tracing/i.test(data.RULES.find(x => x.id === 'A4').text));
const base = (extra, after) => ({ scenarioId: 's-ai-bank',
  stages: [st('p1',0,['commit']), st('p2',1,['ai-versioning','ai-smoke-evals'],'sequential'), st('p3',2,['merge-trunk','build-rc'],'sequential'),
           ...(extra ? [st('p4',3,[extra])] : []), st('p5',4,['deploy-prod']), ...(after ? [st('p6',5,after)] : [])],
  edges: (extra ? [['p1','p2'],['p2','p3'],['p3','p4'],['p4','p5']] : [['p1','p2'],['p2','p3'],['p3','p5']]).concat(after ? [['p5','p6']] : []).map(([from,to]) => ({ from, to })) });
const policyMsg = f => /Automated Release Policy Check" must come before/.test(f.text);
let rp = eng.evaluate(base('ai-release-policy'), data.CARDS, data.SCENARIOS);
assert.ok(!rp.findings.some(policyMsg), 'policy check before prod: no warning');
assert.strictEqual(rp.leadTime, 1 + 5 + 1 + 10 + 1 + 15);
rp = eng.evaluate(base(null, ['ai-release-policy']), data.CARDS, data.SCENARIOS);
assert.ok(rp.findings.some(policyMsg), 'policy check after prod: warning');
// boards saved with retired cards still load with their original definitions
rp = eng.evaluate(base(null, ['ai-tracing', 'ai-failure-triage']), data.CARDS, data.SCENARIOS);
assert.strictEqual(rp.rules.find(x => x.id === 'A4').status, 'pass');
const cat = eng.makeCatalog(data.CARDS, []);
assert.strictEqual(cat['ai-tracing'].title, 'Agent Tracing & LLM Observability');
assert.strictEqual(cat['ai-tracing'].deck, 'retired');
console.log('fmt', [0, 45, 90, 1440, 2000, 10080, 20000].map(eng.fmtDuration).join(' '));
console.log('ALL TESTS PASSED');
