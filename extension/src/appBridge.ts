// Content script injected into the Civitas app pages only. It is the bridge
// between the app's React side panel (which can't touch the cross-origin portal
// tab) and the extension's background worker (which can).
//
// Protocol (window.postMessage):
//   app  -> bridge : { source: "civitas-app", id, type, payload }
//   bridge -> app  : { source: "civitas-ext", id, ok, result?, error? }
// On load it also announces presence with { source: "civitas-ext", type: "ready" }.

const APP_TYPES = new Set(["ping", "open", "snapshot", "execute", "focus", "highlight", "close"]);

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== "civitas-app" || typeof data.id !== "string") return;
  if (!APP_TYPES.has(data.type)) return;

  const reply = (resp: { ok: boolean; result?: unknown; error?: string }) =>
    window.postMessage({ source: "civitas-ext", id: data.id, ...resp }, window.location.origin);

  try {
    chrome.runtime.sendMessage({ type: `agent-${data.type}`, payload: data.payload }, (resp) => {
      if (chrome.runtime.lastError) {
        reply({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      reply(resp ?? { ok: false, error: "no response" });
    });
  } catch (e) {
    reply({ ok: false, error: String(e).slice(0, 120) });
  }
});

// Announce that the extension is installed so the app can show agent controls.
window.postMessage({ source: "civitas-ext", type: "ready" }, window.location.origin);
