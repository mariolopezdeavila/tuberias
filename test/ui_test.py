"""Headless UI test for Tuberías: load, example, drag & drop, connect, review, editor, export."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
url = (root / "dist" / "tuberias.html").as_uri()
shots = root / "test" / "shots"; shots.mkdir(exist_ok=True)
errors = []

def skip_landing(pg):
    """With Supabase configured the app opens on the rooms screen; tests run offline."""
    btn = pg.locator("#landing button", has_text="Work offline")
    if btn.count() and btn.first.is_visible():
        btn.first.click(); pg.wait_for_timeout(200)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1600, "height": 900}, accept_downloads=True)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and not m.text.startswith("Failed to load resource: net::") and errors.append(m.text))  # network errors: no Supabase in offline tests
    pg.goto(url)
    pg.wait_for_timeout(300)
    skip_landing(pg)
    pg.screenshot(path=str(shots / "01-empty.png"))

    # 1. drag a card from the deck to the board (HTML5 DnD)
    pg.drag_and_drop(".ditem:has-text('A Developer Commits Code')", "#viewport", target_position={"x": 200, "y": 300})
    pg.drag_and_drop(".ditem:has-text('Unit Testing')", "#viewport", target_position={"x": 500, "y": 300})
    # drop Lint onto the Unit Testing stage -> parallel
    unit_stage = pg.locator(".stage", has=pg.locator(".card", has_text="Unit Testing"))
    pg.drag_and_drop(".ditem:has-text('Lint')", ".stage:has(.card:has-text('Unit Testing'))")
    st = pg.evaluate("window.__tuberias.state")
    assert len(st["stages"]) == 2, st["stages"]
    assert any(len(s["cards"]) == 2 for s in st["stages"]), "parallel stage not created"
    # connect commit -> unit stage by dragging port
    port = pg.locator(".stage:has(.card:has-text('A Developer Commits Code')) .port")
    box = port.bounding_box()
    tgt = pg.locator(".stage:has(.card:has-text('Unit Testing'))").bounding_box()
    pg.mouse.move(box["x"] + 8, box["y"] + 8); pg.mouse.down()
    pg.mouse.move(tgt["x"] + 60, tgt["y"] + 60, steps=8); pg.mouse.up()
    st = pg.evaluate("window.__tuberias.state")
    assert len(st["edges"]) == 1, "edge not created"
    pg.screenshot(path=str(shots / "02-manual.png"))

    # 2. load the example and review
    pg.click("text=File ▾"); pg.click("button[data-act=example]")
    pg.wait_for_timeout(200)
    pg.click("#btnReview")
    pg.wait_for_timeout(200)
    r = pg.evaluate("({lt: window.__tuberias.result.leadTime, b: window.__tuberias.result.bottleneck && window.__tuberias.result.bottleneck.title, rules: window.__tuberias.result.rules.map(r=>r.id+':'+r.status).join(' '), f: window.__tuberias.result.findings.map(f=>f.text)})")
    print("example:", json.dumps(r, indent=1))
    assert pg.locator(".card.bottleneck").count() == 1
    pg.screenshot(path=str(shots / "03-example-review.png"))

    # 3. edit the bottleneck card: set wait to 0 -> lead time must drop
    lt_before = r["lt"]
    pg.dblclick(".card.bottleneck")
    pg.wait_for_selector("dialog[open]")
    pg.screenshot(path=str(shots / "04-editor.png"))
    waits = pg.locator("dialog .dur-in input[type=number]")
    waits.nth(1).fill("0"); waits.nth(1).dispatch_event("change")
    pg.click("#dlgSave")
    lt_after = pg.evaluate("window.__tuberias.result.leadTime")
    print("lead time", lt_before, "->", lt_after, "new bottleneck:", pg.evaluate("window.__tuberias.result.bottleneck.title"))
    assert lt_after < lt_before
    # undo restores
    pg.keyboard.press("Control+z")
    assert pg.evaluate("window.__tuberias.result.leadTime") == lt_before

    # 4. modeling mode + rules tab
    pg.click("#modeSeg button[data-m=modeling]")
    pg.click(".tabs button[data-t=rules]")
    pg.screenshot(path=str(shots / "05-rules.png"))
    pg.click(".tabs button[data-t=review]")

    # 5. exports
    with pg.expect_download() as d:
        pg.click("text=Export ▾"); pg.click("button[data-act=json]")
    jpath = shots / "export.json"; d.value.save_as(str(jpath))
    j = json.loads(jpath.read_text())
    assert j["app"] == "tuberias" and j["evaluation"]["leadTime"] == lt_before
    with pg.expect_download() as d:
        pg.click("text=Export ▾"); pg.click("button[data-act=png]")
    d.value.save_as(str(shots / "export.png"))

    # 6. import round-trip
    pg.click("text=File ▾"); pg.once("dialog", lambda dl: dl.accept()); pg.click("button[data-act=new]")
    assert pg.evaluate("window.__tuberias.state.stages.length") == 0
    pg.set_input_files("#fileIn", str(jpath))
    pg.wait_for_timeout(300)
    assert pg.evaluate("window.__tuberias.result.leadTime") == lt_before
    # 7. auto layout
    pg.click("button[data-act=layout]"); pg.wait_for_timeout(200)
    pg.screenshot(path=str(shots / "06-layout-modeling.png"))
    # 8. persistence across reload
    pg.reload(); pg.wait_for_timeout(300)
    assert pg.evaluate("window.__tuberias.result.leadTime") == lt_before
    b.close()

print("errors:", errors)
assert not errors
print("UI TESTS PASSED")

# ---- multi-select & group move ----
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(200); skip_landing(pg)
    pg.click("text=File ▾"); pg.click("button[data-act=example]"); pg.wait_for_timeout(200)
    st0 = {s["id"]: (s["x"], s["y"]) for s in pg.evaluate("window.__tuberias.state.stages")}
    nodes = pg.locator(".stage")
    b1, b2 = nodes.nth(1).bounding_box(), nodes.nth(3).bounding_box()
    # shift + drag marquee from empty area above stages 1..3
    x1, y1 = b1["x"] - 15, min(b1["y"], b2["y"]) - 60
    x2, y2 = b2["x"] + b2["width"] - 20, max(b1["y"] + b1["height"], b2["y"] + b2["height"]) + 10
    pg.keyboard.down("Shift"); pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x2, y2, steps=10); pg.mouse.up(); pg.keyboard.up("Shift")
    sel = pg.evaluate("window.__tuberias.selection")
    print("selected:", sel)
    assert len(sel) >= 3, sel
    assert pg.locator("#selInfo").is_visible()
    # drag one selected stage header -> all move by same delta
    h = pg.locator(f".stage[data-id='{sel[0]}'] .shead").bounding_box()
    pg.mouse.move(h["x"] + 30, h["y"] + 10); pg.mouse.down(); pg.mouse.move(h["x"] + 30, h["y"] + 150, steps=8); pg.mouse.up()
    st1 = {s["id"]: (s["x"], s["y"]) for s in pg.evaluate("window.__tuberias.state.stages")}
    deltas = {sid: (st1[sid][0] - st0[sid][0], st1[sid][1] - st0[sid][1]) for sid in st0}
    moved = {k: v for k, v in deltas.items() if v != (0, 0)}
    print("moved:", moved)
    assert set(moved) == set(sel) and len(set(moved.values())) == 1
    edges_before = len(pg.evaluate("window.__tuberias.state.edges"))
    pg.screenshot(path=str(shots / "07-multiselect.png"))
    # undo button restores positions
    pg.click("#btnUndo")
    st2 = {s["id"]: (s["x"], s["y"]) for s in pg.evaluate("window.__tuberias.state.stages")}
    assert st2 == st0, "undo did not restore"
    # A1 message on a non-LLM scenario
    pg.click(".tabs button[data-t=scenario]")
    pg.select_option("#scenarioSel", "s-ai-agents")
    a1 = pg.evaluate("window.__tuberias.result.rules.find(r=>r.id==='A1')")
    print("A1 on agents scenario:", a1)
    assert a1["status"] == "na"
    pg.select_option("#scenarioSel", "s-ai-bank")
    b.close()
print("errors:", errors)
assert not errors
print("MULTISELECT TESTS PASSED")
