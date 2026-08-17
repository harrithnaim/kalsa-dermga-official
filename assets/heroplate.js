/* =====================================================================
   KALSA DERMAGA — HERO PLATE
   =====================================================================
   Takes ONE still image and brings it to life.

   Why this and not the procedural scene it replaces: a hand-written
   shader has to invent every photon, and it will not reach the quality
   of a good rendered still inside any sensible amount of work. A plate
   starts photoreal and only has to be *moved*. That is how the animated
   headers you see around are actually made, and it is the right trade.

   What moves, all of it derived from the plate itself — no masks, no
   extra layers, no video file:

     water     the region below the horizon is resampled through a
               travelling ripple whose amplitude grows toward the viewer,
               so the reflection wobbles the way a real one does, plus a
               moving specular glint on the ripple crests.
     sky       stars are found by luminance and twinkle independently,
               and the whole sky drifts a fraction of a pixel per second.
     lights    bright pixels get a soft pulsing bloom, sampled from a
               ring of taps, which is what makes deck lights read as
               lights rather than as yellow dots.
     camera    a slow push-in that reverses, plus pointer parallax.

   CONFIGURE on the host element:
     data-plate="assets/hero-ocean.jpg"   the image (required)
     data-horizon="0.78"                  where the water starts, as a
                                          fraction of image height from
                                          the top. Get this wrong and the
                                          ripple eats the sky or the sea
                                          sits still — it is the one
                                          number worth checking by eye.

   DEGRADES: if WebGL is missing or the image fails to load, the plate is
   set as a plain CSS background and simply does not move. Reduced motion
   draws a single frame. Offscreen or hidden tab stops the loop.

   TO REMOVE: delete the script tag.
   ===================================================================== */
(function () {
  'use strict';

  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos,0.0,1.0); }';

  var FRAG = [
    'precision mediump float;',
    'uniform sampler2D uTex;',
    'uniform vec2  uRes;',
    'uniform vec2  uTexRes;',
    'uniform float uTime;',
    'uniform vec2  uPtr;',
    'uniform float uHorizon;',
    'uniform float uMotion;',        // 0 = a still frame, 1 = full motion

    'float hash21(vec2 p){',
    '  p = fract(p*vec2(123.34,456.21));',
    '  p += dot(p,p+45.32);',
    '  return fract(p.x*p.y);',
    '}',

    'void main(){',
    '  vec2 frag = gl_FragCoord.xy/uRes;',
    '  vec2 uv = vec2(frag.x, 1.0 - frag.y);',        // y down, image space
    '  float t = uTime;',

    /* ---- cover fit: fill the box, crop the overflow, never squash ---- */
    '  float ca = uRes.x/uRes.y;',
    '  float ta = uTexRes.x/uTexRes.y;',
    '  vec2 f = (ca > ta) ? vec2(1.0, ta/ca) : vec2(ca/ta, 1.0);',

    /* ---- slow push-in that reverses, plus pointer parallax ---- */
        /* Always at least a 1.5% inset. At zoom exactly 1.0 the ripple can
       push a sample past the edge of the plate, and CLAMP_TO_EDGE then
       smears the last row of pixels into visible steps along the bottom. */
    '  float zoom = 0.985 - 0.030*(0.5 + 0.5*sin(t*0.055))*uMotion;',
    '  vec2 par = uPtr * vec2(0.010, 0.006) * uMotion;',
    '  vec2 base = (uv - 0.5)*f*zoom + 0.5 + par;',

    /* ---- how far below the horizon we are, 0 at the line, 1 at the bottom ---- */
    '  float depth = clamp((base.y - uHorizon)/max(0.001, 1.0 - uHorizon), 0.0, 1.0);',
    '  float isWater = smoothstep(0.0, 0.045, base.y - uHorizon);',

    /* ---- the ripple ----
       Wavelength stretches and amplitude grows toward the viewer, which
       is the whole reason this reads as perspective rather than as a
       uniform wobble laid over the bottom of a picture. */
    '  float freq = mix(190.0, 21.0, depth*depth);',
    '  float ph = base.y*freq + base.x*freq*0.30;',
    '  float d1 = sin(ph - t*1.55);',
    '  float d2 = sin(ph*0.51 + t*1.05 + base.x*11.0);',
    '  float d3 = sin(ph*1.90 - t*2.30 + base.x*4.0);',
    '  float disp = (d1*0.55 + d2*0.32 + d3*0.13);',
    '  float amp = (0.00035 + depth*depth*0.0115) * isWater * uMotion;',
    '  vec2 suv = base + vec2(disp*amp*0.42, disp*amp);',

    /* Sampling the sky through the water displacement would smear the
       horizon line, so the shift is only applied below it. */
    '  vec2 texUV = mix(base, suv, isWater);',
    '  texUV = clamp(texUV, vec2(0.0005), vec2(0.9995));',
    '  vec3 col = texture2D(uTex, texUV).rgb;',

    /* ---- glint riding the ripple crests ---- */
    '  float crest = pow(max(0.0, d1*0.6 + d2*0.4), 9.0);',
    '  col += vec3(0.55,0.70,0.95) * crest * depth * 0.085 * isWater * uMotion;',

    /* ---- bloom around anything bright ----
       Six taps on a small ring. A single-pixel test cannot tell a lamp
       from a bright wave, and without the spread the ship's lights stay
       flat yellow dots instead of glowing. */
    '  float ring = 0.0;',
    '  for (int i = 0; i < 6; i++) {',
    '    float a = float(i)*1.0472;',
    '    vec2 o = vec2(cos(a), sin(a)) * 0.0055;',
    '    vec3 sc = texture2D(uTex, clamp(texUV + o, vec2(0.0005), vec2(0.9995))).rgb;',
    '    ring += max(0.0, dot(sc, vec3(0.299,0.587,0.114)) - 0.62);',
    '  }',
    '  ring /= 6.0;',
    '  float pulse = 0.86 + 0.14*sin(t*1.9)*uMotion;',
    '  col += vec3(1.00,0.80,0.52) * ring * 1.5 * pulse;',

    /* ---- star twinkle ----
       Found by luminance in the sky half, then given a per-cell phase so
       they scintillate independently rather than blinking in unison. */
    '  float skyMask = 1.0 - smoothstep(uHorizon - 0.10, uHorizon, base.y);',
    '  float lum = dot(col, vec3(0.299,0.587,0.114));',
    '  float star = smoothstep(0.30, 0.78, lum) * skyMask;',
    '  vec2 cell = floor(base*vec2(uTexRes.x, uTexRes.y)/2.5);',
    '  float hs = hash21(cell);',
    '  float tw = 0.62 + 0.38*sin(t*(1.4 + hs*5.5) + hs*62.0);',
    '  col += col * star * (tw - 0.62) * 1.5 * uMotion;',

    /* ---- a light vignette so the crops at the edges stay quiet ---- */
    '  vec2 vd = (frag - 0.5);',
    '  col *= 1.0 - dot(vd, vd)*0.28;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function Plate(host) {
    var src = host.getAttribute('data-plate');
    if (!src) return;

    var horizon = parseFloat(host.getAttribute('data-horizon'));
    if (!(horizon > 0 && horizon < 1)) horizon = 0.78;

    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var visible = true, running = false, W = 0, H = 0;

    // Static fallback first, so the picture is there even if everything
    // below fails. It costs nothing and it is never wrong.
    host.style.backgroundImage = 'url("' + src + '")';
    host.style.backgroundSize = 'cover';
    host.style.backgroundPosition = 'center';

    var canvas = document.getElementById('heroWaves') ||
                 document.querySelector('.hero-canvas canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'kd-sea';
      canvas.setAttribute('aria-hidden', 'true');
      host.insertBefore(canvas, host.firstChild);
    }
    // the old scene used a second canvas for ships and dolphins; the
    // plate needs only one, so make sure a leftover cannot cover it
    var extra = document.getElementById('heroNodes');
    if (extra && extra.parentNode) extra.parentNode.removeChild(extra);

    var gl = null, prog, uRes, uTexRes, uTime, uPtr, uHorizon, uMotion, tex;
    var texW = 1, texH = 1, ready = false;

    function compile(type, srcStr) {
      var s = gl.createShader(type);
      gl.shaderSource(s, srcStr); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (window.KD_PLATE_DEBUG) console.warn(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    function initGL() {
      try {
        gl = canvas.getContext('webgl', {
          alpha: false, antialias: false, depth: false,
          powerPreference: 'low-power',
          // one draw is otherwise wiped on the next composite
          preserveDrawingBuffer: true
        }) || canvas.getContext('experimental-webgl');
      } catch (e) { gl = null; }
      if (!gl) return false;

      var vs = compile(gl.VERTEX_SHADER, VERT);
      var fs = compile(gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { gl = null; return false; }
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { gl = null; return false; }
      gl.useProgram(prog);

      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      uRes     = gl.getUniformLocation(prog, 'uRes');
      uTexRes  = gl.getUniformLocation(prog, 'uTexRes');
      uTime    = gl.getUniformLocation(prog, 'uTime');
      uPtr     = gl.getUniformLocation(prog, 'uPtr');
      uHorizon = gl.getUniformLocation(prog, 'uHorizon');
      uMotion  = gl.getUniformLocation(prog, 'uMotion');

      canvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault(); gl = null; running = false;
      });
      return true;
    }

    function upload(img) {
      texW = img.naturalWidth || img.width;
      texH = img.naturalHeight || img.height;
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      // CLAMP + LINEAR, no mipmaps: a photo is almost never a power of
      // two, and REPEAT or mipmapping on a non-power-of-two texture is
      // an incomplete-texture error in WebGL 1 and renders solid black.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
      gl.activeTexture(gl.TEXTURE0);
      ready = true;
      host.classList.add('kd-has-plate');
    }

    function resize() {
      var r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      var q = window.innerWidth < 700 ? 0.85 : 1;
      var pw = Math.max(1, Math.round(W * DPR * q));
      var ph = Math.max(1, Math.round(H * DPR * q));
      canvas.width = pw; canvas.height = ph;
      canvas.style.width = '100%'; canvas.style.height = '100%';
      if (gl) { gl.viewport(0, 0, pw, ph); gl.uniform2f(uRes, pw, ph); }
    }

    function draw(t) {
      if (!gl || !ready) return;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uPtr, pointer.x, pointer.y);
      gl.uniform2f(uTexRes, texW, texH);
      gl.uniform1f(uHorizon, horizon);
      gl.uniform1f(uMotion, reduced ? 0 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var start = null;
    function frame(ts) {
      if (!running) return;
      if (host.isConnected === false) { running = false; return; }
      if (start === null) start = ts;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      draw((ts - start) / 1000);
      window.requestAnimationFrame(frame);
    }
    function play() { if (running || reduced) return; running = true; start = null;
                      window.requestAnimationFrame(frame); }
    function pause() { running = false; }

    if (!initGL()) return;          // static background already applied
    resize();

    var img = new Image();
    img.decoding = 'async';
    img.onload = function () {
      try { upload(img); } catch (e) { return; }
      resize();
      if (reduced) { draw(3.0); return; }
      play();
    };
    img.onerror = function () { /* the CSS background stands in */ };
    img.src = src;

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { resize(); if (reduced) draw(3.0); }, 140);
    }, { passive: true });

    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      window.addEventListener('mousemove', function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
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

  /* The website marks its host in the HTML. The super app cannot: it
     renders its landing screen from JavaScript after load, so there is
     nothing to mark up front and a one-shot query finds nothing. Adopt
     any film card that appears, give it the default plate, and rescan on
     DOM changes. */
  var DEFAULT_PLATE = 'hero-ocean.jpg';
  var DEFAULT_HORIZON = '0.435';

  function adopt(el) {
    if (el.getAttribute('data-plate')) return;
    el.setAttribute('data-plate', DEFAULT_PLATE);
    if (!el.getAttribute('data-horizon')) el.setAttribute('data-horizon', DEFAULT_HORIZON);
  }

  var started = 0;
  function scan() {
    var i, els;
    els = document.querySelectorAll('[data-plate]');
    for (i = 0; i < els.length; i++) {
      if (els[i].getAttribute('data-kd-plate-on')) continue;
      els[i].setAttribute('data-kd-plate-on', '1');
      started++;
      try { Plate(els[i]); }
      catch (e) { if (window.KD_PLATE_DEBUG) console.error(e); }
    }
    if (started) return;
    els = document.querySelectorAll('.land-top .land-film, .land-film, .filmcard');
    for (i = 0; i < els.length && i < 2; i++) adopt(els[i]);
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
