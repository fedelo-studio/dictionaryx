/* Start: render at once, then connect. Inside Claude, a hot update keeps unsent drafts. */
let started = false;
function start(hd) {
  if (started) return; started = true;
  HOT = hd || {};
  render(html`<${App}/>`, document.getElementById('app'));
  boot();
}
const hot = window.claude && window.claude.hot;
try { if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => ({ drafts: DRAFTS })); } catch (e) { /* no hot reload */ }
try { if (hot && typeof hot.ready === 'function') hot.ready(start); else start((hot && hot.data) || {}); } catch (e) { start({}); }
setTimeout(() => start({}), 1500);
