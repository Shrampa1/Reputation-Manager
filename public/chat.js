/*
 * Reputation Engine website chat.
 *
 * Paste on any website, just before </body> (Settings → Website chat gives you the exact snippet):
 *   <script src="https://YOUR_APP/chat.js" data-key="YOUR_KEY" data-api="https://YOUR_PROJECT.supabase.co/functions/v1/website-chat" async></script>
 *
 * Adds a chat bubble in a shadow root so the host site's CSS can't break it (and it can't break theirs).
 * Optional: data-open="true" opens the chat straight away (used by the in-app preview).
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var api = script && script.getAttribute('data-api');
  var key = script && script.getAttribute('data-key');
  var startOpen = script && script.getAttribute('data-open') === 'true';
  var appOrigin = script ? new URL(script.src, location.href).origin : '';
  if (!api || !/^[a-f0-9]{32}$/.test(key || '')) {
    console.warn('[website chat] missing data-api or data-key on the <script> tag');
    return;
  }
  if (window.__reChatLoaded) return;
  window.__reChatLoaded = true;

  var STORE = 're-chat-' + key;
  var MAX_KEPT = 40;

  // Storage can be blocked (private mode, strict cookie settings): fall back to memory
  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeStore(s) {
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* memory only */ }
  }
  function randomId() {
    var bytes = new Uint8Array(18);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  var state = readStore();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(state.visitor || '')) state.visitor = randomId();
  if (!Array.isArray(state.messages)) state.messages = [];
  writeStore(state);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.wrap{position:fixed;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;gap:12px}',
    '.wrap.right{right:20px;align-items:flex-end}.wrap.left{left:20px;align-items:flex-start}',
    '.bubble{width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:var(--accent);color:#fff;box-shadow:0 6px 20px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center}',
    '.bubble:focus-visible,.send:focus-visible,.close:focus-visible{outline:3px solid #0f172a;outline-offset:2px}',
    '.panel{width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 110px);background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.25);display:flex;flex-direction:column;overflow:hidden}',
    '.panel[hidden]{display:none}',
    '.head{background:var(--accent);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:8px}',
    '.titles{flex:1;min-width:0}',
    '.head p{margin:0;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.head .sub{font-size:12px;font-weight:400;opacity:.9}.head .sub:empty{display:none}',
    '.who{font-size:11px;color:#64748b;margin:2px 4px -4px;align-self:flex-start}',
    '.msg.agent{background:#fff;border:1px solid var(--accent);align-self:flex-start;border-bottom-left-radius:4px}',
    '.bubble{position:relative}.dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff}.dot[hidden]{display:none}',
    '.close{background:transparent;border:0;color:#fff;cursor:pointer;font-size:22px;line-height:1;padding:2px 6px;border-radius:6px}',
    '.list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}',
    '.msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}',
    '.msg.assistant{background:#fff;border:1px solid #e2e8f0;align-self:flex-start;border-bottom-left-radius:4px}',
    '.msg.visitor{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.msg.error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;align-self:flex-start}',
    '.typing{align-self:flex-start;font-size:13px;color:#64748b;padding:4px 2px}',
    'form{display:flex;gap:8px;padding:10px;border-top:1px solid #e2e8f0;background:#fff}',
    'textarea{flex:1;resize:none;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;font-size:14px;color:#0f172a;max-height:96px;min-height:40px}',
    'textarea:focus{outline:2px solid var(--accent);outline-offset:0;border-color:transparent}',
    '.send{border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:14px;padding:0 14px;cursor:pointer}',
    '.send:disabled{opacity:.5;cursor:default}',
    '.brand{text-align:center;font-size:11px;padding:0 0 8px;background:#fff}.brand a{color:#94a3b8;text-decoration:none}',
    '@media (max-width:480px){.wrap{bottom:12px}.wrap.right{right:12px}.wrap.left{left:12px}.panel{height:calc(100vh - 96px)}}',
  ].join('');

  var ICON_CHAT = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_CLOSE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

  function build(cfg) {
    var host = document.createElement('div');
    host.setAttribute('data-reputation-engine-chat', '');
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    var style = el('style');
    style.textContent = CSS;
    root.appendChild(style);

    var wrap = el('div', 'wrap ' + (cfg.position === 'left' ? 'left' : 'right'));
    wrap.style.setProperty('--accent', /^#[0-9a-f]{6}$/i.test(cfg.accent || '') ? cfg.accent : '#0284c7');
    root.appendChild(wrap);

    var panel = el('div', 'panel');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with ' + cfg.businessName);
    var head = el('div', 'head');
    var titles = el('div', 'titles');
    titles.appendChild(el('p', null, cfg.businessName));
    var sub = el('p', 'sub');
    titles.appendChild(sub);
    head.appendChild(titles);
    var close = el('button', 'close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close chat');
    head.appendChild(close);
    panel.appendChild(head);

    var list = el('div', 'list');
    list.setAttribute('aria-live', 'polite');
    panel.appendChild(list);

    var form = el('form');
    var input = el('textarea');
    input.rows = 1;
    input.maxLength = 1000;
    input.placeholder = 'Type your question…';
    input.setAttribute('aria-label', 'Your message');
    var send = el('button', 'send', 'Send');
    send.type = 'submit';
    form.appendChild(input);
    form.appendChild(send);
    panel.appendChild(form);

    if (cfg.showBranding) {
      var brand = el('div', 'brand');
      var a = el('a', null, 'Chat by Reputation Engine');
      a.href = appOrigin || 'https://reputation.engine';
      a.target = '_blank';
      a.rel = 'noopener';
      brand.appendChild(a);
      panel.appendChild(brand);
    }
    wrap.appendChild(panel);

    var bubble = el('button', 'bubble');
    bubble.type = 'button';
    bubble.innerHTML = ICON_CHAT;
    bubble.setAttribute('aria-label', 'Open chat');
    bubble.setAttribute('aria-expanded', 'false');
    wrap.appendChild(bubble);
    var dot = el('span', 'dot');
    dot.hidden = true;

    function add(role, text, name) {
      // Team replies are labelled with the team member's name
      if (role === 'agent') list.appendChild(el('div', 'who', (name || 'Team') + ' · ' + cfg.businessName));
      var m = el('div', 'msg ' + role, text);
      list.appendChild(m);
      list.scrollTop = list.scrollHeight;
      return m;
    }
    add('assistant', cfg.greeting);
    state.messages.forEach(function (m) { add(m.role, m.text, m.name); });

    function showStatus() {
      var lastAgent = state.messages.filter(function (m) { return m.role === 'agent'; }).pop();
      sub.textContent = state.mode === 'agent'
        ? 'You’re chatting with ' + (lastAgent ? lastAgent.name : 'our team')
        : state.needsAgent ? 'A team member will join soon' : '';
    }
    showStatus();

    function setBubble(open) {
      bubble.innerHTML = open ? ICON_CLOSE : ICON_CHAT;
      bubble.appendChild(dot);
    }
    setBubble(false);

    function setOpen(open) {
      panel.hidden = !open;
      setBubble(open);
      bubble.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
      bubble.setAttribute('aria-expanded', String(open));
      if (open) {
        dot.hidden = true;
        list.scrollTop = list.scrollHeight;
        input.focus();
      }
      schedulePoll();
    }
    bubble.addEventListener('click', function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); bubble.focus(); });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setOpen(false); bubble.focus(); }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : submit(e); }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 96) + 'px';
    });

    var busy = false;
    function remember(role, text, name) {
      var m = { role: role, text: text };
      if (name) m.name = name;
      state.messages.push(m);
      state.messages = state.messages.slice(-MAX_KEPT);
      state.active = Date.now();
      writeStore(state);
    }

    // Team replies: check every 5 s while the chat is open, every 20 s while it's closed and a team
    // member is (or was asked to be) chatting.
    var pollTimer = null;
    function schedulePoll() {
      clearTimeout(pollTimer);
      // Open: keep checking for a day after the last message; closed: for 30 minutes
      var quiet = Date.now() - (state.active || 0);
      if (!state.conversation || quiet > (panel.hidden ? 30 * 60000 : 24 * 3600000)) return;
      if (panel.hidden && state.mode !== 'agent' && !state.needsAgent) return;
      pollTimer = setTimeout(poll, panel.hidden ? 20000 : 5000);
    }
    function poll() {
      var q = 'key=' + encodeURIComponent(key) + '&visitor=' + encodeURIComponent(state.visitor) +
        '&conversation=' + encodeURIComponent(state.conversation) + '&since=' + encodeURIComponent(state.lastAgentAt || '');
      fetch(api + (api.indexOf('?') < 0 ? '?' : '&') + q)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (r) {
          if (!r) return;
          r.messages.forEach(function (m) {
            add('agent', m.text, m.name);
            remember('agent', m.text, m.name);
            state.lastAgentAt = m.at;
          });
          if (r.messages.length && panel.hidden) dot.hidden = false;
          state.mode = r.mode;
          state.needsAgent = r.needsAgent;
          writeStore(state);
          showStatus();
        })
        .catch(function () { /* try again next time */ })
        .then(schedulePoll);
    }

    function submit(e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || busy) return;
      busy = true;
      send.disabled = true;
      input.value = '';
      input.style.height = 'auto';
      add('visitor', text);
      remember('visitor', text);
      var typing = el('div', 'typing', 'Typing…');
      list.appendChild(typing);
      list.scrollTop = list.scrollHeight;

      fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key, visitor: state.visitor, conversation: state.conversation || null, message: text, page: location.href }),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
        })
        .then(function (r) {
          typing.remove();
          if (!r.ok || !r.body.conversation) {
            add('error', r.body.error || 'Something went wrong. Please try again.');
            return;
          }
          state.conversation = r.body.conversation;
          state.mode = r.body.mode;
          state.needsAgent = r.body.needsAgent;
          // While a team member is chatting there's no automatic answer: their reply arrives by polling
          if (r.body.reply) {
            add('assistant', r.body.reply);
            remember('assistant', r.body.reply);
          } else {
            writeStore(state);
          }
          showStatus();
        })
        .catch(function () {
          typing.remove();
          add('error', 'Couldn’t reach the chat. Check your connection and try again.');
        })
        .then(function () {
          busy = false;
          send.disabled = false;
          input.focus();
          schedulePoll();
        });
    }
    form.addEventListener('submit', submit);

    if (startOpen) setOpen(true);
    else schedulePoll();
  }

  function init() {
    fetch(api + (api.indexOf('?') < 0 ? '?' : '&') + 'key=' + encodeURIComponent(key))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cfg) { if (cfg && cfg.businessName) build(cfg); })
      .catch(function () { /* chat off or unreachable: show nothing */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
