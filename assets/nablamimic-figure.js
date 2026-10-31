/* Cover figure for "Ultra-Efficient Humanoid Control with Differentiable Simulation", third take.
   One drawing, in the same hidden-line language as the other figures.
   Every line is one training iteration: the trace of a joint through one walking rollout.
   Iterations stack from the back (top) to the front (bottom), like a range of ridges.
   - Early iterations are jagged: stumbles, impacts, noise.
   - Each step down the gradient smooths the trace toward a clean periodic stride.
   - The span of the motion that still has to be searched narrows step by step, so the active
     part of the stack is an inverted triangle: a nabla made of gaits.
   v4: the rows are fixed in place (no line ever appears or disappears); strides flow along
   each line and the roughness of each iteration evolves slowly. No reader input is used.
   API matches Illus.mount: { opts, redraw(), size(), t }. */
(function () {
  'use strict';
  var I = window.Illus;

  function mount(host, opts) {
    var o = Object.assign({ ratio: 0.62, t0: 0, fps: 20, reveal: null }, opts);
    var cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    var ctx = cv.getContext('2d'), W = 0, H = 0, t = o.t0, running = false, last = 0, raf = 0;
    function size() {
      var w = host.clientWidth || 300, h = Math.round(w * o.ratio), dpr = Math.min(devicePixelRatio || 1, 2);
      if (w === W && h === H) return false;
      W = w; H = h; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    var ys = null;

    function draw() {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      if (o.reveal != null && o.reveal < 1) { ctx.beginPath(); ctx.rect(0, 0, W * o.reveal, H); ctx.clip(); }
      var gap = Math.max(5, H / 46), top = H * 0.16, bottom = H * 0.97;
      var rows = Math.floor((bottom - top) / gap), cols = Math.max(80, Math.round(W / 2.5));
      if (!ys || ys.length !== cols + 1) ys = new Float32Array(cols + 1);
      // rows stay where they are, so no line ever enters or leaves; the motion is along each line,
      // and the roughness of every iteration evolves slowly in time instead
      var amp = gap * 4.2;
      ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000';
      for (var j = 0; j < rows; j++) {
        var y0 = top + j * gap;
        var s = Math.max(0, Math.min(1, (y0 - top) / (bottom - top)));   // 0 at the back, 1 at the apex
        var id = j;
        var rough = Math.pow(1 - s, 1.6);
        var half = 0.46 * (1 - s) + 0.035;                                 // the nabla
        var rise = I.sstep(0, 0.08, s);                                    // new iterations ease in at the back
        var ph = t * 0.9 + id * 0.11, f = 11;
        for (var i = 0; i <= cols; i++) {
          var x = i / cols, d = Math.abs(x - 0.5) / half;
          // a band with firm edges, so the sides of the triangle read clearly
          var env = d >= 1 ? 0 : I.sstep(1, 0.86, d);
          var h = 0;
          if (env > 0) {
            var p = x * f * Math.PI * 2 + ph;
            // a stride: a long swing and a short, sharper stance
            var g = 0.62 + 0.38 * Math.sin(p) + 0.18 * Math.sin(2 * p + 0.9) - 0.08 * Math.cos(3 * p);
            var nz = (I.fbm(x * 14 - t * 0.12, id * 0.61, 3.7 + t * 0.05, 3) - 0.5) * 2.2;
            var spike = Math.pow(Math.max(0, I.noise3(x * 40 - t * 0.3, id * 1.3, 5.1 + t * 0.07) - 0.66) * 2.9, 2) * 1.6;
            // the stride is always there underneath; the noise on top of it is what training removes
            h = env * rise * (0.15 + g * (0.35 + 0.65 * s) * (1 - 0.55 * rough) + rough * (nz + spike));
          }
          ys[i] = y0 - Math.max(0, h) * amp;
        }
        // hidden line: hide what is behind, then draw the line
        ctx.beginPath(); ctx.moveTo(0, H);
        for (i = 0; i <= cols; i++) ctx.lineTo(i / cols * W, ys[i]);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.beginPath();
        for (i = 0; i <= cols; i++) { var X = i / cols * W; if (i === 0) ctx.moveTo(X, ys[i]); else ctx.lineTo(X, ys[i]); }
        ctx.stroke();
      }
      ctx.restore();
    }
    function loop(now) {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (last && now - last < 1000 / o.fps) return;
      var dt = last ? Math.min(0.2, (now - last) / 1000) : 0; last = now;
      t += dt; draw();
    }
    var api = {
      opts: o, canvas: cv, redraw: function () { draw(); }, size: function () { return { w: W, h: H }; }, get t() { return t; },
      start: function () { if (I.reduced || running) return; running = true; last = 0; raf = requestAnimationFrame(loop); },
      stop: function () { running = false; cancelAnimationFrame(raf); }
    };
    size(); draw();
    if (!o.manual && !I.reduced && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
          else if (!e.isIntersecting) { running = false; cancelAnimationFrame(raf); }
        });
      }).observe(host);
    }
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (size()) draw(); }, 120); });
    return api;
  }

  window.FeatureDiffsim4 = {
    mount: mount,
    project: {
      slug: 'humanoid-diffsim',
      title: '\u2207Mimic: Ultra-Efficient Humanoid Control with Differentiable Simulation',
      short: '\u2207Mimic: Humanoid Control with Differentiable Simulation',
      date: '2026.10.29',
      abstract: 'A humanoid learns to walk by following the gradient of the simulator itself. Backpropagating through contact and dynamics, a controller settles into an efficient gait in minutes, from a fraction of the samples that trial and error needs.',
      tag: 'differentiable simulation',
      kind: 'terrain', motif: 'attractor', parts: ['gradient', 'gait'],
      feature: 'diffsim'
    }
  };
})();
