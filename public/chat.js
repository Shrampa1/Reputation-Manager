/*
 * Reputation Engine live chat.
 *
 * Paste on any website, just before </body> (Live chat → Settings gives you the exact snippet):
 *   <script src="https://YOUR_APP/chat.js" data-key="YOUR_KEY" data-api="https://YOUR_PROJECT.supabase.co/functions/v1/website-chat" async></script>
 *
 * Adds a chat bubble in a shadow root so the host site's CSS can't break it (and it can't break theirs).
 * The AI answers until someone from the team takes over in the Live chat inbox. Also: help articles,
 * files, transcripts, a pre-chat form, quick questions, business hours with an offline form,
 * proactive messages and browser voice calls (WebRTC, no plug-ins).
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
  var SESSION = 're-chat-session-' + key;
  var MAX_KEPT = 60;
  var sep = api.indexOf('?') < 0 ? '?' : '&';
  var ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

  // Storage can be blocked (private mode, strict cookie settings): fall back to memory
  function readJson(store, k) {
    try { return JSON.parse(store.getItem(k) || '{}') || {}; } catch (e) { return {}; }
  }
  function writeJson(store, k, v) {
    try { store.setItem(k, JSON.stringify(v)); } catch (e) { /* memory only */ }
  }
  function randomId() {
    var bytes = new Uint8Array(18);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  var state = readJson(window.localStorage, STORE);
  var session = readJson(window.sessionStorage, SESSION);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(state.visitor || '')) state.visitor = randomId();
  // Messages saved by older versions of this script had no ids: reload them from the server
  if (!Array.isArray(state.messages) || state.messages.some(function (m) { return typeof m.id !== 'number'; })) {
    state.messages = [];
    state.lastId = 0;
  }
  function save() { writeJson(window.localStorage, STORE, state); }
  function saveSession() { writeJson(window.sessionStorage, SESSION, session); }
  save();

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(cls, text, label) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (label) b.setAttribute('aria-label', label);
    return b;
  }
  function post(body) {
    body.key = key;
    body.visitor = state.visitor;
    return fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, status: res.status, body: b }; });
      });
  }
  function get(q) {
    return fetch(api + sep + 'key=' + encodeURIComponent(key) + '&' + q).then(function (res) { return res.ok ? res.json() : null; });
  }
  function clientInfo() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { /* ignore */ }
    return { language: navigator.language, timezone: tz, referrer: document.referrer };
  }
  function safeUrl(u) { return typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null; }
  function str(v, max) { return typeof v === 'string' && v.trim() ? v.trim().slice(0, max || 200) : ''; }

  // ---------- business hours and page rules (W2) ----------
  function minutes(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function openNow(h) {
    if (!h || !h.enabled) return true;
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: h.timezone || undefined, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : ''; };
      var day = get('weekday').toLowerCase().slice(0, 3);
      var now = (Number(get('hour')) % 24) * 60 + Number(get('minute'));
      return ((h.days || {})[day] || []).some(function (r) {
        var a = minutes(r.from), b = minutes(r.to);
        return a !== null && b !== null && now >= a && now < b;
      });
    } catch (e) { return true; }
  }
  function pageAllowed(p) {
    if (!p || !p.mode || p.mode === 'all') return true;
    var url = location.href.toLowerCase();
    var hit = (p.patterns || []).some(function (x) { return x && url.indexOf(String(x).toLowerCase()) >= 0; });
    return p.mode === 'only' ? hit : !hit;
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '[hidden]{display:none!important}',
    '.wrap{position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:12px}',
    '.wrap.right{align-items:flex-end}.wrap.left{align-items:flex-start}',
    '.bubble{position:relative;height:56px;min-width:56px;border-radius:28px;border:0;cursor:pointer;background:var(--accent);color:#fff;box-shadow:0 6px 20px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center;gap:8px;padding:0 16px;font-size:15px;font-weight:600}',
    '.bubble.round{width:56px;padding:0}',
    '.dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff}',
    'button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #0f172a;outline-offset:2px}',
    '.grab{max-width:260px;background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 8px 28px rgba(15,23,42,.2);padding:12px 30px 12px 14px;font-size:14px;line-height:1.4;position:relative;cursor:pointer;white-space:pre-wrap}',
    '.grab .x{position:absolute;top:4px;right:4px;border:0;background:none;color:#94a3b8;font-size:16px;cursor:pointer;line-height:1;padding:4px}',
    '.panel{width:380px;max-width:calc(100vw - 32px);height:580px;max-height:calc(100vh - 110px);background:#fff;color:#0f172a;border-radius:16px;box-shadow:0 12px 40px rgba(15,23,42,.25);display:flex;flex-direction:column;overflow:hidden;position:relative}',
    '.head{background:var(--accent);color:#fff;padding:12px 12px 12px 16px;display:flex;align-items:center;gap:10px}',
    '.logo{width:36px;height:36px;border-radius:50%;object-fit:cover;background:#fff}',
    '.titles{flex:1;min-width:0}',
    '.head p{margin:0;font-size:15px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.head .sub{font-size:12px;font-weight:400;opacity:.92;display:flex;align-items:center;gap:6px}',
    '.online{width:8px;height:8px;border-radius:50%;background:#4ade80;display:inline-block;flex:none}',
    '.hbtn{background:transparent;border:0;color:#fff;cursor:pointer;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1}',
    '.hbtn:hover{background:rgba(255,255,255,.15)}.hbtn:disabled{opacity:.45;cursor:default}',
    '.menu{position:absolute;top:56px;right:12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.15);z-index:3;overflow:hidden;min-width:190px}',
    '.menu button{display:block;width:100%;text-align:left;background:none;border:0;padding:10px 14px;font-size:14px;color:#0f172a;cursor:pointer}.menu button:hover{background:#f1f5f9}',
    '.tabs{display:flex;border-bottom:1px solid #e2e8f0;background:#fff}',
    '.tab{flex:1;background:none;border:0;border-bottom:2px solid transparent;padding:9px;font-size:13px;font-weight:600;color:#64748b;cursor:pointer}.tab.on{color:var(--accent);border-bottom-color:var(--accent)}',
    '.callbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#0f172a;color:#fff;font-size:13px}',
    '.callbar .ctext{flex:1}.callbar button{border:0;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer}',
    '.callbar .ok{background:#22c55e;color:#fff}.callbar .no{background:#ef4444;color:#fff}.callbar .mute{background:#334155;color:#fff}',
    '.list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}',
    '.msg{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}',
    '.msg.bot{background:#fff;border:1px solid #e2e8f0;align-self:flex-start;border-bottom-left-radius:4px}',
    '.msg.agent{background:#fff;border:1px solid var(--accent);align-self:flex-start;border-bottom-left-radius:4px}',
    '.msg.visitor{background:var(--accent);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.msg.error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;align-self:flex-start}',
    '.msg a{color:inherit;text-decoration:underline}.msg img{display:block;max-width:220px;max-height:220px;border-radius:8px}',
    '.who{font-size:11px;color:#64748b;margin:2px 4px -4px;align-self:flex-start}',
    '.event{align-self:center;font-size:12px;color:#64748b;text-align:center;padding:4px 8px}',
    '.src{align-self:flex-start;font-size:12px;color:#475569;margin-top:-4px}.src button{background:none;border:0;padding:0;color:var(--accent);text-decoration:underline;cursor:pointer;font-size:12px}',
    '.chips{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start;max-width:95%}',
    '.chip{border:1px solid var(--accent);color:var(--accent);background:#fff;border-radius:999px;padding:6px 11px;font-size:13px;cursor:pointer;text-align:left}.chip:hover{background:#f1f5f9}',
    '.typing{align-self:flex-start;font-size:13px;color:#64748b;padding:4px 2px}',
    '.card{align-self:stretch;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;font-size:13px;color:#334155;display:flex;flex-direction:column;gap:8px}',
    '.card b{font-size:14px;color:#0f172a}',
    '.card input,.card textarea,.help input{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:14px;color:#0f172a;font-family:inherit}',
    '.card .err{color:#b91c1c;font-size:12px}',
    '.stars{display:flex;justify-content:center;gap:4px}',
    '.star{background:none;border:0;cursor:pointer;font-size:24px;line-height:1;color:#cbd5e1;padding:2px}.star.on{color:#f59e0b}',
    '.btn{border:0;border-radius:10px;background:var(--accent);color:#fff;font-weight:600;font-size:14px;padding:9px 14px;cursor:pointer}.btn:disabled{opacity:.5;cursor:default}',
    '.btn.ghost{background:#fff;color:#0f172a;border:1px solid #cbd5e1}',
    'form.composer{display:flex;gap:6px;padding:10px;border-top:1px solid #e2e8f0;background:#fff;align-items:flex-end}',
    '.composer textarea{flex:1;resize:none;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;font-size:14px;color:#0f172a;max-height:96px;min-height:40px;font-family:inherit}',
    '.composer textarea:focus{outline:2px solid var(--accent);outline-offset:0;border-color:transparent}',
    '.clip{border:0;background:none;color:#64748b;width:36px;height:40px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:8px}.clip:hover{background:#f1f5f9}',
    '.help{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f8fafc}',
    '.cat{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-top:6px}',
    '.art{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;text-align:left;cursor:pointer;font-size:14px;color:#0f172a;width:100%}',
    '.art small{display:block;color:#64748b;font-size:12px;margin-top:2px}',
    '.article h3{margin:0 0 8px;font-size:17px}.article .body{white-space:pre-wrap;font-size:14px;line-height:1.55;color:#1e293b}',
    '.back{background:none;border:0;color:var(--accent);cursor:pointer;font-size:13px;padding:0;align-self:flex-start}',
    '.brand{text-align:center;font-size:11px;padding:0 0 8px;background:#fff}.brand a{color:#94a3b8;text-decoration:none}',
    '@media (max-width:480px){.panel{height:calc(100vh - 96px)}}',
  ].join('');

  var ICON_CHAT = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var ICON_CLOSE = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var ICON_PHONE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
  var ICON_CLIP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>';

  var TEXTS = {
    placeholder: 'Type your message…', send: 'Send', online: 'We’re online', away: 'We usually reply in a few minutes',
    closed: 'We’re away right now', waiting: 'A team member will join soon', chatting: 'You’re chatting with', typing: 'is typing…',
    newChat: 'New chat', transcript: 'Email me this chat', chatTab: 'Chat', helpTab: 'Help', searchHelp: 'Search our help articles',
    prechatTitle: 'Before we start', prechatStart: 'Start chat', offlineTitle: 'Leave us a message',
    offlineIntro: 'We’re away right now. Leave your details and we’ll get back to you.', offlineSend: 'Send message',
    rateTitle: 'How did we do?', rateThanks: 'Thanks for your feedback!', helpful: 'Was this helpful?',
    call: 'Call us', calling: 'Calling…', incoming: 'is calling you', connected: 'On a call', callEnded: 'Call ended', accept: 'Accept', decline: 'Decline', hangUp: 'Hang up', mute: 'Mute', unmute: 'Unmute',
  };

  function build(cfg) {
    var w = cfg.widget && typeof cfg.widget === 'object' ? cfg.widget : {};
    var look = w.appearance || {};
    var T = {};
    Object.keys(TEXTS).forEach(function (k) { T[k] = str((w.texts || {})[k], 120) || TEXTS[k]; });
    var mobile = window.innerWidth <= 480;
    if (!pageAllowed(w.pages) || (look.hide_on_mobile && mobile)) return;
    var isOpenHours = openNow(w.hours);
    var offlineForm = !isOpenHours && w.hours && w.hours.outside === 'form';
    var prechat = w.prechat && w.prechat.enabled ? w.prechat : null;
    var quick = (Array.isArray(w.quick_questions) ? w.quick_questions : []).map(function (q) { return str(q, 120); }).filter(Boolean).slice(0, 6);
    var helpOn = cfg.hasHelp && !(w.help && w.help.enabled === false);
    var soundOn = look.sound !== false;

    var host = document.createElement('div');
    host.setAttribute('data-reputation-engine-chat', '');
    document.body.appendChild(host);
    var root = host.attachShadow({ mode: 'open' });
    var style = el('style');
    style.textContent = CSS;
    root.appendChild(style);

    var right = cfg.position !== 'left';
    var wrap = el('div', 'wrap ' + (right ? 'right' : 'left'));
    var ox = Math.min(Math.max(Number(look.offset_x) || 20, 0), 200);
    var oy = Math.min(Math.max(Number(look.offset_y) || 20, 0), 200);
    if (mobile) { ox = Math.min(ox, 12); oy = Math.min(oy, 12); }
    wrap.style[right ? 'right' : 'left'] = ox + 'px';
    wrap.style.bottom = oy + 'px';
    wrap.style.setProperty('--accent', /^#[0-9a-f]{6}$/i.test(cfg.accent || '') ? cfg.accent : '#0284c7');
    root.appendChild(wrap);

    // ---------- panel skeleton ----------
    var panel = el('div', 'panel');
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with ' + cfg.businessName);
    var head = el('div', 'head');
    var logoUrl = safeUrl(look.logo_url);
    if (logoUrl) {
      var logo = el('img', 'logo');
      logo.src = logoUrl;
      logo.alt = '';
      head.appendChild(logo);
    }
    var titles = el('div', 'titles');
    titles.appendChild(el('p', null, str(look.title, 60) || cfg.businessName));
    var sub = el('p', 'sub');
    var onlineDot = el('span', 'online');
    var subText = el('span');
    sub.appendChild(onlineDot);
    sub.appendChild(subText);
    titles.appendChild(sub);
    head.appendChild(titles);
    var callBtn = button('hbtn', null, T.call);
    callBtn.innerHTML = ICON_PHONE;
    callBtn.title = T.call;
    callBtn.hidden = !cfg.callsEnabled;
    head.appendChild(callBtn);
    var menuBtn = button('hbtn', '⋯', 'More options');
    head.appendChild(menuBtn);
    var close = button('hbtn', null, 'Close chat');
    close.innerHTML = ICON_CLOSE;
    head.appendChild(close);
    panel.appendChild(head);

    var menu = el('div', 'menu');
    menu.hidden = true;
    var newChatItem = button(null, T.newChat);
    var transcriptItem = button(null, T.transcript);
    menu.appendChild(newChatItem);
    menu.appendChild(transcriptItem);
    panel.appendChild(menu);

    var tabs = el('div', 'tabs');
    var chatTab = button('tab on', T.chatTab);
    var helpTab = button('tab', T.helpTab);
    tabs.appendChild(chatTab);
    tabs.appendChild(helpTab);
    tabs.hidden = !helpOn;
    panel.appendChild(tabs);

    var callbar = el('div', 'callbar');
    callbar.hidden = true;
    panel.appendChild(callbar);

    var list = el('div', 'list');
    list.setAttribute('aria-live', 'polite');
    panel.appendChild(list);
    var typing = el('div', 'typing');
    typing.hidden = true;

    var helpView = el('div', 'help');
    helpView.hidden = true;
    panel.appendChild(helpView);

    var form = el('form', 'composer');
    var clip = button('clip', null, 'Send a file');
    clip.innerHTML = ICON_CLIP;
    var fileInput = el('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';
    fileInput.hidden = true;
    var input = el('textarea');
    input.rows = 1;
    input.maxLength = 1000;
    input.placeholder = T.placeholder;
    input.setAttribute('aria-label', 'Your message');
    var send = el('button', 'btn', T.send);
    send.type = 'submit';
    form.appendChild(clip);
    form.appendChild(fileInput);
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

    var audio = el('audio');
    audio.autoplay = true;
    panel.appendChild(audio);

    var grab = el('div', 'grab');
    grab.hidden = true;
    var grabText = el('span');
    var grabX = button('x', '×', 'Dismiss');
    grab.appendChild(grabText);
    grab.appendChild(grabX);

    wrap.appendChild(panel);
    wrap.appendChild(grab);
    var bubble = el('button', 'bubble');
    bubble.type = 'button';
    bubble.setAttribute('aria-expanded', 'false');
    wrap.appendChild(bubble);
    var dot = el('span', 'dot');
    dot.hidden = true;

    var agentsOnline = 0;
    var lastAgentName = null;
    var chipsEl = null;
    var lastRendered = null;
    var rateCard = null;

    // ---------- sounds ----------
    function tone(freqs, gap) {
      if (!soundOn) return;
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        freqs.forEach(function (f, i) {
          var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * (gap || 0.15);
          o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
          o.connect(g);
          g.connect(ctx.destination);
          o.start(t);
          o.stop(t + 0.25);
        });
        setTimeout(function () { ctx.close(); }, 1500);
      } catch (e) { /* audio blocked until the visitor interacts */ }
    }

    // ---------- rendering ----------
    function scrollDown() { list.scrollTop = list.scrollHeight; }
    function put(node) { list.insertBefore(node, typing); }
    function attachmentNode(m, cls) {
      var att = m.meta && m.meta.attachment;
      var box = el('div', 'msg ' + cls);
      var url = att && safeUrl(att.url);
      if (url && /^image\//.test(att.type || '')) {
        var link = el('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener';
        var img = el('img');
        img.src = url;
        img.alt = att.name || 'Image';
        link.appendChild(img);
        box.appendChild(link);
      } else if (url) {
        var f = el('a', null, '📄 ' + (att.name || 'File'));
        f.href = url;
        f.target = '_blank';
        f.rel = 'noopener';
        box.appendChild(f);
      } else {
        box.textContent = '📄 ' + m.body;
      }
      return box;
    }
    function render(m) {
      if (m.meta && (m.meta.ended || m.meta.call || m.meta.transcript)) {
        put(el('div', 'event', m.body));
        if (m.meta.ended) showRating();
        return;
      }
      var cls = m.sender === 'visitor' ? 'visitor' : m.sender === 'agent' ? 'agent' : 'bot';
      // The AI agent's name, once per run of its messages
      if (m.sender === 'ai' && cfg.agentName && lastRendered !== 'ai') put(el('div', 'who', str(cfg.agentName, 40) + ' · AI assistant'));
      lastRendered = m.sender;
      if (m.sender === 'agent') {
        lastAgentName = m.author_name || 'Team';
        put(el('div', 'who', lastAgentName + ' · ' + cfg.businessName));
      }
      put(m.meta && m.meta.attachment ? attachmentNode(m, cls) : el('div', 'msg ' + cls, m.body));
      // Help articles the AI answered from
      var sources = (m.meta && m.meta.sources) || [];
      if (sources.length && helpOn) {
        var src = el('div', 'src', '📄 ');
        sources.slice(0, 2).forEach(function (s, i) {
          if (i) src.appendChild(document.createTextNode(' · '));
          var b = button(null, s.title);
          b.addEventListener('click', function () { showHelp(); openArticle(s.id); });
          src.appendChild(b);
        });
        put(src);
      }
    }
    /** Follow-up questions under the latest AI answer only. */
    function renderChips(list_) {
      if (chipsEl) { chipsEl.remove(); chipsEl = null; }
      if (!list_ || !list_.length) return;
      chipsEl = el('div', 'chips');
      list_.forEach(function (q) {
        var c = button('chip', q);
        c.addEventListener('click', function () { sendText(q); });
        chipsEl.appendChild(c);
      });
      put(chipsEl);
    }
    function lastSuggestions() {
      var last = state.messages[state.messages.length - 1];
      return last && last.sender === 'ai' && last.meta && last.meta.suggestions ? last.meta.suggestions : null;
    }
    function addError(text) {
      put(el('div', 'msg error', text));
      scrollDown();
    }
    function hasVisitorMessages() { return state.messages.some(function (m) { return m.sender === 'visitor'; }); }

    function redraw() {
      rateCard = null;
      lastRendered = null;
      chipsEl = null;
      list.textContent = '';
      list.appendChild(typing);
      put(el('div', 'msg bot', cfg.greeting));
      (session.proactive || []).forEach(function (t) { if (!state.conversation) put(el('div', 'msg bot', t)); });
      state.messages.forEach(render);
      if (!hasVisitorMessages()) renderQuick();
      else renderChips(lastSuggestions());
      if (state.ratingDue && state.ratedFor !== state.conversation) showRating();
      updateComposer();
      showStatus();
      scrollDown();
    }

    /** Adds messages we haven't seen yet (by id); returns true if any came from the business. */
    function absorb(messages) {
      var fromTeam = false;
      (messages || []).forEach(function (m) {
        if (m.id <= (state.lastId || 0)) return;
        state.lastId = m.id;
        state.messages.push({ id: m.id, sender: m.sender, author_name: m.author_name, body: m.body, meta: m.meta || {} });
        if (m.meta && m.meta.ended) state.ratingDue = true;
        if (m.sender !== 'visitor') fromTeam = true;
        if (quickEl) { quickEl.remove(); quickEl = null; }
        render(m);
      });
      renderChips(lastSuggestions());
      state.messages = state.messages.slice(-MAX_KEPT);
      state.active = Date.now();
      save();
      scrollDown();
      return fromTeam;
    }

    function showStatus() {
      var team = agentsOnline > 0;
      onlineDot.hidden = !(team || state.mode === 'agent' || (call && call.status === 'active'));
      subText.textContent = state.mode === 'agent'
        ? T.chatting + ' ' + (lastAgentName || 'our team')
        : state.needsAgent ? T.waiting
        : str(look.subtitle, 80) || (!isOpenHours ? T.closed : team ? T.online : T.away);
      callBtn.disabled = !team || Boolean(call);
      callBtn.title = team ? T.call : 'Nobody is available for calls right now';
    }

    // ---------- welcome: quick questions, pre-chat form, offline form ----------
    var quickEl = null;
    function renderQuick() {
      if (!quick.length || offlineForm) return;
      quickEl = el('div', 'chips');
      quick.forEach(function (q) {
        var c = button('chip', q);
        c.addEventListener('click', function () { sendText(q); });
        quickEl.appendChild(c);
      });
      put(quickEl);
    }
    function needsPrechat() { return Boolean(prechat && !state.conversation && !state.profile); }

    var formCard = null;
    var pendingQuestion = null;
    function field(label, type, required) {
      var i = el('input');
      i.type = type;
      i.placeholder = label + (required ? ' *' : '');
      i.setAttribute('aria-label', label);
      i.required = Boolean(required);
      return i;
    }
    /** The form shows with the welcome screen; a tapped quick question is sent once it's filled in. */
    function showPrechat(question) {
      if (question) pendingQuestion = question;
      if (formCard) {
        var f0 = formCard.querySelector('input,textarea');
        if (f0) f0.focus();
        return;
      }
      formCard = el('form', 'card');
      formCard.appendChild(el('b', null, str(prechat.title, 80) || T.prechatTitle));
      var inputs = {};
      ['name', 'email', 'phone'].forEach(function (f) {
        var mode = prechat[f] || 'off';
        if (mode === 'off') return;
        inputs[f] = field(f === 'name' ? 'Your name' : f === 'email' ? 'Email' : 'Phone', f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text', mode === 'required');
        formCard.appendChild(inputs[f]);
      });
      var q = str(prechat.question, 120);
      if (q) {
        inputs.answer = el('textarea');
        inputs.answer.placeholder = q + (prechat.question_required ? ' *' : '');
        inputs.answer.setAttribute('aria-label', q);
        inputs.answer.required = Boolean(prechat.question_required);
        inputs.answer.rows = 2;
        formCard.appendChild(inputs.answer);
      }
      var err = el('div', 'err');
      formCard.appendChild(err);
      var go = el('button', 'btn', str(prechat.button, 40) || T.prechatStart);
      go.type = 'submit';
      formCard.appendChild(go);
      formCard.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = function (k) { return inputs[k] ? inputs[k].value.trim() : ''; };
        if (v('email') && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v('email'))) { err.textContent = 'That email address doesn’t look right.'; return; }
        state.profile = { name: v('name'), email: v('email'), phone: v('phone'), question: q, answer: v('answer') };
        save();
        formCard.remove();
        formCard = null;
        updateComposer();
        var q0 = pendingQuestion;
        pendingQuestion = null;
        if (q0) sendText(q0);
        else input.focus();
      });
      put(formCard);
      scrollDown();
      var firstInput = formCard.querySelector('input,textarea');
      if (firstInput) firstInput.focus();
    }
    function showOffline() {
      if (formCard) return;
      formCard = el('form', 'card');
      formCard.appendChild(el('b', null, T.offlineTitle));
      formCard.appendChild(el('div', null, T.offlineIntro));
      var name = field('Your name', 'text', false);
      var email = field('Email', 'email', false);
      var phone = field('Phone', 'tel', false);
      var msg = el('textarea');
      msg.placeholder = 'Your message *';
      msg.setAttribute('aria-label', 'Your message');
      msg.required = true;
      msg.rows = 3;
      msg.maxLength = 1000;
      var err = el('div', 'err');
      var go = el('button', 'btn', T.offlineSend);
      go.type = 'submit';
      [name, email, phone, msg, err, go].forEach(function (n) { formCard.appendChild(n); });
      formCard.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!email.value.trim() && !phone.value.trim()) { err.textContent = 'Leave an email or phone number so we can get back to you.'; return; }
        go.disabled = true;
        post({ action: 'offline', name: name.value, email: email.value, phone: phone.value, message: msg.value, page: location.href, info: clientInfo() })
          .then(function (r) {
            go.disabled = false;
            if (!r.ok) { err.textContent = r.body.error || 'Something went wrong. Please try again.'; return; }
            formCard.remove();
            formCard = null;
            state.conversation = r.body.conversation;
            offlineForm = false;
            absorb(r.body.messages);
            updateComposer();
          })
          .catch(function () { go.disabled = false; err.textContent = 'Couldn’t reach us. Check your connection and try again.'; });
      });
      put(formCard);
      scrollDown();
    }
    function updateComposer() {
      var blocked = (offlineForm && !state.conversation) || needsPrechat();
      form.hidden = blocked || !helpView.hidden;
      if (offlineForm && !state.conversation) showOffline();
      else if (needsPrechat()) showPrechat(null);
    }

    // ---------- end-of-chat rating ----------
    function showRating() {
      if (rateCard || state.ratedFor === state.conversation) return;
      rateCard = el('div', 'card');
      rateCard.style.textAlign = 'center';
      rateCard.appendChild(el('div', null, T.rateTitle));
      var stars = el('div', 'stars');
      var chosen = 0;
      var buttons = [];
      var comment = el('textarea');
      comment.placeholder = 'Anything to add? (optional)';
      comment.maxLength = 500;
      comment.hidden = true;
      var submitRating = el('button', 'btn', 'Send feedback');
      submitRating.type = 'button';
      submitRating.hidden = true;
      for (var i = 1; i <= 5; i++) {
        (function (n) {
          var s = button('star', '★', n + ' star' + (n > 1 ? 's' : ''));
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
      submitRating.addEventListener('click', function () {
        if (!chosen) return;
        post({ action: 'rate', conversation: state.conversation, rating: chosen, comment: comment.value }).then(function () {
          state.ratedFor = state.conversation;
          state.ratingDue = false;
          save();
          rateCard.textContent = T.rateThanks;
        });
      });
      rateCard.appendChild(stars);
      rateCard.appendChild(comment);
      rateCard.appendChild(submitRating);
      put(rateCard);
      scrollDown();
    }

    // ---------- open / close ----------
    function setBubble(open) {
      bubble.innerHTML = open ? ICON_CLOSE : ICON_CHAT;
      var withText = !open && look.launcher === 'bubble_text' && str(look.launcher_text, 30);
      bubble.className = 'bubble' + (withText ? '' : ' round');
      if (withText) bubble.appendChild(document.createTextNode(str(look.launcher_text, 30)));
      bubble.appendChild(dot);
      bubble.setAttribute('aria-label', open ? 'Close chat' : 'Open chat');
      bubble.setAttribute('aria-expanded', String(open));
    }
    function setOpen(open) {
      panel.hidden = !open;
      menu.hidden = true;
      setBubble(open);
      if (open) {
        dot.hidden = true;
        hideGrab(true);
        scrollDown();
        if (!form.hidden) input.focus();
        if (state.conversation) poll();
      }
      schedulePoll();
    }
    bubble.addEventListener('click', function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); bubble.focus(); });
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!menu.hidden) menu.hidden = true; else { setOpen(false); bubble.focus(); } }
    });
    menuBtn.addEventListener('click', function () {
      transcriptItem.hidden = !state.conversation;
      newChatItem.hidden = !state.messages.length;
      menu.hidden = !menu.hidden;
    });
    newChatItem.addEventListener('click', function () {
      menu.hidden = true;
      if (call) endCall(false);
      clearTimeout(pollTimer);
      state.messages = [];
      state.conversation = null;
      state.lastId = 0;
      state.mode = 'ai';
      state.needsAgent = false;
      state.ratingDue = false;
      state.profile = null;
      save();
      redraw();
      input.focus();
    });
    transcriptItem.addEventListener('click', function () {
      menu.hidden = true;
      var card = el('form', 'card');
      card.appendChild(el('b', null, T.transcript));
      var email = field('Email', 'email', true);
      email.value = (state.profile && state.profile.email) || '';
      var err = el('div', 'err');
      var go = el('button', 'btn', T.send);
      go.type = 'submit';
      [email, err, go].forEach(function (n) { card.appendChild(n); });
      card.addEventListener('submit', function (e) {
        e.preventDefault();
        go.disabled = true;
        post({ action: 'transcript', conversation: state.conversation, email: email.value }).then(function (r) {
          go.disabled = false;
          if (!r.ok) { err.textContent = r.body.error || 'Couldn’t send it. Please try again.'; return; }
          card.remove();
          absorb(r.body.messages);
        });
      });
      put(card);
      scrollDown();
      email.focus();
    });

    // ---------- attention grabber and proactive messages (W2) ----------
    function hideGrab(forSession) {
      grab.hidden = true;
      if (forSession) { session.grabbed = true; saveSession(); }
    }
    function showGrab(text) {
      if (!panel.hidden || session.grabbed) return;
      grabText.textContent = text;
      grab.hidden = false;
      tone([660, 880]);
    }
    grab.addEventListener('click', function (e) { if (e.target !== grabX) setOpen(true); });
    grabX.addEventListener('click', function () { hideGrab(true); });
    if (w.attention && w.attention.enabled && str(w.attention.text, 140) && !state.conversation) {
      setTimeout(function () { showGrab(str(w.attention.text, 140)); }, Math.min(Math.max(Number(w.attention.delay) || 5, 1), 300) * 1000);
    }
    (Array.isArray(w.proactive) ? w.proactive : []).slice(0, 5).forEach(function (rule, i) {
      var text = str(rule && rule.message, 300);
      var contains = str(rule && rule.contains, 200).toLowerCase();
      if (!text || (contains && location.href.toLowerCase().indexOf(contains) < 0)) return;
      session.proactiveShown = session.proactiveShown || {};
      if (session.proactiveShown[i] || state.conversation) return;
      setTimeout(function () {
        if (state.conversation || session.proactiveShown[i]) return;
        session.proactiveShown[i] = true;
        session.proactive = (session.proactive || []).concat([text]);
        saveSession();
        if (quickEl) { quickEl.remove(); quickEl = null; }
        put(el('div', 'msg bot', text));
        if (!hasVisitorMessages()) renderQuick();
        if (panel.hidden) { dot.hidden = false; showGrab(text); }
        scrollDown();
      }, Math.min(Math.max(Number(rule.delay) || 10, 1), 600) * 1000);
    });

    // ---------- help tab (W3) ----------
    function showHelp() {
      chatTab.className = 'tab';
      helpTab.className = 'tab on';
      list.hidden = true;
      helpView.hidden = false;
      form.hidden = true;
      if (!helpView.childNodes.length) helpHome();
    }
    function showChat() {
      chatTab.className = 'tab on';
      helpTab.className = 'tab';
      list.hidden = false;
      helpView.hidden = true;
      updateComposer();
      scrollDown();
    }
    chatTab.addEventListener('click', showChat);
    helpTab.addEventListener('click', showHelp);
    function articleButton(a) {
      var b = el('button', 'art', a.title);
      b.type = 'button';
      if (a.snippet) b.appendChild(el('small', null, a.snippet));
      b.addEventListener('click', function () { openArticle(a.id); });
      return b;
    }
    function helpHome() {
      helpView.textContent = '';
      var search = el('input');
      search.type = 'search';
      search.placeholder = T.searchHelp;
      search.setAttribute('aria-label', T.searchHelp);
      var results = el('div');
      results.style.display = 'flex';
      results.style.flexDirection = 'column';
      results.style.gap = '8px';
      helpView.appendChild(search);
      helpView.appendChild(results);
      var timer = null;
      function showList(arts) {
        results.textContent = '';
        var lastCat = null;
        arts.forEach(function (a) {
          var cat = a.category || 'General';
          if (cat !== lastCat) { results.appendChild(el('div', 'cat', cat)); lastCat = cat; }
          results.appendChild(articleButton(a));
        });
        if (!arts.length) results.appendChild(el('div', 'event', 'No articles found. Ask us in the chat instead.'));
      }
      search.addEventListener('input', function () {
        clearTimeout(timer);
        var q = search.value.trim();
        timer = setTimeout(function () {
          if (q.length < 2) { get('kb=list').then(function (r) { if (r) showList(r.articles); }); return; }
          get('kb=search&q=' + encodeURIComponent(q)).then(function (r) { if (r) showList(r.results); });
        }, 250);
      });
      get('kb=list').then(function (r) { if (r) showList(r.articles); });
      search.focus();
    }
    function openArticle(id) {
      helpView.textContent = '';
      var back = button('back', '← All articles');
      back.addEventListener('click', helpHome);
      helpView.appendChild(back);
      get('kb=article&id=' + encodeURIComponent(id)).then(function (r) {
        if (!r || !r.article) { helpView.appendChild(el('div', 'event', 'This article isn’t available.')); return; }
        var art = el('div', 'card article');
        art.appendChild(el('h3', null, r.article.title));
        art.appendChild(el('div', 'body', r.article.body));
        var fb = el('div');
        fb.appendChild(el('div', null, T.helpful));
        var row = el('div');
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginTop = '6px';
        var voted = (session.voted = session.voted || {});
        [['Yes', true], ['No', false]].forEach(function (x) {
          var b = button('btn ghost', x[0]);
          b.disabled = Boolean(voted[id]);
          b.addEventListener('click', function () {
            voted[id] = true;
            saveSession();
            post({ action: 'kb_feedback', article: id, helpful: x[1] });
            fb.textContent = x[1] ? 'Glad it helped!' : 'Thanks. Ask us in the chat and we’ll help.';
          });
          row.appendChild(b);
        });
        fb.appendChild(row);
        art.appendChild(fb);
        helpView.appendChild(art);
        var ask = button('btn ghost', 'Ask us in the chat');
        ask.addEventListener('click', showChat);
        helpView.appendChild(ask);
      });
    }

    // ---------- new messages, typing, status, calls (polling) ----------
    // Every 3 s while the chat is open (every second during a call); every 15 s while it's closed and
    // the chat was active in the last 30 minutes (or a team member is chatting).
    var pollTimer = null;
    function schedulePoll() {
      clearTimeout(pollTimer);
      if (!state.conversation) return;
      if (call) { pollTimer = setTimeout(poll, 1000); return; }
      var quiet = Date.now() - (state.active || 0);
      if (panel.hidden && state.mode !== 'agent' && !state.needsAgent && quiet > 30 * 60000) return;
      if (!panel.hidden && quiet > 24 * 3600000) return;
      pollTimer = setTimeout(poll, panel.hidden ? 15000 : 3000);
    }
    function poll() {
      clearTimeout(pollTimer);
      if (!state.conversation) return;
      var q = 'visitor=' + encodeURIComponent(state.visitor) + '&conversation=' + encodeURIComponent(state.conversation) + '&after=' + (state.lastId || 0);
      fetch(api + sep + 'key=' + encodeURIComponent(key) + '&' + q)
        .then(function (res) {
          if (res.status === 404) {
            // Deleted by the business: start over quietly
            state.conversation = null;
            state.messages = [];
            state.lastId = 0;
            save();
            redraw();
            return null;
          }
          return res.ok ? res.json() : null;
        })
        .then(function (r) {
          if (!r) return;
          var fromTeam = absorb(r.messages);
          if (fromTeam && panel.hidden) { dot.hidden = false; tone([880, 1175]); }
          state.mode = r.mode;
          state.needsAgent = r.needsAgent;
          if (r.status === 'resolved' && !r.rated && state.ratedFor !== state.conversation) state.ratingDue = true;
          save();
          typing.textContent = (lastAgentName || 'Our team') + ' ' + T.typing;
          typing.hidden = !r.agentTyping;
          handleCall(r.call);
          showStatus();
        })
        .catch(function () { /* try again next time */ })
        .then(schedulePoll);
    }

    // ---------- sending ----------
    var busy = false;
    function sendText(text) {
      text = (text || '').trim();
      if (!text || busy) return;
      if (needsPrechat()) { showPrechat(text); return; }
      if (quickEl) { quickEl.remove(); quickEl = null; }
      if (chipsEl) { chipsEl.remove(); chipsEl = null; }
      busy = true;
      send.disabled = true;
      // Shown straight away; replaced by the saved copy when the server answers
      var pending = el('div', 'msg visitor', text);
      put(pending);
      if (state.mode !== 'agent') {
        typing.textContent = 'Typing…';
        typing.hidden = false;
      }
      scrollDown();
      var body = { action: 'message', conversation: state.conversation || null, message: text, page: location.href, info: clientInfo() };
      if (!state.conversation && state.profile) body.profile = state.profile;
      post(body)
        .then(function (r) {
          pending.remove();
          typing.hidden = true;
          if (!r.ok || !r.body.conversation) {
            put(el('div', 'msg visitor', text));
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
          put(el('div', 'msg visitor', text));
          addError('Couldn’t reach the chat. Check your connection and try again.');
        })
        .then(function () {
          busy = false;
          send.disabled = false;
          input.focus();
          schedulePoll();
        });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value;
      input.value = '';
      input.style.height = 'auto';
      sendText(text);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }
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

    // ---------- files (W1b) ----------
    clip.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { addError('Files can be up to 10 MB.'); return; }
      var fd = new FormData();
      fd.append('key', key);
      fd.append('visitor', state.visitor);
      if (state.conversation) fd.append('conversation', state.conversation);
      fd.append('page', location.href);
      fd.append('file', file);
      var pending = el('div', 'msg visitor', '📄 ' + file.name + ' …');
      put(pending);
      scrollDown();
      fetch(api, { method: 'POST', body: fd })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (b) { return { ok: res.ok, body: b }; }); })
        .then(function (r) {
          pending.remove();
          if (!r.ok) { addError(r.body.error || 'The file couldn’t be sent.'); return; }
          state.conversation = r.body.conversation;
          absorb(r.body.messages);
          schedulePoll();
        })
        .catch(function () { pending.remove(); addError('Couldn’t send the file. Check your connection and try again.'); });
    });

    // ---------- voice calls (W4): WebRTC between this browser and the team member's ----------
    var call = null; // { id, direction, status: 'starting'|'ringing'|'incoming'|'connecting'|'active', pc, stream, startedAt, muted }
    var callTimer = null;
    var ringTimer = null;
    function waitForIce(pc) {
      return new Promise(function (resolve) {
        if (pc.iceGatheringState === 'complete') return resolve();
        var t = setTimeout(resolve, 3000);
        pc.addEventListener('icegatheringstatechange', function () {
          if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); }
        });
      });
    }
    function newPeer(stream) {
      var pc = new RTCPeerConnection({ iceServers: ICE });
      stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
      pc.ontrack = function (e) { audio.srcObject = e.streams[0]; };
      pc.onconnectionstatechange = function () {
        if (call && call.pc === pc && pc.connectionState === 'failed') {
          addError('The call couldn’t connect on this network.');
          endCall(false);
        }
      };
      return pc;
    }
    function micError(err) {
      addError(err && err.name === 'NotAllowedError'
        ? 'Allow microphone access in your browser to make calls.'
        : 'Your microphone isn’t available.');
    }
    function stopRing() { clearInterval(ringTimer); ringTimer = null; }
    function cleanupCall() {
      stopRing();
      clearInterval(callTimer);
      if (call) {
        if (call.pc) call.pc.close();
        if (call.stream) call.stream.getTracks().forEach(function (t) { t.stop(); });
      }
      audio.srcObject = null;
      call = null;
      renderCallbar();
      showStatus();
    }
    function endCall(decline) {
      if (!call) return;
      var c = call;
      cleanupCall();
      if (c.id) post({ action: 'call_end', conversation: state.conversation, call: c.id, decline: Boolean(decline) }).then(function () { poll(); });
    }
    function renderCallbar() {
      callbar.textContent = '';
      callbar.hidden = !call;
      if (!call) return;
      var text = el('span', 'ctext');
      callbar.appendChild(text);
      if (call.status === 'incoming') {
        text.textContent = '📞 ' + (call.agentName || 'Our team') + ' ' + T.incoming;
        var ok = button('ok', T.accept);
        ok.addEventListener('click', acceptCall);
        var no = button('no', T.decline);
        no.addEventListener('click', function () { endCall(true); });
        callbar.appendChild(ok);
        callbar.appendChild(no);
        return;
      }
      if (call.status === 'active') {
        var update = function () {
          var s = Math.floor((Date.now() - call.startedAt) / 1000);
          text.textContent = '📞 ' + T.connected + ' · ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
        };
        update();
        clearInterval(callTimer);
        callTimer = setInterval(function () { if (call && call.status === 'active') update(); }, 1000);
        var mute = button('mute', call.muted ? T.unmute : T.mute);
        mute.addEventListener('click', function () {
          call.muted = !call.muted;
          call.stream.getAudioTracks().forEach(function (t) { t.enabled = !call.muted; });
          mute.textContent = call.muted ? T.unmute : T.mute;
        });
        callbar.appendChild(mute);
      } else {
        text.textContent = '📞 ' + T.calling;
      }
      var hang = button('no', T.hangUp);
      hang.addEventListener('click', function () { endCall(false); });
      callbar.appendChild(hang);
    }
    function startCall() {
      if (call || !navigator.mediaDevices || !window.RTCPeerConnection) {
        if (!window.RTCPeerConnection) addError('Your browser can’t make calls.');
        return;
      }
      call = { id: null, direction: 'inbound', status: 'starting' };
      renderCallbar();
      showStatus();
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        if (!call) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        call.stream = stream;
        call.pc = newPeer(stream);
        return call.pc.createOffer()
          .then(function (offer) { return call.pc.setLocalDescription(offer); })
          .then(function () { return waitForIce(call.pc); })
          .then(function () {
            return post({ action: 'call_start', conversation: state.conversation || null, sdp: call.pc.localDescription.sdp, page: location.href, info: clientInfo() });
          })
          .then(function (r) {
            if (!call) return;
            if (!r.ok) { cleanupCall(); addError(r.body.error || 'The call couldn’t start.'); return; }
            state.conversation = r.body.conversation;
            save();
            call.id = r.body.call.id;
            call.status = 'ringing';
            renderCallbar();
            poll();
          });
      }).catch(function (err) { cleanupCall(); micError(err); });
    }
    function acceptCall() {
      if (!call || call.status !== 'incoming') return;
      stopRing();
      call.status = 'connecting';
      renderCallbar();
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        if (!call) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
        call.stream = stream;
        call.pc = newPeer(stream);
        return call.pc.setRemoteDescription({ type: 'offer', sdp: call.offer })
          .then(function () { return call.pc.createAnswer(); })
          .then(function (ans) { return call.pc.setLocalDescription(ans); })
          .then(function () { return waitForIce(call.pc); })
          .then(function () { return post({ action: 'call_answer', conversation: state.conversation, call: call.id, sdp: call.pc.localDescription.sdp }); })
          .then(function (r) {
            if (!call) return;
            if (!r.ok || r.body.status !== 'active') { cleanupCall(); addError('That call has ended.'); return; }
            call.status = 'active';
            call.startedAt = Date.now();
            renderCallbar();
            showStatus();
          });
      }).catch(function (err) { endCall(false); micError(err); });
    }
    /** The server's view of the call, from each poll. */
    function handleCall(c) {
      if (!c) {
        if (call && call.id && call.status !== 'starting') cleanupCall();
        return;
      }
      var live = c.status === 'ringing' || c.status === 'active';
      if (call && call.id === c.id) {
        if (!live) { cleanupCall(); return; }
        if (call.direction === 'inbound' && c.status === 'active' && c.answer && call.status === 'ringing') {
          call.status = 'active';
          call.startedAt = Date.now();
          call.agentName = c.agentName;
          call.pc.setRemoteDescription({ type: 'answer', sdp: c.answer }).catch(function () { addError('The call couldn’t connect.'); endCall(false); });
          renderCallbar();
          showStatus();
        }
        return;
      }
      // The team is calling this visitor
      if (!call && c.direction === 'outbound' && c.status === 'ringing' && c.offer) {
        call = { id: c.id, direction: 'outbound', status: 'incoming', offer: c.offer, agentName: c.agentName };
        renderCallbar();
        if (panel.hidden) setOpen(true);
        tone([880, 660, 880, 660], 0.2);
        ringTimer = setInterval(function () { tone([880, 660, 880, 660], 0.2); }, 2500);
      }
    }
    callBtn.addEventListener('click', startCall);
    window.addEventListener('pagehide', function () { if (call) endCall(false); });

    // ---------- visitors online (check in every 30 s while the page is visible) ----------
    function ping() {
      if (document.visibilityState === 'hidden') return;
      post({ action: 'ping', page: location.href, title: document.title, info: clientInfo(), conversation: state.conversation || null })
        .then(function (r) {
          if (!r.ok) return;
          agentsOnline = r.body.agentsOnline || 0;
          if (r.body.ringing) poll();
          // A team member started a chat with this visitor
          if (r.body.invite && r.body.invite !== state.conversation) {
            state.conversation = r.body.invite;
            state.messages = [];
            state.lastId = 0;
            state.mode = 'agent';
            state.active = Date.now();
            save();
            redraw();
            if (!mobile) setOpen(true);
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
