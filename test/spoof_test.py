"""A participant without the edit key broadcasts a fake board: viewers must ignore it."""
from pathlib import Path
from playwright.sync_api import sync_playwright
base = (Path(__file__).resolve().parent.parent / "dist" / "index.html").as_uri()
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context()
    A, B, X = ctx.new_page(), ctx.new_page(), ctx.new_page()
    A.goto(base + "?backend=mock&profile=A"); A.wait_for_selector("#landing")
    A.click("#landing button:has-text('Create room')"); A.wait_for_function("window.__tuberias.room && window.__tuberias.room.role==='editor'")
    A.click("text=File ▾"); A.click("button[data-act=example]"); A.wait_for_function("window.__tuberias.room.save==='saved'")
    code = A.evaluate("window.__tuberias.room.code")
    B.goto(base + "?backend=mock&profile=B#room=" + code); B.wait_for_function("window.__tuberias.room && window.__tuberias.state.stages.length===10")
    X.goto(base + "?backend=mock&profile=X")  # attacker page, no key
    X.evaluate("""code => { const bc = new BroadcastChannel('tuberias-mock-' + code);
        bc.postMessage({type:'state', payload:{rev: 9e15, state:{app:'tuberias', name:'HACKED', rev: 9e15, stages:[], edges:[]}}}); }""", code)
    B.wait_for_timeout(800); A.wait_for_timeout(200)
    assert B.evaluate("window.__tuberias.state.name") != "HACKED" and B.evaluate("window.__tuberias.state.stages.length") == 10
    assert A.evaluate("window.__tuberias.state.stages.length") == 10
    # a real editor change still arrives
    A.fill("#pname", "Renamed by editor"); A.press("#pname", "Enter"); A.click("body", position={"x": 700, "y": 600})
    B.wait_for_function("window.__tuberias.state.name === 'Renamed by editor'", timeout=5000)
    b.close()
print("SPOOF TEST PASSED")
