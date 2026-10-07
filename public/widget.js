/*
 * Reputation Engine reviews widget.
 *
 * Paste on any website (Settings → Website reviews widget gives you the exact snippet):
 *   <div class="reputation-engine-reviews" data-key="YOUR_KEY"></div>
 *   <script src="https://YOUR_APP/widget.js" data-api="https://YOUR_PROJECT.supabase.co/functions/v1/reviews-widget" async></script>
 *
 * Renders inside a shadow root so the host site's CSS can't break it (and it can't break theirs).
 */
(function () {
  'use strict';
  var script = document.currentScript;
  var api = script && script.getAttribute('data-api');
  var appOrigin = script ? new URL(script.src, location.href).origin : '';
  if (!api) {
    console.warn('[reviews widget] missing data-api on the <script> tag');
    return;
  }

  var STAR = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function stars(rating, size) {
    var wrap = el('span', 'stars');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', rating + ' out of 5 stars');
    for (var i = 1; i <= 5; i++) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.setAttribute('aria-hidden', 'true');
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', STAR);
      // Half stars for averages like 4.6
      var fill = rating >= i ? 1 : rating > i - 1 ? rating - (i - 1) : 0;
      if (fill > 0 && fill < 1) {
        var id = 'g' + Math.random().toString(36).slice(2);
        var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        var grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', id);
        [['0', 'var(--star)'], [String(fill), 'var(--star)'], [String(fill), 'var(--star-off)'], ['1', 'var(--star-off)']].forEach(function (s) {
          var stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
          stop.setAttribute('offset', s[0]);
          stop.setAttribute('style', 'stop-color:' + s[1]);
          grad.appendChild(stop);
        });
        defs.appendChild(grad);
        svg.appendChild(defs);
        path.setAttribute('style', 'fill:url(#' + id + ')');
      } else {
        path.setAttribute('style', fill ? 'fill:var(--star)' : 'fill:var(--star-off)');
      }
      svg.appendChild(path);
      wrap.appendChild(svg);
    }
    return wrap;
  }

  var PLATFORM = { google: 'Google', facebook: 'Facebook', trustpilot: 'Trustpilot' };

  function timeAgo(iso) {
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return 'Today';
    if (days < 2) return 'Yesterday';
    if (days < 30) return days + ' days ago';
    var months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? 'A month ago' : months + ' months ago';
    var years = Math.floor(months / 12);
    return years === 1 ? 'A year ago' : years + ' years ago';
  }

  function css(theme, accent) {
    var dark = theme === 'dark';
    return [
      ':host{all:initial;display:block}',
      '*{box-sizing:border-box}',
      '.root{--bg:' + (dark ? '#0f172a' : '#ffffff') + ';--card:' + (dark ? '#1e293b' : '#ffffff') + ';--border:' + (dark ? '#334155' : '#e2e8f0') +
        ';--text:' + (dark ? '#f1f5f9' : '#0f172a') + ';--muted:' + (dark ? '#94a3b8' : '#64748b') + ';--accent:' + accent +
        ';--star:#f59e0b;--star-off:' + (dark ? '#475569' : '#e2e8f0') + ';',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--text);font-size:14px;line-height:1.5}',
      '.stars{display:inline-flex;gap:2px;vertical-align:middle}',
      '.summary{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
      '.score{display:flex;align-items:center;gap:10px}',
      '.big{font-size:28px;font-weight:700;line-height:1}',
      '.muted{color:var(--muted);font-size:13px}',
      '.btn{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;font-size:13px;padding:8px 14px;border-radius:10px}',
      '.btn:hover{filter:brightness(.95)}',
      '.track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px}',
      '.track::-webkit-scrollbar{display:none}',
      '.track .card{flex:0 0 min(300px,85%);scroll-snap-align:start}',
      '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}',
      '.list{display:flex;flex-direction:column;gap:10px}',
      '.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:8px}',
      '.head{display:flex;align-items:center;gap:10px}',
      '.avatar{width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;overflow:hidden}',
      '.avatar img{width:100%;height:100%;object-fit:cover}',
      '.name{font-weight:600;font-size:14px}',
      '.text{margin:0;color:var(--text);font-size:14px;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden}',
      '.nav{display:flex;gap:6px}',
      '.arrow{width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;font-size:16px;line-height:1}',
      '.badge{display:inline-flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--border);border-radius:999px;padding:8px 16px;text-decoration:none;color:var(--text)}',
      '.brand{margin-top:10px;text-align:right;font-size:11px}',
      '.brand a{color:var(--muted);text-decoration:none}',
      '.brand a:hover{text-decoration:underline}',
    ].join('\n');
  }

  function reviewCard(r) {
    var card = el('div', 'card');
    var head = el('div', 'head');
    var avatar = el('div', 'avatar');
    if (r.avatar && /^https:\/\//.test(r.avatar)) {
      var img = el('img');
      img.src = r.avatar;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () { avatar.textContent = (r.author || '?').charAt(0).toUpperCase(); };
      avatar.appendChild(img);
    } else {
      avatar.textContent = (r.author || '?').charAt(0).toUpperCase();
    }
    var who = el('div');
    who.appendChild(el('div', 'name', r.author));
    who.appendChild(el('div', 'muted', timeAgo(r.date) + (PLATFORM[r.platform] ? ' · ' + PLATFORM[r.platform] : '')));
    head.appendChild(avatar);
    head.appendChild(who);
    card.appendChild(head);
    card.appendChild(stars(r.rating, 16));
    if (r.content) card.appendChild(el('p', 'text', r.content));
    return card;
  }

  function render(host, data) {
    var s = data.settings || {};
    var shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';
    var style = el('style');
    style.textContent = css(s.theme, s.accent || '#0ea5e9');
    shadow.appendChild(style);
    var root = el('div', 'root');
    shadow.appendChild(root);

    var link = data.reviewLink && /^https:\/\//.test(data.reviewLink) ? data.reviewLink : null;
    var hasRating = data.total > 0 && data.rating != null;

    if (s.layout === 'badge') {
      var badge = el(link ? 'a' : 'div', 'badge');
      if (link) { badge.href = link; badge.target = '_blank'; badge.rel = 'noopener'; }
      if (hasRating) {
        badge.appendChild(el('strong', null, Number(data.rating).toFixed(1)));
        badge.appendChild(stars(Number(data.rating), 16));
        badge.appendChild(el('span', 'muted', data.total + (data.total === 1 ? ' review' : ' reviews')));
      } else {
        badge.appendChild(el('span', null, 'Review ' + data.businessName));
      }
      root.appendChild(badge);
    } else {
      var track;
      if (s.showSummary !== false || s.layout === 'carousel') {
        var summary = el('div', 'summary');
        var score = el('div', 'score');
        if (s.showSummary !== false && hasRating) {
          score.appendChild(el('span', 'big', Number(data.rating).toFixed(1)));
          var detail = el('div');
          detail.appendChild(stars(Number(data.rating), 18));
          detail.appendChild(el('div', 'muted', 'Based on ' + data.total + (data.total === 1 ? ' review' : ' reviews')));
          score.appendChild(detail);
        }
        summary.appendChild(score);
        var right = el('div', 'nav');
        if (s.layout === 'carousel' && data.reviews.length > 1) {
          var prev = el('button', 'arrow', '‹');
          var next = el('button', 'arrow', '›');
          prev.setAttribute('aria-label', 'Previous reviews');
          next.setAttribute('aria-label', 'Next reviews');
          prev.onclick = function () { track.scrollBy({ left: -track.clientWidth * 0.8, behavior: 'smooth' }); };
          next.onclick = function () { track.scrollBy({ left: track.clientWidth * 0.8, behavior: 'smooth' }); };
          right.appendChild(prev);
          right.appendChild(next);
        }
        if (link) {
          var cta = el('a', 'btn', 'Write a review');
          cta.href = link;
          cta.target = '_blank';
          cta.rel = 'noopener';
          right.appendChild(cta);
        }
        summary.appendChild(right);
        root.appendChild(summary);
      }
      track = el('div', s.layout === 'grid' ? 'grid' : s.layout === 'list' ? 'list' : 'track');
      data.reviews.forEach(function (r) { track.appendChild(reviewCard(r)); });
      root.appendChild(track);
    }

    if (data.showBranding) {
      var brand = el('div', 'brand');
      var a = el('a', null, 'Reviews by Reputation Engine');
      a.href = appOrigin || 'https://reputation.engine';
      a.target = '_blank';
      a.rel = 'noopener';
      brand.appendChild(a);
      root.appendChild(brand);
    }
  }

  function load(host) {
    if (host.getAttribute('data-loaded')) return;
    host.setAttribute('data-loaded', '1');
    var key = host.getAttribute('data-key');
    if (!key) return;
    fetch(api + (api.indexOf('?') >= 0 ? '&' : '?') + 'key=' + encodeURIComponent(key))
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { if (data) render(host, data); })
      .catch(function (err) { console.warn('[reviews widget]', err); });
  }

  function init() {
    var hosts = document.querySelectorAll('.reputation-engine-reviews[data-key]');
    for (var i = 0; i < hosts.length; i++) load(hosts[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
