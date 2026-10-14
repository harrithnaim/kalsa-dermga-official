(function() {
  'use strict';
  var DEFAULT_SPRITES = [ {
    src: 'hero-ship.png',
    role: 'ship',
    x: .615,
    y: .5775,
    w: .15,
    speed: -.004,
    refl: .3
  } ];
  var VERT = 'attribute vec2 aPos;' + 'void main(){ gl_Position = vec4(aPos,0.0,1.0); }';
  var FRAG = [ 'precision mediump float;', 'uniform sampler2D uTex;', 'uniform vec2  uRes;', 'uniform vec2  uTexRes;', 'uniform float uTime;', 'uniform float uHorizon;', 'uniform float uMotion;', 'uniform float uZoom;', 'uniform vec2  uOrigin;', 'float segDist(vec2 p, vec2 a, vec2 b){', '  vec2 pa = p - a, ba = b - a;', '  float h = clamp(dot(pa,ba)/max(1e-5, dot(ba,ba)), 0.0, 1.0);', '  return length(pa - ba*h);', '}', 'float hash21(vec2 p){', '  p = fract(p*vec2(123.34,456.21));', '  p += dot(p,p+45.32);', '  return fract(p.x*p.y);', '}', 'void main(){', '  vec2 frag = gl_FragCoord.xy/uRes;', '  vec2 uv = vec2(frag.x, 1.0 - frag.y);', '  float t = uTime;', '  float ca = uRes.x/uRes.y;', '  float ta = uTexRes.x/uTexRes.y;', '  vec2 f = (ca > ta) ? vec2(1.0, ta/ca) : vec2(ca/ta, 1.0);', '  vec2 base = (uv - 0.5)*f*uZoom + uOrigin;', '  float skyAmt = 1.0 - smoothstep(uHorizon - 0.12, uHorizon - 0.006, base.y);', '  if (skyAmt > 0.001 && uMotion > 0.5) {', '    float ang = 0.052*sin(t*0.021) * skyAmt;', '    vec2 piv = vec2(0.52, uHorizon + 0.22);', '    vec2 rel = base - piv;', '    vec2 rr = vec2(rel.x*cos(ang) - rel.y*sin(ang), rel.x*sin(ang) + rel.y*cos(ang));', '    base = mix(base, piv + rr, skyAmt);', '    base.x += 0.0048*sin(t*0.017)*skyAmt;', '  }', '  float depth = clamp((base.y - uHorizon)/max(0.001, 1.0 - uHorizon), 0.0, 1.0);', '  float isWater = smoothstep(0.0, 0.040, base.y - uHorizon);', '  float freq = mix(210.0, 19.0, depth*depth);', '  float ph = base.y*freq + base.x*freq*0.30;', '  float d1 = sin(ph - t*1.62);', '  float d2 = sin(ph*0.51 + t*1.10 + base.x*11.0);', '  float d3 = sin(ph*1.90 - t*2.35 + base.x*4.0);', '  float disp = (d1*0.55 + d2*0.32 + d3*0.13);', '  float amp = (0.00045 + depth*depth*0.0165) * isWater * uMotion;', '  vec2 suv = base + vec2(disp*amp*0.42, disp*amp);', '  vec2 texUV = mix(base, suv, isWater);', '  texUV = clamp(texUV, vec2(0.0006), vec2(0.9994));', '  vec3 col = texture2D(uTex, texUV).rgb;', '  float crest = pow(max(0.0, d1*0.6 + d2*0.4), 9.0);', '  col += vec3(0.55,0.70,0.95) * crest * depth * 0.10 * isWater * uMotion;', '  float ring = 0.0;', '  for (int i = 0; i < 6; i++) {', '    float a = float(i)*1.0472;', '    vec2 o = vec2(cos(a), sin(a)) * 0.0055;', '    vec3 sc = texture2D(uTex, clamp(texUV + o, vec2(0.0006), vec2(0.9994))).rgb;', '    ring += max(0.0, dot(sc, vec3(0.299,0.587,0.114)) - 0.62);', '  }', '  ring /= 6.0;', '  col += vec3(1.00,0.80,0.52) * ring * 1.4 * (0.88 + 0.12*sin(t*1.9)*uMotion);', '  float skyMask = 1.0 - smoothstep(uHorizon - 0.10, uHorizon, base.y);', '  float lum = dot(col, vec3(0.299,0.587,0.114));', '  float star = smoothstep(0.28, 0.76, lum) * skyMask;', '  vec2 cell = floor(base*vec2(uTexRes.x, uTexRes.y)/2.5);', '  float hs = hash21(cell);', '  float tw = 0.62 + 0.38*sin(t*(1.4 + hs*5.5) + hs*62.0);', '  col += col * star * (tw - 0.62) * 1.6 * uMotion;', '  if (uMotion > 0.5) {', '    float seg = floor(t/9.0);', '    float phm = fract(t/9.0);', '    if (phm < 0.19) {', '      float k = phm/0.19;', '      float r1 = hash21(vec2(seg, 3.7));', '      float r2 = hash21(vec2(seg, 9.1));', '      vec2 a0 = vec2(0.06 + r1*0.72, 0.04 + r2*0.28);', '      vec2 dir = normalize(vec2(0.62 + r2*0.30, 0.34 + r1*0.22));', '      vec2 head = a0 + dir*(k*0.30);', '      vec2 tail = a0 + dir*max(0.0, k-0.20)*0.30;', '      float m = smoothstep(0.0045, 0.0, segDist(base, tail, head)) * sin(k*3.14159);', '      col += vec3(0.85,0.92,1.00) * m * 0.85 * skyAmt;', '    }', '  }', '  vec2 vd = (frag - 0.5);', '  col *= 1.0 - dot(vd, vd)*0.26;', '  gl_FragColor = vec4(col, 1.0);', '}' ].join('\n');
  function Hero(host) {
    var src = host.getAttribute('data-plate');
    if (!src) return;
    var horizon = parseFloat(host.getAttribute('data-horizon'));
    if (!(horizon > 0 && horizon < 1)) horizon = .573;
    var focusY = parseFloat(host.getAttribute('data-focus'));
    if (!(focusY > 0 && focusY < 1)) focusY = .5;
    var fxWide = parseFloat(host.getAttribute('data-focus-x'));
    if (!(fxWide > 0 && fxWide < 1)) fxWide = .5;
    var fxNarrow = parseFloat(host.getAttribute('data-focus-x-narrow'));
    if (!(fxNarrow > 0 && fxNarrow < 1)) fxNarrow = .62;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    var ptr = {
      x: 0,
      y: 0,
      tx: 0,
      ty: 0
    };
    var visible = true, running = false, W = 0, H = 0;
    host.style.backgroundImage = 'url("' + src + '")';
    host.style.backgroundSize = 'cover';
    host.style.backgroundPosition = 'center';
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
      gl.shaderSource(sh, s);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        if (window.KD_HERO_DEBUG) console.warn(gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }
    function initGL() {
      try {
        gl = glCanvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          depth: false,
          powerPreference: 'low-power',
          preserveDrawingBuffer: true
        }) || glCanvas.getContext('experimental-webgl');
      } catch (e) {
        gl = null;
      }
      if (!gl) return false;
      var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) {
        gl = null;
        return false;
      }
      prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        gl = null;
        return false;
      }
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1, -1, 3, -1, -1, 3 ]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      [ 'uRes', 'uTexRes', 'uTime', 'uHorizon', 'uMotion', 'uZoom', 'uOrigin', 'uTex' ].forEach(function(n) {
        U[n] = gl.getUniformLocation(prog, n);
      });
      glCanvas.addEventListener('webglcontextlost', function(e) {
        e.preventDefault();
        gl = null;
        running = false;
      });
      return true;
    }
    function upload(img) {
      texW = img.naturalWidth || img.width;
      texH = img.naturalHeight || img.height;
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(U.uTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      ready = true;
      host.classList.add('kd-has-plate');
    }
    var view = {
      zoom: 1,
      ox: .5,
      oy: .5,
      fx: 1,
      fy: 1
    };
    function updateView(t) {
      var ca = W / Math.max(1, H), ta = texW / Math.max(1, texH);
      view.fx = ca > ta ? 1 : ca / ta;
      view.fy = ca > ta ? ta / ca : 1;
      var m = reduced ? 0 : 1;
      view.zoom = .985 - .03 * (.5 + .5 * Math.sin(t * .055)) * m;
      var r = W / Math.max(1, H);
      var k = Math.max(0, Math.min(1, (1.55 - r) / .75));
      var fx = fxWide + (fxNarrow - fxWide) * k;
      view.ox = fx + ptr.x * .01 * m;
      view.oy = focusY + ptr.y * .006 * m + Math.sin(t * .33) * .0016 * m;
    }
    function px(bx, by) {
      return {
        x: ((bx - view.ox) / (view.fx * view.zoom) + .5) * W,
        y: ((by - view.oy) / (view.fy * view.zoom) + .5) * H
      };
    }
    function pw(bw) {
      return bw / (view.fx * view.zoom) * W;
    }
    var spriteBase = host.getAttribute('data-sprite-base');
    if (spriteBase == null) spriteBase = 'assets/';
    var sprites = (window.KD_HERO_SPRITES || DEFAULT_SPRITES).map(function(s) {
      var o = {};
      for (var k in s) o[k] = s[k];
      o.src = spriteBase + s.src;
      o.img = new Image;
      o.loaded = false;
      o.img.onload = function() {
        o.loaded = true;
      };
      o.img.onerror = function() {
        o.loaded = false;
      };
      o.img.src = o.src;
      return o;
    });
    function wrap01(v) {
      return v - Math.floor(v);
    }
    function reflect(img, cx, topY, w, h, t, strength) {
      var slices = 22, sh = h / slices;
      for (var i = 0; i < slices; i++) {
        var f = i / (slices - 1);
        var sy = topY + i * sh;
        var off = Math.sin(t * 1.7 + f * 7 + cx * .02) * w * .018 * (.3 + f);
        ctx.globalAlpha = strength * (1 - f) * (1 - f) * .9;
        ctx.drawImage(img, 0, img.height * (1 - (i + 1) / slices), img.width, img.height / slices, cx - w / 2 + off, sy, w, sh + .7);
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
      var bob = Math.sin(t * .5 + bx * 9) * h * .018;
      var topY = p.y - h + bob;
      if (p.x < -w || p.x > W + w) return;
      ctx.drawImage(s.img, p.x - w / 2, topY, w, h);
      reflect(s.img, p.x, p.y + bob, w, h * .55, t, s.refl == null ? .3 : s.refl);
    }
    var off = document.createElement('canvas');
    var octx = off.getContext ? off.getContext('2d') : null;
    function drawDolphin(s, t) {
      if (!s.loaded || !octx) return;
      var cyc = ((t / s.period + s.off) % 1 + 1) % 1;
      if (cyc > .46) return;
      var u = cyc / .46;
      var rise = Math.sin(u * Math.PI);
      var bx = wrap01(s.x + s.drift * t * (reduced ? 0 : 1));
      var p = px(bx, s.y);
      var w = pw(s.w);
      var h = w * (s.img.height / s.img.width);
      if (w < 10) return;
      var lift = pw(s.lift) * rise;
      var bottom = p.y + h * (1 - rise) - lift;
      var top = bottom - h;
      var cut = p.y - top;
      if (cut <= 2) return;
      var pad = 3;
      var ow = Math.ceil((w + pad * 2) * DPR), oh = Math.ceil((h + pad * 2) * DPR);
      if (off.width !== ow || off.height !== oh) {
        off.width = ow;
        off.height = oh;
      }
      octx.setTransform(DPR, 0, 0, DPR, 0, 0);
      octx.clearRect(0, 0, w + pad * 2, h + pad * 2);
      octx.globalAlpha = 1;
      octx.drawImage(s.img, pad, pad, w, h);
      var cy = cut + pad;
      if (cy < h + pad * 2) {
        var feather = Math.max(2, h * .045);
        var g = octx.createLinearGradient(0, cy - feather, 0, cy + feather * .6);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        octx.globalCompositeOperation = 'destination-out';
        octx.fillStyle = g;
        octx.fillRect(0, cy - feather, w + pad * 2, h + pad * 2 - (cy - feather));
        octx.globalCompositeOperation = 'source-over';
      }
      var arcX = (u - .5) * w * .3;
      var tilt = (.5 - u) * .2;
      ctx.save();
      ctx.translate(p.x + arcX, p.y);
      ctx.rotate(tilt);
      ctx.drawImage(off, -w / 2 - pad, top - p.y - pad, w + pad * 2, h + pad * 2);
      ctx.restore();
      if (rise > .25) {
        ctx.globalAlpha = .18 * rise;
        reflect(s.img, p.x + arcX, p.y, w, h * .28, t, .2);
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
    function resize() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      var q = window.innerWidth < 700 ? .85 : 1;
      var pwx = Math.max(1, Math.round(W * DPR * q));
      var phy = Math.max(1, Math.round(H * DPR * q));
      glCanvas.width = pwx;
      glCanvas.height = phy;
      glCanvas.style.width = '100%';
      glCanvas.style.height = '100%';
      if (gl) {
        gl.viewport(0, 0, pwx, phy);
        gl.uniform2f(U.uRes, pwx, phy);
      }
      fgCanvas.width = Math.round(W * DPR);
      fgCanvas.height = Math.round(H * DPR);
      fgCanvas.style.width = '100%';
      fgCanvas.style.height = '100%';
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
      if (host.isConnected === false) {
        running = false;
        return;
      }
      if (start === null) start = ts;
      var t = (ts - start) / 1e3;
      ptr.x += (ptr.tx - ptr.x) * .04;
      ptr.y += (ptr.ty - ptr.y) * .04;
      updateView(t);
      drawGL(t);
      drawSprites(t);
      window.requestAnimationFrame(frame);
    }
    function play() {
      if (running || reduced) return;
      running = true;
      start = null;
      window.requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
    }
    function still() {
      updateView(4);
      drawGL(4);
      drawSprites(4);
    }
    if (!initGL()) return;
    resize();
    var img = new Image;
    img.decoding = 'async';
    img.onload = function() {
      try {
        upload(img);
      } catch (e) {
        return;
      }
      resize();
      if (reduced) {
        still();
        return;
      }
      play();
    };
    img.onerror = function() {};
    img.src = src;
    var rt;
    window.addEventListener('resize', function() {
      clearTimeout(rt);
      rt = setTimeout(function() {
        resize();
        if (reduced) still();
      }, 140);
    }, {
      passive: true
    });
    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      window.addEventListener('mousemove', function(e) {
        ptr.tx = e.clientX / window.innerWidth * 2 - 1;
        ptr.ty = e.clientY / window.innerHeight * 2 - 1;
      }, {
        passive: true
      });
    }
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) pause(); else if (visible && ready) play();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(en) {
        visible = en[0].isIntersecting;
        if (visible && !document.hidden && ready) play(); else pause();
      }, {
        threshold: 0
      }).observe(host);
    }
  }
  var DEFAULTS = {
    plate: 'hero-base.jpg',
    horizon: '0.574',
    focus: '0.5',
    spriteBase: ''
  };
  var live = 0;
  function scan() {
    var i, els = document.querySelectorAll('[data-plate]');
    for (i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-kd-hero-on')) continue;
      els[i].setAttribute('data-kd-hero-on', '1');
      live++;
      try {
        Hero(els[i]);
      } catch (e) {
        if (window.KD_HERO_DEBUG) console.error(e);
      }
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
    new MutationObserver(function() {
      clearTimeout(t);
      t = setTimeout(scan, 120);
    }).observe(document.getElementById('app') || document.body, {
      childList: true,
      subtree: true
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
