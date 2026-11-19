"""Multi-page test of online rooms with the mock backend (?backend=mock).
Two 'profiles' (A = editor, B = viewer) share one browser context, so they share the mock database
(localStorage) and the message bus (BroadcastChannel), but keep separate edit keys."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
base = (root / "dist" / "index.html").as_uri()
shots = root / "test" / "shots"; shots.mkdir(exist_ok=True)
errors = []

def wait_for(pg, js, timeout=5000):
    pg.wait_for_function(js, timeout=timeout)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 860})
    A = ctx.new_page(); B = ctx.new_page(); C = ctx.new_page()
    for pg, n in ((A, "A"), (B, "B"), (C, "C")):
        pg.on("pageerror", lambda e, n=n: errors.append(n + ": " + str(e)))
        pg.on("console", lambda m, n=n: m.type == "error" and errors.append(n + ": " + m.text))

    # --- A creates a room from the landing page
    A.goto(base + "?lang=en&backend=mock&profile=A"); A.wait_for_selector("#landing")
    A.screenshot(path=str(shots / "r1-landing.png"))
    A.fill("#landing input[placeholder^='Pipeline name']", "Red team pipeline")
    A.fill("#landing input[placeholder^='Team name']", "Red")
    A.click("#landing button:has-text('Create room')")
    wait_for(A, "window.__tuberias.room && window.__tuberias.room.role === 'editor'")
    code = A.evaluate("window.__tuberias.room.code")
    print("room code:", code, "url:", A.url.split('#')[1])
    assert len(code) == 6 and "key=" not in A.url

    # --- B joins with the code (viewer)
    B.goto(base + "?lang=en&backend=mock&profile=B"); B.wait_for_selector("#landing")
    B.fill("#landing .code-in", code.lower()); B.click("#landing button:has-text('Join')")
    wait_for(B, "window.__tuberias.room && window.__tuberias.room.role === 'viewer'")
    assert B.evaluate("window.__tuberias.state.name") == "Red team pipeline"
    assert B.locator("body.readonly").count() == 1
    assert not B.locator("#deck").is_visible(), "viewer should not see the deck"

    # --- A edits: load example -> B sees it live
    A.click("text=File ▾"); A.click("button[data-act=example]")
    wait_for(A, "window.__tuberias.room.save === 'saved'")
    wait_for(B, "window.__tuberias.state.stages.length === 10")
    print("viewer received", B.evaluate("window.__tuberias.state.stages.length"), "stages")
    # presence
    wait_for(A, "window.__tuberias.room.peers >= 2")
    print("peers seen by editor:", A.evaluate("window.__tuberias.room.peers"))

    # --- Viewer cannot edit: drag stage header, keyboard delete, undo
    before = B.evaluate("JSON.stringify(window.__tuberias.state.stages.map(s=>[s.x,s.y]))")
    h = B.locator(".stage .shead").nth(2).bounding_box()
    B.mouse.move(h["x"] + 40, h["y"] + 10); B.mouse.down(); B.mouse.move(h["x"] + 40, h["y"] + 200, steps=6); B.mouse.up()
    B.keyboard.press("Control+a"); B.keyboard.press("Delete"); B.keyboard.press("Control+z")
    after = B.evaluate("JSON.stringify(window.__tuberias.state.stages.map(s=>[s.x,s.y]))")
    assert before == after and B.evaluate("window.__tuberias.state.stages.length") == 10, "viewer changed the board"
    # mock DB untouched by viewer
    db = json.loads(A.evaluate("localStorage.getItem('tuberias:mockdb')"))
    assert len(db["rooms"][code]["state"]["stages"]) == 10

    # --- Review sync: editor reveals -> viewer sees metrics & bottleneck
    B.click(".tabs button[data-t=review]")
    assert B.locator("text=until the editor of this room starts the review").count() == 1
    A.click("#btnReview")
    wait_for(B, "window.__tuberias.state.revealed === true")
    wait_for(B, "document.querySelectorAll('.card.bottleneck').length === 1")
    B.screenshot(path=str(shots / "r2-viewer-review.png"))
    A.screenshot(path=str(shots / "r3-editor.png"))

    # --- Viewer opens card editor read-only
    B.evaluate("window.__tuberias.openCardEditor(document.querySelector('.card.bottleneck').dataset.uid)"); B.wait_for_selector("dialog[open]")
    assert B.locator("#dlgSave").count() == 0
    B.keyboard.press("Escape")

    # --- Lobby: editor lists room; C sees it
    A.click("#roomChip"); A.wait_for_selector("dialog[open] .bigcode")
    A.screenshot(path=str(shots / "r4-share.png"))
    A.check("dialog[open] input[type=checkbox]"); A.click("dialog[open] button:has-text('Close')")
    wait_for(A, "window.__tuberias.room.save === 'saved'")
    C.goto(base + "?lang=en&backend=mock&profile=C"); C.wait_for_selector("#landing .lrow")
    lobby = C.locator("#landing .lobby").first.inner_text()
    print("lobby:", lobby.replace("\n", " | "))
    assert code in lobby

    # --- Editor link: C opens editor link -> becomes editor
    key = json.loads(A.evaluate("localStorage.getItem('tuberias@A:keys')"))[code]
    C.goto(base + "?lang=en&backend=mock&profile=C#room=" + code + "&key=" + key)
    wait_for(C, "window.__tuberias.room && window.__tuberias.room.role === 'editor'")
    assert "key=" not in C.url
    # --- B makes its own copy -> becomes editor of a new room
    B.click("#roomChip"); B.click("dialog[open] button:has-text('Make my own copy')")
    wait_for(B, "window.__tuberias.room && window.__tuberias.room.role === 'editor' && window.__tuberias.room.code !== '%s'" % code)
    assert B.evaluate("window.__tuberias.state.stages.length") == 10
    print("copy room:", B.evaluate("window.__tuberias.room.code"), B.evaluate("window.__tuberias.state.name"))

    # --- Reload: editor keeps role, state persisted
    A.reload(); wait_for(A, "window.__tuberias.room && window.__tuberias.room.role === 'editor'")
    assert A.evaluate("window.__tuberias.state.stages.length") == 10 and A.evaluate("window.__tuberias.state.listed") is True
    # --- Leave room -> landing, offline state restored
    A.click("#roomChip"); A.click("dialog[open] button:has-text('Leave room')")
    A.wait_for_selector("#landing")
    assert A.evaluate("window.__tuberias.room") is None
    A.screenshot(path=str(shots / "r5-landing-recent.png"))
    b.close()

print("errors:", errors)
assert not errors
print("ROOM TESTS PASSED")
