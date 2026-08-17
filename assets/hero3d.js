/* Kalsa Dermaga — hero 3D backdrop
   Two stacked layers, both purely decorative:
     1. A WebGL sea surface. A ground plane is ray-cast per pixel in the
        fragment shader, so the perspective and horizon are real 3D, not a
        2D texture. No library.
     2. A 2D canvas constellation: one node per brand, orbiting a core in
        3D and perspective-projected by hand, depth-sorted.

   Everything degrades: no WebGL means layer 1 simply never draws and the
   CSS gradient shows through. prefers-reduced-motion renders one still
   frame. Both layers stop when the hero scrolls away or the tab hides. */
(function () {
  'use strict';

  var host = document.querySelector('.hero-canvas');
  if (!host) return;

  var reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var visible = true;
  var running = false;

  /* ================================================================
     LAYER 1 — WebGL sea surface
     ================================================================ */
  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uPtr;',

    'float wave(vec2 p, float t){',
    '  float h = 0.0;',
    '  h += sin(p.x * 0.45 + t * 0.33) * 0.55;',
    '  h += sin(p.y * 0.38 - t * 0.27) * 0.45;',
    '  h += sin((p.x + p.y) * 0.27 + t * 0.19) * 0.33;',
    '  h += sin((p.x * 0.8 - p.y * 0.55) + t * 0.42) * 0.16;',
    '  h += sin(p.y * 1.55 - t * 0.60) * 0.05;',
    '  return h;',
    '}',

    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
    '  vec3 ro = vec3(0.0, 1.0, 0.0);',
    '  vec3 rd = normalize(vec3(uv.x * 1.15, uv.y * 0.95 - 0.22 + uPtr.y * 0.025, 1.0));',
    '  if (rd.y > -0.001) { gl_FragColor = vec4(0.0); return; }',
    '  float t = -ro.y / rd.y;',
    '  if (t > 95.0) { gl_FragColor = vec4(0.0); return; }',
    '  vec3 pos = ro + rd * t;',
    '  vec2 q = vec2(pos.x, pos.z) + vec2(uPtr.x * 0.55, uTime * 0.32);',

    '  float e = 0.14;',
    '  float h  = wave(q, uTime);',
    '  float hx = wave(q + vec2(e, 0.0), uTime);',
    '  float hz = wave(q + vec2(0.0, e), uTime);',
    '  vec3 n = normalize(vec3(-(hx - h) / e * 0.28, 1.0, -(hz - h) / e * 0.28));',

    '  vec3 L = normalize(vec3(-0.35, 0.85, -0.40));',
    '  float dif = max(dot(n, L), 0.0);',
    '  vec3 V = -rd;',
    '  vec3 H = normalize(L + V);',
    '  float spec = pow(max(dot(n, H), 0.0), 42.0);',

    '  vec3 deep = vec3(0.035, 0.115, 0.205);',
    '  vec3 mid  = vec3(0.070, 0.365, 0.435);',
    '  vec3 tip  = vec3(0.430, 0.900, 0.885);',
    '  vec3 col = mix(deep, mid, clamp(dif * 1.05, 0.0, 1.0));',
    '  col = mix(col, tip, clamp(spec * 1.35 + max(h, 0.0) * 0.16, 0.0, 1.0));',
  '  float horizon = smoothstep(38.0, 78.0, t) * 0.30;',
  '  col += vec3(0.10, 0.34, 0.40) * horizon;',

    '  float fog  = 1.0 - smoothstep(12.0, 82.0, t);',
    '  float near = smoothstep(0.0, 3.0, t);',
    '  float a = fog * near * 0.95;',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');

  var gl = null, prog = null, uRes = null, uTime = null, uPtr = null;
  var waveCanvas = document.getElementById('heroWaves');

  function compile(g, type, src) {
    var s = g.createShader(type);
    g.shaderSource(s, src);
    g.compileShader(s);
    if (!g.getShaderParameter(s, g.COMPILE_STATUS)) { g.deleteShader(s); return null; }
    return s;
  }

  function initGL() {
    if (!waveCanvas) return false;
    try {
      gl = waveCanvas.getContext('webgl', {
        alpha: true, antialias: false, depth: false,
        premultipliedAlpha: true, powerPreference: 'low-power',
        preserveDrawingBuffer: true
      }) || waveCanvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return false;

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { gl = null; return false; }

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uRes  = gl.getUniformLocation(prog, 'uRes');
    uTime = gl.getUniformLocation(prog, 'uTime');
    uPtr  = gl.getUniformLocation(prog, 'uPtr');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    waveCanvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); gl = null;
    });
    return true;
  }

  function drawGL(t) {
    if (!gl) return;
    gl.uniform1f(uTime, t);
    gl.uniform2f(uPtr, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ================================================================
     LAYER 2 — brand constellation
     ================================================================ */
  var nodeCanvas = document.getElementById('heroNodes');
  var ctx = nodeCanvas ? nodeCanvas.getContext('2d') : null;

  // colour per brand, matching the venture cards
  var NODES = [
    { r: 1.00, tilt:  0.30, phase: 0.0,  spd: 0.085, y:  0.10, c: '14,154,163'  },
    { r: 1.34, tilt: -0.22, phase: 1.1,  spd: 0.062, y: -0.16, c: '232,119,10'  },
    { r: 0.82, tilt:  0.46, phase: 2.3,  spd: 0.104, y:  0.22, c: '214,69,69'   },
    { r: 1.52, tilt:  0.12, phase: 3.4,  spd: 0.051, y:  0.05, c: '47,158,68'   },
    { r: 1.14, tilt: -0.38, phase: 4.2,  spd: 0.074, y: -0.24, c: '139,92,246'  },
    { r: 1.70, tilt:  0.26, phase: 5.1,  spd: 0.044, y:  0.18, c: '28,126,214'  },
    { r: 0.62, tilt: -0.14, phase: 6.0,  spd: 0.125, y: -0.06, c: '122,162,214' }
  ];

  var DUST = [];
  for (var i = 0; i < 54; i++) {
    DUST.push({
      r: 1.9 + Math.sin(i * 12.9898) * 0.9 + (i % 7) * 0.11,
      tilt: ((i * 37) % 100) / 100 * 1.2 - 0.6,
      phase: (i * 2.399) % 6.283,
      spd: 0.012 + ((i * 13) % 9) * 0.0035,
      y: (((i * 29) % 100) / 100 - 0.5) * 1.5
    });
  }

  var FOV = 330, CAM = 4.0;

  function project(x, y, z, cx, cy, spin) {
    // global slow spin plus pointer parallax
    var ca = Math.cos(spin), sa = Math.sin(spin);
    var rx = x * ca - z * sa;
    var rz = x * sa + z * ca;
    // tilt the whole system toward the pointer
    var py = y + pointer.y * 0.22;
    var pz = rz + 0.0;
    var cb = Math.cos(pointer.x * 0.20), sb = Math.sin(pointer.x * 0.20);
    var fx = rx * cb - pz * sb;
    var fz = rx * sb + pz * cb;
    var d = fz + CAM;
    if (d < 0.35) d = 0.35;
    var s = FOV / d;
    return { x: cx + fx * s, y: cy + py * s, s: s, d: d };
  }

  function drawNodes(t, w, h) {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // sit beside the headline on wide screens, centred on narrow ones
    var cx = w > 900 ? w * 0.70 : w * 0.5;
    var cy = w > 900 ? h * 0.44 : h * 0.82;
    var spin = t * 0.055;
    var pts = [], k;

    for (k = 0; k < NODES.length; k++) {
      var n = NODES[k];
      var a = n.phase + t * n.spd;
      var ox = Math.cos(a) * n.r;
      var oz = Math.sin(a) * n.r;
      var oy = n.y + Math.sin(a * 1.4 + n.phase) * 0.13;
      // tilt the orbit plane
      var ct = Math.cos(n.tilt), st = Math.sin(n.tilt);
      var ty = oy * ct - oz * st;
      var tz = oy * st + oz * ct;
      var p = project(ox, ty, tz, cx, cy, spin);
      p.c = n.c;
      pts.push(p);
    }

    // links between nodes that are near each other in screen space
    for (k = 0; k < pts.length; k++) {
      for (var j = k + 1; j < pts.length; j++) {
        var dx = pts[k].x - pts[j].x, dy = pts[k].y - pts[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var reach = Math.min(w, h) * 0.42;
        if (dist > reach) continue;
        var op = (1 - dist / reach) * 0.30;
        ctx.strokeStyle = 'rgba(140,215,230,' + op.toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pts[k].x, pts[k].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }

    // dust, behind everything
    for (k = 0; k < DUST.length; k++) {
      var u = DUST[k];
      var da = u.phase + t * u.spd;
      var dp = project(Math.cos(da) * u.r, u.y, Math.sin(da) * u.r, cx, cy, spin);
      var dalpha = Math.max(0, Math.min(0.5, (dp.s / FOV) * 0.55));
      ctx.fillStyle = 'rgba(160,215,230,' + dalpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(dp.x, dp.y, Math.max(0.5, dp.s * 0.0042), 0, 6.2832);
      ctx.fill();
    }

    // central core
    var core = FOV / CAM;
    var cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 0.30);
    cg.addColorStop(0,    'rgba(120,225,225,0.30)');
    cg.addColorStop(0.45, 'rgba(60,150,190,0.10)');
    cg.addColorStop(1,    'rgba(60,150,190,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, core * 0.30, 0, 6.2832);
    ctx.fill();

    // nodes, far to near
    pts.sort(function (a, b) { return b.d - a.d; });
    for (k = 0; k < pts.length; k++) {
      var q = pts[k];
      var rad = Math.max(2.1, q.s * 0.036);
      var alpha = Math.max(0.32, Math.min(1, (q.s / FOV) * 1.25));

      var g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad * 6.5);
      g.addColorStop(0,   'rgba(' + q.c + ',' + (0.70 * alpha).toFixed(3) + ')');
      g.addColorStop(0.4, 'rgba(' + q.c + ',' + (0.18 * alpha).toFixed(3) + ')');
      g.addColorStop(1,   'rgba(' + q.c + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(q.x, q.y, rad * 6.5, 0, 6.2832);
      ctx.fill();

      ctx.fillStyle = 'rgba(' + q.c + ',' + (0.92 * alpha).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(q.x, q.y, rad, 0, 6.2832);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,' + (0.75 * alpha).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(q.x - rad * 0.28, q.y - rad * 0.28, rad * 0.36, 0, 6.2832);
      ctx.fill();
    }
  }

  /* ================================================================
     Sizing, loop, lifecycle
     ================================================================ */
  var W = 0, H = 0;

  function resize() {
    var rect = host.getBoundingClientRect();
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    var pw = Math.round(W * DPR), ph = Math.round(H * DPR);
    var wq = window.innerWidth < 700 ? 0.7 : 1;   // wave-only downscale
    var ww = Math.max(1, Math.round(pw * wq)), wh = Math.max(1, Math.round(ph * wq));

    if (waveCanvas) {
      waveCanvas.width = ww; waveCanvas.height = wh;
      if (gl) { gl.viewport(0, 0, ww, wh); gl.uniform2f(uRes, ww, wh); }
    }
    if (nodeCanvas) {
      nodeCanvas.width = pw; nodeCanvas.height = ph;
      if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  var start = null;
  function frame(ts) {
    if (!running) return;
    if (start === null) start = ts;
    var t = (ts - start) / 1000;

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;

    drawGL(t);
    drawNodes(t, W, H);
    window.requestAnimationFrame(frame);
  }

  function play() {
    if (running || reduced) return;
    running = true;
    start = null;
    window.requestAnimationFrame(frame);
  }
  function pause() { running = false; }

  function boot() {
    initGL();
    resize();

    if (reduced) {           // one still frame, no loop
      var still = function () { resize(); drawGL(2.4); drawNodes(2.4, W, H); };
      still();
      var srt;
      window.addEventListener('resize', function () {
        clearTimeout(srt); srt = setTimeout(still, 160);
      });
      return;
    }

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); }, 160);
    });

    if (window.matchMedia('(pointer:fine)').matches) {
      window.addEventListener('mousemove', function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause(); else if (visible) play();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && !document.hidden) play(); else pause();
      }, { threshold: 0 }).observe(host);
    } else {
      play();
    }
    play();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
