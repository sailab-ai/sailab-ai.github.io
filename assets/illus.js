/* Procedural black/white illustrations.
   Every project has a "field" f(u, v, t) -> 0..1 (brightness).
   The same field can be drawn by four renderers: dots, dither, lines, ascii.
   Works from file:// (no modules, no fetch). */
(function () {
  'use strict';

  /* ---------------- noise ---------------- */
  function hash3(x, y, z) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1440670441);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function sm(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function noise3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    var a = lerp(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf);
    var b = lerp(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf);
    var c = lerp(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf);
    var d = lerp(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf);
    return lerp(lerp(a, b, yf), lerp(c, d, yf), zf);
  }
  function fbm(x, y, z, oct) {
    var s = 0, a = 0.5, f = 1, n = 0;
    for (var i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
    return s / n;
  }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function sstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  /* ---------------- tiny raymarcher ---------------- */
  var LX = -0.55, LY = 0.65, LZ = 0.52;
  (function () { var l = Math.hypot(LX, LY, LZ); LX /= l; LY /= l; LZ /= l; })();

  function march(sdf, u, v, t, steps, k) {
    var rx = u, ry = v, rz = -2.3, il = 1 / Math.hypot(rx, ry, rz);
    rx *= il; ry *= il; rz *= il;
    var oz = 3.5, d = 0;
    for (var i = 0; i < steps; i++) {
      var px = rx * d, py = ry * d, pz = oz + rz * d;
      var s = sdf(px, py, pz, t);
      if (s < 0.0016) {
        var e = 0.0025;
        var nx = sdf(px + e, py, pz, t) - sdf(px - e, py, pz, t);
        var ny = sdf(px, py + e, pz, t) - sdf(px, py - e, pz, t);
        var nz = sdf(px, py, pz + e, t) - sdf(px, py, pz - e, t);
        var nl = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= nl; ny *= nl; nz *= nl;
        var dif = Math.max(0, nx * LX + ny * LY + nz * LZ);
        var rim = Math.pow(1 - Math.max(0, -(nx * rx + ny * ry + nz * rz)), 3);
        var ao = 1 - (i / steps) * 0.55;
        return clamp01(0.06 + 0.86 * dif * ao + 0.22 * rim);
      }
      d += s * k;
      if (d > 8) break;
    }
    return 0;
  }
  function rotX(p, a) { var c = Math.cos(a), s = Math.sin(a), y = p[1], z = p[2]; p[1] = c * y - s * z; p[2] = s * y + c * z; }
  function rotY(p, a) { var c = Math.cos(a), s = Math.sin(a), x = p[0], z = p[2]; p[0] = c * x + s * z; p[2] = -s * x + c * z; }
  var P = [0, 0, 0];

  function sdTorus(x, y, z, t) {
    P[0] = x; P[1] = y; P[2] = z;
    rotX(P, 1.05 + 0.25 * Math.sin(t * 0.4)); rotY(P, t * 0.35 + 0.4);
    var qx = Math.hypot(P[0], P[2]) - 1.0;
    // knitted ribs on the surface
    var ang = Math.atan2(P[2], P[0]);
    var rib = 0.018 * Math.sin(ang * 36) * Math.sin(Math.atan2(P[1], qx) * 10);
    return Math.hypot(qx, P[1]) - 0.42 + rib;
  }
  function sdGyroid(x, y, z, t) {
    P[0] = x; P[1] = y; P[2] = z;
    rotY(P, t * 0.22 + 0.6); rotX(P, 0.35);
    var s = 3.4, qx = P[0] * s, qy = P[1] * s, qz = P[2] * s;
    var g = Math.abs(Math.sin(qx) * Math.cos(qy) + Math.sin(qy) * Math.cos(qz) + Math.sin(qz) * Math.cos(qx)) / s - 0.045;
    var sph = Math.hypot(P[0], P[1], P[2]) - 1.2;
    return Math.max(g * 0.75, sph);
  }
  function sdKeys(x, y, z, t) {
    P[0] = x; P[1] = y + 0.15; P[2] = z;
    rotX(P, -0.95); rotY(P, 0.62);
    var c = 0.74;
    var i = Math.max(-1, Math.min(1, Math.round(P[0] / c)));
    var j = Math.max(-1, Math.min(1, Math.round(P[2] / c)));
    var qx = P[0] - i * c, qz = P[2] - j * c;
    var press = sstep(0.55, 1, Math.sin(t * 1.6 + i * 1.9 + j * 2.7));
    var h = 0.2 - press * 0.12;
    var qy = P[1] - h;
    var bx = 0.25, by = h, bz = 0.25, r = 0.09;
    var dx = Math.abs(qx) - bx + r, dy = Math.abs(qy) - by + r, dz = Math.abs(qz) - bz + r;
    var o = Math.hypot(Math.max(dx, 0), Math.max(dy, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, Math.max(dy, dz)), 0) - r;
    var base = P[1] + 0.02; // floor plate
    var plate = Math.max(base, Math.max(Math.abs(P[0]) - 1.2, Math.abs(P[2]) - 1.2));
    return Math.min(o, Math.max(plate, -P[1] - 0.12));
  }

  /* ---------------- fields ---------------- */
  var FIELDS = {
    sphere: function (u, v, t) {
      var R = 0.78, r2 = u * u + v * v;
      if (r2 > R * R) {
        // soft cast shadow / sound shadow ring
        var d = Math.sqrt(r2) - R;
        var ring = Math.exp(-d * 14) * 0.18 * (0.5 + 0.5 * Math.sin(Math.atan2(v, u) * 3 + t));
        return ring;
      }
      var z = Math.sqrt(R * R - r2);
      var nx = u / R, ny = v / R, nz = z / R;
      var lx = Math.cos(t * 0.5) * 0.7, ly = 0.55, lz = Math.sin(t * 0.5) * 0.5 + 0.5;
      var ll = Math.hypot(lx, ly, lz);
      var dif = Math.max(0, (nx * lx + ny * ly + nz * lz) / ll);
      // microphone holes on a rotating lattice
      var th = Math.atan2(nx, nz) + t * 0.25, ph = Math.asin(ny);
      var hole = Math.sin(th * 12) * Math.sin(ph * 12);
      var b = 0.05 + 0.95 * dif;
      if (hole > 0.82) b *= 0.15;
      return clamp01(b);
    },
    torus: function (u, v, t) { return march(sdTorus, u, v, t, 64, 0.85); },
    gyroid: function (u, v, t) { return march(sdGyroid, u, v, t, 80, 0.8); },
    keys: function (u, v, t) { return march(sdKeys, u, v, t, 70, 0.8); },
    veins: function (u, v, t) {
      var x = u * 1.6, y = v * 1.6;
      var w = fbm(x * 0.8 + 3, y * 0.8, t * 0.05, 3) * 1.4;
      var n = fbm(x + w, y - w, t * 0.08 + 7, 4);
      var ridge = 1 - Math.abs(n - 0.5) * 2;
      var vv = Math.pow(ridge, 22) * 1.3;
      var n2 = fbm(x * 2.1 - w, y * 2.1 + 9, t * 0.06, 3);
      vv += Math.pow(1 - Math.abs(n2 - 0.5) * 2, 40) * 0.7;
      // nodes
      var nodes = [[-0.9, 0.5], [0.6, 0.62], [0.2, -0.55], [-0.4, -0.2], [1.05, -0.3]];
      for (var i = 0; i < nodes.length; i++) {
        var dx = u - nodes[i][0], dy = v - nodes[i][1];
        vv += Math.exp(-(dx * dx + dy * dy) * 160) * 1.2;
      }
      return clamp01(vv);
    },
    rings: function (u, v, t) {
      var ax = -0.55, bx = 0.55, k = 22;
      var d1 = Math.hypot(u - ax, v), d2 = Math.hypot(u - bx, v);
      var w = Math.cos(d1 * k - t * 2.2) + Math.cos(d2 * k - t * 2.2);
      var env = Math.exp(-(u * u * 0.35 + v * v * 0.8));
      return clamp01(Math.pow(Math.abs(w) * 0.5, 1.6) * env * 1.15);
    },
    terrain: function (u, v, t) {
      var x = u * 1.4, y = v * 1.4;
      var h = fbm(x + t * 0.04, y, 1.7, 5);
      var swell = 0.5 + 0.5 * Math.sin(x * 2.2 + y * 0.6 - t * 0.6);
      return clamp01(sstep(0.3, 0.78, h) * (0.35 + 0.65 * swell));
    },
    grains: function (u, v, t) {
      // pile
      var pileTop = -0.35 - Math.abs(u) * 0.9;
      var b = 0;
      if (v < pileTop) {
        var g = hash3(Math.floor(u * 90), Math.floor(v * 90), 3);
        b = (0.35 + 0.65 * (1 - (pileTop - v) * 0.9)) * (g > 0.35 ? 1 : 0.2);
      }
      // falling stream, grains move with t
      var sw = 0.06 + (v + 1) * 0.01;
      if (Math.abs(u) < sw && v > pileTop) {
        var gy = Math.floor((v + t * 0.5) * 70), gx = Math.floor(u * 70);
        var gg = hash3(gx, gy, 11);
        b = Math.max(b, gg > 0.55 ? 0.9 : 0.1);
      }
      // sparse airborne grains
      var sx = Math.floor(u * 40), sy = Math.floor((v + t * 0.2) * 40);
      if (hash3(sx, sy, 5) > 0.985 && v > pileTop) b = Math.max(b, 0.7);
      return clamp01(b);
    }
  };

  /* ---------------- renderers ---------------- */
  var BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];

  function sampleGrid(fn, gw, gh, asp, t, out) {
    for (var j = 0; j < gh; j++) {
      var v = 1 - 2 * (j + 0.5) / gh;
      for (var i = 0; i < gw; i++) {
        var u = (2 * (i + 0.5) / gw - 1) * asp;
        out[j * gw + i] = fn(u, v, t);
      }
    }
    return out;
  }

  var R = {
    dots: function (ctx, W, H, fn, t, o) {
      var c = o.cell || 6, gw = Math.max(2, Math.round(W / c)), gh = Math.max(2, Math.round(H / c));
      var cx = W / gw, cy = H / gh, asp = W / H;
      var F = sampleGrid(fn, gw, gh, asp, t, o._buf && o._buf.length === gw * gh ? o._buf : (o._buf = new Float32Array(gw * gh)));
      ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = o.fg; ctx.beginPath();
      var maxR = Math.min(cx, cy) * (o.spread || 0.62), lim = (o.reveal == null ? 1 : o.reveal) * gw;
      for (var j = 0; j < gh; j++) for (var i = 0; i < gw && i < lim; i++) {
        var val = F[j * gw + i];
        var r = Math.sqrt(val) * maxR;
        if (o.floor && r < o.floor) r = o.floor;
        if (r < 0.35) continue;
        var x = (i + 0.5) * cx, y = (j + 0.5) * cy;
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832);
      }
      ctx.fill();
    },
    dither: function (ctx, W, H, fn, t, o) {
      var px = o.cell || 3, gw = Math.max(2, Math.round(W / px)), gh = Math.max(2, Math.round(H / px));
      var F = sampleGrid(fn, gw, gh, W / H, t, o._buf && o._buf.length === gw * gh ? o._buf : (o._buf = new Float32Array(gw * gh)));
      var oc = o._oc || (o._oc = document.createElement('canvas'));
      if (oc.width !== gw || oc.height !== gh) { oc.width = gw; oc.height = gh; }
      var octx = oc.getContext('2d'), img = octx.createImageData(gw, gh), d = img.data;
      var fg = o.fg === '#fff' || o.fg === '#ffffff' ? 255 : 0, bg = 255 - fg;
      var lim = (o.reveal == null ? 1 : o.reveal) * gw;
      for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
        var k = (j * gw + i) * 4;
        var on = i < lim && F[j * gw + i] * 64 > BAYER[(j & 7) * 8 + (i & 7)] + 0.5;
        var c = on ? fg : bg;
        d[k] = d[k + 1] = d[k + 2] = c; d[k + 3] = 255;
      }
      octx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(oc, 0, 0, W, H);
    },
    lines: function (ctx, W, H, fn, t, o) {
      var gap = o.cell || 7, rows = Math.max(2, Math.floor(H / gap)), cols = Math.max(8, Math.round(W / 3));
      var asp = W / H, amp = o.amp || gap * 3.2;
      ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = o.fg; ctx.lineWidth = o.lw || 1; ctx.lineJoin = 'round';
      var lim = (o.reveal == null ? 1 : o.reveal) * W;
      var ys = new Float32Array(cols + 1);
      for (var j = 1; j < rows; j++) {
        var y0 = j * gap, v = 1 - 2 * y0 / H;
        for (var i = 0; i <= cols; i++) {
          var x = i / cols * W, u = (2 * x / W - 1) * asp;
          ys[i] = y0 - fn(u, v, t) * amp;
        }
        // occlude what is behind (hidden-line)
        ctx.beginPath(); ctx.moveTo(0, H);
        for (i = 0; i <= cols; i++) ctx.lineTo(i / cols * W, ys[i]);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fillStyle = o.bg; ctx.fill();
        ctx.beginPath();
        for (i = 0; i <= cols; i++) {
          var xx = i / cols * W; if (xx > lim) break;
          if (i === 0) ctx.moveTo(xx, ys[i]); else ctx.lineTo(xx, ys[i]);
        }
        ctx.stroke();
      }
    },
    ascii: function (ctx, W, H, fn, t, o) {
      var cw = o.cell || 7, ch = cw * 1.6, gw = Math.floor(W / cw), gh = Math.floor(H / ch);
      var ramp = o.ramp || ' .:-=+*#%@';
      var F = sampleGrid(fn, gw, gh, W / H, t, o._buf && o._buf.length === gw * gh ? o._buf : (o._buf = new Float32Array(gw * gh)));
      ctx.fillStyle = o.bg; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = o.fg; ctx.textBaseline = 'top';
      ctx.font = (ch * 0.92) + 'px "IBM Plex Mono", "DejaVu Sans Mono", monospace';
      for (var j = 0; j < gh; j++) for (var i = 0; i < gw; i++) {
        var k = Math.floor(clamp01(F[j * gw + i]) * (ramp.length - 0.001));
        if (k > 0) ctx.fillText(ramp[k], i * cw, j * ch);
      }
    }
  };

  /* ---------------- mount ---------------- */
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mount(host, opts) {
    var o = Object.assign({ style: 'dots', fg: '#fff', bg: '#000', ratio: 0.75, t0: 1.3, speed: 1, animate: 'hover' }, opts);
    var fn = FIELDS[o.kind] || FIELDS.sphere;
    var cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, t = o.t0, running = false, last = 0, raf = 0;

    function size() {
      var w = host.clientWidth || 300;
      var h = o.height || Math.round(w * o.ratio);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (w === W && h === H) return false;
      W = w; H = h;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    function draw() { R[o.style](ctx, W, H, fn, t, o); }
    function loop(now) {
      if (!running) return;
      if (o.fps && last && now - last < 1000 / o.fps) { raf = requestAnimationFrame(loop); return; }
      var dt = Math.min(0.2, (now - (last || now)) / 1000); last = now;
      t += dt * o.speed;
      if (o.onFrame) o.onFrame(api, dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
    var api = {
      canvas: cv, opts: o,
      get t() { return t; },
      start: function () { if (reduced || running) return; running = true; last = 0; raf = requestAnimationFrame(loop); },
      stop: function () { running = false; cancelAnimationFrame(raf); },
      redraw: function () { size(); draw(); },
      size: function () { return { w: W, h: H }; }
    };
    size(); draw();

    var target = o.hoverTarget || host;
    if (o.animate === 'hover') {
      target.addEventListener('pointerenter', api.start);
      target.addEventListener('pointerleave', api.stop);
      target.addEventListener('focusin', api.start);
      target.addEventListener('focusout', api.stop);
    } else if (o.animate === 'visible' && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? api.start() : api.stop(); }); }, { threshold: 0.05 }).observe(host);
    }
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (size()) draw(); }, 120); });
    return api;
  }

  /* Rasterise text into a coarse mask (0..1) at grid resolution. */
  function textMask(lines, gw, gh, opt) {
    opt = opt || {};
    var c = document.createElement('canvas'); c.width = gw; c.height = gh;
    var x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, gw, gh);
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    var size = opt.size || Math.floor(gh * 0.2);
    x.font = (opt.weight || 800) + ' ' + size + 'px ' + (opt.family || '"Archivo", "Inter", "Helvetica Neue", Arial, sans-serif');
    var lh = size * (opt.lh || 0.92);
    for (var i = 0; i < lines.length; i++) x.fillText(lines[i], opt.x || 0, (opt.y || size) + i * lh);
    var d = x.getImageData(0, 0, gw, gh).data, m = new Float32Array(gw * gh);
    for (var k = 0; k < m.length; k++) m[k] = d[k * 4] / 255;
    return m;
  }

  window.Illus = { mount: mount, fields: FIELDS, renderers: R, noise3: noise3, fbm: fbm, hash3: hash3, textMask: textMask, reduced: reduced, sstep: sstep };
})();
