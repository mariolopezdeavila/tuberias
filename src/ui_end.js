  window.addEventListener('DOMContentLoaded', init);
  // Test hook
  window.__tuberias = { get state() { return S; }, get result() { return R; }, get room() { return room ? { code: room.code, role: room.role, save: room.save, status: room.status, peers: room.peers.length } : null; },
    exportPNG, exportJSON, loadExample, autoLayout, fitView, connect, openCardEditor, get selection() { return [...ui.stages]; } };
})();
