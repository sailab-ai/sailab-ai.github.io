/* WeightWave: a variable-font weight wave that follows the pointer's horizontal position.
   Each character of a text gets its own weight. While the pointer is inside the item, the
   character at a fixed offset to the right of the pointer is heaviest and the weight falls off
   smoothly on either side, the same x on every line. Width is given back as weight is added,
   so lines keep roughly their length; line breaks are frozen so nothing rewraps.
   Keyboard focus gives the whole text one even weight. Touch screens get no wave. */
(function () {
  'use strict';
  var canHover = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  function split(el) {
    var text = el.textContent, words = text.split(/(\s+)/), chars = [];
    el.textContent = '';
    el.setAttribute('aria-label', text);
    words.forEach(function (w) {
      if (/^\s+$/.test(w)) { el.appendChild(document.createTextNode(' ')); return; }
      var ws = document.createElement('span');
      ws.className = 'ww-w'; ws.setAttribute('aria-hidden', 'true');
      ws.style.whiteSpace = 'nowrap';
      for (var i = 0; i < w.length; i++) {
        var c = document.createElement('span');
        c.textContent = w[i];
        ws.appendChild(c);
        chars.push({ el: c, w: 0, s: 0 });
      }
      el.appendChild(ws);
    });
    return chars;
  }

  // freeze line breaks at the resting weight so the wave never rewraps a title
  function freeze(el) {
    el.querySelectorAll('br.ww-br').forEach(function (b) { b.remove(); });
    el.style.whiteSpace = '';
    var ws = el.querySelectorAll('.ww-w'), lastTop = null;
    ws.forEach(function (w) {
      var top = w.offsetTop;
      if (lastTop !== null && top > lastTop + 2) {
        var br = document.createElement('br'); br.className = 'ww-br';
        w.parentNode.insertBefore(br, w);
      }
      lastTop = top;
    });
    el.style.whiteSpace = 'nowrap';
  }

  /* opts:
       rest()   -> [weight, stretch] when the pointer is away (may depend on state, e.g. "selected")
       hover    -> weight across the text while the pointer is inside
       peak     -> extra weight at the crest
       sigma    -> width of the crest, px
       offset   -> crest position relative to the pointer, px (positive: to the right)
       give     -> stretch given back per unit of weight
       focus    -> even weight on keyboard focus
       freeze   -> freeze line breaks */
  function attach(region, text, o) {
    o = Object.assign({ hover: 600, peak: 260, sigma: 70, offset: 44, give: 0.045, focus: 760, freeze: false }, o);
    var chars = split(text), mx = null, inside = false, focused = false, pinned = false, raf = 0;
    var r0 = o.rest();
    chars.forEach(function (c) { c.w = r0[0]; c.s = r0[1]; });
    function targetFor(c, rest) {
      if (focused) return o.focus;
      if (pinned && !inside) return Math.max(rest[0], o.hover); // held heavy without a pointer (e.g. centred on a phone)
      if (!inside || mx === null) return rest[0];
      var r = c.el.getBoundingClientRect(), dx = (r.left + r.width / 2) - (mx + o.offset);
      return Math.max(rest[0], o.hover) + o.peak * Math.exp(-dx * dx / (2 * o.sigma * o.sigma));
    }
    function tick() {
      raf = 0;
      var rest = o.rest(), moving = false;
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i], tw = targetFor(c, rest);
        var ts = rest[1] - (tw - rest[0]) * o.give;
        var nw = c.w + (tw - c.w) * 0.16, ns = c.s + (ts - c.s) * 0.16;
        if (Math.abs(tw - nw) < 0.6 && Math.abs(ts - ns) < 0.05) { nw = tw; ns = ts; } else moving = true;
        if (nw !== c.w || ns !== c.s) {
          c.w = nw; c.s = ns;
          c.el.style.fontWeight = nw.toFixed(1);
          c.el.style.fontStretch = ns.toFixed(2) + '%';
        }
      }
      if (moving) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    if (canHover) {
      region.addEventListener('pointerenter', function (e) { inside = true; mx = e.clientX; kick(); });
      region.addEventListener('pointermove', function (e) { mx = e.clientX; kick(); });
      region.addEventListener('pointerleave', function () { inside = false; kick(); });
    }
    region.addEventListener('focusin', function (e) { if (e.target.matches && e.target.matches(':focus-visible')) { focused = true; kick(); } });
    region.addEventListener('focusout', function () { focused = false; kick(); });
    chars.forEach(function (c) { c.el.style.fontWeight = c.w; c.el.style.fontStretch = c.s + '%'; });
    if (o.freeze) {
      var refreeze = function () { freeze(text); };
      (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(refreeze);
      var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(refreeze, 150); });
    }
    return { refresh: kick, pin: function (on) { if (on !== pinned) { pinned = on; kick(); } } };
  }

  window.WeightWave = { attach: attach, canHover: canHover };
})();
