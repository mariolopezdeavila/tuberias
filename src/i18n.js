/*
 * Tuberías — internationalization (English / Spanish). GPLv3.
 * Source strings are written in English in the code and wrapped in t('...').
 * The English text is the key; I18N_ES maps it to Spanish. Missing keys fall back to English.
 * Placeholders: t('Room {code}', { code }) → "Sala ABC123".
 * Card titles, metric names, DORA bands and engineering terms stay in English by design
 * (see the glossary in I18N-GLOSARIO.md).
 * Long content (card texts, rules, scenarios) lives in content_es.js, keyed by id.
 */
const LANGS = ['es', 'en'];
const LANG_KEY = 'tuberias:lang';
let LANG = (function () {
  if (typeof window === 'undefined') return 'en'; // Node (tests): English
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && LANGS.includes(q)) return q; // ?lang= forces a language for this page; it is not saved
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS.includes(saved)) return saved;
  } catch (e) { /* storage unavailable */ }
  return 'es';
})();

const I18N_ES = {};      // UI strings: English text → Spanish text (filled in i18n_es.js)
const CONTENT_ES = { cards: {}, rules: {}, scenarios: {} }; // filled in content_es.js

function fillParams(s, p) { return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s; }
function t(key, params) {
  const s = LANG === 'es' && Object.prototype.hasOwnProperty.call(I18N_ES, key) ? I18N_ES[key] : key;
  return fillParams(s, params);
}
// Same English text, different Spanish depending on context (e.g. "Custom" category vs. "Custom" filter).
function tc(ctx, key, params) {
  const k = ctx + '|' + key;
  return LANG === 'es' && Object.prototype.hasOwnProperty.call(I18N_ES, k) ? fillParams(I18N_ES[k], params) : t(key, params);
}
function getLang() { return LANG; }
function setLang(l) {
  if (!LANGS.includes(l)) return;
  LANG = l;
  if (typeof window !== 'undefined') { try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* storage unavailable */ } }
}

// Localized view of built-in content. Custom cards and the custom scenario are written by the
// players and are never translated.
function loc(kind, obj, field) {
  if (!obj) return '';
  if (LANG === 'es' && obj.deck !== 'custom') {
    const tr = CONTENT_ES[kind] && CONTENT_ES[kind][obj.id];
    if (tr && tr[field] != null) return tr[field];
  }
  return obj[field];
}
const cardText = def => loc('cards', def, 'text') || '';
const cardRef = def => loc('cards', def, 'ref');
const ruleTitle = r => loc('rules', r, 'title');
const ruleText = r => loc('rules', r, 'text');
const scenarioLoc = sc => (!sc || !sc.id || sc.id === 'custom' ? sc
  : { ...sc, title: loc('scenarios', sc, 'title'), text: loc('scenarios', sc, 'text'), competitor: loc('scenarios', sc, 'competitor') });

// Node (tests): expose as globals so engine.js and the dictionaries work as in the browser bundle.
if (typeof module !== 'undefined' && typeof window === 'undefined') {
  module.exports = { t, tc, setLang, getLang, loc, cardText, cardRef, ruleTitle, ruleText, scenarioLoc, fillParams, I18N_ES, CONTENT_ES };
  Object.assign(globalThis, module.exports);
}
