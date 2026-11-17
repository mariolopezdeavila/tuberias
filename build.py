"""Bundle Tuberías into one self-contained HTML file.
Outputs dist/tuberias.html, dist/index.html and index.html at the repository root
(same file; the root copy is the one GitHub Pages serves).
Optional config.json: {"supabaseUrl": "...", "supabaseAnonKey": "..."} to enable online rooms."""
import json
from pathlib import Path

root = Path(__file__).parent
src = root / "src"
html = (src / "index.html").read_text(encoding="utf-8")
css = (src / "style.css").read_text(encoding="utf-8")
order = ["data.js", "engine.js", "sync.js", "ui1.js", "ui2.js", "ui3.js", "ui4.js", "ui_end.js"]
js = "\n".join((src / f).read_text(encoding="utf-8") for f in order).replace("</script", "<\\/script")
supa = (root / "vendor" / "supabase.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
supa = "/* @supabase/supabase-js (MIT licence) https://github.com/supabase/supabase-js */\n" + supa
cfg_file = root / "config.json"
cfg = json.loads(cfg_file.read_text()) if cfg_file.exists() else {"supabaseUrl": "", "supabaseAnonKey": ""}
cfg_js = "{ supabaseUrl: %s, supabaseAnonKey: %s }" % (json.dumps(cfg.get("supabaseUrl", "")), json.dumps(cfg.get("supabaseAnonKey", "")))
out = (html.replace("/*__CONFIG__*/{ supabaseUrl: \"\", supabaseAnonKey: \"\" }", cfg_js)
           .replace("/*__CSS__*/", css).replace("/*__SUPABASE__*/", supa).replace("/*__JS__*/", js))
(root / "dist").mkdir(exist_ok=True)
for name in ["tuberias.html", "index.html"]:
    (root / "dist" / name).write_text(out, encoding="utf-8")
(root / "index.html").write_text(out, encoding="utf-8")
print("dist/index.html", len(out.encode("utf-8")), "bytes", "· online rooms:", "ON" if cfg.get("supabaseUrl") else "OFF (no config)")
