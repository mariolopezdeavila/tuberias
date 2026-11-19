"""i18n completeness test: every English UI string has a Spanish translation, placeholders match,
and every built-in card, rule and scenario has its Spanish content.
Usage: python3 test/i18n_test.py            (test)
       python3 test/i18n_test.py --missing  (print missing keys as JSON, to translate them)"""
import json, re, subprocess, sys
from html.parser import HTMLParser
from pathlib import Path

root = Path(__file__).resolve().parent.parent
src = root / "src"
SKIP = {"i18n.js", "i18n_es.js", "content_es.js"}
CALL = re.compile(r"""(?<![\w.$])t\((['"])((?:\\.|(?!\1).)*)\1""")


def unescape(s):
    return re.sub(r"\\(.)", lambda m: {"n": "\n", "t": "\t"}.get(m.group(1), m.group(1)), s)


def js_keys():
    keys = set()
    for f in sorted(src.glob("*.js")):
        if f.name in SKIP:
            continue
        for m in CALL.finditer(f.read_text(encoding="utf-8")):
            keys.add(unescape(m.group(2)))
    return keys


class Static(HTMLParser):
    """Collects data-i18n text, data-i18n-html inner HTML, and title/placeholder attributes inside #app."""
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.html, self.keys, self.stack, self.in_app = html, set(), [], 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id") == "app":
            self.in_app = 1
        elif self.in_app and tag not in ("input", "br", "img"):
            self.in_app += 1
        if self.in_app:
            for k in ("title", "placeholder"):
                if a.get(k):
                    self.keys.add(a[k])
        if "data-i18n" in a:
            self.stack.append(["text", tag, ""])
        elif "data-i18n-html" in a:
            line, col = self.getpos()
            self.stack.append(["html", tag, (line, col, self.get_starttag_text())])

    def handle_data(self, data):
        for s in self.stack:
            if s[0] == "text":
                s[2] += data

    def handle_endtag(self, tag):
        if self.in_app and tag != "input":
            self.in_app -= 1
        if self.stack and self.stack[-1][1] == tag:
            kind, _, v = self.stack.pop()
            if kind == "text":
                self.keys.add(v)
            else:
                lines = self.html.split("\n")
                line, col, start = v
                rest = "\n".join(lines[line - 1:])[col + len(start):]
                self.keys.add(rest[: rest.index("</" + tag + ">")])


def es_data():
    js = ("require('./src/i18n.js'); require('./src/i18n_es.js'); const d = require('./src/data.js'); require('./src/content_es.js');"
          "const e = require('./src/engine.js');"
          "console.log(JSON.stringify({ ui: I18N_ES, content: CONTENT_ES, cats: Object.values(d.CATEGORIES).map(c => c.label),"
          " cards: d.CARDS.concat(e.RETIRED_CARDS).map(c => [c.id, !!c.ref]), rules: d.RULES.map(r => r.id), scenarios: d.SCENARIOS.map(s => s.id) }));")
    return json.loads(subprocess.check_output(["node", "-e", js], cwd=root))


def main():
    d = es_data()
    keys = js_keys() | Static((src / "index.html").read_text(encoding="utf-8")).keys
    keys |= {"category|" + c for c in d["cats"]} | {"minutes", "hours", "days", "weeks", "Tuberías — pipeline design game"}
    keys.discard("Language / Idioma"); keys.discard("Español"); keys.discard("English")
    missing = sorted(k for k in keys if k not in d["ui"])
    if "--missing" in sys.argv:
        print(json.dumps(missing, ensure_ascii=False, indent=1)); return
    problems = [f"missing UI translation: {k!r}" for k in missing]
    ph = re.compile(r"\{(\w+)\}")
    for k, v in d["ui"].items():
        if sorted(ph.findall(k)) != sorted(ph.findall(v)):
            problems.append(f"placeholders differ: {k!r} -> {v!r}")
    unused = sorted(k for k in d["ui"] if k not in keys)
    c = d["content"]
    for cid, has_ref in d["cards"]:
        tr = c["cards"].get(cid)
        if cid != "blank" and (not tr or not tr.get("text")):
            problems.append(f"card without Spanish text: {cid}")
        if has_ref and (not tr or not tr.get("ref")):
            problems.append(f"card without Spanish reference: {cid}")
    if not c["cards"].get("blank", {}).get("text"):
        problems.append("card without Spanish text: blank")
    for rid in d["rules"]:
        tr = c["rules"].get(rid) or {}
        if not tr.get("title") or not tr.get("text"):
            problems.append(f"rule without Spanish title/text: {rid}")
    for sid in d["scenarios"]:
        tr = c["scenarios"].get(sid) or {}
        if not all(tr.get(f) for f in ("title", "text", "competitor")):
            problems.append(f"scenario without Spanish title/text/competitor: {sid}")
    print(f"{len(keys)} UI strings, {len(d['ui'])} translations, {len(unused)} unused")
    for u in unused:
        print("  unused:", repr(u))
    for p in problems:
        print("FAIL", p)
    if problems:
        sys.exit(1)
    print("I18N TESTS PASSED")


main()
