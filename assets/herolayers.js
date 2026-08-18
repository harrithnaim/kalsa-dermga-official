/* =====================================================================
   KALSA DERMAGA — LAYERED HERO
   =====================================================================
   A photographic base plate with the moving things composited over it as
   separate sprites, so they genuinely travel instead of the whole
   picture being warped.

     Layer 1 (WebGL)  the base plate: sky above the horizon, water below.
                      The water is resampled through a travelling ripple
                      whose wavelength stretches and amplitude grows
                      toward the viewer; stars are found by luminance and
                      twinkle on independent phases; the sky rotates
                      slowly about a pivot below the horizon; a meteor
                      crosses now and then. Because no subject is baked
                      into this plate any more, the ripple can be pushed
                      much harder than it could before.

     Layer 2 (2D)     the subjects. The vessel sails, each dolphin leaps
                      on its own cycle, and both throw a reflection that
                      is drawn as horizontal slices with a sinusoidal
                      offset — a mirrored copy alone reads as a sticker,
                      the slicing is what makes it sit in water.

   THE ONE IDEA THAT MAKES THIS WORK
   Sprites are positioned in PLATE space, not screen space, and the crop
   maths is computed once in JavaScript and handed to the shader as
   uniforms rather than being duplicated in GLSL. So when the hero is a
   different shape on a phone, or the slow push-in breathes in and out,
   the ship stays on the horizon instead of sliding off it. Two copies of
   that maths would drift apart within a frame.

   CONFIGURE on the host element:
     data-plate="assets/hero-base.jpg"
     data-horizon="0.573"    where the water starts in the plate, as a
                             fraction of its height. Measure it; do not
                             guess.
     data-focus / data-focus-x / data-focus-x-narrow
                             which part survives the crop, 0..1.

   Sprites come from window.KD_HERO_SPRITES (see DEFAULT_SPRITES).

   DEGRADES: no WebGL or no plate -> the image is set as a CSS background
   and nothing moves. Reduced motion -> one still frame. Offscreen or
   hidden tab -> the loop stops. A sprite that fails to load is skipped;
   the rest of the scene is unaffected.
   ===================================================================== */
(function () {
  'use strict';

  /* Positions and sizes are fractions of the PLATE, not the screen.
     x wraps, so a ship leaving one side re-enters the other. */
  /* Positions are in PLATE space: x and y are fractions of the base
     image, w is a fraction of its width. y is where the subject MEETS
     THE WATER — the sprite is drawn with its bottom edge on that line,
     which is the only anchor that stays right when the crop changes.

     The vessel sits on the horizon (0.574). The pod is well below it, in
     the foreground water, because that is where something two hundred
     metres away actually appears — putting them near the horizon made
     them collide with the ship and read as the same distance. */
  var DEFAULT_SPRITES = [
    { src: 'hero-ship.png', role: 'ship',
      /* NEGATIVE speed. The bow is the low, pointed end on the LEFT of
         the sprite and the accommodation block is aft on the right, so a
         positive speed sailed her stern-first across the horizon. */
      x: 0.615, y: 0.5775, w: 0.150, speed: -0.0040, refl: 0.30 },

    /* The pod sits centre-left and low. Further left and the crop eats
       it on a 16:9-ish hero; further right and it fouls the vessel and
       the moon path. */
    { src: 'hero-dolphin-1.png', role: 'dolphin',
      x: 0.305, y: 0.870, w: 0.175, period: 10.5, off: 0.00, lift: 0.030, drift: 0.0016 },
    { src: 'hero-dolphin-2.png', role: 'dolphin',
      x: 0.430, y: 0.812, w: 0.140, period: 10.5, off: 0.31, lift: 0.026, drift: 0.0016 },
    { src: 'hero-dolphin-3.png', role: 'dolphin',
      x: 0.530, y: 0.858, w: 0.105, period: 10.5, off: 0.58, lift: 0.022, drift: 0.0016 },
    { src: 'hero-dolphin-4.png', role: 'dolphin',
      x: 0.375, y: 0.768, w: 0.115, period: 10.5, off: 0.80, lift: 0.020, drift: 0.0016 }
  ];

  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos,0.0,1.0); }';

  var FRAG = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'uniform vec2  uRes;',
    'uniform vec2  uTexRes;',
    'uniform float uTime;',
    'uniform float uHorizon;',
    'uniform float uMotion;',
    'uniform float uZoom;',          // computed in JS, shared with layer 2
    'uniform vec2  uOrigin;',        // crop centre + parallax, likewise

    'float segDist(vec2 p, vec2 a, vec2 b){',
    '  vec2 pa = p - a, ba = b - a;',
    '  float h = clamp(dot(pa,ba)/max(1e-5, dot(ba,ba)), 0.0, 1.0);',
    '  return length(pa - ba*h);',
    '}',
    'float hash21(vec2 p){',
    '  p = fract(p*vec2(123.34,456.21));',
    '  p += dot(p,p+45.32);',
    '  return fract(p.x*p.y);',
    '}',

    'void main(){',
    '  vec2 frag = gl_FragCoord.xy/uRes;',
    '  vec2 uv = vec2(frag.x, 1.0 - frag.y);',
    '  float t = uTime;',

    '  float ca = uRes.x/uRes.y;',
    '  float ta = uTexRes.x/uTexRes.y;',
    '  vec2 f = (ca > ta) ? vec2(1.0, ta/ca) : vec2(ca/ta, 1.0);',
    '  vec2 base = (uv - 0.5)*f*uZoom + uOrigin;',

    /* the sky turns, faded to nothing AT the waterline so it cannot tear */
    '  float skyAmt = 1.0 - smoothstep(uHorizon - 0.12, uHorizon - 0.006, base.y);',
    '  if (skyAmt > 0.001 && uMotion > 0.5) {',
    '    float ang = 0.052*sin(t*0.021) * skyAmt;',
    '    vec2 piv = vec2(0.52, uHorizon + 0.22);',
    '    vec2 rel = base - piv;',
    '    vec2 rr = vec2(rel.x*cos(ang) - rel.y*sin(ang), rel.x*sin(ang) + rel.y*cos(ang));',
    '    base = mix(base, piv + rr, skyAmt);',
    '    base.x += 0.0048*sin(t*0.017)*skyAmt;',
    '  }',

    '  float depth = clamp((base.y - uHorizon)/max(0.001, 1.0 - uHorizon), 0.0, 1.0);',
    '  float isWater = smoothstep(0.0, 0.040, base.y - uHorizon);',

    /* The ripple, pushed harder than the single-plate version could
       manage. Previously the ship and the dolphins were baked into this
       image, so any real amplitude tore them apart; now they are sprites
       on the layer above and the water is free to actually move. */
    '  float freq = mix(210.0, 19.0, depth*depth);',
    '  float ph = base.y*freq + base.x*freq*0.30;',
    '  float d1 = sin(ph - t*1.62);',
    '  float d2 = sin(ph*0.51 + t*1.10 + base.x*11.0);',
    '  float d3 = sin(ph*1.90 - t*2.35 + base.x*4.0);',
    '  float disp = (d1*0.55 + d2*0.32 + d3*0.13);',
    '  float amp = (0.00045 + depth*depth*0.0165) * isWater * uMotion;',
    '  vec2 suv = base + vec2(disp*amp*0.42, disp*amp);',

    '  vec2 texUV = mix(base, suv, isWater);',
    '  texUV = clamp(texUV, vec2(0.0006), vec2(0.9994));',
    '  vec3 col = texture2D(uTex, texUV).rgb;',

    '  float crest = pow(max(0.0, d1*0.6 + d2*0.4), 9.0);',
    '  col += vec3(0.55,0.70,0.95) * crest * depth * 0.10 * isWater * uMotion;',

    /* bloom, from a ring of taps — one pixel cannot tell a lamp from a
       bright wave, and without the spread lights stay flat dots */
    '  float ring = 0.0;',
    '  for (int i = 0; i < 6; i++) {',
    '    float a = float(i)*1.0472;',
    '    vec2 o = vec2(cos(a), sin(a)) * 0.0055;',
    '    vec3 sc = texture2D(uTex, clamp(texUV + o, vec2(0.0006), vec2(0.9994))).rgb;',
    '    ring += max(0.0, dot(sc, vec3(0.299,0.587,0.114)) - 0.62);',
    '  }',
    '  ring /= 6.0;',
    '  col += vec3(1.00,0.80,0.52) * ring * 1.4 * (0.88 + 0.12*sin(t*1.9)*uMotion);',

    '  float skyMask = 1.0 - smoothstep(uHorizon - 0.10, uHorizon, base.y);',
    '  float lum = dot(col, vec3(0.299,0.587,0.114));',
    '  float star = smoothstep(0.28, 0.76, lum) * skyMask;',
    '  vec2 cell = floor(base*vec2(uTexRes.x, uTexRes.y)/2.5);',
    '  float hs = hash21(cell);',
    '  float tw = 0.62 + 0.38*sin(t*(1.4 + hs*5.5) + hs*62.0);',
    '  col += col * star * (tw - 0.62) * 1.6 * uMotion;',

    '  if (uMotion > 0.5) {',                       // the occasional meteor
    '    float seg = floor(t/9.0);',
    '    float phm = fract(t/9.0);',
    '    if (phm < 0.19) {',
    '      float k = phm/0.19;',
    '      float r1 = hash21(vec2(seg, 3.7));',
    '      float r2 = hash21(vec2(seg, 9.1));',
    '      vec2 a0 = vec2(0.06 + r1*0.72, 0.04 + r2*0.28);',
    '      vec2 dir = normalize(vec2(0.62 + r2*0.30, 0.34 + r1*0.22));',
    '      vec2 head = a0 + dir*(k*0.30);',
    '      vec2 tail = a0 + dir*max(0.0, k-0.20)*0.30;',
    '      float m = smoothstep(0.0045, 0.0, segDist(base, tail, head)) * sin(k*3.14159);',
    '      col += vec3(0.85,0.92,1.00) * m * 0.85 * skyAmt;',
    '    }',
    '  }',

    '  vec2 vd = (frag - 0.5);',
    '  col *= 1.0 - dot(vd, vd)*0.26;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function Hero(host) {
    var src = host.getAttribute('data-plate');
    if (!src) return;

    var horizon = parseFloat(host.getAttribute('data-horizon'));
    if (!(horizon > 0 && horizon < 1)) horizon = 0.573;
    var focusY = parseFloat(host.getAttribute('data-focus'));
    if (!(focusY > 0 && focusY < 1)) focusY = 0.5;
    var fxWide = parseFloat(host.getAttribute('data-focus-x'));
    if (!(fxWide > 0 && fxWide < 1)) fxWide = 0.5;
    var fxNarrow = parseFloat(host.getAttribute('data-focus-x-narrow'));
    if (!(fxNarrow > 0 && fxNarrow < 1)) fxNarrow = 0.62;

    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    var visible = true, running = false, W = 0, H = 0;

    host.style.backgroundImage = 'url("' + src + '")';
    host.style.backgroundSize = 'cover';
    host.style.backgroundPosition = 'center';

    /* ---- canvases: plate below, sprites above ----
       Order matters and it has bitten me twice. The plate writes opaque
       pixels, so the sprite canvas must come AFTER it in the DOM. When
       the page already ships one canvas and not the other, inserting the
       new one at the front puts the sprites behind an opaque sea and it
       looks exactly like they failed to load. Insert relative to the
       plate, not relative to the host. */
    var glCanvas = document.getElementById('heroWaves');
    var fgCanvas = document.getElementById('heroNodes');
    function mk() {
      var c = document.createElement('canvas');
      c.className = 'kd-sea';
      c.setAttribute('aria-hidden', 'true');
      return c;
    }
    if (!glCanvas) {
      glCanvas = mk();
      host.insertBefore(glCanvas, host.firstChild);
    }
    if (!fgCanvas) {
      fgCanvas = mk();
      glCanvas.parentNode.insertBefore(fgCanvas, glCanvas.nextSibling);
    }

    var ctx = fgCanvas.getContext ? fgCanvas.getContext('2d') : null;

    var gl = null, prog, U = {}, tex, texW = 1, texH = 1, ready = false;

    function compile(type, s) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        if (window.KD_HERO_DEBUG) console.warn(gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    function initGL() {
      try {
        gl = glCanvas.getContext('webgl', {
          alpha: false, antialias: false, depth: false,
          powerPreference: 'low-power', preserveDrawingBuffer: true
        }) || glCanvas.getContext('experimental-webgl');
      } catch (e) { gl = null; }
      if (!gl) return false;
      var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { gl = null; return false; }
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes','uTexRes','uTime','uHorizon','uMotion','uZoom','uOrigin','uTex']
        .forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      glCanvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault(); gl = null; running = false;
      });
      return true;
    }

    function upload(img) {
      texW = img.naturalWidth || img.width;
      texH = img.naturalHeight || img.height;
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      // CLAMP + LINEAR and no mipmaps: a photo is rarely a power of two,
      // and REPEAT or mipmapping on one renders solid black in WebGL 1
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(U.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      ready = true;
      host.classList.add('kd-has-plate');
    }

    /* ==============================================================
       CROP MATHS — computed once here, shared with the shader
       ============================================================== */
    var view = { zoom: 1, ox: 0.5, oy: 0.5, fx: 1, fy: 1 };

    function updateView(t) {
      var ca = W / Math.max(1, H), ta = texW / Math.max(1, texH);
      view.fx = (ca > ta) ? 1 : ca / ta;
      view.fy = (ca > ta) ? ta / ca : 1;
      var m = reduced ? 0 : 1;
      // never sit at zoom 1.0: the ripple would push samples past the
      // plate edge and CLAMP_TO_EDGE smears the last row into steps
      view.zoom = 0.985 - 0.030 * (0.5 + 0.5 * Math.sin(t * 0.055)) * m;
      var r = W / Math.max(1, H);
      var k = Math.max(0, Math.min(1, (1.55 - r) / 0.75));
      var fx = fxWide + (fxNarrow - fxWide) * k;
      view.ox = fx + ptr.x * 0.010 * m;
      view.oy = focusY + ptr.y * 0.006 * m + Math.sin(t * 0.33) * 0.0016 * m;
    }

    // plate coords -> screen px
    function px(bx, by) {
      return {
        x: ((bx - view.ox) / (view.fx * view.zoom) + 0.5) * W,
        y: ((by - view.oy) / (view.fy * view.zoom) + 0.5) * H
      };
    }
    // a plate-space width in screen px
    function pw(bw) { return (bw / (view.fx * view.zoom)) * W; }

    /* ==============================================================
       SPRITES
       ============================================================== */
    /* The website serves sprites from assets/, the app from its own
       folder. One prefix, set per host, rather than two copies of the
       list that can drift apart. */
    var spriteBase = host.getAttribute('data-sprite-base');
    if (spriteBase == null) spriteBase = 'assets/';

    var sprites = (window.KD_HERO_SPRITES || DEFAULT_SPRITES).map(function (s) {
      var o = {}; for (var k in s) o[k] = s[k];
      o.src = spriteBase + s.src;
      o.img = new Image();
      o.loaded = false;
      o.img.onload = function () { o.loaded = true; };
      o.img.onerror = function () { o.loaded = false; };
      o.img.src = o.src;
      return o;
    });

    function wrap01(v) { return v - Math.floor(v); }

    /* A reflection drawn as horizontal slices, each nudged sideways by a
       travelling sine. A single flipped copy reads as a sticker; the
       slicing is what puts it in the water. */
    function reflect(img, cx, topY, w, h, t, strength) {
      var slices = 22, sh = h / slices;
      for (var i = 0; i < slices; i++) {
        var f = i / (slices - 1);
        var sy = topY + i * sh;
        var off = Math.sin(t * 1.7 + f * 7.0 + cx * 0.02) * w * 0.018 * (0.3 + f);
        ctx.globalAlpha = strength * (1 - f) * (1 - f) * 0.9;
        ctx.drawImage(img,
          0, img.height * (1 - (i + 1) / slices), img.width, img.height / slices,
          cx - w / 2 + off, sy, w, sh + 0.7);
      }
      ctx.globalAlpha = 1;
    }

    function drawShip(s, t) {
      if (!s.loaded) return;
      var bx = wrap01(s.x + s.speed * t * (reduced ? 0 : 1));
      var p = px(bx, s.y);
      var w = pw(s.w);
      var h = w * (s.img.height / s.img.width);
      if (w < 6) return;
      var bob = Math.sin(t * 0.5 + bx * 9) * h * 0.018;
      // hull sits ON the waterline: the sprite's bottom edge is the line
      var topY = p.y - h + bob;
      if (p.x < -w || p.x > W + w) return;
      ctx.drawImage(s.img, p.x - w / 2, topY, w, h);
      reflect(s.img, p.x, p.y + bob, w, h * 0.55, t, s.refl == null ? 0.3 : s.refl);
    }

    /* One offscreen canvas, reused. Cheaper than allocating per frame
       and per animal, and it is the only way to get a soft waterline. */
    var off = document.createElement('canvas');
    var octx = off.getContext ? off.getContext('2d') : null;

    function drawDolphin(s, t) {
      if (!s.loaded || !octx) return;
      var cyc = (((t / s.period) + s.off) % 1 + 1) % 1;
      if (cyc > 0.46) return;
      var u = cyc / 0.46;
      var rise = Math.sin(u * Math.PI);

      var bx = wrap01(s.x + s.drift * t * (reduced ? 0 : 1));
      var p = px(bx, s.y);                 // this animal's waterline
      var w = pw(s.w);
      var h = w * (s.img.height / s.img.width);
      if (w < 10) return;

      /* THE FIX FOR THE AWKWARD JUMP.
         The sprite is a frozen leap with its splash anchored at the
         bottom, i.e. at the water. Lifting the whole thing floated the
         splash into the air with the animal, which is what looked wrong.
         Instead the sprite SLIDES UP THROUGH a fixed waterline and
         everything below that line is erased: at rise 0 it is fully
         submerged and invisible, and as it climbs you see the dorsal
         first, then the back, then the spray as it clears. The erase is
         a gradient, not a hard cut, because a straight horizontal edge
         across an animal reads as a slice. */
      var lift = pw(s.lift) * rise;
      var bottom = p.y + h * (1 - rise) - lift;
      var top = bottom - h;
      var cut = p.y - top;                 // waterline in sprite space
      if (cut <= 2) return;

      var pad = 3;
      var ow = Math.ceil((w + pad * 2) * DPR), oh = Math.ceil((h + pad * 2) * DPR);
      if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
      octx.setTransform(DPR, 0, 0, DPR, 0, 0);
      octx.clearRect(0, 0, w + pad * 2, h + pad * 2);
      octx.globalAlpha = 1;
      octx.drawImage(s.img, pad, pad, w, h);

      var cy = cut + pad;
      if (cy < h + pad * 2) {
        var feather = Math.max(2, h * 0.045);
        var g = octx.createLinearGradient(0, cy - feather, 0, cy + feather * 0.6);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        octx.globalCompositeOperation = 'destination-out';
        octx.fillStyle = g;
        octx.fillRect(0, cy - feather, w + pad * 2, (h + pad * 2) - (cy - feather));
        octx.globalCompositeOperation = 'source-over';
      }

      // a shallow forward arc and a little roll, so it is not a lift
      var arcX = (u - 0.5) * w * 0.30;
      var tilt = (0.5 - u) * 0.20;
      ctx.save();
      ctx.translate(p.x + arcX, p.y);
      ctx.rotate(tilt);
      ctx.drawImage(off, -w / 2 - pad, top - p.y - pad, w + pad * 2, h + pad * 2);
      ctx.restore();

      // a short broken reflection right under the contact point
      if (rise > 0.25) {
        ctx.globalAlpha = 0.18 * rise;
        reflect(s.img, p.x + arcX, p.y, w, h * 0.28, t, 0.20);
        ctx.globalAlpha = 1;
      }
    }

    function drawSprites(t) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      var i;
      for (i = 0; i < sprites.length; i++) {
        if (sprites[i].role === 'ship') drawShip(sprites[i], t);
      }
      for (i = 0; i < sprites.length; i++) {
        if (sprites[i].role === 'dolphin') drawDolphin(sprites[i], t);
      }
    }

    /* ==============================================================
       SIZE, LOOP, LIFECYCLE
       ============================================================== */
    function resize() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      var q = window.innerWidth < 700 ? 0.85 : 1;
      var pwx = Math.max(1, Math.round(W * DPR * q));
      var phy = Math.max(1, Math.round(H * DPR * q));
      glCanvas.width = pwx; glCanvas.height = phy;
      glCanvas.style.width = '100%'; glCanvas.style.height = '100%';
      if (gl) { gl.viewport(0, 0, pwx, phy); gl.uniform2f(U.uRes, pwx, phy); }
      fgCanvas.width = Math.round(W * DPR); fgCanvas.height = Math.round(H * DPR);
      fgCanvas.style.width = '100%'; fgCanvas.style.height = '100%';
      if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function drawGL(t) {
      if (!gl || !ready) return;
      gl.uniform1f(U.uTime, t);
      gl.uniform2f(U.uTexRes, texW, texH);
      gl.uniform1f(U.uHorizon, horizon);
      gl.uniform1f(U.uMotion, reduced ? 0 : 1);
      gl.uniform1f(U.uZoom, view.zoom);
      gl.uniform2f(U.uOrigin, view.ox, view.oy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var start = null;
    function frame(ts) {
      if (!running) return;
      if (host.isConnected === false) { running = false; return; }
      if (start === null) start = ts;
      var t = (ts - start) / 1000;
      ptr.x += (ptr.tx - ptr.x) * 0.04;
      ptr.y += (ptr.ty - ptr.y) * 0.04;
      updateView(t);
      drawGL(t);
      drawSprites(t);
      window.requestAnimationFrame(frame);
    }
    function play() { if (running || reduced) return; running = true; start = null;
                      window.requestAnimationFrame(frame); }
    function pause() { running = false; }
    function still() { updateView(4.0); drawGL(4.0); drawSprites(4.0); }

    if (!initGL()) return;
    resize();

    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      try { upload(img); } catch (e) { return; }
      resize();
      if (reduced) { still(); return; }
      play();
    };
    img.onerror = function () { /* the CSS background stands in */ };
    img.src = src;

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (reduced) still(); }, 140);
    }, { passive: true });

    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      window.addEventListener('mousemove', function (e) {
        ptr.tx = (e.clientX / window.innerWidth) * 2 - 1;
        ptr.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause(); else if (visible && ready) play();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        if (visible && !document.hidden && ready) play(); else pause();
      }, { threshold: 0 }).observe(host);
    }
  }

  /* The website marks its host in the HTML. The app renders its landing
     from JavaScript after load, so scan and rescan. */
  var DEFAULTS = { plate: 'hero-base.jpg', horizon: '0.574', focus: '0.5', spriteBase: '' };
  var live = 0;

  function scan() {
    var i, els = document.querySelectorAll('[data-plate]');
    for (i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-kd-hero-on')) continue;
      els[i].setAttribute('data-kd-hero-on', '1');
      live++;
      try { Hero(els[i]); }
      catch (e) { if (window.KD_HERO_DEBUG) console.error(e); }
    }
    if (live) return;
    els = document.querySelectorAll('.land-top .land-film, .land-film, .filmcard');
    for (i = 0; i < els.length && i < 1; i++) {
      if (els[i].getAttribute('data-plate')) continue;
      els[i].setAttribute('data-plate', DEFAULTS.plate);
      els[i].setAttribute('data-horizon', DEFAULTS.horizon);
      els[i].setAttribute('data-focus', DEFAULTS.focus);
      els[i].setAttribute('data-sprite-base', DEFAULTS.spriteBase);
    }
    if (els.length) scan();
  }

  function boot() {
    scan();
    if (!window.MutationObserver) return;
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t); t = setTimeout(scan, 120);
    }).observe(document.getElementById('app') || document.body,
               { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
