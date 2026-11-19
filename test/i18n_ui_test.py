"""Spanish UI test: Spanish by default, ES/EN switch, ?lang=en, and no clipped labels at common laptop widths.
Screenshots go to test/shots/es-*.png for visual review."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
base = (root / "dist" / "tuberias.html").as_uri()
shots = root / "test" / "shots"; shots.mkdir(exist_ok=True)
errors, problems = [], []

# Elements whose text must fit: buttons, tabs, chips, badges, tiles, segmented controls.
OVERFLOW_JS = """() => {
  const out = [];
  const vis = n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden'; };
  for (const n of document.querySelectorAll('header button, header .badge, .tabs button, .chip, .tile .k, .tile .s, .seg button, .bandcap span, .legend span, dialog[open] button, dialog[open] label, #landing button, .sbtn, .toggle button')) {
    if (!vis(n) || n.classList.contains('scchip')) continue;  // the scenario chip is ellipsized on purpose
    if (n.scrollWidth > n.clientWidth + 1) out.push((n.id || n.className || n.tagName) + ': "' + n.textContent.trim().slice(0, 40) + '" ' + n.scrollWidth + '>' + n.clientWidth);
  }
  const h = document.querySelector('header');
  if (h.scrollWidth > h.clientWidth + 1) out.push('header overflows: ' + h.scrollWidth + '>' + h.clientWidth);
  return out;
}"""


def check(pg, where):
    for o in pg.evaluate(OVERFLOW_JS):
        problems.append(f"{where}: clipped {o}")


with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (1280, 1440, 1600):
        ctx = b.new_context(viewport={"width": w, "height": 860}, accept_downloads=True)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(base + "?backend=mock&profile=es" + str(w)); pg.wait_for_selector("#landing")
        assert pg.evaluate("window.__tuberias.lang") == "es", "Spanish must be the default"
        assert "Crear una sala" in pg.inner_text("#landing"), "landing in Spanish"
        if w == 1440: pg.screenshot(path=str(shots / "es-landing.png"))
        check(pg, f"{w} landing")
        pg.click("#landing button:has-text('Trabajar offline')")
        pg.click("text=Archivo ▾"); pg.click("button[data-act=example]"); pg.wait_for_timeout(300)
        assert pg.inner_text("#scChip").endswith("Agente de atención al cliente para un banco online"), pg.inner_text("#scChip")
        check(pg, f"{w} board")
        pg.click(".tabs button[data-t=rules]"); pg.wait_for_timeout(100)
        rules = pg.inner_text("#panelBody")
        assert "Reglas core" in rules and "R2 · Release Candidate antes de producción" in rules, rules[:200]
        if w == 1440: pg.screenshot(path=str(shots / "es-rules.png"))
        pg.click("#btnReview"); pg.wait_for_timeout(200)
        review = pg.text_content("#panelBody")
        for s in ["Lead time for changes", "Flow efficiency", "First-pass yield", "Esfuerzo manual", "Hallazgos", "Bottleneck: \"Go/No Go Decision Meeting\""]:
            if s not in review: problems.append(f"{w} review: missing {s!r}")
        tip = pg.get_attribute(".tile:has-text('Flow efficiency')", "title") or ""
        if "Proporción del lead time" not in tip: problems.append(f"{w}: Flow efficiency hover not in Spanish: {tip!r}")
        check(pg, f"{w} review")
        if w == 1440: pg.screenshot(path=str(shots / "es-review.png"))
        if w == 1280: pg.screenshot(path=str(shots / "es-review-1280.png"))
        # Card hover and editor
        card = pg.locator(".card:has-text('Code Review')").first
        if "Personas distintas de quien escribió el código" not in (card.get_attribute("title") or ""):
            problems.append(f"{w}: card hover not in Spanish")
        card.dblclick(); pg.wait_for_selector("dialog[open]")
        dlg = pg.inner_text("dialog[open]")
        for s in ["Code Review", "Tiempo de ejecución", "Referencia: Espera", "Restablecer valores"]:
            if s not in dlg: problems.append(f"{w} card editor: missing {s!r}")
        check(pg, f"{w} card editor")
        if w == 1440: pg.screenshot(path=str(shots / "es-card-editor.png"))
        pg.keyboard.press("Escape")
        pg.click("#btnCustom"); pg.wait_for_selector("dialog[open]"); check(pg, f"{w} custom card")
        if w == 1440: pg.screenshot(path=str(shots / "es-custom-card.png"))
        pg.keyboard.press("Escape")
        pg.click(".tabs button[data-t=scenario]"); pg.wait_for_timeout(100)
        sc = pg.inner_text("#panelBody")
        if "Tu competidor es un gran banco" not in sc or "Cómo se juega" not in sc: problems.append(f"{w} scenario tab not in Spanish")
        if w == 1440: pg.screenshot(path=str(shots / "es-scenario.png"))
        # Online room in Spanish (mock backend): header badges, share dialog
        pg.click("text=Archivo ▾"); pg.click("button[data-act=rooms]"); pg.wait_for_selector("#landing")
        pg.fill("#landing input >> nth=0", "Prueba"); pg.click("#landing button:has-text('Crear sala')")
        pg.wait_for_function("window.__tuberias.room && window.__tuberias.room.role==='editor'")
        pg.click("text=Archivo ▾"); pg.click("button[data-act=example]"); pg.wait_for_timeout(500)
        check(pg, f"{w} room header")
        if w in (1280, 1440): pg.screenshot(path=str(shots / f"es-room-{w}.png"))
        pg.click("#roomChip"); pg.wait_for_selector("dialog[open]"); check(pg, f"{w} share dialog")
        if w == 1440: pg.screenshot(path=str(shots / "es-share.png"))
        pg.keyboard.press("Escape")
        # Switch to English and back
        pg.click("#langSeg button[data-l=en]"); pg.wait_for_timeout(200)
        if pg.inner_text(".tabs button[data-t=rules]").strip() != "Rules": problems.append("EN switch: tabs not in English")
        if "Agent at an Online Bank" not in pg.inner_text("#scChip") and "Customer Support Agent" not in pg.inner_text("#scChip"): problems.append("EN switch: scenario chip not in English")
        check(pg, f"{w} english")
        if w == 1440: pg.screenshot(path=str(shots / "en-room-1440.png"))
        pg.click("#langSeg button[data-l=es]"); pg.wait_for_timeout(200)
        if pg.inner_text(".tabs button[data-t=rules]").strip() != "Reglas": problems.append("ES switch back failed")
        # PNG export in Spanish
        with pg.expect_download() as dl: pg.click("text=Exportar ▾"); pg.click("button[data-act=png]")
        dl.value.save_as(str(shots / f"es-export-{w}.png"))
        ctx.close()
    # ?lang=en forces English for that page only; the ES/EN switch is remembered
    ctx = b.new_context(); pg = ctx.new_page()
    pg.goto(base + "?backend=mock&profile=q&lang=en"); pg.wait_for_selector("#landing")
    if "Create a room" not in pg.inner_text("#landing"): problems.append("?lang=en did not open in English")
    pg.goto(base + "?backend=mock&profile=q"); pg.wait_for_selector("#landing")
    if "Crear una sala" not in pg.inner_text("#landing"): problems.append("?lang=en should not be saved")
    pg.click("#landing .langseg button:has-text('EN')"); pg.wait_for_selector("#landing")
    if "Create a room" not in pg.inner_text("#landing"): problems.append("landing switch to EN failed")
    pg.wait_for_timeout(300); pg.reload(); pg.wait_for_selector("#landing")
    if "Create a room" not in pg.inner_text("#landing"): problems.append("language choice not remembered")
    b.close()

print("errors:", errors)
for pr in problems:
    print("FAIL", pr)
if errors or problems:
    sys.exit(1)
print("SPANISH UI TESTS PASSED")
