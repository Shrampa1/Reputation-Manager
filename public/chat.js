/*
 * Reputation Engine live chat.
 *
 * Paste on any website, just before </body> (Live chat → Settings gives you the exact snippet):
 *   <script src="https://YOUR_APP/chat.js" data-key="YOUR_KEY" data-api="https://YOUR_PROJECT.supabase.co/functions/v1/website-chat" async></script>
 *
 * Adds a chat bubble in a shadow root so the host site's CSS can't break it (and it can't break theirs).
 * The AI answers until someone from the team takes over in the Live chat inbox.
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
  var MAX_KEPT = 60;
  var sep = api.indexOf('?') < 0 ? '?' : '&';

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
  // Messages saved by older versions of this script had no ids: reload them from the server
  if (!Array.isArray(state.messages) || state.messages.some(function (m) { return typeof m.id !== 'number'; })) {
    state.messages = [];
    state.lastId = 0;
  }
  writeStore(state);

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function post(body) {
    body.key = key;
    body.visitor = state.visitor;
    return fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, body: b }; });
      });
  }
  function clientInfo() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
    return { language: navigator.language, timezone: tz, referrer: document.referrer };
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.wrap{position:fixed;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;gap:12px}',
    '.wrap.right{right:20px;align-items:flex-end}.wrap.left{left:20px;align-items:flex-start}',
    '.bubble{position:relative;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;background:var(--accent);color:#fff;box-shadow:0 6px 20px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center}',
    '.dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff}.dot[hidden]{display:none}',
    '.bubble:focus-visible,.send:focus-visible,.close:focus-visible,.star:focus-visible{outline:3px solid #0f172a;outline-offset:2px}',
    '.panel{width:370px;max-width:calc(100vw - 32px);height:540px;max-height:calc(100vh - 110px);background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.25);display:flex;flex-direction:column;overflow:hidden}',
    '.panel[hidden]{display:none}',
    '.head{background:var(--accent);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:8px}',
    '.titles{flex:1;min-width:0}',
    '.head p{margin:0;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.head .sub{font-size:12px;font-weight:400;opacity:.92;display:flex;align-items:center;gap:6px}',
    '.online{width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block}.online[hidden]{display:none}',
    '.close{background:transparent;border:0;color:#fff;cursor:pointer;font-size:22px;line-height:1;padding:2px 6px;border-radius:6px}',
    '.newchat{font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,.6);padding:4px 8px;margin-right:2px}.newchat[hidden]{display:none}',
    '.list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}',
    '.msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}',
    '.msg.bot{background:#fff;border:1px solid #e2e8f0;align-self:flex-start;border-bottom-left-radius:4px}',
    '.msg.agent{background:#fff;border:1px solid var(--accent);align-self:flex-start;border-bottom-left-radius:4px}',
    '.msg.visitor{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.msg.error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;align-self:flex-start}',
    '.who{font-size:11px;color:#64748b;margin:2px 4px -4px;align-self:flex-start}',
    '.event{align-self:center;font-size:12px;color:#64748b;text-align:center;padding:4px 8px}',
    '.typing{align-self:flex-start;font-size:13px;color:#64748b;padding:4px 2px}.typing[hidden]{display:none}',
    '.rate{align-self:stretch;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center;font-size:13px;color:#334155}',
    '.stars{display:flex;justify-content:center;gap:4px;margin:8px 0}',
    '.star{background:none;border:0;cursor:pointer;font-size:24px;line-height:1;color:#cbd5e1;padding:2px}.star.on{color:#f59e0b}',
    '.rate textarea{width:100%;min-height:52px;margin-bottom:8px}',
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
    var onlineDot = el('span', 'online');
    var subText = el('span');
    sub.appendChild(onlineDot);
    sub.appendChild(subText);
    titles.appendChild(sub);
    head.appendChild(titles);
    // Starts over as a new conversation (the old one stays in the business's inbox)
    var fresh = el('button', 'close newchat', 'New chat');
    fresh.type = 'button';
    fresh.setAttribute('aria-label', 'Start a new chat');
    head.appendChild(fresh);
    var close = el('button', 'close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close chat');
    head.appendChild(close);
    panel.appendChild(head);

    var list = el('div', 'list');
    list.setAttribute('aria-live', 'polite');
    panel.appendChild(list);
    var typing = el('div', 'typing');
    typing.hidden = true;

    var form = el('form');
    var input = el('textarea');
    input.rows = 1;
    input.maxLength = 1000;
    input.placeholder = 'Type your message…';
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
    bubble.setAttribute('aria-expanded', 'false');
    wrap.appendChild(bubble);
    var dot = el('span', 'dot');
    dot.hidden = true;

    var agentsOnline = 0;
    var lastAgentName = null;

    // ---------- rendering ----------
    function scrollDown() { list.scrollTop = list.scrollHeight; }
    function bubbleFor(m) {
      if (m.meta && m.meta.ended) return el('div', 'event', m.body);
      if (m.sender === 'agent') {
        lastAgentName = m.author_name || 'Team';
        var frag = document.createDocumentFragment();
        frag.appendChild(el('div', 'who', lastAgentName + ' · ' + cfg.businessName));
        frag.appendChild(el('div', 'msg agent', m.body));
        return frag;
      }
      return el('div', 'msg ' + (m.sender === 'visitor' ? 'visitor' : 'bot'), m.body);
    }
    function render(m) {
      list.insertBefore(bubbleFor(m), typing);
      if (m.meta && m.meta.ended) showRating();
      scrollDown();
    }
    function addError(text) {
      list.insertBefore(el('div', 'msg error', text), typing);
      scrollDown();
    }
    function redraw() {
      rateCard = null;
      list.textContent = '';
      list.appendChild(typing);
      list.insertBefore(el('div', 'msg bot', cfg.greeting), typing);
      state.messages.forEach(function (m) { list.insertBefore(bubbleFor(m), typing); });
      if (state.ratingDue && state.ratedFor !== state.conversation) showRating();
      showStatus();
      scrollDown();
    }

    /** Adds messages we haven't seen yet (by id); returns true if any came from the team. */
    function absorb(messages) {
      var fromTeam = false;
      (messages || []).forEach(function (m) {
        if (m.id <= (state.lastId || 0)) return;
        state.lastId = m.id;
        state.messages.push({ id: m.id, sender: m.sender, author_name: m.author_name, body: m.body, meta: m.meta });
        if (m.meta && m.meta.ended) state.ratingDue = true;
        if (m.sender !== 'visitor') fromTeam = true;
        render(m);
      });
      state.messages = state.messages.slice(-MAX_KEPT);
      state.active = Date.now();
      writeStore(state);
      return fromTeam;
    }

    function showStatus() {
      fresh.hidden = !state.messages.length;
      onlineDot.hidden = !(agentsOnline > 0 || state.mode === 'agent');
      subText.textContent = state.mode === 'agent'
        ? 'You’re chatting with ' + (lastAgentName || 'our team')
        : state.needsAgent ? 'A team member will join soon'
        : agentsOnline > 0 ? 'We’re online' : 'We usually reply in a few minutes';
    }

    // ---------- end-of-chat rating ----------
    var rateCard = null;
    function showRating() {
      if (rateCard || state.ratedFor === state.conversation) return;
      rateCard = el('div', 'rate');
      rateCard.appendChild(el('div', null, 'How did we do?'));
      var stars = el('div', 'stars');
      var chosen = 0;
      var buttons = [];
      for (var i = 1; i <= 5; i++) {
        (function (n) {
          var s = el('button', 'star', '★');
          s.type = 'button';
          s.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
          s.addEventListener('click', function () {
            chosen = n;
            buttons.forEach(function (b, j) { b.className = 'star' + (j < n ? ' on' : ''); });
            comment.hidden = false;
            submitRating.hidden = false;
          });
          buttons.push(s);
          stars.appendChild(s);
        })(i);
      }
      rateCard.appendChild(stars);
      var comment = el('textarea');
      comment.placeholder = 'Anything to add? (optional)';
      comment.maxLength = 500;
      comment.hidden = true;
      rateCard.appendChild(comment);
      var submitRating = el('button', 'send', 'Send feedback');
      submitRating.type = 'button';
      submitRating.hidden = true;
      submitRating.style.padding = '8px 14px';
      submitRating.addEventListener('click', function () {
        if (!chosen) return;
        post({ action: 'rate', conversation: state.conversation, rating: chosen, comment: comment.value }).then(function () {
          state.ratedFor = state.conversation;
          state.ratingDue = false;
          writeStore(state);
          rateCard.textContent = 'Thanks for your feedback!';
        });
      });
      rateCard.appendChild(submitRating);
      list.insertBefore(rateCard, typing);
      scrollDown();
    }

    // ---------- open / close ----------
    function setBubble(open) {
      bubble.innerHTML = open ? ICON_CLOSE : ICON_CHAT;
      bubble.appendChild(dot);
      bubble.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
      bubble.setAttribute('aria-expanded', String(open));
    }
    function setOpen(open) {
      panel.hidden = !open;
      setBubble(open);
      if (open) {
        dot.hidden = true;
        scrollDown();
        input.focus();
        if (state.conversation) poll();
      }
      schedulePoll();
    }
    bubble.addEventListener('click', function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); bubble.focus(); });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setOpen(false); bubble.focus(); }
    });

    fresh.addEventListener('click', function () {
      clearTimeout(pollTimer);
      state.messages = [];
      state.conversation = null;
      state.lastId = 0;
      state.mode = 'ai';
      state.needsAgent = false;
      state.ratingDue = false;
      rateCard = null;
      writeStore(state);
      redraw();
      input.focus();
    });

    // ---------- new messages, typing, status (polling) ----------
    // Every 3 s while the chat is open; every 15 s while it's closed and the chat was active in the
    // last 30 minutes (or a team member is chatting).
    var pollTimer = null;
    function schedulePoll() {
      clearTimeout(pollTimer);
      if (!state.conversation) return;
      var quiet = Date.now() - (state.active || 0);
      if (panel.hidden && state.mode !== 'agent' && !state.needsAgent && quiet > 30 * 60000) return;
      if (!panel.hidden && quiet > 24 * 3600000) return;
      pollTimer = setTimeout(poll, panel.hidden ? 15000 : 3000);
    }
    function poll() {
      clearTimeout(pollTimer);
      if (!state.conversation) return;
      var q = 'key=' + encodeURIComponent(key) + '&visitor=' + encodeURIComponent(state.visitor) +
        '&conversation=' + encodeURIComponent(state.conversation) + '&after=' + (state.lastId || 0);
      fetch(api + sep + q)
        .then(function (res) {
          if (res.status === 404) {
            // Deleted by the business: start over quietly
            state.conversation = null;
            state.messages = [];
            state.lastId = 0;
            writeStore(state);
            redraw();
            return null;
          }
          return res.ok ? res.json() : null;
        })
        .then(function (r) {
          if (!r) return;
          var fromTeam = absorb(r.messages);
          if (fromTeam && panel.hidden) dot.hidden = false;
          state.mode = r.mode;
          state.needsAgent = r.needsAgent;
          if (r.status === 'resolved' && !r.rated && state.ratedFor !== state.conversation) state.ratingDue = true;
          writeStore(state);
          typing.textContent = (lastAgentName || 'Our team') + ' is typing…';
          typing.hidden = !r.agentTyping;
          showStatus();
        })
        .catch(function () { /* try again next time */ })
        .then(schedulePoll);
    }

    // ---------- sending ----------
    var busy = false;
    function submit(e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text || busy) return;
      busy = true;
      send.disabled = true;
      input.value = '';
      input.style.height = 'auto';
      // Shown straight away; replaced by the saved copy when the server answers
      var pending = el('div', 'msg visitor', text);
      list.insertBefore(pending, typing);
      if (state.mode !== 'agent') {
        typing.textContent = 'Typing…';
        typing.hidden = false;
      }
      scrollDown();

      post({ action: 'message', conversation: state.conversation || null, message: text, page: location.href, info: clientInfo() })
        .then(function (r) {
          pending.remove();
          typing.hidden = true;
          if (!r.ok || !r.body.conversation) {
            list.insertBefore(el('div', 'msg visitor', text), typing);
            addError(r.body.error || 'Something went wrong. Please try again.');
            return;
          }
          if (state.conversation !== r.body.conversation) {
            state.conversation = r.body.conversation;
            state.ratingDue = false;
            rateCard = null;
          }
          state.mode = r.body.mode;
          absorb(r.body.messages);
          showStatus();
        })
        .catch(function () {
          pending.remove();
          typing.hidden = true;
          list.insertBefore(el('div', 'msg visitor', text), typing);
          addError('Couldn’t reach the chat. Check your connection and try again.');
        })
        .then(function () {
          busy = false;
          send.disabled = false;
          input.focus();
          schedulePoll();
        });
    }
    form.addEventListener('submit', submit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : submit(e); }
    });
    // "Visitor is typing…" in the inbox, at most every 4 seconds
    var lastTypingPing = 0;
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 96) + 'px';
      if (state.conversation && state.mode === 'agent' && Date.now() - lastTypingPing > 4000) {
        lastTypingPing = Date.now();
        post({ action: 'typing', conversation: state.conversation }).catch(function () { /* ignore */ });
      }
    });

    // ---------- visitors online (check in every 30 s while the page is visible) ----------
    function ping() {
      if (document.visibilityState === 'hidden') return;
      post({ action: 'ping', page: location.href, title: document.title, info: clientInfo() })
        .then(function (r) {
          if (!r.ok) return;
          agentsOnline = r.body.agentsOnline || 0;
          // A team member started a chat with this visitor
          if (r.body.invite && r.body.invite !== state.conversation) {
            state.conversation = r.body.invite;
            state.messages = [];
            state.lastId = 0;
            state.mode = 'agent';
            state.active = Date.now();
            writeStore(state);
            redraw();
            if (window.innerWidth > 480) setOpen(true);
            else { dot.hidden = false; poll(); }
          }
          showStatus();
        })
        .catch(function () { /* ignore */ });
    }
    ping();
    setInterval(ping, 30000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') ping(); });

    setBubble(false);
    redraw();
    if (startOpen) setOpen(true);
    else if (state.conversation) poll();
  }

  function init() {
    fetch(api + sep + 'key=' + encodeURIComponent(key))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (cfg) { if (cfg && cfg.businessName) build(cfg); })
      .catch(function () { /* chat off or unreachable: show nothing */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
