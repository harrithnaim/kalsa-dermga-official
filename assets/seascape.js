/* =====================================================================
   KALSA DERMAGA — SEASCAPE
   =====================================================================
   One scene, two layers, no libraries.

     Layer 1 (WebGL)  sky and sea in a single fragment shader. The sea is
                      ray-cast per pixel against a wave field, so the
                      horizon and the perspective are real geometry. The
                      sky above it is the same ray, pointed up: gradient,
                      sun, moon, stars, drifting cloud. The water then
                      REFLECTS that sky through a Fresnel term, which is
                      why the two halves belong to each other rather than
                      just being stacked.

     Layer 2 (2D)     the life. Vessels on the horizon, a pod of dolphins
                      that leaps, a whale that surfaces and blows, gulls.
                      Placed in world coordinates and projected with the
                      same camera the shader uses, so a hull sits ON the
                      waterline instead of near it.

   Degrades in three steps, and I have rendered all three:
     - no WebGL      -> layer 1 never draws, layer 2 and the CSS gradient
                        still do. You keep the vessels and the wildlife.
     - reduced motion-> one still frame of both layers. Nothing animates.
     - offscreen or
       hidden tab    -> the loop stops entirely.

   TO REMOVE: delete the script tag. Nothing else depends on it.
   ===================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------
     CAMERA — shared by the shader and the 2D layer
     ------------------------------------------------------------------
     The eye is EYE metres above the water looking slightly down. A ray
     for pixel uv (origin at centre, divided by height) is

         rd = normalize(vec3(uv.x*FX, uv.y*FY + PITCH, 1))

     so the horizon (rd.y = 0) sits at uv.y = -PITCH/FY, and a world
     point (X, h, Z) inverts to

         uv.x = X / (Z*FX)
         uv.y = ((h - EYE)/Z - PITCH) / FY

     project() below is exactly that. Because both layers use it, a ship
     placed at Z=140 lands on the shader's horizon and not above it.

     EYE is 5 m — the view from a deck or a jetty, not from a dinghy. It
     matters more than it sounds: at a 1 m eye height a leaping dolphin
     rises ABOVE the horizon line, which is geometrically true and looks
     completely wrong. The shader's ray origin must match this exactly or
     the two layers drift apart. */
  var EYE = 5.0, FX = 1.15, FY = 0.95, PITCH = -0.115;

  /* ==================================================================
     SHADER
     ================================================================== */
  var VERT =
    'attribute vec2 aPos;' +
    'void main(){ gl_Position = vec4(aPos,0.0,1.0); }';

  var FRAG = [
    'precision mediump float;',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uPtr;',
    'uniform float uFY;',
    'uniform float uPitch;',

    /* ---------- small noise kit ---------- */
    'float hash21(vec2 p){',
    '  p = fract(p*vec2(123.34,456.21));',
    '  p += dot(p,p+45.32);',
    '  return fract(p.x*p.y);',
    '}',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i);',
    '  float b = hash21(i+vec2(1.0,0.0));',
    '  float c = hash21(i+vec2(0.0,1.0));',
    '  float d = hash21(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);',
    '}',
    'float fbm(vec2 p){',
    '  float s = 0.0, a = 0.5;',
    '  for(int i=0;i<4;i++){ s += a*vnoise(p); p *= 2.03; a *= 0.5; }',
    '  return s;',
    '}',

    /* ---------- where the sun and moon are -----------------------------
       Dusk. The sun is just above the horizon on the left; the moon has
       already risen on the right and crosses over roughly two minutes,
       which is slow enough to feel like sky and fast enough that you can
       see it move while you read the page. */
    'vec3 sunDir(float t){',
    '  float a = -0.62 + sin(t*0.017)*0.05;',        // lateral drift
    '  float y =  0.055 + sin(t*0.011)*0.012;',      // sits low, breathes
    '  return normalize(vec3(a, y, 1.0));',
    '}',
    'vec3 moonDir(float t){',
    '  float a = 0.95 - mod(t*0.0075, 2.2);',        // crosses the sky
    '  return normalize(vec3(a, 0.42 + sin(t*0.006)*0.05, 0.75));',
    '}',

    /* ---------- sky ----------------------------------------------------
       full=1 adds stars and the second cloud layer. The water's
       reflection calls this with full=0, because paying for stars twice
       per pixel is not worth what it buys at 18% Fresnel. */
    'vec3 sky(vec3 rd, float t, float full){',
    '  float up = clamp(rd.y, -0.02, 1.0);',

    // vertical gradient: deep indigo overhead into a warm band at the sea
    '  vec3 zenith = vec3(0.035,0.075,0.165);',
    '  vec3 mid    = vec3(0.075,0.230,0.330);',
    '  vec3 low    = vec3(0.480,0.420,0.360);',
    '  vec3 col = mix(mid, zenith, clamp(up*2.1,0.0,1.0));',
    '  col = mix(col, low, pow(1.0 - clamp(up*5.5,0.0,1.0), 2.2));',

    // stars, thinning towards the horizon and washed out by the sun
    /* Stars are laid out in SCREEN space (rd.xy/rd.z), not on a horizon
       projection. rd.xz/(rd.y+k) stretches without bound as the ray
       drops toward the horizon, so one unlucky grid cell down there
       inflated into an enormous soft ellipse hanging over the sea. I
       spent two rounds blaming that shape on the moon and then on the
       cloud clamp before measuring it. Screen space keeps every cell the
       same size, so a star is a star. */
    '  if (full > 0.5 && rd.z > 0.05) {',
    '    vec2 sp = vec2(rd.x/rd.z, rd.y/rd.z) * 22.0;',
    '    vec2 gi = floor(sp);',
    '    float h = hash21(gi);',
    '    if (h > 0.955) {',
    '      vec2 c = gi + 0.5 + (vec2(hash21(gi+7.1), hash21(gi+3.3)) - 0.5)*0.7;',
    '      float d = length(sp - c);',
    '      float tw = 0.55 + 0.45*sin(t*(1.4 + h*5.0) + h*40.0);',
    '      float s = smoothstep(0.22, 0.0, d) * tw;',
    '      col += vec3(0.85,0.92,1.0) * s * smoothstep(0.03,0.42,rd.y) * 0.95;',
    '    }',
    '  }',

    // the sun: a soft disc with a wide warm halo
    '  vec3 sd = sunDir(t);',
    '  float sdot = max(dot(rd, sd), 0.0);',
    '  col += vec3(1.00,0.62,0.34) * pow(sdot, 180.0) * 1.5;',
    '  col += vec3(0.95,0.55,0.30) * pow(sdot,  14.0) * 0.42;',
    '  col += vec3(0.55,0.42,0.34) * pow(sdot,   3.2) * 0.16;',

    /* the moon.
       Measured in SCREEN space, not angular distance. A disc that is
       round in direction space is not round on screen: the ray uses
       x*1.15 and y*0.95, so the same angle covers 21% more uv vertically
       and the moon came out as a tall oval. Undoing the two scales puts
       it back to a circle. (pow(dot) was worse still — at mediump there
       are no bits left that close to 1.0, and it banded into a pair of
       ghost columns.) */
    '  float moon = 0.0, halo = 0.0;',
    '  vec3 md = moonDir(t);',
    '  if (rd.z > 0.02 && md.z > 0.02) {',
    '    vec2 mUV = vec2((md.x/md.z)/1.15, (md.y/md.z)/0.95);',
    '    vec2 rUV = vec2((rd.x/rd.z)/1.15, (rd.y/rd.z)/0.95);',
    '    float dm = length(rUV - mUV);',
    // sized for the screen, not for astronomy: the real thing is
    // 0.0045 rad and would land as three grey pixels
    '    float disc = smoothstep(0.052, 0.044, dm);',
    // a bite out of one side so it reads as a phase, not a dot
    '    float bite = smoothstep(0.056, 0.048, length(rUV - mUV - vec2(0.034,0.021)));',
    '    moon = clamp(disc - bite*0.90, 0.0, 1.0);',
    '    halo = smoothstep(0.140, 0.052, dm);',
    '  }',
    '  col += vec3(0.94,0.96,1.00) * moon * 1.9;',
    '  col += vec3(0.55,0.68,0.90) * halo * 0.10;',

    // cloud: a drifting deck, warm-lit underneath from the sun side
    '  float cl = 0.0;',
    '  if (rd.y > 0.004) {',
    /* rd.xz/rd.y is the honest flat-plane projection, but it explodes as
       the ray approaches the horizon. Clamping it — which is what I did
       first — freezes the noise over a whole region and paints a large
       soft OVAL in the sky, which I spent a while blaming on the moon.
       Dividing by (rd.y + 0.25) is bounded everywhere, needs no clamp,
       and still compresses the cloud toward the horizon the way real
       cloud does. */
    '    vec2 cp = rd.xz/(rd.y + 0.25);',
    '    cl = fbm(cp*2.20 + vec2(t*0.010, t*0.004));',
    '    cl = smoothstep(0.50, 0.86, cl);',
    '    if (full > 0.5) {',
    '      float cl2 = fbm(cp*4.40 + vec2(-t*0.017, t*0.007) + 11.0);',
    '      cl = max(cl, smoothstep(0.60, 0.92, cl2)*0.55);',
    '    }',
    '    cl *= smoothstep(0.004, 0.10, rd.y);',
    // In the reflection (full=0) a near-horizontal ray sends rd.xz/rd.y
    // off to the clamp and the cloud field flattens into one huge pale
    // smear on the water. Fading it out at low angles kills that.
    '    if (full < 0.5) cl *= 0.45 * smoothstep(0.02, 0.30, rd.y);',
    '  }',
    '  vec3 cloudCol = mix(vec3(0.13,0.18,0.26), vec3(0.85,0.60,0.42), pow(sdot,2.0));',
    '  col = mix(col, cloudCol, cl*0.62);',

    '  return col;',
    '}',

    /* ---------- sea surface ----------
       Six octaves. An earlier pass used frequencies three to six times
       lower and the result read as a flat teal panel, because the swells
       were effectively hundreds of metres wide. */
    'float wave(vec2 p, float t){',
    '  float h = 0.0;',
    '  h += sin(p.x*1.70 + t*1.10)*0.34;',
    '  h += sin(p.y*1.35 - t*0.85)*0.30;',
    '  h += sin((p.x+p.y)*2.30 + t*1.45)*0.17;',
    '  h += sin((p.x*2.9 - p.y*2.1) - t*1.70)*0.11;',
    '  h += sin((p.x*5.7 + p.y*4.3) + t*2.60)*0.055;',
    '  h += sin((p.x*9.1 - p.y*7.7) - t*3.40)*0.028;',
    '  return h;',
    '}',

    'void main(){',
    '  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/uRes.y;',
    '  vec3 ro = vec3(0.0, 5.0, 0.0);',            // must equal EYE in the JS
    '  vec3 rd = normalize(vec3(uv.x*1.15, uv.y*uFY + uPitch + uPtr.y*0.018, 1.0));',
    '  float t = uTime;',
    '  vec3 sd = sunDir(t);',
    '  vec3 col;',

    /* ---- above the horizon: sky ---- */
    '  if (rd.y > 0.0) {',
    '    col = sky(rd, t, 1.0);',
    // haze thickening into the horizon line so sea and sky meet softly
    '    float hz = 1.0 - smoothstep(0.0, 0.055, rd.y);',
    '    col = mix(col, vec3(0.30,0.34,0.36), hz*0.55);',
    '    gl_FragColor = vec4(col, 1.0);',
    '    return;',
    '  }',

    /* ---- below: the water ---- */
    '  float d = -ro.y/rd.y;',
    '  vec3 pos = ro + rd*d;',
    // 0.25 keeps the apparent wavelength right now that the eye is five
    // times higher; without it the whole sea turns to fine chop
    '  vec2 q = vec2(pos.x, pos.z)*0.25 + vec2(uPtr.x*0.4, t*0.32);',

    '  float e = 0.045;',
    '  float h  = wave(q, t);',
    '  float hx = wave(q + vec2(e,0.0), t);',
    '  float hz2= wave(q + vec2(0.0,e), t);',
    // flatten the normal with distance, or the far field turns to noise
    // more perturbation up close, not less: a flatter near field turned
    // the reflected cloud into big pale blobs on the water
    '  float flat0 = mix(0.150, 0.010, smoothstep(30.0, 430.0, d));',
    '  vec3 n = normalize(vec3(-(hx-h)/e*flat0, 1.0, -(hz2-h)/e*flat0));',

    '  vec3 V = -rd;',
    '  vec3 R = reflect(rd, n);',
    '  R.y = abs(R.y);',                    // never sample below the sea
    '  vec3 refl = sky(R, t, 0.0);',

    // Fresnel: glancing angles at distance mirror the sky, near water is body colour
    '  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.5);',
    '  fres = clamp(0.045 + fres*0.95, 0.0, 1.0);',

    '  vec3 deep = vec3(0.020,0.075,0.130);',
    '  vec3 body = vec3(0.045,0.230,0.290);',
    '  vec3 col2 = mix(deep, body, clamp(0.45 + h*0.55, 0.0, 1.0));',
    '  col = mix(col2, refl, fres);',

    // sun glitter — the broken path of light running toward the viewer
    '  vec3 H = normalize(sd + V);',
    '  float spec = pow(max(dot(n,H),0.0), 90.0);',
    '  float path = smoothstep(0.55, 1.0, 1.0 - abs(uv.x - sd.x*0.62)*1.4);',
    '  col += vec3(1.00,0.72,0.45) * spec * (0.55 + path*2.4);',

    // white water on the steepest crests, only where you could resolve it
    '  float crest = smoothstep(0.30, 0.52, h) * (1.0 - smoothstep(50.0, 230.0, d));',
    '  col = mix(col, vec3(0.72,0.86,0.88), crest*0.20);',

    // distance haze into the horizon, matched to the sky side
    '  float fog = smoothstep(70.0, 720.0, d);',
    '  col = mix(col, vec3(0.30,0.34,0.36), fog*0.86);',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ==================================================================
     ONE INSTANCE
     ================================================================== */
  function Seascape(host, opts) {
    opts = opts || {};
    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var visible = true, running = false;
    var W = 0, H = 0;

    /* ---- canvases: reuse the page's if it has them, else make them ---- */
    // The shader writes alpha 1.0, so it is opaque. The life layer must
    // therefore sit AFTER it in the DOM — an earlier version inserted
    // both at the front, which put every ship and dolphin behind an
    // opaque sea and looked exactly like the 2D layer was broken.
    var made = [];
    function grab(id, cls) {
      var c = id && document.getElementById(id);
      if (!c) {
        c = document.createElement('canvas');
        if (cls) c.className = cls;
        c.setAttribute('aria-hidden', 'true');
        made.push(c);
      }
      return c;
    }
    var glCanvas = grab(opts.glId, opts.canvasClass);
    var fgCanvas = grab(opts.fgId, opts.canvasClass);
    for (var mi = made.length - 1; mi >= 0; mi--) {
      host.insertBefore(made[mi], host.firstChild);   // gl first, life above it
    }
    var ctx = fgCanvas.getContext ? fgCanvas.getContext('2d') : null;

    /* ---- GL ---- */
    var gl = null, uRes, uTime, uPtr, uFY, uPitch;

    function compile(g, type, src) {
      var s = g.createShader(type);
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) {
        if (window.KD_SEASCAPE_DEBUG) console.warn(g.getShaderInfoLog(s));
        g.deleteShader(s); return null;
      }
      return s;
    }

    function initGL() {
      try {
        gl = glCanvas.getContext('webgl', {
          alpha: true, antialias: false, depth: false,
          premultipliedAlpha: true, powerPreference: 'low-power',
          // a single draw is wiped on the next composite without this,
          // which is what made an earlier version render blank
          preserveDrawingBuffer: true
        }) || glCanvas.getContext('experimental-webgl');
      } catch (e) { gl = null; }
      if (!gl) return false;

      var vs = compile(gl, gl.VERTEX_SHADER, VERT);
      var fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) { gl = null; return false; }

      var prog = gl.createProgram();
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

      uRes   = gl.getUniformLocation(prog, 'uRes');
      uTime  = gl.getUniformLocation(prog, 'uTime');
      uPtr   = gl.getUniformLocation(prog, 'uPtr');
      uFY    = gl.getUniformLocation(prog, 'uFY');
      uPitch = gl.getUniformLocation(prog, 'uPitch');

      glCanvas.addEventListener('webglcontextlost', function (e) {
        e.preventDefault(); gl = null;
      });
      glCanvas.addEventListener('webglcontextrestored', function () {
        if (initGL()) { resize(); }
      });
      host.classList.add('kd-has-sea');
      return true;
    }

    /* ---- projection, shared with the shader ---- */
    function project(X, height, Z) {
      if (Z < 0.6) Z = 0.6;
      var uvx = X / (Z * FX);
      var uvy = ((height - EYE) / Z - PITCH) / FY;
      return { x: W * 0.5 + uvx * H, y: H * 0.5 - uvy * H };
    }
    // pixels per world metre at distance Z
    function scaleAt(Z) { return H / (Z * FY); }
    function horizonY() { return H * 0.5 + (PITCH / FY) * H; }

    /* ==============================================================
       THE LIFE — vessels, dolphins, a whale, gulls
       ============================================================== */

    // Deterministic pseudo-random so the scene is identical on every
    // load and on every device. Nothing here uses Math.random.
    function rnd(i) { var s = Math.sin(i * 127.1) * 43758.5453; return s - Math.floor(s); }

    /* Wrap a world X so the object re-enters from the far side just past
       the edge of view. The span HAS to scale with distance: a fixed one
       kept the dolphins — which are close, so a metre is a lot of pixels
       — off screen for most of their cycle while the ships barely moved. */
    function wrapX(x, Z) {
      var span = Z * FX * 2.9;
      return ((x + span * 0.5) % span + span) % span - span * 0.5;
    }

    var VESSELS = [
      { z: 165, x: -150, spd:  1.55, len: 30, type: 'container' },
      { z: 112, x:  180, spd: -1.05, len: 20, type: 'coaster'   },
      { z: 235, x:   40, spd:  0.85, len: 34, type: 'container' },
      { z:  74, x: -120, spd:  0.62, len:  7, type: 'boat'      }
    ];

    function drawVessel(v, t) {
      var Z = v.z;
      var X = wrapX(v.x + v.spd * t, Z);
      var s = scaleAt(Z);
      var base = project(X, 0, Z);
      if (base.x < -260 || base.x > W + 260) return;

      // ride the swell, slower and shallower the further out
      var bob = Math.sin(t * 0.62 + v.z) * 0.10 + Math.sin(t * 0.37 + v.x) * 0.06;
      var roll = Math.sin(t * 0.44 + v.z * 0.5) * 0.012;
      var y = base.y + bob * s * 0.5;

      var L = v.len * s;            // hull length in pixels
      if (L < 2.2) return;
      var hull = Math.max(1, L * 0.085);

      // Atmospheric perspective, done as HAZE and not as transparency.
      // Fading the alpha made the ships look like ghosts with the sea
      // showing through them; a distant ship is not see-through, it is
      // the same solid shape shifted toward the colour of the air. The
      // target here is the exact fog colour the shader mixes toward.
      var fogAmt = Math.max(0, Math.min(0.62, (Z - 40) / 300));
      var ink = 'rgb(' +
        Math.round(10 + (77 - 10) * fogAmt) + ',' +
        Math.round(26 + (87 - 26) * fogAmt) + ',' +
        Math.round(38 + (92 - 38) * fogAmt) + ')';

      ctx.save();
      ctx.translate(base.x, y);
      ctx.rotate(roll);
      ctx.globalAlpha = 1;
      ctx.fillStyle = ink;

      // hull
      ctx.beginPath();
      ctx.moveTo(-L / 2, 0);
      ctx.lineTo(L / 2, 0);
      ctx.lineTo(L * 0.42, -hull);
      ctx.lineTo(-L * 0.46, -hull);
      ctx.closePath();
      ctx.fill();

      if (v.type === 'container') {
        // stacked boxes amidships, bridge aft
        var bw = L * 0.60, bh = hull * 1.5;
        ctx.fillRect(-bw * 0.55, -hull - bh, bw, bh);
        ctx.fillRect(L * 0.16, -hull - bh * 2.0, L * 0.16, bh * 2.0);
        ctx.fillRect(L * 0.20, -hull - bh * 2.7, L * 0.045, bh * 0.7);   // funnel
      } else if (v.type === 'coaster') {
        ctx.fillRect(L * 0.05, -hull - hull * 1.9, L * 0.26, hull * 1.9);
        ctx.fillRect(-L * 0.40, -hull - hull * 2.6, Math.max(1, L * 0.02), hull * 2.6);
      } else {
        // small local boat: cabin and a mast
        ctx.fillRect(-L * 0.10, -hull - hull * 1.6, L * 0.30, hull * 1.6);
        ctx.fillRect(-L * 0.02, -hull - hull * 4.0, Math.max(1, L * 0.035), hull * 4.0);
      }
      ctx.restore();

      // reflection: flipped, faded, and wobbling with the swell
      if (L > 6) {
        ctx.save();
        ctx.translate(base.x, y);
        ctx.scale(1, -1);
        ctx.globalAlpha = (0.22 - fogAmt * 0.16) * (0.75 + 0.25 * Math.sin(t * 1.7 + Z));
        ctx.fillStyle = 'rgba(8,22,34,0.85)';
        ctx.beginPath();
        ctx.moveTo(-L / 2, 0); ctx.lineTo(L / 2, 0);
        ctx.lineTo(L * 0.34, -hull * 2.4); ctx.lineTo(-L * 0.38, -hull * 2.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    /* ---- dolphins ----
       Each animal runs a cycle: swim submerged, then one leap. The leap
       is a parabola in world space; the body is drawn rotated to the
       tangent of that parabola, which is what stops it looking like a
       sticker sliding through the air. */
    var POD = [
      { z: 20, x0: -16, spd: 3.3, period: 7.4, off: 0.0,  h: 1.55, sc: 1.00 },
      { z: 24, x0: -21, spd: 3.3, period: 7.4, off: 0.55, h: 1.30, sc: 0.88 },
      { z: 17, x0: -12, spd: 3.3, period: 7.4, off: 1.05, h: 1.15, sc: 0.80 }
    ];

    function drawDolphin(dp, t) {
      var Z = dp.z + Math.sin(t * 0.3 + dp.off) * 1.5;
      var X = wrapX(dp.x0 + dp.spd * t, Z);

      var cyc = ((t + dp.off * dp.period) % dp.period) / dp.period;
      var AIR = 0.30;                      // fraction of the cycle in the air
      var s = scaleAt(Z) * dp.sc;
      var L = 2.0 * s;                     // body length, ~2 m
      if (L < 3) return;

      if (cyc > AIR) {
        // submerged — a travelling swell mark and an occasional dorsal
        var sub = (cyc - AIR) / (1 - AIR);
        var pw = project(X, 0, Z);
        ctx.save();
        ctx.globalAlpha = 0.16 * (1 - sub);
        ctx.fillStyle = 'rgba(220,245,250,1)';
        ctx.beginPath();
        ctx.ellipse(pw.x, pw.y, L * 0.55, L * 0.10, 0, 0, 6.2832);
        ctx.fill();
        ctx.restore();
        return;
      }

      var u = cyc / AIR;                   // 0..1 through the arc
      var height = dp.h * 4 * u * (1 - u); // parabola, peaks at u=0.5
      var p = project(X, height, Z);

      // tangent: sample the parabola slightly ahead
      var u2 = Math.min(1, u + 0.02);
      var p2 = project(X + dp.spd * 0.02 * dp.period * AIR, dp.h * 4 * u2 * (1 - u2), Z);
      var ang = Math.atan2(p2.y - p.y, p2.x - p.x);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.92;

      // Countershaded, and dark enough to read against a sunlit sea.
      // An earlier pass ran 40->150 and the animals looked like paper
      // cut-outs floating over the water rather than coming out of it.
      var g = ctx.createLinearGradient(0, -L * 0.18, 0, L * 0.18);
      g.addColorStop(0.00, 'rgba(18,34,48,1)');
      g.addColorStop(0.55, 'rgba(46,74,94,1)');
      g.addColorStop(1.00, 'rgba(124,152,166,1)');
      ctx.fillStyle = g;
      ctx.strokeStyle = 'rgba(12,24,36,0.55)';
      ctx.lineWidth = Math.max(0.6, L * 0.012);

      // body: a fusiform curve, nose right
      ctx.beginPath();
      ctx.moveTo(L * 0.50, 0);
      ctx.quadraticCurveTo(L * 0.10, -L * 0.19, -L * 0.34, -L * 0.09);
      ctx.quadraticCurveTo(-L * 0.44, -L * 0.05, -L * 0.50, -L * 0.20);  // fluke up
      ctx.lineTo(-L * 0.40, L * 0.02);
      ctx.lineTo(-L * 0.50, L * 0.16);
      ctx.quadraticCurveTo(-L * 0.36, L * 0.10, -L * 0.20, L * 0.11);
      ctx.quadraticCurveTo(L * 0.14, L * 0.14, L * 0.50, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // dorsal fin
      ctx.beginPath();
      ctx.moveTo(L * 0.02, -L * 0.15);
      ctx.quadraticCurveTo(-L * 0.06, -L * 0.34, -L * 0.14, -L * 0.13);
      ctx.closePath();
      ctx.fill();

      // pectoral
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(L * 0.16, L * 0.06);
      ctx.quadraticCurveTo(L * 0.04, L * 0.24, -L * 0.04, L * 0.10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // splash at entry and exit
      var edge = Math.min(u, 1 - u);
      if (edge < 0.16) {
        var pw2 = project(X, 0, Z);
        var k = 1 - edge / 0.16;
        ctx.save();
        ctx.globalAlpha = 0.42 * k;
        ctx.fillStyle = 'rgba(226,248,252,1)';
        for (var i = 0; i < 6; i++) {
          var a = -0.35 - i * 0.18 - rnd(i + dp.off) * 0.3;
          var r = L * (0.30 + rnd(i * 3.1) * 0.55) * k;
          ctx.beginPath();
          ctx.arc(pw2.x + Math.cos(a) * r * 1.4, pw2.y + Math.sin(a) * r * 0.55,
                  Math.max(0.6, L * 0.05 * (1 - i * 0.1)), 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    /* ---- the whale ----
       Much further out and much rarer: a long cycle where the back rolls
       through the surface, blows, and shows the fluke going down. */
    var WHALE = { z: 55, x0: 30, spd: -1.15, period: 26 };

    function drawWhale(t) {
      var Z = WHALE.z;
      var X = wrapX(WHALE.x0 + WHALE.spd * t, Z);
      var s = scaleAt(Z);
      var L = 14 * s;                          // a 14 m animal
      if (L < 6) return;

      var cyc = (t % WHALE.period) / WHALE.period;
      if (cyc > 0.42) return;                  // down, out of sight
      var u = cyc / 0.42;
      var out = Math.sin(u * Math.PI);         // rises, holds, falls
      var p = project(X, 0, Z);

      ctx.save();
      ctx.fillStyle = 'rgba(24,42,56,0.92)';

      /* The back. Kept deliberately low — 0.13 of body length, not the
         0.30 I first used. A rolling whale shows a long shallow curve;
         a tall hump reads as a rock. */
      ctx.beginPath();
      ctx.moveTo(p.x - L * 0.46, p.y);
      ctx.quadraticCurveTo(p.x - L * 0.05, p.y - L * 0.13 * out,
                           p.x + L * 0.42, p.y);
      ctx.closePath();
      ctx.fill();

      if (out > 0.5) {                          // dorsal, once well clear
        ctx.beginPath();
        ctx.moveTo(p.x + L * 0.16, p.y - L * 0.085 * out);
        ctx.quadraticCurveTo(p.x + L * 0.07, p.y - L * 0.20 * out,
                             p.x + L * 0.03, p.y - L * 0.075 * out);
        ctx.closePath();
        ctx.fill();
      }

      if (u > 0.82) {                           // fluke on the way down
        var fk = (u - 0.82) / 0.18;
        ctx.beginPath();
        ctx.moveTo(p.x - L * 0.44, p.y);
        ctx.quadraticCurveTo(p.x - L * 0.54, p.y - L * 0.22 * fk,
                             p.x - L * 0.66, p.y - L * 0.26 * fk);
        ctx.quadraticCurveTo(p.x - L * 0.50, p.y - L * 0.11 * fk,
                             p.x - L * 0.44, p.y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      /* The blow.
         This was one large soft radial ellipse, and at 60x120 px hanging
         over the horizon it read as a ghost — I chased it through the
         cloud code, the star field and the moon before spotting it was
         the spout. Now it is a handful of small puffs that rise and
         separate, which is both what a blow looks like and impossible to
         mistake for a bug in the sky. */
      if (u > 0.16 && u < 0.60) {
        var b = (u - 0.16) / 0.44;              // 0..1 through the blow
        var bx = p.x + L * 0.28;
        var by = p.y - L * 0.10 * out;
        ctx.save();
        // Soft-edged and overlapping. Five hard-edged circles in a column
        // read as a stack of coins, not as mist.
        var fade = 0.50 * (1 - b) * Math.min(1, b * 6);
        for (var i = 0; i < 5; i++) {
          var lift = (0.13 + i * 0.075) * b;    // upper puffs travel further
          var px = bx + (rnd(i * 5.3) - 0.5) * L * 0.055 + (i - 2) * L * 0.012 * b;
          var py = by - L * lift;
          var r  = L * (0.055 + i * 0.013) * (0.5 + b * 0.8);
          var gg = ctx.createRadialGradient(px, py, 0, px, py, r);
          var aa = (fade * (1 - i * 0.12)).toFixed(3);
          gg.addColorStop(0.00, 'rgba(240,250,253,' + aa + ')');
          gg.addColorStop(0.55, 'rgba(232,246,251,' + (aa * 0.55).toFixed(3) + ')');
          gg.addColorStop(1.00, 'rgba(228,244,250,0)');
          ctx.fillStyle = gg;
          ctx.beginPath();
          ctx.ellipse(px, py, r * 1.15, r, 0, 0, 6.2832);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    /* ---- gulls ---- */
    var GULLS = [
      { z: 26, x0: -30, y: 13.0, spd: 2.2, flap: 5.5 },
      { z: 31, x0:  14, y: 16.5, spd: 1.7, flap: 4.7 },
      { z: 22, x0:  40, y: 10.5, spd: 2.6, flap: 6.2 }
    ];

    function drawGull(g, t) {
      var X = wrapX(g.x0 + g.spd * t, g.z);
      var hgt = g.y + Math.sin(t * 0.5 + g.x0) * 0.5;
      var p = project(X, hgt, g.z);
      var s = scaleAt(g.z);
      var w = 0.55 * s;
      if (w < 1.6 || p.y < 0 || p.y > H) return;

      // never let f reach 0: a wing at exactly flat draws as a dash and
      // reads as a smudge on the horizon rather than a bird
      var f = 0.22 + (Math.sin(t * g.flap) * 0.5 + 0.5) * 0.78;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(16,32,44,0.9)';
      ctx.lineWidth = Math.max(0.8, w * 0.14);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - w, p.y + w * 0.30 * f);
      ctx.quadraticCurveTo(p.x - w * 0.4, p.y - w * 0.32 * f, p.x, p.y);
      ctx.quadraticCurveTo(p.x + w * 0.4, p.y - w * 0.32 * f, p.x + w, p.y + w * 0.30 * f);
      ctx.stroke();
      ctx.restore();
    }

    function drawLife(t) {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      var i;
      // far to near
      var vs = VESSELS.slice().sort(function (a, b) { return b.z - a.z; });
      for (i = 0; i < vs.length; i++) drawVessel(vs[i], t);
      drawWhale(t);
      for (i = 0; i < POD.length; i++) drawDolphin(POD[i], t);
      for (i = 0; i < GULLS.length; i++) drawGull(GULLS[i], t);
    }

    /* ==============================================================
       SIZE, LOOP, LIFECYCLE
       ============================================================== */
    function resize() {
      var rect = host.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      var pw = Math.round(W * DPR), ph = Math.round(H * DPR);
      // the shader is the expensive half; run it at reduced resolution on
      // small screens where nobody can see the difference anyway
      var q = window.innerWidth < 700 ? 0.68 : 1;
      var gw = Math.max(1, Math.round(pw * q)), gh = Math.max(1, Math.round(ph * q));

      glCanvas.width = gw; glCanvas.height = gh;
      glCanvas.style.width = '100%'; glCanvas.style.height = '100%';
      if (gl) {
        gl.viewport(0, 0, gw, gh);
        gl.uniform2f(uRes, gw, gh);
        gl.uniform1f(uFY, FY);
        gl.uniform1f(uPitch, PITCH);
      }
      fgCanvas.width = pw; fgCanvas.height = ph;
      fgCanvas.style.width = '100%'; fgCanvas.style.height = '100%';
      if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function drawGL(t) {
      if (!gl) return;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uPtr, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var start = null;
    function frame(ts) {
      if (!running) return;
      // the app replaces its container on navigation; without this the
      // orphaned scene keeps running a rAF loop against a dead node
      if (host.isConnected === false) { running = false; return; }
      if (start === null) start = ts;
      var t = (ts - start) / 1000 + (opts.t0 || 0);
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      drawGL(t);
      drawLife(t);
      window.requestAnimationFrame(frame);
    }

    function play() {
      if (running || reduced) return;
      running = true; start = null;
      window.requestAnimationFrame(frame);
    }
    function pause() { running = false; }

    function still() {
      // a deliberately chosen moment: dolphin mid-leap, whale blowing
      resize(); drawGL(3.1); drawLife(3.1);
    }

    initGL();
    resize();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(reduced ? still : resize, 160);
    }, { passive: true });

    if (reduced) { still(); return { still: still }; }

    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
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
    }
    play();
    return { play: play, pause: pause };
  }

  /* ==================================================================
     BOOT
     ==================================================================
     The website has one fixed host that exists in the HTML. The super
     app does not: it renders its landing screen from JavaScript after
     load, so a single querySelector on DOMContentLoaded finds nothing
     and the card stays a flat gradient. Scan, then rescan on DOM
     changes, and attach to anything new.
     ================================================================== */
  var LIVE = 0, MAX_LIVE = 2;

  function attach(host) {
    if (!host || host.getAttribute('data-kd-sea-on') || LIVE >= MAX_LIVE) return;
    host.setAttribute('data-kd-sea-on', '1');
    LIVE++;
    try {
      Seascape(host, {
        glId: document.getElementById('heroWaves') ? 'heroWaves' : null,
        fgId: document.getElementById('heroNodes') ? 'heroNodes' : null,
        canvasClass: 'kd-sea'
      });
    } catch (e) {
      if (window.KD_SEASCAPE_DEBUG) console.error(e);
    }
  }

  function scan() {
    var fixed = document.querySelector('[data-kd-seascape]') ||
                document.querySelector('.hero-canvas');
    if (fixed) { attach(fixed); return; }
    var els = document.querySelectorAll('.land-top .land-film, .land-film, .filmcard');
    for (var i = 0; i < els.length; i++) attach(els[i]);
  }

  function boot() {
    scan();
    if (!window.MutationObserver) return;
    var t = null;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(scan, 120);
    }).observe(document.getElementById('app') || document.body,
               { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
